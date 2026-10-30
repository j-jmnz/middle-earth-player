// The hooks that open a standalone game for a screen. The reading, the replay and the store are in standalone-open.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { useEffect, useMemo } from "react";

import { useOpenedAfterPaint } from "./after-paint";
import { useDatabases } from "./databases";
import { openStandalone, type StandaloneSession } from "./standalone-open";
import { writeStandalone } from "./standalone-store";

export { openStandalone, standaloneCodes, standaloneStore, type StandaloneSession } from "./standalone-open";

function writeDropped<TUser>(user: BaseSQLiteDatabase<"sync", TUser>, session: StandaloneSession | null): void {
  if (session && !session.ok && session.write) writeStandalone(user, session.write);
}

/** The open game, opened once per id, during the render (the outcome screen: the table just left it cached). A drop it decided on is written after the render. */
export function useStandaloneSession(gameId: string | null): StandaloneSession | null {
  const { catalog, user } = useDatabases();
  const session = useMemo(() => (gameId ? openStandalone(catalog, user, gameId) : null), [catalog, user, gameId]);
  useEffect(() => writeDropped(user, session), [session, user]);
  return session;
}

/** The same, opened in an effect after the first paint and the push animation: null until then (the table shows its loading state). */
export function useStandaloneSessionAfterPaint(gameId: string | null): StandaloneSession | null {
  const { catalog, user } = useDatabases();
  const session = useOpenedAfterPaint(gameId, () => (gameId ? openStandalone(catalog, user, gameId) : null));
  useEffect(() => writeDropped(user, session), [session, user]);
  return session;
}

