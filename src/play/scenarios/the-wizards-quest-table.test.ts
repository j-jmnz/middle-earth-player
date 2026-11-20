// Rules: rr.guarded, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51004:B:1, 51004:B:2, 51013:A:1 (docs/brief.md, The Wizard's Quest, readings 9 and 3).
// What the table says of the player cards Carried Away and Necromancer's Pass hold faceup under them: the host's pill counts them and names each owner, and the held card's preview says where it lies. The engine decided
// who holds what; nothing here changes one.
import { describe, expect, it } from "vitest";

import { printedOf } from "../../rules/core/printed.ts";
import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";

const table = (layout: Layout) => tableFromLayout("the-wizards-quest", layout);

describe("the player cards held under a card", () => {
  it("51004:B:1 Carried Away's pill counts the allies under it and names their owner; the ally's preview says where it lies", () => {
    const made = table({ stage: "51004", play: ["ally"] });
    const stage = idOf(made.state, "51004");
    const held = resolveRecords(made.state, made.ctx, "51004", "whenRevealed", stage).state;
    const ally = Object.values(held.cards).find((card) => card.code === "ally" && card.zone === "under")!;
    expect(slotNumbers(held, made.ctx, stage).under).toMatchObject({ text: "1 held", loses: false, speech: "1 card held underneath: ally, your card" });
    const name = (id: string) => printedOf(made.ctx.cards, held.cards[id]?.code ?? "").name;
    expect(dungeonDetail(held, made.ctx, ally.id, name)).toBe("Held faceup under Mirkwood Forest, out of play, your card. No copy of it can be played. It returns to its owner's hand when Mirkwood Forest leaves play.");
  });

  it("51013:A:1 Necromancer's Pass says it holds one card, and a game with no held card says nothing", () => {
    const made = table({ staging: ["51013"], hand: ["c1", "c3", "c2"] });
    const pass = idOf(made.state, "51013");
    expect(slotNumbers(made.state, made.ctx, pass).under).toBeNull();
    const held = resolveRecords(made.state, made.ctx, "51013", "whenRevealed", pass).state;
    expect(slotNumbers(held, made.ctx, pass).under).toMatchObject({ text: "1 held" });
  });
});
