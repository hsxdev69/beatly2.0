"use client";

import { useEffect } from "react";
import { useLocal } from "@/store/local";
import { hexToRgb, rgbSpace, adjust, rgbToHex } from "@/lib/color";

/**
 * Watches the user's accent preference and writes it to CSS variables on
 * `:root`. Every `bg-brand-*` / `text-brand-*` / `shadow-brand/*` utility
 * plus any `--accent-*` custom property re-themes instantly with no rebuild.
 */
export function ThemeAccent() {
  const accentColor = useLocal((s) => s.settings.accentColor);

  useEffect(() => {
    const root = document.documentElement;
    const rgb = hexToRgb(accentColor);
    root.style.setProperty("--accent", rgbToHex(rgb));
    root.style.setProperty("--accent-dark", rgbToHex(adjust(rgb, -0.22)));
    root.style.setProperty("--accent-rgb", rgbSpace(rgb));
    // Also refresh Tailwind's brand variables so all `*-brand-*` utilities update.
    root.style.setProperty("--color-brand", rgbToHex(rgb));
    root.style.setProperty("--color-brand-dark", rgbToHex(adjust(rgb, -0.22)));
  }, [accentColor]);

  return null;
}
