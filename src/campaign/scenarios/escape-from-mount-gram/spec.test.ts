// Rules: mec108.joining-another-player, mec108.side-quests-in-play, mec108.time-x, rr.forced, rr.travel, rr.shadow-effects, rr.first-player, rr.reveal, rr.lasting-effects, rr.replacement-effects, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, exhausted, handCount, notWon, resolve, resourcesOn, reveal, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Escape from Mount Gram (angmar-awakened part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot express (the cards captured underneath a card, the areas of two players, the
// captured deck, the stolen cards, the boons) is a test titled with its line id in cards.test.ts, areas.test.ts and setup.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; a layout's current stage is on its B side.
const STAGE_2 = "10039";
const STAGE_3 = "10040";
const JAILOR = "10041";
const SOUTHERN_GATE = "10042";
const TORTURER = "10043";
const PATROL_ROOM = "10047";
const SOUND_THE_ALARM = "10049";
const FEEBLE = "10050";
const INTERROGATION = "10052";
const TORMENTOR = "10045";
const DECK = ["f0", "f0", "f0", "f0"];

const ROWS: readonly Row[] = [

  { line: "10040:A:1", name: "When Revealed: Southern Gate and Jailor Gornákh are added to the staging area", layout: { stage: STAGE_3, setAside: [SOUTHERN_GATE, JAILOR], deck: DECK }, act: resolve(STAGE_3, "whenRevealed"), expect: [zone(SOUTHERN_GATE, "staging"), zone(JAILOR, "staging")] },
  { line: "10040:B:2", name: "The players cannot defeat the stage while Southern Gate is in play: it stays", layout: { stage: STAGE_3, progress: 16, active: SOUTHERN_GATE }, act: announce("endOfRound"), expect: notWon },

  { line: "10041:A:1", name: "Forced after captured cards are rescued: he engages the player with the highest threat and attacks at once", layout: { seats: 2, threat: [30, 41], phase: "Encounter", staging: [JAILOR, "f3"], deck: DECK }, act: announce("capturedRescued", "f3"), expect: zone(JAILOR, "engaged") },

  { line: "10042:A:2", name: "While it is the active location each Orc enemy gets +2 Attack", layout: { stage: STAGE_2, active: SOUTHERN_GATE, staging: [TORTURER] }, act: [], expect: stat(TORTURER, "attack", 5) },
  { line: "10042:A:3", name: "Forced when it becomes the active location: each player with less than 35 threat raises it to 35", layout: { seats: 2, threat: [28, 40], staging: [SOUTHERN_GATE] }, act: announce("becameActive", SOUTHERN_GATE), expect: [threat(35, 0), threat(40, 1)] },

  { line: "10047:A:2", name: "Travel: each player raises their threat by 3 to travel here", layout: { phase: "Travel", staging: [PATROL_ROOM] }, act: travel(PATROL_ROOM), expect: threat(32) },
  { line: "10045:A:3", name: "Shadow: +2 Attack when the attacking enemy has no captured cards underneath it", layout: { engaged: [{ code: "f3", seat: 0 }] }, act: attack("f3", { shadow: TORMENTOR, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "10049:A:2", name: "When Revealed: each enemy in the staging area gets -10 engagement cost and +1 Attack until the end of the round", layout: { staging: ["f3"], deck: DECK }, act: reveal(SOUND_THE_ALARM), expect: [stat("f3", "engagementCost", 40), stat("f3", "attack", 2)] },
  { line: "10049:A:2", name: "When Revealed with no enemy in play: an enemy found in the encounter deck is added to the staging area, and it gets the bonus too", layout: { deck: ["f3"] }, act: reveal(SOUND_THE_ALARM), expect: [zone("f3", "staging"), stat("f3", "attack", 2)] },

  { line: "10050:A:2", name: "Shadow: the defending player exhausts a character they control", layout: { engaged: [{ code: "f3", seat: 0 }], play: ["ally"] }, act: [attack("f3", { shadow: FEEBLE, undefended: true }), answer("dh2")], expect: exhausted("dh2") },

  { line: "10053:A:2", name: "Time 4: four time counters on it when it is revealed", layout: { deck: DECK }, act: reveal("10053"), expect: resourcesOn("10053", 4) },
  { line: "10053:A:3", name: "Forced after the last time counter is removed: the quest is removed from the game", layout: { staging: [{ code: "10053", resources: 0 }] }, act: announce("lastTimeCounterRemoved", "10053"), expect: zone("10053", "removed") },
  { line: "10180:A:2", name: "The attached hero gets +2 hit points", layout: { attached: [{ code: "10180", to: "dh1" }] }, act: [], expect: stat("dh1", "hitPoints", 8) },

  { line: "10052:A:2", name: "Shadow: discard a random card from your hand and raise your threat by its printed cost", layout: { engaged: [{ code: "f3", seat: 0 }], hand: ["c3"] }, act: attack("f3", { shadow: INTERROGATION, undefended: true }), expect: [threat(31), handCount(0)] },

];

if (ROWS.length > 0) cardSpecs("escape-from-mount-gram", ROWS);
else describe("escape-from-mount-gram card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));

