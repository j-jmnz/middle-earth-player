import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import { printedOf } from "../rules/printed.ts";
import { legalIntents, reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { updateCard } from "../rules/state.ts";
import { spawn } from "../rules/zones.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";

import { hasUniqueText, inactiveCodes } from "./inactive.ts";
import { firstShares, playRequest } from "./pay.ts";
import { distributeIntent, paySheet } from "./sheets.ts";

// Rules: rr.sentinel, mec109.hide-x (data/rules/entries.json). A player card outside the two starter decks (Gondorian
// Spearman, 01029, a Tactics ally with Sentinel and a Response) is paid for and played with its printed cost and keeps its
// keyword; its unique text has no record, so it is inactive and the reducer never offers it.
const SPEARMAN = "01029";
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
    const codes = inactiveCodes(
      new Map([
        [MINER, "<b>Response:</b> After Miner of the Iron Hills enters play, choose and discard 1 Condition attachment from play."],
        ["141002", "<b>Response:</b> After you engage an enemy..."],
        ["kw", "Sentinel."],
      ]),
      EFFECTS,
    );
    expect(EFFECTS.some((effect) => effect.cardCode === MINER)).toBe(false);
    expect([...codes]).toEqual([MINER]);
  });

  it("the card resolves its printed cost and keyword, and no control applies its text", async () => {
    const { ctx: base } = await starterWorld("stealth-and-steadfastness");
    const cards = new Map([...base.cards, ...(await loadPrinted([SPEARMAN]))]);
    const ctx = { effects: base.effects, cards };
    expect(EFFECTS.some((effect) => effect.cardCode === SPEARMAN)).toBe(false);
    expect(printedOf(cards, SPEARMAN).cost).toBe(2);
    expect(printedOf(cards, SPEARMAN).keywords.sentinel).toBe(true);
    let state: ScenarioState = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
    const policy = { scout: "141004", prefer: "141035", protect: RING_BEARER };
    for (let turn = 0; turn < 400 && state.mode !== "planning"; turn += 1) state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
    expect(state.mode).toBe("planning");
    const spawned = spawn(state, SPEARMAN, { zone: "hand", seat: 0 });
    state = spawned.state;
    const tactics = state.seats[0].heroes.find((id) => printedOf(cards, state.cards[id]?.code ?? "").sphere === "tactics") ?? "";
    expect(tactics).not.toBe("");
    state = updateCard(state, tactics, { resources: 2 });
    expect(legalIntents(state, ctx)).toContainEqual({ type: "PlayCard", cardId: spawned.id });
    const request = playRequest(state, ctx, spawned.id);
    expect(request?.total).toBe(2);
    if (!request) return;
    state = expectOk(reduce(state, distributeIntent(paySheet(state, { card: (id) => id, line: () => null }, request, { kind: "play", cardId: spawned.id, hostId: null }), firstShares(request)), ctx)).state;
    expect(state.cards[spawned.id]?.zone).toBe("play");
    // Whatever the game does next, the Spearman's Response is never offered.
    for (let turn = 0; turn < 400 && !state.lost; turn += 1) {
      expect(legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === spawned.id)).toBe(false);
      state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
    }
  });
});
