/**
 * PO Token minter — runs in a dedicated worker thread.
 *
 * YouTube's CDN only serves complete media to clients that present a valid
 * Proof-of-Origin token (BotGuard attestation). We run BotGuard's VM inside
 * jsdom here so the Next.js server process keeps its own globals untouched.
 */
import { parentPort } from "node:worker_threads";
import { JSDOM } from "jsdom";
import { BotGuardClient, getChallenge } from "bgutils-js/botguard";
import { buildURL, GOOG_API_KEY, USER_AGENT } from "bgutils-js/utils";
import { WebPoMinter } from "bgutils-js/webpo";

const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
const REFRESH_MARGIN_S = 15 * 60;

let minter = null;
let expiresAt = 0;
let initPromise = null;
let domReady = false;

function setupDom() {
  if (domReady) return;
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "https://www.youtube.com/",
    referrer: "https://www.youtube.com/",
    userAgent: USER_AGENT,
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  domReady = true;
}

async function init() {
  setupDom();
  const challenge = await getChallenge({ requestKey: REQUEST_KEY, fetchFunction: fetch, useYouTubeAPI: false });
  const script = challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!script) throw new Error("BotGuard interpreter unavailable");
  new Function(script)();

  const bg = await BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObject: globalThis,
  });
  const webPoSignalOutput = [];
  const botguardResponse = await bg.snapshot({ webPoSignalOutput });

  const res = await fetch(buildURL("GenerateIT", false), {
    method: "POST",
    headers: {
      "content-type": "application/json+protobuf",
      "x-goog-api-key": GOOG_API_KEY,
      "x-user-agent": "grpc-web-javascript/0.1",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });
  if (!res.ok) throw new Error(`GenerateIT ${res.status}`);
  const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] = await res.json();
  minter = await WebPoMinter.create(
    { integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken },
    webPoSignalOutput,
  );
  expiresAt = Date.now() + Math.max(600, (estimatedTtlSecs ?? 3600) - REFRESH_MARGIN_S) * 1000;
}

function ensureReady() {
  if (minter && Date.now() < expiresAt) return Promise.resolve();
  if (!initPromise) {
    initPromise = init()
      .catch((e) => {
        minter = null;
        throw e;
      })
      .finally(() => {
        initPromise = null;
      });
  }
  return initPromise;
}

parentPort.on("message", async (msg) => {
  if (!msg || msg.type !== "mint") return;
  try {
    await ensureReady();
    const token = await minter.mintAsWebsafeString(msg.binding);
    parentPort.postMessage({ id: msg.id, token });
  } catch (e) {
    minter = null;
    parentPort.postMessage({ id: msg.id, error: e instanceof Error ? e.message : String(e) });
  }
});

ensureReady()
  .then(() => parentPort.postMessage({ type: "ready" }))
  .catch((e) => parentPort.postMessage({ type: "ready", error: e instanceof Error ? e.message : String(e) }));
