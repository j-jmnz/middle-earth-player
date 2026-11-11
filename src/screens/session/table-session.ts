// The hooks that open the table's session for a screen. The reading, the replay and the store are in table-open.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { useEffect, useMemo } from "react";

import { useOpenedAfterPaint } from "../nav/after-paint";
import { writeSave } from "../data/campaign-store";
import { useDatabases } from "../data/databases";
import { cachedTable, openTable, type TableSession } from "./table-open";

export { continueTable, loadoutCodes, openTable, restartTable, recordUnclosedRun, sessionStore, type SessionStore, type TableSession } from "./table-open";

function writeDropped<TUser>(user: BaseSQLiteDatabase<"sync", TUser>, session: TableSession | null): void {
  if (session && !session.ok && session.write) writeSave(user, session.write);
}

/** The open scenario of a save, opened once per save id, during the render (the Resolution: the table just left it cached). */
export function useTableSession(saveId: string | null): TableSession | null {
  const { catalog, user } = useDatabases();
  const session = useMemo(() => (saveId ? openTable(catalog, user, saveId) : null), [catalog, user, saveId]);
  useEffect(() => writeDropped(user, session), [session, user]);
  return session;
}

/**
 * The same, opened in an effect after the first paint: null until then, and the table shows its loading
 * state meanwhile. A replay of a long game no longer holds back the frame the screen opens on. A session already cached (the
 * Resolution's Back to the table) is held from the first render, with no loading frame.
 */
export function useTableSessionAfterPaint(saveId: string | null, attempt: number = 0): TableSession | null {
  const { catalog, user } = useDatabases();
  // `attempt` counts the stale sheet's choices (Continue, Restart): a new count opens the save again, as a new key does.
  const session = useOpenedAfterPaint(saveId == null ? null : `${saveId}:${attempt}`, () => (saveId ? cachedTable(user, saveId) : null), () => (saveId ? openTable(catalog, user, saveId) : null));
  useEffect(() => writeDropped(user, session), [session, user]);
  return session;
}

