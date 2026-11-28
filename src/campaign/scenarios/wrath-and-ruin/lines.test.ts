// Rules: vom.controlling-locations, vom.losing-control-of-a-location, rr.forced, rr.travel, rr.cancel, rr.destroy, rr.first-player, rr.the-letter-x, rr.reveal, faq.cancel-encounter-card (data/rules/entries.json).
// What a spec row cannot show (a second seat, a sentinel defender, a travel the engine refuses, the order of two seats' attacks, a cancel offer, X fixed at reveal, the stage gates). Each title starts with its line id.
import { describe, expect, test } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { controlledLocations, controllerOf } from "../../../rules/families/pelargir/location-control.ts";
import { placeDamage } from "../../../rules/core/damage.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { advanceFreed } from "../../../rules/quest/stage-reveal.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { finish, idOf, legalIntents, opened, resolveRecords, run, send, tableFromLayout, where, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { IntentRefused } from "../../../../test/harness/scene.ts";

const ID = "wrath-and-ruin";
const S1 = "22025";
const S2 = "22026";
const ULCHOR = "22011";
const SKIRMISHER = "22013";
const GATE = "22014";
const HOUSE = "22016";
const TOWER = "22018";
const FURY = "22019";
const CAUGHT = "22020";
const SIEGE = "22022";
const REVENGE = "22023";
const STREET = "22021";
const RAIDER = "21020";
const WARRIOR = "21021";
const table = (layout: Layout, effects = EFFECTS, extra: readonly string[] = []) => tableFromLayout(ID, { seats: 1, stage: S1, phase: "Quest", ...layout }, { effects, extra });
const settled = (made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, made.ctx, []);
// The answers of a row of choices, one for each window a choice opens.
const answers = (...ids: string[]) => {
  const queue = [...ids];
  return (state: ScenarioState) => (state.window?.kind === "choose" ? (queue.shift() ?? state.window.options[0] ?? "") : "");
};

describe("22013:A:2 the controller of the destroyed character returns his location", () => {
  lineSpec("22013:A:2", "a sentinel of the other player is destroyed: that player returns the location he controls, not the defending player", (effects) => {
    const made = table({ seats: 2, firstPlayer: 1, controlled: ["place"], engaged: [SKIRMISHER], play: [{ code: "ally", seat: 1 }] }, effects);
    const state = opened(made).state;
    expect(controllerOf(state, idOf(state, "place"))).toBe(1);
    const steps: EngineStep[] = [];
    const heard = fireForced({ ...state, window: null }, { trigger: "characterDestroyedByAttack", seat: 1, subject: idOf(state, "ally"), other: idOf(state, SKIRMISHER) }, made.ctx, steps);
    const done = finish({ state: settle(heard, made.ctx, steps), steps }, made.ctx);
    expect(where(done.state, "place")).toBe("staging");
  });
});

describe("22016:A:1 Ransacked House is taken by the player who plays the action", () => {
  lineSpec("22016:A:1", "the second player's action: the enemy engages him and he controls the House", (effects) => {
    const made = table({ seats: 2, staging: [HOUSE], discard: [WARRIOR, RAIDER] }, effects);
    const state = opened(made).state;
    const done = resolveRecords(state, made.ctx, HOUSE, "action", idOf(state, HOUSE), undefined, true, 1);
    expect(done.state.cards[idOf(done.state, RAIDER)]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(controllerOf(done.state, idOf(done.state, HOUSE))).toBe(1);
  });
});

describe("22018 Captured Tower", () => {
  lineSpec("22018:A:1", "no cancel of the whole revealed encounter card is offered while it is the active location", (effects) => {
    const offered = (layout: Layout) => {
      const made = table({ hand: ["21009"], attached: [{ code: "21001", to: "dh1" }], deck: ["f3", "f0"], ...layout }, effects, ["21001", "21009"]);
      const state = send(opened(made), { type: "Pass" }, made.ctx).state;
      return legalIntents(state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "21009:response:1");
    };
    expect(offered({ staging: [TOWER] })).toBe(true);
    expect(offered({ active: TOWER })).toBe(false);
  });
});

describe("22019:A:3 Fury skips an enemy that has Fury", () => {
  lineSpec("22019:A:3", "a second copy goes to the other Easterling enemy", (effects) => {
    const made = table({ staging: ["22012", SKIRMISHER], attached: [{ code: FURY, to: SKIRMISHER, encounter: true }] }, effects);
    const state = opened(made).state;
    const second = resolveRecords(state, made.ctx, FURY, "whenRevealed", undefined);
    expect(second.state.cards[idOf(state, "22012")]?.attachments).toContain(second.id);
  });
});

describe("22020:A:1 Caught Off Guard asks each player in turn", () => {
  lineSpec("22020:A:1", "the first player returns his location, the second player takes the enemy engaged with him", (effects) => {
    const made = table({ seats: 2, controlled: ["place"], deck: ["22021", WARRIOR] }, effects);
    const state = opened(made).state;
    const done = resolveRecords(state, made.ctx, CAUGHT, "whenRevealed", undefined, answers("return", "enemy"), true, 0);
    expect(where(done.state, "place")).toBe("staging");
    expect(done.state.cards[idOf(done.state, WARRIOR)]).toMatchObject({ zone: "engaged", controller: 1 });
  });
});

describe("22022:A:1 Under Siege fixes X when it is revealed", () => {
  lineSpec("22022:A:1", "control gained afterwards in the phase does not raise the Threat it added", (effects) => {
    const made = table({ staging: ["22016", "22015"], controlled: ["place"] }, effects);
    const state = opened(made).state;
    const revealed = settled(made, resolveRecords(state, made.ctx, SIEGE, "whenRevealed", undefined).state);
    expect(stagingThreat(revealed, made.ctx.cards)).toBe(5);
    const more = settled(made, run(made, revealed, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(state, "22016") }));
    expect(stagingThreat(more, made.ctx.cards)).toBe(3);
  });
});

describe("22014 Gate of Dorwinion travel", () => {
  const travelTo = (layout: Layout, effects = EFFECTS) => {
    const made = table({ phase: "Travel", staging: [GATE], ...layout }, effects);
    return { made, state: opened(made).state };
  };
  const refused = (layout: Layout, effects?: typeof EFFECTS): boolean => {
    const { made, state } = travelTo(layout, effects);
    try {
      send({ state, steps: [] }, { type: "Travel", locationId: idOf(state, GATE) }, made.ctx);
      return false;
    } catch (error) {
      if (error instanceof IntentRefused) return true;
      throw error;
    }
  };
  lineSpec("22014:A:3", "stage 2B with 11 progress bars travel to the Gate, with 12 progress it is allowed", (effects) => {
    expect(refused({ stage: S2, progress: 12, controlled: ["place", "place"] }, effects)).toBe(false);
    expect(refused({ stage: S2, progress: 11, controlled: ["place", "place"] }, effects)).toBe(true);
  });
  lineSpec("22014:A:3", "at stage 1 the Gate is never travelled to, whatever the progress", (effects) => {
    expect(refused({ stage: S1, progress: 12, controlled: ["place", "place"] }, effects)).toBe(true);
  });
  lineSpec("22026:B:2", "no travel to the Gate unless the players control more locations than the staging area holds", (effects) => {
    expect(refused({ stage: S2, progress: 12, controlled: ["place"] }, effects)).toBe(true);
    expect(refused({ stage: S2, progress: 12, controlled: ["place", "place"] }, effects)).toBe(false);
  });
  lineSpec("22014:A:4", "Travel: Ulchor attacks each player in turn order, the first player first", (effects) => {
    const { made, state } = travelTo({ seats: 2, stage: S2, progress: 12, staging: [GATE, ULCHOR], controlled: ["place", "place"] }, effects);
    const first = send({ state, steps: [] }, { type: "Travel", locationId: idOf(state, GATE) }, made.ctx);
    const seats: number[] = [];
    let current = first;
    for (let guard = 0; guard < 12 && current.state.window?.kind !== undefined && seats.length < 3; guard += 1) {
      if (current.state.window?.kind === "defense") {
        seats.push(current.state.pendingAttack?.seat ?? -1);
        const hero = current.state.seats[current.state.pendingAttack?.seat ?? 0]?.heroes[0] ?? "";
        current = send(current, { type: "Undefended", heroId: hero }, made.ctx);
      } else if (current.state.window?.kind === "choose") current = finish(current, made.ctx);
      else break;
    }
    expect(seats).toEqual([0, 1]);
  });
});

describe("22025:B:2 a controlled location is not a travel target", () => {
  const travelRefused = (effects: typeof EFFECTS, layout: Layout, code: string): boolean => {
    const made = table({ phase: "Travel", ...layout }, effects);
    const state = opened(made).state;
    const target = controlledLocations(state).find((id) => state.cards[id]?.code === code);
    expect(target).toBeDefined();
    try {
      send({ state, steps: [] }, { type: "Travel", locationId: target ?? "" }, made.ctx);
      return false;
    } catch (error) {
      if (error instanceof IntentRefused) return true;
      throw error;
    }
  };
  test("22025:B:2 the players never travel to a location they control, the Gate included", () => {
    expect(travelRefused(EFFECTS, { stage: S2, progress: 12, controlled: [GATE, "place"] }, GATE)).toBe(true);
    expect(travelRefused(EFFECTS, { stage: S2, progress: 12, staging: [ULCHOR], controlled: [GATE, "22015"] }, "22015")).toBe(true);
  });
});

describe("22025:B:3 and 22026:B:2 the stage gates", () => {
  const full = (effects = EFFECTS, layout: Layout = {}) => table({ stage: S1, progress: 30, staging: ["22016", "22015", "21046"], ...layout }, effects);
  const sweep = (made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState): ScenarioState => advanceFreed(settle({ ...state, window: null, mode: "stopped" }, made.ctx, []), made.ctx, [] as EngineStep[]);
  lineSpec("22025:B:3", "a full stage is defeated only at the end of a round in which the players control more locations than the staging area holds", (effects) => {
    const made = full(effects);
    const base = opened(made).state;
    expect(sweep(made, base).questStage).toBe(base.questStage);
    const ahead = ["22015", "22016"].reduce((state, code) => run(made, state, { verb: "TakeControlOfLocation", card: "self" }, { sourceId: idOf(base, code) }), base);
    expect(controlledLocations(ahead)).toHaveLength(2);
    const marked = resolveRecords(ahead, made.ctx, S1, "forced", idOf(base, S1), undefined, false).state;
    expect(sweep(made, marked).questStage).not.toBe(base.questStage);
    const behind = resolveRecords(base, made.ctx, S1, "forced", idOf(base, S1), undefined, false).state;
    expect(sweep(made, behind).questStage).toBe(base.questStage);
  });
  lineSpec("22026:B:4", "at the end of the round the players win only when they control the Gate", (effects) => {
    const won = (layout: Layout) => {
      const made = table({ stage: S2, ...layout }, effects);
      const state = opened(made).state;
      return resolveRecords(state, made.ctx, S2, "forced", idOf(state, S2), undefined, false).state;
    };
    expect(won({ controlled: [GATE] }).stageCleared).toBe(true);
    expect(won({ staging: [GATE] }).stageCleared).toBeFalsy();
  });
});

describe("22023:A:2 Ulchor's Revenge attacks each player who controls a location", () => {
  // The second seat takes control of a location the way a card for the acting player does (TakeControlOfLocation `who: actor`).
  const control = (made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState, code: string, seat: number): ScenarioState => run(made, state, { verb: "TakeControlOfLocation", card: "self", who: "actor" }, { seat, sourceId: idOf(state, code) });
  const attacked = (effects: typeof EFFECTS, seats: readonly number[]): number[] => {
    const made = table({ seats: 2, staging: [ULCHOR, "22015", "22016"] }, effects);
    let state = opened(made).state;
    if (seats.includes(0)) state = control(made, state, "22015", 0);
    if (seats.includes(1)) state = control(made, state, "22016", 1);
    let current: Run = resolveRecords(state, made.ctx, REVENGE, "whenRevealed", undefined, undefined, true);
    const order: number[] = [];
    for (let guard = 0; guard < 6 && current.state.window?.kind === "defense"; guard += 1) {
      const seat = current.state.pendingAttack?.seat ?? -1;
      order.push(seat);
      current = send(current, { type: "Undefended", heroId: current.state.seats[seat]?.heroes[0] ?? "" }, made.ctx);
    }
    return order;
  };
  lineSpec("22023:A:2", "both players control a location: seat 0 is attacked first, then seat 1", (effects) => {
    expect(attacked(effects, [0, 1])).toEqual([0, 1]);
  });
  lineSpec("22023:A:2", "only the second player controls a location: only he is attacked", (effects) => {
    expect(attacked(effects, [1])).toEqual([1]);
  });
});

describe("22021:A:1 Street Fighting hurts both seats", () => {
  lineSpec("22021:A:1", "each player assigns X damage: 2 for the player with a location, 1 for the other", (effects) => {
    const made = table({ seats: 2, controlled: ["place"] }, effects);
    const state = opened(made).state;
    const done = resolveRecords(state, made.ctx, STREET, "whenRevealed", undefined, undefined, true);
    const heroOf = (seat: number) => done.state.cards[done.state.seats[seat]?.heroes[0] ?? ""];
    expect(heroOf(0)?.damage).toBe(2);
    expect(heroOf(1)?.damage).toBe(1);
  });
});

describe("22019:A:2 Fury heals the enemy instead of its destruction", () => {
  lineSpec("22019:A:2", "lethal damage on the enemy heals it and discards Fury", (effects) => {
    const made = table({ staging: [RAIDER], attached: [{ code: FURY, to: RAIDER, encounter: true }] }, effects);
    const base = opened(made).state;
    const enemy = idOf(base, RAIDER);
    const hit = settled(made, placeDamage(base, enemy, 99, made.ctx.cards, [], "framework", ruleCause("rr.damage")));
    expect(hit.cards[enemy]).toMatchObject({ zone: "staging", damage: 0 });
    expect(where(hit, FURY)).toBe("encounterDiscard");
  });
});

describe("22016:A:1 and 22018:A:2 the player who takes control is the one who acts", () => {
  lineSpec("22018:A:2", "the second player takes the Tower: the first enemy of the shuffled discard pile engages him", (effects) => {
    const made = table({ seats: 2, staging: [TOWER], discard: [WARRIOR], deck: ["f3"] }, effects);
    const state = opened(made).state;
    const taken = settled(made, run(made, state, { verb: "TakeControlOfLocation", card: "self", who: "actor" }, { seat: 1, sourceId: idOf(state, TOWER) }));
    expect(taken.cards[idOf(taken, WARRIOR)]).toMatchObject({ zone: "engaged", controller: 1 });
  });
});
