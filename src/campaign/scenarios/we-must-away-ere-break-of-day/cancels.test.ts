// Rules: rr.cancel, rr.shadow-effects, rr.resources, hob.baggins-sphere-ohauh, hob.sack-x (data/rules/entries.json); docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md (We Must Away, Ere Break of Day, Troll Camp and the Baggins cost).
import { expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";

import { answer, attack, cardSpecs, count, damageOn, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, legalIntents, send, start as begin, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import type { PlayerIntent } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

// The two Shadow effects the first player may cancel by spending Baggins resources (131051:A:2 for 1, 131054:A:2 for 2). The stand-in heroes hold resources of their own that cannot pay (they are not of the Baggins sphere): only Bilbo Baggins' pool can, and the
// first player pays. A Troll (William, 131032) attacks the first hero's seat with the shadow card dealt to it.
const ID = "we-must-away-ere-break-of-day";
const SACKED = { sagaHero: { resources: 2 }, piles: { sackDeck: ["131045"] } } as const;

const ROWS: readonly Row[] = [
  { line: "131051:A:2", name: "Shadow: if the attacking enemy is a Troll, Sack 1", layout: { ...SACKED, engaged: ["131032"] }, act: [attack("131032", { shadow: "131051", undefended: true }), answer("dh1")], expect: [count("131045", "attached", 1)] },
  { line: "131054:A:2", name: "Shadow: 4 damage to each character with a Sack card attached", layout: { ...SACKED, engaged: ["131032"], attached: [{ code: "131045", to: "dh2", encounter: true }] }, act: attack("131032", { shadow: "131054", undefended: true }), expect: [damageOn("dh2", 4)] },
];

cardSpecs(ID, ROWS);

// The attack of William on the first seat with `shadow` dealt to it, as test/harness/scene-kit.ts fightEnemy plays it, stopped at the cancel offer of the Shadow effect: `payer` pays it from his pool (Bilbo's pool, or a stand-in hero's, which holds resources too).
function shadowCancelled(effects: readonly Effect[], shadow: string, payer: "bilbo" | "hero", layout: Layout): ScenarioState {
  const table = tableFromLayout(ID, { phase: "Encounter", engaged: [{ code: "131032", seat: 0 }], deck: [shadow, "f0", "f0", "f0"], heroResources: 3, ...layout }, { effects });
  let run = send(begin(table.state), { type: "DeclineEngage" }, table.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    const pass = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, table.ctx);
  }
  run = send(run, { type: "Undefended", heroId: idOf(run.state, "dh1") }, table.ctx);
  for (let guard = 0; guard < 20 && run.state.window?.kind !== "cancelOffer"; guard += 1) {
    const pass = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, table.ctx);
  }
  const offer = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Trigger");
  if (run.state.window?.kind !== "cancelOffer" || !offer || offer.type !== "Trigger") return run.state;
  const holder = idOf(run.state, payer === "bilbo" ? "131001" : "dh1");
  return send(run, { ...offer, payments: [{ heroId: holder, amount: amountOf(shadow) }] } as PlayerIntent, table.ctx).state;
}
const amountOf = (shadow: string): number => (shadow === "131051" ? 1 : 2);

const bilbo = (state: ScenarioState): number => state.cards[idOf(state, "131001")]?.resources ?? 0;
const heroes = (state: ScenarioState): number => state.cards[idOf(state, "dh1")]?.resources ?? 0;

lineSpec("131051:A:2", "the first player cancels it by spending 1 Baggins resource from Bilbo's pool", (effects) => {
  const state = shadowCancelled(effects, "131051", "bilbo", SACKED);
  expect(state.cards[idOf(state, "131045")]?.zone).toBe("sackDeck");
  expect(bilbo(state)).toBe(1);
  expect(heroes(state)).toBe(3);
});
lineSpec("131054:A:2", "the first player cancels it by spending 2 Baggins resources from Bilbo's pool", (effects) => {
  const state = shadowCancelled(effects, "131054", "bilbo", { ...SACKED, attached: [{ code: "131045", to: "dh2", encounter: true }] });
  expect(state.cards[idOf(state, "dh2")]?.damage).toBe(0);
  expect(bilbo(state)).toBe(0);
  expect(heroes(state)).toBe(3);
});
it("131051:A:2 a hero of another sphere cannot pay the Baggins resource", () => {
  expect(() => shadowCancelled(EFFECTS, "131051", "hero", SACKED)).toThrow(/refused/i);
});

