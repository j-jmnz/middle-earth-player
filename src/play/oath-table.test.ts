// Rules: rr.limits, rr.campaign-cards (data/rules/entries.json); ledger lines 41050:A:3, 41050:B:1, 41044:A:3. What the table says for The Oath: the resource tokens on
// the campaign card, and an Adaptation whose Action is used for the campaign. The engine decides both; nothing here changes a card.
import { beforeAll, describe, expect, it } from "vitest";

import { loadOathWorld, oathTable, type OathWorld } from "../../scripts/oath-scene.ts";
import { first } from "../../scripts/past-scene.ts";

import { oathDetail } from "./oath-preview.ts";
import { campaignTokens } from "./widgets.ts";

let world: OathWorld;

beforeAll(async () => {
  world = await loadOathWorld();
});

const nameOf = (code: string) => world.cards.get(code)?.name ?? code;

describe("the resource tokens on the campaign card (41050:A:3)", () => {
  it("shows the number the engine wrote, named for the card, in a Campaign Mode game of The Oath", () => {
    const made = oathTable(world, { campaign: true });
    expect(campaignTokens(made.state, made.ctx.effects, nameOf)).toEqual({ name: "The Oath", tokens: 0 });
    const id = first(made.state, "41050");
    const more = { ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, resources: 4 } } };
    expect(campaignTokens(more, made.ctx.effects, nameOf)).toEqual({ name: "The Oath", tokens: 4 });
  });

  it("shows nothing in a standalone game (no campaign card), and nothing for a campaign card that places no token", () => {
    const made = oathTable(world, {});
    expect(campaignTokens(made.state, made.ctx.effects, nameOf)).toBeNull();
    const withCard = oathTable(world, { campaign: true });
    expect(campaignTokens(withCard.state, withCard.ctx.effects.filter((effect) => effect.cardCode !== "41050"), nameOf)).toBeNull();
  });
});

describe("an Adaptation's preview (41044:A:3)", () => {
  it("says its Action is used once the Campaign Log records it, and says nothing before", () => {
    const fresh = oathTable(world, { attachments: ["41044"] });
    expect(oathDetail(fresh.state, fresh.ctx, first(fresh.state, "41044"), () => "The Fervor of Lore")).toBeNull();
    const used = oathTable(world, { attachments: ["41044"], facts: { usedOnce: ["41044"] } });
    expect(oathDetail(used.state, used.ctx, first(used.state, "41044"), () => "The Fervor of Lore")).toBe("The Fervor of Lore: its Action is used for this campaign");
    // Another Adaptation's use does not mark this one, and a card without the limit says nothing.
    const other = oathTable(world, { attachments: ["41044"], facts: { usedOnce: ["41045"] } });
    expect(oathDetail(other.state, other.ctx, first(other.state, "41044"), () => "x")).toBeNull();
    expect(oathDetail(used.state, used.ctx, used.hero, () => "x")).toBeNull();
  });
});
