// Rules: rm.time-x, rm.raven-deck, faq.reveal-and-add, rr.forced, rr.reveal, rr.first-player, rr.shadow-effects, rr.immune, rr.ownership-and-control (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, defend, drew, endRound, exhausted, flag, resourcesOn, reveal, resolve, stat, threat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Antlered Crown (the-ring-maker part 9): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot show is in engine.test.ts (the Setup of the Raven deck, a reveal against an add, the Raven shadow pair, the attacks of the last stage, the time counters of the locations, the Camp's counters) and in ../../../rules/families/wilderland/raven-deck.test.ts.
const STAGE_1 = "08147";
const STAGE_2 = "08148";
const STAGE_3 = "08149";
const TURCH = "08150";
const RAVEN_CHIEF = "08151";
const CAMP = "08152";
const WARRIOR = "08153";
const SKIRMISHER = "08154";
const WAR_CAMP = "08155";
const VILLAGE = "08156";
const BATTLEFIELD = "08157";
const COUNTRY = "08158";
const FIERCE_FOLK_RAID = "08160";
const ACTIVE = { code: BATTLEFIELD, resources: 3 };
const PROWLER = "07042";
const WATCHER = "07043";
const TRIBESMAN = "07046";
const LAST = (code: string) => announce("lastTimeCounterRemoved", code);

const ROWS: readonly Row[] = [
  // The quest stages: Time N on the back, one counter off each refresh phase.
  { line: "08147:B:1", name: "Time 3: a time counter comes off the stage in the refresh phase", layout: { stage: STAGE_1, timeCounters: 3, phase: "Combat" }, act: endRound, expect: resourcesOn(STAGE_1, 2) },
  { line: "08148:B:1", name: "Time 3: a time counter comes off the stage in the refresh phase", layout: { stage: STAGE_2, timeCounters: 3, phase: "Combat" }, act: endRound, expect: resourcesOn(STAGE_2, 2) },
  { line: "08149:B:1", name: "Time 2: a time counter comes off the stage in the refresh phase", layout: { stage: STAGE_3, timeCounters: 2, phase: "Combat" }, act: endRound, expect: resourcesOn(STAGE_3, 1) },
  { line: "08148:B:3", name: "Each location in the staging area gets +2 quest points (Raven Village prints 3)", layout: { stage: STAGE_2, staging: [VILLAGE] }, act: [], expect: stat(VILLAGE, "questPoints", 5) },
  { line: "08149:B:3", name: "At the end of the round, with Raven Chief in the victory display, the players win", layout: { stage: STAGE_3, victory: [RAVEN_CHIEF], phase: "Combat" }, act: endRound, expect: won },

  { line: "08147:B:2", name: "Forced after the last time counter: 1 counter comes off each location in play, then 3 counters go on the stage", layout: { stage: STAGE_1, timeCounters: 0, staging: [{ code: VILLAGE, resources: 2 }], active: ACTIVE }, act: LAST(STAGE_1), expect: [resourcesOn(VILLAGE, 1), resourcesOn(BATTLEFIELD, 2), resourcesOn(STAGE_1, 3)] },
  { line: "08151:A:2", name: "Forced when Raven Chief attacks: 1 time counter comes off the active location", layout: { engaged: [RAVEN_CHIEF], active: ACTIVE, deck: ["f0", "f0", "f0"] }, act: attack(RAVEN_CHIEF, { undefended: true }), expect: resourcesOn(BATTLEFIELD, 2) },
  { line: "08154:A:1", name: "When Revealed: the first player may remove 1 time counter from the active location", layout: { active: ACTIVE }, act: [resolve(SKIRMISHER, "whenRevealed"), answer("time")], expect: resourcesOn(BATTLEFIELD, 2) },
  { line: "08154:A:1", name: "When Revealed: or reveal an additional encounter card, leaving the counters alone", layout: { active: ACTIVE, deck: ["f0", "f0", "f0"] }, act: [resolve(SKIRMISHER, "whenRevealed"), answer("reveal")], expect: [resourcesOn(BATTLEFIELD, 3), deckCount(2)] },
  { line: "08154:A:2", name: "Shadow: the attacker gets +X Attack, X the Time X of the active location (3), so an undefended attack deals 4", layout: { engaged: ["f0"], active: ACTIVE, deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: SKIRMISHER, undefended: true }), expect: damageOn("dh1", 4) },
  { line: "08158:A:2", name: "Shadow: the defending player assigns X damage among his characters, X the Time X of the active location (3), besides the attack's 1", layout: { engaged: ["f0"], active: ACTIVE, deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: COUNTRY, undefended: true }), expect: damageOn("dh1", 4) },
  { line: "08160:A:3", name: "Shadow: the attacker gets +1 Attack, and a character this attack destroys takes 1 time counter off the active location", layout: { engaged: ["f0"], active: ACTIVE, play: [{ code: "ally", damage: 1 }], deck: ["f0", "f0", "f0"] }, act: [attack("f0", { shadow: FIERCE_FOLK_RAID }), defend("ally")], expect: resourcesOn(BATTLEFIELD, 2) },

  // 08150 Chief Turch.
  { line: "08150:A:1", name: "The first player gains control of Chief Turch", layout: { staging: [TURCH] }, act: announce("endOfRound"), expect: zone(TURCH, "play") },
  { line: "08150:A:2", name: "Chief Turch does not exhaust to defend", layout: { play: [TURCH], engaged: ["f0"] }, act: [attack("f0", { undefended: false }), defend(TURCH)], expect: exhausted(TURCH, false) },

  // 08151 Raven Chief and 08152 his Camp.
  { line: "08151:A:1", name: "Cannot have attachments", layout: { engaged: [RAVEN_CHIEF] }, act: [], expect: flag(RAVEN_CHIEF, "cannotHaveAttachments") },
  { line: "08151:A:1", name: "While the Camp is in play, Raven Chief cannot be damaged", layout: { engaged: [RAVEN_CHIEF], staging: [CAMP] }, act: [], expect: flag(RAVEN_CHIEF, "cannotTakeDamage") },
  { line: "08152:A:2", name: "Time 3: three time counters on it when it is revealed", layout: {}, act: reveal(CAMP), expect: resourcesOn(CAMP, 3) },
  { line: "08152:A:2", name: "Forced after the last time counter: each damaged character is exhausted and 3 time counters are placed", layout: { staging: [{ code: CAMP, resources: 0 }], play: [{ code: "ally", damage: 1 }] }, act: LAST(CAMP), expect: [exhausted("ally"), exhausted("dh1", false), resourcesOn(CAMP, 3)] },

  // 08153 Raven Warrior.
  { line: "08153:A:2", name: "Shadow: the defending player discards an attachment he controls", layout: { engaged: ["f0"], attached: [{ code: "attachment", to: "dh1" }], deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: WARRIOR, undefended: true }), expect: zone("attachment", "discard") },

  // The locations: Time N when revealed, and the Forced effect after the last counter.
  { line: "08155:A:1", name: "Time 3: three time counters on it when it is revealed", layout: {}, act: reveal(WAR_CAMP), expect: resourcesOn(WAR_CAMP, 3) },
  { line: "08155:A:1", name: "Forced after the last time counter: each player draws the top card of the Raven deck and puts it into play engaged with him", layout: { seats: 2, staging: [{ code: WAR_CAMP, resources: 0 }], piles: { ravenDeck: [PROWLER, WATCHER, TRIBESMAN] } }, act: LAST(WAR_CAMP), expect: [zone(PROWLER, "engaged"), zone(WATCHER, "engaged"), zone(TRIBESMAN, "ravenDeck")] },
  { line: "08156:A:1", name: "Time 2: two time counters on it when it is revealed", layout: {}, act: reveal(VILLAGE), expect: resourcesOn(VILLAGE, 2) },
  { line: "08156:A:1", name: "Forced after the last time counter: the top card of the Raven deck is revealed (its When Revealed resolves) and added to the staging area", layout: { staging: [{ code: VILLAGE, resources: 0 }], piles: { ravenDeck: [TRIBESMAN, PROWLER] }, deckOf: ["filler", "filler"] }, act: LAST(VILLAGE), expect: [zone(TRIBESMAN, "staging"), drew(1)] },
  { line: "08157:A:1", name: "Time 3: three time counters on it when it is revealed", layout: {}, act: reveal(BATTLEFIELD), expect: resourcesOn(BATTLEFIELD, 3) },
  { line: "08157:A:1", name: "Forced after the last time counter: each player assigns X damage among his characters, X the cards in his hand", layout: { staging: [{ code: BATTLEFIELD, resources: 0 }], hand: ["filler", "filler"] }, act: LAST(BATTLEFIELD), expect: damageOn("dh1", 2) },
  { line: "08158:A:1", name: "Time 4: four time counters on it when it is revealed", layout: {}, act: reveal(COUNTRY), expect: resourcesOn(COUNTRY, 4) },
  { line: "08158:A:1", name: "Forced after the last time counter: each player raises his threat by the cards in his hand", layout: { staging: [{ code: COUNTRY, resources: 0 }], hand: ["filler", "filler", "filler"] }, act: LAST(COUNTRY), expect: threat(31) },
];

if (ROWS.length > 0) cardSpecs("the-antlered-crown", ROWS);
else describe("the-antlered-crown card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
