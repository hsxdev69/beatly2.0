"use client";

import { useState, type CSSProperties } from "react";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Artwork with graceful degradation (falls back to smaller sizes, then an icon). */
export function Artwork({
  src,
  alt,
  className,
  iconSize = 20,
  style,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: number;
  style?: CSSProperties;
}) {
  const [step, setStep] = useState(0);
  const sources = [src, src?.replace(/=w\d+-h\d+[^&]*/, "=w226-h226-l90-rj"), src?.replace("maxresdefault.jpg", "hqdefault.jpg")]
    .filter((s, i, arr): s is string => Boolean(s) && arr.indexOf(s) === i);
  const current = sources[step];
  if (current) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={current} alt={alt} loading="lazy" onError={() => setStep((s) => s + 1)} className={cn("shrink-0 object-cover", className)} style={style} />
    );
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-gradient-to-br from-surface-4 to-surface-2 text-muted", className)} style={style}>
      <Music2 size={iconSize} />
    </span>
  );
}
