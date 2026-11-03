// Rules: mec109.setup-flight-to-the-ford, rr.quest-advancement, rr.winning-the-game, rr.active-location, rr.explored,
// rr.step-6-2, rr.modifiers, rr.blank, rr.surge, rr.first-player, rr.step-3-3 (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import type { EngineStep } from "../rules/core/intents.ts";
import { dealOneShadow, runInstruction } from "../rules/interpret/interpret.ts";
import { dealShadows } from "../rules/combat/combat.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { legalIntents } from "../rules/engine/legal.ts";
import { settle } from "../rules/engine/machine.ts";
import type { ReduceContext } from "../rules/engine/reduce.ts";
import { flagged, type ScenarioState } from "../rules/core/state.ts";
import { FORD_OF_BRUINEN, fordTable, LAST_BRIDGE, loadFordWorld, WITCH_KING, type FordLayout, type FordWorld } from "../../test/scenarios/flight-to-the-ford/scene.ts";
import { codesOf, first, FRODO, SAM, send } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: FordWorld;

beforeAll(async () => {
  world = await loadFordWorld();
});

function make(layout: FordLayout = {}) {
  const made = fordTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// Runs an instruction as the card `sourceId` and lets what it started resolve (the same step list throughout, as one intent has).
function run(state: ScenarioState, instruction: Parameters<typeof runInstruction>[1], sourceId: string, ctx: ReduceContext, steps: EngineStep[] = []): ScenarioState {
  return settle({ ...runInstruction(state, instruction, { seat: 0, sourceId }, ctx, steps), window: null }, ctx, steps);
}

describe("The Last Bridge, the quest stages and the locations", () => {
  it("The Last Bridge's Threat is the number of players in the game (141058:A:2)", () => {
    for (const seats of [1, 2] as const) {
      const { state, ctx } = make({ seats, staging: [LAST_BRIDGE] });
      expect(modifiedStat(state, state.cards[first(state, LAST_BRIDGE)]!, "threat", ctx.cards), `${seats} players`).toBe(seats);
    }
  });

  it("stage 1 does not advance while The Last Bridge is out of the victory display (141028:B:1), and does once it is in it", () => {
    const plain = make({ staging: [LAST_BRIDGE], progress: 14 });
    const stuck = run(plain.state, { verb: "PlaceQuestProgress", perPlayer: 1 }, plain.frodo, plain.ctx);
    expect(stuck.cards[stuck.questStage ?? ""]?.code).toBe("141028");
    const won = make({ victory: [LAST_BRIDGE], progress: 14 });
    const moved = run(won.state, { verb: "PlaceQuestProgress", perPlayer: 1 }, won.frodo, won.ctx);
    expect(moved.cards[moved.questStage ?? ""]?.code).toBe("141029");
  });

  it("stage 2 adds Ford of Bruinen and The Witch-king to the staging area when it is revealed (141029:B:1)", () => {
    const { state, ctx, frodo } = make({ victory: [LAST_BRIDGE], progress: 14, setAside: [FORD_OF_BRUINEN, WITCH_KING] });
    const after = run(state, { verb: "PlaceQuestProgress", perPlayer: 1 }, frodo, ctx);
    expect(codesOf(after, after.staging).sort()).toEqual([FORD_OF_BRUINEN, WITCH_KING]);
    expect(after.setAside.filter((id) => [FORD_OF_BRUINEN, WITCH_KING].includes(after.cards[id]?.code ?? ""))).toEqual([]);
    expect(after.stageCleared).toBe(false);
  });

  it("stage 2 gets +15 quest points while a Nazgûl enemy is in play (141029:B:2)", () => {
    const quiet = make({ stage: "141029" });
    expect(modifiedStat(quiet.state, quiet.state.cards[quiet.state.questStage ?? ""]!, "questPoints", quiet.ctx.cards)).toBe(15);
    const hunted = make({ stage: "141029", staging: [WITCH_KING] });
    expect(modifiedStat(hunted.state, hunted.state.cards[hunted.state.questStage ?? ""]!, "questPoints", hunted.ctx.cards)).toBe(30);
    const engaged = make({ stage: "141029", engaged: [{ code: "141069", seat: 0 }] });
    expect(modifiedStat(engaged.state, engaged.state.cards[engaged.state.questStage ?? ""]!, "questPoints", engaged.ctx.cards)).toBe(30);
    const other = make({ stage: "141029", staging: ["f0"] });
    expect(modifiedStat(other.state, other.state.cards[other.state.questStage ?? ""]!, "questPoints", other.ctx.cards)).toBe(15);
  });

  it("defeating stage 2 wins the game (141029:B:4, rr.winning-the-game), with the Nazgûl gone it takes 15 progress", () => {
    const { state, ctx, frodo } = make({ stage: "141029", progress: 14 });
    const won = run(state, { verb: "PlaceQuestProgress", perPlayer: 1 }, frodo, ctx);
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBe(false);
    const hunted = make({ stage: "141029", progress: 14, staging: [WITCH_KING] });
    const short = run(hunted.state, { verb: "PlaceQuestProgress", perPlayer: 1 }, hunted.frodo, hunted.ctx);
    expect(short.stageCleared).toBe(false);
  });

  it("Ford of Bruinen, explored, discards all the engaged enemies and no others (141059:A:2)", () => {
    const { state, ctx, frodo } = make({ seats: 2, stage: "141029", active: FORD_OF_BRUINEN, engaged: [{ code: "grunt", seat: 0 }, { code: "grunt", seat: 1 }, { code: WITCH_KING, seat: 1 }], staging: ["f0"] });
    const steps: EngineStep[] = [];
    const explored = run(state, { verb: "PlaceProgressOn", amount: 6, target: "activeLocation" }, frodo, ctx, steps);
    expect(explored.window).toEqual({ kind: "response", seat: 0 });
    const ford = first(state, FORD_OF_BRUINEN);
    expect(legalIntents(explored, ctx)).toContainEqual({ type: "Trigger", cardId: ford, effectId: "141059:response:1" });
    const done = send({ state: explored, steps: [] }, { type: "Trigger", cardId: ford, effectId: "141059:response:1" }, ctx).state;
    expect(done.seats[0].engaged).toEqual([]);
    expect(done.seats[1].engaged).toEqual([]);
    // The enemies are discarded, not defeated: they join the encounter discard pile, not the victory display. Ford of Bruinen,
    // explored, is in the victory display.
    expect(codesOf(done, done.encounterDiscard).sort()).toEqual(["grunt", "grunt", WITCH_KING].sort());
    expect(codesOf(done, done.victory)).toEqual([FORD_OF_BRUINEN]);
    expect(codesOf(done, done.staging)).toEqual(["f0"]);
  });

  it("The Troll's Camp gives each hero +1 Willpower, Attack and Defense while it is the active location (141060:A:1)", () => {
    const camp = make({ active: "141060" });
    const staged = make({ staging: ["141060"] });
    for (const code of [FRODO, SAM]) {
      for (const stat of ["willpower", "attack", "defense"] as const) {
        const on = modifiedStat(camp.state, camp.state.cards[first(camp.state, code)]!, stat, camp.ctx.cards);
        const off = modifiedStat(staged.state, staged.state.cards[first(staged.state, code)]!, stat, staged.ctx.cards);
        expect(on, `${code} ${stat}`).toBe(off + 1);
      }
    }
  });
});

describe("Ettenmoors (141061)", () => {
  it("keeps the Nazgûl engaged with a player from being dealt a shadow card while it is the active location (141061:A:1)", () => {
    const active = make({ active: "141061", engaged: [{ code: "141069", seat: 0 }, { code: "grunt", seat: 0 }], deck: ["f0", "f0", "f0"] });
    const dealt = dealShadows(active.state, active.ctx.cards, []);
    expect(dealt.cards[first(dealt, "141069")]?.shadowId).toBeNull();
    expect(dealt.cards[first(dealt, "grunt")]?.shadowId).not.toBeNull();
    // No additional shadow card either (141069:A:2).
    expect(dealOneShadow(active.state, first(active.state, "141069"), []).cards[first(active.state, "141069")]?.shadowId).toBeNull();
    const staged = make({ staging: ["141061"], engaged: [{ code: "141069", seat: 0 }], deck: ["f0"] });
    expect(dealShadows(staged.state, staged.ctx.cards, []).cards[first(staged.state, "141069")]?.shadowId).not.toBeNull();
    expect(flagged(active.state, first(active.state, "141069"), "noShadowDealt")).toBe(true);
    expect(flagged(active.state, first(active.state, "grunt"), "noShadowDealt")).toBe(false);
  });

  it("reduces the Ring-bearer's life by 1 after progress is placed on it, once for the placing and not when it is explored (141061:A:2)", () => {
    const { state, ctx, frodo } = make({ active: "141061" });
    const once = run(state, { verb: "PlaceProgressOn", amount: 1, target: "activeLocation" }, frodo, ctx);
    expect(once.life).toBe(14);
    const twice = run(once, { verb: "PlaceProgressOn", amount: 1, target: "activeLocation" }, frodo, ctx);
    expect(twice.life).toBe(13);
    // The third point fills its 3 quest points: it is explored and leaves play, so nothing is placed on it that it could answer.
    const explored = run(twice, { verb: "PlaceProgressOn", amount: 1, target: "activeLocation" }, frodo, ctx);
    expect(explored.life).toBe(13);
    expect(explored.activeLocation).toBeNull();
  });

  it("is answered for the progress questing places on it too", () => {
    const { state, ctx, frodo } = make({ active: "141061" });
    const steps: EngineStep[] = [];
    const placed = run(state, { verb: "PlaceQuestProgress", perPlayer: 2 }, frodo, ctx, steps);
    expect(placed.life).toBe(14);
    expect(steps.filter((step) => step.kind === "life")).toHaveLength(1);
  });
});
