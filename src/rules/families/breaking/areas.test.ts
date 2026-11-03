// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.engagement-check, rr.step-3-4, mec109.archery, rr.player-elimination
// (data/rules/entries.json). Stage 2B (142062:B:1) deals the shared staging area out to a staging area and a stage for each seat, and the round that
// follows is played with separate staging (src/rules/families/breaking/areas.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../fixture.ts";
import type { EngineStep } from "../../intents.ts";
import { reduce, type ScenarioState } from "../../reduce.ts";
import { pushCardEffects } from "../../effect-frames.ts";
import { stagingThreat } from "../../quest.ts";
import { areaOf, sharedStaging, stageOf, stagingOf, viewOf } from "./areas.ts";
import { moveCard } from "../../zones.ts";
import { causeProblems } from "../../../../scripts/cause-check.ts";
import { DIVIDED, FRODOS_CHOICE, SEAT_OF_SEEING, codes, loadBreakingWorld, makeBreaking, recordOf, settled, type BreakingLayout, type BreakingTable, type BreakingWorld } from "../../../../scripts/breaking-scene.ts";
import { first } from "../../../../scripts/past-scene.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
}, 60_000);

const make = (layout: BreakingLayout = {}) => makeBreaking(world, layout);

type Seen = { options: readonly string[]; seat: number };

// Resolves stage 2B's Forced effect, answering each choice with `answer(options, seen so far)`; returns the state and every choice window it opened.
function twoB(table: BreakingTable, answer: (seen: Seen[], options: readonly string[]) => string, steps: EngineStep[] = []): { state: ScenarioState; seen: Seen[] } {
  const seen: Seen[] = [];
  const stage = first(table.state, DIVIDED);
  let state = settled(table, pushCardEffects({ ...table.state, window: null }, "forced", stage, 0, false, [recordOf("142062:forced:1")], table.ctx, steps), steps);
  for (let guard = 0; state.window?.kind === "choose" && guard < 40; guard += 1) {
    const window = state.window;
    seen.push({ options: window.options, seat: window.seat });
    state = settled(table, expectOk(reduce(state, { type: "Choose", optionId: answer(seen, window.options) }, table.ctx)).state, steps);
  }
  return { state, seen };
}

const SHARED = ["brute", "grunt", "scout", "place"];

function twoHanded(): BreakingTable {
  return make({ seats: 2, stage: 2, staging: SHARED, deck: ["grunt"], discard: ["mist"], setAside: [SEAT_OF_SEEING, FRODOS_CHOICE], phase: "Refresh" });
}

describe("stage 2B, two-handed (142062:B:1)", () => {
  it("gives each seat a different stage 3A of its choice, first player first, and then deals the shared staging area out", () => {
    const table = twoHanded();
    const picked = new Map<number, string>();
    const steps: EngineStep[] = [];
    const { state, seen } = twoB(
      table,
      (log, options) => {
        // The two stage choices first (the first player takes Guard the Hobbits), then the cards: the first player takes the biggest threats.
        if (log.length === 1) return "142064";
        const wanted = options.find((id) => ["brute", "grunt"].includes(table.state.cards[id]?.code ?? ""));
        picked.set(log.length, wanted ?? options[0] ?? "");
        return log.length === 2 ? (options[0] ?? "") : wanted ?? options[0] ?? "";
      },
      steps,
    );
    // The choices: four stages for the first player, the three the first player left for the second.
    expect(seen[0]?.options).toEqual(["142063", "142064", "142065", "142066"]);
    expect(seen[0]?.seat).toBe(0);
    expect(seen[1]?.options).toEqual(["142063", "142065", "142066"]);
    expect(seen[1]?.seat).toBe(1);
    expect(state.separate).toBe(true);
    expect(state.questStage).toBeNull();
    expect(codes(state, [state.seats[0].stage ?? "", state.seats[1].stage ?? ""])).toEqual(["142064", "142063"]);
    expect(state.cards[state.seats[0].stage ?? ""]?.zone).toBe("questStage");
    expect(state.cards[state.seats[0].stage ?? ""]?.face).toBe("B");
    expect(state.questDeck.map((id) => state.cards[id]?.code)).toEqual(["142065", "142066", "142067"]);
    // Stage 2B is discarded (set aside, as a defeated stage is), the shared staging area is empty, every card is in exactly one seat's area.
    expect(state.cards[first(state, DIVIDED)]?.zone).toBe("setAside");
    expect(sharedStaging(state)).toEqual([]);
    const all = [...state.seats[0].staging, ...state.seats[1].staging];
    expect(new Set(all).size).toBe(all.length);
    expect([...state.staging].sort()).toEqual([...all].sort());
    for (const id of all) expect(state.cards[id]?.zone).toBe("staging");
    // Each seat chose one card of the shared area a round at a time, so both hold two of the four (the stage 3A reveals add one to the second seat's).
    expect(state.seats[0].staging.length).toBeGreaterThanOrEqual(2);
    expect(causeProblems(steps)).toEqual([]);
  });

  it("shuffles Seat of Seeing and Frodo's Choice into the encounter discard pile and puts that pile under the encounter deck", () => {
    const table = twoHanded();
    const { state } = twoB(table, (_log, options) => options[0] ?? "");
    expect(state.encounterDiscard).toEqual([]);
    const bottom = state.encounterDeck.map((id) => state.cards[id]?.code);
    // The deck had one card (revealed by a stage 3A that found its area small, so one fewer card remains): the discard pile (mist and the two cards) follows it.
    expect(bottom.slice(-3).sort()).toEqual(["142068", "142074", "mist"].sort());
    // Only the two stages that were played are set aside.
    expect(state.setAside.map((id) => state.cards[id]?.code).sort()).toEqual(["142061", "142062"]);
    for (const id of state.encounterDeck) expect(state.cards[id]?.face).toBe("down");
  });

  it("moves a card to the seat that chose it, and the 3A of a small area reveals a card into that seat's own area", () => {
    const table = twoHanded();
    // Seat 0 takes brute then grunt (threat 5: no reveal). Seat 1 gets scout and place (threat 2: reveals the one card in the deck).
    const { state } = twoB(table, (log, options) => {
      if (log.length <= 2) return options[0] ?? "";
      const code = (id: string) => table.state.cards[id]?.code ?? "";
      if (log[log.length - 1]?.seat === 0) return options.find((id) => code(id) === (log.length === 3 ? "brute" : "grunt")) ?? options[0] ?? "";
      return options.find((id) => code(id) === "scout") ?? options[0] ?? "";
    });
    expect(codes(state, state.seats[0].staging).sort()).toEqual(["brute", "grunt"]);
    expect(codes(state, state.seats[1].staging).sort()).toEqual(["grunt", "place", "scout"]);
    expect(stagingThreat(state, world.cards, 0)).toBe(5);
    expect(stagingThreat(state, world.cards, 1)).toBe(2 + 1 + 1);
    // The revealed grunt came from the encounter deck into seat 1's area, with seat 1 as the one who revealed it.
    const revealed = state.seats[1].staging.filter((id) => state.cards[id]?.controller === 1);
    expect(codes(state, revealed)).toEqual(["grunt"]);
    expect(state.seats[0].staging.some((id) => state.cards[id]?.controller != null)).toBe(false);
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain("grunt");
  });
});

describe("stage 2B, true solo (142062:B:1)", () => {
  it("creates one staging area and one stage 3A of the player's choice, and moves every shared card to it", () => {
    const table = make({ seats: 1, stage: 2, staging: ["grunt", "place"], deck: ["scout"], discard: [], setAside: [SEAT_OF_SEEING, FRODOS_CHOICE], phase: "Refresh" });
    const { state, seen } = twoB(table, (log, options) => (log.length === 1 ? "142066" : options[0] ?? ""));
    expect(seen[0]?.options).toEqual(["142063", "142064", "142065", "142066"]);
    expect(state.separate).toBe(true);
    expect(state.cards[state.seats[0].stage ?? ""]?.code).toBe("142066");
    expect(state.questStage).toBeNull();
    expect(sharedStaging(state)).toEqual([]);
    expect(codes(state, state.seats[0].staging)).toEqual(expect.arrayContaining(["grunt", "place"]));
    expect(state.seats[1].staging).toEqual([]);
    expect(state.seats[1].stage).toBeUndefined();
  });
});

describe("the state helpers", () => {
  it("read the shared staging area and stage until stages are separate, and the seat's own after", () => {
    const shared = make({ seats: 2, stage: 2, staging: ["grunt", "place"] });
    expect(stagingOf(shared.state, 0)).toBe(shared.state.staging);
    expect(stageOf(shared.state, 1)).toBe(shared.state.questStage);
    expect(viewOf(shared.state, 0)).toBe(shared.state);
    expect(areaOf(shared.state, shared.state.staging[0] ?? "")).toBeNull();
    const split = make({ seats: 2, stage: "separate", staging: ["place"], areas: [["grunt"], ["scout", "brute"]] });
    expect(codes(split.state, stagingOf(split.state, 0))).toEqual(["grunt"]);
    expect(codes(split.state, stagingOf(split.state, 1))).toEqual(["scout", "brute"]);
    expect(codes(split.state, sharedStaging(split.state))).toEqual(["place"]);
    expect(split.state.cards[stageOf(split.state, 0) ?? ""]?.code).toBe("142063");
    expect(split.state.cards[stageOf(split.state, 1) ?? ""]?.code).toBe("142064");
    expect(areaOf(split.state, split.state.seats[1].staging[0] ?? "")).toBe(1);
    const view = viewOf(split.state, 1);
    expect(view.staging).toEqual(split.state.seats[1].staging);
    expect(view.questStage).toBe(split.state.seats[1].stage);
    expect(split.state.questStage).toBeNull();
    // The union keeps every staging card in any area.
    expect(split.state.staging).toHaveLength(4);
  });

  it("move a card between the shared area, an area, a pile and the engaged enemies, keeping the lists and the union in step", () => {
    const split = make({ seats: 2, stage: "separate", staging: ["place"], areas: [["grunt"], ["scout"]] });
    const grunt = first(split.state, "grunt");
    const scout = first(split.state, "scout");
    const place = first(split.state, "place");
    // Out of an area to the discard pile: it leaves the seat's list and the union.
    const discarded = moveCard(split.state, grunt, { zone: "encounterDiscard" });
    expect(discarded.seats[0].staging).toEqual([]);
    expect(discarded.staging).not.toContain(grunt);
    // Engaged: it leaves its area, and returning to the staging area puts it in the area of the seat it was engaged with.
    const engaged = moveCard(split.state, scout, { zone: "engaged", seat: 1 });
    expect(engaged.seats[1].staging).toEqual([]);
    expect(engaged.staging).not.toContain(scout);
    const back = moveCard(engaged, scout, { zone: "staging" });
    expect(back.seats[1].staging).toEqual([scout]);
    expect(back.seats[0].staging).toEqual([grunt]);
    // From the shared area into a seat's area, by name.
    const dealt = moveCard(split.state, place, { zone: "staging", area: 0 });
    expect(dealt.seats[0].staging).toEqual([grunt, place]);
    expect(sharedStaging(dealt)).toEqual([]);
    expect(dealt.staging).toHaveLength(3);
    // A seat's stage card leaves its seat when it is set aside.
    const stage = split.state.seats[1].stage ?? "";
    const past = moveCard(split.state, stage, { zone: "setAside" });
    expect(past.seats[1].stage).toBeUndefined();
    expect(past.seats[0].stage).toBe(split.state.seats[0].stage);
  });
});
