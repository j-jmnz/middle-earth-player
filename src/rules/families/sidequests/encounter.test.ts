// Rules: rr.setup, rr.encounter-deck, rr.reveal, rr.staging, rr.ownership-and-control, rr.removed-from-game, rr.delayed-effects
// (data/rules/entries.json).
// Player cards with the Encounter keyword: set aside at the start, shuffled into the encounter deck by other cards, revealed there.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/sidequests.ts";
import { codes, fixtureDefinition } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { startScenario } from "../../engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { crossTo, inVictory, offered, passQuestWindow, play, put, questing, run, seat, send, SIDE_CARDS, sideCtx } from "./fixture.ts";

const ctx = sideCtx(RECORDS);

describe("the Encounter keyword at the start of the game", () => {
  it("sets the player's Encounter cards aside, still theirs, instead of drawing them (09015:A:1)", () => {
    const filler = codes("f", 20);
    const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const)]);
    const started = startScenario(
      { seatCount: 1, seed: 3, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["09015", "09015", "09015", ...filler] }], encounterDeck: [], questDeck: ["stage"] },
      { effects: RECORDS, cards },
    );
    const rangers = Object.values(started.cards).filter((card) => card.code === "09015");
    expect(rangers).toHaveLength(3);
    for (const ranger of rangers) expect(ranger).toMatchObject({ zone: "setAside", owner: 0 });
    expect(started.seats[0].deck.length + started.seats[0].hand.length).toBe(20);
  });
});

describe("shuffling a set-aside Encounter card into the encounter deck", () => {
  function withSetAside(code: string, heroes: readonly string[] = ["dwarf", "rohan"], owner = 0) {
    const table = seat(2, heroes);
    const aside = spawn(table.state, code, { zone: "setAside" });
    return { table, id: aside.id, state: updateCard(aside.state, aside.id, { owner }) };
  }
  const pay = (heroId: string | undefined, amount: number) => [{ heroId: heroId ?? "", amount }];

  it("Ranger Summons shuffles one of its player's set-aside Rangers in, and is removed from the game (09007:A:2)", () => {
    const { table, id, state } = withSetAside("09015");
    const other = spawn(state, "09015", { zone: "setAside" });
    const theirs = updateCard(other.state, other.id, { owner: 1 });
    const summons = put(theirs, "09007", "hand");
    const played = play(summons.state, summons.id, ctx, pay(table.heroes[0], 1));
    expect(played.cards[id]?.zone).toBe("encounterDeck");
    expect(played.cards[other.id]?.zone).toBe("setAside");
    expect(played.cards[summons.id]?.zone).toBe("removed");
  });

  it("Flight to the Sea and Tom Bombadillo! shuffle their set-aside card in (17140:A:2, 22005:A:2)", () => {
    const sea = withSetAside("17144");
    const flight = put(sea.state, "17140", "hand");
    const shuffled = play(flight.state, flight.id, ctx, pay(sea.table.heroes[1], 2));
    expect(shuffled.cards[sea.id]?.zone).toBe("encounterDeck");
    expect(shuffled.cards[flight.id]?.zone).toBe("removed");
    const tom = withSetAside("22010");
    const bombadillo = put(tom.state, "22005", "hand");
    const done = play(bombadillo.state, bombadillo.id, ctx);
    expect(done.cards[tom.id]?.zone).toBe("encounterDeck");
    expect(done.victory).toContain(bombadillo.id);
  });

  it("Flight of the Eagles returns an Eagle ally to the hand to shuffle an Eagle of the North in (19032:A:1)", () => {
    const { id, state } = withSetAside("19035", ["gondor", "rohan"]);
    const flight = put(state, "19032", "hand");
    // With no Eagle ally in play it cannot be played.
    expect(offered(flight.state, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === flight.id)).toBe(false);
    const eagle = put(flight.state, "eagle", "play");
    const done = play(eagle.state, flight.id, ctx);
    expect(done.cards[eagle.id]?.zone).toBe("hand");
    expect(done.cards[id]?.zone).toBe("encounterDeck");
    expect(done.cards[flight.id]?.zone).toBe("removed");
  });
});

describe("revealing an Encounter card from the encounter deck", () => {
  // The quest phase with this card on top of the encounter deck, above a filler enemy (surge reveals a second card).
  function revealed(code: string, prepare: (state: ScenarioState) => ScenarioState = (state) => state, seats: 1 | 2 = 2) {
    const table = seat(seats, ["dwarf", "rohan"]);
    let state = prepare(table.state);
    const card = spawn(state, code, { zone: "encounterDeck" });
    state = updateCard(card.state, card.id, { owner: 0 });
    for (let filler = 0; filler < 4; filler += 1) state = spawn(state, "orc", { zone: "encounterDeck" }).state;
    return { table, id: card.id, state: run(passQuestWindow(questing(state), ctx), ctx) };
  }

  it("Ranger of the North goes to the player the first player chooses, who then damages an enemy (09015:A:2)", () => {
    const { id, state } = revealed("09015", (base) => put(base, "wolf", "staging").state);
    expect(state.window).toMatchObject({ kind: "choose", seat: 0 });
    const next = send(state, { type: "Choose", optionId: "seat:1" }, ctx);
    expect(next.cards[id]).toMatchObject({ zone: "play", controller: 1, owner: 0 });
    expect(next.seats[1].play).toContain(id);
    // The wolf in the staging area was the only enemy to damage.
    expect(Object.values(next.cards).find((card) => card.code === "wolf")?.damage).toBe(2);
  });

  it("Ranger of the North places 2 progress on a location when there is no enemy (09015:A:2)", () => {
    const { state } = revealed("09015", (base) => put(base, "ford", "staging").state);
    const next = send(state, { type: "Choose", optionId: "seat:0" }, ctx);
    expect(Object.values(next.cards).find((card) => card.code === "ford")?.progress).toBeGreaterThanOrEqual(2);
  });

  it("Wind from the Sea readies the heroes committed to the quest and is removed from the game (17144:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    let state = send(questing(table.state), { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
    expect(state.cards[table.heroes[0] ?? ""]?.exhausted).toBe(true);
    const wind = spawn(state, "17144", { zone: "encounterDeck" });
    state = spawn(wind.state, "orc", { zone: "encounterDeck" }).state;
    const after = run(passQuestWindow(state, ctx), ctx);
    expect(after.cards[wind.id]?.zone).toBe("removed");
    expect(after.cards[table.heroes[0] ?? ""]?.exhausted).toBe(false);
  });

  it("Eagle of the North goes to the chosen player, who discards a non-unique enemy in the staging area (19035:A:3)", () => {
    const { id, state } = revealed("19035", (base) => put(base, "wolf2", "staging").state);
    const next = send(state, { type: "Choose", optionId: "seat:0" }, ctx);
    expect(next.cards[id]).toMatchObject({ zone: "play", controller: 0 });
    expect(Object.values(next.cards).find((card) => card.code === "wolf2")?.zone).toBe("encounterDiscard");
  });

  it("Tom Bombadil is committed to the quest under the chosen player: his Willpower counts against the Threat (22010:A:2)", () => {
    const { id, state } = revealed("22010", (base) => put(base, "wolf", "staging").state);
    const next = send(state, { type: "Choose", optionId: "seat:1" }, ctx);
    expect(next.cards[id]).toMatchObject({ zone: "play", controller: 1, owner: 0 });
    // Willpower 4 against the Threat of the wolf (1) and the orc the second player revealed (2): 1 progress on the current quest.
    expect(next.cards[next.questStage ?? ""]?.progress).toBe(1);
  });

  it("Tom Bombadil and Tom Bombadillo! in the victory display are removed from the game at the end of the round (22010:A:2)", () => {
    const { id, state } = revealed("22010", (base) => inVictory(base, "22005", ctx).state);
    let next = send(state, { type: "Choose", optionId: "seat:1" }, ctx);
    const bombadillo = Object.values(next.cards).find((card) => card.code === "22005")?.id ?? "";
    expect(next.cards[bombadillo]?.zone).toBe("victory");
    next = crossTo(crossTo(next, "End of round", ctx), "Beginning of round", ctx);
    expect(next.cards[id]?.zone).toBe("removed");
    expect(next.cards[bombadillo]?.zone).toBe("removed");
  });
});
