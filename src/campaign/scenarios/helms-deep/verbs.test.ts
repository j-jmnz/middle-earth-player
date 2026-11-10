// Rules: mec112.defense, mec112.poisoned-counsels-searching-eye, rr.lasting-effects, rr.blank, rr.neutral-cards, rr.first-player, rr.the-word-choose (data/rules/entries.json); ledger lines 143021:A:1, 143037:A:1, 143040:A:2, 143041:A:1, 143042:A:3, 143043:A:1,
// 143072:A:1, 143072:B:1, 143072:B:2, 143073:B:1, 143073:B:2, 143074:B:2, 143076:B:1. What a card-spec row cannot see on Helm's Deep's own cards: the archery total, a bar on every character, the Traits a blank text box keeps, a Setup choice, an ally of a
// sphere, a flag the table holds, and the negative cases (a row that still passes without its records fails). Each test title starts with the line it covers (scripts/checks/spec-coverage.test.ts). The fortress and burden families' own tests are
// src/rules/families/fortress/index.test.ts and src/rules/families/burden/player-deck.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { archeryTotal, canAttack } from "../../../rules/combat/combat.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { hasKeyword } from "../../../rules/core/keywords.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalIntents, reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { textBlank } from "../../../rules/families/attachments/hold.ts";
import { encounterStart, encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { announce, attack, damageOn, defend, deckCount, progressOn, quest, rowProblems, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { allyCard, finish, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "helms-deep";
const held = (row: Row): string[] => rowProblems(ID, row, EFFECTS);
const STAGE_2 = { stage: "143073" } as const;

describe("a card that functions like a player card", () => {
  it("143021:A:1 Poisoned Counsels is held in a hand, discarded from it, and never offered to be played", () => {
    const table = tableFromLayout(ID, { phase: "Planning", hand: ["143021", "filler"] });
    const id = idOf(table.state, "143021");
    expect(table.state.seats[0]?.hand).toContain(id);
    const offered = legalIntents({ ...table.state, window: { kind: "pass" } }, table.ctx);
    expect(offered.some((intent) => intent.type === "PlayCard" && "cardId" in intent && intent.cardId === id)).toBe(false);
    expect(offered.some((intent) => intent.type === "PlayCard" && "cardId" in intent && intent.cardId === idOf(table.state, "filler"))).toBe(true);
  });
});

describe("the archery total", () => {
  // Soldier of Isengard and Warrior of Dunland each print Archery 1.
  const total = (layout: Layout): number => {
    const table = tableFromLayout(ID, { ...STAGE_2, staging: ["143036", "143035"], ...layout });
    return archeryTotal(table.state, table.cards);
  };
  it("143037:A:1 is 1 lower for each player while The Hornburg is the active location, and never below 0", () => {
    expect(total({ active: "143038" })).toBe(2);
    expect(total({ active: "143037" })).toBe(1);
    expect(total({ active: "143037", seats: 2 })).toBe(0);
    expect(total({ active: "143037", staging: ["143036"] })).toBe(0);
  });
});

describe("Postern Door bars the attacks", () => {
  it("143040:A:2 lets no character attack once it is explored, and lets one before", () => {
    const layout: Layout = { ...STAGE_2, staging: ["143040"], engaged: ["f3"] };
    const can = (done: ReturnType<typeof play>) => canAttack(done.run.state, 0, idOf(done.run.state, "dh1"), idOf(done.run.state, "f3"), done.table.cards);
    expect(can(play(ID, { line: "143040:A:2", layout, act: [], expect: [] }, EFFECTS, false))).toBe(true);
    expect(can(play(ID, { line: "143040:A:2", layout, act: announce("leftPlay", "143040", { explored: true }), expect: [] }, EFFECTS, false))).toBe(false);
  });
});

describe("Devilry of Saruman blanks the text box and keeps the Traits", () => {
  it("143043:A:1 leaves an ally its Traits and takes its keywords and records, one that enters play later too", () => {
    const table = tableFromLayout(ID, { ...STAGE_2 });
    const cards = new Map(table.cards);
    cards.set("t-guard", definePrinted({ code: "t-guard", name: "t-guard", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"], keywords: { sentinel: true } }));
    const ctx = { ...table.ctx, cards };
    const first = spawn(table.state, "t-guard", { zone: "play", seat: 0 });
    expect(hasKeyword(first.state, first.id, "sentinel", cards)).toBe(true);
    const done = resolveRecords(syncConstants(first.state, ctx), ctx, "143043", "whenRevealed");
    const later = spawn(done.state, "t-guard", { zone: "play", seat: 0 });
    for (const [state, id] of [[done.state, first.id], [later.state, later.id]] as const) {
      expect(textBlank(state, id, cards)).toBe(true);
      expect(hasKeyword(state, id, "sentinel", cards)).toBe(false);
      expect(hasTrait(state, id, "Dwarf", ctx)).toBe(true);
    }
  });
});

describe("the negative cases", () => {
  it("143041:A:1 reveals nothing while every player is engaged with an enemy", () => {
    const row: Row = { line: "143041:A:1", layout: { active: "143041", engaged: ["f0"], deck: ["f3"] }, act: announce("stagingStepEnds", undefined, { seat: null }), expect: [zone("f3", "encounterDeck"), deckCount(1)] };
    expect(held(row)).toEqual([]);
  });

  it("143041:A:1 reveals nothing while it is not the active location", () => {
    const row: Row = { line: "143041:A:1", layout: { staging: ["143041"], deck: ["f3"] }, act: announce("stagingStepEnds", undefined, { seat: null }), expect: [zone("f3", "encounterDeck")] };
    expect(held(row)).toEqual([]);
  });

  it("143042:A:3 places no progress when the attack destroys no character", () => {
    const row: Row = { line: "143042:A:3", layout: { ...STAGE_2, active: "143038", play: ["ally"] }, act: [attack("f3", { shadow: "143042" }), defend("ally")], expect: [progressOn("143038", 0), progressOn("143073", 0), damageOn("ally", 1)] };
    expect(held(row)).toEqual([]);
  });

  it("143073:B:1 places nothing when the players quest successfully", () => {
    const row: Row = { line: "143073:B:1", layout: { ...STAGE_2, active: "143038", staging: ["f0"] }, act: quest("success"), expect: [progressOn("143038", 0), progressOn("143073", 0), threat(28)] };
    expect(held(row)).toEqual([]);
  });

  it("143073:B:2 reveals nothing when as many enemies as players are staged", () => {
    const row: Row = { line: "143073:B:2", layout: { ...STAGE_2, staging: ["f0"], deck: ["f3"] }, act: announce("endOfPhase", undefined, { seat: null, phase: "Combat" }), expect: [zone("f3", "encounterDeck")] };
    expect(held(row)).toEqual([]);
  });

  it("143074:B:2 reveals nothing when the encounter deck placed progress on the stage by questing", () => {
    // The Threat 6 beats the Willpower 4 with no active location: the 2 progress go on the stage.
    const row: Row = { line: "143074:B:2", layout: { stage: "143074", staging: ["f3", "f3"], deck: ["f0", "f0", "f3"] }, act: quest("fail"), expect: [progressOn("143074", 2), deckCount(2), stat("143074", "questPoints", 8)] };
    expect(held(row)).toEqual([]);
  });

  it("143074:B:2 reveals nothing either when the active location takes all of it", () => {
    const row: Row = { line: "143074:B:2", layout: { stage: "143074", active: "143038", staging: ["f3", "f3"], deck: ["f0", "f0", "f3"] }, act: quest("fail"), expect: [progressOn("143074", 0), progressOn("143038", 2)] };
    // The location absorbs the 2: nothing is placed on the stage, so the first player reveals 1 card: the deck loses a second card.
    expect(held({ ...row, expect: [progressOn("143074", 0), progressOn("143038", 2), deckCount(1)] })).toEqual([]);
  });
});

describe("the Setup choice and the first quest stage", () => {
  let world: EncounterWorld;
  beforeAll(async () => {
    world = await encounterWorld(ID);
  });
  const ctxOf = () => world.contexts.strong;
  const copies = (state: ScenarioState, seat: number) => (state.seats[seat]?.deck ?? []).filter((id) => state.cards[id]?.code === "143021").length;
  // The game from the start, the opening hands kept, the first player at the Setup choice.
  function atChoice(seats: 1 | 2, ctx = ctxOf()): ScenarioState {
    let state = startScenario(encounterStart(world, seats, 3), ctx);
    for (let guard = 0; guard < 6 && state.window?.kind !== "choose"; guard += 1) state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    return state;
  }

  it("143072:A:1 is asked of the first player once the hands are drawn: shuffling puts 1 Poisoned Counsels into each deck and the first stage stays", () => {
    const state = atChoice(2);
    expect(state.window?.kind).toBe("choose");
    const options = legalIntents(state, ctxOf());
    expect(options).toHaveLength(2);
    const done = expectOk(reduce(state, options[0] as never, ctxOf())).state;
    expect([copies(done, 0), copies(done, 1)]).toEqual([1, 1]);
    expect(done.cards[done.questStage ?? ""]?.code).toBe("143072");
    for (const seat of done.seats) expect(seat.hand.some((id) => done.cards[id]?.code === "143021")).toBe(false);
  });

  it("143072:A:1 advancing to stage 2A leaves the decks alone and skips stage 1B's When Revealed", () => {
    const state = atChoice(1);
    const options = legalIntents(state, ctxOf());
    const done = expectOk(reduce(state, options[1] as never, ctxOf())).state;
    expect(copies(done, 0)).toBe(0);
    expect(done.cards[done.questStage ?? ""]?.code).toBe("143073");
  });

  it("143072:B:1 each player puts an ally of a hero's sphere from their hand into play, and no other ally", () => {
    const cards = new Map(ctxOf().cards);
    const ally = (code: string, sphere: "tactics" | "spirit") => cards.set(code, definePrinted({ code, name: code, type: "ally", sphere, cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
    ally("t-tactics", "tactics");
    ally("t-spirit", "spirit");
    cards.set("t-neutral", allyCard("t-neutral", 1));
    const ctx = { ...ctxOf(), cards };
    let state = startScenario(encounterStart(world, 1, 3), ctx);
    for (const code of ["t-neutral", "t-spirit", "t-tactics"]) state = spawn(state, code, { zone: "hand", seat: 0 }).state;
    for (let guard = 0; guard < 6 && state.window?.kind !== "choose"; guard += 1) state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    state = finish({ state: expectOk(reduce(state, legalIntents(state, ctx)[0] as never, ctx)).state, steps: [] }, ctx).state;
    const inPlay = Object.values(state.cards).filter((card) => card.zone === "play" && card.controller === 0).map((card) => card.code);
    expect(inPlay).toContain("t-tactics");
    expect(inPlay).not.toContain("t-neutral");
    expect(inPlay).not.toContain("t-spirit");
  });

  it("143072:B:2 skips the quest phase and the combat phase", () => {
    const table = tableFromLayout(ID, {});
    expect(table.state.cards[table.state.questStage ?? ""]?.code).toBe("143072");
    expect(flagged(table.state, "table", "skipQuestPhase")).toBe(true);
    expect(flagged(table.state, "table", "skipCombat")).toBe(true);
    const later = tableFromLayout(ID, { stage: "143073" });
    expect(flagged(later.state, "table", "skipQuestPhase")).toBe(false);
    expect(flagged(later.state, "table", "skipCombat")).toBe(false);
  });

  it("143076:B:1 skips the quest phase and bars every player from reducing their threat", () => {
    const table = tableFromLayout(ID, { stage: "143076", seats: 2 });
    expect(flagged(table.state, "table", "skipQuestPhase")).toBe(true);
    expect(table.state.modifiers.filter((modifier) => modifier.stat === "noThreatReduction")).toHaveLength(2);
    expect(tableFromLayout(ID, { ...STAGE_2 }).state.modifiers.some((modifier) => modifier.stat === "noThreatReduction")).toBe(false);
  });
});
