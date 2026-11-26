// Rules: rr.step-6-2, ltp.deal-shadow-cards (data/rules/entries.json).
// Step 6.2 deals one shadow card to each engaged enemy, with no exception for an enemy that already holds a card (dealStepShadow): it holds both. An enemy with the flag dealtShadows is dealt that many.
import { describe, expect, it } from "vitest";

import type { ReduceContext } from "../interpret/interpret.ts";
import { dealOneShadow } from "../interpret/interpret.ts";
import { shadowCards } from "../core/zones.ts";
import { CARDS, deal, table } from "../families/wilderland/fixture.ts";
import { dealShadows } from "./combat.ts";

const ctx: ReduceContext = { effects: [], cards: CARDS };

function setup(count: number) {
  const enemies = deal(table(), ["orc", "orc"], { zone: "engaged", seat: 0 });
  const deck = deal(enemies.state, Array.from({ length: count }, () => "mist"), { zone: "encounterDeck" });
  const [held = "", fresh = ""] = enemies.ids;
  return { state: deck.state, held, fresh };
}

describe("step 6.2 deals a shadow card to each engaged enemy", () => {
  it("rr.step-6-2 an enemy that holds a card is dealt one more, and an enemy with none is dealt its first", () => {
    const { state, held, fresh } = setup(6);
    const had = dealOneShadow(state, held, [], ctx);
    expect(shadowCards(had.cards[held])).toHaveLength(1);
    const dealt = dealShadows(had, ctx, []);
    expect(shadowCards(dealt.cards[held])).toHaveLength(2);
    expect(shadowCards(dealt.cards[fresh])).toHaveLength(1);
    // The card it held stays its first shadow card.
    expect(dealt.cards[held]?.shadowId).toBe(had.cards[held]?.shadowId);
  });

  it("rr.step-6-2 an enemy that holds dealtShadows N and a card is dealt N more", () => {
    const { state, held } = setup(8);
    const had = dealOneShadow(state, held, [], ctx);
    const flagged = { ...had, modifiers: [...had.modifiers, { instanceId: held, sourceId: held, stat: "dealtShadows" as const, amount: 3, until: "endOfPhase" as const }] };
    const dealt = dealShadows(flagged, ctx, []);
    // One held, then 3 dealt.
    expect(shadowCards(flagged.cards[held])).toHaveLength(1);
    expect(shadowCards(dealt.cards[held])).toHaveLength(4);
  });

  it("rr.step-6-2 nothing more is dealt when the deck holds no card", () => {
    const { state, held } = setup(0);
    const dealt = dealShadows(state, ctx, []);
    expect(shadowCards(dealt.cards[held])).toHaveLength(0);
  });
});
