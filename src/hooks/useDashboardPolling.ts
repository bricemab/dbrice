import { useEffect, useRef, useCallback } from "react";

/**
 * Runs a callback on mount and then every `interval` ms.
 * Stops when the component unmounts or when `enabled` becomes false.
 */
export function useDashboardPolling(
  callback: () => void | Promise<void>,
  interval = 5000,
  enabled = true,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const tick = useCallback(async () => {
    await callbackRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    tick();
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [enabled, interval, tick]);
}
