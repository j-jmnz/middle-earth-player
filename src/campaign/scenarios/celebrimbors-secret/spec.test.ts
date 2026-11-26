// Rules: rm.scour, rm.time-x, rm.the-orcs-search, rr.forced, rr.immune, rr.travel, rr.shadow-effects, rr.active-location, rr.surge, rr.the-letter-x (data/rules/entries.json).
import { describe, it } from "vitest";

import { answer, attack, cardSpecs, damageOn, deckCount, defend, endRound, exhausted, flag, progressOn, resolve, reveal, resourcesOn, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

const STAGE_1 = "08122";
const STAGE_2 = "08123";
const BELLACH = "08124";
const ORCS = "08125";
const CHAMBER = "08126";
const SCOUT = "08128";
const ORC = "08129";
const PLAZA = "08130";
const FOUNDATION = "08132";
const CITY = "08133";
const RUINS = "08135";
const SPIES = "08136";
// Two cards lie facedown underneath The Orcs' Search: X is 2.
const TWO_UNDER = [{ code: "08131", to: ORCS }, { code: PLAZA, to: ORCS }] as const;

// Card specs for Celebrimbor's Secret (the-ring-maker part 8): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot show is in src/rules/families/ring-maker/ (scour.test.ts, orcs-search.test.ts, mould.test.ts: the Scour trigger, The Orcs' Search, the Mould and the stages that wait for it) and in cards.test.ts of this folder.
const ROWS: readonly Row[] = [
  // 08122 The Ruins of Ost-in-Edhil.
  { line: "08122:B:1", name: "Time 3: a time counter comes off the stage in the refresh phase", layout: { stage: STAGE_1, timeCounters: 3, phase: "Combat" }, act: endRound, expect: resourcesOn(STAGE_1, 2) },
  { line: "08122:B:3", name: "Bellach is immune to player card effects and cannot be engaged", layout: { stage: STAGE_1, staging: [BELLACH] }, act: [], expect: [flag(BELLACH, "immuneToPlayerCards"), flag(BELLACH, "cannotBeEngaged")] },

  // 08123 The Enemy's Servant.
  { line: "08123:B:1", name: "Time 3: a time counter comes off the stage in the refresh phase", layout: { stage: STAGE_2, timeCounters: 3, phase: "Combat" }, act: endRound, expect: resourcesOn(STAGE_2, 2) },
  { line: "08123:B:2", name: "Forced: after the last time counter is removed each Scour effect in play is triggered and 3 counters are placed on the stage", layout: { stage: STAGE_2, timeCounters: 1, phase: "Combat", staging: [SCOUT], active: CITY }, act: endRound, expect: [resourcesOn(STAGE_2, 3), damageOn(CITY, 1)] },

  // 08126 The Secret Chamber.
  { line: "08126:A:1", name: "X is the number of players: its Threat is 2 with two players", layout: { seats: 2, staging: [CHAMBER] }, act: [], expect: stat(CHAMBER, "threat", 2) },
  { line: "08126:A:2", name: "Travel: remove 3 progress from the current quest to travel here", layout: { stage: STAGE_1, progress: 5, phase: "Travel", staging: [CHAMBER] }, act: travel(CHAMBER), expect: progressOn(STAGE_1, 2) },

  // 08125 The Orcs' Search.
  { line: "08125:A:2", name: "Forced: at the end of the refresh phase each player raises his threat by 1 for each card underneath it (2 here)", layout: { staging: [ORCS], under: TWO_UNDER, threat: [20, 20], phase: "Combat" }, act: endRound, expect: threat(23) },

  // 08128 Bellach's Scout.
  { line: "08128:A:1", name: "When Revealed: the first player places 3 damage on the active location", layout: { active: CITY }, act: [resolve(SCOUT, "whenRevealed"), answer("damage")], expect: damageOn(CITY, 3) },
  { line: "08128:A:1", name: "Or reveals an additional encounter card", layout: { active: CITY, deck: ["f0", "f0", "f0"] }, act: [resolve(SCOUT, "whenRevealed"), answer("reveal")], expect: [damageOn(CITY, 0), deckCount(2)] },
  { line: "08128:A:2", name: "Scour: place 1 damage on the active location", layout: { stage: STAGE_1, staging: [SCOUT], active: CITY }, act: resolve(STAGE_1, "forced"), expect: damageOn(CITY, 1) },
  { line: "08128:A:3", name: "Shadow: place 1 damage on the active location", layout: { active: CITY, engaged: ["f0"] }, act: attack("f0", { shadow: SCOUT, undefended: true }), expect: damageOn(CITY, 1) },

  // 08129 Prowling Orc.
  { line: "08129:A:1", name: "Forced: after Prowling Orc attacks, place 1 damage on the active location", layout: { active: CITY, engaged: [ORC] }, act: attack(ORC, { undefended: true }), expect: damageOn(CITY, 1) },

  // 08130 Ruined Plaza.
  { line: "08130:A:2", name: "Shadow: the defending player assigns X damage among characters he controls, X the cards underneath The Orcs' Search (2 here, and the attack's 1)", layout: { staging: [ORCS], under: TWO_UNDER, engaged: ["f0"] }, act: attack("f0", { shadow: PLAZA, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "08130:A:1", name: "Forced: after it enters the staging area (revealed) place 1 damage on it", layout: { deck: ["f0"] }, act: reveal(PLAZA), expect: damageOn(PLAZA, 1) },

  // 08132 Ancient Foundation.
  { line: "08132:A:2", name: "Travel: place 1 damage on this location to travel here", layout: { phase: "Travel", staging: [FOUNDATION] }, act: travel(FOUNDATION), expect: damageOn(FOUNDATION, 1) },

  // 08133 City Remains.
  { line: "08133:A:2", name: "Shadow: if the attack destroys a character, each player raises his threat by 1 for each card underneath The Orcs' Search", layout: { staging: [ORCS], under: TWO_UNDER, engaged: [BELLACH], play: ["ally"], threat: [20, 20] }, act: [attack(BELLACH, { shadow: CITY }), defend("ally")], expect: threat(22) },

  // 08135 Desecrated Ruins.
  { line: "08135:A:1", name: "When Revealed: place 3 damage on the active location", layout: { active: CITY, deck: ["f0"] }, act: resolve(RUINS, "whenRevealed"), expect: [damageOn(CITY, 3), deckCount(1)] },
  { line: "08135:A:1", name: "The surge is read before the damage: a location the 3 damage sends underneath The Orcs' Search gives no surge", layout: { staging: [ORCS], active: PLAZA, deck: ["f0", "f0"] }, act: reveal(RUINS), expect: [zone(PLAZA, "under"), deckCount(2)] },
  { line: "08135:A:1", name: "With no active location it gains surge: the next encounter card is revealed", layout: { deck: ["f0", "f0"] }, act: reveal(RUINS), expect: deckCount(1) },
  { line: "08135:A:2", name: "Shadow: if the attack destroys an ally, place X damage on the active location, X that ally's cost", layout: { active: CITY, engaged: [BELLACH], play: ["ally"] }, act: [attack(BELLACH, { shadow: RUINS }), defend("ally")], expect: damageOn(CITY, 1) },

  // 08136 Spies from Mordor.
  { line: "08136:A:1", name: "When Revealed: each player exhausts X characters he controls (X is 1: the one ready ally)", layout: { staging: [ORCS], under: [TWO_UNDER[0]], play: ["ally"], exhaustedCards: ["dh1", "dh2"], deck: ["f0", "f0"] }, act: resolve(SPIES, "whenRevealed"), expect: [exhausted("ally"), deckCount(2)] },
  { line: "08136:A:1", name: "With no character exhausted this way (X is 0) it gains surge", layout: { staging: [ORCS], play: ["ally"], exhaustedCards: ["dh1", "dh2"], deck: ["f0", "f0"] }, act: reveal(SPIES), expect: [exhausted("ally", false), deckCount(1)] },
  { line: "08136:A:2", name: "Shadow: the defending player discards a non-objective attachment he controls", layout: { engaged: ["f0"], attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: SPIES, undefended: true }), expect: zone("attachment", "discard") },
];

if (ROWS.length > 0) cardSpecs("celebrimbors-secret", ROWS);
else describe("celebrimbors-secret card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
