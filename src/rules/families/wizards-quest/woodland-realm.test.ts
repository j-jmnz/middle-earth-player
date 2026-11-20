// Rules: rr.search, rr.reveal, rr.cancel, rr.first-player, rr.ownership-and-control, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51101:B:1, 51138:A:1, 51108:B:3 (docs/brief.md, The Woodland Realm, readings 5, 7, 8 and 14).
// The pieces The Woodland Realm adds, on fixture cards: SearchTopReveal `maxCostStage` and `cancelable`, FlipOver `control: "firstPlayer"` and the condition questProgressNoted `min`.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { cancelBarred } from "../encounter/cancel.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";
import { spawn } from "../../core/zones.ts";
import { flipOver } from "../wilderland/flip.ts";
import { questProgressNoted } from "../wizardry/progress.ts";
import { manifest } from "./index.ts";

const CARDS = cardMap([
  hero("frodo", "lore"),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 5 }),
  definePrinted({ code: "stage2", name: "Stage 2", type: "quest", questPoints: 5 }),
  definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 2, attack: 3, engagementCost: 20, defense: 1, health: 2, cost: 1 }),
  definePrinted({ code: "giant", name: "Giant", type: "enemy", threat: 4, attack: 4, engagementCost: 30, defense: 1, health: 6, cost: 2 }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery", cost: 0 }),
  definePrinted({ code: "den", name: "Spider Den", type: "location", threat: 1, questPoints: 1 }),
  definePrinted({ code: "mendor", name: "Mendor", type: "ally", sphere: "neutral", willpower: 2, attack: 2, defense: 2, health: 5 }),
]);
const ctx: ReduceContext = { effects: [], cards: CARDS };

function table(stageNumber: 1 | 2, deck: readonly string[]): ScenarioState {
  let state = idleScenario(2);
  state = { ...state, stages: stageNumber === 2 ? [{ code: "stage" }, { code: "stage2" }] : [{ code: "stage" }] } as ScenarioState;
  state = spawn(state, stageNumber === 2 ? "stage2" : "stage", { zone: "questStage" }).state;
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  for (const code of deck) state = spawn(state, code, { zone: "encounterDeck" }).state;
  return state;
}
const inFrame = (state: ScenarioState): ScenarioState =>
  pushEffectFrame(state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x:whenRevealed:1", instructions: [], picked: [], cancel: null, blockCancel: null }, []);
const cancel: Effect = { id: "c:response:1", cardCode: "c", lines: ["c:A:1"], timing: "response", instructions: [{ verb: "CancelEffect" }] };

describe("SearchTopReveal `maxCostStage` and `cancelable` (51138:A:1, reading 5)", () => {
  const search = { verb: "SearchTopReveal", top: 5, maxCostStage: true, cancelable: true } as const;
  const run = (state: ScenarioState) => {
    const steps: EngineStep[] = [];
    return settle(manifest.run?.(inFrame(state), search, { seat: 0, sourceId: null }, ctx, steps) as ScenarioState, ctx, steps);
  };

  it("takes a card that costs no more than the stage number, for two players too: at stage 1 the 1 cost enemy, not the 2 cost one", () => {
    const done = run(table(1, ["giant", "orc", "mist"]));
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["orc"]);
    expect(done.encounterDeck.map((id) => done.cards[id]?.code).sort()).toEqual(["giant", "mist"]);
  });

  it("at stage 2 the card nearest the top that costs 2 or less is found", () => {
    const done = run(table(2, ["giant", "orc"]));
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["giant"]);
  });

  it("bars no cancelation on the revealed card (the line prints none), where the stage 2 and 3 searches bar it", () => {
    const state = table(1, ["mist"]);
    const free = run(state);
    const id = Object.values(free.cards).find((card) => card.code === "mist")?.id as string;
    expect(cancelBarred(free, { trigger: "whenRevealedPending", seat: 0, subject: id }, cancel)).toBe(false);
    const barred = manifest.run?.(inFrame(state), { verb: "SearchTopReveal", top: 5, maxCost: 1, maxCostMulti: 2 }, { seat: 0, sourceId: null }, ctx, []) as ScenarioState;
    expect(cancelBarred(barred, { trigger: "whenRevealedPending", seat: 0, subject: id }, cancel)).toBe(true);
  });
});

describe("FlipOver `control: firstPlayer` (51101:B:1, reading 8)", () => {
  it("turns the explored location into the card `into` in the first player's play area, ready, with none of its tokens", () => {
    let state = spawn(table(1, []), "frodo", { zone: "heroes", seat: 1 }).state;
    state = { ...state, firstPlayer: 1 };
    const den = spawn(state, "den", { zone: "staging" });
    const stage = den.state.questStage as string;
    const tokened = updateCard(den.state, den.id, { progress: 1, damage: 1, exhausted: true });
    const done = flipOver(tokened, { verb: "FlipOver", into: "mendor", target: "subject", control: "firstPlayer" }, { seat: 0, sourceId: stage }, den.id);
    expect(done.cards[den.id]).toMatchObject({ code: "mendor", zone: "play", controller: 1, exhausted: false, face: "up", other: "den", progress: 0, damage: 0 });
    expect(done.seats[1]?.play).toContain(den.id);
    expect(done.staging).not.toContain(den.id);
    expect((done.pendingEvents ?? []).some((event) => event.trigger === "enteredPlay" && event.cardId === den.id)).toBe(true);
  });
});

describe("the condition questProgressNoted `min` (51108:B:3, reading 14)", () => {
  it("counts the progress noted this phase: 10 or more is read from the sum", () => {
    const note = (amount: number) => ({ instanceId: "table", sourceId: "table", stat: "questProgressPhase" as const, amount, until: "endOfPhase" as const });
    const state = idleScenario(1);
    expect(questProgressNoted(state, 10)).toBe(false);
    expect(questProgressNoted({ ...state, modifiers: [note(6), note(3)] }, 10)).toBe(false);
    expect(questProgressNoted({ ...state, modifiers: [note(6), note(4)] }, 10)).toBe(true);
    expect(questProgressNoted({ ...state, modifiers: [note(2)] })).toBe(true);
  });
});
