// Rules: mec113.phantom, rr.initial-threat-level, rr.quest-advancement, rr.travel (data/rules/entries.json); ledger lines 145016:A:2, 145016:A:3, 145017:A:3, 145064:B:2, 145065:B:2.
//
// The pieces of The Passing of the Grey Company's table (docs/design-system-table.md, Cards, The Passing of the Grey Company): the progress held on stage 3B against the progress The Stone of Erech's Travel removes (a goal dial: no amount of progress
// defeats the stage) until the players have travelled there, and on each seat's threat dial the mark of an Overcome by Fear it holds and, on stage 2B, a notch on the ring at the starting threat level it cannot fall below. An Overcome by Fear is itself a
// card in its seat's play area under its control, drawn there like any card; the dial's mark says where it hangs. The engine decided every number (`startingThreat`, the card's progress, the Travel line's amount); nothing here changes one. Pure, so a test reads it.
import type { Effect } from "../../catalog/boundary.ts";
import { flagged, inPlay, livingSeats } from "../../rules/core/state.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { dialCopy } from "../../rules/families/attachments/dial.ts";
import { startingThreat } from "../../rules/families/quest/threat.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import { dialLabel, FEAR_WORDS, floorAboveWords, floorWords, stoneProgressWords, STONE_WORDS } from "../words/scenarios/company.ts";
import type { TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const FEAR = "145016";
const STONE = "145017";
const STAGE_TWO = "145064";
const STAGE_THREE = "145065";

/** The Overcome by Fear on a seat's threat dial: a copy in play under the seat's control, attached to no card. */
export function fearOnDial(game: ScenarioState, seat: number): boolean {
  return dialCopy(game, seat, FEAR) != null;
}

/** The progress The Stone of Erech's Travel removes from the quest ("Remove 5 progress from stage 3B to travel here", 145017:A:3), read from its record. Null when the record holds no plain number. */
function stoneCost(ctx: ReduceContext): number | null {
  for (const effect of effectsOf(ctx, STONE) as readonly Effect[]) {
    if (effect.timing !== "travel") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "RemoveProgressFromQuest" && typeof instruction.amount === "number") return instruction.amount;
  }
  return null;
}

/** Whether the players have not yet travelled to The Stone of Erech: a copy is in play and is not the active location (once it is active, and once it has left play, the progress is no longer what pays for it). */
function stoneAwaits(game: ScenarioState): boolean {
  return Object.values(game.cards).some((card) => card.code === STONE && inPlay(card.zone) && card.id !== game.activeLocation);
}

/** The dial of stage 3B's held progress, while that stage is the current one and the Stone is still to be travelled to: the number against the progress its Travel removes. It never warms (the limit is the players' way on). Empty otherwise. */
export function companyDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const cost = stoneCost(ctx);
  if (stage?.code !== STAGE_THREE || cost == null || !stoneAwaits(game)) return [];
  return [{ id: "stone", testID: "company-stone", label: "To Erech", name: `Progress held on ${nameOf(STAGE_THREE)}, ${cost} to travel to ${nameOf(STONE)}:`, value: stage.progress, limit: cost, goal: true, limitWords: STONE_WORDS(cost) }];
}

/** What the quest readout says of `progress` on stage 3B while the Stone is still to be travelled to, or null: the progress pays the Stone's Travel and never defeats the stage. */
export function companyProgressWords(game: ScenarioState, ctx: ReduceContext, progress: number): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const cost = stoneCost(ctx);
  if (progress <= 0 || stage?.code !== STAGE_THREE || cost == null || !stoneAwaits(game)) return null;
  return stoneProgressWords(progress);
}

/** Each living seat's mark: "P1 · Fear" (solo "Fear") for an Overcome by Fear on its dial, said aloud as what it does, and, on stage 2B, the starting threat level as a notch on the dial's ring (`notch`) said aloud with it. A seat with neither has no mark. */
export function companyHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const marks: HandMark[] = [];
  for (const seat of livingSeats(game)) {
    const floor = stage?.code === STAGE_TWO && flagged(game, `seat:${seat}`, "threatFloor") ? startingThreat(game, seat, ctx) : null;
    const fear = fearOnDial(game, seat);
    const label = dialLabel(game.seatCount > 1 ? seat : null, fear);
    if (label == null && floor == null) continue;
    const spoken = [fear ? FEAR_WORDS : null, floor == null ? null : (game.seats[seat]?.threat ?? 0) <= floor ? floorWords(floor) : floorAboveWords(floor)].filter((words) => words != null);
    marks.push({ seat, label: label ?? (game.seatCount > 1 ? `P${seat + 1}` : "Threat"), ...(spoken.length > 0 ? { note: spoken.join(" ") } : {}), ...(floor != null ? { notch: floor } : {}) });
  }
  return marks;
}
