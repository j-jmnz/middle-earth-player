// Rules: rr.forced, rr.response, rr.timing-of-ability-resolution, rr.attachment-cards, rr.travel, rr.objective-cards, rr.discard-pile-and-victory-display, hob.bilbo-baggins-ohauh, hob.baggins-sphere-ohauh (data/rules/entries.json); docs/scenarios/the-hobbit.md (We Must Away, Ere Break of Day, Troll Key and Troll Purse, Troll Cave, Troll Camp).
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { Act } from "../../../../test/harness/card-spec.ts";
import { announce, offers } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { finish, idOf, legalIntents, send, type Layout } from "../../../../test/harness/scene-kit.ts";
import type { PlayerIntent } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

// The claims of the Troll Key (131043) and the Troll Purse (131042), Troll Camp's Action (131036:A:2) and Troll Cave's travel cost (131037:A:2), all of which need Bilbo Baggins (`sagaHero`), whom the loadout deals. William (131032, 12 hit points) is the host.
const ID = "we-must-away-ere-break-of-day";
const BILBO = "131001";
const DEAD_WILLIAM = { code: "131032", damage: 12 } as const;
// The Purse is attached to William, who has 12 damage on him and is destroyed as the game goes on; the other Troll is in the staging area.
const PURSE_ON_WILLIAM: Layout = { sagaHero: { resources: 1 }, engaged: [DEAD_WILLIAM], staging: ["131033"], attached: [{ code: "131042", to: "131032", encounter: true }] };
const ATTACH_PURSE: readonly Act[] = [];

// The state after `acts` on `layout`, on these records (the run without a line's records answers nothing it is not asked: `lenient`).
const after = (effects: readonly Effect[], line: string, layout: Layout, act: readonly Act[]): ScenarioState => play(ID, { line, layout, act, expect: [] }, effects, true).run.state;
// The first player's Trigger of a card's Response, paid from Bilbo's pool (a Response with a resource cost is paid by the intent): the state after it resolves, or the state as it was when the Response is not offered.
function claim(effects: readonly Effect[], line: string, layout: Layout, act: readonly Act[], code: string, amount: number): ScenarioState {
  const done = play(ID, { line, layout, act, expect: [] }, effects, true);
  const intent = legalIntents(done.run.state, done.table.ctx).find((offered) => offered.type === "Trigger" && offered.cardId === idOf(done.run.state, code));
  if (!intent) return done.run.state;
  const payments = amount > 0 ? [{ heroId: idOf(done.run.state, BILBO), amount }] : [];
  return finish(send(done.run, { ...intent, payments } as PlayerIntent, done.table.ctx), done.table.ctx).state;
}
const hostOf = (state: ScenarioState, code: string): string | null => state.cards[idOf(state, code)]?.host ?? null;
const codeAt = (state: ScenarioState, id: string | null): string | undefined => (id ? state.cards[id]?.code : undefined);

// 131042:A:2 "Response: After attached Troll enemy is destroyed, the first player may spend 1 Baggins resource to claim this objective and attach it to Bilbo Baggins."
// The Response is offered as the Troll is destroyed, before the Purse returns to the staging area and attaches to the other Troll (131042:A:1), and only the first player pays.
lineSpec("131042:A:2", "the first player's claim is offered as the host Troll is destroyed, before the Purse returns to the staging area", (effects) => {
  const claimed = claim(effects, "131042:A:2", PURSE_ON_WILLIAM, [...ATTACH_PURSE, announce("endOfRound")], "131042", 1);
  expect(codeAt(claimed, hostOf(claimed, "131042"))).toBe(BILBO);
  expect(claimed.cards[idOf(claimed, BILBO)]?.resources).toBe(0);
  expect(claimed.cards[idOf(claimed, "131042")]?.claimed).toBe(true);
});
lineSpec("131042:A:1", "when the host Troll is destroyed and the Purse is not claimed it returns to the staging area and attaches to the other Troll", (effects) => {
  const layout: Layout = { sagaHero: { resources: 1 }, engaged: [DEAD_WILLIAM], staging: ["131033"], attached: [{ code: "131042", to: "131032" }] };
  const declined = after(effects, "131042:A:2", layout, [announce("endOfRound")]);
  // The Response is open on the first player: passing it lets the Forced return run.
  expect(codeAt(declined, hostOf(declined, "131042"))).toBe("131033");
  expect(declined.cards[idOf(declined, BILBO)]?.resources).toBe(1);
});
lineSpec("131042:A:2", "only the first player may pay: the second player is not offered it", (effects) => {
  const run = play(ID, { line: "131042:A:2", layout: { ...PURSE_ON_WILLIAM, seats: 2 }, act: [...ATTACH_PURSE, announce("endOfRound")], expect: [offers("Trigger", "131042")] }, effects, true);
  const seats = new Set(((run.run.state.stack.at(-1)?.data as { offers?: { seat: number }[] } | undefined)?.offers ?? []).map((offer) => offer.seat));
  expect([...seats]).toEqual([0]);
});


// 131043:A:2 "Response: After attached Troll enemy takes damage as the result of an attack, the first player may exhaust Bilbo Baggins to claim this objective and attach it to him."
// A player's attack on William, engaged with the first player: the combat phase is passed to the attack, both heroes attack (4 against its Defense 2), and the Key's claim is offered once the damage is dealt.
function keyAfterAttack(effects: readonly Effect[], answerWith: "claim" | "pass", extra: Partial<Layout> = {}): ScenarioState {
  const layout: Layout = { phase: "Combat", sagaHero: { resources: 0 }, engaged: ["131032"], attached: [{ code: "131043", to: "131032", encounter: true }], ...extra };
  const done = play(ID, { line: "131043:A:2", layout, act: [], expect: [] }, effects, true);
  const ctx = done.table.ctx;
  let run = send(done.run, { type: "Pass" }, ctx);
  run = send(run, { type: "Undefended", heroId: idOf(run.state, "dh1") }, ctx);
  for (let guard = 0; guard < 8 && run.state.window?.kind !== "playerAttack"; guard += 1) {
    const pass = legalIntents(run.state, ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, ctx);
  }
  run = send(run, { type: "DeclareAttackers", enemyId: idOf(run.state, "131032"), attackerIds: [idOf(run.state, "dh1"), idOf(run.state, "dh2")] }, ctx);
  for (let guard = 0; guard < 12; guard += 1) {
    const key = idOf(run.state, "131043");
    const trigger = legalIntents(run.state, ctx).find((intent) => intent.type === "Trigger" && intent.cardId === key);
    if (trigger) return answerWith === "claim" ? finish(send(run, { ...trigger, payments: [] } as PlayerIntent, ctx), ctx).state : run.state;
    const pass = legalIntents(run.state, ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, ctx);
  }
  return run.state;
}
lineSpec("131043:A:2", "the first player's claim takes the Key from its engaged host Troll after an attack damaged it, exhausting Bilbo", (effects) => {
  const claimed = keyAfterAttack(effects, "claim");
  expect(codeAt(claimed, hostOf(claimed, "131043"))).toBe(BILBO);
  expect(claimed.cards[idOf(claimed, BILBO)]?.exhausted).toBe(true);
  expect(claimed.cards[idOf(claimed, "131043")]?.claimed).toBe(true);
});
