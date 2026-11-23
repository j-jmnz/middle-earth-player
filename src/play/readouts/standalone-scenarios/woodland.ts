// Rules: rr.forced, rr.quest-advancement (data/rules/entries.json); ledger lines 51103:B:2, 51104:B:3, 51105:B:2, 51108:B:3 (docs/scenarios/standalone-scenarios/the-woodland-realm.md, The Woodland Realm, The table and readings 9, 14 and 21; docs/design-system-table.md, Top bar).
//
// The two limits The Woodland Realm's stages set, as top-bar dials. Stage 2 caps the progress placed on it each round (5, or 10 when Mendor was committed: the cap is fixed at the staging step, so the dial appears then): the ring fills toward the cap
// and says "near" at it, as a plain limit. Stage 3B "To the Elvenking's Halls" counts the progress placed on it in the quest phase against 10, the number that reveals a card after a successful quest: a goal dial, full at 10. The engine
// decided every number (`questProgressCap`, `questProgressPlaced`, `questProgressPhase`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { heldLeast } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import { capFullWords, capLimitWords, capWords, phaseLimitWords, phaseWords } from "./woodland-words.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "the-woodland-realm";
const STAGE_TWO: ReadonlySet<string> = new Set(["51103", "51104", "51105"]);
const HALLS = "51108";
/** The progress on stage 3B that reveals a card. */
const REVEAL_AT = 10;

const total = (game: ScenarioState, stat: "questProgressPlaced" | "questProgressPhase"): number =>
  game.modifiers.filter((modifier) => modifier.stat === stat && modifier.instanceId === "table").reduce((sum, modifier) => sum + modifier.amount, 0);

/** The dials the stage holds now: the cap on stage 2 once the staging step set it, the phase tally on stage 3B. None in any other scenario or on any other stage. */
export function woodlandDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const stage = game.cards[game.questStage ?? ""];
  if (!stage) return [];
  const name = nameOf(stage.code);
  if (STAGE_TWO.has(stage.code)) {
    const cap = heldLeast(game, "table", "questProgressCap");
    if (cap <= 0) return [];
    const placed = total(game, "questProgressPlaced");
    // A plain limit, not a loss: it says "near" once the cap is reached and never warms (as the Hunt's progress cap does).
    const warn = placed >= cap ? { level: "near" as const, words: capFullWords(name) } : null;
    return [{ id: "cap", testID: "woodland-cap", label: "Cap", name: `Progress placed on ${name} this round, no more than ${cap}:`, value: placed, limit: cap, limitWords: capLimitWords(), ...(warn ? { warn } : {}), cardId: stage.id, note: capWords(placed, cap, name) }];
  }
  if (stage.code === HALLS) {
    const placed = total(game, "questProgressPhase");
    return [{ id: "phase", testID: "woodland-phase", label: "Reveal", name: `Progress placed on ${name} this phase:`, value: placed, limit: REVEAL_AT, goal: true, limitWords: phaseLimitWords(), cardId: stage.id, note: phaseWords(placed, name) }];
  }
  return [];
}
