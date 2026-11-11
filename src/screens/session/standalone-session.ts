// The hooks that open a standalone game for a screen. The reading, the replay and the store are in standalone-open.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { useEffect, useMemo } from "react";

import { useOpenedAfterPaint } from "../nav/after-paint";
import { useDatabases } from "../data/databases";
import { cachedStandalone, openStandalone, type StandaloneSession } from "./standalone-open";
import { writeStandalone, writeStandaloneActive } from "../data/standalone-store";

export { continueStandaloneGame, openStandalone, restartStandaloneGame, standaloneCodes, standaloneStore, type StandaloneSession, type StandaloneTable } from "./standalone-open";

// The one write an open makes: a drop (the game does not read), or the world stamp of a current game from before it existed.
function writeDropped<TUser>(user: BaseSQLiteDatabase<"sync", TUser>, session: StandaloneSession | null): void {
  if (!session) return;
  if (session.ok) {
    if (session.stamp) writeStandaloneActive(user, session.stamp);
  } else if (session.write) writeStandalone(user, session.write);
}

/** The open game, opened once per id, during the render (the outcome screen: the table just left it cached). A drop it decided on is written after the render. */
export function useStandaloneSession(gameId: string | null): StandaloneSession | null {
  const { catalog, user } = useDatabases();
  const session = useMemo(() => (gameId ? openStandalone(catalog, user, gameId) : null), [catalog, user, gameId]);
  useEffect(() => writeDropped(user, session), [session, user]);
  return session;
}

/** The same, opened in an effect after the first paint and the push animation: null until then (the table shows its loading state). A cached game is held from the first render. */
export function useStandaloneSessionAfterPaint(gameId: string | null, attempt: number = 0): StandaloneSession | null {
  const { catalog, user } = useDatabases();
  // `attempt` counts the stale sheet's choices (Continue, Restart): a new count opens the game again, as a new key does.
  const session = useOpenedAfterPaint(gameId == null ? null : `${gameId}:${attempt}`, () => (gameId ? cachedStandalone(user, gameId) : null), () => (gameId ? openStandalone(catalog, user, gameId) : null));
  useEffect(() => writeDropped(user, session), [session, user]);
  return session;
}
