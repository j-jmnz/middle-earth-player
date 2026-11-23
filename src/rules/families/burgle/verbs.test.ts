import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { startReveal } from "../../windows/frames.ts";
import { ally, enemy, hero, send, table, treachery, type TableSpec } from "../defense/table.ts";
import { STOP } from "../mount-doom/stop.ts";
import { noteSpent } from "../costs/pay.ts";

// Rules: hob.burgle, rr.resources, rr.first-player, rr.surge, rr.damage (data/rules/entries.json); ledger lines 132049:A:1, 132050:A:1, 132051:A:1, 132048:A:2, 132045:A:2, 132046:A:1, 132041:A:2. The small verbs, conditions and Pick filters the Lonely Mountain's cards add beside the burgle attempt.

const dragon = (code: string) => enemy(code, { traits: ["Dragon"], threat: 2 });
const flag = (id: string, stat: "cannotLeaveStaging") => ({ instanceId: id, sourceId: id, stat, amount: 1, until: "endOfGame" as const });

type Options = Partial<TableSpec> & { instructions: readonly Instruction[] };

// A table whose effect frame runs `instructions` for seat 0 and settles to the first window it opens.
function begin(options: Options) {
  const { instructions, effects = [], ...rest } = options;
  const base = table({ cards: [hero("a"), hero("b"), hero("c"), definePrinted({ code: "bag", name: "bag", type: "hero", sphere: "baggins", threat: 9, willpower: 1, attack: 1, defense: 1, health: 3 }), ally("x"), dragon("d1"), dragon("d2"), enemy("orc"), treachery("t1"), treachery("t2"), treachery("t3"), definePrinted({ code: "ev", name: "ev", type: "event", sphere: "tactics", cost: 1 }), definePrinted({ code: "loc", name: "loc", type: "location", threat: 1, questPoints: 3 })], effects, heroes: [{ code: "a" }], ...rest });
  const pushed = pushEffectFrame({ ...base.state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...instructions, STOP], cancel: null, blockCancel: null }, []);
  return { ...base, state: settle(pushed, base.ctx, []) };
}

const threatMods = (state: ScenarioState) => state.modifiers.filter((modifier) => modifier.stat === "threat").map((modifier) => [state.cards[modifier.instanceId]?.code ?? modifier.instanceId, modifier.amount, modifier.until]);

describe("DiscardRandomRaiseThreat (132049:A:1)", () => {
  const verb: Instruction = { verb: "DiscardRandomRaiseThreat", amount: 2, cardType: "event", trait: "Dragon" };

  // The Threat each card reads now: the bonus is a class modifier, so it counts for a Dragon that enters play later too.
  const threatOf = (run: ReturnType<typeof begin>, key: string) => modifiedStat(run.state, run.state.cards[run.ids[key] ?? ""] as CardInstance, "threat", run.ctx.cards);
  const without = (state: ScenarioState): ScenarioState => ({ ...state, modifiers: [] });

  it("gives each Dragon in play +1 Threat until the end of the phase for each event discarded", () => {
    const run = begin({ instructions: [verb], hand: [{ code: "ev" }, { code: "ev" }, { code: "x" }], staging: [{ code: "d1" }, { code: "orc" }], enemies: [{ code: "d2" }] });
    expect(run.state.seats[0]?.discard.length).toBe(2);
    const events = run.state.seats[0]?.discard.filter((id) => run.state.cards[id]?.code === "ev").length ?? 0;
    expect(threatMods(run.state)).toEqual([["enemies:Dragon", events, "endOfPhase"]]);
    const plain = { ...run, state: without(run.state) };
    expect([threatOf(run, "d1") - threatOf(plain, "d1"), threatOf(run, "d2") - threatOf(plain, "d2"), threatOf(run, "orc") - threatOf(plain, "orc")]).toEqual([events, events, 0]);
  });

  it("counts the events of every player together", () => {
    const run = begin({ seatCount: 2, heroes: [{ code: "a" }, { code: "b", seat: 1 }], instructions: [verb], hand: [{ code: "ev" }, { code: "ev" }, { code: "ev", seat: 1 }, { code: "ev", seat: 1 }], staging: [{ code: "d1" }] });
    expect(threatMods(run.state)).toEqual([["enemies:Dragon", 4, "endOfPhase"]]);
    expect(threatOf(run, "d1") - threatOf({ ...run, state: without(run.state) }, "d1")).toBe(4);
  });

  it("raises nothing when no event is discarded, and discards fewer cards from a smaller hand", () => {
    const none = begin({ instructions: [verb], hand: [{ code: "x" }], staging: [{ code: "d1" }] });
    expect(none.state.seats[0]?.hand.length).toBe(0);
    expect(threatMods(none.state)).toEqual([]);
  });
});

describe("AttackHighestWillpower (132050:A:1)", () => {
  const attack: Instruction[] = [{ verb: "Each", pick: { type: "enemy", control: "any", stagingOnly: true, traits: ["Dragon"] }, instructions: [{ verb: "AttackHighestWillpower" }] }];
  const committed = (state: ScenarioState, ids: Record<string, string>, ...keys: string[]) => keys.reduce((next, key) => updateCard(next, ids[key] ?? "", { committed: true }), state);

  function twoSeats(committedKeys: string[]) {
    const base = table({ seatCount: 2, cards: [hero("a", { willpower: 2 }), hero("b", { willpower: 2 }), dragon("d1")], effects: [], heroes: [{ code: "a" }, { code: "b", seat: 1 }], staging: [{ code: "d1" }] });
    const state = committed({ ...base.state, window: null }, base.ids, ...committedKeys);
    const pushed = pushEffectFrame(state, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [...attack, STOP], cancel: null, blockCancel: null }, []);
    return { ...base, state: settle(pushed, base.ctx, []) };
  }

  it("attacks the player with the highest total Willpower committed, with no shadow card dealt", () => {
    const run = twoSeats(["b"]);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 1 });
    expect(run.state.pendingAttack?.seat).toBe(1);
    expect(run.state.cards[run.ids.d1 ?? ""]?.shadowId ?? null).toBeNull();
  });

  it("asks the first player to choose between players tied for it", () => {
    const run = twoSeats(["a", "b"]);
    expect(run.state.window).toEqual({ kind: "choose", seat: 0, options: ["seat:0", "seat:1"] });
    const chosen = send(run.state, { type: "Choose", optionId: "seat:1" }, run.ctx);
    expect(chosen.pendingAttack?.seat).toBe(1);
  });

  it("makes no attack when the enemy is not in the staging area", () => {
    const base = table({ cards: [hero("a"), dragon("d1")], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "d1" }] });
    const pushed = pushEffectFrame({ ...base.state, window: null }, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", traits: ["Dragon"] } }, { verb: "AttackHighestWillpower" }, STOP], cancel: null, blockCancel: null }, []);
    expect(settle(pushed, base.ctx, []).pendingAttack).toBeNull();
  });
});

describe("SpendBaggins and bagginsAtLeast (132048:A:2)", () => {
  const spend: Instruction = { verb: "SpendBaggins", amount: 2 };
  const resources = (state: ScenarioState, ids: Record<string, string>) => state.cards[ids.bag ?? ""]?.resources ?? 0;

  it("spends the resources of the heroes with a Baggins icon, and announces them as spent", () => {
    const run = begin({ instructions: [spend], heroes: [{ code: "bag" }, { code: "a" }], resources: 3 });
    expect(resources(run.state, run.ids)).toBe(1);
    expect(run.state.cards[run.ids.a ?? ""]?.resources).toBe(3);
  });

  it("spends nothing when the pools hold fewer, and the condition says so", () => {
    const run = begin({ instructions: [{ verb: "SpendBaggins", amount: 4 }, { verb: "RaiseThreat", amount: 1, when: { kind: "bagginsAtLeast", amount: 4 } }], heroes: [{ code: "bag" }, { code: "a" }], resources: 3 });
    expect(resources(run.state, run.ids)).toBe(3);
    expect(run.state.seats[0]?.threat).toBe(20);
    const enough = begin({ instructions: [{ verb: "RaiseThreat", amount: 1, when: { kind: "bagginsAtLeast", amount: 3 } }], heroes: [{ code: "bag" }], resources: 3 });
    expect(enough.state.seats[0]?.threat).toBe(21);
  });
});

describe("encounterTop (132045:A:2)", () => {
  const raise = (cardType: "enemy" | "location" | "treachery" | "objective"): Instruction => ({ verb: "RaiseThreat", amount: 1, when: { kind: "encounterTop", cardType } });

  it("reads the type of the top card of the encounter deck, false with an empty deck", () => {
    expect(begin({ instructions: [raise("treachery")], encounter: ["t1", "orc"] }).state.seats[0]?.threat).toBe(21);
    expect(begin({ instructions: [raise("enemy")], encounter: ["t1", "orc"] }).state.seats[0]?.threat).toBe(20);
    expect(begin({ instructions: [raise("enemy")] }).state.seats[0]?.threat).toBe(20);
  });
});

describe("FirstTreacherySurge (132046:A:1)", () => {
  const marker: Effect = { id: "loc:constant:1", cardCode: "loc", lines: ["loc:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "FirstTreacherySurge" }] };

  function reveals(count: number, withMarker: boolean) {
    const base = table({ cards: [hero("a"), treachery("t1"), treachery("t2"), treachery("t3"), enemy("orc"), definePrinted({ code: "loc", name: "loc", type: "location", threat: 1, questPoints: 3 })], effects: withMarker ? [marker] : [], heroes: [{ code: "a" }], staging: withMarker ? [{ code: "loc" }] : [], encounter: ["t1", "t2", "t3", "orc"] });
    let state = base.state;
    for (let each = 0; each < count; each += 1) {
      const steps: never[] = [];
      state = settle(startReveal({ ...state, window: null }, 0, base.ctx, steps), base.ctx, steps);
    }
    return state;
  }

  it("gives the first treachery revealed each round surge, and only that one", () => {
    // One reveal: the treachery surges, so its reveal is followed by the next card's.
    expect(reveals(1, true).encounterDiscard.length).toBe(2);
    // The second reveal is not the round's first: no surge.
    expect(reveals(2, true).encounterDiscard.length).toBe(3);
    // With no holder in play there is no surge.
    expect(reveals(1, false).encounterDiscard.length).toBe(1);
  });
});

describe("the Pick filter mostResources (132051:A:1)", () => {
  it("offers only the heroes holding the most resources", () => {
    const base = table({ cards: [hero("a"), hero("b"), hero("c")], effects: [], heroes: [{ code: "a" }, { code: "b" }, { code: "c" }] });
    const poor = updateCard({ ...base.state, window: null }, base.ids.a ?? "", { resources: 1 });
    const ready = ["b", "c"].reduce((state, key) => updateCard(state, base.ids[key] ?? "", { resources: 3 }), poor);
    const pushed = pushEffectFrame(ready, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", mostResources: true } }, { verb: "RaiseThreat", amount: 1 }, STOP], cancel: null, blockCancel: null }, []);
    const state = settle(pushed, base.ctx, []);
    expect(state.window).toMatchObject({ kind: "choose" });
    expect(state.window?.kind === "choose" ? [...state.window.options].sort() : []).toEqual([base.ids.b, base.ids.c].sort());
  });
});

describe("the amount a heroResourcesSpent event carries (132051:A:1)", () => {
  const spell: Effect = { id: "spell:forced:1", cardCode: "spell", lines: ["spell:A:1"], timing: "forced", trigger: "heroResourcesSpent", subject: "host", instructions: [{ verb: "DamageCard", amount: { x: true }, target: "host" }] };

  it("damages the hero by the resources it spent", () => {
    const base = table({ cards: [hero("a", { health: 8 }), definePrinted({ code: "spell", name: "spell", type: "treachery" })], effects: [spell], heroes: [{ code: "a" }], attachments: [{ code: "spell", host: "a" }] });
    const heroId = base.ids.a ?? "";
    const spent = settle(noteSpent({ ...base.state, window: null }, [{ heroId, amount: 3 }], base.ctx), base.ctx, []);
    expect(spent.cards[heroId]?.damage).toBe(3);
  });
});

describe("SetAsideInPlay byQuest (132041:A:2)", () => {
  const set = (byQuest: boolean) => {
    const base = table({ cards: [hero("a"), dragon("d1")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "d1" }] });
    const id = base.ids.d1 ?? "";
    const held = { ...base.state, window: null, modifiers: [flag(id, "cannotLeaveStaging")] };
    const pushed = pushEffectFrame(held, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "SetAsideInPlay", code: "d1", ...(byQuest ? { byQuest: true as const } : {}) }, STOP], cancel: null, blockCancel: null }, []);
    return settle(pushed, base.ctx, []).cards[id]?.zone;
  };

  it("lets a quest card's effect set aside a card that cannot leave the staging area, and nothing else", () => {
    expect(set(false)).toBe("staging");
    expect(set(true)).toBe("setAside");
  });
});
