// Rules: hob.burgle, rr.forced, rr.response, rr.quest-advancement, rr.winning-the-game, rr.set-aside, rr.first-player, rr.attachment-cards, rr.objective-cards, faq.progress-without-advancing, faq.triggering-forced-effects, faq.enemy-attacks-outside-combat (data/rules/entries.json); docs/scenarios/the-hobbit.md (The Lonely Mountain).
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";

import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { announceAndDrive, bilbo, make, type Plan } from "../../../../test/scenarios/the-lonely-mountain/moments.ts";
import { codesIn, idOf, zoneOf, type Run } from "../../../../test/harness/scene-kit.ts";
import type { LayoutTable } from "../../../../test/harness/layout.ts";

// The quest stages of The Lonely Mountain played through the engine: the Forced effect after a successful quest (stage 2B's burgle attempt), the failed attempt, the 6th progress on Smaug the Golden, the stage 3B check and the loop that stage 4B closes. The hand and the
// player deck hold 01016 Snowbourn Scout (a leadership ally), the encounter deck Croaking Crows 132042 (its burgle effect asks 1 card of the revealed card's sphere and type).

const TREASURES = ["132020", "132021", "132022", "132023", "132024"];
const stack = (count = 5) => TREASURES.slice(0, count).map((code) => ({ code, to: "132043" }));
const handOf = (state: ScenarioState): string[] => state.seats[0]?.hand.map((id) => state.cards[id]?.code ?? "").sort() ?? [];
const progressOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
const underMountain = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.zone === "under").length;
const current = (state: ScenarioState): string | undefined => (state.questStage ? state.cards[state.questStage]?.code : undefined);

const stageTwo = (effects: readonly Effect[], extra: { progress?: number; deck?: readonly string[]; under?: number; hand?: readonly string[] } = {}): LayoutTable =>
  make({ stage: "132072", staging: [{ code: "132040", progress: extra.progress ?? 0 }, "132043"], setAside: ["132041", "132039"], under: stack(extra.under ?? 5), deck: extra.deck ?? ["132042", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: extra.hand ?? ["01016"], heroes: [bilbo(0)] }, effects);
const succeed = (made: LayoutTable, plan: Plan = {}): Run => announceAndDrive(made, { trigger: "questSucceeded" }, plan);

describe("132072:B:1 The Burglar's Turn: after questing successfully the first player makes a burgle attempt and takes the top treasure on a success", () => {
  lineSpec("132072:B:1", "1 progress goes on Smaug the Golden, a successful attempt gives the first player the top treasure and the players may stay at stage 2", (effects) => {
    const run = succeed(stageTwo(effects), { answers: ["discard", "stay"] });
    expect(progressOf(run.state, "132040")).toBe(1);
    expect(handOf(run.state)).toEqual(["132020"]);
    expect(underMountain(run.state)).toBe(4);
    expect(current(run.state)).toBe("132072");
  });
  lineSpec("132072:B:1", "the players may advance to stage 3 after the attempt: Smaug the Golden goes aside and Smaug the Magnificent and A Bare Patch join the staging area", (effects) => {
    const run = succeed(stageTwo(effects), { answers: ["discard", "advance"] });
    expect(current(run.state)).toBe("132073");
    expect(zoneOf(run.state, "132040")).toBe("setAside");
    expect([zoneOf(run.state, "132041"), zoneOf(run.state, "132039")]).toEqual(["staging", "staging"]);
    expect(handOf(run.state)).toEqual(["132020"]);
  });
  lineSpec("132072:B:1", "with no treasure left under The Lonely Mountain a successful attempt takes none", (effects) => {
    const run = succeed(stageTwo(effects, { under: 0 }), { answers: ["discard", "stay"] });
    expect(progressOf(run.state, "132040")).toBe(1);
    expect(codesIn(run.state, "encounterDiscard")).toContain("132042");
    expect(handOf(run.state)).toEqual([]);
  });
  lineSpec("132072:B:1", "an attempt that fails takes no treasure and the first player may still advance", (effects) => {
    const run = succeed(stageTwo(effects, { hand: ["01048"] }), { answers: ["advance"] });
    expect(handOf(run.state)).toEqual(["01048"]);
    expect(underMountain(run.state)).toBe(5);
    expect(codesIn(run.state, "encounterDiscard")).toContain("132042");
  });
});

describe("132072:B:2 The Burglar's Turn: after the first player's unsuccessful burgle attempt Smaug the Golden attacks the first player", () => {
  lineSpec("132072:B:2", "a failed attempt makes Smaug the Golden attack the first player from the staging area, with a shadow card", (effects) => {
    const run = succeed(stageTwo(effects, { hand: ["01048"] }), {}, );
    const attack = run.steps.find((step) => step.kind === "attack" && step.side === "enemy");
    expect(attack && attack.kind === "attack" ? run.state.cards[attack.enemyId]?.code : null).toBe("132040");
    expect(run.state.window?.kind).toBe("defense");
    // A successful attempt makes no attack.
    const won = succeed(stageTwo(effects), { answers: ["discard", "stay"] });
    expect(won.steps.some((step) => step.kind === "attack" && step.side === "enemy")).toBe(false);
  });
});

describe("132040:A:3 Smaug the Golden: the 6th progress token sends the players to stage 4A at once, so stage 2B's burgle attempt is not made", () => {
  lineSpec("132040:A:3", "the progress stage 2B places is the 6th: the quest is at stage 4A, nothing was discarded from the encounter deck and no treasure was taken", (effects) => {
    const run = succeed(stageTwo(effects, { progress: 5 }), { answers: ["discard", "stay"] });
    expect(current(run.state)).toBe("132074");
    expect(run.state.encounterDiscard).toEqual([]);
    expect(handOf(run.state)).toEqual(["01016"]);
    expect(zoneOf(run.state, "132041")).toBe("staging");
    expect(zoneOf(run.state, "132040")).toBe("setAside");
    // The 5th progress token advances nothing.
    const fifth = succeed(stageTwo(effects, { progress: 4 }), { answers: ["discard", "stay"] });
    expect(current(fifth.state)).toBe("132072");
    expect(progressOf(fifth.state, "132040")).toBe(5);
  });
});

describe("132073:B:2 Inside Information: progress above Smaug the Magnificent's remaining hit points removes him, and the stage then wins the game", () => {
  const stageThree = (effects: readonly Effect[], progress: number, damage: number): LayoutTable => make({ stage: "132073", progress, staging: [{ code: "132041", damage }, "132043"] }, effects);
  lineSpec("132073:B:2", "progress placed on the stage that exceeds 20 less his damage sets him aside; a defeated stage 3 wins the game (132073:B:3)", (effects) => {
    const high = stageThree(effects, 21, 0);
    const run = announceAndDrive(high, { trigger: "progressPlaced", cardId: idOf(high.state, "132073") }, {});
    expect(zoneOf(run.state, "132041")).toBe("setAside");
    expect(run.state.stageCleared).toBe(true);
    expect(run.state.lost).toBe(false);
    // Progress that only equals his remaining hit points leaves him in play and the stage undefeated.
    const equal = stageThree(effects, 20, 0);
    const kept = announceAndDrive(equal, { trigger: "progressPlaced", cardId: idOf(equal.state, "132073") }, {});
    expect(zoneOf(kept.state, "132041")).toBe("staging");
    expect(kept.state.stageCleared).toBeFalsy();
  });
});

describe("132074:B:1 Thieves! Fire! Murder!: the stage resets the quest to 2B and the loop can run again", () => {
  const prepared = (effects: readonly Effect[]): LayoutTable => make({ stage: "132072", staging: [{ code: "132040", progress: 5 }, "132043"], setAside: ["132041", "132039"], under: stack(), deck: ["132042", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"], heroes: [bilbo(0)] }, effects);
  const rewind = (run: Run, made: LayoutTable): Run => announceAndDrive({ ...made, state: updateCard(run.state, run.state.questStage ?? "", { progress: 7 }) }, { trigger: "questCardDefeated", ...(run.state.questStage ? { cardId: run.state.questStage } : {}) }, {});
  const refill = (run: Run, made: LayoutTable): LayoutTable => ({ ...made, state: updateCard(run.state, idOf(run.state, "132040"), { progress: 5 }) });

  lineSpec("132074:B:1", "stage 4B resets the quest to stage 2B with no progress, Smaug the Magnificent and A Bare Patch go aside, Smaug the Golden comes back with none, and the second advance to 4A works again", (effects) => {
    const made = prepared(effects);
    const first = announceAndDrive(made, { trigger: "questSucceeded" }, { answers: [] });
    expect(current(first.state)).toBe("132074");
    expect(zoneOf(first.state, "132041")).toBe("staging");
    const reset = rewind(first, made);
    expect(current(reset.state)).toBe("132072");
    expect(progressOf(reset.state, "132072")).toBe(0);
    expect([zoneOf(reset.state, "132041"), zoneOf(reset.state, "132039"), zoneOf(reset.state, "132040")]).toEqual(["setAside", "setAside", "staging"]);
    expect(progressOf(reset.state, "132040")).toBe(0);
    // The loop again: the 6th progress on Smaug the Golden sends the players to stage 4A, which brings Smaug the Magnificent back.
    const second = announceAndDrive(refill(reset, made), { trigger: "questSucceeded" }, {});
    expect(current(second.state)).toBe("132074");
    expect([zoneOf(second.state, "132041"), zoneOf(second.state, "132040")]).toEqual(["staging", "setAside"]);
  });
  lineSpec("132074:B:1", "after the reset the players can advance to stage 3, which brings Smaug the Magnificent and A Bare Patch back", (effects) => {
    const made = prepared(effects);
    const first = announceAndDrive(made, { trigger: "questSucceeded" }, {});
    const reset = rewind(first, made);
    const third = announceAndDrive({ ...made, state: updateCard(reset.state, idOf(reset.state, "132040"), { progress: 0 }) }, { trigger: "questSucceeded" }, { answers: ["discard", "advance"] });
    expect(current(third.state)).toBe("132073");
    expect([zoneOf(third.state, "132041"), zoneOf(third.state, "132039")]).toEqual(["staging", "staging"]);
  });
});
