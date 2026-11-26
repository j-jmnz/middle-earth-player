// Rules: rm.time-x, rr.forced, rr.shadow-effects, rr.travel, rr.setup, rr.lasting-effects, rr.active-location, rr.surge (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, endRound, flag, progressOn, resolve, resourcesOn, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

const NALIR = "08068";
const BELLACH = "08070";
const CROSSING = "08071";
const SPY = "08072";
const MARAUDER = "08073";
const HIDEOUT = "08075";
const RUINS = "08076";

// Card specs for Trouble in Tharbad (the-ring-maker part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot show is in src/campaign/scenarios/trouble-in-tharbad/stages.test.ts and trouble-in-tharbad/cards.test.ts (the stages, Nalir, the later-entering enemies, surge, Bellach, The Crossing).
const ROWS: readonly Row[] = [
  // 08066 Double Dealings.
  { line: "08066:A:1", name: "Setup: the first player takes control of Nalir, as an ally", layout: { stage: "08066", setAside: [NALIR] }, act: resolve("08066", "setup"), expect: zone(NALIR, "play") },
  { line: "08066:B:1", name: "Time 4: a time counter comes off the stage in the refresh phase", layout: { stage: "08066", timeCounters: 4, phase: "Combat" }, act: endRound, expect: resourcesOn("08066", 3) },

  // 08067 Escape from Tharbad.
  { line: "08067:A:1", name: "When Revealed: Bellach and The Crossing join the staging area and the Orc enemies discarded from the deck follow", layout: { stage: "08067", side: "A", setAside: [BELLACH, CROSSING], deck: ["f0", SPY, "f0"] }, act: resolve("08067", "whenRevealed"), expect: [zone(BELLACH, "staging"), zone(CROSSING, "staging"), zone(SPY, "staging")] },
  { line: "08067:B:1", name: "Time 3: a time counter comes off the stage in the refresh phase", layout: { stage: "08067", timeCounters: 3, phase: "Combat" }, act: endRound, expect: resourcesOn("08067", 2) },
  { line: "08067:B:4", name: "Forced: After a character leaves play, raise its controller's threat by 2", layout: { stage: "08067", play: ["ally"], threat: [20, 20] }, act: announce("leftPlay", "ally", { seat: 0 }), expect: threat(22) },

  // 08068 Nalir (08068:A:1 is a titled test in src/campaign/scenarios/trouble-in-tharbad/cards.test.ts).
  { line: "08068:A:2", name: "Forced: At the beginning of the refresh phase, raise your threat by 1 for each player in the game (2 here, and 1 more for the refresh phase itself)", layout: { seats: 2, play: [NALIR], threat: [20, 20], phase: "Refresh" }, act: announce("beginningOfPhase"), expect: threat(23) },

  // 08070 Bellach.
  { line: "08070:A:1", name: "X is the number of players in the game: his Threat is 2 with two players", layout: { stage: "08067", seats: 2, staging: [BELLACH] }, act: [], expect: stat(BELLACH, "threat", 2) },
  { line: "08070:A:2", name: "Orc and Creature enemies get -30 engagement cost and +1 Threat", layout: { stage: "08067", staging: [BELLACH, SPY] }, act: [], expect: [stat(SPY, "engagementCost", 10), stat(SPY, "threat", 3)] },

  // 08072 Spy from Mordor.
  { line: "08072:A:1", name: "Forced: When Spy From Mordor attacks, remove 1 time counter from the current quest", layout: { stage: "08066", timeCounters: 3, engaged: [SPY], deck: ["f0", "f0"] }, act: attack(SPY, { undefended: true }), expect: resourcesOn("08066", 2) },

  // 08073 Bellach's Marauder.
  { line: "08073:A:1", name: "Engaged, it is dealt 2 shadow cards after a time counter is removed from the current quest", layout: { stage: "08066", timeCounters: 3, engaged: [MARAUDER], deck: ["f0", "f0", "f0", "f0"] }, act: announce("timeCounterRemoved"), expect: deckCount(2) },
  { line: "08073:A:2", name: "Shadow: Remove 1 time counter from the current quest", layout: { stage: "08066", timeCounters: 3, engaged: ["f0"], deck: ["f0", "f0"] }, act: attack("f0", { shadow: MARAUDER, undefended: true }), expect: resourcesOn("08066", 2) },

  // 08074 Streets of Tharbad.
  { line: "08074:A:1", name: "Progress cannot be placed on it while it is in the staging area", layout: { stage: "08066", staging: ["08074"] }, act: [], expect: flag("08074", "noProgressPlaced") },
  { line: "08074:A:2", name: "While it is the active location, enemies get -20 engagement cost", layout: { stage: "08066", active: "08074", staging: [SPY] }, act: [], expect: stat(SPY, "engagementCost", 20) },

  // 08075 Tharbad Hideout.
  { line: "08075:A:3", name: "Forced: At the beginning of the quest phase, place 1 progress on it", layout: { stage: "08066", staging: [HIDEOUT], phase: "Quest" }, act: announce("beginningOfPhase"), expect: progressOn(HIDEOUT, 1) },

  // 08076 Ruins of the Second Age.
  { line: "08076:A:1", name: "In the staging area, City locations get +1 Threat", layout: { stage: "08066", staging: [RUINS, "08074"] }, act: [], expect: [stat("08074", "threat", 4), stat(RUINS, "threat", 2)] },
  { line: "08076:A:2", name: "As the active location, each engaged enemy is dealt 1 additional shadow card at the beginning of the combat phase", layout: { stage: "08066", active: RUINS, engaged: [SPY], deck: ["f0", "f0", "f0"], phase: "Combat" }, act: announce("beginningOfPhase"), expect: deckCount(2) },

  // 08077 Seedy Inn.
  { line: "08077:A:2", name: "Shadow: raise the defending player's threat by the damage this attack dealt", layout: { stage: "08066", engaged: ["f0"], threat: [20, 20] }, act: attack("f0", { shadow: "08077", undefended: true }), expect: threat(21) },

  // 08078 Hidden Alleyway.
  { line: "08078:A:1", name: "Travel: each player raises his threat by the number of enemies in play", layout: { stage: "08066", phase: "Travel", staging: ["08078", SPY, SPY], threat: [20, 20] }, act: travel("08078"), expect: threat(22) },
  { line: "08078:A:2", name: "Forced: After traveling here, add 1 time counter to the current quest", layout: { stage: "08066", phase: "Travel", staging: ["08078"], timeCounters: 3 }, act: travel("08078"), expect: resourcesOn("08066", 3) },

  // 08079 Decrepit Rooftops.
  { line: "08079:A:1", name: "While active, enemies get +1 Threat", layout: { stage: "08066", active: "08079", staging: [SPY] }, act: [], expect: stat(SPY, "threat", 3) },
  { line: "08079:A:2", name: "Forced: After traveling here, return all engaged enemies to the staging area", layout: { stage: "08066", phase: "Travel", staging: ["08079"], engaged: [SPY] }, act: travel("08079"), expect: zone(SPY, "staging") },

  // 08080 Constant Tail.
  { line: "08080:A:1", name: "Return all engaged enemies to the staging area; then the first player removes a time counter", layout: { stage: "08066", timeCounters: 3, engaged: [SPY] }, act: [resolve("08080", "whenRevealed"), answer("time")], expect: [zone(SPY, "staging"), resourcesOn("08066", 2)] },

  // 08081 Conspicuous Lot.
  { line: "08081:A:2", name: "Shadow: attacking enemy gets +1 Attack (+2 when the defending player's threat is 20 or less)", layout: { stage: "08066", engaged: ["f0"], threat: [30, 30] }, act: attack("f0", { shadow: "08081", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "08081:A:2", name: "Shadow: +2 Attack when the defending player's threat is 20 or less", layout: { stage: "08066", engaged: ["f0"], threat: [20, 20] }, act: attack("f0", { shadow: "08081", undefended: true }), expect: damageOn("dh1", 3) },

  // 08082 Cornered.
  { line: "08082:A:1", name: "The first player removes a time counter from the current quest", layout: { stage: "08066", timeCounters: 3 }, act: [resolve("08082", "whenRevealed"), answer("time")], expect: resourcesOn("08066", 2) },
  { line: "08082:A:1", name: "Or each enemy gets -20 engagement cost and +1 Attack until the end of the round", layout: { stage: "08066", timeCounters: 3, staging: [SPY] }, act: [resolve("08082", "whenRevealed"), answer("enemies")], expect: [stat(SPY, "engagementCost", 20), stat(SPY, "attack", 4)] },
  { line: "08082:A:2", name: "Shadow: attacking enemy gets +1 Attack (+2 when the defending player's threat is 20 or less)", layout: { stage: "08066", engaged: ["f0"], threat: [20, 20] }, act: attack("f0", { shadow: "08082", undefended: true }), expect: damageOn("dh1", 3) },

  // 08083 Get That Dwarf!
  { line: "08083:A:2", name: "Shadow: if this attack is undefended, deal 2 damage to Nalir", layout: { stage: "08066", play: [NALIR], engaged: ["f0"] }, act: attack("f0", { shadow: "08083", undefended: true }), expect: damageOn(NALIR, 2) },
];

if (ROWS.length > 0) cardSpecs("trouble-in-tharbad", ROWS);
else describe("trouble-in-tharbad card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
