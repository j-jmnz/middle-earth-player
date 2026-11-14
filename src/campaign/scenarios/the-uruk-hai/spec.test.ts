// Rules: mec112.pursuit, mec112.permanent, rr.reveal, rr.travel, rr.player-elimination, rr.lasting-effects, rr.active-location (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, counter, damageOn, deckCount, drew, endPhase, endRound, flag, handCount, heldBy, lost, resolve, resourcesOn, respond, reveal, stat, travel, quest, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Uruk-hai (the-two-towers part 1): one row for each record whose behaviour a game moment shows (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure). The pursuit value is read through the quest points X of the
// current stage (143069:B:1) or the `counter` reader; a row that needs the tracker gives the layout `pursuit: 10`, what the quest card's Setup sets (the 143069:A:1 row resolves it). A row cannot hurt a hero
// before the attack, give a hero a trait, or declare an attacker, so the lines that need those are tests of verbs.test.ts in this folder, whose titles start with the line id (the traits of 143015:A:2 to 143018:A:2,
// the Responses of 143015:A:3 and 143017:A:3, the quest room of 143032:A:1, what 143028:A:2, 143032:A:2, 143064:A:2 and 143067:A:2 do when the attack destroys a character, the Responses of 143070:B:2 and the Restrict of
// 143070:B:3). The Captives' elimination rule is in src/rules/families/captives/index.test.ts. scripts/checks/spec-coverage.test.ts fails a line with neither a row nor a titled test.
const SETUP = resolve("143069", "setup");
const CAPTIVE = { hero: "dh2", under: "143022" };
const X = (value: number) => stat("143069", "questPoints", value);

const ROWS: readonly Row[] = [
  // The Captive is under To Isengard!, not among the heroes; the pursuit value is 10.
  { line: "143069:A:1", name: "a hero becomes a Captive and the pursuit value is set to 10", layout: { staging: ["143022"] }, act: SETUP, expect: [X(10), zone("dh1", "captive")] },
  { line: "143069:B:1", name: "the stage's quest points are the pursuit value", layout: { staging: ["143022"] }, act: SETUP, expect: X(10) },
  { line: "143069:B:2", name: "Uglúk cannot leave the staging area", layout: { staging: ["143023"] }, act: [], expect: [flag("143023", "cannotLeaveStaging"), flag("143023", "cannotTakeDamage"), flag("143023", "cannotBeEngaged")] },
  // Combat ends with 2 enemies (Uglúk and f0) in the staging area, the refresh phase adds 1 more: 10 + 2 + 1.
  { line: "143069:B:3", name: "the combat phase's end raises the pursuit value by the enemies in the staging area", layout: { staging: ["143022", "143023", "f0"], pursuit: 10, captive: CAPTIVE }, act: endRound, expect: X(13) },
  { line: "143022:A:2", name: "the refresh phase raises the pursuit value by 1", layout: { staging: ["143022"], pursuit: 10, captive: CAPTIVE }, act: endRound, expect: X(11) },
  { line: "143022:A:1", name: "with no Captive in play the players lose", layout: { staging: ["143022"] }, act: resolve("143022", "forced"), expect: lost },
  { line: "143025:A:2", name: "the first option raises the pursuit value by 3", layout: { staging: ["143022"], pursuit: 10, captive: CAPTIVE }, act: [reveal("143025"), answer("pursuit")], expect: X(13) },
  { line: "143026:A:2", name: "Travel raises the pursuit value by 1 (and the refresh phase that follows by 1 more)", layout: { phase: "Travel", staging: ["143022", "143026"], pursuit: 10, captive: CAPTIVE }, act: travel("143026"), expect: X(12) },
  { line: "143027:A:2", name: "Travel raises the pursuit value by 1 (and the refresh phase that follows by 1 more)", layout: { phase: "Travel", staging: ["143022", "143027"], pursuit: 10, captive: CAPTIVE }, act: travel("143027"), expect: X(12) },
  { line: "143030:A:1", name: "the first option raises the pursuit value by 3", layout: { staging: ["143022"], pursuit: 10, captive: CAPTIVE }, act: [reveal("143030"), answer("pursuit")], expect: X(13) },
  { line: "143031:A:1", name: "each committed character gets -1 Willpower until the end of the round", layout: { committed: ["dh1"] }, act: reveal("143031"), expect: stat("dh1", "willpower", 1) },
  { line: "143027:A:1", name: "its Response, as the active location, adds 1 resource to each hero", layout: { active: "143027" }, act: resolve("143027", "response"), expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 1)] },
  { line: "143018:A:3", name: "its Response adds 1 resource to the attached hero", layout: { attached: [{ code: "143018", to: "dh1" }] }, act: resolve("143018", "response"), expect: resourcesOn("dh1", 1) },
  { line: "143019:A:3", name: "the hero gets +1 Willpower", layout: { attached: [{ code: "143019", to: "dh1" }] }, act: [], expect: stat("dh1", "willpower", 3) },
  { line: "143065:A:2", name: "the Uruk-hai enemy searched for is engaged with the player", layout: { deck: ["143064"], staging: ["143022"] }, act: reveal("143065"), expect: zone("143064", "engaged") },
  { line: "143070:A:1", name: "the Uruk-hai enemy searched for is added to the staging area", layout: { deck: ["143064"], stage: "143070" }, act: resolve("143070", "whenRevealed"), expect: zone("143064", "staging") },
  { line: "143018:A:3", name: "used after the quest succeeds, its Response adds 1 resource to the attached hero", layout: { attached: [{ code: "143018", to: "dh1" }], pursuit: 10 }, act: [quest("success"), respond("143018")], expect: resourcesOn("dh1", 1) },
  { line: "143024:A:1", name: "as he enters play the first player attaches a Captive to him", layout: { staging: ["143022", "143024"], pursuit: 10, captive: CAPTIVE }, act: announce("encounterEnteredPlay", "143024"), expect: heldBy("dh2", "143024") },
  { line: "143024:A:1", name: "when he leaves play the Captive lies under To Isengard! again", layout: { staging: ["143022", "143024"], pursuit: 10, captive: { hero: "dh2", under: "143024" } }, act: announce("leftPlay", "143024"), expect: heldBy("dh2", "143022") },
  { line: "143024:A:2", name: "the quest phase ends with 1 damage to the Captive he holds", layout: { staging: ["143022", "143024"], captive: { hero: "dh2", under: "143024" } }, act: announce("endOfPhase", undefined, { seat: null, phase: "Quest" }), expect: damageOn("dh2", 1) },
  { line: "143026:A:1", name: "as the active location, its Response has each player draw 1 card", layout: { active: "143026", seats: 2, deckOf: ["filler", "filler", "filler", "filler"] }, act: resolve("143026", "response"), expect: [drew(1, 0), drew(1, 1), handCount(1, 0), handCount(1, 1)] },
  { line: "143028:A:1", name: "its Threat is the number of locations in the staging area", layout: { staging: ["143028", "place", "place"] }, act: [], expect: stat("143028", "threat", 3) },
  { line: "143028:A:2", name: "Shadow: the attacking enemy gets +1 Attack", act: attack("f3", { shadow: "143028", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "143032:A:2", name: "Shadow: the attacking enemy gets +1 Attack", act: attack("f3", { shadow: "143032", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "143029:A:1", name: "progress placed on it raises the pursuit value by 1", layout: { staging: ["143029"], pursuit: 10 }, act: announce("progressPlaced", "143029"), expect: counter("pursuit", 11) },
  { line: "143029:A:2", name: "Shadow: the first option raises the pursuit value by 1 and the defender holds", layout: { pursuit: 10 }, act: [attack("f3", { shadow: "143029" }), answer("pursuit")], expect: [counter("pursuit", 11), damageOn("dh1", 0)] },
  { line: "143029:A:2", name: "Shadow: the second option has the attack considered undefended", layout: { pursuit: 10 }, act: [attack("f3", { shadow: "143029" }), answer("undefended")], expect: [counter("pursuit", 10), damageOn("dh1", 1)] },
  { line: "143030:A:1", name: "the second option deals 1 damage to each character committed to the quest", layout: { pursuit: 10, committed: ["dh1"] }, act: [reveal("143030"), answer("damage")], expect: [damageOn("dh1", 1), counter("pursuit", 10)] },
  { line: "143031:A:2", name: "Shadow: the attacking enemy makes an additional attack", act: attack("f3", { shadow: "143031", undefended: true }), expect: attackersOf("dh1", ["f3", "f3"]) },
  { line: "143031:A:2", name: "Shadow: the additional attack is dealt a new shadow card (faq.additional-attacks)", act: attack("f3", { shadow: "143031", undefended: true }), expect: deckCount(2) },
  { line: "143031:A:1", name: "the -1 Willpower lasts past the quest phase, to the end of the round", layout: { committed: ["dh1"], deck: ["f0", "f0"], staging: ["143023"] }, act: [reveal("143031"), endPhase], expect: stat("dh1", "willpower", 1) },
  { line: "143063:A:2", name: "the first option has the player assign 3 damage among their characters", layout: { pursuit: 10 }, act: [reveal("143063"), answer("damage")], expect: damageOn("dh1", 3) },
  { line: "143064:A:3", name: "Shadow: a non-objective attachment the defending player controls is discarded", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "143064" }), expect: zone("attachment", "discard") },
  { line: "143066:A:2", name: "When Revealed: a card of the revealing player's hand is discarded", layout: { hand: ["filler"], staging: ["143022"] }, act: resolve("143066", "whenRevealed"), expect: handCount(0) },
  { line: "143070:B:1", name: "the stage's quest points are the pursuit value", layout: { stage: "143070", pursuit: 10 }, act: [], expect: stat("143070", "questPoints", 10) },
  { line: "143067:A:1", name: "the player returns an enemy engaged with them to the staging area", layout: { engaged: ["f0"] }, act: [reveal("143067"), answer("return")], expect: zone("f0", "staging") },
];

if (ROWS.length > 0) cardSpecs("the-uruk-hai", ROWS);
else describe("the-uruk-hai card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
