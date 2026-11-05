import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { legalIntents, reduce } from "../engine/reduce.ts";
import { blankScenario, updateCard, type ScenarioState } from "../core/state.ts";
import { spawn } from "../core/zones.ts";
import { resolveQuest } from "./quest.ts";

const heroCard = hero("aragorn", "leadership", 10, 4);
const quester = hero("sam", "leadership", 8, 1);

function stageCard(code: string, questPoints: number) {
  return definePrinted({ code, name: code, type: "quest", questPoints });
}

function atCommit(input: {
  willpower: number;
  threat: number;
  stages: readonly string[];
  stagePoints?: number;
  location?: { questPoints: number; threat: number; victory?: number };
  stagingThreat?: number;
  nextStage?: boolean;
  nextPoints?: number;
  laterPoints?: number;
}): { state: ScenarioState; cards: ReturnType<typeof cardMap> } {
  const stage = stageCard("stage-1", input.stagePoints ?? 10);
  const next = stageCard("stage-2", input.nextPoints ?? 4);
  const later = input.laterPoints == null ? null : stageCard("stage-3", input.laterPoints);
  const location = definePrinted({
    code: "road",
    name: "Road",
    type: "location",
    threat: input.location?.threat ?? 0,
    questPoints: input.location?.questPoints ?? 0,
    victory: input.location?.victory ?? null,
  });
  const enemy = definePrinted({
    code: "wolf",
    name: "Wolf",
    type: "enemy",
    threat: input.stagingThreat ?? 0,
    engagementCost: 50,
  });
  const printedHero = input.willpower === 4 ? heroCard : { ...quester, willpower: input.willpower };
  const cards = cardMap([printedHero, stage, next, location, enemy, ...(later ? [later] : [])]);
  const stageCodes = input.laterPoints != null
    ? ["stage-1", "stage-2", "stage-3"]
    : input.nextStage
      ? ["stage-1", "stage-2"]
      : ["stage-1"];
  let state = blankScenario({
    seatCount: 1,
    seed: 5,
    definition: fixtureDefinition(stageCodes),
  });
  const heroSpawn = spawn(state, printedHero.code, { zone: "heroes", seat: 0 });
  state = updateCard(heroSpawn.state, heroSpawn.id, { committed: true, exhausted: true });
  state = { ...state, seats: [{ ...state.seats[0], threat: input.threat }, state.seats[1]] };
  const stageSpawn = spawn(state, "stage-1", { zone: "questStage" }, "B");
  state = stageSpawn.state;
  if (input.nextStage || input.laterPoints != null) state = spawn(state, "stage-2", { zone: "questDeck" }, "A").state;
  if (input.laterPoints != null) state = spawn(state, "stage-3", { zone: "questDeck" }, "A").state;
  if (input.location) state = spawn(state, "road", { zone: "activeLocation" }).state;
  if ((input.stagingThreat ?? 0) > 0 || input.location) state = spawn(state, "wolf", { zone: "staging" }).state;
  state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 };
  return { state, cards };
}

describe("quest resolution", () => {
  it("puts progress on the active location before the quest and ignores that location's threat", () => {
    const { state, cards } = atCommit({
      willpower: 4,
      threat: 10,
      stages: ["stage-1"],
      location: { questPoints: 2, threat: 9 },
      stagingThreat: 1,
    });
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    const locationId = Object.values(resolved.state.cards).find((card) => card.code === "road")?.id ?? "";
    expect(resolved.state.cards[locationId]?.zone).toBe("encounterDiscard");
    expect(resolved.state.activeLocation).toBeNull();
    expect(resolved.state.cards[resolved.state.questStage ?? ""]?.progress).toBe(1);
    expect(resolved.state.seats[0].threat).toBe(10);
    expect(resolved.state.window?.kind).toBe("travel");
  });

  it("sends a victory location to the victory display", () => {
    const { state, cards } = atCommit({
      willpower: 4,
      threat: 10,
      stages: ["stage-1"],
      location: { questPoints: 2, threat: 9, victory: 3 },
      stagingThreat: 1,
    });
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(resolved.state.victory.map((id) => resolved.state.cards[id]?.code)).toEqual(["road"]);
  });

  function twoSeatShortfall(threats: readonly [number, number], eliminated = false) {
    const wolf = definePrinted({ code: "wolf", name: "Wolf", type: "enemy", threat: 4, engagementCost: 50 });
    const cards = cardMap([hero("aragorn", "leadership", 10, 1), hero("gimli", "leadership", 9, 1), wolf, stageCard("stage-1", 10)]);
    let state = blankScenario({ seatCount: 2, seed: 3, definition: fixtureDefinition(["stage-1"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "gimli", { zone: "heroes", seat: 1 }).state;
    state = spawn(state, "stage-1", { zone: "questStage" }, "B").state;
    state = spawn(state, "wolf", { zone: "staging" }).state;
    state = {
      ...state,
      seats: [
        { ...state.seats[0], threat: threats[0] },
        { ...state.seats[1], threat: threats[1], eliminated },
      ],
      phase: "Quest",
      mode: "questCommit",
      window: { kind: "pass" },
      activeSeat: 0,
      firstPlayer: 0,
    };
    return { state, ctx: { effects: [], cards } };
  }

  // rr.step-3-4: a tie is neither successful nor unsuccessful (user ruling, 2026-11-05); no one committed against threat above 0 is unsuccessful, against 0 threat a tie.
  it("hears an unsuccessful quest when nothing is committed against threat above 0, a successful one for more willpower, and neither for a tie", () => {
    const heard = (input: Parameters<typeof atCommit>[0], committed: boolean) => {
      const { state, cards } = atCommit(input);
      const ready = committed ? state : { ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, { ...card, committed: false }])) };
      return (resolveQuest(ready, cards, []).pendingEvents ?? []).map((event) => event.trigger).filter((trigger) => trigger === "questFailed" || trigger === "questSucceeded");
    };
    expect(heard({ willpower: 4, threat: 10, stages: ["stage-1"], stagingThreat: 5 }, false)).toEqual(["questFailed"]);
    expect(heard({ willpower: 4, threat: 10, stages: ["stage-1"] }, false)).toEqual([]);
    expect(heard({ willpower: 4, threat: 10, stages: ["stage-1"], stagingThreat: 4 }, true)).toEqual([]);
    expect(heard({ willpower: 4, threat: 10, stages: ["stage-1"], stagingThreat: 5 }, true)).toEqual(["questFailed"]);
    expect(heard({ willpower: 4, threat: 10, stages: ["stage-1"], stagingThreat: 3 }, true)).toEqual(["questSucceeded"]);
  });

  it("raises every player's threat by the shortfall", () => {
    const { state, ctx } = twoSeatShortfall([10, 20]);
    const first = expectOk(reduce(state, { type: "Pass" }, ctx));
    const resolved = expectOk(reduce(first.state, { type: "Pass" }, ctx));
    expect(resolved.state.seats[0]?.threat).toBe(14);
    expect(resolved.state.seats[1]?.threat).toBe(24);
    expect(resolved.steps.filter((step) => step.kind === "threat")).toEqual([
      expect.objectContaining({ kind: "threat", seat: 0, amount: 4 }),
      expect.objectContaining({ kind: "threat", seat: 1, amount: 4 }),
    ]);
  });

  it("lets the shortfall eliminate a seat that reaches 50 without raising an eliminated seat", () => {
    const near = twoSeatShortfall([10, 47]);
    const passed = expectOk(reduce(near.state, { type: "Pass" }, near.ctx));
    const resolved = expectOk(reduce(passed.state, { type: "Pass" }, near.ctx));
    expect(resolved.state.seats[0]?.threat).toBe(14);
    expect(resolved.state.seats[1]?.eliminated).toBe(true);

    const out = twoSeatShortfall([10, 30], true);
    const after = expectOk(reduce(out.state, { type: "Pass" }, out.ctx));
    expect(after.state.seats[0]?.threat).toBe(14);
    expect(after.state.seats[1]?.threat).toBe(30);
  });

  it("raises the lone player's threat by the shortfall", () => {
    const { state, cards } = atCommit({
      willpower: 1,
      threat: 10,
      stages: ["stage-1"],
      stagingThreat: 4,
    });
    const first = state.firstPlayer;
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(resolved.state.seats[first]?.threat).toBe(13);
    expect(resolved.state.cards[resolved.state.questStage ?? ""]?.progress ?? 0).toBe(0);
    expect(resolved.state.window?.kind).toBe("travel");
  });

  // rr.quest-advancement: "Additional progress tokens earned against the quest do not carry over to the next stage."
  it("advances to the next stage with no progress on it: the leftover does not carry over", () => {
    const { state, cards } = atCommit({
      willpower: 5,
      threat: 8,
      stages: ["stage-1", "stage-2"],
      stagePoints: 1,
      nextStage: true,
    });
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    const active = resolved.state.cards[resolved.state.questStage ?? ""];
    expect(resolved.state.stageCleared).toBe(false);
    expect(active?.code).toBe("stage-2");
    expect(active?.progress).toBe(0);
    expect(active?.face).toBe("B");
    expect(resolved.state.window?.kind).toBe("travel");
    const first = resolved.state.setAside.map((id) => resolved.state.cards[id]).find((card) => card?.code === "stage-1");
    expect(first?.progress).toBe(1);
    expect(resolved.state.seats[0].threat).toBe(8);
  });

  it("advances one stage only, even when the leftover would meet the stage after it", () => {
    const { state, cards } = atCommit({
      willpower: 5,
      threat: 8,
      stages: ["stage-1", "stage-2", "stage-3"],
      stagePoints: 1,
      nextStage: true,
      nextPoints: 2,
      laterPoints: 2,
    });
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    const active = resolved.state.cards[resolved.state.questStage ?? ""];
    expect(resolved.state.stageCleared).toBe(false);
    expect(active?.code).toBe("stage-2");
    expect(active?.progress).toBe(0);
    expect(resolved.state.questDeck.map((id) => resolved.state.cards[id]?.code)).toEqual(["stage-3"]);
    expect(resolved.state.lost).toBe(false);
    expect(resolved.state.seats[0].threat).toBe(8);
  });

  it("sets a stage-cleared flag when the last stage is met", () => {
    const { state, cards } = atCommit({ willpower: 5, threat: 8, stages: ["stage-1"], stagePoints: 1 });
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(resolved.state.stageCleared).toBe(true);
    expect(resolved.state.lost).toBe(false);
    expect(resolved.state.window).toBeNull();
    expect(resolved.state.resolution).toEqual([]);
    expect(resolved.state.seats[0].threat).toBe(8);
    expect(resolved.state.cards[resolved.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("clears the stage when the active quest is missing from the stage list", () => {
    const other = stageCard("other", 1);
    const listed = stageCard("stage-1", 4);
    const printedHero = { ...quester, willpower: 5 };
    const cards = cardMap([printedHero, other, listed]);
    let state = blankScenario({ seatCount: 1, seed: 5, definition: fixtureDefinition(["stage-1"]) });
    const heroSpawn = spawn(state, printedHero.code, { zone: "heroes", seat: 0 });
    state = updateCard(heroSpawn.state, heroSpawn.id, { committed: true, exhausted: true });
    const active = spawn(state, "other", { zone: "questStage" }, "B");
    state = active.state;
    const waiting = spawn(state, "stage-1", { zone: "questDeck" }, "A");
    state = {
      ...waiting.state,
      phase: "Quest",
      mode: "questCommit",
      window: { kind: "pass" },
      activeSeat: 0,
    };
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(resolved.state.stageCleared).toBe(true);
    expect(resolved.state.lost).toBe(false);
    expect(resolved.state.questStage).toBe(active.id);
    expect(resolved.state.cards[active.id]?.code).toBe("other");
    expect(resolved.state.cards[active.id]?.progress).toBe(1);
    expect(resolved.state.questDeck).toContain(waiting.id);
    expect(resolved.state.cards[waiting.id]?.zone).toBe("questDeck");
  });

  it("does not count willpower from a seat eliminated during staging", () => {
    const doomed = definePrinted({
      code: "doom",
      name: "Doom",
      type: "treachery",
      threat: 1,
      keywords: { doomed: 1 },
    });
    const strong = definePrinted({
      code: "sam",
      name: "sam",
      type: "hero",
      sphere: "leadership",
      threat: 8,
      willpower: 5,
      attack: 1,
      defense: 1,
      health: 5,
    });
    const quiet = hero("aragorn", "leadership", 10, 1);
    const cards = cardMap([doomed, strong, quiet, stageCard("stage-1", 10)]);
    let state = blankScenario({ seatCount: 2, seed: 3, definition: fixtureDefinition(["stage-1"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    const committed = spawn(state, "sam", { zone: "heroes", seat: 1 });
    state = updateCard(committed.state, committed.id, { committed: true, exhausted: true });
    state = {
      ...state,
      seats: [
        { ...state.seats[0], threat: 10 },
        { ...state.seats[1], threat: 49 },
      ],
    };
    state = spawn(state, "stage-1", { zone: "questStage" }, "B").state;
    state = spawn(state, "doom", { zone: "encounterDeck" }).state;
    state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const ctx = { effects: [], cards };
    const first = expectOk(reduce(state, { type: "Pass" }, ctx));
    const resolved = expectOk(reduce(first.state, { type: "Pass" }, ctx));
    expect(resolved.state.seats[1]?.eliminated).toBe(true);
    expect(resolved.state.cards[resolved.state.questStage ?? ""]?.progress ?? 0).toBe(0);
    // Doomed 1 raises seat 0 to 11. The treachery was discarded after it resolved (ltp.revealed-treachery), so it adds no
    // threat to the staging area, and seat 1's 5 willpower no longer counts: no progress and no shortfall.
    expect(resolved.state.seats[0]?.threat).toBe(11);
  });

  it("does not let a seat eliminated during staging travel", () => {
    const doomed = definePrinted({
      code: "doom",
      name: "Doom",
      type: "treachery",
      threat: 0,
      keywords: { doomed: 1 },
    });
    const road = definePrinted({ code: "road", name: "Road", type: "location", threat: 0, questPoints: 2 });
    const cards = cardMap([doomed, road, stageCard("stage-1", 8), hero("aragorn", "leadership"), hero("gimli", "tactics")]);
    let state = blankScenario({ seatCount: 2, seed: 7, definition: fixtureDefinition(["stage-1"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "gimli", { zone: "heroes", seat: 1 }).state;
    state = {
      ...state,
      seats: [
        { ...state.seats[0], threat: 49 },
        { ...state.seats[1], threat: 10 },
      ],
    };
    state = spawn(state, "stage-1", { zone: "questStage" }, "B").state;
    const location = spawn(state, "road", { zone: "staging" });
    state = location.state;
    state = spawn(state, "doom", { zone: "encounterDeck" }).state;
    state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const ctx = { effects: [], cards };
    const first = expectOk(reduce(state, { type: "Pass" }, ctx));
    const opened = expectOk(reduce(first.state, { type: "Pass" }, ctx));
    expect(opened.state.seats[0]?.eliminated).toBe(true);
    expect(opened.state.seats[1]?.eliminated).toBe(false);
    expect(opened.state.lost).toBe(false);
    expect(opened.state.activeSeat).toBe(1);
    expect(opened.state.window?.kind).toBe("travel");
    expect(legalIntents(opened.state, ctx).map((intent) => intent.type)).toContain("Travel");
    const stuck = { ...opened.state, activeSeat: 0 };
    expect(legalIntents(stuck, ctx)).toEqual([]);
    const refused = reduce(stuck, { type: "Travel", locationId: location.id }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe("That seat is eliminated");
      expect(refused.state).toBe(stuck);
      expect(refused.state.activeLocation).toBeNull();
    }
  });

  it("opens no player window when staging eliminates every seat", () => {
    const doomed = definePrinted({
      code: "doom",
      name: "Doom",
      type: "treachery",
      threat: 0,
      keywords: { doomed: 1 },
    });
    const road = definePrinted({ code: "road", name: "Road", type: "location", threat: 0, questPoints: 2 });
    const cards = cardMap([doomed, road, stageCard("stage-1", 8), hero("aragorn", "leadership"), hero("gimli", "tactics")]);
    let state = blankScenario({ seatCount: 2, seed: 7, definition: fixtureDefinition(["stage-1"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "gimli", { zone: "heroes", seat: 1 }).state;
    state = {
      ...state,
      seats: [
        { ...state.seats[0], threat: 49 },
        { ...state.seats[1], threat: 49 },
      ],
    };
    state = spawn(state, "stage-1", { zone: "questStage" }, "B").state;
    const location = spawn(state, "road", { zone: "staging" });
    state = location.state;
    state = spawn(state, "doom", { zone: "encounterDeck" }).state;
    state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const ctx = { effects: [], cards };
    const first = expectOk(reduce(state, { type: "Pass" }, ctx));
    const opened = expectOk(reduce(first.state, { type: "Pass" }, ctx));
    expect(opened.state.seats[0]?.eliminated).toBe(true);
    expect(opened.state.seats[1]?.eliminated).toBe(true);
    expect(opened.state.lost).toBe(true);
    expect(opened.state.window).toBeNull();
    expect(opened.state.activeLocation).toBeNull();
    expect(legalIntents(opened.state, ctx)).toEqual([]);
    const refused = reduce(opened.state, { type: "Travel", locationId: location.id }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe("The game is lost");
      expect(refused.state).toBe(opened.state);
    }
  });
});
