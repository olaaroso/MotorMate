"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` while the tab is visible, and right away
 * when a hidden tab becomes visible again. Nothing runs while the tab is hidden.
 */
export function useVisibleInterval(callback: () => void, intervalMs: number, enabled = true) {
  const latestCallback = useRef(callback);

  useEffect(() => {
    latestCallback.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    const runIfVisible = () => {
      if (document.visibilityState === "visible") latestCallback.current();
    };
    const timer = window.setInterval(runIfVisible, intervalMs);
    document.addEventListener("visibilitychange", runIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", runIfVisible);
    };
  }, [enabled, intervalMs]);
}
