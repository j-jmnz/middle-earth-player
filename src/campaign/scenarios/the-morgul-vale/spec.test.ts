// Rules: rr.shadow-effects, ltp.undefended-attack, rr.defending-player (data/rules/entries.json); ledger lines 06150:A:2, 06159:A:3, 06160:A:2.
import { describe, it } from "vitest";

import { attack, cardSpecs, damageOn, progressOn, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Morgul Vale (against-the-shadow part 9): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). Every other line is a test titled with its line id: lines-stages.test.ts (the three stages, their Captains, the Nazgûl's damage and attachments),
// lines-tower.test.ts (the Setup, To the Tower, the loss, the cards that place tokens, The White Bridge, the treacheries and the Surge), lines-bodyguard.test.ts (the Morgul Bodyguard's damage and Shadow), lines-alcaron.test.ts (Lord Alcaron) and lines-shadows.test.ts (the other Shadow lines, Murzag, Morgul Road and Morgul Vale).
// The stand-in heroes have 2 Defense and 6 hit points; Morgul Bodyguard (Attack 2) is the attacker. The tokens lie on To the Tower, in the staging area.
const TOWER = "06147";
const BODYGUARD = "06148";
const TRACKER = "06150";
const TERROR = "06159";
const DEAD_CITY = "06160";

const ROWS: readonly Row[] = [
  // 06150:A:2 "Shadow: Attacking enemy gets +1 Attack. If undefended, place 1 progress token on To the Tower as well." Defended by a hero of Defense 2: 2 + 1 - 2 = 1 damage, and no token.
  { line: "06150:A:2", name: "Shadow: the attacking enemy gets +1 Attack when the attack is defended (2 + 1 - 2 = 1 damage) and no token is placed", layout: { staging: [TOWER] }, act: attack(BODYGUARD, { shadow: TRACKER }), expect: [damageOn("dh1", 1), progressOn(TOWER, 0)] },
  // Undefended: 2 + 1 = 3 damage on the hero, and 1 token on To the Tower as well.
  { line: "06150:A:2", name: "Shadow: an undefended attack also places 1 token on To the Tower (2 + 1 = 3 damage)", layout: { staging: [TOWER] }, act: attack(BODYGUARD, { shadow: TRACKER, undefended: true }), expect: [damageOn("dh1", 3), progressOn(TOWER, 1)] },
  // 06159:A:3 "Shadow: Attacking enemy gets +1 Attack for each progress token on To the Tower." 3 tokens: 2 + 3 - 2 = 3 damage, and 2 - 2 = 0 without the shadow card.
  { line: "06159:A:3", name: "Shadow: the attacking enemy gets +1 Attack for each token on To the Tower, counted as the shadow resolves (2 + 3 - 2 = 3 damage)", layout: { staging: [{ code: TOWER, progress: 3 }] }, act: attack(BODYGUARD, { shadow: TERROR }), expect: damageOn("dh1", 3) },
  // 06160:A:2 as 06159:A:3: 4 tokens: undefended 2 + 4 = 6 damage on the hero.
  { line: "06160:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each token on To the Tower (undefended, 2 + 4 = 6 damage)", layout: { staging: [{ code: TOWER, progress: 4 }] }, act: attack(BODYGUARD, { shadow: DEAD_CITY, undefended: true }), expect: damageOn("dh1", 6) },
];

if (ROWS.length > 0) cardSpecs("the-morgul-vale", ROWS);
else describe("the-morgul-vale card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
