// Rules: rr.step-6-4-4, rr.destroy, hob.bilbo-baggins-ohauh (data/rules/entries.json); ledger lines 131001:A:3 and 132001:A:3.
// The foresight sees a loss that a record applies after the card leaves play: Bilbo Baggins' "If Bilbo Baggins leaves play, the players lose the game" is a record that hears the card leave play, so a copy of the state that only destroys him shows no loss.
import { expect, it } from "vitest";

import { spawn } from "../../rules/core/zones.ts";
import { EFFECTS } from "../../effects/index.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";

import { discardLoss, damageOutcome, lossWords, outcomeWords } from "./foresight.ts";

const ID = "we-must-away-ere-break-of-day";

function withHero(code: string) {
  const table = tableFromLayout(ID, {}, { effects: EFFECTS });
  const spawned = spawn(table.state, code, { zone: "heroes", seat: 0 });
  return { table, state: spawned.state, id: spawned.id };
}

it("131001 Bilbo Baggins: damage that destroys him is a loss, and the dock says so", () => {
  const { table, state, id } = withHero("131001");
  const hit = damageOutcome(state, table.ctx, id, 5);
  expect(hit.destroyed).toBe(true);
  expect(hit.loss).toBe("Bilbo Baggins left play");
  expect(outcomeWords(hit, "Bilbo Baggins", false)).toBe(`Bilbo Baggins is destroyed: ${lossWords("Bilbo Baggins left play")}`);
  expect(discardLoss(state, table.ctx, id)).toBe("Bilbo Baggins left play");
});

// The saga's Bilbo (132001:A:3) prints the same line as the same record, which the foresight reads from the records, not from a card code.
it("132001 Bilbo Baggins holds the same record the foresight reads", () => {
  expect(effectsOf({ effects: EFFECTS }, "132001").some((effect) => effect.timing === "triggered" && effect.trigger === "leftPlay" && effect.subject === "self" && effect.instructions.some((instruction) => instruction.verb === "LoseGame"))).toBe(true);
});

it("131001 Bilbo Baggins: damage that leaves him alive is no loss", () => {
  const { table, state, id } = withHero("131001");
  expect(damageOutcome(state, table.ctx, id, 1).loss).toBeNull();
});

it("another hero's fall is no loss", () => {
  const { table, state } = withHero("131001");
  expect(damageOutcome(state, table.ctx, idOf(state, "dh1"), 500).loss).toBeNull();
});

// A campaign card in play that names the leaving card (01129 and 01130: "If Mendor leaves play, the players lose the game") is read from the records, not from the leaving card.
it.each([["passage-through-mirkwood", "01129"], ["journey-along-the-anduin", "01130"]])("%s: with %s in play Mendor's fall is a loss, without it not", (scenario, campaign) => {
  const table = tableFromLayout(scenario, {}, { effects: EFFECTS });
  const mendor = spawn(table.state, "01135", { zone: "play", seat: 0 });
  expect(discardLoss(mendor.state, table.ctx, mendor.id)).toBeNull();
  const card = spawn(mendor.state, campaign, { zone: "play", seat: 0 });
  expect(discardLoss(card.state, table.ctx, mendor.id)).toBe("Mendor left play");
  expect(damageOutcome(card.state, table.ctx, mendor.id, 50).loss).toBe("Mendor left play");
});
