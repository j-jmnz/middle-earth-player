// Rules: rm.time-x, rr.forced, rr.engaged, rr.drawing-cards, rr.travel, rr.shadow-effects, rr.setup, rr.active-location, rr.refresh-phase (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, count, damageOn, deckCount, drew, endRound, flag, handCount, resourcesOn, resolve, stat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Dunland Trap (the-ring-maker part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot show is in stages.test.ts (Time X by seats, Hills of Dunland acting once, Chief Turch, the last counter of stage 3B, the cases a row would pass without its record). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and
// 6 hit points; the filler enemy has 1 Attack.
const STAGE_1 = "08011";
const ROAD = "08016";
const RAVINE = "08015";
const FOOTHILLS = "08019";
const HILLS = "08020";
const TRIBESMAN = "07046";
const STALKER = "08017";
const WARRIOR = "08018";
const DRAWS = announce("cardsDrawn");
// A constant record holds from the moment the table is built: the action only gives the row a step to read.
const NOTHING = announce("endOfRound");

const ROWS: readonly Row[] = [
  // 08011 The Road to Tharbad.
  { line: "08011:A:1", name: "Setup: each player searches the encounter deck for a Boar Clan enemy and puts it into play engaged with him", layout: { seats: 2, stage: STAGE_1, side: "A", deck: [WARRIOR, "f0", STALKER, "f0"] }, act: resolve(STAGE_1, "setup"), expect: [count(WARRIOR, "engaged", 1), count(STALKER, "engaged", 1)] },
  { line: "08011:A:1", name: "Setup: the printed line says no \"different\", so the second player can take a second Boar Clan Warrior", layout: { seats: 2, stage: STAGE_1, side: "A", deck: [WARRIOR, "f0", WARRIOR, "f0"] }, act: resolve(STAGE_1, "setup"), expect: [count(WARRIOR, "engaged", 2)] },
  { line: "08011:A:1", name: "Setup: a solo player searches for one", layout: { stage: STAGE_1, side: "A", deck: [WARRIOR, "f0", STALKER, "f0"] }, act: resolve(STAGE_1, "setup"), expect: [count(WARRIOR, "engaged", 1), count(STALKER, "engaged", 0)] },

  // 08012 A Well Laid Trap (the Forced effect of the end of the combat phase and side A are in stages.test.ts).
  { line: "08012:B:1", name: "When Revealed: each player searches for a Boar Clan enemy and puts it into play engaged, shuffles his discard pile into his deck and draws 1", layout: { seats: 2, stage: "08012", active: ROAD, setAside: [RAVINE], deck: [WARRIOR, "f0", STALKER, "f0"], deckOf: [{ code: "filler", seat: 0 }, { code: "filler", seat: 1 }] }, act: resolve("08012", "whenRevealed"), expect: [count(WARRIOR, "engaged", 1), count(STALKER, "engaged", 1), handCount(1), handCount(1, 1)] },

  // 08015 Munuv Dûv Ravine.
  { line: "08015:A:1", name: "Dunland enemies in the staging area and engaged get +1 Attack and +1 Defense while the Ravine is the active location", layout: { active: RAVINE, staging: [TRIBESMAN], engaged: [STALKER] }, act: NOTHING, expect: [stat(TRIBESMAN, "attack", 5), stat(TRIBESMAN, "defense", 3), stat(STALKER, "attack", 1), stat(STALKER, "defense", 1)] },
  { line: "08015:A:1", name: "They get it while the Ravine is back in the staging area", layout: { staging: [RAVINE, TRIBESMAN] }, act: NOTHING, expect: [stat(TRIBESMAN, "attack", 5), stat(TRIBESMAN, "defense", 3)] },

  // 08016 Old South Road.
  { line: "08016:A:1", name: "Forced: at the end of the refresh phase a time counter comes off the current quest as well as the stage's own one", layout: { stage: STAGE_1, timeCounters: 3, phase: "Combat", active: ROAD }, act: endRound, expect: resourcesOn(STAGE_1, 1) },
  { line: "08016:A:1", name: "Forced: every counter that comes off is heard, so In Need of Rest hurts its hero for the road's counter as well as the stage's own", layout: { stage: STAGE_1, timeCounters: 4, phase: "Combat", active: ROAD, attached: [{ code: "07058", to: "dh1", encounter: true }] }, act: endRound, expect: [damageOn("dh1", 2), resourcesOn(STAGE_1, 2)] },
  { line: "08016:A:1", name: "Forced: it does the same back in the staging area", layout: { stage: STAGE_1, timeCounters: 3, phase: "Combat", staging: [ROAD] }, act: endRound, expect: resourcesOn(STAGE_1, 1) },

  // 08017 Boar Clan Stalker and 08018 Boar Clan Warrior.
  { line: "08017:A:1", name: "+1 Attack and +1 Defense for each resource token on it", layout: { engaged: [{ code: STALKER, seat: 0, resources: 2 }] }, act: NOTHING, expect: [stat(STALKER, "attack", 2), stat(STALKER, "defense", 2)] },
  { line: "08017:A:1", name: "The bonus stops at +4", layout: { engaged: [{ code: STALKER, seat: 0, resources: 6 }] }, act: NOTHING, expect: [stat(STALKER, "attack", 4), stat(STALKER, "defense", 4)] },
  { line: "08018:A:1", name: "Forced: after the engaged player draws it is dealt a shadow card, which stays on it", layout: { engaged: [WARRIOR], deck: ["f0", "f0", "f0"] }, act: DRAWS, expect: deckCount(2) },
  { line: "08018:A:2", name: "Shadow: the attacker gets +1 Attack for each shadow card on it", layout: { engaged: ["f0"] }, act: attack("f0", { shadow: WARRIOR, undefended: true }), expect: damageOn("dh1", 2) },

  // 08019 Hithaeglir Foothills.
  { line: "08019:A:2", name: "Its Threat is the number of resource tokens on it", layout: { staging: [{ code: FOOTHILLS, resources: 3 }] }, act: NOTHING, expect: stat(FOOTHILLS, "threat", 3) },
  { line: "08019:A:3", name: "Forced: after a player draws it gets a resource token, in the staging area", layout: { staging: [FOOTHILLS] }, act: DRAWS, expect: resourcesOn(FOOTHILLS, 1) },
  { line: "08019:A:3", name: "Forced: and as the active location", layout: { active: FOOTHILLS }, act: DRAWS, expect: resourcesOn(FOOTHILLS, 1) },

  // 08020 Hills of Dunland.
  { line: "08020:A:1", name: "Forced: after a player draws, the top of the encounter deck is discarded and a Dunland enemy goes into play engaged with him", layout: { staging: [HILLS], deck: [TRIBESMAN, "f0"] }, act: DRAWS, expect: zone(TRIBESMAN, "engaged") },
  { line: "08020:A:2", name: "Travel: each player draws a card, heard while Hills of Dunland is still in the staging area", layout: { phase: "Travel", staging: [HILLS, FOOTHILLS], deck: [TRIBESMAN, "f0"], deckOf: [{ code: "filler", seat: 0 }] }, act: travel(HILLS), expect: [drew(1), resourcesOn(FOOTHILLS, 1), zone(TRIBESMAN, "engaged"), zone(HILLS, "activeLocation")] },

  // 08021 Plains of Enedwaith and 08022 Hithaeglir Stream.
  { line: "08021:A:2", name: "Shadow: an undefended attack gets +3 Attack, not +4", layout: { engaged: ["f0"] }, act: attack("f0", { shadow: "08021", undefended: true }), expect: damageOn("dh1", 4) },
  { line: "08022:A:2", name: "Shadow: the attacker gets +1 Attack and is dealt one more shadow card", layout: { engaged: ["f0"], deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: "08022", undefended: true }), expect: [damageOn("dh1", 2), deckCount(2)] },

  // 08023 Frenzied Attack.
  { line: "08023:A:2", name: "Shadow: the attacking enemy cannot take damage until the end of the round", layout: { engaged: [TRIBESMAN] }, act: attack(TRIBESMAN, { shadow: "08023", undefended: true }), expect: flag(TRIBESMAN, "cannotTakeDamage") },
];

if (ROWS.length > 0) cardSpecs("the-dunland-trap", ROWS);
else describe("the-dunland-trap card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
