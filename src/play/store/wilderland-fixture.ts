// Test helper for the Wilderland family's table (phase 51b): a game with the Evil Creatures pair or the Caves deck dealt, enemies and locations in the rows and a treasure guarded in the staging area, built with
// the rules' own spawn, as sea-fixture.ts builds the sea family's. No number in it is the table's.
import { definePrinted, type PrintedCard } from "../../rules/core/printed.ts";
import { ally, enemy, hero, table } from "../../rules/families/defense/table.ts";
import { guardWith } from "../../rules/families/objectives/guard.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";

import { fixtureViews } from "./fixture-views.ts";
import type { ZoneFacts } from "./selectors.ts";
import { zoneFactsOf } from "./zone-facts.ts";

export type WilderlandSpec = {
  seatCount?: 1 | 2;
  // The Evil Creatures deck and its discard pile, as counts of Wilderlands enemies; absent: the game does not deal them.
  evilDeck?: number;
  evilDiscard?: number;
  // The Caves deck, as a count of Lost Caves locations; absent: the game does not deal it.
  caves?: number;
  staging?: number;
  engaged?: number;
  allies?: number;
  // A treasure in the staging area, guarded by a troll that stands beside it, or free of encounters.
  treasure?: "guarded" | "free";
};

export type WilderlandFixture = { state: ScenarioState; ctx: ReduceContext; ids: Record<string, string>; facts: ZoneFacts; cards: ReadonlyMap<string, PrintedCard> };

/** A Wilderland table: Aragorn (and Gimli for two seats), the cards of the rows, and the decks asked for. */
export function wilderlandFixture(spec: WilderlandSpec = {}): WilderlandFixture {
  const seatCount = spec.seatCount ?? 1;
  const printed: PrintedCard[] = [
    hero("aragorn"),
    hero("gimli"),
    ally("friend"),
    enemy("warg", { engagementCost: 20 }),
    enemy("troll", { engagementCost: 40 }),
    definePrinted({ code: "cave", name: "Lost Cave", type: "location", threat: 1, questPoints: 3 }),
    definePrinted({ code: "treasure", name: "Axe of the Edain", type: "treasure", campaignKind: "treasure" }),
  ];
  const built = table({
    seatCount,
    cards: printed,
    effects: [],
    heroes: [{ code: "aragorn", seat: 0 }, ...(seatCount > 1 ? [{ code: "gimli", seat: 1 }] : [])],
    allies: Array.from({ length: spec.allies ?? 0 }, (_, at) => ({ code: "friend", key: `friend${at}` })),
    enemies: Array.from({ length: spec.engaged ?? 0 }, (_, at) => ({ code: "warg", key: `engaged${at}` })),
    staging: Array.from({ length: spec.staging ?? 0 }, (_, at) => ({ code: at % 2 === 0 ? "warg" : "cave", key: `staged${at}` })),
  });
  let state = built.state;
  const ids = { ...built.ids };
  const deal = (code: string, zone: "evilCreaturesDeck" | "evilCreaturesDiscard" | "cavesDeck", count: number, key: string) => {
    for (let at = 0; at < count; at += 1) {
      const made = spawn(state, code, { zone });
      state = made.state;
      ids[`${key}${at}`] = made.id;
    }
  };
  // A dealt deck is a list even when it is empty: the table shows an empty one as a dashed outline.
  if (spec.evilDeck != null) state = { ...state, piles: { ...state.piles, evilCreaturesDeck: [], evilCreaturesDiscard: [] } };
  if (spec.caves != null) state = { ...state, piles: { ...state.piles, cavesDeck: [] } };
  deal("warg", "evilCreaturesDeck", spec.evilDeck ?? 0, "evilDeck");
  deal("warg", "evilCreaturesDiscard", spec.evilDiscard ?? 0, "evilDiscard");
  deal("cave", "cavesDeck", spec.caves ?? 0, "caves");
  if (spec.treasure) {
    const made = spawn(state, "treasure", { zone: "staging" });
    state = made.state;
    ids.treasure = made.id;
    if (spec.treasure === "guarded") {
      const guard = spawn(state, "troll", { zone: "staging" });
      state = guardWith(guard.state, guard.id, made.id);
      ids.guard = guard.id;
    }
  }
  return { state, ctx: built.ctx, ids, facts: zoneFactsOf(built.ctx.cards), cards: built.ctx.cards };
}

/** The views the canvas draws for one seat of a fixture (fixture-views.ts). */
export const wilderlandViews = fixtureViews;
