// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, faq.errata.06117, faq.errata.06123, hon.battle, hon.siege, mec109.archery, rr.then, rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06117:A:1, 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:1, 06118:B:2, 06118:B:3, 06118:B:4, 06119:A:1, 06119:A:2, 06120:A:1, 06120:A:2, 06121:A:1, 06122:A:1, 06122:A:2, 06123:A:1, 06123:A:2, 06123:A:3, 06124:A:1, 06125:A:1, 06125:A:2, 06126:A:1, 06127:A:1, 06127:A:2, 06128:A:1, 06128:A:2, 06128:A:3, 06129:A:1, 06130:A:1, 06130:A:2, 06130:A:3, 06131:A:1, 06131:A:2, 06132:A:1, 06132:A:2, 06132:A:3, 06133:A:1, 06133:A:2, 06133:A:3.
// An independent audit of The Blood of Gondor: each test is built from the printed words and the rule spans, on the smallest table of the scene kit. A line's test runs again without the line's records and must fail there (`lineSpec`); a line the engine does not play as printed is an `it.fails` under a FAULT comment.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { stagingThreat } from "../../../rules/quest/quest.ts";
import { eliminateSeat } from "../../../rules/core/eliminate.ts";
import { startScenario, reduce } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { run as runInstruction, fightEnemy, first, idOf, opened, revealedTop, send, zoneOf, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { drive, engagedCodes, offeredActions, table, takes, CODES, BOROMIR } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";
import { bloodStart, bloodWorld } from "../../../../test/scenarios/the-blood-of-gondor/game.ts";
import { ALLY, tableOf, hiddenOf, discardCodes, stagingCodes, endOfRound, toCombatChoice, choose, inPlayOf } from "./audit-kit.ts";

describe("06132 Faramir and 06133 Lord Alcaron", () => {
  const FARAMIR_ACTION = "06132:action:1";
  const ALCARON_ACTION = "06133:action:1";
  const useAction = (made: ReturnType<typeof table>, state: ScenarioState, code: string, effectId: string): Run => drive(made, send(opened(made, state), { type: "Trigger", cardId: idOf(state, code), effectId }, made.ctx), (st) => st.window?.kind !== "choose" && st.stack.length === 0);
  const combat = (effects: readonly Effect[], layout: Layout) => tableOf(effects)({ phase: "Combat", play: [CODES.faramir, CODES.alcaron], deck: ["f0", "f0", "f0", "f0"], ...layout });

  for (const [line, code] of [["06132:A:1", CODES.faramir], ["06133:A:1", CODES.alcaron]] as const) {
    lineSpec(line, "the first player gains control, again each time the first player token passes", (effects) => {
      const made = tableOf(effects)({ seats: 2, play: [code], phase: "Refresh" });
      const done = endOfRound(made, made.state);
      expect(done.state.firstPlayer).toBe(1);
      expect(done.state.cards[first(done.state, code)]?.controller).toBe(1);
      expect(inPlayOf(done.state, 1)).toContain(code);
      expect(inPlayOf(done.state, 0)).not.toContain(code);
      const again = endOfRound(made, done.state);
      expect(again.state.firstPlayer).toBe(0);
      expect(again.state.cards[first(again.state, code)]?.controller).toBe(0);
    });
  }

  lineSpec("06132:A:2", "turns a hidden enemy faceup, which engages the player and takes 3 damage, and Faramir exhausts", (effects) => {
    const made = combat(effects, { seats: 1, deck: [CODES.numenorean, "f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 1);
    expect(offeredActions(made, held)).toContain(FARAMIR_ACTION);
    const done = useAction(made, held, CODES.faramir, FARAMIR_ACTION);
    expect(hiddenOf(done.state, 0)).toEqual([]);
    expect(engagedCodes(done.state, 0)).toEqual([CODES.numenorean]);
    expect(done.state.cards[idOf(done.state, CODES.numenorean)]?.damage).toBe(3);
    expect(done.state.cards[idOf(done.state, CODES.faramir)]?.exhausted).toBe(true);
    expect(offeredActions(made, done.state)).not.toContain(FARAMIR_ACTION);
  });
  lineSpec("06132:A:2", "a treachery or a location turned faceup is discarded unresolved, and a hidden card is turned only once", (effects) => {
    const made = combat(effects, { seats: 1, deck: [CODES.looms, "place", "f0", "f0"] });
    const held = takes(made, made.state, 0, 2);
    const done = useAction(made, held, CODES.faramir, FARAMIR_ACTION);
    expect(hiddenOf(done.state, 0)).toHaveLength(1);
    expect(discardCodes(done.state)).toHaveLength(1);
    expect(stagingCodes(done.state)).toEqual([]);
    expect(engagedCodes(done.state, 0)).toEqual([]);
  });
  lineSpec("06132:A:2", "may turn another player's hidden card: the enemy engages that player", (effects) => {
    const made = combat(effects, { seats: 2, deck: [CODES.numenorean, "f0", "f0", "f0"] });
    const held = takes(made, made.state, 1, 1);
    const done = useAction(made, held, CODES.faramir, FARAMIR_ACTION);
    expect(engagedCodes(done.state, 1)).toEqual([CODES.numenorean]);
    expect(engagedCodes(done.state, 0)).toEqual([]);
    expect(hiddenOf(done.state, 1)).toEqual([]);
  });
  lineSpec("06132:A:2", "is a Combat Action only, and not offered with no hidden card in the game", (effects) => {
    const quest = tableOf(effects)({ phase: "Quest", play: [CODES.faramir], deck: ["f0", "f0"] });
    expect(offeredActions(quest, takes(quest, quest.state, 0, 1))).not.toContain(FARAMIR_ACTION);
    const none = combat(effects, { seats: 1 });
    expect(offeredActions(none, none.state)).not.toContain(FARAMIR_ACTION);
    const some = combat(effects, { seats: 1 });
    expect(offeredActions(some, takes(some, some.state, 0, 1))).toContain(FARAMIR_ACTION);
  });
  lineSpec("06132:A:2", "only the player who controls Faramir may use it", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Combat", play: [{ code: CODES.faramir, seat: 1 }], deck: ["f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 1);
    expect(offeredActions(made, { ...held, activeSeat: 0 })).not.toContain(FARAMIR_ACTION);
    expect(offeredActions(made, { ...held, activeSeat: 1 })).toContain(FARAMIR_ACTION);
  });

  lineSpec("06133:A:2", "returns an enemy engaged with you to the staging area, and Lord Alcaron exhausts", (effects) => {
    const made = combat(effects, { seats: 1, engaged: [CODES.numenorean] });
    expect(offeredActions(made, made.state)).toContain(ALCARON_ACTION);
    const done = useAction(made, made.state, CODES.alcaron, ALCARON_ACTION);
    expect(engagedCodes(done.state, 0)).toEqual([]);
    expect(stagingCodes(done.state)).toContain(CODES.numenorean);
    expect(done.state.cards[idOf(done.state, CODES.alcaron)]?.exhausted).toBe(true);
  });
  lineSpec("06133:A:2", "is not offered with no enemy engaged with you, though another player has one", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Combat", play: [CODES.alcaron], engaged: [{ code: "f0", seat: 1 }] });
    expect(offeredActions(made, made.state)).not.toContain(ALCARON_ACTION);
    const both = tableOf(effects)({ seats: 2, phase: "Combat", play: [CODES.alcaron], engaged: [{ code: "f0", seat: 1 }, { code: "f3", seat: 0 }] });
    expect(offeredActions(both, both.state)).toContain(ALCARON_ACTION);
  });
  lineSpec("06133:A:2", "is an Action of any phase", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Quest", play: [CODES.alcaron], engaged: ["f0"] });
    expect(offeredActions(made, made.state)).toContain(ALCARON_ACTION);
  });

  for (const [line, code] of [["06132:A:3", CODES.faramir], ["06133:A:3", CODES.alcaron]] as const) {
    lineSpec(line, "the players lose when the card leaves play, and not before", (effects) => {
      const made = tableOf(effects)({ seats: 1, play: [CODES.faramir, CODES.alcaron] });
      expect(settle(made.state, made.ctx, []).lost).not.toBe(true);
      const gone = settle(runInstruction(made, made.state, { verb: "Discard", target: { kind: "self" } }, { sourceId: idOf(made.state, code) }), made.ctx, []);
      expect(gone.lost).toBe(true);
    });
    lineSpec(line, "the players lose when a real attack destroys it", (effects) => {
      const fight = fightEnemy(tableOf(effects), "f0", CODES.numenorean, { seats: 1, stage: CODES.captured, play: [code] }, { defender: (made) => idOf(made.state, code) });
      expect(fight.run.state.lost).toBe(true);
    });
  }
});

describe("Further moments of the hidden cards", () => {
  const four = ["treachery", "treachery", "treachery", "treachery"];
  lineSpec("06118:B:3", "a card that makes him take a fifth hidden card outside the quest phase (Mordor Looms) turns all five at once", (effects) => {
    const made = tableOf(effects)({ seats: 1, stage: CODES.captured, deck: [...four, "f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 4);
    const done = revealedTop({ state: held, ctx: made.ctx }, CODES.looms);
    expect(hiddenOf(done, 0)).toEqual([]);
    expect(discardCodes(done).filter((code) => code === "treachery")).toHaveLength(4);
  });
  lineSpec("06118:B:3", "a Shadow card that makes the defending player take his fifth hidden card turns all five", (effects) => {
    const fight = fightEnemy(tableOf(effects), CODES.crow, "f0", { seats: 1, stage: CODES.captured, deck: [...four, CODES.crow, "f0", "f0"] }, { tweak: (state, made) => takes(made, state, 0, 4) });
    expect(hiddenOf(fight.run.state, 0)).toEqual([]);
    expect(discardCodes(fight.run.state).filter((code) => code === "treachery")).toHaveLength(4);
  });
  lineSpec("06118:B:3", "a travel cost that takes the fifth hidden card turns them, and the travel still happens", (effects) => {
    const made = tableOf(effects)({ seats: 1, stage: CODES.captured, phase: "Travel", staging: [CODES.southern], deck: [...four, "treachery", "f0"] });
    const held = takes(made, made.state, 0, 4);
    const done = send(opened(made, held), { type: "Travel", locationId: idOf(held, CODES.southern) }, made.ctx);
    expect(zoneOf(done.state, CODES.southern)).toBe("activeLocation");
    expect(hiddenOf(done.state, 0)).toEqual([]);
  });
  lineSpec("06124:A:1", "the travel cost takes a card from the discard pile when the deck is empty", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Travel", staging: [CODES.southern], deck: [], discard: ["f3"] });
    const done = send(opened(made), { type: "Travel", locationId: idOf(made.state, CODES.southern) }, made.ctx);
    expect(zoneOf(done.state, CODES.southern)).toBe("activeLocation");
    expect(hiddenOf(done.state, 0)).toEqual(["f3"]);
  });
  lineSpec("06119:A:1", "the hidden cards add to the staging area total through its Threat", (effects) => {
    const made = tableOf(effects)({ seats: 2, staging: [CODES.numenorean], deck: ["treachery", "treachery", "treachery"] });
    const held = takes(made, takes(made, made.state, 0, 2), 1, 1);
    expect(stagingThreat(opened(made, held).state, made.cards)).toBe(3);
  });
  lineSpec("06119:A:2", "also while it is engaged with a player", (effects) => {
    const made = tableOf(effects)({ seats: 1, engaged: [CODES.numenorean], phase: "Refresh", deck: ["treachery", "treachery", "f0"] });
    const held = takes(made, made.state, 0, 2);
    const done = endOfRound(made, held);
    expect(done.state.seats[0]?.threat).toBe((made.state.seats[0]?.threat ?? 0) + 1 + 2);
  });
  lineSpec("06118:A:1", "when the quest advances to Captured! the allies go under it and the hidden cards are turned", (effects) => {
    const made = tableOf(effects)({ seats: 1, stage: CODES.ambush, progress: 10, phase: "Quest", heroes: [BOROMIR], play: [CODES.faramir, CODES.alcaron], deck: ["f3", "treachery", "f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 2);
    const done = drive(made, send(opened(made, held), { type: "Commit", cardIds: [idOf(held, BOROMIR)] }, made.ctx), (st) => st.cards[st.questStage ?? ""]?.code === CODES.captured && st.stack.length === 0);
    expect(done.state.cards[idOf(done.state, CODES.faramir)]?.controller).toBeNull();
    expect(hiddenOf(done.state, 0)).toEqual([]);
    expect(engagedCodes(done.state, 0)).toContain("f3");
    expect(done.state.lost).not.toBe(true);
  });
  it("ats.hidden-cards a player eliminated has his hidden cards discarded", () => {
    const made = table({ seats: 2, deck: ["f3", "treachery", "f0", "f0"] });
    const held = takes(made, takes(made, made.state, 1, 2), 0, 1);
    const gone = settle(eliminateSeat(held, 1, []), made.ctx, []);
    expect(hiddenOf(gone, 1)).toEqual([]);
    expect(hiddenOf(gone, 0)).toHaveLength(1);
    expect(discardCodes(gone)).toEqual(expect.arrayContaining(["f3", "treachery"]));
  });
});

describe("The second player engages", () => {
  /** The first seat declines to engage and the second seat engages the enemy with this code. */
  const secondEngages = (made: ReturnType<typeof table>, code: string): Run => {
    const declined = send(opened(made), { type: "DeclineEngage" }, made.ctx);
    expect(declined.state.activeSeat).toBe(1);
    // The engagement ends the step: the next window (the combat choice of stage 1B) is left unanswered.
    return send(declined, { type: "Engage", enemyId: idOf(declined.state, code) }, made.ctx);
  };
  lineSpec("06122:A:1", "the player the Crow engaged takes the hidden card, not the first player", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Encounter", staging: [CODES.crow], deck: ["f3", "f0", "f0"] });
    const done = secondEngages(made, CODES.crow);
    expect(engagedCodes(done.state, 1)).toEqual([CODES.crow]);
    expect(hiddenOf(done.state, 1)).toEqual(["f3"]);
    expect(hiddenOf(done.state, 0)).toEqual([]);
  });
  lineSpec("06120:A:1", "the player the Ambusher engaged discards his own ally, not the first player's", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Encounter", staging: [CODES.ambusher], play: [{ code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }] });
    const done = secondEngages(made, CODES.ambusher);
    expect(engagedCodes(done.state, 1)).toEqual([CODES.ambusher]);
    expect(inPlayOf(done.state, 1)).not.toContain(ALLY);
    expect(inPlayOf(done.state, 0)).toContain(ALLY);
  });
});

describe("06117:A:1 a started game", () => {
  it("06117:A:1 the game starts with Black Numenorean and The Cross-roads in the staging area and both allies in play under the first player", async () => {
    const { ctx } = await bloodWorld();
    for (const seats of [1, 2] as const) {
      let state = startScenario(bloodStart(seats, 4, "Normal"), ctx);
      for (let kept = 0; kept < seats; kept += 1) {
        const result = reduce(state, { type: "Keep" }, ctx);
        if (result.ok) state = result.state;
      }
      const staged = stagingCodes(state);
      expect(staged).toEqual(expect.arrayContaining([CODES.numenorean, CODES.crossroads]));
      for (const code of [CODES.faramir, CODES.alcaron]) expect(state.cards[idOf(state, code)]).toMatchObject({ zone: "play", controller: 0 });
    }
  });
  it("06117:B:2 the combat choice is the stage's, and an enemy turned faceup at the start of combat is dealt a shadow card", () => {
    const made = table({ seats: 1, phase: "Encounter", deck: ["f3", "f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 1);
    const turned = drive(made, choose(made, toCombatChoice(made, held), "turn"), (st) => st.window?.kind === "defense");
    expect(engagedCodes(turned.state, 0)).toEqual(["f3"]);
    expect(turned.state.cards[idOf(turned.state, "f3")]?.shadowId).not.toBeNull();
  });
});
