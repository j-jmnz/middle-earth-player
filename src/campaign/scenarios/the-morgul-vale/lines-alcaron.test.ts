// Rules: rr.forced, rr.shadow-effects, rr.step-6-4-2, rr.step-6-4-3, faq.additional-attacks (data/rules/entries.json); ledger lines 06152:A:1, 06152:A:2.
// Lord Alcaron's two Forced effects on real attacks of the combat phase: a token on To the Tower for each attack he begins, and an additional attack for each shadow card with no shadow effect he was dealt for the attack that ends. A blank card is a stand-in treachery (no shadow line); the other shadow cards are Morgul Bodyguards, whose
// Shadow does nothing with one player. The heroes can take four undefended attacks of 4 (the stand-ins have 6 hit points) without the game ending.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { dealAdditionalShadow } from "../../../rules/interpret/interpret.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";
import { CODES, fight, opened, table, tokens } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { tower, bodyguard, alcaron, betrayal } = CODES;
const BLANK = "treachery";
const STURDY = ["05002", "01001"];

/** Lord Alcaron, engaged with the only player, is dealt `blank` blank shadow cards for the attack of the combat phase; the deck holds `deck` after them. The run is played to the end of the combat phase. */
function alcaronAttacks(effects: readonly Effect[], blank: number, deck: readonly string[]) {
  const t = table({ seats: 1, phase: "Combat", stage: betrayal, staging: [tower], engaged: [alcaron], heroes: STURDY, deck: [...Array<string>(blank).fill(BLANK), ...deck, ...Array<string>(4).fill(bodyguard)] }, effects, STURDY);
  const id = idOf(t.state, alcaron);
  let dealt = t.state;
  for (let card = 0; card < blank; card += 1) dealt = dealAdditionalShadow(dealt, id, [], t.ctx);
  const done = fight(t, opened(t, dealt), (state) => state.phase !== "Combat" || state.lost);
  const attacks = (steps: readonly EngineStep[]) => steps.filter((step) => step.kind === "strike" && step.enemyId === id).length;
  return { done, attacks: attacks(done.steps), tokens: tokens(done.state) };
}

lineSpec("06152:A:1", "Forced: a token goes on To the Tower for each attack Lord Alcaron begins, an additional attack included, and for none he does not make", (effects) => {
  const one = alcaronAttacks(effects, 0, [bodyguard]);
  expect(one.attacks).toBe(1);
  expect(one.tokens).toBe(1);
  const two = alcaronAttacks(effects, 1, [bodyguard]);
  expect(two.attacks).toBe(2);
  expect(two.tokens).toBe(2);
});

lineSpec("06152:A:2", "Forced: a shadow card with no shadow effect gives one additional attack with a shadow card of its own; a shadow card with an effect gives none", (effects) => {
  expect(alcaronAttacks(effects, 0, [bodyguard]).attacks).toBe(1);
  expect(alcaronAttacks(effects, 1, [bodyguard]).attacks).toBe(2);
});

lineSpec("06152:A:2", "Forced: two blank shadow cards dealt for one attack give two additional attacks, each with a shadow card of its own, and the engine does not make a third", (effects) => {
  const two = alcaronAttacks(effects, 2, [bodyguard, bodyguard]);
  expect(two.attacks).toBe(3);
  expect(two.tokens).toBe(3);
  // The additional attacks were dealt the Bodyguards, not the two blank cards of the first attack, which are discarded.
  expect(two.done.state.encounterDiscard.filter((id) => two.done.state.cards[id]?.code === BLANK)).toHaveLength(2);
});

lineSpec("06152:A:2", "Forced: an additional attack whose own shadow card is blank is followed by another, with no cap, on top of the two the first attack gave", (effects) => {
  const chained = alcaronAttacks(effects, 2, [BLANK, bodyguard, bodyguard]);
  expect(chained.attacks).toBe(4);
  expect(chained.tokens).toBe(4);
  const single = alcaronAttacks(effects, 1, [BLANK, BLANK, bodyguard]);
  expect(single.attacks).toBe(4);
});
