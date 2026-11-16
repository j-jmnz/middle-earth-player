// Rules: rr.quest-cards-quest-deck, rr.active-location, sotm.reset-the-quest-deck (data/rules/entries.json); ledger lines 02013:B:1, 02023:A:2, 900409:A:1.
// The quest family's state-based reset (a constant ReturnToStage, quest/reset.ts), the commit restriction of the constant verb Restrict, and RemoveAllProgress, on a table of The Hunt for Gollum.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";

import { first, legalTargets, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-hunt-for-gollum", layout);

function claimed(state: ScenarioState, signsId: string, heroId: string): ScenarioState {
  const hero = state.cards[heroId];
  const attached = attachTo(moveCard(state, signsId, { zone: "attached" }), signsId, heroId);
  return updateCard(attached, signsId, { face: "up", controller: hero?.controller ?? 0, claimed: true });
}

describe("02013:B:1 On the Trail", () => {
  it("02013:B:1 lets only a player who controls a hero with a Clue attached commit characters", () => {
    const made = table({ stage: "02013", seats: 2, phase: "Quest" });
    const spawned = spawn(made.state, "02014", { zone: "staging" });
    const state = claimed(spawned.state, spawned.id, made.hero);
    const commits = (seat: number): boolean => legalTargets({ ...state, activeSeat: seat }, { type: "Commit" }, made.ctx).length > 0;
    expect(commits(0)).toBe(true);
    expect(commits(1)).toBe(false);
  });

  it("02013:B:1 resets the quest deck to stage 2B when no hero holds a Clue, keeping the progress on the active location", () => {
    const made = table({ stage: "02013", progress: 5, active: "02016", phase: "Quest" });
    const active = first(made.state, "02016");
    const withProgress = updateCard(made.state, active, { progress: 2 });
    const settled = settle({ ...withProgress, window: null }, made.ctx, []);
    expect(settled.cards[settled.questStage ?? ""]?.code).toBe("02012");
    expect(settled.cards[settled.questStage ?? ""]?.progress).toBe(0);
    expect(settled.cards[first(settled, "02013")]?.zone).toBe("questDeck");
    expect(settled.cards[active]?.progress).toBe(2);
    expect(settled.activeLocation).toBe(active);
  });

  it("02013:B:1 does not reset while a hero holds a Clue", () => {
    const made = table({ stage: "02013", progress: 5, phase: "Quest" });
    const spawned = spawn(made.state, "02014", { zone: "staging" });
    const state = claimed(spawned.state, spawned.id, made.hero);
    const settled = settle({ ...state, window: null }, made.ctx, []);
    expect(settled.cards[settled.questStage ?? ""]?.code).toBe("02013");
    expect(settled.cards[settled.questStage ?? ""]?.progress).toBe(5);
  });
});

describe("RemoveAllProgress", () => {
  it("02023:A:2 Flooding removes all progress from every Riverland location, the active one included, and none from another", () => {
    const made = table({ staging: [{ code: "02018", progress: 2 }, { code: "02019", progress: 1 }, { code: "02016", progress: 3 }], active: "02015", phase: "Quest" });
    const old = first(made.state, "02015");
    const withProgress = updateCard(made.state, old, { progress: 1 });
    const run = resolveRecords(withProgress, made.ctx, "02023", "whenRevealed");
    expect(run.state.cards[old]?.progress).toBe(0);
    expect(run.state.cards[first(run.state, "02018")]?.progress).toBe(0);
    expect(run.state.cards[first(run.state, "02019")]?.progress).toBe(0);
    // The Eaves of Mirkwood is a Forest.
    expect(run.state.cards[first(run.state, "02016")]?.progress).toBe(3);
  });

  it("900409:A:1 The Trail Goes Cold attaches to the active location and removes its progress, with no surge", () => {
    const made = table({ active: "02015", deck: ["f3"], phase: "Quest" });
    const old = first(made.state, "02015");
    const withProgress = updateCard(made.state, old, { progress: 1 });
    const revealed = revealFromTop(withProgress, made.ctx, "900409", []);
    expect(revealed.state.cards[revealed.id]).toMatchObject({ host: old, zone: "attached" });
    expect(revealed.state.cards[old]?.progress).toBe(0);
    // No surge: the next card of the deck stays where it is.
    expect(revealed.state.cards[first(revealed.state, "f3")]?.zone).toBe("encounterDeck");
  });

  it("900409:A:2 The Trail Goes Cold gains surge when it does not attach (a Trail is already attached: Limit 1 per location)", () => {
    const made = table({ active: "02015", deck: ["f3"], phase: "Quest" });
    const old = first(made.state, "02015");
    const first1 = revealFromTop(made.state, made.ctx, "900409", []);
    expect(first1.state.cards[first1.id]?.host).toBe(old);
    const second = revealFromTop(first1.state, made.ctx, "900409", []);
    expect(second.state.cards[second.id]?.host).toBeNull();
    // Surge: one more card of the encounter deck was revealed, to the staging area.
    expect(second.state.cards[first(second.state, "f3")]?.zone).toBe("staging");
  });
});
