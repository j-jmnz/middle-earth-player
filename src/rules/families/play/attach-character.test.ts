// Rules: rr.attachment-cards, rr.first-player, rr.traits (data/rules/entries.json); ledger lines 900607:A:2, 900608:A:2, 02061:B:1.
// AttachSelf to a character (`to.kind: "character"`): any player's hero or ally, with a Trait or by title, chosen by the first player; one copy for each character unless `unlimited`; with none to carry it the card is discarded. And PlaceDamage with a read amount.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

import { PLAY_CARDS, put, seat } from "./fixture.ts";

const ctx = { effects: [], cards: new Map([...PLAY_CARDS, ["shot", definePrinted({ code: "shot", name: "Shot", type: "treachery" })] as const]) };

function reveal(state: ScenarioState, sourceId: string, instructions: readonly Instruction[]): ScenarioState {
  return settle(pushEffectFrame({ ...state, window: null, mode: "stopped" }, { frame: "whenRevealed", sourceId, actor: 0, peril: false, effectId: "shot:whenRevealed:1", instructions, cancel: null, blockCancel: null }, []), ctx, []);
}

// Two seats, a hero each (Dain, no Eagle), and an Eagle ally (Landroval) in the second seat's play area.
function table() {
  const made = seat(2, ["dwarf"]);
  const eagle = put(made.state, "02053", "play", 1);
  const wil = put(eagle.state, "wil", "play", 0);
  const shot = put(wil.state, "shot", "staging");
  return { state: shot.state, eagle: eagle.id, wil: wil.id, shot: shot.id, heroes: made.heroes };
}

describe("900607:A:2 AttachSelf to an Eagle character", () => {
  it("900607:A:2 is chosen by the first player among every Eagle character, and goes on the only one without asking", () => {
    const { state, shot, eagle, wil } = table();
    const both = reveal(state, shot, [{ verb: "AttachSelf", to: { kind: "character", trait: "Eagle" } }]);
    expect(both.window?.kind).toBe("choose");
    expect(both.window?.kind === "choose" ? [...both.window.options].sort() : []).toEqual([eagle, wil].sort());
    const only = reveal(moveCard(state, wil, { zone: "discard", seat: 0 }), shot, [{ verb: "AttachSelf", to: { kind: "character", trait: "Eagle" } }]);
    expect(only.cards[shot]).toMatchObject({ zone: "attached", host: eagle });
  });

  it("900607:A:2 does not offer a character that carries a copy already (Limit 1 per character)", () => {
    const { state, shot, eagle, wil } = table();
    const second = put(state, "shot", "staging");
    const first = reveal(moveCard(second.state, wil, { zone: "discard", seat: 0 }), shot, [{ verb: "AttachSelf", to: { kind: "character", trait: "Eagle" } }]);
    const again = reveal(first, second.id, [{ verb: "AttachSelf", to: { kind: "character", trait: "Eagle" } }]);
    expect(first.cards[shot]?.host).toBe(eagle);
    // Wilyador was set aside in the first run, so the second copy has no host left and is discarded.
    expect(again.cards[second.id]?.zone).not.toBe("attached");
  });
});

describe("900608:A:2 AttachSelf to a named character, any number of copies", () => {
  it("900608:A:2 attaches every copy to Wilyador, and a character of another title is not offered", () => {
    const { state, shot, wil } = table();
    const second = put(state, "shot", "staging");
    const instruction: Instruction = { verb: "AttachSelf", to: { kind: "character", name: "Wilyador", unlimited: true } };
    const once = reveal(second.state, shot, [instruction]);
    const twice = reveal(once, second.id, [instruction]);
    expect([once.cards[shot]?.host, twice.cards[second.id]?.host]).toEqual([wil, wil]);
  });

  it("900608:A:2 does the same without the unlimited flag only once", () => {
    const { state, shot, wil } = table();
    const second = put(state, "shot", "staging");
    const instruction: Instruction = { verb: "AttachSelf", to: { kind: "character", name: "Wilyador" } };
    const twice = reveal(reveal(second.state, shot, [instruction]), second.id, [instruction]);
    expect(twice.cards[shot]?.host).toBe(wil);
    expect(twice.cards[second.id]?.host).not.toBe(wil);
  });
});

describe("02061:B:1 PlaceDamage with a read amount", () => {
  it("02061:B:1 places the number of players in damage tokens on the card, none of it dealt", () => {
    const { state, shot, wil } = table();
    const placed = reveal(state, shot, [{ verb: "Pick", pick: { type: "character", control: "any", names: ["Wilyador"] } }, { verb: "PlaceDamage", amount: { players: true }, card: "picked" }]);
    expect(placed.cards[wil]?.damage).toBe(2);
  });
});
