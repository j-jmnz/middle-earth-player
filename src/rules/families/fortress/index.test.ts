// Rules: mec112.defense, rr.active-location, rr.lasting-effects, rr.step-3-4 (data/rules/entries.json); ledger lines 143073:B:1, 143074:B:2, 143075:B:3, 143033:A:1, 143033:A:2, 143033:A:3,
// 143045:A:2, 143040:A:2, 143043:A:1, 143041:A:2, 143043:A:2, 143039:A:1. The fortress family and the Helm's Deep records on a table of the scenario's stage 2B.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { familyAttackReason, familyQuestResult, withFamilies } from "../../interpret/family-hooks.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { committedWillpower, questPointsOf, resolveQuest, stagingThreat } from "../../quest/quest.ts";
import { textBlank } from "../attachments/hold.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { allyCard, idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { RULES_FAMILIES } from "../index.ts";
import { manifest } from "./index.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;
const cardsOf = () => ctxOf().cards;
const open = () => true;

beforeAll(async () => {
  world = await encounterWorld("helms-deep");
  table = probeTable(world);
});

const run = (state: ScenarioState, instruction: Parameters<typeof runInstruction>[1], steps: EngineStep[] = []) => runInstruction(state, instruction, { seat: 0, sourceId: null }, ctxOf(), steps);
// A copy of the card that is in the staging area (the others are in the encounter deck).
const staged = (state: ScenarioState, code: string): string => state.staging.find((id) => state.cards[id]?.code === code) ?? "";
const stageOf = (state: ScenarioState) => state.cards[state.questStage ?? ""];
const threatOf = (state: ScenarioState) => state.seats[0]?.threat;

describe("143073:B:1 the Defense keyword", () => {
  it("stage 2B holds the flag and the table stands at stage 2B after the bypass", () => {
    expect(stageOf(table)?.code).toBe("143073");
    expect(syncConstants(table, ctxOf()).modifiers.some((modifier) => modifier.stat === "defenseKeyword" && modifier.instanceId === table.questStage)).toBe(true);
  });

  it("raises nobody's threat when the Threat beats the Willpower: the difference becomes progress through the active location first", () => {
    const threat = stagingThreat(table, cardsOf());
    const willpower = committedWillpower(table, cardsOf());
    expect(threat).toBeGreaterThan(willpower);
    const location = table.activeLocation ?? "";
    const points = questPointsOf(table, table.cards[location]!, cardsOf()) ?? 0;
    const after = resolveQuest(table, cardsOf(), [], open);
    expect(threatOf(after)).toBe(threatOf(table));
    const difference = threat - willpower;
    expect((after.cards[location]?.progress ?? 0) + (stageOf(after)?.progress ?? 0)).toBe(Math.min(difference, points) + Math.max(0, difference - points));
    expect(after.cards[location]?.progress ?? 0).toBeLessThanOrEqual(points);
  });

  it("places nothing on a tie or when the players quest successfully", () => {
    const tie = familyQuestResult(table, { willpower: 5, threat: 5 }, cardsOf(), [], open);
    const win = familyQuestResult(table, { willpower: 9, threat: 5 }, cardsOf(), [], open);
    for (const result of [tie, win]) {
      expect(result).not.toBeNull();
      expect(stageOf(result!)?.progress).toBe(0);
      expect(result!.cards[table.activeLocation ?? ""]?.progress).toBe(0);
      expect(threatOf(result!)).toBe(threatOf(table));
    }
  });

  it("leaves the resolution to the core on a stage without the keyword: the threat rises by the shortfall", () => {
    const plain = { ...table, modifiers: table.modifiers.filter((modifier) => modifier.stat !== "defenseKeyword") };
    expect(familyQuestResult(plain, { willpower: 1, threat: 4 }, cardsOf(), [], open)).toBeNull();
    const after = resolveQuest(plain, cardsOf(), [], open);
    expect(threatOf(after)).toBeGreaterThan(threatOf(plain) ?? 0);
  });

  it("is a hook the core calls, not a call by name: a list without the fortress family resolves the quest as the core does", () => {
    const others = RULES_FAMILIES.filter((family) => family !== manifest && family.name !== "fortress");
    const after = withFamilies(others, () => resolveQuest(table, cardsOf(), [], open));
    expect(threatOf(after)).toBeGreaterThan(threatOf(table) ?? 0);
  });
});

describe("143074:B:2 the encounter deck placed progress on this stage", () => {
  it("is false while the active location takes it all, and true once progress reaches the stage", () => {
    const location = table.activeLocation ?? "";
    const full = { ...table, cards: { ...table.cards, [location]: { ...table.cards[location]!, progress: 0 } } };
    // A location that takes at most its quest points: a Threat of 1 stays on it.
    const absorbed = familyQuestResult(full, { willpower: 0, threat: 1 }, cardsOf(), [], open)!;
    expect(absorbed.defensePlaced).toBe(false);
    expect(holds(absorbed, { kind: "encounterPlacedOnStage" }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(false);
    const bare = { ...table, activeLocation: null };
    const onStage = familyQuestResult(bare, { willpower: 0, threat: 2 }, cardsOf(), [], open)!;
    expect(onStage.defensePlaced).toBe(true);
    expect(holds(onStage, { kind: "encounterPlacedOnStage" }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
  });

  it("is announced to the stage once the quest resolved, and the first player reveals when none was placed", () => {
    const after = familyQuestResult(table, { willpower: 9, threat: 5 }, cardsOf(), [], open)!;
    expect((after.pendingEvents ?? []).some((event) => event.trigger === "defenseQuestResolved" && event.subject === table.questStage)).toBe(true);
    const hosts = resolveRecords({ ...after, defensePlaced: false, phase: "Quest" }, ctxOf(), "143074", "forced", undefined, undefined, false);
    expect(hosts.id).toBeTruthy();
  });
});

describe("143075:B:3 the stage the encounter deck defeats loses the game", () => {
  it("a defeated stage 4B loses, whoever placed the last progress", () => {
    const steps: EngineStep[] = [];
    let state = run(table, { verb: "AdvanceToStage", code: "143075" }, steps);
    expect(stageOf(state)?.code).toBe("143075");
    state = run(state, { verb: "AddStageProgress", amount: 99 }, steps);
    state = settle({ ...state, window: null }, ctxOf(), steps);
    expect(state.lost).toBe(true);
  });
});

describe("143045:A:2 Night Without End", () => {
  const defense = () => idOf(table, "143033");
  it("asks only while a token can be removed, and removes one", () => {
    const asked: string[][] = [];
    const withTokens = updateCard(table, defense(), { resources: 3 });
    const pick = (state: ScenarioState): string => {
      asked.push(state.window?.kind === "choose" ? [...state.window.options] : []);
      return "remove";
    };
    const removed = resolveRecords(withTokens, ctxOf(), "143045", "whenRevealed", undefined, pick);
    expect(asked.length).toBeGreaterThan(0);
    expect(removed.state.cards[defense()]?.resources).toBe(2);
  });

  it("asks nothing with no token: the revealer reveals 2 encounter cards", () => {
    const asked: string[] = [];
    const none = resolveRecords(table, ctxOf(), "143045", "whenRevealed", undefined, (state) => {
      asked.push(state.window?.kind ?? "");
      return "reveal";
    });
    expect(asked).toEqual([]);
    expect(none.state.cards[defenseId(table)]?.resources).toBe(0);
  });

  it("RemoveResourceTokens takes no more than the card holds and nothing from a card not in play", () => {
    const held = updateCard(table, defense(), { resources: 2 });
    expect(run(held, { verb: "RemoveResourceTokens", code: "143033", amount: 1 }).cards[defense()]?.resources).toBe(1);
    expect(run(held, { verb: "RemoveResourceTokens", code: "143033", amount: 5 }).cards[defense()]?.resources).toBe(0);
    expect(run(held, { verb: "RemoveResourceTokens", code: "143040", amount: 5 })).toBe(held);
  });
});

const defenseId = (state: ScenarioState): string => idOf(state, "143033");

describe("143033 The Defense of Helm's Deep", () => {
  it("143033:A:1 adds its tokens to the total Threat in the staging area, read live", () => {
    const before = stagingThreat(syncConstants(table, ctxOf()), cardsOf());
    const held = syncConstants(updateCard(table, defenseId(table), { resources: 3 }), ctxOf());
    expect(stagingThreat(held, cardsOf())).toBe(before + 3);
  });

  it("143033:A:2 places a token at the end of the quest phase", () => {
    const done = resolveRecords({ ...table, phase: "Quest" }, ctxOf(), "143033", "forced", defenseId(table));
    expect(done.state.cards[defenseId(table)]?.resources).toBe(1);
  });

  it("143033:A:3 with 8 tokens goes to the victory display and the players advance to stage 5A from any stage", () => {
    const seven = updateCard(table, defenseId(table), { resources: 7 });
    const done = resolveRecords({ ...seven, phase: "Quest" }, ctxOf(), "143033", "forced", defenseId(table));
    expect(done.state.victory).toContain(defenseId(table));
    expect(stageOf(done.state)?.code).toBe("143076");
    const fewer = resolveRecords({ ...updateCard(table, defenseId(table), { resources: 5 }), phase: "Quest" }, ctxOf(), "143033", "forced", defenseId(table));
    expect(fewer.state.victory).not.toContain(defenseId(table));
    expect(stageOf(fewer.state)?.code).toBe("143073");
  });
});

describe("143040:A:2 Postern Door", () => {
  it("bars every attacker for the round, characters that enter play later included, and the bar ends with the round", () => {
    const door = spawn(table, "143040", { zone: "staging" });
    // The record hears "explored" (subjectExplored): its instruction runs with the Door as the source.
    const record = ctxOf().effects.find((effect) => effect.id === "143040:forced:1")!;
    let done = { state: door.state };
    for (const instruction of record.instructions) done = { state: runInstruction(done.state, instruction, { seat: 0, sourceId: door.id }, ctxOf(), []) };
    const enemy = staged(table, "143036");
    const later = spawn(done.state, "q1", { zone: "heroes", seat: 0 });
    const reason = familyAttackReason(later.state, enemy, printedOf(cardsOf(), "q1"), printedOf(cardsOf(), "143036"), later.id);
    expect(reason).not.toBeNull();
    const over = { ...later.state, modifiers: later.state.modifiers.filter((modifier) => modifier.stat !== "cannotDeclareAttacks") };
    expect(familyAttackReason(over, enemy, printedOf(cardsOf(), "q1"), printedOf(cardsOf(), "143036"), later.id)).toBeNull();
  });
});

describe("143043:A:1 Devilry of Saruman", () => {
  it("blanks the text box of each character, one that enters play later too, and places 3 progress bypassing the active location", () => {
    const stage = stageOf(table)!;
    const done = resolveRecords(table, ctxOf(), "143043", "whenRevealed");
    const later = spawn(done.state, "q1", { zone: "heroes", seat: 0 });
    expect(textBlank(later.state, later.id, cardsOf())).toBe(true);
    expect(textBlank(done.state, staged(done.state, "143036"), cardsOf())).toBe(false);
    expect(done.state.cards[stage.id]?.progress ?? 0).toBe(Math.min(3, (questPointsOf(table, stage, cardsOf()) ?? 3)));
    expect(done.state.cards[table.activeLocation ?? ""]?.progress).toBe(0);
  });
});

describe("143041:A:2 Helm's Gate", () => {
  it("gives each enemy -20 engagement cost and +2 Attack for the round, an enemy that enters play later too", () => {
    const gate = spawn(table, "143041", { zone: "staging" });
    const record = ctxOf().effects.find((effect) => effect.id === "143041:forced:2")!;
    let done = { state: gate.state };
    for (const instruction of record.instructions) done = { state: runInstruction(done.state, instruction, { seat: 0, sourceId: gate.id }, ctxOf(), []) };
    const later = spawn(done.state, "143036", { zone: "staging" });
    const soldier = later.state.cards[later.id]!;
    expect(done.state.modifiers.some((modifier) => modifier.stat === "attack" && modifier.instanceId === "enemies")).toBe(true);
    expect(modifiedStat(later.state, soldier, "attack", cardsOf())).toBe((printedOf(cardsOf(), "143036").attack ?? 0) + 2);
    expect(modifiedStat(later.state, soldier, "engagementCost", cardsOf())).toBe((printedOf(cardsOf(), "143036").engagementCost ?? 0) - 20);
  });
});

describe("143043:A:2 Devilry of Saruman's Shadow", () => {
  it("gives the attacking enemy Toughness 2 until the end of the round: each instance of damage is 2 lower", () => {
    const soldier = staged(table, "143036");
    const plain = placeDamage(table, soldier, 5, cardsOf(), [], "combat", { effect: "test" } as never);
    const toughened = placeDamage({ ...table, modifiers: [...table.modifiers, { instanceId: soldier, sourceId: soldier, stat: "toughness", amount: 2, until: "endOfRound" }] }, soldier, 5, cardsOf(), [], "combat", { effect: "test" } as never);
    const had = printedOf(cardsOf(), "143036").keywords.toughness ?? 0;
    expect(plain.cards[soldier]?.damage).toBe(5 - had);
    expect(toughened.cards[soldier]?.damage).toBe(5 - had - 2);
  });
});

describe("143039:A:1 Deeping Culvert", () => {
  const culvert = (allies: number) => {
    const cards = new Map(cardsOf());
    cards.set("t-ally", allyCard("t-ally", 1));
    const ctx = { ...ctxOf(), cards };
    const placed = spawn(table, "143039", { zone: "staging" });
    let current = placed.state;
    for (let count = 0; count < allies; count += 1) current = spawn(current, "t-ally", { zone: "play", seat: 0 }).state;
    const synced = syncConstants(current, ctx);
    return modifiedStat(synced, synced.cards[placed.id]!, "threat", cards);
  };
  it("has the Threat 1 with no ally and 3 with two, never 0", () => {
    expect(culvert(0)).toBe(1);
    expect(culvert(2)).toBe(3);
  });
});
