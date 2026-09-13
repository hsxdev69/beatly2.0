"use client";

import { useEffect } from "react";

/** Registers the installable Android/iOS PWA shell. */
export function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Localhost and HTTPS are the only environments allowed to register SWs.
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Service workers are an enhancement; playback still works without one.
    });
  }, []);

  return null;
}
