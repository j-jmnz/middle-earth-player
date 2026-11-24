// Rules: rr.shadow-effects, ltp.undefended-attack, rr.defending-player (data/rules/entries.json); ledger line 06120:A:2.
import { describe, it } from "vitest";

import { attack, cardSpecs, damageOn, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Blood of Gondor (against-the-shadow part 8): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). Every other line is a test titled with its line id in lines-allies.test.ts (the two objective allies), lines-take.test.ts (each way a hidden card is
// taken), lines-turn.test.ts (the Setup, the combat choice, Captured! and the turn at 5), lines-lying.test.ts (Lying in Wait and the hidden information), lines-attacks.test.ts (Brutal Uruk, Mordor Looms, Orc Ambusher) and lines-places.test.ts (the locations, the totals, Conflict at the Crossroads and the win).
// The stand-in heroes have 2 Defense and 6 hit points; Brutal Uruk (Attack 4) and Evil Crow (Attack 1) are the attackers.
const AMBUSHER = "06120";
const URUK = "06121";
const CROW = "06122";

const ROWS: readonly Row[] = [
  // 06120:A:2 "Shadow: Attacking enemy gets +1 Attack. (+3 Attack instead if undefended.)" Brutal Uruk (4) defended by a hero of Defense 2: 4 + 1 - 2 = 3 damage, and 2 without the shadow card.
  { line: "06120:A:2", name: "Shadow: the attacking enemy gets +1 Attack when the attack is defended (4 + 1 - 2 = 3 damage)", act: attack(URUK, { shadow: AMBUSHER }), expect: damageOn("dh1", 3) },
  // Evil Crow (1) undefended: +3 instead of +1, a total of +3 and not +4: 1 + 3 = 4 damage on the hero, and 1 without the shadow card.
  { line: "06120:A:2", name: "Shadow: the attacking enemy gets +3 Attack instead when the attack is undefended (1 + 3 = 4 damage, not 5)", act: attack(CROW, { shadow: AMBUSHER, undefended: true }), expect: damageOn("dh1", 4) },
];

if (ROWS.length > 0) cardSpecs("the-blood-of-gondor", ROWS);
else describe("the-blood-of-gondor card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
