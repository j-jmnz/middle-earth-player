// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, mec109.archery, rr.then, rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06117:B:2, 06119:A:2, 06120:A:1, 06128:A:2, 06128:A:3, 06131:A:1, 06132:A:2, 06133:A:2.
// An audit of The Blood of Gondor: each test is built from the printed words and the rule spans, on the smallest table of the scene kit, and holds a case the scenario's own tests (`lines-*.test.ts`) do not reach. A line's test runs
// again without the line's records and must fail there (`lineSpec`).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { run as runInstruction, idOf, opened, revealedTop, send, zoneOf, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { drive, engagedCodes, offeredActions, table, takes, CODES, BOROMIR } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";
import { tableOf, hiddenOf, discardCodes, stagingCodes, endOfRound, toCombatChoice, choose, engages, inPlayOf } from "./audit-kit.ts";

describe("06117:B:2 the combat phase choice", () => {
  lineSpec("06117:B:2", "turning faceup engages an enemy whatever its cost, discards a treachery and a location unresolved, and takes nothing", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Encounter", deck: ["f0", CODES.looms, "place", "f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 3);
    expect(hiddenOf(held, 0)).toEqual(["f0", CODES.looms, "place"]);
    const choice = toCombatChoice(made, held);
    expect(choice.state.window).toMatchObject({ kind: "choose", options: expect.arrayContaining(["turn", "take"]) });
    const done = drive(made, choose(made, choice, "turn"), (st) => st.window?.kind !== "choose" && st.window?.kind != null);
    expect(hiddenOf(done.state, 0)).toEqual([]);
    expect(engagedCodes(done.state, 0)).toContain("f0");
    expect(discardCodes(done.state)).toEqual(expect.arrayContaining([CODES.looms, "place"]));
    expect(stagingCodes(done.state)).not.toContain("place");
  });
});

describe("06119:A:2 Black Numenorean", () => {
  lineSpec("06119:A:2", "also while it is engaged with a player", (effects) => {
    const made = tableOf(effects)({ seats: 1, engaged: [CODES.numenorean], phase: "Refresh", deck: ["treachery", "treachery", "f0"] });
    const held = takes(made, made.state, 0, 2);
    const done = endOfRound(made, held);
    expect(done.state.seats[0]?.threat).toBe((made.state.seats[0]?.threat ?? 0) + 1 + 2);
  });
});

describe("06120:A:1 Orc Ambusher", () => {
  it("06120:A:1 discards nothing, if unable, when the only allies are objectives", () => {
    const made = table({ seats: 1, phase: "Encounter", staging: [CODES.ambusher], play: [CODES.faramir, CODES.alcaron] }, undefined, [BOROMIR]);
    const done = engages(made, made.state, CODES.ambusher);
    expect(engagedCodes(done.state, 0)).toEqual([CODES.ambusher]);
    expect(inPlayOf(done.state, 0)).toEqual(expect.arrayContaining([CODES.faramir, CODES.alcaron]));
    expect(done.state.lost).not.toBe(true);
  });
});

describe("06128 The Dark Woods", () => {
  const archeryTotal = (effects: readonly Effect[], layout: Layout): number => {
    const made = tableOf(effects)({ stage: CODES.captured, phase: "Encounter", ...layout });
    const done = drive(made, opened(made), (st) => st.window?.kind === "archery" || st.phase === "Quest" || st.lost === true);
    return done.state.window?.kind === "archery" ? done.state.window.total : 0;
  };
  lineSpec("06128:A:2", "X is the number of players, also as the active location", (effects) => {
    expect(archeryTotal(effects, { seats: 2, active: CODES.darkWoods })).toBe(2);
  });
  const exploring = (effects: readonly Effect[], hidden: readonly string[], explored: boolean) => {
    const made = tableOf(effects)({ seats: 2, firstPlayer: 1, phase: "Quest", active: CODES.darkWoods, deck: [...hidden, "f0", "f0", "f0"] });
    let state = takes(made, made.state, 1, hidden.length);
    state = takes(made, state, 0, 1);
    const woods = idOf(state, CODES.darkWoods);
    if (!explored) {
      const left = settle(runInstruction(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: woods }), made.ctx, []);
      return { made, after: left };
    }
    const committed = send(opened(made, state), { type: "Commit", cardIds: [made.hero] }, made.ctx);
    return { made, after: drive(made, committed, (st) => st.phase !== "Quest").state };
  };
  lineSpec("06128:A:3", "with 2 hidden cards he discards exactly one of them", (effects) => {
    const { after } = exploring(effects, ["f0", "treachery"], true);
    expect(hiddenOf(after, 1)).toHaveLength(1);
  });
  it("06128:A:3 does not fire when it leaves play without being explored", () => {
    const { after } = exploring(EFFECTS, ["f0"], false);
    expect(zoneOf(after, CODES.darkWoods)).not.toBe("activeLocation");
    expect(hiddenOf(after, 1)).toEqual(["f0"]);
  });
});

describe("06131 Conflict at the Crossroads", () => {
  lineSpec("06131:A:1", "an Orc in the staging area keeps counting its own Threat once, and it ends with the phase", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Quest", deck: ["f0", "f0", "f0", "f0", "f0"], staging: [CODES.rabble], engaged: [{ code: CODES.ambusher, seat: 0 }] });
    const done = revealedTop(made, CODES.conflict);
    expect(stagingThreat(done, made.cards)).toBe(4);
    const next = drive(made, opened(made, { ...done, mode: "questCommit", window: { kind: "pass" }, phase: "Quest", boundaryPhase: "Quest" }), (st) => st.phase === "Encounter");
    expect(next.state.phase).toBe("Encounter");
    expect(stagingThreat(next.state, made.cards)).toBe(2);
  });
});

describe("06132 Faramir and 06133 Lord Alcaron", () => {
  const FARAMIR_ACTION = "06132:action:1";
  const ALCARON_ACTION = "06133:action:1";
  const useAction = (made: ReturnType<typeof table>, state: ScenarioState, code: string, effectId: string): Run => drive(made, send(opened(made, state), { type: "Trigger", cardId: idOf(state, code), effectId }, made.ctx), (st) => st.window?.kind !== "choose" && st.stack.length === 0);
  lineSpec("06132:A:2", "a treachery or a location turned faceup is discarded unresolved, and a hidden card is turned only once", (effects) => {
    const made = tableOf(effects)({ phase: "Combat", play: [CODES.faramir, CODES.alcaron], seats: 1, deck: [CODES.looms, "place", "f0", "f0"] });
    const held = takes(made, made.state, 0, 2);
    expect(offeredActions(made, held)).toContain(FARAMIR_ACTION);
    const done = useAction(made, held, CODES.faramir, FARAMIR_ACTION);
    expect(hiddenOf(done.state, 0)).toHaveLength(1);
    expect(discardCodes(done.state)).toHaveLength(1);
    expect(stagingCodes(done.state)).toEqual([]);
    expect(engagedCodes(done.state, 0)).toEqual([]);
  });
  lineSpec("06133:A:2", "is an Action of any phase", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Quest", play: [CODES.alcaron], engaged: ["f0"] });
    expect(offeredActions(made, made.state)).toContain(ALCARON_ACTION);
  });
});
