// Rules: mec109.setup-the-ring-goes-south, mec109.stage-4, rr.quest-advancement, rr.active-location, rr.reveal, rr.staging, rr.search,
// rr.first-player, rr.in-player-order, rr.engaged, rr.damage (data/rules/entries.json). The quest cards of The Ring Goes South.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { DOORS, GREAT_WARG_CHIEF, LUST, loadSouthWorld, REDHORN_PASS, southTable, WATCHER, type SouthLayout, type SouthWorld } from "../../../../test/scenarios/the-ring-goes-south/scene.ts";
import { codesOf } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first } from "../../../../test/harness/scene-kit.ts";

let world: SouthWorld;

beforeAll(async () => {
  world = await loadSouthWorld();
});

function make(layout: SouthLayout = {}) {
  const made = southTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

function record(id: string): Effect {
  const found = EFFECTS.find((effect) => effect.id === id);
  if (!found) throw new Error(`No record ${id}`);
  return found;
}

// Pushes the record as the card's effect and settles it. A choice it opens is answered with `answers`, in order (the first option when
// they run out).
function fire(table: Table, state: ScenarioState, cardId: string, effectId: string, answers: readonly string[] = []): ScenarioState {
  const effect = record(effectId);
  const steps: EngineStep[] = [];
  let current = settle(pushCardEffects({ ...state, window: null }, effect.timing === "whenRevealed" ? "whenRevealed" : "forced", cardId, 0, false, [effect], table.ctx, steps), table.ctx, steps);
  for (let at = 0; current.window?.kind === "choose" && at < 30; at += 1) {
    const option = answers[at] ?? current.window.options[0] ?? "";
    current = expectOk(reduce(current, { type: "Choose", optionId: option }, table.ctx)).state;
  }
  return current;
}

describe("stage 1B: the Council of Elrond (142020:B:1)", () => {
  function council(seats: 1 | 2) {
    const table = make({
      stage: "142020",
      phase: "Planning",
      seats,
      setAside: [LUST, REDHORN_PASS],
      deckTop: ["ally", "filler", "grunt", "grunt", "grunt"],
      deckTopTwo: seats === 2 ? ["ally", "filler", "grunt", "grunt"] : [],
    });
    return table;
  }

  it("places the top cards faceup in player order, the first player assigns them one to each outcome, and the quest advances", () => {
    const table = council(2);
    const stage = table.state.questStage ?? "";
    const deck0 = table.state.seats[0].deck;
    const deck1 = table.state.seats[1].deck;
    // Order: seat 0's first card, seat 1's first, seat 0's second, seat 1's second.
    const faceup = [deck0[0], deck1[0], deck0[1], deck1[1]] as string[];
    const steps: EngineStep[] = [];
    let state = settle(pushCardEffects({ ...table.state, window: null }, "forced", stage, 0, false, [record("142020:forced:1")], table.ctx, steps), table.ctx, steps);
    expect(state.window?.kind).toBe("choose");
    expect(state.window && "options" in state.window ? [...state.window.options].sort() : []).toEqual([...faceup].sort());
    // Played for 0 cost: seat 0's ally; to the hand: seat 1's ally; discarded: seat 0's event.
    for (const id of [faceup[0], faceup[1], faceup[2]] as string[]) state = expectOk(reduce(state, { type: "Choose", optionId: id }, table.ctx)).state;
    // The last card, with the last outcome, is not asked.
    expect(state.cards[faceup[0] ?? ""]?.zone).toBe("play");
    expect(state.cards[faceup[1] ?? ""]?.zone).toBe("hand");
    expect(state.cards[faceup[1] ?? ""]?.controller).toBe(1);
    expect(state.cards[faceup[2] ?? ""]?.zone).toBe("discard");
    expect(state.cards[faceup[3] ?? ""]?.zone).toBe("deck");
    expect(state.cards[faceup[3] ?? ""]?.controller).toBe(1);
    expect(state.seats[1].deck).toContain(faceup[3]);
    // Then the first player chooses Lust for the Ring or +5 threat.
    expect(state.window?.kind).toBe("choose");
    expect(state.window && "options" in state.window ? state.window.options : []).toEqual(["lust", "threat"]);
  });

  it("either shuffles Lust for the Ring into the encounter deck or raises each player's threat by 5, then advances to stage 2", () => {
    for (const pick of ["lust", "threat"] as const) {
      const table = make({ stage: "142020", phase: "Planning", seats: 2, setAside: [LUST, REDHORN_PASS], deck: ["f3", "f3", "f3", "f3"], deckTop: ["grunt", "grunt"], deckTopTwo: ["grunt", "grunt"] });
      const stage = table.state.questStage ?? "";
      const ids = [...table.state.seats[0].deck.slice(0, 2), ...table.state.seats[1].deck.slice(0, 2)];
      const answers = [ids[0], ids[1], ids[2], pick] as string[];
      const state = fire(table, table.state, stage, "142020:forced:1", answers);
      const lustOut = state.setAside.some((id) => state.cards[id]?.code === LUST);
      expect(lustOut, pick).toBe(pick === "threat");
      expect(state.seats[0].threat, pick).toBe(pick === "threat" ? 13 : 8);
      expect(state.seats[1].threat, pick).toBe(pick === "threat" ? 11 : 6);
      // The quest is now stage 2: Redhorn Pass is active and the staging area holds at least X = 4 Threat.
      expect(state.cards[state.questStage ?? ""]?.code, pick).toBe("142021");
      expect(codesOf(state, [state.activeLocation ?? ""]), pick).toEqual([REDHORN_PASS]);
    }
  });

  it("assigns three cards when only three are faceup (a short deck), the last without asking", () => {
    const table = make({ stage: "142020", phase: "Planning", setAside: [LUST, REDHORN_PASS], deckTop: ["ally", "grunt", "filler"], deck: ["f3", "f3", "f3"] });
    const stage = table.state.questStage ?? "";
    const faceup = table.state.seats[0].deck.slice(0, 3);
    const state = fire(table, table.state, stage, "142020:forced:1", [faceup[0] ?? "", faceup[1] ?? "", "threat"]);
    expect(state.cards[faceup[0] ?? ""]?.zone).toBe("play");
    expect(state.cards[faceup[1] ?? ""]?.zone).toBe("hand");
    expect(state.cards[faceup[2] ?? ""]?.zone).toBe("discard");
  });
});

describe("stage 2A: the Nine Walkers (142021:A:1)", () => {
  it("makes Redhorn Pass the active location and reveals cards until the staging area holds twice as much Threat as there are players", () => {
    for (const seats of [1, 2] as const) {
      const table = make({ stage: "142021", seats, setAside: [REDHORN_PASS], deck: ["f3", "f3", "f3", "f3"] });
      const stage = table.state.questStage ?? "";
      const state = fire(table, table.state, stage, "142021:whenRevealed:1");
      expect(codesOf(state, [state.activeLocation ?? ""]), `${seats}`).toEqual([REDHORN_PASS]);
      // One player: 2 Threat is met by the first enemy (3). Two players: 4 Threat takes a second.
      expect(state.staging, `${seats}`).toHaveLength(seats);
      expect(stagingThreat(state, table.ctx.cards), `${seats}`).toBeGreaterThanOrEqual(2 * seats);
    }
  });

  it("stops when the encounter deck and its discard pile are empty", () => {
    const table = make({ stage: "142021", setAside: [REDHORN_PASS], deck: ["f0", "f0"] });
    const state = fire(table, table.state, table.state.questStage ?? "", "142021:whenRevealed:1");
    expect(state.staging).toHaveLength(2);
    expect(state.encounterDeck).toHaveLength(0);
  });
});

describe("damage on the active location after an enemy engages a player (142021:B:2, 142022:B:3, 142023:B:2)", () => {
  function engage(table: Table, enemy: string, state: ScenarioState = table.state): ScenarioState {
    const id = first(state, enemy);
    return settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "Engage", target: "self" }, { seat: 0, sourceId: id }, table.ctx, []), table.ctx), table.ctx, []);
  }

  it("stages 2 and 3 place 1 damage on the active location; with none it does nothing", () => {
    for (const stage of ["142021", "142022"] as const) {
      const table = make({ stage, active: "place", staging: ["grunt"] });
      const after = engage(table, "grunt");
      expect(after.cards[first(table.state, "place")]?.damage, stage).toBe(1);
      const none = make({ stage, staging: ["grunt"] });
      expect(() => engage(none, "grunt"), stage).not.toThrow();
    }
  });

  it("stage 4 places 1 damage on each active location, Doors of Durin included", () => {
    const table = make({ stage: "142023", active: DOORS, second: "place", staging: ["grunt"] });
    const after = engage(table, "grunt");
    expect(after.cards[first(table.state, DOORS)]?.damage).toBe(1);
    expect(after.cards[first(table.state, "place")]?.damage).toBe(1);
  });

  it("stage 3 places 1 damage on a location when it enters play", () => {
    const table = make({ stage: "142022", deck: ["place", "f0"] });
    const after = settle(syncConstants(runInstruction({ ...table.state, window: null }, { verb: "RevealEncounter" }, { seat: 0, sourceId: table.state.questStage }, table.ctx, []), table.ctx), table.ctx, []);
    expect(codesOf(after, after.staging)).toEqual(["place"]);
    expect(after.cards[after.staging[0] ?? ""]?.damage).toBe(1);
  });
});

describe("stage 3A: the Hunt is Up! (142022:A:1)", () => {
  it("each player searches the encounter deck and discard pile for an enemy; the first search must take Great Warg Chief", () => {
    const table = make({ stage: "142022", seats: 2, discard: [GREAT_WARG_CHIEF, "warg"], deck: ["warg2", "grunt", "place"] });
    const stage = table.state.questStage ?? "";
    const state = fire(table, table.state, stage, "142022:whenRevealed:1");
    const staging = codesOf(state, state.staging);
    expect(staging).toContain(GREAT_WARG_CHIEF);
    expect(staging).toHaveLength(2);
  });

  it("is free to take any enemy once Great Warg Chief is no longer in the deck or the discard pile", () => {
    const table = make({ stage: "142022", discard: ["warg"], deck: ["grunt", "place"] });
    const state = fire(table, table.state, table.state.questStage ?? "", "142022:whenRevealed:1");
    expect(state.staging).toHaveLength(1);
    expect(["warg", "grunt"]).toContain(codesOf(state, state.staging)[0]);
  });
});

describe("stage 4A: the Gates of Moria (142023:A:1)", () => {
  it("makes Doors of Durin active, adds the Watcher to the staging area, and hides the Ring-bearer under it", () => {
    const table = make({ stage: "142022", progress: 11, setAside: [DOORS, WATCHER] });
    const steps: EngineStep[] = [];
    const state = settle(syncConstants(runInstruction({ ...table.state, window: null }, { verb: "ProgressQuest", amount: 1 }, { seat: 0, sourceId: table.frodo }, table.ctx, steps), table.ctx), table.ctx, steps);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("142023");
    expect(codesOf(state, [state.activeLocation ?? ""])).toEqual([DOORS]);
    expect(codesOf(state, state.staging)).toEqual([WATCHER]);
    const frodo = state.cards[table.frodo]!;
    expect(frodo.zone).toBe("captive");
    expect(frodo.host).toBe(first(state, WATCHER));
    expect(state.seats[0].heroes).toEqual([table.sam]);
    // The Ring and the wound went with him; he is still in play.
    expect(frodo.attachments.map((id) => state.cards[id]?.zone)).toEqual(["attached", "attached"]);
    // 4B: there can be 2 active locations, and the players must travel.
    expect(state.modifiers.some((modifier) => modifier.stat === "extraActiveLocation")).toBe(true);
    expect(state.modifiers.some((modifier) => modifier.stat === "mustTravel")).toBe(true);
  });
});

// The quest card places the progress: Doors of Durin is immune to player card effects, so a hero's effect would place none on it.
describe("stage 4B: Doors of Durin explored wins (142023:B:3)", () => {
  it("wins when Doors of Durin is explored", () => {
    const table = make({ stage: "142023", active: DOORS });
    const steps: EngineStep[] = [];
    const state = settle(syncConstants(runInstruction({ ...table.state, window: null }, { verb: "ProgressQuest", amount: 9 }, { seat: 0, sourceId: table.state.questStage }, table.ctx, steps), table.ctx), table.ctx, steps);
    expect(state.stageCleared).toBe(true);
    expect(state.lost).toBe(false);
  });

  it("does not win when another location is explored", () => {
    const table = make({ stage: "142023", active: DOORS, second: "place" });
    const steps: EngineStep[] = [];
    const state = settle(syncConstants(runInstruction({ ...table.state, window: null }, { verb: "ProgressQuest", amount: 4 }, { seat: 0, sourceId: table.state.questStage }, table.ctx, steps), table.ctx), table.ctx, steps);
    expect(state.stageCleared).toBe(false);
  });
});

void legalIntents;
