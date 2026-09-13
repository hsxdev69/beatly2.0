/**
 * Main-thread client for the PO Token worker (workers/pot-worker.mjs).
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

/** Must match bgutils' USER_AGENT — the token is tied to the environment. */
export const YT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)";

type Pending = { resolve: (t: string) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

const g = globalThis as typeof globalThis & {
  __beatlyPotWorker?: Worker | null;
  __beatlyPotPending?: Map<number, Pending>;
  __beatlyPotSeq?: number;
};
const pending = (g.__beatlyPotPending ??= new Map());

function getWorker(): Worker {
  if (g.__beatlyPotWorker) return g.__beatlyPotWorker;

  // In Vercel's Node serverless runtime the worker must be present in the
  // traced function bundle. next.config.ts explicitly includes workers/**/*;
  // this check turns a packaging problem into a useful error instead of a
  // silent LOGIN_REQUIRED from the resolver.
  const candidates = [
    path.join(process.cwd(), "workers", "pot-worker.mjs"),
    path.join(process.cwd(), ".next", "server", "workers", "pot-worker.mjs"),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) {
    throw new Error(
      `PO token worker missing from deployment. Checked: ${candidates.join(", ")}`,
    );
  }

  const worker = new Worker(file);
  worker.on("message", (m: { id?: number; token?: string; error?: string }) => {
    if (m.id === undefined) return;
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.error || !m.token) p.reject(new Error(m.error ?? "mint failed"));
    else p.resolve(m.token);
  });
  const fail = (err: unknown) => {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err instanceof Error ? err : new Error(String(err)));
    }
    pending.clear();
    g.__beatlyPotWorker = null;
  };
  worker.on("error", fail);
  worker.on("exit", (code) => fail(new Error(`PO token worker exited (${code})`)));
  // Do not call `unref()` here. On a Vercel serverless invocation the worker
  // must keep the Node process alive until BotGuard posts the PO token back;
  // unref() can let the invocation finish while the resolver is still waiting.
  g.__beatlyPotWorker = worker;
  return worker;
}

/** Mint a Proof-of-Origin token bound to `binding` (visitor data or a video id). */
export function mintPoToken(binding: string, timeoutMs = 30_000): Promise<string> {
  const worker = getWorker();
  const id = (g.__beatlyPotSeq = (g.__beatlyPotSeq ?? 0) + 1);
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("PO token mint timed out"));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type: "mint", binding });
  });
}
