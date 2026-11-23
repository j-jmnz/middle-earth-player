// Rules: sotm.escape-test, sotm.escape-test-example, rr.forced, rr.staging, rr.travel, rr.then, rr.shadow-effects, rr.damage, rr.destroy (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, commit, damageOn, frame, flag, reveal, resourcesOn, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Dead Marshes (shadows-of-mirkwood part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
const ROWS: readonly Row[] = [
  { line: "02107:A:2", name: "Forced: at the end of the quest phase a party that fails the escape test places 2 resource tokens on Gollum", layout: { seats: 2, phase: "Quest", staging: [{ code: "02107" }], deck: ["02111", "02111"] }, act: [announce("endOfPhase", undefined, { phase: "Quest" }), commit(), commit()], expect: [resourcesOn("02107", 2), frame("escape")] },
  { line: "02109:A:1", name: "When Revealed: a failed escape test puts 1 token on Gollum and raises each player's threat by 2", layout: { staging: [{ code: "02107" }], deck: ["02111", "02111"] }, act: [reveal("02109"), commit("dh1")], expect: [resourcesOn("02107", 1), threat(30), frame("escape")] },
  { line: "02111:A:1", name: "When Revealed: each player who fails the escape test places 1 token on Gollum and raises their own threat by 1", layout: { seats: 2, staging: [{ code: "02107" }], deck: ["02111", "02111", "02111", "02111"] }, act: [reveal("02111"), commit("dh1"), commit()], expect: [resourcesOn("02107", 2), threat(29, 0), threat(29, 1)] },
  { line: "02112:A:1", name: "Forced: at the end of each round 2 damage come off Giant Marsh Worm", layout: { engaged: [{ code: "02112", seat: 0, damage: 3 }] }, act: announce("endOfRound"), expect: [damageOn("02112", 1)] },
  { line: "02113:A:1", name: "When Revealed: 1 resource token on Gollum for each location in the staging area", layout: { staging: [{ code: "02107" }, "place", "place"], deck: ["f0"] }, act: reveal("02113"), expect: [resourcesOn("02107", 2)] },
  { line: "900802:A:1", name: "The Mere of Dead Faces: its Threat is the resource tokens on it, and it cannot leave the staging area", layout: { staging: [{ code: "900802", resources: 3 }] }, act: announce("enteredPlay", "900802"), expect: [stat("900802", "threat", 3), flag("900802", "cannotLeaveStaging")] },
  { line: "900803:A:3", name: "Shadow: a failed escape test discards the defending character", layout: {}, act: attack("f3", { shadow: "900803", undefended: false }), expect: [zone("dh1", "discard"), frame("escape")] },
  { line: "900804:A:1", name: "Forced: after a character commits to an escape test it takes 1 damage", layout: { staging: [{ code: "02107" }, "900804"], deck: ["f0", "f0"] }, act: [reveal("02109"), commit("dh1")], expect: [damageOn("dh1", 1)] },
  { line: "900804:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: {}, act: attack("f3", { shadow: "900804", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "900804:A:2", name: "Shadow: +2 Attack instead when the attacking enemy is Undead", layout: {}, act: attack("900805", { shadow: "900804", undefended: true }), expect: [damageOn("dh1", 5)] },
  { line: "900805:A:1", name: "Forced: after Marsh-wight engages a player that player makes an escape test; failing puts 2 tokens on Gollum", layout: { staging: [{ code: "02107" }, "900805"], deck: ["f0", "f0", "f0", "f0"] }, act: [announce("engaged", "900805"), commit()], expect: [resourcesOn("02107", 2), frame("escape")] },
  { line: "900809:A:1", name: "When Revealed: a failed test counting Defense puts 1 token on Gollum and deals 1 damage to each character", layout: { staging: [{ code: "02107" }], deck: ["02111", "02111"] }, act: [reveal("900809"), commit()], expect: [resourcesOn("02107", 1), damageOn("dh1", 1), damageOn("dh2", 1)] },
  { line: "02115:A:1", name: "Forced: after the players travel to Fens and Mires, 1 resource token on Gollum", layout: { phase: "Travel", staging: ["02115", { code: "02107" }] }, act: travel("02115"), expect: [resourcesOn("02107", 1)] },
];

if (ROWS.length > 0) cardSpecs("the-dead-marshes", ROWS);
else describe("the-dead-marshes card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
