// Rules: rr.forced, rr.quest-advancement (data/rules/entries.json); ledger lines 21012:A:1, 21076:B:2 (docs/scenarios/vengeance-of-mordor/the-river-running.md, Table).
//
// The two numbers The River Running keeps in view, as top-bar dials. Easterling Pursuit's resources count toward 3, the number at which the end of the round adds enemies: a plain limit that warms one short of it (it is never held at 3, the Forced effect removes them). Stage 2B's progress cap (5 a round while a player is engaged with an enemy)
// fills toward the cap and says "near" at it, as the Woodland Realm's does. The engine decided every number (the resources on the card, `questProgressCap`, `questProgressPlaced`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { heldLeast } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import type { TableDial } from "../dials.ts";
import { capFullWords, capLimitWords, capWords, pursuitLimitWords, pursuitNearWords, pursuitWords } from "./river-words.ts";

const SCENARIO = "the-river-running";
/** Easterling Pursuit and the cap stage (The Crossing of Araw). */
const PURSUIT = "21012";
const CROSSING = "21076";
/** The resources that make the end of the round add enemies. */
const PURSUIT_AT = 3;

/** The dials the table holds now: the Pursuit count while the card is in play, the progress cap on stage 2B once a cap is held. None in any other scenario. */
export function riverDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const pursuit = Object.values(game.cards).find((card) => card.code === PURSUIT && (card.zone === "staging" || card.zone === "engaged"));
  if (pursuit) {
    const warm = pursuit.resources === PURSUIT_AT - 1;
    dials.push({ id: "pursuit", testID: "river-pursuit", label: "Pursuit", name: `Resources on ${nameOf(PURSUIT)}:`, value: pursuit.resources, limit: PURSUIT_AT, limitWords: pursuitLimitWords(), ...(warm ? { warms: true as const, warn: { level: "near" as const, words: pursuitNearWords() } } : {}), cardId: pursuit.id, note: pursuitWords(pursuit.resources) });
  }
  const stage = game.cards[game.questStage ?? ""];
  if (stage?.code === CROSSING) {
    const cap = heldLeast(game, "table", "questProgressCap");
    if (cap > 0) {
      const name = nameOf(stage.code);
      const placed = game.modifiers.filter((modifier) => modifier.stat === "questProgressPlaced" && modifier.instanceId === "table").reduce((sum, modifier) => sum + modifier.amount, 0);
      const warn = placed >= cap ? { level: "near" as const, words: capFullWords(name) } : null;
      dials.push({ id: "cap", testID: "river-cap", label: "Cap", name: `Progress placed on ${name} this round, no more than ${cap}:`, value: placed, limit: cap, limitWords: capLimitWords(), ...(warn ? { warn } : {}), cardId: stage.id, note: capWords(placed, cap, name) });
    }
  }
  return dials;
}
