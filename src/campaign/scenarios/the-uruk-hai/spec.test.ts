// Rules: mec112.pursuit, mec112.permanent, rr.reveal, rr.travel, rr.player-elimination, rr.lasting-effects, rr.active-location (data/rules/entries.json).
import { describe, it } from "vitest";

import { answer, cardSpecs, endRound, flag, lost, resolve, resourcesOn, reveal, stat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Uruk-hai (the-two-towers part 1): one row for each record whose behaviour a game moment shows (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/fast-track.md, Finish). The pursuit value is read through the quest points X of the
// current stage (143069:B:1); a row that needs the tracker gives the layout `pursuit: 10`, what the quest card's Setup sets (the 143069:A:1 row resolves it). A row cannot see a card's damage, a hand, a
// declared attacker or defender or the Responses offered, so the lines whose whole effect is such a thing are covered by verbs.test.ts in this folder instead (the Responses of 143015:A:3, 143017:A:3 and 143070:B:2,
// the Shadow cards 143028:A:2, 143029:A:2, 143031:A:2, 143032:A:2 and 143067:A:2, the choices of 143030:A:1 and 143063:A:2, the cards 143026:A:1 draws, the damage 143024:A:2 deals, 143029:A:1, Uglúk's 143023:A:2 and the engagement half of
// 143069:B:2) and by src/rules/families/captives/index.test.ts (143024:A:1 and the Captives' elimination rule).
const SETUP = resolve("143069", "setup");
const CAPTIVE = { hero: "dh2", under: "143022" };
const X = (value: number) => stat("143069", "questPoints", value);

const ROWS: readonly Row[] = [
  // The Captive is under To Isengard!, not among the heroes; the pursuit value is 10.
  { line: "143069:A:1", name: "a hero becomes a Captive and the pursuit value is set to 10", layout: { staging: ["143022"] }, act: SETUP, expect: [X(10), zone("dh1", "captive")] },
  { line: "143069:B:1", name: "the stage's quest points are the pursuit value", layout: { staging: ["143022"] }, act: SETUP, expect: X(10) },
  { line: "143069:B:2", name: "Uglúk cannot leave the staging area", layout: { staging: ["143023"] }, act: [], expect: [flag("143023", "cannotLeaveStaging"), flag("143023", "cannotTakeDamage"), flag("143023", "cannotBeEngaged")] },
  // Combat ends with 1 enemy (Uglúk) in the staging area, the refresh phase adds 1 more.
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
  { line: "143067:A:1", name: "the player returns an enemy engaged with them to the staging area", layout: { engaged: ["f0"] }, act: [reveal("143067"), answer("return")], expect: zone("f0", "staging") },
];

if (ROWS.length > 0) cardSpecs("the-uruk-hai", ROWS);
else describe("the-uruk-hai card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
