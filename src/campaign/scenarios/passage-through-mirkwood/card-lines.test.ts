// Rules: rr.shadow-effects, ltp.undefended-attack, rr.exhausted, rr.forced, rr.engaged, rr.explored, rr.attachment-cards, rr.in-play-and-out-of-play (data/rules/entries.json).
// Lines: 900102:A:2, 900103:A:2, 900104:A:1, 900104:A:2, 900105:A:2, 900108:A:2, 900108:A:3. The Passage Through Mirkwood Nightmare cards whose lines no test named, each read from its printed line on a table
// built from data/ (test/harness/layout.ts, tableFromLayout): the rows run again without the records of their line (test/harness/card-spec.ts, cardSpecs), and the test that needs an exhausted hero does so with withoutLine.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and every seat starts at threat 28; f3 is an enemy with Attack 1.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { answer, attack, cardSpecs, damageOn, deckCount, exhausted, quest, rowProblems, threat, withoutLine, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { fightEnemy, finish, idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "passage-through-mirkwood";
const SPAWN = "900102";
const BROOD = "900103";
const FLIES = "900104";
const SPIDERS = "900105";
const CAMP = "900108";
const HUMMERHORNS = "01075"; // a Creature Insect enemy

const ROWS: readonly Row[] = [
  // "Shadow: Raise defending player's threat by 5. (Raise defending player's threat by 10 instead if undefended.)"
  { line: "900102:A:2", name: "Shadow: a defended attack raises the defending player's threat by 5", layout: {}, act: attack("f3", { shadow: SPAWN }), expect: threat(33) },
  { line: "900102:A:2", name: "an undefended attack raises it by 10 instead, not by 15", layout: {}, act: attack("f3", { shadow: SPAWN, undefended: true }), expect: threat(38) },

  // "Shadow: If attacking enemy is an Insect, deal it 2 additional Shadow cards." The deck holds the shadow card and three more: an Insect takes two of them.
  { line: "900104:A:2", name: "Shadow: an Insect attacker is dealt 2 additional shadow cards", layout: {}, act: attack(HUMMERHORNS, { shadow: FLIES }), expect: deckCount(1) },
  { line: "900104:A:2", name: "and the additional shadow cards resolve: Ungoliant's Spawn dealt after it raises the defending player's threat by 5", layout: { deck: [SPAWN, "f0", "f0"] }, act: attack(HUMMERHORNS, { shadow: FLIES }), expect: threat(33) },

  // "Shadow: Choose and exhaust 1 character you control. If this attack was undefended, also deal that character 2 damage." The second hero is chosen, so the 2 damage must land on it and not on the hero the attack hit.
  { line: "900105:A:2", name: "Shadow: the defending player exhausts the character chosen, and a defended attack deals it no damage", layout: { play: ["ally"] }, act: [attack("f3", { shadow: SPIDERS }), answer("ally")], expect: [exhausted("ally"), damageOn("ally", 0), exhausted("dh2", false)] },
  { line: "900105:A:2", name: "an undefended attack also deals that character 2 damage", layout: { play: ["ally"] }, act: [attack("f3", { shadow: SPIDERS, undefended: true }), answer("dh2")], expect: [exhausted("dh2"), damageOn("dh2", 2), damageOn("dh1", 1), exhausted("ally", false)] },

  // "Forced: After Abandoned Camp leaves play, each player must deal 2 damage to each exhausted character he controls." The quest exhausts the two committed heroes of seat 0 and its progress explores the camp (2 quest points).
  { line: "900108:A:2", name: "Forced: after it leaves play, explored, each exhausted character of each player takes 2 damage, and a ready one none", layout: { seats: 2, active: CAMP }, act: quest("success"), expect: [zone(CAMP, "encounterDiscard"), damageOn("dh1", 2), damageOn("dh2", 2), damageOn("dh3", 0)] },

  // "Shadow: If this attack is undefended, discard all attachment cards players control."
  { line: "900108:A:3", name: "Shadow: an undefended attack discards the attachments players control", layout: { attached: [{ code: "attachment", to: "dh2" }] }, act: attack("f3", { shadow: CAMP, undefended: true }), expect: zone("attachment", "discard") },
];

cardSpecs(ID, ROWS);

// The false case of a condition holds with the records and without them alike, so it is a test of its own and not a row.
const holds = (row: Omit<Row, "line">, line: string) => expect(rowProblems(ID, { ...row, line }, EFFECTS)).toEqual([]);

describe("the false case of each condition", () => {
  it("900104:A:2 an attacker that is not an Insect is dealt no additional shadow card", () => {
    holds({ layout: {}, act: attack("f3", { shadow: FLIES }), expect: deckCount(3) }, "900104:A:2");
  });
  it("900108:A:3 a defended attack discards no attachment", () => {
    holds({ layout: { attached: [{ code: "attachment", to: "dh2" }] }, act: attack("f3", { shadow: CAMP }), expect: zone("attachment", "play") }, "900108:A:3");
  });
});

// "Shadow: Choose and exhaust 1 character you control. If this attack was undefended, also deal that character 2 damage." Reading (agent recommendation, docs/scenarios/nightmare.md): with every character already exhausted the player still
// chooses one; it is not exhausted again, and the undefended attack deals it the 2 damage (rr.effects, rr.exhausted).
describe("Spiders of Mirkwood's Shadow with every character exhausted", () => {
  const fought = (effects: readonly Effect[]) => {
    const build = (made: Layout) => {
      const t = tableFromLayout(ID, made, { effects });
      let state = t.state;
      for (const id of [t.hero, t.hero2]) state = updateCard(state, id, { exhausted: true });
      return { ...t, state };
    };
    return fightEnemy(build, SPIDERS, "f3", {}, { undefended: true });
  };
  // Read while the attack is still in progress (`during`): the refresh phase after it readies everything.
  const damageOf = (done: ReturnType<typeof fought>) => [done.made.hero, done.made.hero2].reduce((sum, id) => sum + (done.during.cards[id]?.damage ?? 0), 0);

  it("900105:A:2 an exhausted character is a legal choice: it stays exhausted and takes 2 damage on top of the attack's 1", () => {
    const done = fought(EFFECTS);
    expect([done.made.hero, done.made.hero2].map((id) => done.during.cards[id]?.exhausted)).toEqual([true, true]);
    expect(damageOf(done)).toBe(1 + 2);
    expect(damageOf(fought(withoutLine(EFFECTS, "900105:A:2")))).toBe(1);
  });
});

// "Shadow: If this attack is undefended, exhaust all characters you control." The closing pass of the combat phase goes on to the refresh phase, which readies every card: the attack is read while it is still in
// progress (`during`).
describe("Ungoliant's Brood's Shadow", () => {
  const during = (layout: Row["layout"], undefended: boolean, effects: readonly Effect[] = EFFECTS) => play(ID, { line: "900103:A:2", layout, act: attack("f3", { shadow: BROOD, undefended }), expect: [] }, effects, false).during!;
  const tired = (state: ReturnType<typeof during>, codes: readonly string[]) => codes.map((code) => state.cards[idOf(state, code)]?.exhausted);
  it("900103:A:2 an undefended attack exhausts every character the defending player controls, allies too, and none of another player's", () => {
    expect(tired(during({ seats: 2, play: ["ally"] }, true), ["dh1", "dh2", "ally", "dh3"])).toEqual([true, true, true, false]);
    expect(tired(during({ seats: 2, play: ["ally"] }, true, withoutLine(EFFECTS, "900103:A:2")), ["dh2", "ally"])).toEqual([false, false]);
  });
  it("900103:A:2 a defended attack exhausts nobody but the defender", () => {
    expect(tired(during({ play: ["ally"] }, false), ["dh1", "dh2", "ally"])).toEqual([true, false, false]);
  });
});

// "Forced: After you engage Forest Flies, deal 1 damage to each exhausted character you control." The engaged player's first hero and ally are exhausted, the second hero is ready, and the other player's hero is exhausted.
function engageFlies(effects: readonly Effect[]) {
  const t = tableFromLayout(ID, { seats: 2, engaged: [{ code: FLIES, seat: 0 }], play: ["ally"] }, { effects });
  let state = t.state;
  for (const id of [t.hero, idOf(state, "ally"), t.seat1Hero ?? ""]) state = updateCard(state, id, { exhausted: true });
  const steps: EngineStep[] = [];
  const fired = fireForced({ ...state, window: null }, { trigger: "engaged", seat: 0, cardId: idOf(state, FLIES) }, t.ctx, steps);
  return finish({ state: settle(fired, t.ctx, steps), steps }, t.ctx).state;
}

describe("Forest Flies engaged", () => {
  it("900104:A:1 deals 1 damage to each exhausted character the engaged player controls, and none to a ready one or to another player's", () => {
    const state = engageFlies(EFFECTS);
    const damage = (code: string) => state.cards[idOf(state, code)]?.damage;
    expect([damage("dh1"), damage("ally"), damage("dh2"), damage("dh3")]).toEqual([1, 1, 0, 0]);
    const without = engageFlies(withoutLine(EFFECTS, "900104:A:1"));
    expect(without.cards[idOf(without, "dh1")]?.damage).toBe(0);
  });
});

// Two-handed, the threat raised is the defending player's and not the other player's (read while the attack is in progress, before the refresh phase raises each threat).
describe("Ungoliant's Spawn's Shadow two-handed", () => {
  it("900102:A:2 raises only the defending player's threat", () => {
    const threats = (effects: readonly Effect[]) => play(ID, { line: "900102:A:2", layout: { seats: 2 }, act: attack("f3", { shadow: SPAWN }), expect: [] }, effects, false).during!.seats.map((seat) => seat.threat);
    expect(threats(EFFECTS)).toEqual([33, 28]);
    expect(threats(withoutLine(EFFECTS, "900102:A:2"))).toEqual([28, 28]);
  });
});
