// Rules: rr.then, rr.surge, rr.shadow-effects, rr.reveal, hob.setup-we-must-away-ere-break-of-day (data/rules/entries.json); ledger lines 131053:A:2, 131054:A:1.
import { expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

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

it("131053:A:2 when Troll Camp is not in the encounter deck nothing is added and the deck is not shuffled (rr.then)", () => {
  const table = tableFromLayout(ID, { deck: ["f0", "f0", "f0", "f0"], discard: [CAMP] }, { effects: EFFECTS });
  const done = resolveRecords(table.state, table.ctx, "131053", "shadow");
  expect(done.state.cards[idOf(done.state, CAMP)]?.zone).toBe("encounterDiscard");
  expect(done.state.encounterDeck).toEqual(table.state.encounterDeck);
  expect(done.state.seedCursor).toBe(table.state.seedCursor);
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
