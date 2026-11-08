// Rules: rr.player-elimination, rr.ownership-and-control, mec112.permanent (data/rules/entries.json); ledger lines 143022:A:1, 143024:A:1, 143024:A:2, 143069:A:1. The captives family's verbs on a table of The Uruk-hai.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { constantWin, syncConstants } from "../../interpret/constants.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { settle } from "../../engine/machine.ts";
import { eliminateEmpties } from "../../core/keywords.ts";
import { textBlank } from "../attachments/hold.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";
import { captivesOf } from "./values.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("the-uruk-hai");
  table = probeTable(world);
});

const run = (state: ScenarioState, instruction: Parameters<typeof runInstruction>[1], sourceId: string | null = null) => runInstruction(state, instruction, { seat: 0, sourceId }, ctxOf(), [] as EngineStep[]);

describe("the Captive chosen at Setup (143069:A:1)", () => {
  it("lies faceup under To Isengard!, in play, controlled by nobody and out of its owner's heroes", () => {
    const [captive] = captivesOf(table);
    expect(captivesOf(table)).toHaveLength(1);
    expect(captive?.zone).toBe("captive");
    expect(captive?.host).toBe(idOf(table, "143022"));
    expect(captive?.face).toBe("up");
    expect(captive?.controller).toBeNull();
    expect(captive?.owner).toBe(0);
    expect(table.seats[0].heroes).not.toContain(captive?.id);
    // Not a Fellowship hero: the Ring-bearer stays a hero.
    expect(table.seats[0].heroes.some((id) => table.cards[id]?.code === "141001")).toBe(true);
  });

  it("is blank under To Isengard!'s constant, picked only by a filter that asks for it, and not found by 'you control'", () => {
    const state = syncConstants(table, ctxOf());
    const [captive] = captivesOf(state);
    expect(textBlank(state, captive?.id ?? "")).toBe(true);
    expect(pickCandidates(state, { type: "hero", control: "any", captive: "only" }, 0, [], null, ctxOf())).toEqual([captive?.id]);
    expect(pickCandidates(state, { type: "hero", control: "any", captive: "include" }, 0, [], null, ctxOf())).toContain(captive?.id);
    expect(pickCandidates(state, { type: "hero", control: "any" }, 0, [], null, ctxOf())).not.toContain(captive?.id);
    expect(pickCandidates(state, { type: "hero", control: "any", captive: "free" }, 0, [], null, ctxOf())).toEqual([captive?.id]);
    expect(pickCandidates(state, { type: "hero", control: "you", captive: "include" }, 0, [], null, ctxOf())).not.toContain(captive?.id);
  });

  it("keeps its owner in the game when it is the only hero left (rr.player-elimination: a held hero is not killed)", () => {
    const alone: ScenarioState = { ...table, seats: [{ ...table.seats[0], heroes: [] }, table.seats[1]] };
    expect(eliminateEmpties(alone, []).seats[0].eliminated).not.toBe(true);
    const gone = eliminateEmpties({ ...alone, cards: Object.fromEntries(Object.entries(alone.cards).map(([id, card]) => [id, card.captive ? { ...card, captive: undefined } : card])) }, []);
    expect(gone.seats[0].eliminated).toBe(true);
  });

  it("is counted by the condition: any, or the acting seat's own", () => {
    expect(holds(table, { kind: "captives", min: 1 }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
    expect(holds(table, { kind: "captives", max: 0, of: "actor" }, { actor: 0, sourceId: null, returned: 0 }, ctxOf())).toBe(false);
    expect(holds(table, { kind: "captives", max: 0, of: "actor" }, { actor: 1, sourceId: null, returned: 0 }, ctxOf())).toBe(true);
  });
});

describe("TakeLoggedCaptives", () => {
  it("takes the hero the Campaign Log names for the seat, and nobody else", () => {
    const logged = table.seats[0].heroes.map((id) => table.cards[id]).find((card) => card?.code === "q2");
    const fresh = { ...table, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, heroLog: { heroes: [], fallen: [], fellowship: [], captives: [{ seat: 0, hero: "q2" }] } } };
    const first = captivesOf(fresh).map((card) => card.id);
    const next = run(fresh, { verb: "TakeLoggedCaptives", under: "143022" });
    expect(logged).toBeDefined();
    expect(captivesOf(next).map((card) => card.id).sort()).toEqual([...first, logged?.id ?? ""].sort());
  });

  it("does nothing for a log with no captive", () => {
    expect(run(table, { verb: "TakeLoggedCaptives", under: "143022" })).toBe(table);
  });
});

describe("a Captive held by Grishnákh (143024)", () => {
  it("is attached to him, damaged, and returns under To Isengard! when he is gone", () => {
    const grishnakh = idOf({ ...table, cards: table.cards }, "143023");
    const [captive] = captivesOf(table);
    const held = run({ ...table, window: null }, { verb: "HoldCaptive" }, grishnakh);
    // No picked card: nothing is held.
    expect(captivesOf(held)[0]?.host).toBe(idOf(table, "143022"));
    const direct = updateCard(table, captive?.id ?? "", { host: grishnakh });
    const damaged = run(direct, { verb: "DamageHeldCaptive", amount: 1 }, grishnakh);
    expect(damaged.cards[captive?.id ?? ""]?.damage).toBe(1);
    const back = run(damaged, { verb: "ReturnCaptive", under: "143022" }, grishnakh);
    expect(back.cards[captive?.id ?? ""]?.host).toBe(idOf(table, "143022"));
    expect(back.cards[captive?.id ?? ""]?.damage).toBe(1);
    expect(back.cards[captive?.id ?? ""]?.captive).toBe(true);
  });

  it("goes to its owner's discard pile when destroyed, and with no Captive left the constant loses the game (143022:A:1)", () => {
    const [captive] = captivesOf(table);
    const settled = (state: ScenarioState): ScenarioState => settle(syncConstants(state, ctxOf()), ctxOf(), []);
    expect(constantWin(syncConstants(table, ctxOf()), ctxOf()).lost).toBe(false);
    // 100 damage is the stand-in hero's hit points: it is destroyed in the captive zone and goes to the discard pile of the seat it belongs to.
    const hurt = run({ ...table, window: null }, { verb: "DamageHeldCaptive", amount: 100 }, idOf(table, "143022"));
    const destroyed = settled(hurt);
    expect(destroyed.cards[captive?.id ?? ""]?.zone).toBe("discard");
    expect(destroyed.seats[0].discard).toContain(captive?.id);
    expect(captivesOf(destroyed)).toHaveLength(0);
    expect(constantWin(syncConstants(destroyed, ctxOf()), ctxOf()).lost).toBe(true);
  });
});
