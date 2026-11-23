// Rules: hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, rr.forced, rr.reveal, rr.shadow-effects, rr.attacks-outside-the-combat-phase, rr.then (data/rules/entries.json). The enemies of Flies and Spiders (132028 to 132032), each test from the printed line (data/printed/the-hobbit.json) on a table
// built from data/ by the layout kit, and run again without the records of its line (`lineSpec`). Venom (132028:A:1, 132029:A:1, 132030:A:1, 132031:A:1, 132032:A:1) is tried on an attack fought out to its damage.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import { givePoison, makeUnconscious, poisonOf } from "../../../rules/families/poison/poison.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { fightEnemy, idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { atDefense, fire, placeIn, revealTo, spiderTable, splitTable } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

const on = (effects: readonly Effect[], layout: Parameters<typeof spiderTable>[0] = {}) => spiderTable(layout, { effects });
const total = (state: ScenarioState) => state.seats.reduce((sum, seat) => sum + seat.heroes.reduce((inner, id) => inner + poisonOf(state, id), 0), 0);
// An attack of `enemy` on the first player, fought out with a filler Shadow card that does nothing; the first stand-in hero (defense 2, 6 hit points) defends, or nobody does.
const fight = (effects: readonly Effect[], enemy: string, options: { undefended?: boolean; damage?: number } = {}) =>
  fightEnemy((layout) => on(effects, layout), "f0", enemy, { seats: 1 as const }, { undefended: options.undefended, tweak: options.damage ? (state, made) => updateCard(state, made.hero, { damage: options.damage }) : undefined });
const endOfRound = { trigger: "endOfRound", seat: null } as GameEvent;

// ---- Venom ----
// Attack, defense: 132028 5/2, 132029 3/2, 132030 3/2, 132031 1/1 (+3 with a poisoned character), 132032 4/1 (its Forced effect poisons 1 more at the attack).
const venomCheck = (enemy: string, damage: number, poison: number) => (effects: readonly Effect[]) => {
  const out = fight(effects, enemy);
  expect(out.run.state.cards[out.made.hero]?.damage, "the attack dealt its damage").toBe(damage);
  expect(poisonOf(out.run.state, out.made.hero), "1 poison for that damage").toBe(poison);
  expect(poisonOf(out.run.state, out.made.hero2), "another character gets none").toBe(0);
};
const VENOM_TITLE = "Venom: the damage the enemy deals to a defending character gives it 1 poison, once, whatever the damage";
lineSpec("132028:A:1", VENOM_TITLE, venomCheck("132028", 3, 1));
lineSpec("132029:A:1", VENOM_TITLE, venomCheck("132029", 1, 1));
lineSpec("132030:A:1", VENOM_TITLE, venomCheck("132030", 1, 1));
// Wicked Spider's own Forced effect (132032:A:2) gives 1 more poison at the attack: 2 in all.
lineSpec("132032:A:1", VENOM_TITLE, venomCheck("132032", 2, 2));
lineSpec("132031:A:1", "Venom: a defended attack with no damage gives no poison, an undefended one with damage does", (effects) => {
  const defended = fight(effects, "132031");
  expect(defended.run.state.cards[defended.made.hero]?.damage, "1 Attack against 2 Defense").toBe(0);
  expect(poisonOf(defended.run.state, defended.made.hero), "no damage, no poison").toBe(0);
  const bare = fight(effects, "132031", { undefended: true });
  expect(bare.run.state.cards[bare.made.hero]?.damage).toBe(1);
  expect(poisonOf(bare.run.state, bare.made.hero), "1 damage, 1 poison").toBe(1);
});
lineSpec("132028:A:1", "Venom: a character the damage destroys gets no poison (docs/scenarios/the-hobbit/flies-and-spiders.md, Flies and Spiders)", (effects) => {
  const out = fight(effects, "132028", { undefended: true, damage: 2 });
  expect(out.run.state.cards[out.made.hero]?.zone, "5 damage on 2 damage of 6 hit points destroys it").not.toBe("heroes");
  expect(total(out.run.state)).toBe(0);
  const hurt = fight(effects, "132028", { undefended: true, damage: 0 });
  expect(poisonOf(hurt.run.state, hurt.made.hero), "5 damage of 6 hit points leaves it poisoned").toBe(1);
});

// ---- 132028 Old Tomnoddy ----
lineSpec("132028:A:2", "at the end of each round each player gives a hero he controls 1 poison: one player, one hero; an ally is not given any", (effects) => {
  const t = on(effects, { seats: 1, engaged: [{ code: "132028", seat: 0 }], play: [{ code: "ally", seat: 0 }] });
  const out = fire(t.ctx, t.state, endOfRound);
  expect(total(out), "1 poison to a hero").toBe(1);
  expect(poisonOf(out, idOf(out, "ally")), "an ally is no hero").toBe(0);
});
lineSpec("132028:A:2", "with 2 players each gives 1 poison to a hero he controls, never to an unconscious hero, and nothing when none can take it", (effects) => {
  const t = on(effects, { seats: 2, engaged: [{ code: "132028", seat: 0 }] });
  const both = fire(t.ctx, t.state, endOfRound);
  expect(poisonOf(both, t.seat1Hero ?? ""), "the other player's hero").toBe(1);
  expect(poisonOf(both, t.hero) + poisonOf(both, t.hero2), "the first player's heroes").toBe(1);
  const one = makeUnconscious(t.state, t.hero, t.ctx);
  const out = fire(t.ctx, one, endOfRound);
  expect(poisonOf(out, t.hero), "an unconscious hero cannot take it").toBe(0);
  expect(poisonOf(out, t.hero2), "the other hero takes it").toBe(1);
  const all = makeUnconscious(one, t.hero2, t.ctx);
  expect(poisonOf(fire(t.ctx, all, endOfRound), t.seat1Hero ?? ""), "the second player's still does").toBe(1);
  expect(total(fire(t.ctx, all, endOfRound)), "none of the first player's heroes can").toBe(1);
});
lineSpec("132028:A:2", "once the players are split only the players of the area Old Tomnoddy lies in are given poison", (effects) => {
  const { t, state } = splitTable(effects);
  const out = fire(t.ctx, placeIn(state, "132028", 1).state, endOfRound);
  expect(poisonOf(out, t.seat1Hero ?? ""), "the area of Old Tomnoddy").toBe(1);
  expect(out.seats[0]?.heroes.reduce((sum, id) => sum + poisonOf(out, id), 0), "the first player's area").toBe(0);
});

// ---- 132029 Crazy Cob ----
const cob = (effects: readonly Effect[], poison: readonly [number, number], seats: 1 | 2 = 2) => {
  const t = on(effects, { seats });
  const state = givePoison(givePoison(t.state, t.hero, poison[0], t.ctx), t.seat1Hero, poison[1], t.ctx);
  const run = resolveRecords(state, t.ctx, "132029", "whenRevealed");
  return { t, run, state: run.state };
};
lineSpec("132029:A:2", "when revealed it attacks the character with the most poison: the player who controls it defends, and the enemy attacks from the staging area", (effects) => {
  const out = cob(effects, [1, 3]);
  expect(out.state.window).toMatchObject({ kind: "defense", seat: 1 });
  expect(out.state.pendingAttack).toMatchObject({ seat: 1, fromStaging: true });
  expect(out.state.cards[out.run.id]?.zone, "it stays in the staging area").toBe("staging");
  const other = cob(effects, [4, 2]);
  expect(other.state.window, "the first player has the most poison").toMatchObject({ kind: "defense", seat: 0 });
});
lineSpec("132029:A:2", "with the poison tied, or none anywhere, the first player chooses the character it attacks", (effects) => {
  for (const poison of [[2, 2], [0, 0]] as const) {
    const out = cob(effects, poison);
    expect(out.state.window, `poison ${poison.join(" and ")}`).toMatchObject({ kind: "defense" });
    expect(out.state.pendingAttack?.fromStaging).toBe(true);
  }
  expect(cob(effects, [0, 0], 1).state.window, "alone it attacks the one player").toMatchObject({ kind: "defense", seat: 0 });
});
lineSpec("132029:A:3", "Shadow: the defending character gets 1 poison", (effects) => {
  const out = fightEnemy((layout) => on(effects, layout), "132029", "f0", { seats: 1 as const });
  expect(poisonOf(out.run.state, out.made.hero), "the defender").toBe(1);
  expect(poisonOf(out.run.state, out.made.hero2), "another character").toBe(0);
});

// ---- 132030 Lazy Lob ----
lineSpec("132030:A:2", "when revealed each character committed to the quest gets 1 poison, an ally too, and a character not committed gets none", (effects) => {
  const t = on(effects, { seats: 1, play: [{ code: "ally", seat: 0 }], committed: ["dh1", "ally"] });
  const out = resolveRecords(t.state, t.ctx, "132030", "whenRevealed").state;
  expect(poisonOf(out, t.hero), "a committed hero").toBe(1);
  expect(poisonOf(out, idOf(out, "ally")), "a committed ally").toBe(1);
  expect(poisonOf(out, t.hero2), "a hero not committed").toBe(0);
});
lineSpec("132030:A:2", "with 2 players the committed characters of both get poison, and none when nothing is committed", (effects) => {
  const t = on(effects, { seats: 2, committed: ["dh1", "dh3"] });
  const out = resolveRecords(t.state, t.ctx, "132030", "whenRevealed").state;
  expect([poisonOf(out, t.hero), poisonOf(out, t.seat1Hero ?? "")]).toEqual([1, 1]);
  expect(total(resolveRecords(on(effects, { seats: 2 }).state, t.ctx, "132030", "whenRevealed").state)).toBe(0);
});
lineSpec("132030:A:2", "once the players are split only the committed characters of the players of the area it is revealed to get poison", (effects) => {
  const { t, state: made } = splitTable(effects);
  const committed = [...(made.seats[0]?.heroes ?? []), ...(made.seats[1]?.heroes ?? [])].reduce((acc, hero) => updateCard(acc, hero, { committed: true }), made);
  const out = revealTo(t.ctx, committed, "132030", 1);
  expect(out.seats[0]?.heroes.map((hero) => poisonOf(out, hero)), "the first player's area").toEqual([0, 0]);
  expect(poisonOf(out, t.seat1Hero ?? ""), "the area of the card").toBe(1);
});
lineSpec("132030:A:3", "Shadow: a poisoned defending character is made unconscious, a clean one is not, and an undefended attack has no defending character", (effects) => {
  const poisoned = fightEnemy((layout) => on(effects, layout), "132030", "f0", { seats: 1 as const }, { tweak: (state, made) => syncConstants(givePoison(state, made.hero, 1, made.ctx), made.ctx) });
  expect(poisoned.run.state.cards[poisoned.made.hero]?.unconscious, "poisoned").toBe(true);
  const clean = fightEnemy((layout) => on(effects, layout), "132030", "f0", { seats: 1 as const });
  expect(clean.run.state.cards[clean.made.hero]?.unconscious, "not poisoned").toBeUndefined();
  expect(clean.run.state.cards[clean.made.hero]?.zone).toBe("heroes");
  const bare = fightEnemy((layout) => on(effects, layout), "132030", "f0", { seats: 1 as const }, { undefended: true, tweak: (state, made) => syncConstants(givePoison(state, made.hero, 1, made.ctx), made.ctx) });
  expect(bare.run.state.cards[bare.made.hero]?.unconscious, "undefended").toBeUndefined();
  expect(poisoned.run.state.cards[poisoned.made.hero]?.exhausted, "the Shadow ran on a table that can tell").toBe(true);
});

// ---- 132031 Fat Spider ----
lineSpec("132031:A:2", "it gets +3 Attack while engaged with a player who controls a poisoned character, not while staging or when only another player has one", (effects) => {
  const t = on(effects, { seats: 2, engaged: [{ code: "132031", seat: 0 }], staging: ["132031"] });
  const spiders = Object.values(t.state.cards).filter((card) => card.code === "132031");
  const engaged = spiders.find((card) => card.zone === "engaged")?.id;
  const staged = spiders.find((card) => card.zone === "staging")?.id;
  const attack = (state: ScenarioState, id: string) => modifiedStat(state, state.cards[id]!, "attack", t.ctx.cards);
  const base = attack(t.state, engaged ?? "");
  const sick = syncConstants(givePoison(t.state, t.hero, 1, t.ctx), t.ctx);
  expect(attack(sick, engaged ?? ""), "engaged with the poisoned character's player").toBe(base + 3);
  expect(attack(sick, staged ?? ""), "not engaged").toBe(base);
  const other = syncConstants(givePoison(t.state, t.seat1Hero, 1, t.ctx), t.ctx);
  expect(attack(other, engaged ?? ""), "the poisoned character is the other player's").toBe(base);
});
lineSpec("132031:A:3", "Shadow: the defending character gets 1 poison; an undefended attack gives 2 poison to one character the defending player controls", (effects) => {
  const defended = fightEnemy((layout) => on(effects, layout), "132031", "f0", { seats: 1 as const });
  expect(poisonOf(defended.run.state, defended.made.hero)).toBe(1);
  expect(total(defended.run.state), "no more than 1").toBe(1);
  const bare = fightEnemy((layout) => on(effects, layout), "132031", "f0", { seats: 1 as const }, { undefended: true });
  expect(total(bare.run.state), "2 poison").toBe(2);
  expect([bare.made.hero, bare.made.hero2].some((id) => poisonOf(bare.run.state, id) === 2), "all on one character").toBe(true);
});

// ---- 132032 Wicked Spider ----
lineSpec("132032:A:2", "when it attacks the defending player attaches 1 poison to a character he controls before he declares a defender", (effects) => {
  const one = atDefense(on(effects, { phase: "Encounter", seats: 1, engaged: [{ code: "132032", seat: 0 }], deck: ["f0", "f0"] }));
  expect(total(one), "1 poison when the defense window opens").toBe(1);
  const two = on(effects, { phase: "Encounter", seats: 2, engaged: [{ code: "132032", seat: 0 }], deck: ["f0", "f0"] });
  const open = atDefense(two);
  expect(total(open), "only the defending player's character").toBe(1);
  expect(poisonOf(open, two.seat1Hero ?? ""), "the second player is not defending").toBe(0);
});
lineSpec("132032:A:3", "Shadow: the defending character gets 2 poison", (effects) => {
  const out = fightEnemy((layout) => on(effects, layout), "132032", "f0", { seats: 1 as const });
  expect(poisonOf(out.run.state, out.made.hero)).toBe(2);
  expect(total(out.run.state)).toBe(2);
});
