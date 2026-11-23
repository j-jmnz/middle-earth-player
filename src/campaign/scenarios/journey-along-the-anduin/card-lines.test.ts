// Rules: rr.shadow-effects, rr.surge, rr.step-6-4-3, rr.action, rr.campaign-cards, rr.attachment-cards (data/rules/entries.json).
import { describe, it } from "vitest";

import { answer, attack, cardSpecs, damageOn, deckCount, defend, flag, progressOn, resolve, reveal, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Journey Along the Anduin (Mirkwood Paths part 2) and its Nightmare deck: one row for each printed line a single action can show, on a table of plain-number heroes (dh1 and dh2: 2 Willpower,
// 2 Attack, 2 Defense, 6 hit points) and the stand-ins f0 and f3 (1 Attack, 1 Defense, 3 hit points). `cardSpecs` runs each row again without the records of its line, where it must fail. The false cases,
// the durations, the second player and the campaign card's Setup are in card-lines-scenes.test.ts.
const ROWS: readonly Row[] = [
  // 900202 Marshland Outlaws A:2: "Shadow: Raise your threat by X. X is the amount of damage dealt by this attack." f3's undefended attack deals 1.
  { line: "900202:A:2", name: "Shadow: the defending player raises his threat by the 1 damage the attack dealt", layout: {}, act: attack("f3", { shadow: "900202", undefended: true }), expect: [damageOn("dh1", 1), threat(29)] },

  // 900203 Anduin Troll Spawn A:1: "If there is no Hill Troll in play, Anduin Troll Spawn gains surge."
  { line: "900203:A:1", name: "with no Hill Troll in play it gains surge and one more card is revealed", layout: { deck: ["f0", "f0"] }, act: reveal("900203"), expect: [zone("900203", "staging"), deckCount(1)] },

  // 900204 Brown Water Rats A:1: "Brown Water Rats cannot be damaged." A:3: "Shadow: Attacking enemy cannot be damaged this round."
  { line: "900204:A:1", name: "Brown Water Rats cannot be damaged", layout: { staging: ["900204"] }, act: [], expect: flag("900204", "cannotTakeDamage") },
  { line: "900204:A:3", name: "Shadow: the attacking enemy cannot be damaged after the attack, in the same round", layout: {}, act: [attack("f3", { shadow: "900204" }), defend("dh1")], expect: flag("f3", "cannotTakeDamage") },

  // 900205 A Flooded Ford A:2: "Shadow: If this attack is undefended, put A Flooded Ford into the staging area with 1 progress token on it."
  { line: "900205:A:2", name: "Shadow: an undefended attack puts A Flooded Ford into the staging area with 1 progress", layout: {}, act: attack("f3", { shadow: "900205", undefended: true }), expect: [zone("900205", "staging"), progressOn("900205", 1)] },

  // 900206 Gladden Marshlands A:1: "Action: Deal 1 damage to a hero you control to reduce Gladden Marshlands' Threat by 1 until the end of the phase." It prints 10 Threat.
  { line: "900206:A:1", name: "Action: 1 damage to the hero the player chooses lowers its Threat to 9", layout: { staging: ["900206"] }, act: [resolve("900206", "action"), answer("dh2")], expect: [damageOn("dh2", 1), damageOn("dh1", 0), stat("900206", "threat", 9)] },
  // A:2: "Shadow: Each enemy engaged with the defending player gets +1 Attack until the end of the phase. (+2 Attack instead if this attack is undefended.)" Marshland Outlaws 900202 (2 Attack) is a second enemy engaged with him, listed after f3 so the shadow card goes to f3's attack.
  { line: "900206:A:2", name: "Shadow: each enemy engaged with the defending player gets +1 Attack when the attack is defended", layout: { engaged: ["f3", "900202"] }, act: [attack("f3", { shadow: "900206" }), defend("dh1")], expect: [stat("900202", "attack", 3), stat("f3", "attack", 2)] },
  { line: "900206:A:2", name: "Shadow: +2 Attack instead when the attack is undefended", layout: { engaged: ["f3", "900202"] }, act: attack("f3", { shadow: "900206", undefended: true }), expect: [stat("900202", "attack", 4), stat("f3", "attack", 3)] },
];

if (ROWS.length > 0) cardSpecs("journey-along-the-anduin", ROWS);
else describe("journey-along-the-anduin card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
