// E2E ONLY, web only (metro.config.js serves it in place of standalone-session.ts on the web platform; the phone's bundle never holds it). The standalone table route opens the game
// `standalone-e2e-scene` (scene-dump.ts) as the table of the scene the page was given, for `pnpm browser shot --scene` and `--moment`: its store has no writer, so an intent the player
// sends is played but never saved. It answers only in the e2e-test build (EXPO_PUBLIC_E2E_SEED) and only with a scene on the page; every other game opens as the phone's module opens it.
import { useMemo } from "react";

import { createTableStore } from "../../../play/store/store";
import { e2eBuild } from "../../nav/e2e";
import { useDatabases } from "../../data/databases";
import { factsOf } from "../open-game";
import { createPlayClock } from "../play-clock";
import { useStandaloneSessionAfterPaint as phoneAfterPaint, standaloneStore as phoneStore, type StandaloneSession, type StandaloneTable } from "../standalone-session";
import { openScene, SCENE_GAME, sceneOfWindow } from "./scene-dump";

export { continueStandaloneGame, openStandalone, restartStandaloneGame, standaloneCodes, useStandaloneSession, type StandaloneSession, type StandaloneTable } from "../standalone-session";

/**
 * The store of a scene: the reducer plays, nothing is written. A scene is a table in the middle of a game, so it holds one undoable step (back to itself): without it the table would open
 * as a new deal, on the quest screen's Begin.
 */
function sceneTable(session: Extract<StandaloneSession, { ok: true }>): StandaloneTable {
  const history = [{ before: session.game, roundSteps: [], intent: { type: "Pass" as const }, steps: [] }];
  return { store: createTableStore({ ctx: session.ctx, game: session.game, history }), game: () => session.stored, clock: createPlayClock() };
}

export function useStandaloneSessionAfterPaint(gameId: string | null, attempt: number = 0): StandaloneSession | null {
  const { catalog } = useDatabases();
  const scene = gameId === SCENE_GAME && e2eBuild();
  const opened = phoneAfterPaint(scene ? null : gameId, attempt);
  const given = useMemo(() => {
    const dump = scene ? sceneOfWindow() : null;
    return dump ? openScene(dump, (codes) => factsOf(catalog, codes)) : null;
  }, [scene, catalog]);
  return scene ? given : opened;
}

export function standaloneStore<TRun>(session: Extract<StandaloneSession, { ok: true }>, user: Parameters<typeof phoneStore<TRun>>[1]): StandaloneTable {
  return session.stored.id === SCENE_GAME && e2eBuild() ? sceneTable(session) : phoneStore(session, user);
}
