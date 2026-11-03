// The table's foreground clock: counts the time the table was on screen with the app in the foreground, for the run's playtime
// (History). A span opens on resume and closes on pause; `take` hands out what has accrued since the last take, so the
// save folds it in as it writes. Pure of React: the hook that drives it is in use-play-clock.ts.
export type PlayClock = {
  resume: () => void;
  pause: () => void;
  /** The active ms since the last take, counting only resumed spans. */
  take: () => number;
};

export function createPlayClock(now: () => number = () => Date.now()): PlayClock {
  // When the open span began, or null while paused.
  let since: number | null = null;
  // Closed spans not yet taken.
  let banked = 0;
  const close = () => {
    if (since == null) return;
    banked += Math.max(0, now() - since);
    since = null;
  };
  return {
    resume: () => {
      if (since == null) since = now();
    },
    pause: close,
    take: () => {
      const running = since != null;
      close();
      const taken = banked;
      banked = 0;
      if (running) since = now();
      return taken;
    },
  };
}
