// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, faq.errata.06117, faq.errata.06123, hon.battle, hon.siege, mec109.archery, rr.then, rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06117:A:1, 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:1, 06118:B:2, 06118:B:3, 06118:B:4, 06119:A:1, 06119:A:2, 06120:A:1, 06120:A:2, 06121:A:1, 06122:A:1, 06122:A:2, 06123:A:1, 06123:A:2, 06123:A:3, 06124:A:1, 06125:A:1, 06125:A:2, 06126:A:1, 06127:A:1, 06127:A:2, 06128:A:1, 06128:A:2, 06128:A:3, 06129:A:1, 06130:A:1, 06130:A:2, 06130:A:3, 06131:A:1, 06131:A:2, 06132:A:1, 06132:A:2, 06132:A:3, 06133:A:1, 06133:A:2, 06133:A:3.
// An independent audit of The Blood of Gondor: each test is built from the printed words and the rule spans, on the smallest table of the scene kit. A line's test runs again without the line's records and must fail there (`lineSpec`); a line the engine does not play as printed is an `it.fails` under a FAULT comment.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";

import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { run as runInstruction, fightEnemy, idOf, legalTargets, opened, revealedTop, send, statOf, zoneOf, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { drive, engagedCodes, hurt, table, takes, CODES, BOROMIR } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

import { ALLY, tableOf, hiddenOf, discardCodes, stagingCodes, endOfRound, toCombatChoice, choose, engages, inPlayOf } from "./audit-kit.ts";

describe("06119 Black Numenorean", () => {
  lineSpec("06119:A:1", "its Threat is the number of hidden cards of all players together, counted again when they change", (effects) => {
    const made = tableOf(effects)({ seats: 2, staging: [CODES.numenorean], deck: ["treachery", "treachery", "treachery", "treachery"] });
    let state = takes(made, made.state, 0, 2);
    state = takes(made, state, 1, 1);
    expect(statOf(opened(made, state).state, made.ctx.cards, CODES.numenorean, "threat")).toBe(3);
    state = takes(made, state, 1, 1);
    expect(statOf(opened(made, state).state, made.ctx.cards, CODES.numenorean, "threat")).toBe(4);
    expect(statOf(opened(made, made.state).state, made.ctx.cards, CODES.numenorean, "threat")).toBe(0);
  });
  lineSpec("06119:A:2", "at the end of the round each player raises his threat by 1 for each hidden card in his own play area", (effects) => {
    const made = tableOf(effects)({ seats: 2, staging: [CODES.numenorean], phase: "Refresh", deck: ["treachery", "treachery", "treachery", "f0", "f0"] });
    let state = takes(made, made.state, 0, 2);
        const base = made.state.seats.map((seat) => seat.threat);
    const done = endOfRound(made, state);
    // The refresh phase raises each threat by 1 itself; the card adds the hidden cards: 2 for the first seat, none for the second.
    expect(done.state.seats.map((seat) => seat.threat)).toEqual([(base[0] ?? 0) + 1 + 2, (base[1] ?? 0) + 1]);
  });
});

describe("06120 Orc Ambusher", () => {
  lineSpec("06120:A:1", "after it engages you, you discard a non-objective ally you control and never Faramir or Lord Alcaron", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Encounter", staging: [CODES.ambusher], play: [CODES.faramir, CODES.alcaron, ALLY] });
    const done = engages(made, made.state, CODES.ambusher);
    expect(engagedCodes(done.state, 0)).toEqual([CODES.ambusher]);
    expect(inPlayOf(done.state, 0)).toEqual(expect.arrayContaining([CODES.faramir, CODES.alcaron]));
    expect(inPlayOf(done.state, 0)).not.toContain(ALLY);
    expect(done.state.lost).not.toBe(true);
  });
  it("06120:A:1 discards nothing, if unable, when the only allies are objectives", () => {
    const made = table({ seats: 1, phase: "Encounter", staging: [CODES.ambusher], play: [CODES.faramir, CODES.alcaron] }, undefined, [BOROMIR]);
    const done = engages(made, made.state, CODES.ambusher);
    expect(engagedCodes(done.state, 0)).toEqual([CODES.ambusher]);
    expect(inPlayOf(done.state, 0)).toEqual(expect.arrayContaining([CODES.faramir, CODES.alcaron]));
    expect(done.state.lost).not.toBe(true);
  });
  lineSpec("06120:A:1", "takes only an ally the engaged player controls, not another player's ally", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Encounter", staging: [CODES.ambusher], play: [{ code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }] });
    const done = engages(made, made.state, CODES.ambusher);
    expect(inPlayOf(done.state, 0)).not.toContain(ALLY);
    expect(inPlayOf(done.state, 1)).toContain(ALLY);
  });
  lineSpec("06120:A:1", "also when a hidden turn engages it", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Encounter", play: [CODES.faramir, ALLY], deck: [CODES.ambusher, "f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 1);
    const choice = toCombatChoice(made, held);
    const done = choose(made, choice, "turn");
    expect(engagedCodes(done.state, 0)).toContain(CODES.ambusher);
    expect(inPlayOf(done.state, 0)).not.toContain(ALLY);
    expect(inPlayOf(done.state, 0)).toContain(CODES.faramir);
  });
  lineSpec("06120:A:2", "Shadow: +1 Attack to the attacking enemy, defended", (effects) => {
    // Evil Crow (Attack 1) attacks; the ally defending has Defense 1, so +1 Attack makes 1 damage.
    const fight = fightEnemy(tableOf(effects), CODES.ambusher, CODES.crow, { seats: 1, play: [ALLY] }, { defender: (made) => idOf(made.state, ALLY) });
    expect(fight.run.state.cards[idOf(fight.run.state, ALLY)]?.damage).toBe(1);
  });
  lineSpec("06120:A:2", "Shadow: +3 Attack instead, not +4, when the attack is undefended", (effects) => {
    const fight = fightEnemy(tableOf(effects), CODES.ambusher, CODES.crow, { seats: 1 }, { undefended: true });
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(4);
  });
});

describe("06121 Brutal Uruk", () => {
  // The hidden cards are the first two of the deck; the shadow card of the attack is the third.
  const uruk = (effects: readonly Effect[], options: { allyDefends: boolean }) =>
    fightEnemy(
      tableOf(effects),
      "f0",
      CODES.uruk,
      { seats: 1, stage: CODES.captured, play: [ALLY], deck: ["f3", "treachery", "f0", "f0", "f0"] },
      { tweak: (state, made) => takes(made, state, 0, 2), ...(options.allyDefends ? { defender: (made: { state: ScenarioState }) => idOf(made.state, ALLY) } : {}) },
    );
  lineSpec("06121:A:1", "after its attack destroys a character, the controller turns the hidden cards faceup, deals a shadow card to the enemy turned and resolves its attack", (effects) => {
    const fight = uruk(effects, { allyDefends: true });
    expect(fight.start.seats[0]?.engaged).toHaveLength(1);
    expect(hiddenOf(fight.run.state, 0)).toEqual([]);
    expect(engagedCodes(fight.run.state, 0)).toContain("f3");
    expect(discardCodes(fight.run.state)).toContain("treachery");
    // Both shadow cards left the deck: the Uruk's and the one dealt to the turned enemy.
    expect(fight.run.state.encounterDeck).toHaveLength(1);
    expect(fight.run.state.cards[idOf(fight.run.state, "f3")]?.shadowId).not.toBeNull();
    // The turned enemy's attack was resolved in the same combat phase: with the ally gone nobody defended, so the second hero took its Attack 1.
    expect(fight.run.state.cards[fight.made.hero2]?.damage).toBe(1);
  });
  it("06121:A:1 turns nothing when the attack destroys no character", () => {
    const fight = uruk(EFFECTS, { allyDefends: false });
    expect(hiddenOf(fight.run.state, 0)).toHaveLength(2);
  });
});

describe("06122 Evil Crow", () => {
  lineSpec("06122:A:1", "when it engages a player that player takes 1 hidden card", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Encounter", staging: [CODES.crow], deck: ["f3", "f0", "f0"] });
    const done = engages(made, made.state, CODES.crow);
    expect(engagedCodes(done.state, 0)).toEqual([CODES.crow]);
    expect(hiddenOf(done.state, 0)).toEqual(["f3"]);
    expect(hiddenOf(done.state, 1)).toEqual([]);
  });
  lineSpec("06122:A:2", "Shadow: the defending player takes 1 hidden card, not the attacker's controller", (effects) => {
    const fight = fightEnemy(tableOf(effects), CODES.crow, "f0", { seats: 2, engaged: [{ code: "f0", seat: 1 }], deck: [CODES.crow, "f3", "f0", "f0"] }, { defender: (made) => made.seat1Hero ?? made.hero });
    expect(hiddenOf(fight.run.state, 1)).toHaveLength(1);
    expect(hiddenOf(fight.run.state, 0)).toEqual([]);
  });
});

describe("06123:A:2 The Cross-roads Threat", () => {
  lineSpec("06123:A:2", "its Threat is the number of players", (effects) => {
    for (const seats of [1, 2] as const) {
      const made = tableOf(effects)({ seats, staging: [CODES.crossroads] });
      expect(statOf(made.state, made.ctx.cards, CODES.crossroads, "threat")).toBe(seats);
    }
  });
});

describe("Travel costs: the first player takes hidden cards to travel", () => {
  const travelTable = (effects: readonly Effect[], code: string, layout: Layout = {}) => tableOf(effects)({ seats: 2, firstPlayer: 1, phase: "Travel", staging: [code], deck: ["treachery", "treachery", "treachery"], ...layout });
  const travelled = (made: ReturnType<typeof table>, code: string): Run => send(opened(made), { type: "Travel", locationId: idOf(made.state, code) }, made.ctx);
  for (const [line, code, amount] of [["06123:A:3", CODES.crossroads, 1], ["06124:A:1", CODES.southern, 1], ["06125:A:2", CODES.western, 1], ["06126:A:1", CODES.northern, 1], ["06127:A:2", CODES.eastern, 2]] as const) {
    lineSpec(line, `the first player, and no other, takes ${amount} hidden card(s) to travel, and cannot travel with nothing to take`, (effects) => {
      const made = travelTable(effects, code);
      const done = travelled(made, code);
      expect(zoneOf(done.state, code)).toBe("activeLocation");
      expect(hiddenOf(done.state, 1)).toHaveLength(amount);
      expect(hiddenOf(done.state, 0)).toEqual([]);
      const empty = travelTable(effects, code, { deck: [] });
      expect(legalTargets(opened(empty).state, { type: "Travel" }, empty.ctx)).not.toContain(idOf(empty.state, code));
    });
  }
});

describe("06125:A:1 and 06127:A:1 quest points in the staging area", () => {
  for (const [line, code, printed] of [["06125:A:1", CODES.western, 4], ["06127:A:1", CODES.eastern, 2]] as const) {
    lineSpec(line, "gets +5 quest points in the staging area and not as the active location", (effects) => {
      const staged = tableOf(effects)({ staging: [code] });
      expect(statOf(staged.state, staged.ctx.cards, code, "questPoints")).toBe(printed + 5);
      const active = tableOf(effects)({ active: code });
      expect(statOf(active.state, active.ctx.cards, code, "questPoints")).toBe(printed);
    });
  }
});

describe("06128 The Dark Woods", () => {
  const archeryTotal = (effects: readonly Effect[], layout: Layout): number => {
    const made = tableOf(effects)({ stage: CODES.captured, phase: "Encounter", ...layout });
    const done = drive(made, opened(made), (st) => st.window?.kind === "archery" || st.phase === "Quest" || st.lost === true);
    return done.state.window?.kind === "archery" ? done.state.window.total : 0;
  };
  lineSpec("06128:A:1", "Archery X: X is the number of players, in the staging area", (effects) => {
    expect(archeryTotal(effects, { seats: 1, staging: [CODES.darkWoods] })).toBe(1);
    expect(archeryTotal(effects, { seats: 2, staging: [CODES.darkWoods] })).toBe(2);
  });
  lineSpec("06128:A:2", "X is the number of players, also as the active location", (effects) => {
    expect(archeryTotal(effects, { seats: 2, active: CODES.darkWoods })).toBe(2);
  });
  const exploring = (effects: readonly Effect[], hidden: readonly string[], explored: boolean) => {
    const made = tableOf(effects)({ seats: 2, firstPlayer: 1, phase: "Quest", active: CODES.darkWoods, deck: [...hidden, "f0", "f0", "f0"] });
    let state = takes(made, made.state, 1, hidden.length);
    state = takes(made, state, 0, 1);
    const before = hiddenOf(state, 0);
    const woods = idOf(state, CODES.darkWoods);
    if (!explored) {
      const left = settle(runInstruction(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: woods }), made.ctx, []);
      return { made, before, after: left };
    }
    const committed = send(opened(made, state), { type: "Commit", cardIds: [made.hero] }, made.ctx);
    return { made, before, after: drive(made, committed, (st) => st.phase !== "Quest").state };
  };
  lineSpec("06128:A:3", "after it leaves play explored, the first player (not the active one) discards 1 hidden card, unturned", (effects) => {
    const { before, after } = exploring(effects, ["f0"], true);
    expect(zoneOf(after, CODES.darkWoods)).not.toBe("activeLocation");
    expect(hiddenOf(after, 1)).toEqual([]);
    expect(hiddenOf(after, 0)).toEqual(before);
    expect(engagedCodes(after, 1)).toEqual([]);
    expect(discardCodes(after)).toContain("f0");
  });
  lineSpec("06128:A:3", "with 2 hidden cards he discards exactly one of them", (effects) => {
    const { after } = exploring(effects, ["f0", "treachery"], true);
    expect(hiddenOf(after, 1)).toHaveLength(1);
  });
  it("06128:A:3 nothing is discarded when the first player has no hidden card", () => {
    const { before, after } = exploring(EFFECTS, [], true);
    expect(hiddenOf(after, 1)).toEqual([]);
    expect(hiddenOf(after, 0)).toEqual(before);
  });
  it("06128:A:3 does not fire when it leaves play without being explored", () => {
    const { after } = exploring(EFFECTS, ["f0"], false);
    expect(zoneOf(after, CODES.darkWoods)).not.toBe("activeLocation");
    expect(hiddenOf(after, 1)).toEqual(["f0"]);
  });
});

describe("06129 Lying in Wait", () => {
  const lying = (effects: readonly Effect[]) => {
    const made = tableOf(effects)({ seats: 2, firstPlayer: 1, deck: ["f3", "place", CODES.looms, "f0", "f0", "f0", "f0", "f0"] });
    let state = takes(made, made.state, 1, 3);
    state = takes(made, state, 0, 1);
    return { made, state, done: revealedTop({ state, ctx: made.ctx }, CODES.lyingInWait) };
  };
  lineSpec("06129:A:1", "the first player turns his hidden cards faceup: an enemy engages him, a location joins the staging area, the other player's card stays", (effects) => {
    const { done } = lying(effects);
    expect(engagedCodes(done, 1)).toEqual(["f3"]);
    expect(engagedCodes(done, 0)).toEqual([]);
    expect(stagingCodes(done)).toEqual(["place"]);
    expect(hiddenOf(done, 0)).toHaveLength(2);
  });
  lineSpec("06129:A:1", "the When Revealed effect of a treachery turned faceup resolves (Mordor Looms: each player takes 1 hidden card, which stays facedown), and its surge does not fire", (effects) => {
    const { state, done } = lying(effects);
    expect(discardCodes(done)).toContain(CODES.looms);
    expect(hiddenOf(done, 1)).toHaveLength(1);
    expect(hiddenOf(done, 0)).toHaveLength(2);
    // Only the two cards Mordor Looms made the players take left the deck: no extra card was revealed by surge.
    expect(done.encounterDeck).toHaveLength(state.encounterDeck.length - 2);
  });
});

describe("06130 Mordor Looms", () => {
  it("06130:A:1 Surge: one more card is revealed after its When Revealed effect", () => {
    const made = table({ seats: 1, deck: ["f3", "place", "f0", "f0"] });
    const done = revealedTop(made, CODES.looms);
    expect(hiddenOf(done, 0)).toEqual(["f3"]);
    expect(stagingCodes(done)).toEqual(["place"]);
  });
  lineSpec("06130:A:2", "each player takes 1 hidden card, the first player first", (effects) => {
    const made = tableOf(effects)({ seats: 2, firstPlayer: 1, deck: ["f3", "place", "f0", "f0"] });
    const done = revealedTop(made, CODES.looms);
    expect(hiddenOf(done, 1)).toEqual(["f3"]);
    expect(hiddenOf(done, 0)).toEqual(["place"]);
  });
  const looms = (effects: readonly Effect[], preDamage: number) =>
    fightEnemy(
      tableOf(effects),
      CODES.looms,
      CODES.numenorean,
      { seats: 2, stage: CODES.captured, deck: ["f3", "treachery", "f0", CODES.looms, "f0", "f0", "f0"] },
      { undefended: true, tweak: (state, made) => hurt(made, takes(made, takes(made, state, 0, 2), 1, 1), "dh1", preDamage) },
    );
  lineSpec("06130:A:3", "Shadow: when the attack destroys a character its controller turns his hidden cards faceup, and the other player's stay", (effects) => {
    const fight = looms(effects, 3);
    expect(zoneOf(fight.run.state, "dh1")).not.toBe("heroes");
    expect(hiddenOf(fight.run.state, 0)).toEqual([]);
    expect(engagedCodes(fight.run.state, 0)).toContain("f3");
    expect(discardCodes(fight.run.state)).toContain("treachery");
    expect(hiddenOf(fight.run.state, 1)).toEqual(["f0"]);
  });
  it("06130:A:3 turns nothing when no character is destroyed", () => {
    const fight = looms(EFFECTS, 0);
    expect(zoneOf(fight.run.state, "dh1")).toBe("heroes");
    expect(hiddenOf(fight.run.state, 0)).toHaveLength(2);
  });
});

describe("06131 Conflict at the Crossroads", () => {
  const conflict = (effects: readonly Effect[], layout: Layout) => {
    const made = tableOf(effects)({ seats: 2, phase: "Quest", deck: ["place", "f0", "f0"], ...layout });
    const done = revealedTop(made, CODES.conflict);
    return { made, done };
  };
  lineSpec("06131:A:1", "Orc enemies engaged with players add their Threat to the staging area (any player's, never a non-Orc), and it gains no surge", (effects) => {
    const { made, done } = conflict(effects, { staging: ["place"], engaged: [{ code: CODES.rabble, seat: 0 }, { code: CODES.ambusher, seat: 1 }, { code: "f3", seat: 0 }] });
    // place 2, plus Orc Rabble 2 and Orc Ambusher 2; the Threat 3 of the non-Orc f3 does not count.
    expect(stagingThreat(done, made.cards)).toBe(6);
    expect(stagingCodes(done)).toEqual(["place"]);
  });
  lineSpec("06131:A:1", "an Orc in the staging area keeps counting its own Threat once, and it ends with the phase", (effects) => {
    const { made, done } = conflict(effects, { staging: [CODES.rabble], engaged: [{ code: CODES.ambusher, seat: 0 }], deck: ["f0", "f0", "f0", "f0", "f0"] });
    expect(stagingThreat(done, made.cards)).toBe(4);
    const next = drive(made, opened(made, { ...done, mode: "questCommit", window: { kind: "pass" }, phase: "Quest", boundaryPhase: "Quest" }), (st) => st.phase === "Encounter");
    expect(next.state.phase).toBe("Encounter");
    expect(stagingThreat(next.state, made.cards)).toBe(2);
  });
  lineSpec("06131:A:1", "gains surge when no Orc enemy is engaged with a player (a non-Orc one does not stop it)", (effects) => {
    const { done } = conflict(effects, { engaged: [{ code: "f3", seat: 0 }] });
    expect(stagingCodes(done)).toEqual(["place"]);
  });
  lineSpec("06131:A:2", "Shadow: the defending player takes 1 hidden card", (effects) => {
    const fight = fightEnemy(tableOf(effects), CODES.conflict, "f0", { seats: 2, stage: CODES.captured, engaged: [{ code: "f0", seat: 1 }], deck: [CODES.conflict, "f3", "f0", "f0"] }, { defender: (made) => made.seat1Hero ?? made.hero });
    expect(hiddenOf(fight.run.state, 1)).toHaveLength(1);
    expect(hiddenOf(fight.run.state, 0)).toEqual([]);
  });
});

