// Rules: mec108.captured-deck, mec108.captured-cards, mec108.capture-x, mec108.joining-another-player, mec108.create-staging-area, rr.player-elimination, rr.replacement-effects, rr.in-play-and-out-of-play (data/rules/entries.json);
// ledger lines 10039:B:1, 10039:B:2, 10043:A:2, 10051:A:2, 10053:A:3, 10174:B:2.
// The captured family on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { eliminateEmpties } from "../../core/eliminate.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { combatDamage } from "../defense/excess.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import { withView } from "../breaking/areas.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { capturedUnder, captureCard } from "./pile.ts";
import { rescueCards, rescueRandom } from "./rescue.ts";

const SCENARIO = "escape-from-mount-gram";
const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout(SCENARIO, layout);
const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });

// Puts `codes` captured underneath the card, each owned by `seat`.
function capturedUnderCard(state: ScenarioState, hostId: string, codes: readonly string[], seat = 0): ScenarioState {
  let next = state;
  for (const code of codes) {
    const made = spawn(next, code, { zone: "captured", hostId, seat }, "down");
    next = made.state;
  }
  return next;
}

describe("Captured cards", () => {
  it("mec108.captured-cards: a card captured from play loses its tokens and its attachments, and a host that leaves play rescues every card underneath it, each to its owner", () => {
    const t = table({ play: [{ code: "ally", damage: 1, resources: 1 }], staging: ["f3"], attached: [{ code: "attachment", to: "ally" }] });
    const ally = idOf(t.state, "ally");
    const host = idOf(t.state, "f3");
    const taken = captureCard(t.state, ally, host);
    expect(taken.cards[ally]).toMatchObject({ zone: "captured", host, damage: 0, resources: 0, owner: 0 });
    expect(taken.cards[idOf(taken, "attachment")]?.zone).toBe("discard");
    // The enemy leaves play: the ally is in its owner's hand, controlled by that player again.
    const gone = moveCard(taken, host, { zone: "encounterDiscard" });
    expect(gone.cards[ally]).toMatchObject({ zone: "hand", controller: 0 });
    expect(gone.pendingEvents?.filter((event) => event.trigger === "capturedRescued")).toHaveLength(1);
  });

  it("10039:B:1 rescues one captured card at random for each point of progress, and loses what there is more of; one occurrence announces it", () => {
    const t = table({ stage: "10039" });
    const stage = t.state.questStage ?? "";
    const held = capturedUnderCard(t.state, stage, ["ally", "ally", "ally"]);
    const some = rescueRandom(held, stage, 2);
    expect(capturedUnder(some, stage)).toHaveLength(1);
    expect(some.rescued).toHaveLength(2);
    expect(some.pendingEvents?.filter((event) => event.trigger === "capturedRescued")).toHaveLength(1);
    const all = rescueRandom(held, stage, 5);
    expect(capturedUnder(all, stage)).toHaveLength(0);
    expect(all.rescued).toHaveLength(3);
    // Progress placed on the stage rescues instead: the stage holds none, and the active location would take it first.
    const steps: EngineStep[] = [];
    const placed = placeQuestProgress(held, 2, t.ctx.cards, steps, () => true);
    expect(placed.cards[stage]?.progress).toBe(0);
    expect(capturedUnder(placed, stage)).toHaveLength(1);
  });

  it("10174:B:2 puts a rescued hero into play under its owner, ready and with no tokens, with the boons set aside for it, and announces it", () => {
    const t = table({ stage: "10039", campaign: true });
    const stage = t.state.questStage ?? "";
    const made = spawn(t.state, "dh3", { zone: "captured", hostId: stage, seat: 0 }, "down");
    const hero = made.id;
    const boon = spawn(updateCard(made.state, hero, { heroSlot: 1, resources: 0 }), "10162", { zone: "setAside" }, "up");
    const set = { ...boon.state, heroBoons: [[boon.id, hero] as const] };
    const back = rescueCards(set, stage, [hero]);
    expect(back.cards[hero]).toMatchObject({ zone: "heroes", controller: 0, exhausted: false, damage: 0 });
    expect(back.cards[boon.id]).toMatchObject({ zone: "attached", host: hero });
    expect(back.pendingEvents?.map((event) => event.trigger)).toContain("heroEnteredPlay");
  });

  it("rr.player-elimination: a player whose last hero in play left play stays in the game while one of their heroes is captured, and is eliminated without one", () => {
    const t = table({ stage: "10039" });
    const stage = t.state.questStage ?? "";
    const bare = [t.hero, t.hero2].reduce((state, id) => moveCard(state, id, { zone: "discard", seat: 0 }), t.state);
    expect(eliminateEmpties(bare, []).seats[0].eliminated).toBe(true);
    const kept = capturedUnderCard(bare, stage, ["dh3"]);
    const holding = updateCard(kept, idOf(kept, "dh3"), { heroSlot: 0 });
    expect(eliminateEmpties(holding, []).seats[0].eliminated).toBe(false);
  });

  it("10043:A:2 and 10051:A:2 capture the ally an attack would damage instead of dealing the damage, a hero is damaged as usual", () => {
    const t = table({ play: ["ally"], engaged: ["f3", "10043"] });
    const ally = idOf(t.state, "ally");
    const torturer = t.state;
    const enemy = idOf(torturer, "10043");
    const steps: EngineStep[] = [];
    const taken = combatDamage(torturer, enemy, ally, 3, t.ctx, steps);
    expect(taken.cards[ally]).toMatchObject({ zone: "captured", host: enemy, damage: 0 });
    // A hero takes the damage, and an enemy with no capture deals it to the ally.
    expect(combatDamage(torturer, enemy, t.hero, 3, t.ctx, steps).cards[t.hero]?.damage).toBe(3);
    expect(combatDamage(torturer, idOf(torturer, "f3"), ally, 3, t.ctx, steps).cards[ally]?.damage).toBeGreaterThan(0);
    // A shadow card marks the attack in progress.
    const marked = { ...t.state, pendingAttack: { enemyId: idOf(t.state, "f3"), seat: 0, captures: true as const } };
    expect(combatDamage(marked, idOf(t.state, "f3"), ally, 1, t.ctx, steps).cards[ally]?.zone).toBe("captured");
  });

  it("10053:A:3 discards the cards captured under the quest to their owners' discard piles and raises each player's threat for each of their characters so discarded", () => {
    const t = table({ play: ["ally"], staging: ["10053"], threat: [30, 30] });
    const quest = idOf(t.state, "10053");
    const held = capturedUnderCard(t.state, quest, ["ally", "ally"]);
    const run = runInstruction(held, { verb: "DiscardCapturedUnder", threat: 3 }, focus(0, quest), t.ctx, []);
    expect(capturedUnder(run, quest)).toHaveLength(0);
    expect(run.seats[0].discard.length).toBeGreaterThanOrEqual(2);
    expect(run.seats[0].threat).toBe(36);
  });
});

describe("Joining another player", () => {
  // Two players with a stage 2B and a staging area each.
  function divided() {
    const t = table({ seats: 2, stage: "10039", staging: ["f3"] });
    let state = t.state;
    const first = state.questStage ?? "";
    const second = spawn(state, "10039", { zone: "questDeck" }).state;
    state = second;
    state = runInstruction(state, { verb: "StartSeparateStage", code: "10039" }, focus(0, first), t.ctx, []);
    state = runInstruction(state, { verb: "StartSeparateStage", code: "10039" }, focus(1, first), t.ctx, []);
    return { t, state };
  }

  it("10039:B:2 joins the next player when a stage has nothing captured, and advances everyone together when no area is left", () => {
    const { t, state } = divided();
    const [a, b] = [state.seats[0].stage ?? "", state.seats[1].stage ?? ""];
    expect(a).not.toBe(b);
    // The first player joins the second: their stage leaves play and they share the second player's area and stage.
    const joined = runInstruction(state, { verb: "JoinAnotherPlayer", advanceTo: "10040" }, focus(0, a), t.ctx, []);
    expect(joined.seats[0].joined).toBe(1);
    expect(joined.seats[0].stage).toBeUndefined();
    expect(joined.cards[a]?.zone).toBe("setAside");
    expect(withView(joined, 0, (view) => ({ ...view, window: null })).seats[0].joined).toBe(1);
    // The second player cannot join, so everyone advances to stage 3A together and the areas are one.
    const together = runInstruction(joined, { verb: "JoinAnotherPlayer", advanceTo: "10040" }, focus(1, b), t.ctx, []);
    expect(together.separate).toBeUndefined();
    expect(together.cards[together.questStage ?? ""]?.code).toBe("10040");
    expect(together.seats.every((seat) => seat.joined === undefined && seat.stage === undefined)).toBe(true);
    expect(together.stack.length).toBeGreaterThan(0);
  });
});
