// Rules: rr.then, rr.surge, rr.shadow-effects, rr.reveal, hob.setup-we-must-away-ere-break-of-day (data/rules/entries.json); ledger lines 131053:A:2, 131054:A:1.
import { expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { attachmentHostIds } from "../../../rules/player/attach.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { fightEnemy, idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

// The Troll lines whose second step depends on the first: "Then, shuffle the encounter deck" (rr.then), and Surge only when no Troll was in the staging area as the card resolved.
const ID = "we-must-away-ere-break-of-day";
const WILLIAM = "131032";
const BERT = "131033";
const CAMP = "131036";
const DECK = ["f0", "f0", CAMP, "f0", "f0"];

lineSpec("131053:A:2", "Shadow: Troll Camp is found in the encounter deck, added to the staging area and the deck is then shuffled", (effects) => {
  const table = tableFromLayout(ID, { deck: DECK }, { effects });
  const done = resolveRecords(table.state, table.ctx, "131053", "shadow");
  expect(done.state.cards[idOf(done.state, CAMP)]?.zone).toBe("staging");
  expect(done.state.encounterDeck).toHaveLength(4);
  expect(done.state.seedCursor).toBeGreaterThan(table.state.seedCursor);
});

// Through a real attack: a Shadow effect with no cancel resolves in a frame the engine pushes for it, and the "Then" step reads that frame (rr.then).
it("131053:A:2 when Troll Camp is not in the encounter deck nothing is added and the deck is not shuffled, in a real attack (rr.then)", () => {
  const make = (layout: Parameters<typeof tableFromLayout>[1]) => tableFromLayout(ID, layout, { effects: EFFECTS });
  const rest = { discard: [CAMP], seats: 1 as const };
  const fought = fightEnemy(make, "131053", "f3", { ...rest, deck: ["131053", "f0", "f0", "f0", "f0"] }, { undefended: true });
  const plain = fightEnemy(make, "f0", "f3", { ...rest, deck: ["f0", "f0", "f0", "f0", "f0"] }, { undefended: true });
  expect(fought.run.state.cards[idOf(fought.run.state, CAMP)]?.zone).toBe("encounterDiscard");
  expect(fought.run.state.seedCursor).toBe(plain.run.state.seedCursor);
  expect(fought.run.state.encounterDeck).toHaveLength(plain.run.state.encounterDeck.length);
});

it("131053:A:2 when Troll Camp is in the encounter deck it is added to the staging area and the deck is shuffled, in a real attack", () => {
  const make = (layout: Parameters<typeof tableFromLayout>[1]) => tableFromLayout(ID, layout, { effects: EFFECTS });
  const fought = fightEnemy(make, "131053", "f3", { seats: 1 as const, deck: ["131053", "f0", "f0", CAMP, "f0"] }, { undefended: true });
  const plain = fightEnemy(make, "f0", "f3", { seats: 1 as const, deck: ["f0", "f0", "f0", CAMP, "f0"] }, { undefended: true });
  expect(fought.run.state.cards[idOf(fought.run.state, CAMP)]?.zone).toBe("staging");
  expect(fought.run.state.seedCursor).toBeGreaterThan(plain.run.state.seedCursor);
});

lineSpec("131054:A:1", "a lone Troll enemy in the staging area is engaged by the first player and the card gains no Surge", (effects) => {
  const table = tableFromLayout(ID, { staging: [WILLIAM], deck: ["f0", "f0"] }, { effects });
  const done = resolveRecords(table.state, table.ctx, "131054", "whenRevealed");
  expect(done.state.cards[idOf(done.state, WILLIAM)]?.zone).toBe("engaged");
  expect(done.state.encounterDeck).toHaveLength(2);
});

lineSpec("131054:A:1", "with several Troll enemies in the staging area the one chosen is engaged and the card gains no Surge", (effects) => {
  const table = tableFromLayout(ID, { staging: [WILLIAM, BERT], deck: ["f0", "f0"] }, { effects });
  const done = resolveRecords(table.state, table.ctx, "131054", "whenRevealed", undefined, (state) => idOf(state, BERT));
  expect(done.state.cards[idOf(done.state, BERT)]?.zone).toBe("engaged");
  expect(done.state.cards[idOf(done.state, WILLIAM)]?.zone).toBe("staging");
  expect(done.state.encounterDeck).toHaveLength(2);
});

// Bert's bar (131033:A:1) is on playing an attachment card: an effect that attaches a card (Reattach, an "attach to" pick) is not barred. The stand-in attachment card is given an "Attach to an enemy" record.
it("131033:A:1 bars the play of an attachment card on a Troll but not an effect that attaches one", () => {
  const toEnemy: Effect = { id: "attachment:constant:1", cardCode: "attachment", lines: [], timing: "constant", instructions: [{ verb: "AttachesTo", hosts: [{ type: "enemy", control: "any" }] }] };
  const table = tableFromLayout(ID, { engaged: [BERT, WILLIAM] }, { effects: [...EFFECTS, toEnemy] });
  const william = idOf(table.state, WILLIAM);
  expect(attachmentHostIds(table.state, 0, "attachment", table.ctx)).not.toContain(william);
  expect(attachmentHostIds(table.state, 0, "attachment", table.ctx, true)).toContain(william);
});
