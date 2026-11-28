// Rules: rr.immune, rr.resources, rr.ownership-and-control, rr.effects, mec109.setup, rr.lasting-effects, rr.player-elimination, hob.bilbo-multiplayer-ohauh, hob.bilbo-multiplayer-otd (data/rules/entries.json).
// The Bilbo, Sméagol and Ring-bearer cards of the misc family, and The One Ring's immunity, run through its real records.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/misc.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { cardMap, codes, expectOk, fixtureDefinition } from "../../core/test-fixture.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { legalIntents, reduce, startScenario } from "../../engine/reduce.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo } from "../../core/zones.ts";
import { MISC_CARDS, miscCtx } from "./fixture.ts";
import { play, put, run, seat, trigger } from "../play/fixture.ts";

const gift = (code: string): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "action",
  instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", names: ["Bilbo Baggins"] } }, { verb: "AddResources", amount: 2, to: "picked" }],
});
const ctx = miscCtx([...RECORDS, gift("gift")]);

describe("Bilbo Baggins gains no resources from some cards", () => {
  it("131001: none from player card effects, whatever the card is called", () => {
    const table = seat(1, ["131001", "rohan"]);
    const bilbo = table.heroes[0] ?? "";
    const card = put(table.state, "gift", "hand");
    const state = syncConstants(table.state, ctx);
    // The event could add him nothing, so it is not offered (rr.triggered-ability) and his pool stays as it was.
    const held = run({ ...card.state, modifiers: state.modifiers }, ctx);
    expect(reduce(held, { type: "PlayCard", cardId: card.id, payments: [] }, ctx).ok).toBe(false);
    expect(held.cards[bilbo]?.resources).toBe(5);
  });

  it("132001: none from cards that are not treasures; a treasure's effect adds them", () => {
    const table = seat(1, ["132001", "rohan"]);
    const bilbo = table.heroes[0] ?? "";
    const card = put(table.state, "gift", "hand");
    const synced = syncConstants(table.state, ctx);
    const played = run({ ...card.state, modifiers: synced.modifiers }, ctx);
    expect(reduce(played, { type: "PlayCard", cardId: card.id, payments: [] }, ctx).ok).toBe(false);
    expect(played.cards[bilbo]?.resources).toBe(5);
    const treasureCtx = miscCtx([...RECORDS, gift("trove")]);
    // The same effect on a treasure card: Bilbo gains.
    const trove = put(played, "trove", "play");
    const used = trigger(syncConstants(trove.state, treasureCtx), trove.id, "trove:action:1", treasureCtx);
    expect(used.cards[bilbo]?.resources).toBe(7);
  });

  it("132001 searches the deck for a treasure for 1 Baggins resource, and is not counted against the hero limit (132001:A:1, 132001:A:2)", () => {
    const table = seat(1, ["132001", "rohan"]);
    const bilbo = table.heroes[0] ?? "";
    const one = put(table.state, "filler", "deck");
    const treasure = put(one.state, "treasure1", "deck");
    const state = run(updateCard(treasure.state, bilbo, { resources: 2 }), ctx);
    const used = trigger(state, bilbo, "132001:action:1", ctx, [{ heroId: bilbo, amount: 1 }]);
    expect(used.cards[bilbo]?.resources).toBe(1);
    expect(used.seats[0]?.hand).toContain(treasure.id);
    expect(used.seats[0]?.hand).not.toContain(one.id);
  });
});

describe("Bilbo Baggins follows the first player token (hob.bilbo-multiplayer-ohauh, hob.bilbo-multiplayer-otd)", () => {
  // Two players with a hero each; Bilbo is the first player's, carries a Short Sword and holds 3 resources.
  const twoSeats = (bilbo: string) => {
    const table = seat(2, ["rohan"]);
    const made = put(table.state, bilbo, "heroes", 0);
    const sword = put(made.state, "sword", "play", 0);
    const held = updateCard(attachTo(sword.state, sword.id, made.id), made.id, { resources: 3 });
    return { state: run(syncConstants(held, ctx), ctx), bilbo: made.id, sword: sword.id, table };
  };

  it.each([["131001"], ["132001"]])("%s:A:1 the new first player gains control of Bilbo Baggins, the resources in his pool and the cards attached to him", (code) => {
    const { state, bilbo, sword } = twoSeats(code);
    expect(state.cards[bilbo]?.controller).toBe(0);
    const passed = run({ ...state, firstPlayer: 1 }, ctx);
    expect(passed.cards[bilbo]?.controller).toBe(1);
    expect(passed.cards[bilbo]?.resources).toBe(3);
    expect(passed.cards[sword]?.controller).toBe(1);
    expect(passed.cards[sword]?.host).toBe(bilbo);
    // He is still seat 0's card: it takes him back when the token comes round again.
    expect(passed.cards[bilbo]?.owner).toBe(0);
    const back = run({ ...passed, firstPlayer: 0 }, ctx);
    expect(back.cards[bilbo]?.controller).toBe(0);
    expect(back.cards[sword]?.controller).toBe(0);
    expect(passed.seats.map((one) => one.eliminated)).toEqual([false, false]);
  });

  it("131001:A:1 a player whose only other hero is gone is eliminated when Bilbo passes to the new first player", () => {
    const { state, bilbo, table } = twoSeats("131001");
    const lone = table.heroes[0] ?? "";
    const without = { ...state, seats: [{ ...state.seats[0], heroes: state.seats[0].heroes.filter((id) => id !== lone) }, state.seats[1]] as typeof state.seats, cards: Object.fromEntries(Object.entries(state.cards).filter(([id]) => id !== lone)) };
    const passed = run({ ...without, firstPlayer: 1 }, ctx);
    expect(passed.cards[bilbo]?.controller).toBe(1);
    expect(passed.seats[0]?.eliminated).toBe(true);
    expect(passed.seats[1]?.eliminated).toBe(false);
    expect(passed.lost).toBeFalsy();
  });

  it.each([["143001"], ["145001"], ["146002"]])("%s:A:1 a player whose last hero is Aragorn is eliminated when the first player token passes him on (mec113.multiplayer-aragorn, mec112.aragorn)", (code) => {
    const aragorn = miscCtx([...RECORDS]);
    const table = seat(2, ["rohan"]);
    const made = put(table.state, code, "heroes", 0);
    const lone = table.heroes[0] ?? "";
    const base = syncConstants(made.state, aragorn);
    const without = { ...base, seats: [{ ...base.seats[0], heroes: base.seats[0].heroes.filter((id) => id !== lone) }, base.seats[1]] as typeof base.seats, cards: Object.fromEntries(Object.entries(base.cards).filter(([id]) => id !== lone)) };
    const passed = run({ ...without, firstPlayer: 1 }, aragorn);
    expect(passed.cards[made.id]?.controller).toBe(1);
    expect(passed.seats[0]?.eliminated).toBe(true);
    expect(passed.seats[1]?.eliminated).toBe(false);
    expect(passed.lost).toBeFalsy();
  });

  it("132001:A:1 a player with another hero is not eliminated when Bilbo passes on", () => {
    const { state } = twoSeats("132001");
    const passed = run({ ...state, firstPlayer: 1 }, ctx);
    expect(passed.seats[0]?.eliminated).toBe(false);
    expect(passed.seats[0]?.heroes).toHaveLength(1);
  });
});

describe("Burglar Baggins and The Lucky Number", () => {
  it("Burglar Baggins gives Bilbo +2 Willpower, Attack and Defense, and may be paid from his pool by a player who does not control him (131019:A:1)", () => {
    // One Bilbo, controlled by the first player (seat 0); seat 1 holds the card.
    const table = seat(2, ["rohan"]);
    const placed = put(table.state, "131001", "heroes", 0);
    const bilbo = placed.id;
    const burglar = put(placed.state, "131019", "hand", 1);
    const synced = syncConstants(run(updateCard(burglar.state, bilbo, { resources: 5 }), ctx), ctx);
    expect(synced.cards[bilbo]?.controller).toBe(0);
    const state: typeof synced = { ...synced, activeSeat: 1, window: { kind: "pass" }, planningSeat: 1 };
    const played = play(state, burglar.id, ctx, [{ heroId: bilbo, amount: 1 }]);
    expect(played.cards[bilbo]?.resources).toBe(4);
    const after = syncConstants(run(played, ctx), ctx);
    expect(modifiedStat(after, after.cards[bilbo]!, "willpower", ctx.cards)).toBe(2 + 2);
    expect(modifiedStat(after, after.cards[bilbo]!, "attack", ctx.cards)).toBe(2 + 2);
    expect(modifiedStat(after, after.cards[bilbo]!, "defense", ctx.cards)).toBe(2 + 2);
  });

  it("The Lucky Number adds Bilbo's total Willpower, Attack and Defense to another character (132013:A:1)", () => {
    const table = seat(1, ["131001", "rohan"]);
    const bilbo = table.heroes[0] ?? "";
    const rohan = table.heroes[1] ?? "";
    const number = put(table.state, "132013", "hand");
    const synced = syncConstants(number.state, ctx);
    const played = run(play(synced, number.id, ctx), ctx);
    const after = syncConstants(played, ctx);
    expect(modifiedStat(after, after.cards[rohan]!, "willpower", ctx.cards)).toBe(2 + 2);
    expect(modifiedStat(after, after.cards[rohan]!, "attack", ctx.cards)).toBe(2 + 2);
    expect(modifiedStat(after, after.cards[bilbo]!, "willpower", ctx.cards)).toBe(2);
  });
});

describe("Speak Your Promise!", () => {
  it("readies the Ring-bearer and lowers the enemy's Attack and Defense by his Willpower above its Threat (144013:A:1)", () => {
    const table = seat(1, ["142001", "rohan"]);
    const frodo = table.heroes[0] ?? "";
    const promise = put(table.state, "144013", "hand");
    const grunt = put(promise.state, "grunt", "engaged");
    // Frodo has Willpower 2 here and the Grunt Threat 1: the difference is 1.
    const state = updateCard(grunt.state, frodo, { exhausted: true });
    const played = run(play(state, promise.id, ctx), ctx);
    expect(played.cards[frodo]?.exhausted).toBe(false);
    expect(modifiedStat(played, played.cards[grunt.id]!, "attack", ctx.cards)).toBe(1);
    expect(modifiedStat(played, played.cards[grunt.id]!, "defense", ctx.cards)).toBe(0);
  });
});

describe("Sméagol's Setup", () => {
  it("shuffles 2 copies of Stinker into the encounter deck (21072:A:2)", () => {
    const filler = codes("f", 8);
    const cards = cardMap([...MISC_CARDS.values(), ...filler.map((code) => ({ ...MISC_CARDS.get("filler")!, code, name: code }))]);
    const begun = startScenario(
      { seatCount: 1, seed: 5, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["21072", "dwarf"], deck: filler }], encounterDeck: ["grunt"], questDeck: ["stage"] },
      { effects: RECORDS, cards },
    );
    // A hero's Setup resolves once the opening hand is kept (families/sidequests/setup.ts).
    let state = begun;
    for (let guard = 0; guard < 6 && state.window?.kind === "mulligan"; guard += 1) state = expectOk(reduce(state, { type: "Keep" }, { effects: RECORDS, cards })).state;
    const stinkers = state.encounterDeck.filter((id) => state.cards[id]?.code === "21071");
    expect(stinkers).toHaveLength(2);
    expect(state.encounterDeck).toHaveLength(3);
    // The hero stayed among the heroes.
    expect(Object.values(state.cards).find((card) => card.code === "21072")?.zone).toBe("heroes");
  });
});

describe("The One Ring is immune to the effects of cards without the Master trait", () => {
  it("a Condition-chasing Response skips it, and an effect of a Master card does not (21001:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const ring = put(table.state, "21001", "play");
    const miner = put(ring.state, "01061", "hand");
    const hero = table.heroes[0] ?? "";
    // For this test the Ring also carries the Condition trait, so Miner of the Iron Hills' Pick would take it.
    const cards = new Map(MISC_CARDS);
    cards.set("21001", { ...MISC_CARDS.get("21001")!, traits: ["Artifact", "Ring", "Master", "Condition"] });
    const world = { effects: RECORDS, cards };
    const attached = syncConstants(attachTo(miner.state, ring.id, hero), world);
    // The Ring is the only Condition and the Miner cannot choose it, so the Response is not offered (rr.triggered-ability).
    const withMiner = run(play(attached, miner.id, world, [{ heroId: hero, amount: 2 }]), world);
    expect(legalIntents(withMiner, world).some((intent) => intent.type === "Trigger" && intent.cardId === miner.id)).toBe(false);
    expect(withMiner.cards[ring.id]?.zone).toBe("play");
    // Without the immunity record the Miner discards it.
    const bare = { effects: RECORDS.filter((record) => record.id !== "21001:constant:1"), cards };
    const bareAttached = syncConstants(attachTo(miner.state, ring.id, hero), bare);
    const discarded = trigger(run(play(bareAttached, miner.id, bare, [{ heroId: hero, amount: 2 }]), bare), miner.id, "01061:response:1", bare);
    expect(discarded.cards[ring.id]?.zone).not.toBe("play");
  });
});
