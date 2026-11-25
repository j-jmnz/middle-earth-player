// Rules: rm.time-x, rr.cannot, rr.engaged, rr.guarded, rr.drawing-cards (data/rules/entries.json); ledger lines 07016:A:1, 07020:A:2, 07022:A:1, 07023:A:1, 07047:A:1, 07059:A:1.
// The engine the ring-maker family adds for The Fords of Isen: time counters taken off the current quest, a treachery that goes into a hand and stays, the enemy a discard puts into play engaged, a claimed objective lying on a location, and the table-level ban on card resources.
import { describe, expect, it } from "vitest";

import type { PickSpec } from "../../../catalog/boundary.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { destroyCard } from "../../core/keywords.ts";
import { moveCard } from "../../core/zones.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { discardRandom } from "../../interpret/verbs.ts";
import { settle } from "../../engine/machine.ts";
import { mayGainResources } from "../misc/guards.ts";
import { idOf, resolveRecords, revealedTop, run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-fords-of-isen";
const ILL_TIDINGS = "07023";
const GRIMA = "07016";
const ISLET = "07017";
const STAGE_1 = "07059";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const focus = { seat: 0, sourceId: null } as const;
// Stand-in cards of the scene kit: a hand to count and discard.
const FILLER = ["event", "ally", "event", "ally"] as const;

describe("RemoveTimeFromQuest (07020:A:2, 07022:A:1)", () => {
  const withCounters = (counters: number) => {
    const t = table({ stage: STAGE_1 });
    const stage = t.state.questStage ?? "";
    return { t, stage, state: updateCard(t.state, stage, { resources: counters }) };
  };

  it("07022:A:1 takes the counters off one at a time and stops at the number the stage holds", () => {
    const { t, stage, state } = withCounters(2);
    expect(run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 }).cards[stage]?.resources).toBe(1);
    const emptied = run(t, state, { verb: "RemoveTimeFromQuest", amount: 3 });
    expect(emptied.cards[stage]?.resources).toBe(0);
  });

  it("07059:B:2 the stage hears that its last counter is gone, and not before", () => {
    const { t, stage, state } = withCounters(2);
    const heard = (done: ScenarioState) => (done.pendingEvents ?? []).some((event) => event.trigger === "lastTimeCounterRemoved" && event.subject === stage);
    expect(heard(runInstruction({ ...state, mode: "stopped" }, { verb: "RemoveTimeFromQuest", amount: 1 }, focus, t.ctx, []))).toBe(false);
    expect(heard(runInstruction({ ...state, mode: "stopped" }, { verb: "RemoveTimeFromQuest", amount: 2 }, focus, t.ctx, []))).toBe(true);
  });

  it("a stage with no counters loses none and tells nobody", () => {
    const { t, state } = withCounters(0);
    const done = runInstruction({ ...state, mode: "stopped" }, { verb: "RemoveTimeFromQuest", amount: 1 }, focus, t.ctx, []);
    expect(done.pendingEvents ?? []).toEqual([]);
  });
});

describe("Ill Tidings in a hand (07023:A:1)", () => {
  const dealt = () => {
    const t = table({ hand: [...FILLER] });
    const state = revealedTop(t, ILL_TIDINGS);
    return { t, state, id: idOf(state, ILL_TIDINGS) };
  };

  it("07023:A:1 the revealed card goes into the first player's hand and is not discarded", () => {
    const { state, id } = dealt();
    expect(state.cards[id]?.zone).toBe("hand");
    expect(state.seats[0]?.hand).toContain(id);
    expect(state.encounterDiscard).not.toContain(id);
  });

  it("07023:A:1 no effect moves it out of the hand, a discard included", () => {
    const { t, state, id } = dealt();
    expect(moveCard(state, id, { zone: "encounterDiscard" }).cards[id]?.zone).toBe("hand");
    expect(moveCard(state, id, { zone: "discard", seat: 0 }).cards[id]?.zone).toBe("hand");
    const emptied = discardRandom(state, 0, 10, null, t.ctx);
    expect(emptied.seats[0]?.hand).toEqual([id]);
  });

  it("07023:A:1 a pick that discards from the hand leaves it out, and a pick that only counts keeps it", () => {
    const { t, state, id } = dealt();
    const discarding: PickSpec = { type: "card", control: "you", from: "hand", discarded: true };
    expect(pickCandidates(state, discarding, 0, [], null, t.ctx)).not.toContain(id);
    expect(pickCandidates(state, { type: "card", control: "you", from: "hand" }, 0, [], null, t.ctx, undefined, undefined, true)).toContain(id);
  });

  it("an eliminated player's hand leaves with the player", () => {
    const { state, id } = dealt();
    const out = { ...state, seats: state.seats.map((seat, index) => (index === 0 ? { ...seat, eliminated: true } : seat)) } as unknown as ScenarioState;
    expect(moveCard(out, id, { zone: "encounterDiscard" }).cards[id]?.zone).toBe("encounterDiscard");
  });

  it("07023:A:1 the surge is checked once the card is in the hand: 5 cards in the hand give it surge", () => {
    const four = table({ hand: FILLER.slice(0, 3), deck: ["07042"] });
    const five = table({ hand: [...FILLER], deck: ["07042"] });
    const staged = (made: ReturnType<typeof table>) => {
      const done = revealedTop(made, ILL_TIDINGS);
      return done.staging.map((id) => done.cards[id]?.code);
    };
    expect(staged(four)).not.toContain("07042");
    expect(staged(five)).toContain("07042");
  });
});

describe("EngageTopDiscarded (07047:A:1)", () => {
  it("07047:A:1 of the cards discarded the last Dunland enemy goes into play engaged with the player, the deck below it untouched", () => {
    const t = table({ hand: ["event", "ally", "event"], deck: ["07048", "07021", "07044", "07022", "07043"] });
    const done = resolveRecords(t.state, t.ctx, "07047", "forced").state;
    const where = (code: string) => done.cards[idOf(done, code)]?.zone;
    expect(where("07044")).toBe("engaged");
    expect(done.seats[0]?.engaged.map((id) => done.cards[id]?.code)).toContain("07044");
    expect(where("07048")).toBe("encounterDiscard");
    expect(where("07021")).toBe("encounterDiscard");
    expect(where("07022")).toBe("encounterDeck");
  });

  it("07047:A:1 with no Dunland enemy among the discarded cards nothing is engaged", () => {
    const t = table({ hand: ["event", "ally"], deck: ["07021", "07022", "07048"] });
    const done = resolveRecords(t.state, t.ctx, "07047", "forced").state;
    expect(done.seats[0]?.engaged).toEqual([]);
  });
});

describe("Gríma lying on The Islet (07059:A:1, 07016:A:1)", () => {
  const lying = () => {
    const t = table({ staging: [ISLET], setAside: [GRIMA] });
    const state = run(t, t.state, { verb: "AttachSetAsideTo", code: GRIMA, to: "The Islet", uncontrolled: true, claimed: true });
    return { t, state, grima: idOf(state, GRIMA), islet: idOf(state, ISLET) };
  };

  it("07059:A:1 he lies attached to The Islet, claimed and controlled by nobody", () => {
    const { state, grima, islet } = lying();
    expect(state.cards[grima]).toMatchObject({ zone: "attached", host: islet, claimed: true, controller: null });
  });

  it("07016:A:1 when The Islet leaves play he is back in the staging area, then the first player gains control", () => {
    const { t, state, grima, islet } = lying();
    const steps: never[] = [];
    const explored = destroyCard(state, islet, t.ctx.cards, steps, true);
    expect(explored.cards[grima]?.zone).toBe("staging");
    expect(explored.cards[grima]?.claimed).toBeUndefined();
    const claimed = settle({ ...explored, window: null, mode: "stopped" }, t.ctx, steps);
    expect(claimed.cards[grima]).toMatchObject({ zone: "play", controller: 0 });
    expect(claimed.lost).toBeFalsy();
  });
});

describe("the players cannot advance without Gríma (07059:B:3)", () => {
  it("07059:B:3 a full stage waits while Gríma lies on The Islet and advances once the first player gains him", () => {
    const t = table({ stage: STAGE_1, staging: [ISLET], setAside: [GRIMA], progress: 99 });
    const lying = run(t, t.state, { verb: "AttachSetAsideTo", code: GRIMA, to: "The Islet", uncontrolled: true, claimed: true });
    const stage = lying.questStage ?? "";
    const waiting = settle({ ...lying, window: null, mode: "stopped" }, t.ctx, []);
    expect(waiting.questStage).toBe(stage);
    const freed = destroyCard(waiting, idOf(waiting, ISLET), t.ctx.cards, [], true);
    const done = settle({ ...freed, window: null, mode: "stopped" }, t.ctx, []);
    expect(done.cards[idOf(done, GRIMA)]).toMatchObject({ zone: "play", controller: 0 });
    expect(done.questStage).not.toBe(stage);
  });
});

describe("Gríma leaves play (07016:A:3)", () => {
  const held = () => {
    const t = table({ seats: 2, staging: [ISLET], setAside: [GRIMA] });
    const lying = run(t, t.state, { verb: "AttachSetAsideTo", code: GRIMA, to: "The Islet", uncontrolled: true, claimed: true });
    const freed = settle({ ...destroyCard(lying, idOf(lying, ISLET), t.ctx.cards, [], true), window: null, mode: "stopped" }, t.ctx, []);
    return { t, state: freed };
  };

  it("07016:A:3 a first player who is eliminated while he holds Gríma loses the game for everyone", () => {
    const { t, state } = held();
    expect(state.cards[idOf(state, GRIMA)]?.controller).toBe(0);
    const out = { ...state, seats: state.seats.map((seat, index) => (index === 0 ? { ...seat, eliminated: true } : seat)) } as unknown as ScenarioState;
    const done = settle({ ...out, window: null, mode: "stopped" }, t.ctx, []);
    expect(done.lost).toBe(true);
  });

  it("07059:B:2 Gríma discarded by the stage loses the game, held or lying on The Islet", () => {
    const { t, state } = held();
    expect(run(t, state, { verb: "DiscardNamedFromPlay", name: "Gríma" }).lost).toBe(true);
    const lying = table({ staging: [ISLET], setAside: [GRIMA] });
    const on = run(lying, lying.state, { verb: "AttachSetAsideTo", code: GRIMA, to: "The Islet", uncontrolled: true, claimed: true });
    expect(run(lying, on, { verb: "DiscardNamedFromPlay", name: "Gríma" }).lost).toBe(true);
  });
});

describe("noCardResources on the table (07018:A:1)", () => {
  it("07018:A:1 no hero gains resources from a card while Fords of Isen is in the staging area, and the collection has no card", () => {
    const t = table({ staging: ["07018"] });
    const hero = t.state.seats[0].heroes[0] ?? "";
    const held = t.state.modifiers.some((modifier) => modifier.instanceId === "table" && modifier.stat === "noCardResources");
    expect(held).toBe(true);
    expect(mayGainResources(t.state, hero, idOf(t.state, "07018"), t.ctx)).toBe(false);
    expect(mayGainResources(t.state, hero, null, t.ctx)).toBe(true);
    const none = table({});
    expect(mayGainResources(none.state, hero, idOf(t.state, "07018") && null, none.ctx)).toBe(true);
  });
});
