// Rules: mec108.orc-deck, mec108.side-quests-in-play, rr.blank, rr.surge, rr.travel, rr.first-player, mec112.gollum-smeagol, faq.enemy-attacks-outside-combat, mec108.campaign-setup-the-weather-hills (data/rules/entries.json);
// ledger lines 09026:A:2, 09029:A:2, 09054:A:1, 09069:B:1, 09069:B:2, 09070:A:1, 09071:A:1, 09072:A:1, 10159:A:2, 10160:A:3, 10165:A:4. The angmar family's verbs of The Weather Hills, on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { hasKeyword, modifiedStat } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { textBlank } from "../attachments/hold.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { travelCostUnpayable } from "../../interpret/restrictions.ts";
import { HERO, HERO2, idOf, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-weather-hills";
const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, layout);
const textBlankOf = textBlank;
const codesAt = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("Cold from Angmar", () => {
  it("09054:A:1 attaches to the main quest card and blanks the text box of a damaged character, keeping its keywords", () => {
    const t = built({ play: [] });
    const cards = new Map(t.ctx.cards);
    const sentinel = definePrinted({ code: "sen", name: "Sentinel ally", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health: 3, keywords: { sentinel: true } });
    cards.set("sen", sentinel);
    const ctx = { ...t.ctx, cards };
    const run = resolveRecords(t.state, ctx, "09054", "whenRevealed");
    const cold = idOf(run.state, "09054");
    expect(run.state.cards[cold]?.host).toBe(run.state.questStage);
    expect(run.state.cards[idOf(run.state, HERO)]?.damage).toBe(1);
    const ally = spawn(run.state, "sen", { zone: "play", seat: 0 });
    const state = settle(updateCard(ally.state, ally.id, { damage: 1 }), ctx, []);
    expect(textBlankOf(state, idOf(state, HERO), ctx.cards)).toBe(true);
    // The damaged ally's text box is blank, but Sentinel is a keyword and stays; an undamaged one is untouched.
    expect(textBlankOf(state, ally.id, ctx.cards)).toBe(true);
    expect(hasKeyword(state, ally.id, "sentinel", ctx.cards)).toBe(true);
    const bare = settle(updateCard(ally.state, ally.id, { damage: 0 }), ctx, []);
    expect(textBlankOf(bare, ally.id, ctx.cards)).toBe(false);
  });
});
