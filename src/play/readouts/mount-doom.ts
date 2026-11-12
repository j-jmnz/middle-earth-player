// Rules: mec113.fortitude-tests, mec113.dire, mec113.saga-staging-rules, rr.then (data/rules/entries.json); ledger lines 146043:A:1, 146057:A:1, 146076:B:2, 146077:B:2, 146079:A:1, 146079:A:2.
//
// The pieces of Mount Doom's table (docs/design-system-table.md, Cards, Mount Doom): the tokens on the campaign card as a countdown that warns near its end, stage 2B's resources against the number of players, what the quest readout adds on stages 2B and 3B (the cap after a
// failed Fortitude test) and Mount Doom's X, and the seat whose hero carries Heavy and Tired. The Fortitude test's own numbers are in readouts/fortitude.ts. The engine decided every number (the tokens, `questProgressCap`, the host); nothing here changes one. Pure, so a test reads it.
import { heldLeast, livingSeats } from "../../rules/core/state.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { doomWarn, doomWords, doomXWords, stageThreeCapWords, stageTwoWords, tiredLabel, tiredWords } from "../words/scenarios/mount-doom.ts";
import { cardsOf, type TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const SCENARIO = "mount-doom";
const CAMPAIGN_CARD = "146079";
const MOUNT_DOOM = "146043";
const HEAVY_AND_TIRED = "146057";
const STAGE_TWO = "146076";
const STAGE_THREE = "146077";

/** What the quest readout adds: stage 3B's cap on the progress this round once the first player failed the test, and Mount Doom's X while it is in the staging area. Empty on every other moment and in any other scenario. */
export function mountDoomQuestNote(game: ScenarioState, ctx: ReduceContext): string {
  if (game.scenarioId !== SCENARIO) return "";
  const notes: string[] = [];
  const stage = game.cards[game.questStage ?? ""]?.code;
  const cap = heldLeast(game, "table", "questProgressCap");
  if (stage === STAGE_THREE && cap > 0) notes.push(stageThreeCapWords(cap));
  const doom = cardsOf(game, MOUNT_DOOM).find((card) => card.zone === "staging");
  if (doom) notes.push(doomXWords(modifiedStat(game, doom, "threat", ctx.cards), game.seats[game.firstPlayer]?.threat ?? 0));
  return notes.length > 0 ? `. ${notes.join(". ")}` : "";
}

/**
 * The dials Mount Doom's pieces hold now, in the order the top bar draws them: the tokens on the campaign card first (the one that warns: the count only falls, two left is near and the last one critical, and it is no ring that fills), then the resources on stage 2B toward
 * the number of players (a goal dial: the ring fills in the accent and is full only when the quest advances). Empty in any other scenario, and with no campaign card in the game (a standalone one has no timer).
 */
export function mountDoomDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const card = cardsOf(game, CAMPAIGN_CARD)[0];
  if (card) {
    const tokens = card.resources;
    const warn = doomWarn(tokens);
    dials.push({ id: "doom", testID: "doom-tokens", label: "Doom", name: `Resource tokens on ${nameOf(CAMPAIGN_CARD)}:`, value: tokens, ...(warn ? { warn } : {}), note: doomWords(tokens, tokens > 0 || game.round > 1) });
  }
  const stage = game.cards[game.questStage ?? ""];
  if (stage?.code === STAGE_TWO) {
    const players = livingSeats(game).length;
    dials.push({ id: "resources", testID: "doom-resources", label: "Stage", name: `Resources on ${nameOf(STAGE_TWO)}, of ${players}:`, value: stage.resources, limit: players, goal: true, note: stageTwoWords(stage.resources, players) });
  }
  return dials;
}

/** The mark of the seat whose hero carries Heavy and Tired. Empty while it is not attached to a hero and in any other scenario. */
export function mountDoomHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO) return [];
  return cardsOf(game, HEAVY_AND_TIRED).flatMap((card) => {
    const host = card.host ? game.cards[card.host] : undefined;
    return host && host.controller != null ? [{ seat: host.controller, label: tiredLabel(game.seatCount > 1 ? host.controller : null), note: tiredWords(printedOf(ctx.cards, host.code).name) }] : [];
  });
}
