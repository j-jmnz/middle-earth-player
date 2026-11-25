// Rules: rm.hinder, rm.does-not-stack, rm.time-x, rr.forced, rr.the-word-choose, rr.effects, rr.attachment-cards, rr.setup, rr.search, rr.shadow-cards (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, committed, count, damageOn, defend, endRound, exhausted, flag, handCount, progressOn, quest, resourcesOn, reveal, resolve, stat, threat, travel, window, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Into Fangorn (the-ring-maker part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot show is in lines.test.ts (Hinder through the combat phase, Mugash leaving play, the two-player search, the stacking pick, the stage jumps, the refresh cap). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and
// 6 hit points; dh1 and dh2 are the first seat's, dh3 the second's.
const EDGE = "07032";
const DARK = "07033";
const ANGRY = "07034";
const DEADLY = "07035";
const FOREST = "07050";
const WOODS = "07051";
const TURNED = "07052";
const PROVISIONS = "07056";
const OFF_TRACK = "07057";
const STAGE_1 = "07065";
const STAGE_2 = "07066";
const STAGE_3 = "07067";
const MUGASH = "07031";


const ROWS: readonly Row[] = [


  // 07052 Turned Around.
  { line: "07052:A:1", name: "When Revealed: the first player chooses to return the active location to the staging area", layout: { stage: STAGE_1, timeCounters: 2, active: EDGE, deck: ["f0"] }, act: [reveal(TURNED), answer("location")], expect: [zone(EDGE, "staging"), resourcesOn(STAGE_1, 2)] },
  { line: "07052:A:1", name: "When Revealed: or a time counter comes off the current quest", layout: { stage: STAGE_1, timeCounters: 2, active: EDGE, deck: ["f0"] }, act: [reveal(TURNED), answer("time")], expect: [zone(EDGE, "activeLocation"), resourcesOn(STAGE_1, 1)] },
  { line: "07052:A:1", name: "When Revealed: with no active location only the time counter is left to choose", layout: { stage: STAGE_1, timeCounters: 2, deck: ["f0"] }, act: reveal(TURNED), expect: resourcesOn(STAGE_1, 1) },
  { line: "07052:A:2", name: "Shadow: an undefended attack returns the active location to the staging area", layout: { active: EDGE, engaged: ["f0"] }, act: attack("f0", { shadow: TURNED, undefended: true }), expect: zone(EDGE, "staging") },

  // 07056 Low on Provisions.
  { line: "07056:A:1", name: "When Revealed: the player assigns X damage among his characters, X their number", layout: { deck: ["f0"] }, act: [reveal(PROVISIONS), answer("dh1"), answer("dh1")], expect: [damageOn("dh1", 2), damageOn("dh2", 0)] },
  { line: "07056:A:2", name: "Shadow: the attacking enemy gets +2 Attack when the defending character is undamaged", layout: { engaged: ["f0"] }, act: [attack("f0", { shadow: PROVISIONS }), defend("dh1")], expect: damageOn("dh1", 1) },
  { line: "07056:A:2", name: "Shadow: it gets +1 Attack when the attack is undefended", layout: { engaged: ["f0"] }, act: attack("f0", { shadow: PROVISIONS, undefended: true }), expect: damageOn("dh1", 2) },

  // 07057 Off Track.
  { line: "07057:A:2", name: "When Revealed: the first player attaches it to the active location, which gets +2 quest points", layout: { active: EDGE, deck: ["f0"] }, act: reveal(OFF_TRACK), expect: [zone(OFF_TRACK, "attached"), stat(EDGE, "questPoints", 4)] },
  { line: "07057:A:2", name: "When Revealed: or to a location in the staging area", layout: { staging: [EDGE], deck: ["f0"] }, act: reveal(OFF_TRACK), expect: [zone(OFF_TRACK, "attached"), stat(EDGE, "questPoints", 4)] },

  // 07031 Mugash and 07032 Edge of Fangorn (Mugash leaving play is in lines.test.ts).
  { line: "07031:A:1", name: "Guarded: Mugash revealed from the encounter deck takes the next card as his guard and both lie in the staging area", layout: { deck: [DARK, "f0"] }, act: reveal(MUGASH), expect: [zone(MUGASH, "staging"), zone(DARK, "staging")] },
  { line: "07031:A:2", name: "Action: any player exhausts a ready hero to claim him when he is free of encounters, and he attaches to that hero", layout: { staging: [MUGASH] }, act: [resolve(MUGASH, "action"), answer("dh1")], expect: [exhausted("dh1"), exhausted("dh2", false), zone(MUGASH, "attached")] },
  { line: "07032:A:2", name: "Travel: the first player adds a Huorn from the encounter deck to the staging area and the travel completes", layout: { phase: "Travel", staging: [EDGE], deck: ["f0", DARK, "f0"] }, act: travel(EDGE), expect: zone(DARK, "staging") },

  // 07058 In Need of Rest.
  { line: "07058:A:1", name: "When Revealed: a hero committed to the quest leaves it and the card attaches to him", layout: { stage: STAGE_1, committed: ["dh1"], deck: ["f0"] }, act: reveal("07058"), expect: [committed("dh1", false), zone("07058", "attached")] },
  { line: "07058:A:1", name: "Forced: after a time counter comes off the current quest at the end of the refresh phase the attached hero takes 1 damage", layout: { stage: STAGE_1, timeCounters: 3, phase: "Combat", attached: [{ code: "07058", to: "dh1", encounter: true }] }, act: endRound, expect: [damageOn("dh1", 1), damageOn("dh2", 0)] },

  // 07065 Into the Woods, 07066 Escape from Fangorn and 07067 The Angry Forest.
  { line: "07065:A:1", name: "Setup: a solo player reveals no encounter card", layout: { stage: STAGE_1, side: "A", staging: [EDGE], setAside: [MUGASH], deck: ["place", "place"] }, act: resolve(STAGE_1, "setup"), expect: [count("place", "staging", 0), zone(MUGASH, "attached")] },
  { line: "07065:A:1", name: "Setup: with two players the players less one, 1, encounter card is revealed", layout: { seats: 2, stage: STAGE_1, side: "A", staging: [EDGE], setAside: [MUGASH], deck: ["place", "place"] }, act: resolve(STAGE_1, "setup"), expect: [count("place", "staging", 1), zone(MUGASH, "attached")] },
  { line: "07065:B:2", name: "Forced: after the last time counter Mugash lying in the staging area is shuffled into the encounter deck and the quest advances to stage 3", layout: { stage: STAGE_1, staging: [MUGASH], deck: ["f0"] }, act: announce("lastTimeCounterRemoved", STAGE_1), expect: [zone(MUGASH, "encounterDeck"), zone(STAGE_3, "questStage")] },
  { line: "07065:B:2", name: "Forced: Mugash on a hero is shuffled in from there", layout: { stage: STAGE_1, attached: [{ code: MUGASH, to: "dh1", encounter: true }], deck: ["f0"] }, act: announce("lastTimeCounterRemoved", STAGE_1), expect: [zone(MUGASH, "encounterDeck"), zone(STAGE_3, "questStage")] },
  { line: "07065:B:2", name: "Forced: Mugash in the encounter discard pile is shuffled in from there", layout: { stage: STAGE_1, discard: [MUGASH], deck: ["f0"] }, act: announce("lastTimeCounterRemoved", STAGE_1), expect: [zone(MUGASH, "encounterDeck"), zone(STAGE_3, "questStage")] },
  { line: "07067:B:1", name: "Time 3: the stage that is revealed holds 3 time counters", layout: { stage: STAGE_1, staging: [MUGASH], deck: ["f0"] }, act: announce("lastTimeCounterRemoved", STAGE_1), expect: resourcesOn(STAGE_3, 3) },
  { line: "07066:B:2", name: "Forced: after the last time counter Mugash is shuffled into the encounter deck and the quest advances to stage 3A", layout: { stage: STAGE_2, staging: [MUGASH], deck: ["f0"] }, act: announce("lastTimeCounterRemoved", STAGE_2), expect: [zone(MUGASH, "encounterDeck"), zone(STAGE_3, "questStage")] },
  { line: "07067:B:2", name: "Forced: 5 cards are discarded, each player chooses an enemy from the discard pile, reveals it and adds it to the staging area, and 3 counters go on the stage", layout: { stage: STAGE_3, deck: ["f0", "f0", "f0", "f0", "f0", "f0"], discard: [ANGRY] }, act: [announce("lastTimeCounterRemoved", STAGE_3), answer(ANGRY)], expect: [zone(ANGRY, "staging"), resourcesOn(STAGE_3, 3)] },
  { line: "07067:B:2", name: "Forced: Mugash chosen from the discard pile is revealed, and Guarded takes the next encounter card as his guard", layout: { stage: STAGE_3, deck: [MUGASH, "f0", "f0", "f0", "f0", DARK], discard: [ANGRY] }, act: [announce("lastTimeCounterRemoved", STAGE_3), answer(MUGASH)], expect: [zone(MUGASH, "staging"), zone(DARK, "staging"), resourcesOn(STAGE_3, 3)] },
];

if (ROWS.length > 0) cardSpecs("into-fangorn", ROWS);
else describe("into-fangorn card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
