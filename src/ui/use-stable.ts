import { useCallback, useLayoutEffect, useRef } from "react";

// A handler that keeps its identity and always calls the latest one: the canvas's gesture is built once per set of
// callbacks, and the table should not draw again because a handler closed over a newer game.
export function useStable<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
