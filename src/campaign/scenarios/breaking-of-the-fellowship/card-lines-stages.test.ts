// Rules: mec109.multiple-staging-areas, rr.forced, rr.quest-advancement, rr.winning-the-game, rr.in-play-and-out-of-play, rr.travel, rr.active-location, rr.combat-phase
// (data/rules/entries.json). The stage 3 and 4 cards and the locations of Breaking of the Fellowship that hold the quest back, read from their printed lines: 142063:A:1,
// 142064:A:1, 142065:A:1, 142063:B:2, 142064:B:2, 142065:B:2, 142066:B:2, 142064:B:1, 142065:B:1, 142067:B:3, 142073:A:3, 142075:A:1, 142075:A:2 (data/printed/fellowship-of-the-ring.json).
// Each test plays the moment through the reducer on the scenario's own table (test/scenarios/breaking-of-the-fellowship/scene.ts), with a staging area and a stage for each
// seat once stage 2B has been played.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { first } from "../../../../test/harness/scene-kit.ts";
import { ARGONATH, codes, DIVIDED, FRODOS_CHOICE, loadBreakingWorld, makeBreaking, PARTH_GALEN, recordOf, SARN_GEBIR, SEAT_OF_SEEING, settled, type BreakingLayout, type BreakingTable, type BreakingWorld } from "../../../../test/scenarios/breaking-of-the-fellowship/scene.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
}, 60_000);

// Two-handed after stage 2B: the strong hero (6 Willpower) in seat 0, the weak one (1 Willpower) in seat 1, each seat on the stage `stages` names.
const TWO: BreakingLayout = { seats: 2, stage: "separate", frodo: false, heroes: [["strong"], ["weak"]], threats: [30, 30] };
const SOLO: BreakingLayout = { seats: 1, stage: "separate", frodo: false, heroes: [["strong"]], threats: [30] };
const MIST = Array.from({ length: 12 }, () => "mist");

function send(table: BreakingTable, state: ScenarioState, intent: PlayerIntent): ScenarioState {
  return expectOk(reduce(state, intent, table.ctx)).state;
}

// Each seat commits its first hero and passes; then every window is passed until the quest phase is over (a stage's Response to the quest is passed too).
function quest(table: BreakingTable): ScenarioState {
  let state = table.state;
  for (let seat = 0; seat < table.state.seatCount; seat += 1) {
    state = send(table, state, { type: "Commit", cardIds: [table.heroes[state.activeSeat]?.[0] ?? ""] });
    state = send(table, state, { type: "Pass" });
  }
  for (let guard = 0; guard < 40 && state.phase === "Quest" && !state.stageCleared && state.window != null; guard += 1) {
    if (state.window.kind === "choose") state = send(table, state, { type: "Choose", optionId: state.window.options[0] ?? "" });
    else state = send(table, state, { type: "Pass" });
  }
  return state;
}

describe("stage 3A: Forced, after stage 2B is discarded, a small staging area reveals a card (142063:A:1 to 142065:A:1)", () => {
  // "Forced: After stage 2B is discarded, if the total Threat of encounter cards in this staging area is less than 4, reveal 1 encounter card." Stage 2B deals the shared
  // staging area out, one card at a time: `wants` lists the codes each seat takes. Seat 1 is on Orc Hunting (142066), whose 3A prints the same line.
  function twoB(stage: string, wants: readonly (readonly string[])[]): ScenarioState {
    const table = makeBreaking(world, { seats: 2, stage: 2, staging: ["scout", "grunt", "brute", "scout"], deck: ["place"], setAside: [SEAT_OF_SEEING, FRODOS_CHOICE], phase: "Refresh" });
    const steps: EngineStep[] = [];
    const left = wants.map((list) => [...list]);
    let state = settled(table, pushCardEffects({ ...table.state, window: null }, "forced", first(table.state, DIVIDED), 0, false, [recordOf("142062:forced:1")], table.ctx, steps), steps);
    for (let guard = 0; state.window?.kind === "choose" && guard < 40; guard += 1) {
      const { options, seat } = state.window;
      let option = options.includes(stage) ? stage : options.includes("142066") ? "142066" : undefined;
      if (option == null) {
        // A card of the shared area: the first one a seat still wants (the seat the window is for, else whichever seat wants it).
        const wanted = [seat, 0, 1].flatMap((index) => (left[index] ?? []).map((code) => ({ index, code })));
        const found = wanted.map((want) => ({ ...want, id: options.find((id) => state.cards[id]?.code === want.code) })).find((want) => want.id != null);
        option = found?.id ?? options[0];
        if (found) left[found.index]?.splice(left[found.index]?.indexOf(found.code) ?? 0, 1);
      }
      state = settled(table, expectOk(reduce(state, { type: "Choose", optionId: option ?? "" }, table.ctx)).state, steps);
    }
    return state;
  }

  it.each([
    ["142063:A:1", "142063"],
    ["142064:A:1", "142064"],
    ["142065:A:1", "142065"],
  ])("%s reveals 1 encounter card into its seat's staging area when the area's Threat is 3", (_line, stage) => {
    const state = twoB(stage, [["scout", "grunt"], ["brute", "scout"]]);
    expect(state.cards[state.seats[0].stage ?? ""]?.code).toBe(stage);
    // Seat 0's area: scout (1) and grunt (2), then the place it revealed. Seat 1's area: brute (3) and scout (1), 4 in all, so Orc Hunting reveals nothing.
    expect(codes(state, state.seats[0].staging).sort()).toEqual(["grunt", "place", "scout"]);
    expect(codes(state, state.seats[1].staging).sort()).toEqual(["brute", "scout"]);
  });

  it.each([
    ["142063:A:1", "142063"],
    ["142064:A:1", "142064"],
    ["142065:A:1", "142065"],
  ])("%s reveals nothing when the area's Threat is 4", (_line, stage) => {
    const state = twoB(stage, [["brute", "scout"], ["scout", "grunt"]]);
    expect(codes(state, state.seats[0].staging).sort()).toEqual(["brute", "scout"]);
    // Seat 1's Orc Hunting found 3 Threat and revealed the place into seat 1's area.
    expect(codes(state, state.seats[1].staging).sort()).toEqual(["grunt", "place", "scout"]);
  });
});

describe("stage 3B: Forced, after Frodo's Choice is revealed at this stage, advance to stage 4A (142063:B:2 to 142066:B:2)", () => {
  // "Forced: After Frodo's Choice is revealed at this stage, advance to stage 4A." In the staging step seat 0 reveals the scout and seat 1 Frodo's Choice. The other seat is
  // on Orc Hunting (142066), or on Searching the Woods when Orc Hunting is the stage tested.
  const deck = ["scout", FRODOS_CHOICE, "scout", "scout", "scout"];
  const other = (stage: string) => (stage === "142066" ? "142063" : "142066");
  const STAGES = [
    ["142063:B:2", "142063"],
    ["142064:B:2", "142064"],
    ["142065:B:2", "142065"],
    ["142066:B:2", "142066"],
  ];

  it.each(STAGES)("%s advances the seat that revealed Frodo's Choice at this stage to stage 4A", (_line, stage) => {
    const table = makeBreaking(world, { ...TWO, stages: [other(stage), stage], deck, setAside: [PARTH_GALEN] });
    const state = quest(table);
    expect(state.cards[state.seats[1].stage ?? ""]?.code).toBe("142067");
    expect(state.cards[first(state, stage)]?.zone).toBe("setAside");
    expect(state.cards[state.seats[0].stage ?? ""]?.code).toBe(other(stage));
  });

  it.each(STAGES)("%s does not advance when Frodo's Choice is revealed at the other seat's stage", (_line, stage) => {
    const table = makeBreaking(world, { ...TWO, stages: [stage, other(stage)], deck, setAside: [PARTH_GALEN] });
    const state = quest(table);
    expect(state.cards[state.seats[0].stage ?? ""]?.code).toBe(stage);
    expect(state.cards[state.seats[1].stage ?? ""]?.code).toBe("142067");
  });
});

describe("stage 3B: progress discards encounter cards while Frodo's Choice is not in play (142064:B:1, 142065:B:1)", () => {
  // "If Frodo's Choice is not in play, any time players would place progress on this quest, discard an equal number of cards from the encounter deck instead." The strong
  // hero quests for 6 against an empty area; the staging step reveals one mist, which has no effect and is discarded.
  it.each([
    ["142064:B:1", "142064"],
    ["142065:B:1", "142065"],
  ])("%s discards 6 cards from the encounter deck in place of 6 progress", (_line, stage) => {
    const table = makeBreaking(world, { ...SOLO, stages: [stage], deck: MIST });
    const state = quest(table);
    expect(state.cards[state.seats[0].stage ?? ""]?.progress).toBe(0);
    expect(state.encounterDeck).toHaveLength(12 - 1 - 6);
    expect(state.encounterDiscard).toHaveLength(1 + 6);
  });

  it.each([
    ["142064:B:1", "142064"],
    ["142065:B:1", "142065"],
  ])("%s places the progress once Frodo's Choice is in play", (_line, stage) => {
    const table = makeBreaking(world, { ...SOLO, stages: [stage], deck: MIST, areas: [[FRODOS_CHOICE]] });
    const state = quest(table);
    expect(state.cards[state.seats[0].stage ?? ""]?.progress).toBe(6);
    expect(state.encounterDeck).toHaveLength(12 - 1);
  });
});

describe("stage 4B and Parth Galen: who wins (142067:B:3, 142073:A:3)", () => {
  // "When this stage is defeated, the players win the game." 4B has 16 quest points; 15 are on it and the strong hero quests for 6 against an area of mist.
  it("142067:B:3 the players win the game when stage 4B is defeated", () => {
    const state = quest(makeBreaking(world, { ...SOLO, stages: ["142067"], progress: 15, deck: MIST }));
    expect(state.stageCleared).toBe(true);
    expect(state.lost).toBe(false);
  });

  // "While Parth Galen is in play, the players cannot win the game." Parth Galen (2 Threat) leaves 4 progress, enough for the 16 quest points.
  it("142073:A:3 the players cannot win the game while Parth Galen is in play", () => {
    const state = quest(makeBreaking(world, { ...SOLO, stages: ["142067"], progress: 15, deck: MIST, areas: [[PARTH_GALEN]] }));
    expect(state.stageCleared).toBeFalsy();
    expect(state.cards[state.seats[0].stage ?? ""]?.code).toBe("142067");
  });

  it("142073:A:3 Parth Galen in another seat's staging area is in play too", () => {
    const state = quest(makeBreaking(world, { ...TWO, stages: ["142067", "142066"], progress: 15, deck: MIST, areas: [[], [PARTH_GALEN]] }));
    expect(state.stageCleared).toBeFalsy();
  });
});

describe("The Argonath (142075)", () => {
  // "X is the number of players in the game." Its printed Threat is X.
  it.each([1, 2] as const)("142075:A:1 has Threat equal to the number of players in the game, with %i player(s)", (seats) => {
    const table = makeBreaking(world, { seats, staging: [ARGONATH] });
    expect(stagingThreat(table.state, table.ctx.cards)).toBe(seats);
  });

  // "The players cannot travel here while Sarn Gebir is in play."
  it("142075:A:2 the players cannot travel to The Argonath while Sarn Gebir is in play, and can once it has gone", () => {
    const both = makeBreaking(world, { staging: [ARGONATH, SARN_GEBIR], phase: "Travel" });
    const offered = legalTargets(both.state, { type: "Travel" }, both.ctx);
    expect(offered).toContain(first(both.state, SARN_GEBIR));
    expect(offered).not.toContain(first(both.state, ARGONATH));
    const alone = makeBreaking(world, { staging: [ARGONATH], phase: "Travel" });
    expect(legalTargets(alone.state, { type: "Travel" }, alone.ctx)).toContain(first(alone.state, ARGONATH));
  });

  // "While The Argonath is the active location, skip the combat phase." From the travel phase every window is passed until the next round (or a defense is asked);
  // the grunt engaged with seat 0 attacks only when the combat phase is played.
  function combatReached(argonathActive: boolean): { attacked: boolean; phase: ScenarioState["phase"] } {
    const table = makeBreaking(world, { staging: argonathActive ? [] : [ARGONATH], engaged: [{ code: "grunt", seat: 0 }], deck: MIST, phase: "Travel" });
    let state = table.state;
    if (argonathActive) state = syncConstants(spawn(state, ARGONATH, { zone: "activeLocation" }).state, table.ctx);
    const round = state.round;
    for (let guard = 0; guard < 40 && state.round === round && state.phase !== "Refresh"; guard += 1) {
      if (state.window?.kind === "defense") return { attacked: true, phase: state.phase };
      const next = legalIntents(state, table.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineTravel" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!next) break;
      state = send(table, state, next);
    }
    return { attacked: false, phase: state.phase };
  }

  it("142075:A:2 skips the combat phase while The Argonath is the active location", () => {
    expect(combatReached(true)).toEqual({ attacked: false, phase: "Resource" });
  });

  it("142075:A:2 the combat phase is played while The Argonath is in the staging area", () => {
    expect(combatReached(false)).toEqual({ attacked: true, phase: "Combat" });
  });
});
