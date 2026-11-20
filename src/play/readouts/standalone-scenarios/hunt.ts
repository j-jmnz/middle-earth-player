// Rules: rr.damage, rr.quest-advancement, rr.action (data/rules/entries.json); ledger lines 40013:A:1, 40013:A:2, 40013:A:3, 40013:B:2, 40004:B:2, 40005:B:1, 40001:B:2, 40002:B:1 (docs/brief.md, The Hunt for the Dreadnaught, The table; docs/design-system-table.md, Top bar).
//
// The pieces The Hunt for the Dreadnaught's cards hold on the table, as top-bar dials: the Dreadnaught's hit points left against the 15 for each player who started (a goal dial: destroying it wins; it warns when the next end of the round flips it), the damage it
// took this round against its cap of 5 for each player and the progress placed on stage 1B or 2B this round against its cap (plain limits: they say "near" at the cap and never warm), after the mode card's Quest Action, a word dial that says Ready or Used (once in the game for every group). The ships'
// Upgraded side and the Corsair deck are drawn by the card and the pile as for any ship (the dream-chaser table). The engine decided every number (`modifiedStat`, `roundDamage`, `questCapTally`, `uses`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";
import { heldAmount } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { questCapTally } from "../../../rules/families/caves/progress.ts";

import type { TableDial } from "../dials.ts";
import { dreadnaughtFlipWords, dreadnaughtLimitWords, dreadnaughtWords, questActionWords, roundDamageLimitWords, roundDamageReachedWords, roundDamageWords, stageCapLimitWords, stageCapReachedWords, stageCapWords } from "./hunt-words.ts";

const SCENARIO = "the-hunt-for-the-dreadnaught";
const DREADNAUGHT = "40013";
const STAGES = ["40004", "40005"];
const QUEST_ACTIONS: Readonly<Record<string, boolean>> = { "40001:action:1": false, "40002:action:1": true };

/** The dials The Hunt for the Dreadnaught's cards hold now: none in any other scenario. */
export function huntDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const ship = Object.values(game.cards).find((card) => card.code === DREADNAUGHT && (card.zone === "staging" || card.zone === "engaged"));
  if (ship) {
    const hitPoints = modifiedStat(game, ship, "hitPoints", ctx.cards);
    const damaged = ship.face === "B";
    const flips = !damaged && hitPoints > 0 && (hitPoints - ship.damage) * 2 < hitPoints;
    dials.push({
      id: "dreadnaught",
      testID: "hunt-dreadnaught",
      label: "HP",
      name: `${nameOf(DREADNAUGHT)}'s hit points left`,
      value: Math.max(0, hitPoints - ship.damage),
      limit: hitPoints,
      filled: Math.min(hitPoints, ship.damage),
      goal: true,
      cardId: ship.id,
      ...(flips ? { warn: { level: "near" as const, words: dreadnaughtFlipWords() } } : {}),
      limitWords: dreadnaughtLimitWords(hitPoints),
      note: dreadnaughtWords(ship.damage, hitPoints, game.seatCount, damaged),
    });
  }
  // The Quest Action comes before the cap dials: the bar reads HP, Action, then the two limits.
  const mode = Object.values(game.cards).find((card) => card.zone === "modeCard");
  const action = mode ? Object.keys(QUEST_ACTIONS).find((id) => id.startsWith(mode.code)) : undefined;
  if (mode && action) {
    const used = game.uses.some((use) => use.effectId === action);
    dials.push({ id: "action", testID: "hunt-action", label: "Action", name: "Quest Action of the mode card:", value: used ? 0 : 1, word: used ? "Used" : "Ready", cardId: mode.id, note: questActionWords(used, QUEST_ACTIONS[action] === true) });
  }
  if (ship) {
    const cap = heldAmount(game, ship.id, "damageCap");
    if (cap > 0) {
      const taken = game.roundDamage?.[ship.id] ?? 0;
      dials.push({
        id: "damage",
        testID: "hunt-damage",
        label: "Damage",
        name: `Damage ${nameOf(DREADNAUGHT)} took this round:`,
        value: taken,
        limit: cap,
        ...(taken >= cap ? { warn: { level: "near" as const, words: roundDamageReachedWords() } } : {}),
        limitWords: roundDamageLimitWords(cap),
        note: roundDamageWords(taken, cap),
      });
    }
  }
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const tally = stage && STAGES.includes(stage.code) ? questCapTally(game) : null;
  if (tally) {
    dials.push({
      id: "cap",
      testID: "hunt-cap",
      label: "Cap",
      name: "Progress placed on the quest stage this round:",
      value: tally.placed,
      limit: tally.limit,
      ...(tally.placed >= tally.limit ? { warn: { level: "near" as const, words: stageCapReachedWords() } } : {}),
      limitWords: stageCapLimitWords(tally.limit),
      note: stageCapWords(tally.placed, tally.limit),
    });
  }
  return dials;
}
