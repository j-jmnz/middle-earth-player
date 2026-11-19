// Rules: rr.shadow-effects, rr.defending-player, rr.player-elimination (data/rules/entries.json); ledger lines 00001:A:3, 00012:A:3, 00015:A:2, 00018:B:3.
// The Massing at Osgiliath's choices on the live sheet: each record opens a real window (the effect frame the engine builds), and the sheet says what the choice holds now and cautions before a row that can end the game (Choice tray).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { idsOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { sheetFor } from "./sheets.ts";

const WITCH_KING = "00001";
const CUT_OFF = "00012";
const RANGER = "00015";
const CROSSING = "00018";

// The record of the card with this timing, pushed on its own frame and settled until the engine opens its window: the live sheet. `attack` makes an attack in progress, defended or not (the Shadow cards' windows).
function sheetOf(layout: Layout, code: string, timing: Effect["timing"], frame: "forced" | "shadow", attack?: "defended" | "undefended") {
  const made = tableFromLayout("the-massing-at-osgiliath", { seats: 2, phase: "Combat", ...layout });
  const [source] = idsOf(made.state, code);
  if (source == null) throw new Error(`no ${code} on the table`);
  const enemy = Object.values(made.state.cards).find((card) => card.zone === "staging" || card.zone === "engaged");
  const base: ScenarioState = attack && enemy ? { ...made.state, pendingAttack: { enemyId: enemy.id, seat: 0, ...(attack === "defended" ? { defenderId: made.hero } : {}) } } : made.state;
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).map((effect) => ({ ...effect, condition: undefined }) as Effect);
  const pushed = pushCardEffects(base, frame, source, base.firstPlayer, false, effects, made.ctx, []);
  const state = settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, []);
  const names = { card: (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
}
const rows = (sheet: ReturnType<typeof sheetOf>) => Object.fromEntries(sheet.options.map((option) => [option.id, "caution" in option ? option.caution : undefined]));

describe("the Witch-king's choice (00001:A:3)", () => {
  it("00001:A:3 cautions that raising the threat eliminates the player when it takes it to 50, and not otherwise", () => {
    const near = sheetOf({ staging: [WITCH_KING], threat: [47, 28] }, WITCH_KING, "forced", "forced");
    expect(rows(near)).toEqual({ threat: "Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost", staging: undefined });
    const far = sheetOf({ staging: [WITCH_KING], threat: [46, 28] }, WITCH_KING, "forced", "forced");
    expect(rows(far)).toEqual({ threat: undefined, staging: undefined });
  });
});

describe("Cut Off's shadow choice (00012:A:3)", () => {
  // The stand-in ally (scene kit) fills the hand `count` times.
  const cutOff = (count: number, attack: "defended" | "undefended") => sheetOf({ staging: [WITCH_KING], engaged: [{ code: CUT_OFF, seat: 0 }], hand: Array.from({ length: count }, () => "ally") }, CUT_OFF, "shadow", "shadow", attack);

  it("00012:A:3 says the number of ally cards it asks for the attack, and offers the matching rows", () => {
    const defended = cutOff(1, "defended");
    expect(defended.note).toBe("Player 1: Cut Off: discard 1 ally card from your hand, or the attacking enemy gets +3 Attack.");
    expect(defended.options.map((option) => option.id)).toEqual(["discard", "attack"]);
    const undefended = cutOff(2, "undefended");
    expect(undefended.note).toBe("Player 1: Cut Off: discard 2 ally cards from your hand (the attack is undefended), or the attacking enemy gets +3 Attack.");
    expect(undefended.options.map((option) => option.id)).toEqual(["discardTwo", "attack"]);
  });
});

describe("Ranger of Ithilien's shadow choice (00015:A:2)", () => {
  it("00015:A:2 names the Ranger and the enemy it dealt damage to, not 'it' for both", () => {
    const sheet = sheetOf({ staging: [WITCH_KING], engaged: [{ code: RANGER, seat: 0 }], play: [] }, RANGER, "shadow", "shadow", "defended");
    expect(sheet.note).toBe("Player 1: Ranger of Ithilien dealt 2 damage to the attacking enemy. Exhaust a ready character you control to take control of the Ranger, or it is discarded.");
  });
});

describe("Anduin Crossing's cost (00018:B:3)", () => {
  // Seat 1 has one hero. The Forced asks seat 0 first (two heroes), then seat 1.
  it("00018:B:3 cautions on the hero row only for the player whose last hero it is (a pick is asked only with two heroes or more, so it never cautions)", () => {
    const made = tableFromLayout("the-massing-at-osgiliath", { seats: 2, phase: "Quest", stage: CROSSING });
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === CROSSING && effect.timing === "forced").map((effect) => ({ ...effect, condition: undefined }) as Effect);
    const [source] = idsOf(made.state, CROSSING);
    const pushed = pushCardEffects(made.state, "forced", source ?? "", 0, false, effects, made.ctx, []);
    let state = settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, []);
    const names = { card: (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const open = () => {
      const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
      if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
      return sheet;
    };
    const answer = (action: Parameters<typeof reduce>[1]) => {
      const done = reduce(state, action, made.ctx);
      if (!done.ok) throw new Error(`refused: ${JSON.stringify(action)}`);
      state = done.state;
    };
    const LOST = "Tap again: this is your last hero, and discarding it eliminates you. If you are the last player, the game is lost";
    expect(rows(open())).toMatchObject({ hero: undefined });
    answer({ type: "Choose", optionId: "none" });
    expect(rows(open())).toMatchObject({ hero: LOST });
  });
});
