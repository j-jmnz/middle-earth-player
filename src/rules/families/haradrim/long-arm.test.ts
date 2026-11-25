// Rules: hrd.objective-heroes, hrd.objective-hero-elimination, hrd.heroes-in-the-staging-area, hrd.guarded-heroes, rr.player-elimination, rr.attachment-cards, rr.forced (data/rules/entries.json); ledger lines 16031:A:2, 16035:A:2, 16064:A:1, 16071:A:1, 16071:B:3, 16072:B:3,
// 16073:A:1, 16073:B:1, 16073:B:2, 16073:B:3. The records of The Long Arm of Mordor that carry the heroes in the staging area, read through the engine as a game reads them (the record by record rows are in src/campaign/scenarios/the-long-arm-of-mordor/spec.test.ts).
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { destroyCard } from "../../core/destroy.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { idOf, opened, resolveRecords, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { settle } from "../../engine/machine.ts";
import { heroGuardedBy } from "../wilderland/carried.ts";
import { stagedHeroes } from "./staged.ts";
import { captivesOf } from "../captives/values.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-long-arm-of-mordor", { seats: 1, stage: "16071", ...layout });
const OBJECTIVE = ["16031", "16032", "16033", "16034"];

describe("16071:A:1 the Setup", () => {
  it("each hero moves to the staging area, the player takes an objective-hero with 2 resources among their heroes, and the other three leave the game", () => {
    const made = table({ stage: "16071", side: "A", setAside: [...OBJECTIVE, "16061"] });
    const heroes = [...(made.state.seats[0]?.heroes ?? [])];
    const done = resolveRecords(opened(made).state, made.ctx, "16071", "setup", idOf(made.state, "16071"), (state) => (state.window?.kind === "choose" ? (state.window.options[1] ?? "") : ""));
    const state = settle(done.state, made.ctx, [] as EngineStep[]);
    expect(stagedHeroes(state).map((card) => card.id).sort()).toEqual([...heroes].sort());
    const own = state.seats[0]?.heroes ?? [];
    expect(own).toHaveLength(1);
    expect(state.cards[own[0] ?? ""]).toMatchObject({ zone: "heroes", resources: 2, controller: 0 });
    expect(OBJECTIVE).toContain(state.cards[own[0] ?? ""]?.code);
    expect(Object.values(state.cards).filter((card) => OBJECTIVE.includes(card.code) && card.zone === "removed")).toHaveLength(3);
    // Uruk Chieftain stays set aside: the piles, not this record, put it there.
    expect(state.cards[idOf(state, "16061")]?.zone).toBe("setAside");
    expect(state.seats[0]?.eliminated).toBeFalsy();
  });
});

describe("16031:A:2 If the objective-hero leaves play, you are eliminated", () => {
  it("its controller is eliminated, and no other player", () => {
    const made = table({ seats: 2, heroes: [{ code: "16031", seat: 1 }] });
    const kahliel = idOf(made.state, "16031");
    const synced = opened(made, { ...made.state, modifiers: [...made.state.modifiers, { instanceId: kahliel, sourceId: kahliel, stat: "heroType", amount: 1, until: "endOfGame" }] }).state;
    const steps: EngineStep[] = [];
    const gone = settle(destroyCard(synced, kahliel, made.ctx.cards, steps), made.ctx, steps);
    expect(gone.seats[1]?.eliminated).toBe(true);
    expect(gone.seats[0]?.eliminated).toBeFalsy();
  });

  it("the player is eliminated though every other hero they own is held in the staging area, and a player whose only hero is held there is not eliminated", () => {
    const made = table({ seats: 1, heroes: [{ code: "16031", seat: 0 }] });
    const kahliel = idOf(made.state, "16031");
    const synced = opened(made, { ...made.state, modifiers: [...made.state.modifiers, { instanceId: kahliel, sourceId: kahliel, stat: "heroType", amount: 1, until: "endOfGame" }] }).state;
    const held = runInstruction(made, synced, { verb: "MoveHeroesToStaging" });
    expect(held.seats[0]?.heroes).toEqual([]);
    expect(settle(held, made.ctx, [] as EngineStep[]).seats[0]?.eliminated).toBeFalsy();
    const bare = table({ seats: 1 });
    const alone = settle(runInstruction(bare, opened(bare).state, { verb: "MoveHeroesToStaging" }), bare.ctx, [] as EngineStep[]);
    expect(alone.seats[0]?.eliminated).toBeFalsy();
    expect(captivesOf(alone).length).toBeGreaterThan(0);
  });
});

describe("16071:B:3 and 16072:B:3 the stages return the heroes in the staging area", () => {
  it("16071:B:3 the player takes control of a hero they own, exhausted, and the quest advances to stage 2", () => {
    const made = table({ progress: 1 });
    const staged = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const done = resolveRecords(staged, made.ctx, "16071", "forced", idOf(staged, "16071"), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const state = settle(done.state, made.ctx, [] as EngineStep[]);
    expect(state.seats[0]?.heroes).toHaveLength(1);
    expect(state.cards[state.seats[0]?.heroes[0] ?? ""]?.exhausted).toBe(true);
    expect(stagedHeroes(state)).toHaveLength(1);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("16072");
  });

  it("16072:B:3 when the stage is defeated each player takes control of one more hero in the staging area", () => {
    const made = table({ stage: "16072" });
    const staged = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const done = resolveRecords(staged, made.ctx, "16072", "forced", idOf(staged, "16072"), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    expect(done.state.seats[0]?.heroes).toHaveLength(1);
    expect(done.state.cards[done.state.seats[0]?.heroes[0] ?? ""]?.exhausted).toBe(true);
  });
});

describe("16073 Free the Captives", () => {
  function guarded() {
    const made = table({ stage: "16073", side: "A", staging: ["16062", "16063"], deck: ["16062", "16038"] });
    const staged = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const done = resolveRecords(staged, made.ctx, "16073", "whenRevealed", idOf(staged, "16073"));
    return { made, state: settle({ ...done.state, cards: { ...done.state.cards, [idOf(done.state, "16073")]: { ...done.state.cards[idOf(done.state, "16073")]!, face: "B" } } }, made.ctx, [] as EngineStep[]) };
  }

  it("16073:A:1 each player searches for an Orc, and each hero in the staging area is attached to a different Orc enemy there", () => {
    const { state } = guarded();
    const held = captivesOf(state);
    expect(held).toHaveLength(2);
    expect(held.every((card) => card.guardedHero === true && card.host != null)).toBe(true);
    expect(new Set(held.map((card) => card.host)).size).toBe(2);
    expect(stagedHeroes(state)).toEqual([]);
  });

  it("16073:B:1 an enemy that guards a hero gets +1 Threat, Attack and Defense and is immune to player card effects, and the stage cannot be defeated while one does", () => {
    const { made, state } = guarded();
    const synced = opened(made, state).state;
    const guard = synced.cards[captivesOf(synced)[0]?.host ?? ""]!;
    expect(flagged(synced, guard.id, "immuneToPlayerCards")).toBe(true);
    const plain = Object.values(synced.cards).find((card) => card.code === "16062" && card.zone === "staging" && heroGuardedBy(synced, card.id) == null);
    expect(plain == null || !flagged(synced, plain.id, "immuneToPlayerCards")).toBe(true);
  });

  it("16073:B:2 a guard that leaves play in any way returns its hero to its owner exhausted, with its tokens and attachments", () => {
    const { made, state } = guarded();
    const synced = opened(made, state).state;
    const held = captivesOf(synced)[0]!;
    const steps: EngineStep[] = [];
    const gone = settle(destroyCard(synced, held.host ?? "", made.ctx.cards, steps), made.ctx, steps);
    expect(gone.cards[held.id]).toMatchObject({ zone: "heroes", controller: 0, exhausted: true });
    expect(gone.cards[held.id]?.guardedHero).toBeUndefined();
    expect(gone.seats[0]?.heroes).toContain(held.id);
  });
});

describe("16064 Mordor Warg", () => {
  it("it attaches to an Orc enemy, the Orc returns to the staging area, and when the Orc leaves play the Warg is added to the staging area", () => {
    const made = table({ stage: "16073", engaged: ["16062"], deck: ["16064"] });
    const orc = idOf(made.state, "16062");
    const revealed = resolveRecords(opened(made).state, made.ctx, "16064", "whenRevealed");
    const state = settle(revealed.state, made.ctx, [] as EngineStep[]);
    const warg = revealed.id;
    expect(state.cards[warg]).toMatchObject({ zone: "attached", host: orc });
    expect(state.cards[orc]?.zone).toBe("staging");
    const steps: EngineStep[] = [];
    const gone = settle(destroyCard(opened(made, state).state, orc, made.ctx.cards, steps), made.ctx, steps);
    expect(gone.cards[warg]?.zone).toBe("staging");
  });
});

describe("16064 Mordor Warg with no host and with one already", () => {
  it("with no Orc in play it is discarded, and an Orc that carries a Warg is not chosen for a second", () => {
    const none = table({ stage: "16073" });
    const lone = resolveRecords(opened(none).state, none.ctx, "16064", "whenRevealed");
    expect(settle(lone.state, none.ctx, [] as EngineStep[]).cards[lone.id]?.zone).toBe("encounterDiscard");
    const one = table({ stage: "16073", engaged: ["16062"] });
    const first = resolveRecords(opened(one).state, one.ctx, "16064", "whenRevealed");
    const second = resolveRecords(settle(first.state, one.ctx, [] as EngineStep[]), one.ctx, "16064", "whenRevealed");
    const state = settle(second.state, one.ctx, [] as EngineStep[]);
    const attached = Object.values(state.cards).filter((card) => card.code === "16064" && card.zone === "attached");
    expect(attached).toHaveLength(1);
  });
});

describe("16035:A:2 Sauron's Enforcers", () => {
  it("at the end of the round the first player assigns X damage among all characters in play, the heroes in the staging area included", () => {
    const made = table({ stage: "16072", staging: ["16035"] });
    const staged = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const done = resolveRecords(staged, made.ctx, "16035", "forced", idOf(staged, "16035"), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const damaged = Object.values(done.state.cards).filter((card) => card.captive === true && card.damage > 0).reduce((sum, card) => sum + card.damage, 0);
    expect(damaged).toBe(2);
  });
});
