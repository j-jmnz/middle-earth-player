import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { hero, table } from "../defense/table.ts";

// Rules: dwd.cave-torch-the-long-dark, rr.attachment-cards, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 03064:A:1 (docs/brief.md, Into the Pit).
// AttachSetAside with `removeWhenLeaving`: "If Cave Torch would leave play, then it is removed from the game": the Torch the Setup attaches goes to no pile, whether it is discarded or its hero leaves play.

const torch = definePrinted({ code: "torch", name: "Cave Torch", type: "attachment" });
const focus = { seat: 0, sourceId: null };

function attached(removeWhenLeaving: boolean) {
  const built = table({ cards: [hero("h"), torch], effects: [], heroes: [{ code: "h" }] });
  const aside = spawn(built.state, "torch", { zone: "setAside" }).state;
  const picked = { ...aside, stack: [{ frame: "effect", cardId: null, seat: 0, step: 0, peril: false, data: { kind: "effect", picked: [built.ids.h!], returned: 0 } }] } as never;
  const next = runInstruction(picked, { verb: "AttachSetAside", code: "torch", ...(removeWhenLeaving ? { removeWhenLeaving: true as const } : {}) }, focus, built.ctx, []);
  const id = Object.values(next.cards).find((card) => card.code === "torch")!.id;
  return { state: next, id, heroId: built.ids.h! };
}

describe("AttachSetAside removeWhenLeaving (03064:A:1)", () => {
  it("attaches the set-aside copy to the picked hero", () => {
    const { state, id, heroId } = attached(true);
    expect([state.cards[id]?.zone, state.cards[id]?.host]).toEqual(["play", heroId]);
  });

  it("removes the card from the game when it is discarded from play", () => {
    const { state, id } = attached(true);
    expect(moveCard(state, id, { zone: "encounterDiscard" }).cards[id]?.zone).toBe("removed");
  });

  it("removes it when its hero leaves play", () => {
    const { state, id, heroId } = attached(true);
    expect(moveCard(state, heroId, { zone: "discard", seat: 0 }).cards[id]?.zone).toBe("removed");
  });

  it("leaves a copy attached without the option an ordinary card: it is discarded", () => {
    const { state, id } = attached(false);
    expect(moveCard(state, id, { zone: "encounterDiscard" }).cards[id]?.zone).toBe("encounterDiscard");
  });
});
