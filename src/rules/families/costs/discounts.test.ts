import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/costs.ts";

import { playCost } from "../../player/attach.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { flagged, updateCard, withMode, withThreat, type ScenarioState } from "../../core/state.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { attachTo } from "../../core/zones.ts";
import { card, put, table } from "./fixture.ts";

// Rules: rr.resource-match, rr.cost, rr.doomed-x, rr.keywords, rr.lasting-effects, rr.limits, rr.modifiers, rr.qualifiers
// (data/rules/entries.json). Discounts on the next card (ReduceNextCost and its riders), standing reductions (ReduceCostOf,
// ReduceCost on a host), and the number a player chooses for X.

const grima = card("07002", "hero", "lore", null, { threat: 9 });
const anyAlly = card("ally2", "ally", "leadership", 2);
const tacAlly = card("tally", "ally", "tactics", 2);
const king = card("18008", "attachment", "leadership", 1);
const daleHero = card("dale", "hero", "leadership", null, { threat: 9, traits: ["Dale"] });
const daleAlly = card("dally", "ally", "spirit", 3, { traits: ["Dale"] });
const ring = card("ring", "attachment", "neutral", 0);
const walls = card("19086", "event", "leadership", 1);
const smoke = card("22116", "event", "neutral", 0);
const pipe = card("pipe", "attachment", "neutral", 0, { traits: ["Pipe", "Item"] });
const lorien = card("08058", "attachment", "lore", 1);
const silvan = card("silvan", "ally", "lore", 2, { traits: ["Silvan"] });
const meal = card("04010", "attachment", "neutral", 0);
const hobbitHero = card("hobbit", "hero", "spirit", null, { threat: 7, traits: ["Hobbit"] });
const spiritEvent = card("sevent", "event", "spirit", 3);
const loreEvent = card("levent", "event", "lore", 3);
const hope = card("10063", "event", "leadership", 1);
const valour = card("valour", "event", "leadership", 3);
const plain = card("plainev", "event", "leadership", 3);
const sea = card("11014", "attachment", "lore", 1);
const noldorHero = card("noldor", "hero", "lore", null, { threat: 9, traits: ["Noldor"] });
const noldorAlly = card("nally", "ally", "lore", 4, { traits: ["Noldor"] });
const beregond = card("05001", "hero", "tactics", null, { threat: 10 });
const sword = card("sword", "attachment", "tactics", 2, { traits: ["Weapon"] });
const theoden = card("143002", "hero", "tactics", null, { threat: 12, name: "Théoden", traits: ["Rohan"] });
const herugrim = card("143010", "attachment", "tactics", 2);
const rider = card("rider", "ally", "tactics", 2, { traits: ["Rohan"] });

const CARDS = [grima, anyAlly, tacAlly, king, daleHero, daleAlly, ring, walls, smoke, pipe, lorien, silvan, meal, hobbitHero, spiritEvent, loreEvent, hope, valour, plain, sea, noldorHero, noldorAlly, beregond, sword, theoden, herugrim, rider];
const VALOUR: Effect = { id: "valour:action:1", cardCode: "valour", lines: ["valour:A:1"], timing: "action", condition: { kind: "threat", min: 40, valour: true }, instructions: [{ verb: "Draw" }] };
const PLAIN: Effect = { id: "plainev:action:1", cardCode: "plainev", lines: ["plainev:A:1"], timing: "action", instructions: [{ verb: "Draw" }] };

function attach(state: ScenarioState, id: string, host: string): ScenarioState {
  return attachTo(state, id, host);
}

describe("the next card costs less (ReduceNextCost)", () => {
  it("Gríma: the next card costs 1 less this round and gains Doomed 1, raising each player's threat as it is played", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"], ["lead"]]);
    const hero = put(state, "07002", "heroes");
    const ally = put(hero.state, "ally2", "hand");
    const start = withThreat(withThreat(ally.state, 0, 20), 1, 25);
    const used = expectOk(reduce(start, { type: "Trigger", cardId: hero.id, effectId: "07002:action:1" }, ctx)).state;
    expect(playCost(used, ally.id, 0, ctx)).toBe(1);
    const played = expectOk(reduce(used, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx)).state;
    expect([played.seats[0].threat, played.seats[1].threat]).toEqual([21, 26]);
    expect(played.discounts ?? []).toEqual([]);
    expect(legalIntents(played, ctx)).not.toContainEqual({ type: "Trigger", cardId: hero.id, effectId: "07002:action:1" });
  });

  it("King of Dale: 1 less for each different player attachment on its hero, and that ally needs no resource match", () => {
    const { state, ctx } = table(RECORDS, CARDS, [[]]);
    const hero = put(state, "dale", "heroes");
    const crown = put(updateCard(hero.state, hero.id, { resources: 3 }), "18008", "play");
    const first = put(crown.state, "ring", "play");
    const second = put(first.state, "ring", "play");
    let next = attach(attach(attach(second.state, crown.id, hero.id), first.id, hero.id), second.id, hero.id);
    const ally = put(next, "dally", "hand");
    next = expectOk(reduce(ally.state, { type: "Trigger", cardId: crown.id, effectId: "18008:action:1" }, ctx)).state;
    expect(playCost(next, ally.id, 0, ctx)).toBe(1);
    const played = expectOk(reduce(next, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: hero.id, amount: 1 }] }, ctx)).state;
    expect(played.cards[ally.id]?.zone).toBe("play");
  });

  it("Man the Walls: each player's next ally costs 1 less this phase and cannot quest this round", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"], ["lead"]]);
    const event = put(state, "19086", "hand");
    const mine = put(event.state, "ally2", "hand", 0);
    const theirs = put(mine.state, "ally2", "hand", 1);
    const played = expectOk(reduce(theirs.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx)).state;
    expect(playCost(played, mine.id, 0, ctx)).toBe(1);
    expect(playCost(played, theirs.id, 1, ctx)).toBe(1);
    const ally = expectOk(reduce(played, { type: "PlayCard", cardId: mine.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx)).state;
    expect(flagged(ally, mine.id, "cannotQuest")).toBe(true);
    expect(playCost(ally, theirs.id, 1, ctx)).toBe(1);
  });

  it("Smoke and Think lasts until a card spends it; O Lórien! does not go below 1 and ends with the phase", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lore"]]);
    const hero = ids[0]?.[0] ?? "";
    const tobacco = put(state, "pipe", "play");
    const event = put(attach(tobacco.state, tobacco.id, hero), "22116", "hand");
    const ally = put(event.state, "silvan", "hand");
    const smoked = expectOk(reduce(ally.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx)).state;
    const later = withMode(withMode(smoked, "questCommit"), "planning");
    expect(playCost(later, ally.id, 0, ctx)).toBe(1);
    const elf = put(later, "08058", "play");
    const worn = attach(elf.state, elf.id, hero);
    const lorienUsed = expectOk(reduce({ ...worn, discounts: [] }, { type: "Trigger", cardId: elf.id, effectId: "08058:action:1" }, ctx)).state;
    const cheap = updateCard(lorienUsed, ally.id, {});
    expect(playCost(cheap, ally.id, 0, ctx)).toBe(1);
    const silvan1 = { ...ctx, cards: new Map([...ctx.cards, ["silvan", { ...silvan, cost: 1 }]]) };
    expect(playCost(cheap, ally.id, 0, silvan1)).toBe(1);
    expect(withMode(cheap, "questCommit").discounts ?? []).toEqual([]);
  });

  it("Good Meal: the next event of the attached hero's sphere this round costs 2 less", () => {
    const { state, ctx } = table(RECORDS, CARDS, [[]]);
    const hero = put(state, "hobbit", "heroes");
    const food = put(hero.state, "04010", "play");
    const spiritCard = put(attach(food.state, food.id, hero.id), "sevent", "hand");
    const loreCard = put(spiritCard.state, "levent", "hand");
    const eaten = expectOk(reduce(loreCard.state, { type: "Trigger", cardId: food.id, effectId: "04010:action:1" }, ctx)).state;
    expect(eaten.cards[food.id]?.zone).toBe("discard");
    expect(playCost(eaten, spiritCard.id, 0, ctx)).toBe(1);
    expect(playCost(eaten, loreCard.id, 0, ctx)).toBe(3);
  });

  it.each([
    ["Bilbo Baggins 132001 and The Lucky Number 132013 (Baggins)", "baggins", 1],
    ["Frodo Baggins 142001 and Frodo's Intuition 141012 (Fellowship)", "fellowship", 2],
  ] as const)("Good Meal on a hero of a sphere of his own: %s costs 2 less (rr.neutral-cards)", (_name, sphere, cost) => {
    const hobbit = card("bhero", "hero", sphere, null, { threat: 9, traits: ["Hobbit"] });
    const own = card("bevent", "event", sphere, cost);
    const { state, ctx } = table(RECORDS, [...CARDS, hobbit, own], [[]]);
    const hero = put(state, "bhero", "heroes");
    const food = put(hero.state, "04010", "play");
    const event = put(attach(food.state, food.id, hero.id), "bevent", "hand");
    const eaten = expectOk(reduce(event.state, { type: "Trigger", cardId: food.id, effectId: "04010:action:1" }, ctx)).state;
    expect(eaten.cards[food.id]?.zone).toBe("discard");
    expect(playCost(eaten, event.id, 0, ctx)).toBe(0);
  });

  it("Hope Rekindled: only an event with a Valour ability costs 2 less", () => {
    const { state, ids, ctx } = table([...RECORDS, VALOUR, PLAIN], CARDS, [["lead"]]);
    const event = put(state, "10063", "hand");
    const brave = put(event.state, "valour", "hand");
    const dull = put(brave.state, "plainev", "hand");
    const played = expectOk(reduce(dull.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx)).state;
    expect(playCost(played, brave.id, 0, ctx)).toBe(1);
    expect(playCost(played, dull.id, 0, ctx)).toBe(3);
  });

  it("To the Sea, to the Sea!: the player chooses X, discards X cards and the next Noldor ally costs X less, not below 1", () => {
    const { state, ctx } = table(RECORDS, CARDS, [[]]);
    const hero = put(state, "noldor", "heroes");
    const sea2 = put(hero.state, "11014", "play");
    let next = attach(sea2.state, sea2.id, hero.id);
    const ally = put(next, "nally", "hand");
    next = put(put(ally.state, "ring", "hand").state, "ring", "hand").state;
    next = put(next, "pipe", "hand").state;
    const asked = expectOk(reduce(next, { type: "Trigger", cardId: sea2.id, effectId: "11014:action:1" }, ctx)).state;
    expect(asked.window).toMatchObject({ kind: "choose", options: ["x1", "x2", "x3", "x4"] });
    const two = expectOk(reduce(asked, { type: "Choose", optionId: "x2" }, ctx)).state;
    let after = two;
    while (after.window?.kind === "choose") {
      const option = after.window.options.find((id) => id !== ally.id) ?? "";
      after = expectOk(reduce(after, { type: "Choose", optionId: option }, ctx)).state;
    }
    expect(after.seats[0].hand.length).toBe(2);
    expect(playCost(after, ally.id, 0, ctx)).toBe(2);
  });
});

describe("discounts read from the table", () => {
  it("Heir of Valandil: 1 less per engaged enemy; Bartering: the returned attachment's cost off the next attachment anyone plays", () => {
    const heir = card("09010", "attachment", "leadership", 1);
    const duned = card("duned", "hero", "leadership", null, { threat: 9, traits: ["Dúnedain"] });
    const ranger = card("ranger", "ally", "leadership", 3, { traits: ["Dúnedain"] });
    const orc = card("orc", "enemy", null, null, { engagementCost: 30, threat: 2 });
    const barter = card("18015", "event", "neutral", 0);
    const { state, ctx } = table(RECORDS, [...CARDS, heir, duned, ranger, orc, barter], [[]]);
    const hero = put(state, "duned", "heroes");
    const relic = put(hero.state, "09010", "play");
    let next = attach(relic.state, relic.id, hero.id);
    next = put(put(next, "orc", "engaged").state, "orc", "engaged").state;
    const ally = put(next, "ranger", "hand");
    const used = expectOk(reduce(ally.state, { type: "Trigger", cardId: relic.id, effectId: "09010:action:1" }, ctx)).state;
    expect(playCost(used, ally.id, 0, ctx)).toBe(1);
    const sold = put(updateCard(used, relic.id, { exhausted: false }), "18015", "hand");
    const lamp = put(sold.state, "sword", "hand");
    const traded = expectOk(reduce({ ...lamp.state, discounts: [] }, { type: "PlayCard", cardId: sold.id, payments: [] }, ctx)).state;
    expect(traded.cards[relic.id]?.zone).toBe("hand");
    expect(playCost(traded, lamp.id, 0, ctx)).toBe(1);
  });

  it("Mirkwood Hunter costs 1 less per attachment on the active location; Tom Cotton's first Hobbit ally needs no match while a high enemy is engaged", () => {
    const hunter = card("19087", "ally", "tactics", 3);
    const place = card("place", "location", null, null, { questPoints: 3, threat: 1 });
    const tom = card("146004", "hero", "leadership", null, { threat: 8, traits: ["Hobbit"] });
    const hob = card("hob", "ally", "spirit", 1, { traits: ["Hobbit"] });
    const troll = card("troll", "enemy", null, null, { engagementCost: 45, threat: 2 });
    const { state, ctx } = table(RECORDS, [...CARDS, hunter, place, tom, hob, troll], [[]]);
    const location = put(state, "place", "staging");
    let next: ScenarioState = { ...location.state, staging: location.state.staging.filter((id) => id !== location.id), activeLocation: location.id, cards: { ...location.state.cards, [location.id]: { ...location.state.cards[location.id]!, zone: "activeLocation" as const } } };
    const sign = put(next, "ring", "play");
    next = attach(sign.state, sign.id, location.id);
    const ally = put(next, "19087", "hand");
    expect(playCost(ally.state, ally.id, 0, ctx)).toBe(2);
    const hero = put(ally.state, "146004", "heroes");
    const hobbit = put(updateCard(hero.state, hero.id, { resources: 2 }), "hob", "hand");
    expect(reduce(hobbit.state, { type: "PlayCard", cardId: hobbit.id, payments: [{ heroId: hero.id, amount: 1 }] }, ctx).ok).toBe(false);
    const engaged = syncConstants(withThreat(put(hobbit.state, "troll", "engaged").state, 0, 30), ctx);
    expect(expectOk(reduce(engaged, { type: "PlayCard", cardId: hobbit.id, payments: [{ heroId: hero.id, amount: 1 }] }, ctx)).state.cards[hobbit.id]?.zone).toBe("play");
  });
});

describe("standing reductions", () => {
  it("Beregond's Weapon costs 2 less on him only; Théoden's first Rohan ally each round costs 1 less; Herugrim costs 1 less on Théoden", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["tac"]]);
    const hero = put(state, "05001", "heroes");
    const blade = put(hero.state, "sword", "hand");
    const tacId = Object.values(blade.state.cards).find((entry) => entry.code === "tac")?.id ?? "";
    expect(playCost(blade.state, blade.id, 0, ctx, hero.id)).toBe(0);
    expect(playCost(blade.state, blade.id, 0, ctx, tacId)).toBe(2);
    const king2 = put(blade.state, "143002", "heroes");
    const first = put(updateCard(king2.state, king2.id, { resources: 3 }), "rider", "hand");
    const second = put(first.state, "rider", "hand");
    const grim = put(second.state, "143010", "hand");
    const synced = syncConstants(grim.state, ctx);
    expect(playCost(synced, grim.id, 0, ctx, king2.id)).toBe(1);
    expect(playCost(synced, grim.id, 0, ctx, tacId)).toBe(2);
    expect(playCost(synced, first.id, 0, ctx)).toBe(1);
    const played = expectOk(reduce(synced, { type: "PlayCard", cardId: first.id, payments: [{ heroId: king2.id, amount: 1 }] }, ctx)).state;
    expect(playCost(played, second.id, 0, ctx)).toBe(2);
  });
});
