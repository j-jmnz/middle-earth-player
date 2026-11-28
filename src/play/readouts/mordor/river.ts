// Rules: rr.forced, rr.quest-advancement (data/rules/entries.json); ledger lines 21012:A:1, 21076:B:2 (docs/scenarios/vengeance-of-mordor/the-river-running.md, Table).
//
// The two numbers The River Running keeps in view, as top-bar dials. Easterling Pursuit's resources count toward 3, the number at which the end of the round adds enemies: a plain limit that warms at 2 or more (the Forced effect adds 1 and then checks for 3 or more, and a card can put the count over 3 during the round, so the dial can hold 3 or more until the end of the round). Stage 2B's progress cap
// (5 a round while a player is engaged with an enemy) fills toward the cap and says "near" at it, as the Woodland Realm's does (readouts/round-cap.ts). The engine decided every number (the resources on the card, `questProgressCap`, `questProgressPlaced`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";

import type { TableDial } from "../dials.ts";
import { roundCapDial } from "../round-cap.ts";
import { capWords, pursuitLimitWords, pursuitNearWords, pursuitWords } from "./river-words.ts";

const SCENARIO = "the-river-running";
/** Easterling Pursuit and the cap stage (The Crossing of Araw). */
const PURSUIT = "21012";
const CROSSING = "21076";
/** The resources that make the end of the round add enemies. */
const PURSUIT_AT = 3;

/** The dials the table holds now: the progress cap on stage 2B once a cap is held, then the Pursuit count while the card is in play (the cap first, so it shows when the bar is short of room). None in any other scenario. */
export function riverDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const stage = game.cards[game.questStage ?? ""];
  if (stage?.code === CROSSING) {
    const name = nameOf(stage.code);
    const cap = roundCapDial(game, stage, name, "river-cap", (placed, limit) => capWords(placed, limit, name));
    if (cap) dials.push(cap);
  }
  const pursuit = Object.values(game.cards).find((card) => card.code === PURSUIT && (card.zone === "staging" || card.zone === "engaged"));
  if (pursuit) {
    // With 2 or more resources the end of the round brings it to 3 or more: the Forced effect adds 1 and then checks (21012:A:1), so a count over 3 (21016:A:1, 21015:A:2, 21013:A:2 add during the round) adds enemies at once too.
    const warm = pursuit.resources >= PURSUIT_AT - 1;
    dials.push({ id: "pursuit", testID: "river-pursuit", label: "Pursuit", name: `Resources on ${nameOf(PURSUIT)}:`, value: pursuit.resources, limit: PURSUIT_AT, limitWords: pursuitLimitWords(), ...(warm ? { warms: true as const, warn: { level: "near" as const, words: pursuitNearWords(pursuit.resources) } } : {}), cardId: pursuit.id, note: pursuitWords(pursuit.resources) });
  }
  return dials;
}
