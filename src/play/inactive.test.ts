import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { OPEN_LINES } from "../effects/open-lines.ts";
import { expectOk } from "../rules/fixture.ts";
import { printedOf } from "../rules/printed.ts";
import { legalIntents, reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { updateCard } from "../rules/state.ts";
import { spawn } from "../rules/zones.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";

import { hasUniqueText, inactiveCodes } from "../catalog/active-text.ts";
import { firstShares, playRequest } from "./pay.ts";
import { distributeIntent, paySheet } from "./bar-sheets.ts";

// Rules: rr.sentinel, mec109.hide-x (data/rules/entries.json). A player card whose text no record implements yet (the first
// deck-legal Tactics ally that OPEN_LINES names and no record touches) is paid for and played with its printed cost and
// keeps its keywords; its unique text has no record, so it is inactive and the reducer never offers it. Once every card has
// records there is no such card and the play test has nothing to show.
const OPEN_CODES = new Set(OPEN_LINES.map((line) => line.split(":")[0]));
const RECORDED = new Set(EFFECTS.map((effect) => effect.cardCode));
const INACTIVE = loadCards().find((card) => card.type === "ally" && card.sphere === "tactics" && card.deckLegal && OPEN_CODES.has(card.code) && !RECORDED.has(card.code));
const MINER = "01061";

describe("inactive text", () => {
  it("a line of implemented keywords is not unique text; anything else is", () => {
    expect(hasUniqueText("Sentinel.")).toBe(false);
    expect(hasUniqueText("Ranged. Sentinel.")).toBe(false);
    expect(hasUniqueText("Hide 2. Cannot have non-Morgul attachments.")).toBe(true);
    expect(hasUniqueText("<b>Response:</b> After Miner of the Iron Hills enters play, choose and discard 1 Condition attachment from play.")).toBe(true);
    expect(hasUniqueText(null)).toBe(false);
  });

  it("marks a card with unique text and no record, and not a starter card that has records", () => {
    const text = "<b>Response:</b> After Miner of the Iron Hills enters play, choose and discard 1 Condition attachment from play.";
    const texts = new Map([
      [MINER, text],
      ["141002", "<b>Response:</b> After you engage an enemy..."],
      ["kw", "Sentinel."],
    ]);
    // A record-less copy of the effects, so the mark does not depend on whether the Miner has been authored yet.
    const effects = EFFECTS.filter((effect) => effect.cardCode !== MINER);
    expect([...inactiveCodes(texts, effects)]).toEqual([MINER]);
    // A card with records is still inactive while one of its printed lines is open.
    expect([...inactiveCodes(new Map([["141002", text]]), EFFECTS, ["141002:A:9"])]).toEqual(["141002"]);
  });

  it.runIf(INACTIVE != null)("the card resolves its printed cost and keywords, and no control applies its text", async () => {
    const code = INACTIVE?.code ?? "";
    const { ctx: base } = await starterWorld("stealth-and-steadfastness");
    const cards = new Map([...base.cards, ...(await loadPrinted([code]))]);
    const ctx = { effects: base.effects, cards };
    const cost = printedOf(cards, code).cost ?? 0;
    // The keywords the card prints are the ones the engine reads.
    for (const [keyword, value] of Object.entries(INACTIVE?.keywords ?? {})) expect(printedOf(cards, code).keywords).toHaveProperty(keyword, value);
    let state: ScenarioState = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
    const policy = { scout: "141004", prefer: "141035", protect: RING_BEARER };
    for (let turn = 0; turn < 400 && state.mode !== "planning"; turn += 1) state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
    expect(state.mode).toBe("planning");
    const spawned = spawn(state, code, { zone: "hand", seat: 0 });
    state = spawned.state;
    const tactics = state.seats[0].heroes.find((id) => printedOf(cards, state.cards[id]?.code ?? "").sphere === "tactics") ?? "";
    expect(tactics).not.toBe("");
    state = updateCard(state, tactics, { resources: cost });
    expect(legalIntents(state, ctx)).toContainEqual({ type: "PlayCard", cardId: spawned.id });
    const request = playRequest(state, ctx, spawned.id);
    expect(request?.total).toBe(cost);
    if (!request) return;
    state = expectOk(reduce(state, distributeIntent(paySheet(state, { card: (id) => id, line: () => null }, request, { kind: "play", cardId: spawned.id, hostId: null }), firstShares(request)), ctx)).state;
    expect(state.cards[spawned.id]?.zone).toBe("play");
    // Whatever the game does next, the card's text is never offered.
    for (let turn = 0; turn < 400 && !state.lost; turn += 1) {
      expect(legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === spawned.id)).toBe(false);
      state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
    }
  });
});
