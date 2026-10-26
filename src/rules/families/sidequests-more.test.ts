// Rules: rr.search, rr.victory, rr.limits, rr.campaign-pool, rr.response (data/rules/entries.json).
// Records of attachments and events that add themselves to the victory display, search the encounter deck, or end a side quest.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { modifiedStat } from "../keywords.ts";
import { queueEvent } from "../queue.ts";
import { reduce } from "../reduce.ts";
import { updateCard, withThreat } from "../state.ts";
import { attachTo, spawn } from "../zones.ts";
import { offered, play, put, questArea, run, seat, send, sideCtx, trigger } from "./sidequests-fixture.ts";
import { defeatSideQuest } from "./sidequests-quest.ts";

const ctx = sideCtx(RECORDS);

describe("Out of the Wild (04036:A:2)", () => {
  it("adds a non-objective card worth no victory points from the top 5 of the encounter deck to the victory display, and itself", () => {
    const table = seat(1, ["lore", "dwarf"]);
    let state = table.state;
    // Top first: a card worth victory points, an objective, a card that qualifies, then three more (the sixth is out of reach).
    for (const code of ["forest-orc", "plot", "wolf", "marsh-copy", "orc", "ford"]) state = spawn(state, code, { zone: "encounterDeck" }).state;
    const event = put(state, "04036", "hand");
    let played = play(event.state, event.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 3 }]);
    // Wolf, Marsh and Orc qualify among the top 5: the player chooses.
    expect(played.window).toMatchObject({ kind: "choose" });
    const marsh = Object.values(played.cards).find((card) => card.code === "marsh-copy")?.id ?? "";
    played = send(played, { type: "Choose", optionId: marsh }, ctx);
    expect(played.victory).toEqual(expect.arrayContaining([marsh, event.id]));
    expect(played.encounterDeck).toHaveLength(5);
  });
});

describe("attachments that add themselves to the victory display", () => {
  it("The Red Arrow puts an ally from the top 5 of the deck into play, after the attached hero quests successfully at 40 threat (17058:A:3)", () => {
    const table = seat(1, ["gondor", "rohan"]);
    const hero = table.heroes[0] ?? "";
    const arrow = put(table.state, "17058", "play");
    let state = attachTo(arrow.state, arrow.id, hero);
    for (const code of ["filler", "helper", "filler", "cheap"]) state = put(state, code, "deck").state;
    const event = { trigger: "questedSuccessfully", seat: 0, subject: hero } as const;
    // Under 40 threat the Valour Response is not offered.
    const low = run(queueEvent(updateCard(state, hero, {}), event), ctx);
    expect(offered(low, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "17058:response:1")).toBe(false);
    const high = { ...state, seats: [{ ...state.seats[0], threat: 41 }, state.seats[1]] } as typeof state;
    let answered = run(queueEvent(high, event), ctx);
    answered = trigger(answered, arrow.id, "17058:response:1", ctx);
    expect(answered.victory).toContain(arrow.id);
    // The deck holds one ally that is not the same card twice: a choice between the two allies.
    expect(answered.window).toMatchObject({ kind: "choose" });
    const helper = Object.values(answered.cards).find((card) => card.code === "helper")?.id ?? "";
    answered = send(answered, { type: "Choose", optionId: helper }, ctx);
    expect(answered.cards[helper]?.zone).toBe("play");
  });

  it("Black Arrow gives the attacking hero +5 Attack for this attack and goes to the victory display (132015:A:2)", () => {
    const table = seat(1, ["gondor", "rohan"]);
    const hero = table.heroes[0] ?? "";
    const arrow = put(table.state, "132015", "play");
    const enemy = put(arrow.state, "orc", "engaged", 0);
    const state = attachTo(enemy.state, arrow.id, hero);
    const base = modifiedStat(state, state.cards[hero]!, "attack", ctx.cards);
    let answered = run(queueEvent(state, { trigger: "declaredAttacker", seat: 0, cardId: hero, other: enemy.id }), ctx);
    answered = trigger(answered, arrow.id, "132015:response:1", ctx);
    expect(answered.victory).toContain(arrow.id);
    expect(modifiedStat(answered, answered.cards[hero]!, "attack", ctx.cards)).toBe(base + 5);
  });

  it("Friend of Friends: at most 2 copies in play, on Hobbit heroes (146012:A:1)", () => {
    const table = seat(1, ["lore", "dwarf"]);
    let state = table.state;
    const first = put(state, "146012", "hand");
    const second = put(first.state, "146012", "hand");
    const third = put(second.state, "146012", "hand");
    state = third.state;
    const hobbit = table.heroes[0] ?? "";
    // Dwarf heroes cannot carry it.
    expect(reduce(state, { type: "PlayCard", cardId: first.id, payments: [], hostId: table.heroes[1] ?? "" }, ctx).ok).toBe(false);
    state = play(state, first.id, ctx, [{ heroId: hobbit, amount: 1 }], hobbit);
    state = play(state, second.id, ctx, [{ heroId: hobbit, amount: 1 }], hobbit);
    expect(reduce(state, { type: "PlayCard", cardId: third.id, payments: [], hostId: hobbit }, ctx).ok).toBe(false);
  });
});

describe("The Road Goes Ever On (16012:A:2)", () => {
  it("the first player chooses a player, who searches for a side quest, adds it to their hand and shuffles, when the attached side quest is defeated", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const quest = questArea(table.state, "09014");
    const road = put(quest.state, "16012", "play");
    let state = attachTo(road.state, road.id, quest.id);
    state = put(state, "10034", "deck", 1).state;
    state = put(state, "filler", "deck", 1).state;
    state = defeatSideQuest(state, quest.id, ctx, []);
    state = run(state, ctx);
    // The Response of Gather Information is offered first; the attachment's follows, which hears the defeat from the discard pile.
    state = send(state, { type: "Pass" }, ctx);
    expect(offered(state, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "16012:response:1")).toBe(true);
    state = trigger(state, road.id, "16012:response:1", ctx);
    expect(state.window).toMatchObject({ kind: "choose" });
    state = send(state, { type: "Choose", optionId: "seat:1" }, ctx);
    const found = Object.values(state.cards).find((card) => card.code === "10034");
    expect(found?.zone).toBe("hand");
    expect(found?.controller).toBe(1);
  });
});

describe("the Lórien gifts' Actions (142015 to 142018)", () => {
  function gift(code: string, seats: 1 | 2 = 1) {
    const table = seat(seats, ["dwarf", "rohan"]);
    const made = put(table.state, code, "play");
    return { table, made, state: attachTo(made.state, made.id, table.heroes[0] ?? "") };
  }

  it("Phial of Galadriel: each enemy engaged with you gets -4 Attack until the end of the round; it is removed from the campaign pool (142015:A:2)", () => {
    const { made, state: attached } = gift("142015");
    const wolf = put(attached, "wolf", "engaged", 0);
    const before = modifiedStat(wolf.state, wolf.state.cards[wolf.id]!, "attack", ctx.cards);
    const state = trigger(wolf.state, made.id, "142015:action:1", ctx);
    expect(state.victory).toContain(made.id);
    expect(state.removedFromPool).toEqual(["142015"]);
    expect(modifiedStat(state, state.cards[wolf.id]!, "attack", ctx.cards)).toBe(Math.max(0, before - 4));
  });

  it("Three Golden Hairs: lowers each player's threat by 3, then each draws 3 cards (142016:A:2)", () => {
    const { made, state: attached } = gift("142016", 2);
    let state = [0, 1].reduce((acc, index) => withThreat(acc, index, 20), attached);
    for (const index of [0, 1]) for (let card = 0; card < 3; card += 1) state = put(state, "filler", "deck", index).state;
    state = trigger(state, made.id, "142016:action:1", ctx);
    expect(state.seats.map((entry) => entry.threat)).toEqual([17, 17]);
    expect(state.seats.map((entry) => entry.hand.length)).toEqual([3, 3]);
    expect(state.removedFromPool).toEqual(["142016"]);
  });

  it("Lórien Rope: each location in the staging area gets -2 Threat until the end of the phase (142017:A:2)", () => {
    const { made, state: attached } = gift("142017");
    const marsh = put(attached, "marsh", "staging");
    const state = trigger(marsh.state, made.id, "142017:action:1", ctx);
    expect(modifiedStat(state, state.cards[marsh.id]!, "threat", ctx.cards)).toBe(0);
  });

  it("Leaf-wrapped Lembas: ready all heroes in play (142018:A:2)", () => {
    const { table, made, state: attached } = gift("142018", 2);
    const tired = table.heroes.reduce((acc, id) => updateCard(acc, id, { exhausted: true }), attached);
    const state = trigger(tired, made.id, "142018:action:1", ctx);
    for (const id of table.heroes) expect(state.cards[id]?.exhausted).toBe(false);
  });
});
