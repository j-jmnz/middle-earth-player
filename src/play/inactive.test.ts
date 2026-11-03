import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { printedOf } from "../rules/core/printed.ts";
import { legalIntents, reduce, startScenario, type ScenarioState } from "../rules/engine/reduce.ts";
import { updateCard } from "../rules/core/state.ts";
import { spawn } from "../rules/core/zones.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld } from "../../scripts/starter-game.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";

import { inactiveCodes, textCheck } from "../catalog/active-text.ts";
import { shippedLedger } from "../catalog/printed-ledger.ts";
import { EFFECTS } from "../effects/index.ts";
import { notApplied } from "./not-applied.ts";
import { firstShares, playRequest } from "./pay.ts";
import { distributeIntent, paySheet } from "./bar-sheets.ts";

// Rules: rr.sentinel, rr.triggered-ability (data/rules/entries.json). Every player card is meant to have records (user decision,
// 2026-10-26), so these tests take the records of three cards away to show what a card no record reads does: Landroval (02053, a Tactics ally with Sentinel and a Response) is paid
// for and played with its printed cost and keeps its keyword, and its Response is never offered; Campfire Tales (02003, a
// Leadership event) cannot be played at all; Dúnedain Warning (02026, a Leadership attachment) attaches and does nothing.
const LANDROVAL = "02053";
const CAMPFIRE = "02003";
const WARNING = "02026";
const UNREAD = new Set([LANDROVAL, CAMPFIRE, WARNING]);
const EFFECTS_WITHOUT = EFFECTS.filter((effect) => !UNREAD.has(effect.cardCode));
const CHECK = textCheck(EFFECTS_WITHOUT, shippedLedger());

async function world(deckId: string, codes: readonly string[]) {
  const { ctx: base } = await starterWorld(deckId);
  const cards = new Map([...base.cards, ...(await loadPrinted(codes))]);
  return { effects: base.effects.filter((effect) => !UNREAD.has(effect.cardCode)), cards };
}

function toPlanning(deckId: string, ctx: Awaited<ReturnType<typeof world>>): ScenarioState {
  let state: ScenarioState = expectOk(reduce(startScenario(starterStart(deckId, 1), ctx), { type: "Keep" }, ctx)).state;
  const policy = { scout: "141004", prefer: "141035", protect: RING_BEARER };
  for (let turn = 0; turn < 400 && state.mode !== "planning"; turn += 1) state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
  expect(state.mode).toBe("planning");
  return state;
}

describe("text the app does not apply", () => {
  it("marks a card with a line no record reads, and not a starter card whose lines all have records", () => {
    const codes = inactiveCodes([
      [LANDROVAL, "Sentinel.\nLandroval cannot have restricted attachments.\n<b>Response:</b> After a hero card is destroyed, return Landroval to his owner's hand to put that hero back into play."],
      [CAMPFIRE, "<b>Action:</b> Each player draws 1 card."],
      ["141002", "<b>Response:</b> After you engage an enemy..."],
      ["kw", "Sentinel."],
    ], CHECK);
    expect([...codes].sort()).toEqual([CAMPFIRE, LANDROVAL]);
    expect(notApplied(CAMPFIRE, "event", "<b>Action:</b> Each player draws 1 card.", CHECK)?.words).toBe("Cannot be played");
    expect(notApplied(WARNING, "attachment", "Attach to a hero.\nAttached hero gains +1 [defense].", CHECK)?.words).toBe("Text not applied");
    expect(notApplied(LANDROVAL, "ally", "Sentinel.\n<b>Response:</b> After a hero card is destroyed, return Landroval.", CHECK)?.lines.map((line) => line.text)).toEqual([
      "Response: After a hero card is destroyed, return Landroval.",
    ]);
  });

  it("an ally resolves its printed cost and keyword, and no control applies its text", async () => {
    const ctx = await world("stealth-and-steadfastness", [LANDROVAL]);
    expect(printedOf(ctx.cards, LANDROVAL).keywords.sentinel).toBe(true);
    let state = toPlanning("stealth-and-steadfastness", ctx);
    const spawned = spawn(state, LANDROVAL, { zone: "hand", seat: 0 });
    state = spawned.state;
    const tactics = state.seats[0].heroes.find((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").sphere === "tactics") ?? "";
    expect(tactics).not.toBe("");
    state = updateCard(state, tactics, { resources: 5 });
    expect(legalIntents(state, ctx)).toContainEqual({ type: "PlayCard", cardId: spawned.id });
    const request = playRequest(state, ctx, spawned.id);
    expect(request?.total).toBe(5);
    if (!request) return;
    state = expectOk(reduce(state, distributeIntent(paySheet(state, { card: (id) => id, line: () => null }, request, { kind: "play", cardId: spawned.id, hostId: null }), firstShares(request)), ctx)).state;
    expect(state.cards[spawned.id]?.zone).toBe("play");
    const policy = { scout: "141004", prefer: "141035", protect: RING_BEARER };
    for (let turn = 0; turn < 400 && !state.lost; turn += 1) {
      expect(legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === spawned.id)).toBe(false);
      state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
    }
  });

  it("an event with no record is never offered, in planning or any action window, and opens none", async () => {
    const ctx = await world("wisdom-and-wizardry", [CAMPFIRE]);
    let state = toPlanning("wisdom-and-wizardry", ctx);
    const spawned = spawn(state, CAMPFIRE, { zone: "hand", seat: 0 });
    state = spawned.state;
    for (const id of state.seats[0].heroes) state = updateCard(state, id, { resources: 3 });
    const policy = { scout: "", prefer: "141035", protect: RING_BEARER };
    for (let turn = 0; turn < 200 && !state.lost && state.cards[spawned.id]?.zone === "hand"; turn += 1) {
      expect(legalIntents(state, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === spawned.id)).toBe(false);
      state = expectOk(reduce(state, nextIntent(state, ctx, policy), ctx)).state;
    }
  });
});
