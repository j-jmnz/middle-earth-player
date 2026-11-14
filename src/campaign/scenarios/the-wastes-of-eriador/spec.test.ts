// Rules: mec108.day-and-night, mec108.side-quests-in-play, rr.forced, rr.travel, rr.shadow-effects, rr.first-player, rr.reveal, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, exhausted, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Wastes of Eriador (angmar-awakened part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot express (the flags of a side, a count of Wargs discarded, a pool entry, a cap
// tallied over a round, the log) is a test titled with its line id in lines.test.ts, cards.test.ts, encounter.test.ts and pool.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; a layout's current stage is on its B side.
const DAYBREAK = "10011";
const NIGHTFALL = "10012";
const STAGE1 = "10013";
const BLOOD_THIRSTY = "10019";
const WOLF = "10022";
const NORTH_DOWNS = "10025";
const PREDATORY_WOLVES = "10027";
const WARGS_DEN = "10024";
const NORTHERN_WARG = "10018";
const DECK = ["f0", "f0", "f0", "f0"];

const ROWS: readonly Row[] = [
  { line: "10011:A:3", name: "Forced at the end of the round: Daybreak flips to Nightfall", layout: { stage: STAGE1, staging: [DAYBREAK], deck: DECK }, act: announce("endOfRound"), expect: zone(NIGHTFALL, "staging") },
  { line: "10012:A:3", name: "Forced at the end of the round: Nightfall flips back to Daybreak", layout: { stage: STAGE1, staging: [NIGHTFALL], deck: DECK }, act: announce("endOfRound"), expect: zone(DAYBREAK, "staging") },

  { line: "10013:B:2", name: "Forced when it becomes Night: each player raises their threat by 1", layout: { stage: STAGE1, staging: [NIGHTFALL], seats: 2 }, act: announce("becameNight"), expect: [threat(29, 0), threat(29, 1)] },

  { line: "10019:A:1", name: "Forced when it becomes Night, in the staging area: it engages the first player and attacks at once", layout: { stage: STAGE1, staging: [NIGHTFALL, BLOOD_THIRSTY], deck: DECK }, act: announce("becameNight"), expect: zone(BLOOD_THIRSTY, "engaged") },

  { line: "10022:A:3", name: "Shadow: +1 Attack by day", layout: { stage: STAGE1, staging: [DAYBREAK] }, act: attack("f3", { shadow: WOLF, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "10022:A:3", name: "Shadow: +2 Attack by night", layout: { stage: STAGE1, staging: [NIGHTFALL] }, act: attack("f3", { shadow: WOLF, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "10024:A:2", name: "Travel: the first player searches for a Warg enemy and it is put into play engaged with them", layout: { stage: STAGE1, phase: "Travel", staging: [DAYBREAK, WARGS_DEN], deck: ["f0", NORTHERN_WARG] }, act: travel(WARGS_DEN), expect: zone(NORTHERN_WARG, "engaged") },

  { line: "10025:A:2", name: "Shadow: +1 Attack", layout: { stage: STAGE1, staging: [DAYBREAK] }, act: attack("f3", { shadow: NORTH_DOWNS, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "10027:A:2", name: "Shadow: the defending player exhausts a character they control", layout: { stage: STAGE1, staging: [DAYBREAK], play: ["ally"] }, act: [attack("f3", { shadow: PREDATORY_WOLVES, undefended: true }), answer("dh2")], expect: exhausted("dh2") },
];

if (ROWS.length > 0) cardSpecs("the-wastes-of-eriador", ROWS);
else describe("the-wastes-of-eriador card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
