"use client";
/** Dominant-colour extraction from album art (client-side canvas). */
import { useEffect, useState } from "react";

export type RGB = [number, number, number];
const cache = new Map<string, Promise<RGB | null>>();
export const FALLBACK: RGB = [255, 79, 139];

export function extractColor(url: string): Promise<RGB | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<RGB | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i], G = data[i + 1], B = data[i + 2];
          const max = Math.max(R, G, B), min = Math.min(R, G, B);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (max + min) / 510;
          // Prefer saturated, mid-luminance pixels so the theme feels vivid.
          const weight = 0.15 + sat * 2 + (1 - Math.abs(lum - 0.5) * 2) * 0.6;
          r += R * weight; g += G * weight; b += B * weight; w += weight;
        }
        if (!w) return resolve(null);
        resolve([Math.round(r / w), Math.round(g / w), Math.round(b / w)]);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cache.set(url, p);
  return p;
}

export function useArtworkColor(url: string | null | undefined, enabled = true): RGB {
  const [rgb, setRgb] = useState<RGB>(FALLBACK);
  useEffect(() => {
    let alive = true;
    if (!url || !enabled) {
      setRgb(FALLBACK);
      return;
    }
    extractColor(url).then((c) => alive && setRgb(c ?? FALLBACK));
    return () => {
      alive = false;
    };
  }, [url, enabled]);
  return rgb;
}

export const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** Darken for OLED-friendly backgrounds. */
export const shade = (c: RGB, f: number): RGB => [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];

/* ------------------------------------------------------------------ */
/* Accent color helpers                                                */
/* ------------------------------------------------------------------ */
export function hexToRgb(hex: string): RGB {
  const clean = hex.trim().replace(/^#/, "");
  let h = clean;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [255, 79, 139];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(c: RGB): string {
  return `#${((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1)}`;
}

/** Perceived luminance — used to pick black/white text on accents. */
export function luminance(c: RGB): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Adjust each channel by `amount` (-1..1), then clamp. */
export function adjust(c: RGB, amount: number): RGB {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  return [f(c[0]), f(c[1]), f(c[2])];
}

/** Space-separated "R G B" for `rgb(R G B / alpha)` syntax. */
export const rgbSpace = (c: RGB) => `${c[0]} ${c[1]} ${c[2]}`;

/** E.g. "255,79,139" for legacy `rgba(r,g,b,a)` strings. */
export const rgbComma = (c: RGB) => `${c[0]},${c[1]},${c[2]}`;

export const accentRgb = (hex: string) => hexToRgb(hex);
export const accentHex = (hex: string) => rgbToHex(hexToRgb(hex));
export const accentForeground = (hex: string) =>
  luminance(hexToRgb(hex)) > 0.35 ? "#000000" : "#ffffff";
export const accentDark = (hex: string) => rgbToHex(adjust(hexToRgb(hex), -0.22));
export const accentLight = (hex: string) => rgbToHex(adjust(hexToRgb(hex), 0.12));
export const accentAlpha = (hex: string, alpha: number) => `rgba(${rgbComma(hexToRgb(hex))},${alpha})`;
