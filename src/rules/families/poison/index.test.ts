// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json); ledger lines 132028:A:1, 132067:B:1. Poison and the unconscious state on tables of Flies and Spiders built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import { moveCard } from "../../core/zones.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { fightEnemy, idOf } from "../../../../test/harness/scene-kit.ts";
import { codeOf, run, spiderTable, STAGE_1 } from "../../../../test/scenarios/flies-and-spiders/scene.ts";
import { venomPoison } from "./venom.ts";
import { givePoison, makeUnconscious, poisonOf } from "./poison.ts";

describe("giving poison (hob.venom-poison)", () => {
  it("attaches the top card of the controller's deck facedown to the character, out of play, owned by the deck's seat", () => {
    const t = spiderTable({ seats: 2 });
    const hero = t.hero;
    const top = t.state.seats[0].deck[0] ?? "";
    const state = givePoison(t.state, hero, 1, t.ctx, []);
    expect(poisonOf(state, hero)).toBe(1);
    expect(state.cards[top]).toMatchObject({ zone: "under", host: hero, face: "down", poison: true, owner: 0, controller: null });
    expect(state.seats[0].deck).not.toContain(top);
    expect(state.seats[0].deck.length).toBe(t.state.seats[0].deck.length - 1);
  });

  it("takes the card from the deck of the player who controls the character, not of the first player", () => {
    const t = spiderTable({ seats: 2 });
    const other = t.seat1Hero ?? "";
    const state = givePoison(t.state, other, 2, t.ctx, []);
    expect(poisonOf(state, other)).toBe(2);
    expect(state.seats[1].deck.length).toBe(t.state.seats[1].deck.length - 2);
    expect(state.seats[0].deck.length).toBe(t.state.seats[0].deck.length);
  });

  it("gives none when the deck is empty", () => {
    const t = spiderTable({ seats: 1, deckOf: [] });
    expect(poisonOf(givePoison(t.state, t.hero, 1, t.ctx, []), t.hero)).toBe(0);
  });

  it("makes the character unconscious at once when its poison equals its printed hit points, and discards the poison to the deck's owner", () => {
    const t = spiderTable({ seats: 1 });
    const hitPoints = t.cards.get(t.state.cards[t.hero]?.code ?? "")?.health ?? 0;
    expect(hitPoints).toBeGreaterThan(1);
    const before = t.state.seats[0].discard.length;
    const almost = givePoison(t.state, t.hero, hitPoints - 1, t.ctx, []);
    expect(almost.cards[t.hero]?.unconscious).toBeUndefined();
    const out = givePoison(almost, t.hero, 1, t.ctx, []);
    expect(out.cards[t.hero]).toMatchObject({ unconscious: true, exhausted: true });
    expect(poisonOf(out, t.hero)).toBe(0);
    expect(out.seats[0].discard.length).toBe(before + hitPoints);
    for (const id of out.seats[0].discard) expect(out.cards[id]).toMatchObject({ zone: "discard", face: "up" });
  });

  it("gives no poison to an unconscious character", () => {
    const t = spiderTable({ seats: 1 });
    const out = makeUnconscious(t.state, t.hero, t.ctx);
    expect(poisonOf(givePoison(out, t.hero, 2, t.ctx, []), t.hero)).toBe(0);
  });
});

describe("the verbs that give and take poison", () => {
  it("GivePoison poisons the last picked character, or the defender", () => {
    const t = spiderTable({ seats: 1 });
    const state = run(t, t.state, { verb: "GivePoison", amount: 2, target: "self" }, 0, t.hero);
    expect(poisonOf(state, t.hero)).toBe(2);
  });

  it("DiscardPoison sends poison to the owner's discard pile: 1, or all", () => {
    const t = spiderTable({ seats: 1 });
    const poisoned = givePoison(t.state, t.hero, 3, t.ctx, []);
    const one = run(t, poisoned, { verb: "DiscardPoison", amount: 1, target: "self" }, 0, t.hero);
    expect(poisonOf(one, t.hero)).toBe(2);
    expect(one.seats[0].discard.length).toBe(1);
    const all = run(t, one, { verb: "DiscardPoison", all: true, target: "self" }, 0, t.hero);
    expect(poisonOf(all, t.hero)).toBe(0);
    expect(all.seats[0].discard.length).toBe(3);
  });

  it("a character that leaves play takes its poison to its owner's discard pile", () => {
    const t = spiderTable({ seats: 1 });
    const poisoned = givePoison(t.state, t.hero, 2, t.ctx, []);
    const gone = moveCard(poisoned, t.hero, { zone: "discard", seat: 0 });
    expect(gone.seats[0].discard.length).toBe(3);
    expect(Object.values(gone.cards).filter((card) => card.zone === "under")).toEqual([]);
  });
});

describe("the unconscious state (hob.unconscious-characters)", () => {
  it("MakeUnconscious rotates the character, leaves the quest and discards its poison", () => {
    const t = spiderTable({ seats: 1 });
    const committed = updateCard(givePoison(t.state, t.hero, 2, t.ctx, []), t.hero, { committed: true });
    const out = run(t, committed, { verb: "MakeUnconscious", target: "self" }, 0, t.hero);
    expect(out.cards[t.hero]).toMatchObject({ unconscious: true, exhausted: true, committed: false });
    expect(poisonOf(out, t.hero)).toBe(0);
  });

  it("ReadyUnconscious readies it again, and leaves a conscious character as it is", () => {
    const t = spiderTable({ seats: 1 });
    const out = run(t, t.state, { verb: "MakeUnconscious", target: "self" }, 0, t.hero);
    const ready = run(t, out, { verb: "ReadyUnconscious", target: "self" }, 0, t.hero);
    expect(ready.cards[t.hero]?.unconscious).toBeUndefined();
    expect(ready.cards[t.hero]?.exhausted).toBe(false);
    const exhausted = updateCard(ready, t.hero, { exhausted: true });
    expect(run(t, exhausted, { verb: "ReadyUnconscious", target: "self" }, 0, t.hero).cards[t.hero]?.exhausted).toBe(true);
  });

  it("the stage's constant record bars an unconscious character from every action it lists", () => {
    const t = spiderTable({ seats: 1 });
    expect(codeOf(t.state, t.state.questStage)).toBe(STAGE_1);
    const out = run(t, t.state, { verb: "MakeUnconscious", target: "self" }, 0, t.hero);
    const held = (stat: string) => out.modifiers.some((modifier) => modifier.instanceId === t.hero && modifier.stat === stat && modifier.amount > 0);
    for (const stat of ["cannotQuest", "cannotAttack", "cannotDefend", "noCollection", "cannotTriggerEffects", "cannotTriggerForced", "cannotBePoisoned", "cannotReady"]) expect(held(stat), stat).toBe(true);
    const other = out.modifiers.filter((modifier) => modifier.instanceId === t.hero2 && modifier.stat === "cannotQuest");
    expect(other).toEqual([]);
  });
});

describe("Venom (hob.venom-poison)", () => {
  it("gives the damaged character 1 poison for the damage an enemy with Venom dealt, whatever the damage", () => {
    const fight = fightEnemy(spiderTable, "f0", "132028", { seats: 1 });
    const hero = fight.made.hero;
    const hurt = fight.run.state.cards[hero]?.damage ?? 0;
    expect(hurt).toBeGreaterThan(0);
    expect(poisonOf(fight.run.state, hero)).toBe(1);
  });

  it("gives none when the enemy has no Venom", () => {
    const fight = fightEnemy(spiderTable, "f0", "132033", { seats: 1 });
    expect(fight.run.state.cards[fight.made.hero]).toBeDefined();
    expect(poisonOf(fight.run.state, fight.made.hero)).toBe(0);
  });

  it("gives none to a character the damage destroyed: it is out of play when the damage is noted", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132028", seat: 0 }] });
    const enemy = idOf(t.state, "132028");
    const before = { ...t.state, pendingAttack: { enemyId: enemy } } as unknown as ScenarioState;
    const hurt = updateCard(before, t.hero, { damage: 3 });
    expect(poisonOf(venomPoison(before, hurt, t.ctx), t.hero)).toBe(1);
    const destroyed = moveCard(updateCard(before, t.hero, { damage: 6 }), t.hero, { zone: "discard", seat: 0 });
    expect(Object.values(venomPoison(before, destroyed, t.ctx).cards).filter((card) => card.poison === true)).toEqual([]);
  });
});
