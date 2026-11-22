// Rules: rr.forced, rr.ownership-and-control, rr.first-player, rr.quest-advancement, rr.refresh-phase, rr.step-7-3, rr.attachment-cards, rr.then, rr.lasting-effects (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (The Woodland Realm, readings 7, 9, 13, 14, 17, 21).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): the progress caps of stage 2 with and without Mendor, the progress noted on stage 3B, who controls Mendor, the Spider Den flip, Forest of Great Fear
// when no enemy is found, a bar to readying that player cards face, the 2 resources that lift Caught in a Web, the attachments an enemy bars, an enemy engaged this round and an exhausted character a Forced effect discards.
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { addModifier } from "../../../rules/core/keywords.ts";
import { readyBarred } from "../../../rules/core/holder-classes.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { fightEnemy, finish, idOf, idsOf, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-woodland-realm", layout);
const ALLIES = ["ally", "ally", "ally", "ally", "ally", "ally"];
const F0 = ["f0", "f0", "f0", "f0", "f0", "f0"];

// The quest phase from the layout's table, played to its end with the cards `commit` names committed: the Forced effect at the beginning of the staging step reads who is committed.
function questPhase(layout: Layout, commit: (state: ScenarioState) => string[]): Run {
  const made = table({ phase: "Quest", ...layout });
  let run = start(made.state);
  for (let guard = 0; guard < 8 && run.state.mode === "questCommit"; guard += 1) {
    run = send(run, { type: "Commit", cardIds: commit(run.state) }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
  }
  return run;
}
// The state after the event is announced and the Forced effects that hear it have resolved.
function announceAfter(made: ReturnType<typeof table>, trigger: "locationExplored", cardId: string): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...made.state, window: null }, { trigger, seat: 0, cardId }, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
}
const everyone = (state: ScenarioState): string[] => [...idsOf(state, "dh1"), ...idsOf(state, "dh2"), ...idsOf(state, "ally")];
const withMendor = (state: ScenarioState): string[] => [...everyone(state), ...idsOf(state, "51111")];
const progressOf = (run: Run, code: string): number => run.state.cards[idOf(run.state, code)]?.progress ?? 0;

describe("the progress cap of stage 2 (reading 9)", () => {
  // Two heroes and six allies commit for 10 Willpower (12 with Mendor) against a staging area with no Threat.
  const layout = (stage: string, mendor: boolean): Layout => ({ stage, deck: F0, play: mendor ? [...ALLIES, "51111"] : ALLIES });

  it("51103:B:2 places at most 5 progress on the stage this round, and 10 when Mendor is committed", () => {
    expect(progressOf(questPhase(layout("51103", false), everyone), "51103")).toBe(5);
    expect(progressOf(questPhase(layout("51103", true), withMendor), "51103")).toBe(10);
    expect(progressOf(questPhase(layout("51103", true), everyone), "51103")).toBe(5);
  });

  it("51104:B:3 places at most 5 progress on the stage this round, and 10 when Mendor is committed", () => {
    expect(progressOf(questPhase(layout("51104", false), everyone), "51104")).toBe(5);
    expect(progressOf(questPhase(layout("51104", true), withMendor), "51104")).toBe(10);
  });

  it("51105:B:2 places at most 5 progress on the stage this round, and 10 when Mendor is committed", () => {
    expect(progressOf(questPhase(layout("51105", false), everyone), "51105")).toBe(5);
    expect(progressOf(questPhase(layout("51105", true), withMendor), "51105")).toBe(10);
  });
});

describe("the progress noted on stage 3B (reading 14)", () => {
  const revealed = (willpower: number): number => {
    const run = questPhase({ stage: "51108", deck: F0, play: ALLIES }, (state) => [...idsOf(state, "dh1"), ...idsOf(state, "dh2"), ...idsOf(state, "ally")].slice(0, willpower === 10 ? 8 : 7));
    return run.state.staging.length;
  };

  it("51108:B:3 reveals the top card after a successful quest that placed 10 or more progress on the stage this phase, and not after 9", () => {
    // The staging step reveals 1 card for the one player; a quest with 10 progress reveals a second.
    expect(revealed(10)).toBe(revealed(9) + 1);
  });

  it("51108:B:2 no player's threat is reduced by more than 1 each round, and the quest phase's progress is noted", () => {
    const made = table({ stage: "51108", seats: 2 });
    const caps = made.state.modifiers.filter((modifier) => modifier.stat === "threatReductionCap");
    expect(caps.map((modifier) => modifier.amount)).toEqual([1, 1]);
    expect(made.state.modifiers.some((modifier) => modifier.stat === "noteQuestProgress")).toBe(true);
  });

  it("51143:A:1 the same cap holds while Dry Watercourse is in the staging area, and not engaged", () => {
    const caps = (layout: Layout) => table(layout).state.modifiers.filter((modifier) => modifier.stat === "threatReductionCap").length;
    expect(caps({ seats: 2, staging: ["51143"] })).toBe(2);
    expect(caps({ seats: 2, active: "51143" })).toBe(0);
  });
});

describe("Mendor and Spider Den (reading 7, 8)", () => {
  it("51111:A:2 is controlled by the first player, and by the new one when the token passes", () => {
    const made = table({ seats: 2, firstPlayer: 1, play: [{ code: "51111", seat: 1 }] });
    const mendor = idOf(made.state, "51111");
    expect(made.state.cards[mendor]?.controller).toBe(1);
    const passed = settle({ ...made.state, firstPlayer: 0 }, made.ctx, []);
    expect(passed.cards[mendor]?.controller).toBe(0);
  });

  it("51101:B:1 the flip leaves no Spider Den in the staging area, and Mendor comes ready under the first player", () => {
    const made = table({ seats: 2, firstPlayer: 1, stage: "51101", staging: ["51110"] });
    const den = idOf(made.state, "51110");
    const flipped = announceAfter(made, "locationExplored", den);
    expect(flipped.cards[den]).toMatchObject({ code: "51111", zone: "play", controller: 1, exhausted: false });
    expect(flipped.staging).not.toContain(den);
  });

  it("51101:B:2 the stage is defeated only while the first player controls Mendor", () => {
    const advanced = (layout: Layout): boolean => {
      const run = questPhase({ stage: "51101", progress: 10, deck: ["f0"], ...layout }, (state) => [...idsOf(state, "dh1"), ...idsOf(state, "dh2")]);
      return run.state.questStage !== idOf(table({ stage: "51101" }).state, "51101") || run.state.cards[idOf(run.state, "51101")]?.zone !== "questStage";
    };
    expect(advanced({})).toBe(false);
    expect(advanced({ play: ["51111"] })).toBe(true);
  });
});

describe("The Forest of Great Fear (reading 13)", () => {
  it("51107:B:1 places no resource when the search finds no enemy, though an enemy of cost 2 or more is in play", () => {
    const made = table({ stage: "51107", staging: ["51115"], deck: ["51114", "51117"] });
    const done = resolveRecords(made.state, made.ctx, "51107", "whenRevealed", idOf(made.state, "51107"));
    expect(done.state.cards[idOf(done.state, "51115")]?.resources).toBe(0);
  });
});

describe("encounter cards a card-spec row cannot show", () => {
  it("51112:A:1 bars a player card attachment and lets an encounter attachment attach (as 51115:A:1 and 51145:A:1 do)", () => {
    for (const code of ["51112", "51115", "51145"]) {
      const made = table({ staging: [code] });
      const host = idOf(made.state, code);
      expect(attachBlocked(made.state, made.ctx, host, "attachment")).toBe(true);
      expect(attachBlocked(made.state, made.ctx, host, "51126")).toBe(false);
    }
  });

  it("51120:A:1 bars player card effects from readying a character until the end of the round, and the refresh phase still readies", () => {
    const made = table({ deck: ["f0", "f0"] });
    const revealed = finish({ state: revealFromTop(made.state, made.ctx, "51120", []).state, steps: [] }, made.ctx).state;
    expect(readyBarred(revealed, idOf(revealed, "dh2"), made.cards)).toBe(true);
    expect(readyBarred(revealed, idOf(revealed, "dh2"))).toBe(false);
  });

  it("51123:A:1 does not ready its hero in the refresh phase unless the player pays 2 resources from the hero's pool", () => {
    const refreshed = (resources: number, answer: "pay" | "skip") => {
      const made = table({ phase: "Combat", heroResources: resources, attached: [{ code: "51123", to: "dh1" }] });
      const tired = ["dh1", "dh2"].reduce((state, code) => updateCard(state, idOf(state, code), { exhausted: true }), made.state);
      const refreshing: ScenarioState = { ...settle(tired, made.ctx, []), phase: "Combat", mode: "refresh", window: null };
      let run: Run = { state: settle(refreshing, made.ctx, []), steps: [] };
      for (let guard = 0; guard < 12 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: run.state.window.options.includes(answer) ? answer : (run.state.window.options[0] ?? "") }, made.ctx);
      return run.state.cards[idOf(run.state, "dh1")];
    };
    expect(refreshed(3, "pay")?.exhausted).toBe(false);
    expect(refreshed(3, "pay")?.resources).toBeLessThan(3);
    expect(refreshed(3, "skip")?.exhausted).toBe(true);
    expect(refreshed(1, "pay")?.exhausted).toBe(true);
  });

  it("51133:A:2 Shadow: +2 Attack for an attacker engaged this round, +1 otherwise", () => {
    const damageTaken = (engagedThisRound: boolean): number => {
      const tweak = (state: ScenarioState): ScenarioState => (engagedThisRound ? addModifier(state, idOf(state, "f3"), idOf(state, "f3"), "engagedThisRound", 1, "endOfRound") : state);
      const fight = fightEnemy((layout: Layout) => table(layout), "51133", "f3", {}, { tweak, undefended: true });
      return fight.run.state.cards[idOf(fight.run.state, "dh1")]?.damage ?? 0;
    };
    expect(damageTaken(false)).toBe(2);
    expect(damageTaken(true)).toBe(3);
  });

  it("51148:A:1 Forced: after it engages you an exhausted character you control is discarded", () => {
    const made = table({ engaged: ["51148"], play: ["ally"] });
    const tired = updateCard(made.state, idOf(made.state, "dh1"), { exhausted: true });
    const done = resolveRecords(tired, made.ctx, "51148", "forced", idOf(tired, "51148"));
    expect(done.state.cards[idOf(done.state, "dh1")]?.zone).toBe("discard");
    expect(done.state.cards[idOf(done.state, "ally")]?.zone).toBe("play");
    const rested = resolveRecords(made.state, made.ctx, "51148", "forced", idOf(made.state, "51148"));
    expect(rested.state.cards[idOf(rested.state, "dh1")]?.zone).toBe("heroes");
  });
});
