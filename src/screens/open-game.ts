// What the campaign and the standalone sessions share once a game's world is loaded: replay it for the table (keeping the
// steps of the round it reopens on for the log sheet), read each card's picture source and text, and build a table store
// that hands each accepted intent to the caller's writer. The table's state is never read from SQLite again after this:
// the store holds the reducer's result (docs/architecture.md, State).
import { inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { contextOf, type Resumed } from "../campaign/session";
import type { ReplayObserver } from "../campaign/replay";
import type { World } from "../campaign/world";
import { cards } from "../catalog/schema";
import { createTableStore, nextRoundSteps, type EngineStep, type PlayerIntent, type ReduceContext, type ScenarioState, type TableStore } from "../play/store";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type CardFacts = { imagesrc: string | null; text: string | null };

export function factsOf<TRun>(catalog: Db<TRun>, codes: Iterable<string>): Map<string, CardFacts> {
  const wanted = [...new Set(codes)];
  if (wanted.length === 0) return new Map();
  const rows = catalog.select({ code: cards.code, imagesrc: cards.imagesrc, text: cards.text }).from(cards).where(inArray(cards.code, wanted)).all();
  return new Map(rows.map((row) => [row.code, { imagesrc: row.imagesrc, text: row.text }]));
}

export type ReplayedGame = { world: World; ctx: ReduceContext; game: ScenarioState; roundSteps: readonly EngineStep[]; facts: ReadonlyMap<string, CardFacts> };

/** Replays a game through `resume` and gathers what the table draws. Null when the replay fails: the caller drops the game. */
export function replayForTable<TRun>(catalog: Db<TRun>, world: World, resume: (observe: ReplayObserver) => Resumed): ReplayedGame | null {
  let roundSteps: readonly EngineStep[] = [];
  const resumed = resume((before, after, steps) => {
    roundSteps = nextRoundSteps(roundSteps, before, after, steps);
  });
  if (!resumed.ok) return null;
  return { world, ctx: contextOf(world), game: resumed.state, roundSteps, facts: factsOf(catalog, world.cards.keys()) };
}

/** The table store of a replayed game. `persist` gets each intent the reducer accepts and writes it at once. */
export function committingStore(game: ReplayedGame, persist: (intent: PlayerIntent) => void): TableStore {
  return createTableStore({ ctx: game.ctx, game: game.game, roundSteps: game.roundSteps, onCommit: persist });
}
