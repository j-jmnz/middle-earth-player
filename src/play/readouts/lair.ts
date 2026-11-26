// Rules: mec112.setup-shelobs-lair, mec112.gollum-smeagol, rr.play-and-put-into-play, rr.active-location (data/rules/entries.json); ledger lines 144040:A:2, 144070:B:1, 144071:B:2, 144071:B:3, 144072:B:1, 144072:B:2.
//
// The pieces of Shelob's Lair's table (docs/design-system-table.md, Cards, Shelob's Lair): Shelob's resources (each is +1 Threat, and on stage 3B each cancels one instance of damage), Gollum's hit points on stage 3B (where his defeat
// goes to the victory display), the progress placed on the quest stage this round against stage 2B's cap of 4, each seat's allies this round against the 1 it may bring into play (a mark on its threat dial), and what the quest readout
// says of the progress held back. The engine decided every number (`questCapTally`, `entries`, `modifiedStat`, `placeQuestProgress`); nothing here changes one. Pure, so a test reads it.
import { flagged, inPlay, livingSeats } from "../../rules/core/state.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { questCapTally } from "../../rules/families/caves/progress.ts";
import { GOLLUM, gollumCard } from "../../rules/families/gollum/index.ts";
import { constantInstructions } from "../../rules/interpret/constant-records.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { placeQuestProgress } from "../../rules/quest/quest.ts";

import { ALLIES_AT_LIMIT_WORDS, alliesLabel, CAP_REACHED_WORDS, capWords, GOLLUM_LAIR_WORDS, progressSplitWords, shelobWords, UNDERGROUND_NO_PROGRESS_WORDS } from "../words/scenarios/lair.ts";
import type { TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const SHELOB = "144040";
const STAGE_ONE = "144070";
const PASS = "144071";
const STAGE_THREE = "144072";

/**
 * The dials Shelob's Lair's pieces hold now, in the order the top bar draws them: Shelob's resources (while she is in play), Gollum's hit points (stage 3B, while he is an enemy in play) and the stage's progress cap (while the Pass is the stage).
 * Only the cap warns, at the limit: a cap holds the players back, it does not lose them the game. Empty in any other scenario.
 */
export function lairDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const shelob = Object.values(game.cards).find((card) => card.code === SHELOB && inPlay(card.zone));
  if (shelob) {
    const engaged = shelob.zone === "engaged";
    dials.push({ id: "shelob", testID: "lair-shelob", label: "Shelob", name: `Resources on ${nameOf(SHELOB)}${engaged ? ":" : ", +1 Threat each:"}`, value: shelob.resources, note: shelobWords(shelob.resources, stage?.code === STAGE_THREE, engaged) });
  }
  // On stage 3B a defeated Gollum goes to the victory display (144072:B:1), so the dial says that and not what The Passage of the Marshes' dial says.
  const gollum = gollumCard(game);
  if (stage?.code === STAGE_THREE && gollum?.code === GOLLUM && inPlay(gollum.zone)) {
    const hitPoints = modifiedStat(game, gollum, "hitPoints", ctx.cards);
    dials.push({ id: "gollum", testID: "lair-gollum", label: "Gollum · HP", name: `${nameOf(GOLLUM)}'s hit points left`, value: Math.max(0, hitPoints - gollum.damage), limit: hitPoints, filled: Math.min(hitPoints, gollum.damage), goal: true, limitWords: GOLLUM_LAIR_WORDS });
  }
  const cap = stage?.code === PASS ? questCapTally(game) : null;
  if (cap) {
    dials.push({
      id: "cap",
      testID: "lair-cap",
      label: "This round",
      short: "Round",
      name: "Progress placed on the quest stage this round:",
      value: cap.placed,
      limit: cap.limit,
      ...(cap.placed >= cap.limit ? { warn: { level: "near" as const, words: CAP_REACHED_WORDS } } : {}),
      limitWords: capWords(cap.placed, cap.limit),
    });
  }
  return dials;
}

/** Each living seat's allies this round on its own threat dial (144071:B:2): its label says the count ("P1 \u00b7 1 ally", solo "1 ally") and at the limit the disc warns that no other can be played or put into play. Empty with no limit in force. */
export function lairHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  const limit = constantInstructions(game, ctx).flatMap(({ instruction }) => (instruction.verb === "LimitEntries" && instruction.perPlayer ? [instruction.max] : []))[0];
  if (limit == null) return [];
  const entered = game.entries?.round === game.round ? (game.entries.bySeat ?? []) : [];
  return livingSeats(game).map((seat) => {
    const count = entered[seat] ?? 0;
    return { seat, label: alliesLabel(count, game.seatCount > 1 ? seat : null), ...(count >= limit ? { warn: { level: "near" as const, words: ALLIES_AT_LIMIT_WORDS } } : {}) };
  });
}

/**
 * What the quest readout says of `progress` while Shelob's Lair holds some back, or null when it holds none: stage 2B's cap (the active location takes its share first, the stage the rest up to what is left of the 4, the rest is lost) and stage 1,
 * where an Underground active location takes none. The split is what the engine would place, run on a copy.
 */
export function lairProgressWords(game: ScenarioState, ctx: ReduceContext, progress: number): string | null {
  if (progress <= 0) return null;
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const active = game.activeLocation;
  if (stage?.code === STAGE_ONE) return active && flagged(game, active, "noProgressPlaced") ? UNDERGROUND_NO_PROGRESS_WORDS : null;
  if (stage?.code !== PASS || questCapTally(game) == null) return null;
  const steps: EngineStep[] = [];
  placeQuestProgress(game, progress, ctx.cards, steps, () => false, true);
  const placed = steps.flatMap((step) => (step.kind === "progress" && step.amount > 0 ? [step] : []));
  const onStage = placed.filter((step) => step.targetId === stage.id).reduce((sum, step) => sum + step.amount, 0);
  const onLocation = placed.filter((step) => step.targetId !== stage.id).reduce((sum, step) => sum + step.amount, 0);
  return progressSplitWords(progress, onLocation, onStage);
}
