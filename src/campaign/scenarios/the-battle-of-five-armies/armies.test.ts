// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, rr.quest-advancement, faq.progress-without-advancing, rr.reveal (data/rules/entries.json); ledger lines 132075:B:1, 132076:B:1, 132077:B:1, 132078:B:1, 132053:A:4, 132056:A:1, 132059:A:1.
// The armies family on a table of The Battle of Five Armies: the stages in play together, the first player's choice of the current stage, the joint advance, the stages with no progress and the first Goblin revealed each round.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { expireModifiers, flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { answer, fightEnemy, first, legalIntents, legalTargets, resolveRecords, revealedTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { askCurrentStage, stagesInPlay } from "../../../rules/families/armies/stages.ts";

const [S1, S2, S3, S4, S5] = ["132075", "132076", "132077", "132078", "132079"] as const;
const table = (layout: Layout = {}) => tableFromLayout("the-battle-of-five-armies", { stage: S1, ...layout });
// Stage 1's When Revealed has put stages 2, 3 and 4 into play.
function inPlay(layout: Layout = {}) {
  const made = table(layout);
  const run = resolveRecords(made.state, made.ctx, S1, "whenRevealed", first(made.state, S1));
  return { ...made, state: run.state };
}
const idOf = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";
const progressOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
const withProgress = (state: ScenarioState, code: string, progress: number): ScenarioState => ({ ...state, cards: { ...state.cards, [idOf(state, code)]: { ...state.cards[idOf(state, code)]!, progress } } });

describe("stages in play together (132075:B:1)", () => {
  it("132075:B:1 stages 2, 3 and 4 enter play with side B up, stage 1 is set aside and stage 2 is the current stage", () => {
    const { state } = inPlay();
    expect(stagesInPlay(state).map((id) => state.cards[id]?.code)).toEqual([S2, S3, S4]);
    expect(state.cards[idOf(state, S1)]?.zone).toBe("setAside");
    expect(stagesInPlay(state).every((id) => state.cards[id]?.zone === "questStage" && state.cards[id]?.face === "B")).toBe(true);
    expect(state.cards[state.questStage ?? ""]?.code).toBe(S2);
  });

  it("132075:B:1 the first player chooses the current stage at the start of a round, and the choice is asked once a round", () => {
    const made = inPlay();
    const asked = askCurrentStage({ ...made.state, round: 1 }, []);
    expect(asked?.stack.length).toBeGreaterThan(0);
    const settled = settle({ ...asked!, window: null }, made.ctx, []);
    expect(settled.window?.kind).toBe("choose");
    const stage3 = idOf(settled, S3);
    const chosen = answer({ state: settled, steps: [] }, made.ctx, () => stage3);
    expect(chosen.state.cards[chosen.state.questStage ?? ""]?.code).toBe(S3);
    expect(askCurrentStage(chosen.state, [])).toBeNull();
  });
});

describe("progress and the joint advance (132076:B:1, 132077:B:1, 132078:B:1)", () => {
  const place = (state: ScenarioState, ctx: ReturnType<typeof inPlay>["ctx"], current: string, amount: number): ScenarioState => {
    const on = { ...state, questStage: idOf(state, current) };
    const placed = runInstruction(on, { verb: "ProgressQuest", amount }, { seat: 0, sourceId: null }, ctx, []);
    return settle({ ...placed, window: null }, ctx, []);
  };

  it("132076:B:1 progress goes on the current stage only, and a full stage waits while the others are not complete", () => {
    const { state, ctx } = inPlay();
    const after = place(state, ctx, S2, 9);
    expect(progressOn(after, S2)).toBe(9);
    expect(progressOn(after, S3)).toBe(0);
    expect(after.cards[idOf(after, S2)]?.zone).toBe("questStage");
    expect(after.armies).toBeDefined();
  });

  it("132077:B:1 the players advance to stage 5 at once when the three stages are complete, and the others leave play", () => {
    const { state, ctx } = inPlay();
    const ready = withProgress(withProgress(state, S2, 8), S4, 8);
    const after = place(ready, ctx, S3, 8);
    expect(after.cards[after.questStage ?? ""]?.code).toBe(S5);
    expect(after.armies).toBeUndefined();
    for (const code of [S2, S3, S4]) expect(after.cards[idOf(after, code)]?.zone).toBe("setAside");
  });

  it("132078:B:1 a stage left under its quest points by a progress removal is not complete again", () => {
    const { state, ctx } = inPlay();
    const ready = withProgress(withProgress(state, S2, 8), S3, 8);
    const removed = runInstruction(ready, { verb: "RemoveProgressFromStages", amount: 2, code: S3 }, { seat: 0, sourceId: null }, ctx, []);
    expect(progressOn(removed, S3)).toBe(6);
    const after = place(removed, ctx, S4, 8);
    expect(after.cards[after.questStage ?? ""]?.code).toBe(S4);
    expect(after.armies).toBeDefined();
  });
});

describe("stages with no progress (132057:A:1)", () => {
  it("132057:A:1 the Vanguard of Bolg gets +1 Threat for each stage in play with no progress on it", () => {
    const made = inPlay({ staging: ["132057"] });
    const threat = (raw: ScenarioState) => {
      const state = syncConstants(raw, made.ctx);
      return modifiedStat(state, state.cards[idOf(state, "132057")]!, "threat", made.ctx.cards);
    };
    const none = threat(made.state);
    const some = threat(withProgress(made.state, S3, 1));
    expect(none - some).toBe(1);
  });

  it("132056:A:1 each stage in play loses 1 progress, with one player and with two", () => {
    for (const seats of [1, 2] as const) {
      const made = inPlay({ staging: ["132056"], seats });
      const ready = withProgress(withProgress(made.state, S2, 3), S3, 1);
      const run = resolveRecords(ready, made.ctx, "132056", "whenRevealed", idOf(ready, "132056"));
      expect(progressOn(run.state, S2)).toBe(2);
      expect(progressOn(run.state, S3)).toBe(0);
    }
  });
  // The engine plays one or two players (ScenarioState.seatCount), so the "3 or more players" half of 132056:A:1 never applies and has no test.
});

describe("the first Goblin revealed each round (132053:A:4)", () => {
  it("132053:A:4 the first Goblin revealed surges, the second does not", () => {
    const made = inPlay({ staging: ["132053"], deck: ["132055", "132055", "132058", "f0", "f0"] });
    const state = revealedTop(made, "132055");
    // The first Goblin surged and revealed the next card of the deck, a second copy; that one did not surge, so the deck keeps the cards after it.
    expect(state.staging.filter((id) => state.cards[id]?.code === "132055")).toHaveLength(2);
    expect(state.encounterDeck.some((id) => state.cards[id]?.code === "132055")).toBe(true);
  });

  it("132053:A:4 in the next round the first Goblin revealed surges again", () => {
    const made = inPlay({ staging: ["132053"], deck: ["132055", "132055", "132055", "132058", "f0", "f0"] });
    const round1 = revealedTop(made, "132055");
    expect(round1.staging.filter((id) => round1.cards[id]?.code === "132055")).toHaveLength(2);
    // The round ends: "until the end of the round" is over, and the next Goblin is the first of round 2.
    const round2 = expireModifiers(round1, ["endOfPhase", "endOfRound"]);
    expect(flagged(round2, "table", "firstRevealedSeen")).toBe(false);
    const again = revealedTop({ ...made, state: round2 }, "132055");
    // The second round's first Goblin surged as the first round's did: two more cards revealed. Without the end of the round the second Goblin of round 1 does not surge.
    const same = revealedTop({ ...made, state: round1 }, "132055");
    expect(same.staging.filter((id) => same.cards[id]?.code === "132055")).toHaveLength(3);
    expect(again.staging.filter((id) => again.cards[id]?.code === "132055")).toHaveLength(4);
  });

  it("132053:A:4 without Bolg in play nothing surges", () => {
    const made = table({ staging: [], deck: ["132055", "132055", "132058", "f0", "f0"] });
    const state = revealedTop(made, "132055");
    expect(state.staging.filter((id) => state.cards[id]?.code === "132055")).toHaveLength(1);
  });
});

describe("the character with the most damage defends (132059:A:1)", () => {
  const damaged = (exhausted: boolean) => (state: ScenarioState, made: { hero2: string }): ScenarioState => ({ ...state, cards: { ...state.cards, [made.hero2]: { ...state.cards[made.hero2]!, damage: 1, exhausted } } });
  const tableOf = (layout: Layout) => table({ ...layout, stage: S2 });

  it("132059:A:1 a character with less damage cannot be declared as the defender", () => {
    expect(() => fightEnemy(tableOf, "f0", "132059", {}, { tweak: damaged(false) })).toThrow("DeclareDefender refused: The defending player must declare the character with the most damage");
  });

  it("132059:A:1 the character with the most damage defends even when it is exhausted", () => {
    const fought = fightEnemy(tableOf, "f0", "132059", {}, { tweak: damaged(true), defender: (made) => made.hero2 });
    expect(fought.run.state.pendingAttack).toBeNull();
    expect(fought.run.state.cards[fought.made.hero2]?.exhausted).toBe(true);
  });

  it("132059:A:1 the attack cannot be left undefended while a character can defend it", () => {
    expect(() => fightEnemy(tableOf, "f0", "132059", {}, { tweak: damaged(false), undefended: true })).toThrow("Undefended refused: The defending player must declare the character with the most damage");
  });
});

describe("an attack that is already undefended is not forced onto a defender (132059:A:1, rr.step-6-4-3)", () => {
  // Ravenous Warg attacks seat 0 and the table is at its defense window; `tweak` changes the table before the attack starts.
  function atDefense(seats: 1 | 2, tweak: (state: ScenarioState, ids: { hero: string; hero2: string }) => ScenarioState) {
    const made = tableFromLayout("the-battle-of-five-armies", { stage: S2, seats, phase: "Encounter", engaged: [{ code: "132059", seat: 0 }], deck: ["f0", "f0", "f0"] });
    const state = syncConstants(tweak(made.state, made), made.ctx);
    let run = send(start(state), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass, made.ctx);
    }
    expect(run.state.window?.kind).toBe("defense");
    return { made, run };
  }
  const exhaust = (...ids: string[]) => (state: ScenarioState): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, ids.includes(id) ? { ...card, exhausted: true } : card])) });
  // What a defender destroyed by the shadow card leaves behind (shadow.ts, resolveAttack): the attack is undefended and the hero is named next.
  const undefendedNow = (state: ScenarioState): ScenarioState => ({ ...state, pendingAttack: state.pendingAttack ? { ...state.pendingAttack, undefended: true } : null });

  for (const seats of [1, 2] as const) {
    it(`132059:A:1 the attack left undefended after its defender is gone offers only Undefended and takes it (${seats} seat${seats === 1 ? "" : "s"})`, () => {
      const { made, run } = atDefense(seats, (state, ids) => exhaust(ids.hero, ids.hero2)(state));
      // Before the defender goes, the Warg forces one: only a declaration is offered.
      expect(legalIntents(run.state, made.ctx).map((intent) => intent.type)).toEqual(["DeclareDefender"]);
      const after = { ...run, state: undefendedNow(run.state) };
      const offered = legalIntents(after.state, made.ctx);
      expect(offered.map((intent) => intent.type)).toEqual(["Undefended"]);
      const [hero] = legalTargets(after.state, { type: "Undefended" }, made.ctx);
      expect(hero).toBeDefined();
      expect(() => send(after, { type: "Undefended", heroId: hero }, made.ctx)).not.toThrow();
    });
  }

  it("132059:A:1 with no character that can be declared, Undefended is offered and accepted", () => {
    const stopped = (state: ScenarioState, ids: { hero: string; hero2: string }): ScenarioState => ({
      ...state,
      modifiers: [...state.modifiers, ...[ids.hero, ids.hero2].map((id) => ({ instanceId: id, sourceId: id, stat: "cannotDefend" as const, amount: 1, until: "endOfGame" as const }))],
    });
    const { made, run } = atDefense(1, stopped);
    expect(legalTargets(run.state, { type: "DeclareDefender" }, made.ctx)).toEqual([]);
    const offered = legalIntents(run.state, made.ctx);
    expect(offered.map((intent) => intent.type)).toContain("Undefended");
    const [hero] = legalTargets(run.state, { type: "Undefended" }, made.ctx);
    expect(hero).toBeDefined();
    expect(() => send(run, { type: "Undefended", heroId: hero }, made.ctx)).not.toThrow();
  });
});

describe("the topmost enemy of the discard pile (132077:B:3)", () => {
  it("132077:B:3 the last enemy discarded is added to the staging area, put and not revealed", () => {
    const made = inPlay({ discard: ["132055", "132058"] });
    const run = runInstruction(made.state, { verb: "StageTopmostFromDiscard", type: "enemy" }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(run.staging.filter((id) => run.cards[id]?.code === "132058")).toHaveLength(1);
    expect(run.encounterDiscard.map((id) => run.cards[id]?.code)).toEqual(["132055"]);
  });
});
