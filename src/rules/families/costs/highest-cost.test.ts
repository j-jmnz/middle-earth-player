// Rules: rr.the-word-choose, rr.attachment-cards (data/rules/entries.json); ledger line 145041:A:1.
// The Pick filter highestCost: of the cards that match, only those with the highest printed cost, a card with no printed cost counting as 0, every one of them when tied.
import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { cardMap } from "../../core/test-fixture.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { table, CARDS } from "../wilderland/fixture.ts";

const ALL = cardMap([
  ...CARDS.values(),
  definePrinted({ code: "blade", name: "Blade", type: "attachment", cost: 2 }),
  definePrinted({ code: "mail", name: "Mail", type: "attachment", cost: 3 }),
  definePrinted({ code: "plate", name: "Plate", type: "attachment", cost: 3 }),
  definePrinted({ code: "curse", name: "Curse", type: "attachment" }),
]);
const ctx: ReduceContext = { effects: [], cards: ALL };

function withAttachments(codes: readonly string[]) {
  let state = table();
  const hero = Object.values(state.cards).find((card) => card.code === "frodo")!.id;
  for (const code of codes) {
    const made = spawn(state, code, { zone: "attached" });
    state = attachTo(made.state, made.id, hero);
  }
  return state;
}

describe("the highestCost filter (145041:A:1)", () => {
  const found = (codes: readonly string[]) => {
    const state = withAttachments(codes);
    return pickCandidates(state, { type: "attachment", control: "any", highestCost: true }, 0, [], null, ctx).map((id) => state.cards[id]?.code);
  };

  it("keeps the one attachment with the highest printed cost", () => {
    expect(found(["blade", "mail", "curse"])).toEqual(["mail"]);
  });

  it("keeps every attachment tied on the highest cost, for the chooser to decide", () => {
    expect(found(["blade", "mail", "plate"]).sort()).toEqual(["mail", "plate"]);
  });

  it("counts an attachment with no printed cost as 0, and finds nothing with no attachment", () => {
    expect(found(["curse"])).toEqual(["curse"]);
    expect(found([])).toEqual([]);
  });
});
