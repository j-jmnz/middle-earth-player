// Rules: rr.damage, rr.forced, rr.removed-from-game, rr.cannot (data/rules/entries.json); ledger lines 02064:A:3, 02061:B:2, 900608:A:2.
// How one heal effect is shaped: the flag healCapPerEffect, the flag healReducedToOne (and the Athelas heals it leaves alone), the cannotBeHealed that every heal reads, and the card whose effect healed, named by the healed event.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { healDamage } from "../dreamchaser/heal-cap.ts";

import { PLAY_CARDS, put, seat } from "./fixture.ts";

const WILYADOR: PickSpec = { type: "ally", control: "any", names: ["Wilyador"] };
// The record that hears a heal of Wilyador and removes the card that healed (02061:B:2), on a stand-in card in play.
const REMOVES: Effect = { id: "marker:forced:1", cardCode: "marker", lines: ["02061:B:2"], timing: "forced", trigger: "healed", subject: WILYADOR, instructions: [{ verb: "RemoveFromGame", card: "other" }] };
const extra = [
  definePrinted({ code: "marker", name: "Marker", type: "quest", questPoints: 1 }),
  definePrinted({ code: "athelas", name: "Athelas", type: "attachment", sphere: "lore", cost: 0 }),
  definePrinted({ code: "noxious", name: "Noxious Supplies", type: "treachery" }),
];
const ctx = { effects: [REMOVES], cards: new Map([...PLAY_CARDS, ...extra.map((card) => [card.code, card] as const)]) };

function frame(state: ScenarioState, instructions: readonly Instruction[], sourceId: string): ScenarioState {
  return settle(pushEffectFrame({ ...state, window: null, mode: "stopped" }, { frame: "whenRevealed", sourceId, actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions, cancel: null, blockCancel: null }, []), ctx, []);
}

// Wilyador with 8 damage in the first player's play area, a card that heals in the discard pile and the marker that hears heals.
function held(extra: (state: ScenarioState, wilyador: string) => ScenarioState = (state) => state) {
  const base = seat(1, ["dwarf"]).state;
  const wil = put(base, "wil", "play");
  const marker = put(updateCard(wil.state, wil.id, { damage: 8 }), "marker", "staging");
  const healer = put(marker.state, "filler", "hand");
  return { state: extra(healer.state, wil.id), wilyador: wil.id, healer: healer.id };
}
const mod = (id: string, source: string, stat: "healCapPerEffect" | "healReducedToOne", amount: number) => ({ instanceId: id, sourceId: source, stat, amount, until: "endOfGame" as const });
const HEAL = (athelas = false): Instruction[] => [{ verb: "Pick", pick: WILYADOR }, { verb: "Heal", amount: 8, target: "picked", ...(athelas ? { athelas: true as const } : {}) }];

describe("02064:A:3 healCapPerEffect", () => {
  it("02064:A:3 takes at most the cap off with one heal effect, and the next heal effect takes its own", () => {
    const { state, wilyador, healer } = held((base, wil) => ({ ...base, modifiers: [...base.modifiers, mod(wil, wil, "healCapPerEffect", 5)] }));
    const once = frame(state, HEAL(), healer);
    expect(once.cards[wilyador]?.damage).toBe(3);
    const twice = frame(once, HEAL(), healer);
    expect(twice.cards[wilyador]?.damage).toBe(0);
  });
});

describe("900608:A:2 healReducedToOne", () => {
  const reduced = () => held((base, wil) => {
    const noxious = put(base, "noxious", "staging");
    return { ...noxious.state, modifiers: [...noxious.state.modifiers, mod(wil, noxious.id, "healReducedToOne", 1)] };
  });

  it("900608:A:2 heals 1 whatever the amount and discards the attachment that reduced it", () => {
    const { state, wilyador, healer } = reduced();
    const noxious = Object.values(state.cards).find((card) => card.code === "noxious")!.id;
    const healed = frame(state, HEAL(), healer);
    expect(healed.cards[wilyador]?.damage).toBe(7);
    expect(healed.cards[noxious]?.zone).not.toBe("staging");
  });

  it("900608:A:2 leaves a heal of 1 at 1 and still discards it", () => {
    const { state, wilyador, healer } = reduced();
    const noxious = Object.values(state.cards).find((card) => card.code === "noxious")!.id;
    const healed = frame(state, [{ verb: "Pick", pick: WILYADOR }, { verb: "Heal", amount: 1, target: "picked" }], healer);
    expect(healed.cards[wilyador]?.damage).toBe(7);
    expect(healed.cards[noxious]?.zone).not.toBe("staging");
  });

  it("900608:A:2 does not reduce an Athelas heal, the final stage's included, and keeps the attachment", () => {
    const { state, wilyador, healer } = reduced();
    const noxious = Object.values(state.cards).find((card) => card.code === "noxious")!.id;
    const healed = frame(state, HEAL(true), healer);
    expect(healed.cards[wilyador]?.damage).toBe(0);
    expect(healed.cards[noxious]?.zone).toBe("staging");
  });

  it("900608:A:2 does not reduce a heal by a card named Athelas", () => {
    const { state, wilyador } = reduced();
    const athelas = put(state, "athelas", "hand");
    const healed = frame(athelas.state, HEAL(), athelas.id);
    expect(healed.cards[wilyador]?.damage).toBe(0);
  });

  it("900608:A:2 reduces nothing when there is no damage to heal and the attachment stays", () => {
    const { state, wilyador, healer } = reduced();
    const clean = updateCard(state, wilyador, { damage: 0 });
    expect(frame(clean, HEAL(), healer).cards[Object.values(clean.cards).find((card) => card.code === "noxious")!.id]?.zone).toBe("staging");
  });
});

describe("cannotBeHealed", () => {
  it("02065:A:2 is read by every heal, the quiet ones too", () => {
    const { state, wilyador } = held((base, wil) => ({ ...base, modifiers: [...base.modifiers, { instanceId: wil, sourceId: wil, stat: "cannotBeHealed" as const, amount: 1, until: "endOfGame" as const }] }));
    expect(healDamage(state, wilyador, 3, ctx).healed).toBe(0);
  });
});

describe("02061:B:2 the card whose effect healed", () => {
  it("02061:B:2 leaves the game wherever it lies: an event in the hand being played", () => {
    const { state, healer, wilyador } = held();
    const healed = frame(state, HEAL(), healer);
    expect(healed.cards[wilyador]?.damage).toBe(0);
    expect(healed.cards[healer]?.zone).toBe("removed");
  });

  it("02061:B:2 does nothing when nothing was healed", () => {
    const { state, healer, wilyador } = held();
    const none = frame(updateCard(state, wilyador, { damage: 0 }), HEAL(), healer);
    expect(none.cards[healer]?.zone).not.toBe("removed");
  });
});
