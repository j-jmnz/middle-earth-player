// Rules: mec113.phantom, rr.initial-threat-level, rr.quest-advancement (data/rules/entries.json); ledger lines 145016:A:2, 145016:A:3, 145017:A:3, 145064:B:2, 145065:B:2.
//
// The pieces of The Passing of the Grey Company's table (docs/design-system-table.md, Cards, The Passing of the Grey Company): the progress held on stage 3B against the 5 its Stone's Travel removes (a goal dial: no amount of progress defeats the stage), and on each
// seat's threat dial the mark of an Overcome by Fear it holds and, on stage 2B, the starting threat level it cannot fall below. An Overcome by Fear is itself a card in its seat's play area under its control, drawn there like any card; the dial's mark says where it hangs.
// The engine decided every number (`startingThreat`, the card's progress); nothing here changes one. Pure, so a test reads it.
import { flagged, livingSeats } from "../../rules/core/state.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { startingThreat } from "../../rules/families/quest/threat.ts";

import { dialLabel, floorWords, STONE_WORDS } from "../words/scenarios/company.ts";
import type { TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const FEAR = "145016";
const STAGE_TWO = "145064";
const STAGE_THREE = "145065";
// The progress The Stone of Erech's Travel removes from stage 3B (145017:A:3).
const STONE_COST = 5;

/** The Overcome by Fear on a seat's threat dial: a copy in play under the seat's control, attached to no card. */
export function fearOnDial(game: ScenarioState, seat: number): boolean {
  return Object.values(game.cards).some((card) => card.code === FEAR && card.zone === "play" && card.controller === seat && card.host == null);
}

/** The dial of stage 3B's held progress, while that stage is the current one: the number against the 5 the Stone's Travel removes. It never warms (the limit is the players' way on). Empty on any other stage. */
export function companyDials(game: ScenarioState, _ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (stage?.code !== STAGE_THREE) return [];
  return [{ id: "stone", testID: "company-stone", label: "Stage 3B", name: `Progress held on ${nameOf(STAGE_THREE)}, ${STONE_COST} to travel to The Stone of Erech:`, value: stage.progress, limit: STONE_COST, goal: true, limitWords: STONE_WORDS }];
}

/** Each living seat's mark: "P1 · Fear · floor 28" (solo "Fear · floor 28"), warning when its threat is at its floor on stage 2B. A seat with neither piece has no mark. */
export function companyHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const marks: HandMark[] = [];
  for (const seat of livingSeats(game)) {
    const floor = stage?.code === STAGE_TWO && flagged(game, `seat:${seat}`, "threatFloor") ? startingThreat(game, seat, ctx) : null;
    const label = dialLabel(game.seatCount > 1 ? seat : null, fearOnDial(game, seat), floor);
    if (label == null) continue;
    const atFloor = floor != null && (game.seats[seat]?.threat ?? 0) <= floor;
    marks.push({ seat, label, ...(atFloor && floor != null ? { warn: { level: "near" as const, words: floorWords(floor) } } : {}) });
  }
  return marks;
}
