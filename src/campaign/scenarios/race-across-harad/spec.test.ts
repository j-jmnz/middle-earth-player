// Rules: hrd.immune-to-player-card-effects, hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage, hrd.stage-number, rr.player-elimination, ltp.undefended-attack, rr.travel, rr.cannot, rr.forced, rr.shadow-effects, rr.attachment-cards, rr.surge, rr.engaged, rr.lasting-effects (data/rules/entries.json).
// Line tests for Race Across Harad (haradrim part 5), each titled with its ledger line and run again without the line's records, which must fail (test/harness/line-spec.ts). This file holds the Tamed Mûmak 17038:A:2 and 17038:A:3, River Harnen 17039:A:2, 17039:A:3 and 17039:A:4,
// the encounter cards 17040:A:1 to 17046:A:2 and the Setup of stage 1 (17047:A:1, 17047:B:1). The Orcs' stages and the stages of the players (17048 to 17054) are in orcs-lines.test.ts.
import { expect } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { expireModifiers, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fight, fightEnemy, idOf, idsOf, legalTargets, opened, resolveRecords, revealedTop, run as runInstruction, type FightOptions, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { currentSideQuest } from "../../../rules/families/wilderland/night-quest.ts";
import { withStagingThreat } from "../../../rules/families/attachments/hold.ts";
import { restricted, travelBlocked } from "../../../rules/interpret/restrictions.ts";
import { undefendedMumak } from "../../../rules/families/haradrim/mumak.ts";
import { CHIEFTAIN, MUMAK, ORCS_STAGES, prepared, raceTable, record, sideQuestCurrent, URUK } from "../../../rules/families/haradrim/race-kit.ts";

const HARNEN = "17039";

/** The Setup record of stage 1A resolves, as the deal does, with the four Tamed Mûmakil and the Orcs' stages set aside. */
const setupLayout: Layout = { stage: "17047", setAside: [MUMAK, MUMAK, MUMAK, MUMAK, ...ORCS_STAGES, CHIEFTAIN] };

/** The table at the defense window of the Uruk's attack on seat 0, a Tamed Mûmak in play with `damage` on it. */
function attacked(effects: readonly Effect[], damage = 0) {
  const made = raceTable({ setAside: [], phase: "Combat", engaged: [URUK], play: [{ code: MUMAK, damage }] }, effects);
  const arrived = fight(made, opened(made, opened(made).state), (state) => state.window?.kind === "defense");
  return { made, run: arrived, state: arrived.state };
}

lineSpec("17038:A:2", "an undefended attack against the controller puts all its damage on the Tamed Mûmak, past its hit points, and on no hero", (effects) => {
  const { made, run, state } = attacked(effects, 6);
  const mumak = idOf(state, MUMAK);
  expect(legalTargets(state, { type: "Undefended" }, made.ctx)).toEqual([mumak]);
  const done = fight(made, run, (current) => current.pendingAttack == null || current.lost === true, { heroCode: MUMAK });
  // 6 damage and the Uruk's 4 Attack: 10 on 8 hit points, so it is destroyed and the excess goes to no hero.
  expect(done.state.cards[mumak]?.zone).not.toBe("play");
  expect(done.state.cards[idOf(state, "dh1")]?.damage).toBe(0);
});

lineSpec("17038:A:2", "a defended attack is not redirected, and only the controller's undefended attacks are", (effects) => {
  const { made, run, state } = attacked(effects);
  const mumak = idOf(state, MUMAK);
  expect(undefendedMumak(state)).toEqual([mumak]);
  const defended = fight(made, run, (current) => current.pendingAttack == null, { defender: "dh1" });
  expect(defended.state.cards[mumak]?.damage).toBe(0);
  expect(defended.state.cards[idOf(state, "dh1")]?.damage).toBeGreaterThan(0);
  const two = raceTable({ seats: 2, setAside: [], engaged: [URUK], play: [{ code: MUMAK, seat: 1 }] }, effects);
  const start = opened(two).state;
  expect(undefendedMumak({ ...start, pendingAttack: { enemyId: idOf(start, URUK), seat: 0 } })).toEqual([]);
  expect(undefendedMumak({ ...start, pendingAttack: { enemyId: idOf(start, URUK), seat: 1 } })).toEqual([idOf(start, MUMAK)]);
});

lineSpec("17038:A:3", "a Tamed Mûmak that leaves play eliminates its controller, and the other player goes on", (effects) => {
  const made = raceTable({ seats: 2, setAside: [], play: [{ code: MUMAK, seat: 0 }, { code: MUMAK, seat: 1 }] }, effects);
  const state = opened(made).state;
  const first = (state.seats[0]?.play ?? []).find((id) => state.cards[id]?.code === MUMAK) ?? "";
  const done = runInstruction(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: first });
  expect(done.seats[0]?.eliminated).toBeTruthy();
  expect(done.seats[1]?.eliminated).toBeFalsy();
  expect(done.lost).toBeFalsy();
});

// "Travel" and the stage for River Harnen: the stage is the main quest card, 4B, so a side quest that is the current quest changes neither the gate nor the bar.
lineSpec("17039:A:2", "the players cannot travel to River Harnen unless stage 4B holds 20 progress, another location is open", (effects) => {
  const at = (progress: number) => {
    const made = raceTable({ stage: "17050", setAside: [], staging: [HARNEN, "17040"], progress }, effects);
    return { made, state: opened(made).state };
  };
  const low = at(19);
  expect(travelBlocked(low.state, low.made.ctx, idOf(low.state, HARNEN))).toBe(true);
  expect(travelBlocked(low.state, low.made.ctx, idOf(low.state, "17040"))).toBe(false);
  const full = at(20);
  expect(travelBlocked(full.state, full.made.ctx, idOf(full.state, HARNEN))).toBe(false);
});

lineSpec("17039:A:2", "a side quest that is the current quest does not change the gate: 4B with 19 progress still holds it back", (effects) => {
  const made = raceTable({ stage: "17050", setAside: [], staging: [HARNEN, "10160"], progress: 19 }, effects, ["10160"]);
  const state = opened(made).state;
  const side = idOf(state, "10160");
  const current = sideQuestCurrent({ ...state, cards: { ...state.cards, [side]: { ...state.cards[side]!, progress: 25 } } }, side);
  expect(currentSideQuest(current)).toBe(side);
  expect(travelBlocked(current, made.ctx, idOf(state, HARNEN))).toBe(true);
});

lineSpec("17039:A:3", "Travel: one encounter card is revealed for each player, one after the other", (effects) => {
  const two = raceTable({ seats: 2, stage: "17050", setAside: [], staging: [HARNEN], progress: 20, deck: ["16065", "16065", "16065"] }, effects);
  expect(record(two, opened(two).state, "17039:travel:1", idOf(two.state, HARNEN), "travel").encounterDeck).toHaveLength(1);
  const solo = raceTable({ stage: "17050", setAside: [], staging: [HARNEN], progress: 20, deck: ["16065", "16065", "16065"] }, effects);
  expect(record(solo, opened(solo).state, "17039:travel:1", idOf(solo.state, HARNEN), "travel").encounterDeck).toHaveLength(2);
});

lineSpec("17039:A:4", "stage 4B cannot be defeated while River Harnen is in play: in the staging area or as the active location, a full stage included", (effects) => {
  const barred = (layout: Layout): boolean => {
    const made = raceTable({ stage: "17050", setAside: [], progress: 20, ...layout }, effects);
    const state = opened(made).state;
    return restricted(state, made.ctx, "advance").some((rule) => state.cards[rule.sourceId]?.code === HARNEN);
  };
  expect(barred({ staging: [HARNEN] })).toBe(true);
  expect(barred({ active: HARNEN })).toBe(true);
  expect(barred({})).toBe(false);
});

lineSpec("17039:A:4", "a side quest that is the current quest does not lift the bar: it holds on the main quest card while River Harnen is in play", (effects) => {
  const made = raceTable({ stage: "17050", setAside: [], progress: 20, staging: [HARNEN, "10160"] }, effects, ["10160"]);
  const state = opened(made).state;
  const side = idOf(state, "10160");
  const current = sideQuestCurrent(state, side);
  expect(currentSideQuest(current)).toBe(side);
  expect(restricted(current, made.ctx, "advance").some((rule) => current.cards[rule.sourceId]?.code === HARNEN)).toBe(true);
});

lineSpec("17040:A:1", "Expanse of Harad gets +2 Threat while the players are at another stage than the Orcs, its printed Threat at the same stage", (effects) => {
  const threatOf = (stage: string): number => {
    const { made, state } = prepared({ stage, staging: ["17040"] }, effects);
    const synced = opened(made, state).state;
    return modifiedStat(synced, synced.cards[idOf(synced, "17040")]!, "threat", made.cards);
  };
  expect(threatOf("17048")).toBe(2 + 2);
  expect(threatOf("17047")).toBe(2);
});

lineSpec("17040:A:2", "Forced: after Expanse of Harad becomes the active location each player raises their threat by 2", (effects) => {
  const made = raceTable({ seats: 2, staging: ["17040"] }, effects);
  const state = opened(made).state;
  const done = record(made, state, "17040:forced:1", idOf(state, "17040"));
  expect((done.seats[0]?.threat ?? 0) - (state.seats[0]?.threat ?? 0)).toBe(2);
  expect((done.seats[1]?.threat ?? 0) - (state.seats[1]?.threat ?? 0)).toBe(2);
});

/** The damage the heroes of a seat hold after a Blistering Erg's Forced effect assigned `X` among them, each point to the first hero offered. */
const ergDamage = (effects: readonly Effect[], stage: string, seats: 1 | 2): number[] => {
  const made = raceTable({ seats, stage, staging: ["17041"] }, effects);
  const state = opened(made).state;
  const done = resolveRecords(state, made.ctx, "17041", "forced", idOf(state, "17041")).state;
  return [0, 1].slice(0, seats).map((seat) => (done.seats[seat]?.heroes ?? []).reduce((sum, id) => sum + (done.cards[id]?.damage ?? 0), 0));
};

lineSpec("17041:A:1", "X is the stage number of the main quest: at stage 3B each player assigns 3 damage", (effects) => {
  expect(ergDamage(effects, "17049", 1)).toEqual([3]);
});

lineSpec("17041:A:2", "each player assigns the damage among the characters they control: both seats take X", (effects) => {
  expect(ergDamage(effects, "17048", 2)).toEqual([2, 2]);
});

lineSpec("17042:A:1", "Harad Road goes into the Orcs' area when revealed: in the area zone at another stage, in the staging area at the same stage", (effects) => {
  const apart = prepared({ staging: ["17042"] }, effects);
  const road = idOf(apart.state, "17042");
  const done = record(apart.made, apart.state, "17042:whenRevealed:1", road, "whenRevealed");
  expect(done.cards[road]?.zone).toBe("orcsArea");
  expect(done.orcs?.members).toContain(road);
  const same = prepared({ stage: "17047", staging: ["17042"] }, effects);
  const there = record(same.made, same.state, "17042:whenRevealed:1", idOf(same.state, "17042"), "whenRevealed");
  expect(there.orcs?.members).toContain(idOf(there, "17042"));
  expect(there.cards[idOf(there, "17042")]?.zone).toBe("staging");
});

// The shadow cards in an attack on seat 0 (shadows.test.ts has the family tests): the Uruk attacks with the card dealt as its shadow.
const withArea = (state: ScenarioState, made: LayoutTable): ScenarioState => runInstruction(made, opened(made, state).state, { verb: "PrepareOrcsArea", stages: ORCS_STAGES, number: 1, place: [CHIEFTAIN] });
const attackWith = (effects: readonly Effect[], shadow: string, layout: Layout, options: FightOptions<LayoutTable> = {}) => fightEnemy((one: Layout) => raceTable({ setAside: [...ORCS_STAGES, CHIEFTAIN], ...one }, effects), shadow, URUK, layout, { tweak: withArea, ...options });

lineSpec("17042:A:2", "Shadow: at another stage the attacking enemy moves to the Orcs' area after the attack, at the same stage it stays engaged", (effects) => {
  const apart = attackWith(effects, "17042", { stage: "17048" });
  const uruk = idOf(apart.run.state, URUK);
  expect(apart.run.state.cards[uruk]?.zone).toBe("orcsArea");
  expect(apart.run.state.seats[0]?.engaged ?? []).not.toContain(uruk);
  const same = attackWith(effects, "17042", { stage: "17047" });
  expect(same.run.state.cards[idOf(same.run.state, URUK)]?.zone).toBe("engaged");
});

lineSpec("17043:A:1", "Uruk Pursuer goes into the Orcs' area when revealed and gains surge only while the players are at another stage", (effects) => {
  // Revealed on top of a deck of two cards: surge reveals the next card at once.
  const revealed = (stage: string) => {
    const { made, state } = prepared({ stage, deck: ["16065", "16065"] }, effects);
    const done = revealedTop({ state, ctx: made.ctx }, "17043");
    const pursuer = idOf(done, "17043");
    return { member: done.orcs?.members.includes(pursuer), zone: done.cards[pursuer]?.zone, left: done.encounterDeck.length };
  };
  expect(revealed("17048")).toEqual({ member: true, zone: "orcsArea", left: 1 });
  expect(revealed("17047")).toEqual({ member: true, zone: "staging", left: 2 });
});

lineSpec("17043:A:2", "Shadow: at another stage Uruk Pursuer comes into play engaged with the defending player, at the same stage it does not", (effects) => {
  const apart = attackWith(effects, "17043", { stage: "17048" });
  expect(apart.run.state.cards[idOf(apart.run.state, "17043")]).toMatchObject({ zone: "engaged", controller: 0 });
  const same = attackWith(effects, "17043", { stage: "17047" });
  expect(same.run.state.cards[idOf(same.run.state, "17043")]?.zone).not.toBe("engaged");
});

// "Attach to an Orc enemy": a host the first player chooses among the Orcs in play, the Orcs' area included. The Chieftain is out of play so the Uruk is the only Orc, and the Warg's host is read where it stands.
const warg = (effects: readonly Effect[], layout: Layout, move: boolean, code = "17044", id = "17044:whenRevealed:1") => {
  const set = prepared({ staging: [code, URUK], ...layout }, effects);
  const chieftain = idOf(set.state, CHIEFTAIN);
  const state = { ...set.state, cards: { ...set.state.cards, [chieftain]: { ...set.state.cards[chieftain]!, zone: "discard" as const } } };
  const uruk = idOf(state, URUK);
  const placed = move ? runInstruction(set.made, state, { verb: "MoveToOrcsArea" }, { sourceId: uruk }) : state;
  const card = idOf(placed, code);
  return { done: record(set.made, placed, id, card, "whenRevealed"), card, uruk };
};

lineSpec("17044:A:2", "Racing Warg attaches to an Orc enemy in the Orcs' area at another stage, and the Orc stays in the area", (effects) => {
  const { done, card, uruk } = warg(effects, { stage: "17048" }, true);
  expect(done.cards[card]?.host).toBe(uruk);
  expect(done.cards[uruk]?.zone).toBe("orcsArea");
  expect(done.orcs?.members).toContain(uruk);
});

lineSpec("17044:A:2", "Racing Warg attaches to an Orc enemy in the staging area and stays attached; with no Orc enemy in play it is discarded", (effects) => {
  const { done, card, uruk } = warg(effects, { stage: "17048" }, false);
  expect(done.cards[card]?.host).toBe(uruk);
  expect(done.cards[card]?.zone).not.toBe("encounterDiscard");
  const none = raceTable({ staging: ["17044"], setAside: [] }, effects);
  const bare = opened(none).state;
  const alone = record(none, bare, "17044:whenRevealed:1", idOf(bare, "17044"), "whenRevealed");
  expect(alone.cards[idOf(alone, "17044")]?.zone).toBe("encounterDiscard");
});

// Reading 10 of the scenario file: Mordor Warg (The Long Arm of Mordor's record 16064:A:1) may attach to an Orc in the Orcs' area, and its return to the staging area does nothing for a card there.
lineSpec("16064:A:1", "Mordor Warg attaches to an Orc enemy in the Orcs' area at another stage and the Orc stays in the area", (effects) => {
  const { done, card, uruk } = warg(effects, { stage: "17048" }, true, "16064", "16064:whenRevealed:1");
  expect(done.cards[card]?.host).toBe(uruk);
  expect(done.cards[uruk]?.zone).toBe("orcsArea");
  expect(done.orcs?.members).toContain(uruk);
});

lineSpec("17044:A:2", "an attached Racing Warg gives its host +1 Threat, Attack, Defense and hit point only while the host is an enemy", (effects) => {
  const made = raceTable({ setAside: [], engaged: [URUK], attached: [{ code: "17044", to: URUK }] }, effects);
  const state = opened(made).state;
  const uruk = state.cards[idOf(state, URUK)]!;
  const printed = made.cards.get(URUK)!;
  expect(modifiedStat(state, uruk, "attack", made.cards)).toBe((printed.attack ?? 0) + 1);
  expect(modifiedStat(state, uruk, "threat", made.cards)).toBe((printed.threat ?? 0) + 1);
  expect(modifiedStat(state, uruk, "defense", made.cards)).toBe((printed.defense ?? 0) + 1);
  expect(modifiedStat(state, uruk, "hitPoints", made.cards)).toBe((printed.health ?? 0) + 1);
  const hero = raceTable({ setAside: [], attached: [{ code: "17044", to: "dh1" }] }, effects);
  const bare = opened(hero).state;
  const before = made.cards.get("dh1");
  expect(modifiedStat(bare, bare.cards[idOf(bare, "dh1")]!, "attack", hero.cards)).toBe(before?.attack ?? hero.cards.get("dh1")?.attack ?? 2);
});

lineSpec("17045:A:2", "When Revealed: the Orc enemy discarded from the top goes into the Orcs' area and a Creature above it is only discarded", (effects) => {
  const { made, state } = prepared({ deck: ["16051", "17044", URUK, "16051"] }, effects);
  const done = record(made, state, "17045:whenRevealed:1", idOf(state, "17047"));
  expect(idsOf(done, URUK).map((id) => done.cards[id]?.zone)).toEqual(["orcsArea"]);
  expect(done.orcs?.members).toContain(idOf(done, URUK));
  expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toEqual(["16051", "17044"]);
});

lineSpec("17045:A:3", "Shadow: the attacker gets +1 Attack, and a hero the attack destroys puts 2 progress on the Orcs' stage", (effects) => {
  const plain = attackWith(effects, "17045", { stage: "17049" });
  expect(modifiedStat(plain.during, plain.during.cards[idOf(plain.during, URUK)]!, "attack", plain.made.cards)).toBe(4 + 1);
  expect(plain.run.state.cards[plain.run.state.orcs?.stage ?? ""]?.progress).toBe(0);
  const hurt = (state: ScenarioState, made: LayoutTable): ScenarioState => {
    const set = withArea(state, made);
    return { ...set, cards: { ...set.cards, [made.hero]: { ...set.cards[made.hero]!, damage: 5 } } };
  };
  const destroyed = attackWith(effects, "17045", { stage: "17049" }, { tweak: hurt });
  expect(destroyed.run.state.cards[destroyed.made.hero]?.zone).toBe("discard");
  expect(destroyed.run.state.cards[destroyed.run.state.orcs?.stage ?? ""]?.progress).toBe(2);
});

lineSpec("17046:A:1", "When Revealed: at another stage the Orcs' area Threat joins the staging total, read live, until the end of the phase", (effects) => {
  const { made, state } = prepared({ staging: ["17040"], engaged: [URUK] }, effects);
  expect(withStagingThreat(state, 2, made.cards)).toBe(2);
  const done = record(made, state, "17046:whenRevealed:1", idOf(state, "17040"), "whenRevealed");
  // The Chieftain's Threat of 4 is in the area; the engaged Uruk is not.
  expect(withStagingThreat(done, 2, made.cards)).toBe(2 + 4);
  const joined = spawn(done, "17042", { zone: "staging" });
  const road = runInstruction(made, joined.state, { verb: "MoveToOrcsArea" }, { sourceId: joined.id });
  expect(withStagingThreat(road, 2, made.cards)).toBe(2 + 4 + 5);
  expect(withStagingThreat(expireModifiers(road, ["endOfPhase"]), 2, made.cards)).toBe(2 + 0);
});

lineSpec("17046:A:1", "When Revealed: at the same stage each enemy gets +1 Threat until the end of the phase, one that enters later too", (effects) => {
  const { made, state } = prepared({ stage: "17047", engaged: [URUK], staging: ["17040"] }, effects);
  const uruk = idOf(state, URUK);
  const before = modifiedStat(state, state.cards[uruk]!, "threat", made.cards);
  const done = record(made, state, "17046:whenRevealed:1", idOf(state, "17040"), "whenRevealed");
  expect(modifiedStat(done, done.cards[uruk]!, "threat", made.cards)).toBe(before + 1);
  const later = spawn(done, URUK, { zone: "staging" });
  expect(modifiedStat(later.state, later.state.cards[later.id]!, "threat", made.cards)).toBe(before + 1);
  const over = expireModifiers(later.state, ["endOfPhase"]);
  expect(modifiedStat(over, over.cards[uruk]!, "threat", made.cards)).toBe(before);
});

lineSpec("17046:A:2", "Shadow: the defending player raises their threat by 1", (effects) => {
  const fought = attackWith(effects, "17046", { stage: "17048" });
  expect((fought.run.state.seats[0]?.threat ?? 0) - (fought.start.seats[0]?.threat ?? 0)).toBe(1);
});

lineSpec("17047:A:1", "Setup: each player takes a Tamed Mûmak, the others leave the game, and the Orcs' area is prepared with the Chieftain in it", (effects) => {
  const made = raceTable(setupLayout, effects);
  const state = resolveRecords(made.state, made.ctx, "17047", "setup", idOf(made.state, "17047")).state;
  expect(idsOf(state, MUMAK).map((id) => state.cards[id]?.zone).sort()).toEqual(["play", "removed", "removed", "removed"]);
  expect(state.orcs?.members).toContain(idOf(state, CHIEFTAIN));
  expect(state.orcs?.number).toBe(1);
  const two = raceTable({ ...setupLayout, seats: 2 }, effects);
  const both = resolveRecords(two.state, two.ctx, "17047", "setup", idOf(two.state, "17047")).state;
  expect([0, 1].map((seat) => (both.seats[seat]?.play ?? []).filter((id) => both.cards[id]?.code === MUMAK).length)).toEqual([1, 1]);
});

lineSpec("17047:B:1", "each player in turn adds a location of a different title to the staging area, the deck is shuffled and the quest advances to 2A", (effects) => {
  const made = raceTable({ seats: 2, stage: "17047", deck: ["17040", "17040", "17041", "17042"], setAside: [] }, effects);
  const state = opened(made).state;
  const done = resolveRecords(state, made.ctx, "17047", "whenRevealed", idOf(state, "17047")).state;
  const staged = done.staging.map((id) => done.cards[id]?.code).sort();
  expect(staged).toHaveLength(2);
  expect(new Set(staged).size).toBe(2);
  expect(done.cards[done.questStage ?? ""]?.code).toBe("17048");
});
