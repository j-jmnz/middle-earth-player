// What the campaign and the standalone sessions share once a game's world is loaded: replay it for the table (keeping the
// steps of the round it reopens on for the log sheet and the states Undo can go back to), read each card's picture source
// and text, and build a table store that hands each accepted intent, and each one taken back, to the caller's writer. The table's state is never read from SQLite again after this:
// the store holds the reducer's result (docs/architecture.md, State).
import { inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { contextOf, type Resumed } from "../campaign/session";
import type { ReplayObserver } from "../campaign/replay";
import type { World } from "../campaign/world";
import { cards } from "../catalog/schema";
import { createTableStore, keepIntent, type EngineStep, type Kept, type PlayerIntent, type ReduceContext, type ScenarioState, type TableStore } from "../play/store/store";
import type { Undoable } from "../play/store/undo-history";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// `imagesrc` is side A's picture to download, `backImagesrc` side B's (a card the table shows on its B side, src/play/canvas/picture-key.ts).
export type CardFacts = { imagesrc: string | null; backImagesrc: string | null; text: string | null };

export function factsOf<TRun>(catalog: Db<TRun>, codes: Iterable<string>): Map<string, CardFacts> {
  const wanted = [...new Set(codes)];
  if (wanted.length === 0) return new Map();
  const rows = catalog.select({ code: cards.code, imagesrc: cards.imagesrc, backImagesrc: cards.backImagesrc, text: cards.text }).from(cards).where(inArray(cards.code, wanted)).all();
  return new Map(rows.map((row) => [row.code, { imagesrc: row.imagesrc, backImagesrc: row.backImagesrc, text: row.text }]));
}

export type ReplayedGame = { world: World; ctx: ReduceContext; game: ScenarioState; roundSteps: readonly EngineStep[]; history: readonly Undoable[]; facts: ReadonlyMap<string, CardFacts> };

/** Replays a game through `resume` and gathers what the table draws. Null when the replay fails: the caller drops the game. */
export function replayForTable<TRun>(catalog: Db<TRun>, world: World, resume: (observe: ReplayObserver) => Resumed): ReplayedGame | null {
  // The same fold the store runs on each intent it sends (keepIntent), so a reopened game can be undone as far as before.
  let kept: Kept = { roundSteps: [], history: [] };
  const resumed = resume((before, after, steps, intent) => {
    kept = keepIntent(kept, before, after, steps, intent);
  });
  if (!resumed.ok) return null;
  return { world, ctx: contextOf(world), game: resumed.state, ...kept, facts: factsOf(catalog, world.cards.keys()) };
}

/**
 * The table store of a replayed game. `persist` gets each intent the reducer accepts and writes it at once; `takeBack`
 * drops the last one when Undo goes back over it.
 */
export function committingStore(game: ReplayedGame, persist: (intent: PlayerIntent, game: ScenarioState) => void, takeBack: () => void): TableStore {
  return createTableStore({ ctx: game.ctx, game: game.game, roundSteps: game.roundSteps, history: game.history, onCommit: persist, onUndo: takeBack });
}
