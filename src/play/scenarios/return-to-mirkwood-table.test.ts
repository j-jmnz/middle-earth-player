// Rules: sotm.guarding-gollum, rr.cannot (data/rules/entries.json); ledger lines 02126:A:1, 02130:A:1, 02131:A:1. What the table says of the player guarding Gollum: the seat that controls the Gollum card wears the hero mark on its threat dial, and its dial says it guards him and, while a card says the guard cannot change, that it cannot.
import { describe, expect, it } from "vitest";

import { first, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { guardianHeld, heldDials } from "../readouts/widgets.ts";
import { guardianHeldWords } from "../words/scenarios/guardian.ts";

const table = (layout: Layout = {}) => tableFromLayout("return-to-mirkwood", layout);
const heldOf = (layout: Layout) => {
  const made = table(layout);
  const state = syncConstants(made.state, made.ctx);
  return { guardian: guardianHeld(state), dials: heldDials(state, (code) => made.cards.get(code)?.name ?? code, (code) => made.cards.get(code)?.type === "enemy") };
};

describe("the seat guarding Gollum", () => {
  it("02126:A:1 wears the held mark and says it guards Gollum: the seat that controls him, whichever it is", () => {
    expect(heldOf({ seats: 2, play: [{ code: "02130", seat: 1 }] }).dials).toEqual([{ seat: 1, words: "Player 2 is guarding Gollum", mark: "hero" }]);
    expect(heldOf({ seats: 2, play: [{ code: "02130", seat: 0 }] }).dials).toEqual([{ seat: 0, words: "Player 1 is guarding Gollum", mark: "hero" }]);
    expect(heldOf({ play: [{ code: "02130", seat: 0 }] }).dials).toEqual([{ seat: 0, words: "You are guarding Gollum", mark: "hero" }]);
  });

  it("02130:A:2 the mark moves to the new guard when the guard changes", () => {
    const made = table({ seats: 2, play: [{ code: "02130", seat: 0 }] });
    const names = (code: string) => made.cards.get(code)?.name ?? code;
    const isEnemy = (code: string) => made.cards.get(code)?.type === "enemy";
    expect(heldDials(syncConstants(made.state, made.ctx), names, isEnemy).map((dial) => dial.seat)).toEqual([0]);
    const answer = (state: typeof made.state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === "change" || option === "seat:1") ?? state.window.options[0] ?? "") : "");
    const moved = resolveRecords(made.state, made.ctx, "02130", "forced", first(made.state, "02130"), answer);
    expect(heldDials(syncConstants(moved.state, made.ctx), names, isEnemy)).toEqual([{ seat: 1, words: "Player 2 is guarding Gollum", mark: "hero" }]);
  });

  it("02126:A:1 has no mark while nobody guards him: before Setup places him, and in any other scenario", () => {
    expect(heldOf({ seats: 2, setAside: ["02130"] }).dials).toEqual([]);
    expect(heldOf({ seats: 2 }).guardian).toEqual([]);
  });

  it("02131:A:1 says the guard cannot change while The Spiders' Ring is the active location", () => {
    const locked = heldOf({ seats: 2, play: [{ code: "02130", seat: 0 }], active: "02131" });
    expect(locked.dials[0]?.words).toBe("Player 1 is guarding Gollum, and the guard cannot change");
    expect(guardianHeldWords("you", true)).toBe("You are guarding Gollum, and the guard cannot change");
  });
});
