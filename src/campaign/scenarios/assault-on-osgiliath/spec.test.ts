// Rules: rr.reveal, rr.shadow-effects, ltp.undefended-attack, rr.attachment-cards, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 06092:A:1, 06092:A:2.
import { describe, it } from "vitest";

import { attack, cardSpecs, count, resolve, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Assault on Osgiliath (against-the-shadow part 7): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). What a row cannot express (the control of locations, a Setup with choices, a Travel or an Action, the Shadow effects that read the
// locations of the first player, the archery total over a round) is a test titled with its line id in lines-control.test.ts, lines-setup.test.ts, lines-tower.test.ts, lines-shadows.test.ts, lines-gate.test.ts, lines-square.test.ts and lines-cards.test.ts.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28.
const LIEUTENANT = "06092";
const VANGUARD = "05058";
const SOLDIER = "06093";
const MERCENARIES = "05052";

const ROWS: readonly Row[] = [
  // 06092:A:1 "When Revealed: Add the topmost Orc enemy from the encounter discard pile to the staging area." The topmost is the last card discarded; Southron Mercenaries (Harad) lies above both Orcs and is not one.
  { line: "06092:A:1", name: "When Revealed: the topmost Orc enemy of the encounter discard pile is added to the staging area, the card above it that is no Orc and the Orc under it staying", layout: { discard: [SOLDIER, VANGUARD, MERCENARIES] }, act: resolve(LIEUTENANT, "whenRevealed"), expect: [zone(VANGUARD, "staging"), zone(SOLDIER, "encounterDiscard"), zone(MERCENARIES, "encounterDiscard")] },

  // 06092:A:2 "Shadow: Defending player discards an attachment he controls (all of them if this attack is undefended)." f0 deals the Lieutenant's shadow card; two attachments on the defender's hero.
  { line: "06092:A:2", name: "Shadow: the defending player discards 1 attachment he controls when the attack is defended", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: LIEUTENANT }), expect: count("attachment", "discard", 1) },
  { line: "06092:A:2", name: "Shadow: the defending player discards every attachment he controls when the attack is undefended", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: LIEUTENANT, undefended: true }), expect: count("attachment", "discard", 2) },
];

if (ROWS.length > 0) cardSpecs("assault-on-osgiliath", ROWS);
else describe("assault-on-osgiliath card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
