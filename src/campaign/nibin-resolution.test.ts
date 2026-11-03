// Rules: rr.campaign-cards, rr.campaign-pool (data/rules/entries.json); ledger line 41051:B:1. What the Resolution sentence of The Caves of Nibin-Dûm says: the Ranger Sense the win earns and
// carries over, and that the win completes the campaign. The engine decides what is earned; nothing here changes a card.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { CAVES_GOLDENS, cavesWorld, playGolden } from "../../test/scenarios/the-caves-of-nibin-dum/game.ts";
import { campaign, caves } from "../../test/scenarios/the-caves-of-nibin-dum/scene.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { resolutionView, settledSentence } from "./resolution-view.ts";
import { loadWorld } from "./world.ts";

describe("the Resolution sentence (41051:B:1)", () => {
  it("names the Ranger Sense each player earns, kept for the next campaign too, and says the win completes the campaign", async () => {
    const golden = CAVES_GOLDENS.find((item) => item.name === "two-handed, won")!;
    const { cards, ctx } = await cavesWorld("strong");
    const game = playGolden(golden, ctx);
    const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
    const base = loadWorld(catalog, campaign, caves, EFFECTS, ["41048", "41049", "41042"]);
    const named = { ...base, cards: new Map([...base.cards, ...cards]) };
    const view = resolutionView(game.state, named);
    expect(view.kind).toBe("settled");
    if (view.kind !== "settled") return;
    expect(view.carried).toEqual([{ code: "41049", eachPlayer: true }]);
    expect(settledSentence(view, named, null, "The Dark of Mirkwood")).toBe("Confirming records 2 copies of Ranger Sense in the campaign and completes The Dark of Mirkwood. A Ranger Sense for each player is kept for your next campaign.");
    // Threat 40 or more: nothing is earned or kept.
    const tense = await cavesWorld("tense");
    const high = playGolden(CAVES_GOLDENS.find((item) => item.name === "two-handed, threat 40 or higher at the end, won")!, tense.ctx);
    const bare = resolutionView(high.state, { ...named, cards: new Map([...named.cards, ...tense.cards]) });
    if (bare.kind !== "settled") throw new Error("not settled");
    expect(bare.carried).toBeUndefined();
    expect(settledSentence(bare, named, null, "Mirkwood Paths")).toBe("Confirming records the win and completes Mirkwood Paths.");
    expect(settledSentence(bare, named, null)).toBe("Confirming records the win.");
  });
});
