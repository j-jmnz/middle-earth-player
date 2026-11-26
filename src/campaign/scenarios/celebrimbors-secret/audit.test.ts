// Rules: rm.scour, rm.the-orcs-search, rm.does-not-stack, rr.then, rr.forced, rr.in-play-and-out-of-play, rr.travel (data/rules/entries.json); ledger lines 08122:A:1, 08122:B:2, 08122:B:3, 08122:B:4, 08123:A:1, 08123:B:3, 08123:B:4, 08124:A:1, 08124:A:2,
// 08125:A:1, 08125:A:2, 08126:A:1, 08126:A:2, 08126:A:3, 08127:A:1, 08127:A:2, 08128:A:2, 08129:A:1, 08129:A:2, 08130:A:1, 08130:A:2, 08131:A:2, 08131:A:3, 08132:A:1, 08133:A:1, 08133:A:2, 08134:A:1, 08134:A:2, 08135:A:1, 08135:A:2, 08136:A:1, 08136:A:2.
// An audit of Celebrimbor's Secret (card-audit): each test is built from the printed words and the rule spans, on the smallest table of the scene kit. A line's test runs again without the line's records and must fail there (`lineSpec`).
// A Scour trigger is reached through the stage's last time counter (the refresh phase), a combat line through a real attack (`fightEnemy`), and a Mould held by a hero through the first player's claim in play.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { codesIn, drive, engagedCodes, fight, fightEnemy, finish, idOf, legalIntents, opened, resolveRecords, revealFromTop, send, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const SID = "celebrimbors-secret";
const BELLACH = "08124";
const SEARCH = "08125";
const CHAMBER = "08126";
const MOULD = "08127";
const SCOUT = "08128";
const PROWLING = "08129";
const PLAZA = "08130";
const TOWER = "08131";
const FOUNDATION = "08132";
const CITY = "08133";
const SKIRMISHER = "07038";
const HUNTER = "07039";
const HOUND = "07040";
// Derufin: an ally of cost 3 and 2 health.
const DERUFIN = "21006";

type Made = ReturnType<typeof tableFromLayout>;
const tableOf = (effects: readonly Effect[]) => (layout: Layout): Made => tableFromLayout(SID, layout, { effects, extra: [DERUFIN] });
const UNDER_TWO: Layout["under"] = [{ code: TOWER, to: SEARCH }, { code: PLAZA, to: SEARCH }];
const HOST_MOULD = (to: string) => ({ code: MOULD, to, encounter: true as const });

/** The window's option that the first code names (a card of that code, or the option id itself); the first option when none matches. */
const pick = (...keys: string[]) => (state: ScenarioState): string => {
  const options = state.window?.kind === "choose" ? state.window.options : [];
  for (const key of keys) {
    const hit = options.find((option) => option === key || state.cards[option]?.code === key);
    if (hit !== undefined) return hit;
  }
  return options[0] ?? "";
};

/** The options that the keys name, one key for each choice the effects open in turn (the last key again when the choices outnumber them). */
const inOrder = (...keys: string[]) => {
  let turn = 0;
  return (state: ScenarioState): string => {
    const key = keys[Math.min(turn, keys.length - 1)] ?? "";
    turn += 1;
    return pick(key)(state);
  };
};

/** The refresh phase of a table whose stage has one time counter left runs to its end: the last counter goes, and each Scour effect in play is triggered. */
function scourByTime(effects: readonly Effect[], layout: Layout, choose?: (state: ScenarioState) => string): { made: Made; state: ScenarioState } {
  const made = tableOf(effects)({ phase: "Refresh", stage: "08122", timeCounters: 1, ...layout });
  return { made, state: finish(opened(made, settle(made.state, made.ctx, [])), made.ctx, choose).state };
}
const damageOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? -1;
const activeCode = (state: ScenarioState): string | undefined => (state.activeLocation ? state.cards[state.activeLocation]?.code : undefined);
const hostCode = (state: ScenarioState, code: string): string | undefined => {
  const host = state.cards[idOf(state, code)]?.host;
  return host ? state.cards[host]?.code : undefined;
};
const stageCode = (state: ScenarioState): string | undefined => (state.questStage ? state.cards[state.questStage]?.code : undefined);
const hurt = (amount: number) => (state: ScenarioState, made: { hero: string }): ScenarioState => updateCard(state, made.hero, { damage: amount });
const heroDamage = (state: ScenarioState, ...codes: string[]): number => codes.reduce((sum, code) => sum + damageOn(state, code), 0);
/** The play from the quest phase to the Travel phase (the quest, and the first player's claim of a free Mould). */
const throughQuest = (made: Made, state: ScenarioState = made.state): ScenarioState => drive(made, opened(made, state), (st) => st.phase !== "Quest").state;
/** The card is revealed from the encounter deck by the first player and its choices answered. */
function revealed(made: Made, code: string, choose?: (state: ScenarioState) => string): ScenarioState {
  const steps: Parameters<typeof revealFromTop>[3] = [];
  return finish({ state: revealFromTop(made.state, made.ctx, code, steps).state, steps }, made.ctx, choose).state;
}
const attackOut = (state: ScenarioState): boolean => state.window?.kind !== "defense" && state.pendingAttack == null && state.window?.kind !== "choose";

describe("08122:A:1 Setup", () => {
  lineSpec("08122:A:1", "each player adds a different Ost-in-Edhil location to the staging area, and the Mould is attached to The Secret Chamber", (effects) => {
    const made = tableOf(effects)({ seats: 2, stage: "08122", side: "A", staging: [BELLACH, SEARCH, CHAMBER], setAside: [MOULD], deck: [PLAZA, PLAZA, TOWER, SKIRMISHER] });
    const done = resolveRecords(made.state, made.ctx, "08122", "setup", made.state.questStage ?? "", pick(PLAZA, TOWER), false);
    expect(codesIn(done.state, "staging")).toEqual([BELLACH, SEARCH, CHAMBER, PLAZA, TOWER].sort());
    expect(hostCode(done.state, MOULD)).toBe(CHAMBER);
    expect(done.state.cards[idOf(done.state, MOULD)]?.zone).toBe("attached");
  });
});

describe("08122:B:2 and 08123:B:2 the last time counter", () => {
  lineSpec("08122:B:2", "triggers each Scour effect in play (staging, engaged), not one in the discard pile, and places 3 counters; with 2 counters left it triggers nothing", (effects) => {
    const layout: Layout = { seats: 1, staging: [SCOUT], engaged: [SCOUT], discard: [SCOUT], active: PLAZA };
    const { state } = scourByTime(effects, layout);
    expect(damageOn(state, PLAZA)).toBe(2);
    expect(state.cards[state.questStage ?? ""]?.resources).toBe(3);
    const early = scourByTime(effects, { ...layout, timeCounters: 2 }).state;
    expect(damageOn(early, PLAZA)).toBe(0);
    expect(early.cards[early.questStage ?? ""]?.resources).toBe(1);
  });
  lineSpec("08122:B:2", "a Scour card that goes underneath The Orcs' Search before its turn does not resolve", (effects) => {
    // The Foundation resolves first: X is 2 (two locations), both damage go to the Tower, which then holds 4 of its 4 quest points and goes underneath.
    const { state } = scourByTime(effects, { seats: 1, staging: [FOUNDATION, SEARCH], active: { code: TOWER, damage: 2 } }, inOrder(FOUNDATION, TOWER));
    expect(zoneOf(state, TOWER)).toBe("under");
    expect(codesIn(state, "staging")).not.toContain(TOWER);
    expect(activeCode(state)).toBeUndefined();
    expect(damageOn(state, FOUNDATION)).toBe(0);
  });
});

describe("08124 Bellach", () => {
  lineSpec("08124:A:2", "each player, in player order, adds an Orc enemy from the deck or the discard pile to the staging area; a Creature named Orc Hound is no Orc", (effects) => {
    const { state } = scourByTime(effects, { seats: 2, staging: [BELLACH], deck: [HOUND, HUNTER, "f0"], discard: [SKIRMISHER] }, pick(HOUND, HUNTER, SKIRMISHER));
    expect(codesIn(state, "staging")).toEqual([BELLACH, HUNTER, SKIRMISHER].sort());
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).not.toContain(SKIRMISHER);
    expect(zoneOf(state, HOUND)).toBe("encounterDeck");
  });
  lineSpec("08124:A:2", "one player adds one Orc only, whatever the number of Orcs in the deck", (effects) => {
    const { state } = scourByTime(effects, { seats: 1, staging: [BELLACH], deck: [HUNTER, HUNTER, SKIRMISHER], discard: [SKIRMISHER] });
    expect(codesIn(state, "staging").filter((code) => code === HUNTER || code === SKIRMISHER)).toHaveLength(1);
  });
  lineSpec("08124:A:1", "X, the Threat in the staging area, is the number of cards underneath The Orcs' Search", (effects) => {
    const withTwo = tableOf(effects)({ seats: 1, staging: [BELLACH, SEARCH], under: UNDER_TWO });
    expect(stagingThreat(withTwo.state, withTwo.cards)).toBe(2);
    const withNone = tableOf(effects)({ seats: 1, staging: [BELLACH, SEARCH] });
    expect(stagingThreat(withNone.state, withNone.cards)).toBe(0);
  });
});

describe("08128 Bellach's Scout", () => {
  lineSpec("08128:A:2", "Scour places 1 damage on the active location, once for each Scout, and with no active location nothing is damaged", (effects) => {
    const { state } = scourByTime(effects, { seats: 1, staging: [SCOUT, SCOUT, CITY], active: PLAZA });
    expect(damageOn(state, PLAZA)).toBe(2);
    expect(damageOn(state, CITY)).toBe(0);
    const none = scourByTime(effects, { seats: 1, staging: [SCOUT, CITY] }).state;
    expect(damageOn(none, CITY)).toBe(0);
  });
});

describe("08129 Prowling Orc", () => {
  lineSpec("08129:A:2", "Scour engages the player with the highest threat and attacks that player at once", (effects) => {
    const second = scourByTime(effects, { seats: 2, threat: [30, 35], staging: [PROWLING], deck: ["f0", "f0"] }).state;
    expect(engagedCodes(second, 1)).toEqual([PROWLING]);
    expect(engagedCodes(second, 0)).toEqual([]);
    expect(second.window).toMatchObject({ kind: "defense", seat: 1 });
    const first = scourByTime(effects, { seats: 2, threat: [35, 30], staging: [PROWLING], deck: ["f0", "f0"] }).state;
    expect(engagedCodes(first, 0)).toEqual([PROWLING]);
    expect(first.window).toMatchObject({ kind: "defense", seat: 0 });
  });
  lineSpec("08129:A:1", "after each of its attacks, also the immediate one a Scour effect makes, 1 damage is placed on the active location", (effects) => {
    const normal = fightEnemy(tableOf(effects), "f0", PROWLING, { seats: 1, active: PLAZA }, { undefended: true });
    expect(damageOn(normal.run.state, PLAZA)).toBe(1);
    const { state } = scourByTime(effects, { seats: 1, staging: [PROWLING], active: PLAZA, deck: ["f0", "f0"] });
    expect(state.window).toMatchObject({ kind: "defense" });
    const made = tableOf(effects)({ seats: 1, staging: [PROWLING], active: PLAZA, deck: ["f0", "f0"], phase: "Refresh", stage: "08122", timeCounters: 1 });
    const open = finish(opened(made, settle(made.state, made.ctx, [])), made.ctx);
    const after = fight(made, open, attackOut);
    expect(damageOn(after.state, PLAZA)).toBe(1);
  });
});

describe("08131 Collapsed Tower", () => {
  lineSpec("08131:A:2", "Scour returns the Tower to the staging area and places 2 damage on it; with 2 damage already it holds its 4 quest points and goes underneath The Orcs' Search", (effects) => {
    const fromActive = scourByTime(effects, { seats: 1, staging: [TOWER, SEARCH], active: PLAZA }).state;
    expect(damageOn(fromActive, TOWER)).toBe(2);
    expect(zoneOf(fromActive, TOWER)).toBe("staging");
    const returned = scourByTime(effects, { seats: 1, staging: [SEARCH], active: TOWER }).state;
    expect(zoneOf(returned, TOWER)).toBe("staging");
    expect(damageOn(returned, TOWER)).toBe(2);
    expect(activeCode(returned)).toBeUndefined();
    const buried = scourByTime(effects, { seats: 1, staging: [SEARCH, { code: TOWER, damage: 2 }] }).state;
    expect(zoneOf(buried, TOWER)).toBe("under");
  });
  lineSpec("08131:A:3", "Shadow: the excess damage of the attack is placed on the active location, none when there is no excess", (effects) => {
    const excess = fightEnemy(tableOf(effects), TOWER, SKIRMISHER, { seats: 1, active: PLAZA }, { defender: (made) => made.hero2, tweak: (state, made) => updateCard(state, made.hero2, { damage: 5 }) });
    // Skirmisher attacks 4 against defense 2: 2 damage on a hero with 5 of 6 hit points, so 1 is excess.
    expect(damageOn(excess.run.state, PLAZA)).toBe(1);
    const none = fightEnemy(tableOf(effects), TOWER, SKIRMISHER, { seats: 1, active: PLAZA }, { defender: (made) => made.hero2 });
    expect(damageOn(none.run.state, PLAZA)).toBe(0);
  });
});

describe("08132 Ancient Foundation", () => {
  lineSpec("08132:A:1", "Scour assigns X damage, X the number of locations in play, and two copies do not stack", (effects) => {
    // Locations in play: two Foundations, the Plaza, and the active City Remains: X is 4, and it is assigned once.
    const two = scourByTime(effects, { seats: 1, staging: [FOUNDATION, FOUNDATION, PLAZA], active: CITY }, pick(CITY)).state;
    expect(damageOn(two, CITY)).toBe(4);
    expect(heroDamage(two, PLAZA, FOUNDATION)).toBe(0);
    const alone = scourByTime(effects, { seats: 1, staging: [FOUNDATION] }, pick(FOUNDATION)).state;
    expect(damageOn(alone, FOUNDATION)).toBe(1);
  });
});

describe("08133 City Remains", () => {
  lineSpec("08133:A:1", "after progress is placed on it, the topmost Scour effect in the discard pile triggers and the card stays in the discard pile; with none, nothing happens", (effects) => {
    const play = (discard: readonly string[]): ScenarioState => {
      const made = tableOf(effects)({ seats: 1, phase: "Quest", active: CITY, discard, deck: ["f0", "f0", "f0", "f0"] });
      return finish(drive(made, send(opened(made), { type: "Commit", cardIds: [made.hero] }, made.ctx), (st) => st.phase !== "Quest"), made.ctx).state;
    };
    // The top of the discard pile is the last card: the Scout is topmost, and below it lie a card with no Scour and the Tower.
    const withScour = play([TOWER, SKIRMISHER, SCOUT]);
    expect(state_progress(withScour, CITY)).toBe(2);
    expect(damageOn(withScour, CITY)).toBe(1);
    expect(zoneOf(withScour, SCOUT)).toBe("encounterDiscard");
    expect(zoneOf(withScour, TOWER)).toBe("encounterDiscard");
    const withNone = play([SKIRMISHER]);
    expect(state_progress(withNone, CITY)).toBe(2);
    expect(damageOn(withNone, CITY)).toBe(0);
  });
  lineSpec("08133:A:2", "Shadow: the attacker gets +1 Attack, and when the attack destroys a character each player's threat rises by the cards underneath The Orcs' Search", (effects) => {
    const layout: Layout = { seats: 2, staging: [SEARCH], under: UNDER_TWO };
    const survived = fightEnemy(tableOf(effects), CITY, SKIRMISHER, layout, { undefended: true });
    // 4 + 1 damage on a hero of 6 hit points.
    expect(damageOn(survived.run.state, "dh1")).toBe(5);
    expect(survived.run.state.seats.map((seat) => seat.threat)).toEqual([28, 28]);
    const destroyed = fightEnemy(tableOf(effects), CITY, SKIRMISHER, layout, { undefended: true, tweak: hurt(1) });
    expect(zoneOf(destroyed.run.state, "dh1")).toBe("discard");
    expect(destroyed.run.state.seats.map((seat) => seat.threat)).toEqual([30, 30]);
  });
});

function state_progress(state: ScenarioState, code: string): number {
  return state.cards[idOf(state, code)]?.progress ?? -1;
}

describe("08125 The Orcs' Search", () => {
  lineSpec("08125:A:1", "a location with damage equal to or above its quest points goes underneath, its tokens and attachments discarded; one below them stays", (effects) => {
    // City Remains has 3 quest points: 2 damage and the Scout's 1 make 3, equal to them.
    const full: Layout = { seats: 1, staging: [SEARCH, SCOUT], active: { code: CITY, damage: 2, progress: 1 }, attached: [{ code: "attachment", to: CITY, encounter: true }] };
    const { state } = scourByTime(effects, full);
    expect(zoneOf(state, CITY)).toBe("under");
    expect(damageOn(state, CITY)).toBe(0);
    expect(state_progress(state, CITY)).toBe(0);
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).toContain("attachment");
    const above = scourByTime(effects, { seats: 1, staging: [SEARCH, SCOUT], active: { code: PLAZA, damage: 2 } }).state;
    expect(zoneOf(above, PLAZA)).toBe("under");
    const below = scourByTime(effects, { seats: 1, staging: [SEARCH, SCOUT], active: { code: CITY, damage: 1 } }).state;
    expect(zoneOf(below, CITY)).toBe("activeLocation");
    expect(damageOn(below, CITY)).toBe(2);
  });
  lineSpec("08125:A:2", "at the end of the refresh phase each player's threat rises by 1 for each card underneath", (effects) => {
    const made = tableOf(effects)({ seats: 2, phase: "Refresh", stage: "08122", timeCounters: 2, staging: [SEARCH], under: UNDER_TWO });
    const done = finish(opened(made, settle(made.state, made.ctx, [])), made.ctx).state;
    // Each player's threat rises by 1 in the refresh phase itself, and by 2 more for the two cards underneath.
    expect(done.seats.map((seat) => seat.threat)).toEqual([31, 31]);
    const none = tableOf(effects)({ seats: 2, phase: "Refresh", stage: "08122", timeCounters: 2, staging: [SEARCH] });
    const same = finish(opened(none, settle(none.state, none.ctx, [])), none.ctx).state;
    expect(same.seats.map((seat) => seat.threat)).toEqual([29, 29]);
  });
});

describe("08126 The Secret Chamber", () => {
  lineSpec("08126:A:1", "X, its Threat, is the number of players", (effects) => {
    const two = tableOf(effects)({ seats: 2, staging: [CHAMBER] });
    expect(stagingThreat(two.state, two.cards)).toBe(2);
    const one = tableOf(effects)({ seats: 1, staging: [CHAMBER] });
    expect(stagingThreat(one.state, one.cards)).toBe(1);
  });
  lineSpec("08126:A:2", "Travel: 3 progress come off the quest, and the travel is refused while the quest holds less than 3", (effects) => {
    const poor = tableOf(effects)({ seats: 1, phase: "Travel", progress: 2, staging: [CHAMBER] });
    expect(legalIntents(opened(poor).state, poor.ctx).map((intent) => intent.type)).not.toContain("Travel");
    const rich = tableOf(effects)({ seats: 1, phase: "Travel", progress: 3, staging: [CHAMBER] });
    const run = opened(rich);
    expect(legalIntents(run.state, rich.ctx).map((intent) => intent.type)).toContain("Travel");
    const traveled = send(run, { type: "Travel", locationId: idOf(run.state, CHAMBER) }, rich.ctx);
    expect(activeCode(traveled.state)).toBe(CHAMBER);
    expect(state_progress(traveled.state, "08122")).toBe(0);
  });
  lineSpec("08126:A:3", "if it goes underneath The Orcs' Search the players lose; one damage short they do not", (effects) => {
    const lost = scourByTime(effects, { seats: 1, staging: [SEARCH, SCOUT], active: { code: CHAMBER, damage: 5 } }).state;
    expect(lost.lost).toBe(true);
    const safe = scourByTime(effects, { seats: 1, staging: [SEARCH, SCOUT], active: { code: CHAMBER, damage: 4 } }).state;
    expect(safe.lost).toBe(false);
    expect(zoneOf(safe, CHAMBER)).toBe("activeLocation");
  });
});

describe("08127 Celebrimbor's Mould", () => {
  lineSpec("08127:A:1", "free of encounters, the first player claims it and attaches it to a hero he controls; held by The Secret Chamber it is not claimed", (effects) => {
    const free = tableOf(effects)({ seats: 2, firstPlayer: 1, phase: "Quest", staging: [MOULD] });
    const claimed = throughQuest(free);
    const mould = claimed.cards[idOf(claimed, MOULD)];
    expect(mould?.host).toBe(free.seat1Hero);
    expect(mould?.controller).toBe(1);
    const held = tableOf(effects)({ seats: 2, firstPlayer: 1, phase: "Quest", staging: [CHAMBER], attached: [HOST_MOULD(CHAMBER)] });
    const stays = throughQuest(held);
    expect(hostCode(stays, MOULD)).toBe(CHAMBER);
  });
  lineSpec("08127:A:2", "if the attached hero leaves play the players lose; another hero leaving play does not lose", (effects) => {
    const holder = fightEnemy(tableOf(effects), "07038", PROWLING, { seats: 1, attached: [{ code: MOULD, to: "dh1" }] }, { undefended: true });
    expect(zoneOf(holder.run.state, "dh1")).toBe("discard");
    expect(holder.run.state.lost).toBe(true);
    const other = fightEnemy(tableOf(effects), "07038", PROWLING, { seats: 1, attached: [{ code: MOULD, to: "dh2" }] }, { undefended: true });
    expect(zoneOf(other.run.state, "dh1")).toBe("discard");
    expect(other.run.state.lost).toBe(false);
  });
});

describe("08123 The Enemy's Servant", () => {
  const stage2: Layout = { seats: 1, stage: "08123", side: "A", phase: "Quest", deck: ["f0", "f0", "f0"] };
  lineSpec("08123:A:1", "triggers each Scour effect, Bellach attacks the player who controls the Mould, then the Mould is attached to Bellach", (effects) => {
    const made = tableOf(effects)({ ...stage2, staging: [BELLACH, MOULD, SCOUT], active: PLAZA });
    const held = throughQuest(made);
    expect(hostCode(held, MOULD)).toBe("dh1");
    const begun = resolveRecords(held, made.ctx, "08123", "whenRevealed", made.state.questStage ?? "", undefined, false);
    expect(begun.state.window).toMatchObject({ kind: "defense" });
    const done = fight(made, begun, attackOut).state;
    expect(damageOn(done, PLAZA)).toBe(1);
    expect(damageOn(done, "dh1")).toBe(5);
    expect(hostCode(done, MOULD)).toBe(BELLACH);
  });
  lineSpec("08123:A:1", "with no hero holding the Mould there is no attack and the Mould stays where it is", (effects) => {
    const made = tableOf(effects)({ ...stage2, staging: [BELLACH, CHAMBER, SCOUT], active: PLAZA, attached: [HOST_MOULD(CHAMBER)] });
    const begun = resolveRecords(made.state, made.ctx, "08123", "whenRevealed", made.state.questStage ?? "", undefined, false);
    expect(damageOn(begun.state, PLAZA)).toBe(1);
    expect(begun.state.window?.kind).not.toBe("defense");
    expect(hostCode(begun.state, MOULD)).toBe(CHAMBER);
  });
  lineSpec("08123:B:3", "Bellach is immune and cannot be engaged until the stage holds 12 progress", (effects) => {
    const at = (progress: number): { made: Made; state: ScenarioState } => {
      const made = tableOf(effects)({ seats: 1, stage: "08123", progress, phase: "Encounter", threat: [50, 0], staging: [BELLACH], attached: [HOST_MOULD(BELLACH)] });
      return { made, state: opened(made).state };
    };
    const short = at(11);
    expect(flagged(short.state, idOf(short.state, BELLACH), "immuneToPlayerCards")).toBe(true);
    expect(legalIntents(short.state, short.made.ctx).map((intent) => intent.type)).not.toContain("Engage");
    const full = at(12);
    expect(flagged(full.state, idOf(full.state, BELLACH), "immuneToPlayerCards")).toBe(false);
    expect(legalIntents(full.state, full.made.ctx).map((intent) => intent.type)).toContain("Engage");
  });
  lineSpec("08123:B:4", "the players cannot win unless the Mould is on a hero, and win the moment it is", (effects) => {
    const blocked = tableOf(effects)({ seats: 1, stage: "08123", progress: 10, phase: "Quest", staging: [CHAMBER], attached: [HOST_MOULD(CHAMBER)] });
    const stuck = send(opened(blocked), { type: "Commit", cardIds: [blocked.hero, blocked.hero2] }, blocked.ctx);
    const still = drive(blocked, stuck, (st) => st.phase === "Travel" || st.stageCleared === true).state;
    expect(still.stageCleared).not.toBe(true);
    expect(state_progress(still, "08123")).toBe(13);
    const free = tableOf(effects)({ seats: 1, stage: "08123", progress: 10, phase: "Quest", staging: [MOULD] });
    const sent = send(opened(free), { type: "Commit", cardIds: [free.hero, free.hero2] }, free.ctx);
    const won = drive(free, sent, (st) => st.phase === "Travel" || st.stageCleared === true).state;
    expect(won.stageCleared).toBe(true);
  });
});

describe("08122 The Ruins of Ost-in-Edhil", () => {
  lineSpec("08122:B:3", "Bellach is immune and cannot be engaged, whatever the progress", (effects) => {
    const made = tableOf(effects)({ seats: 1, stage: "08122", progress: 12, phase: "Encounter", threat: [50, 0], staging: [BELLACH] });
    const state = opened(made).state;
    expect(flagged(state, idOf(state, BELLACH), "immuneToPlayerCards")).toBe(true);
    expect(legalIntents(state, made.ctx).map((intent) => intent.type)).not.toContain("Engage");
  });
  lineSpec("08122:B:4", "the stage holds its progress while the Mould is not on a hero, and advances the moment a hero holds it", (effects) => {
    const blocked = tableOf(effects)({ seats: 1, stage: "08122", progress: 12, phase: "Quest", staging: [CHAMBER], attached: [HOST_MOULD(CHAMBER)] });
    const stuck = send(opened(blocked), { type: "Commit", cardIds: [blocked.hero, blocked.hero2] }, blocked.ctx);
    const still = drive(blocked, stuck, (st) => st.phase === "Travel" || st.phase === "Encounter").state;
    expect(stageCode(still)).toBe("08122");
    expect(state_progress(still, "08122")).toBe(15);
    const free = tableOf(effects)({ seats: 1, stage: "08122", progress: 12, phase: "Quest", staging: [MOULD] });
    const sent = send(opened(free), { type: "Commit", cardIds: [free.hero, free.hero2] }, free.ctx);
    const next = drive(free, sent, (st) => st.phase === "Travel" || st.phase === "Encounter").state;
    expect(stageCode(next)).toBe("08123");
  });
});

describe("08130 Ruined Plaza", () => {
  lineSpec("08130:A:1", "Forced: after it enters the staging area 1 damage is placed on it", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Quest", staging: [SEARCH], deck: ["f0", "f0"] });
    const state = revealed({ ...made, state: made.state }, PLAZA);
    expect(zoneOf(state, PLAZA)).toBe("staging");
    expect(damageOn(state, PLAZA)).toBe(1);
  });
  lineSpec("08130:A:2", "Shadow: the defending player assigns X damage among his characters, X the cards underneath The Orcs' Search", (effects) => {
    const withTwo = fightEnemy(tableOf(effects), PLAZA, SKIRMISHER, { seats: 1, staging: [SEARCH], under: UNDER_TWO }, { defender: (made) => made.hero });
    // 4 attack against defense 2 is 2 damage, and X adds 2 more.
    expect(heroDamage(withTwo.run.state, "dh1", "dh2")).toBe(4);
    const withNone = fightEnemy(tableOf(effects), PLAZA, SKIRMISHER, { seats: 1, staging: [SEARCH] }, { defender: (made) => made.hero });
    expect(heroDamage(withNone.run.state, "dh1", "dh2")).toBe(2);
  });
});

describe("08134 Discovered!", () => {
  lineSpec("08134:A:1", "either each player places a random card of his hand underneath The Orcs' Search, or each Scour effect is triggered", (effects) => {
    const hand = tableOf(effects)({ seats: 2, phase: "Quest", staging: [SEARCH], hand: ["filler"], deck: ["f0"] });
    const placed = revealed(hand, "08134", pick("hand"));
    expect(codesIn(placed, "under")).toEqual(["filler", "filler"]);
    expect(placed.seats.map((seat) => seat.hand.length)).toEqual([0, 0]);
    const scour = tableOf(effects)({ seats: 1, phase: "Quest", staging: [SCOUT], active: PLAZA, hand: ["filler"], deck: ["f0"] });
    const scoured = revealed(scour, "08134", pick("scour"));
    expect(damageOn(scoured, PLAZA)).toBe(1);
    expect(codesIn(scoured, "under")).toEqual([]);
  });
  lineSpec("08134:A:2", "Shadow: a character the attack destroys goes underneath The Orcs' Search, not to the discard pile", (effects) => {
    const destroyed = fightEnemy(tableOf(effects), "08134", SKIRMISHER, { seats: 1, staging: [SEARCH] }, { undefended: true, tweak: hurt(2) });
    expect(zoneOf(destroyed.run.state, "dh1")).toBe("under");
    const alive = fightEnemy(tableOf(effects), "08134", SKIRMISHER, { seats: 1, staging: [SEARCH] }, { defender: (made) => made.hero });
    expect(zoneOf(alive.run.state, "dh1")).toBe("heroes");
    expect(codesIn(alive.run.state, "under")).toEqual([]);
  });
});

describe("08135 Desecrated Ruins", () => {
  lineSpec("08135:A:1", "When Revealed: 3 damage on the active location, and surge only when there is no active location", (effects) => {
    // The Plaza has 2 quest points, so the damage sends it underneath The Orcs' Search; the surge was decided before the damage.
    const active = tableOf(effects)({ seats: 1, phase: "Quest", staging: [SEARCH], active: PLAZA, deck: ["f0", "f0", "f0"] });
    const hit = revealed(active, "08135");
    expect(zoneOf(hit, PLAZA)).toBe("under");
    expect(codesIn(hit, "staging")).not.toContain("f0");
    const bare = tableOf(effects)({ seats: 1, phase: "Quest", staging: [TOWER], deck: ["f0", "f0", "f0"] });
    const surged = revealed(bare, "08135");
    expect(codesIn(surged, "staging")).toContain("f0");
    expect(damageOn(surged, TOWER)).toBe(0);
  });
  lineSpec("08135:A:2", "Shadow: when the attack destroys an ally, damage equal to the ally's cost is placed on the active location; a destroyed hero places none", (effects) => {
    const layout: Layout = { seats: 1, play: [DERUFIN], active: CITY };
    const ally = fightEnemy(tableOf(effects), "08135", SKIRMISHER, layout, { defender: (made) => idOf(made.state, DERUFIN) });
    expect(zoneOf(ally.run.state, DERUFIN)).toBe("discard");
    expect(damageOn(ally.run.state, CITY)).toBe(3);
    const hero = fightEnemy(tableOf(effects), "08135", SKIRMISHER, layout, { defender: (made) => made.hero, tweak: hurt(3) });
    expect(zoneOf(hero.run.state, "dh1")).toBe("discard");
    expect(damageOn(hero.run.state, CITY)).toBe(0);
  });
});

describe("08136 Spies from Mordor", () => {
  lineSpec("08136:A:1", "each player exhausts X characters, X the cards underneath The Orcs' Search, and with none exhausted it gains surge", (effects) => {
    const two = tableOf(effects)({ seats: 2, phase: "Quest", staging: [SEARCH], under: UNDER_TWO, deck: ["f0", "f0"] });
    const done = revealed(two, "08136");
    const exhausted = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.exhausted && card.zone === "heroes").map((card) => card.code).sort();
    expect(exhausted(done)).toEqual(["dh1", "dh2", "dh3"]);
    expect(codesIn(done, "staging")).not.toContain("f0");
    const none = tableOf(effects)({ seats: 1, phase: "Quest", staging: [SEARCH], deck: ["f0", "f0"] });
    const surged = revealed(none, "08136");
    expect(exhausted(surged)).toEqual([]);
    expect(codesIn(surged, "staging")).toContain("f0");
    const spent = tableOf(effects)({ seats: 1, phase: "Quest", staging: [SEARCH], under: UNDER_TWO, deck: ["f0", "f0"], exhaustedCards: ["dh1", "dh2"] });
    expect(codesIn(revealed(spent, "08136"), "staging")).toContain("f0");
  });
  lineSpec("08136:A:2", "Shadow: the defending player discards a non-objective attachment he controls; an objective stays", (effects) => {
    const plain = fightEnemy(tableOf(effects), "08136", SKIRMISHER, { seats: 1, attached: [{ code: "attachment", to: "dh1" }] }, { undefended: true });
    expect(zoneOf(plain.run.state, "attachment")).toBe("discard");
    const objective = fightEnemy(tableOf(effects), "08136", SKIRMISHER, { seats: 1, attached: [{ code: MOULD, to: "dh1" }] }, { undefended: true });
    expect(hostCode(objective.run.state, MOULD)).toBe("dh1");
  });
});
