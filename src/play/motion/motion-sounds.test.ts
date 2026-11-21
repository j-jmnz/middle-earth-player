// The sounds of a state's card motions and token pops (docs/design-system-table.md, Sound): which sound each motion makes, when, and
// one of a kind a state.
import { describe, expect, it } from "vitest";

import type { CardSlot, SlotKind, SlotZone } from "../layout/layout.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { fxCues, motionCues } from "./motion-sounds.ts";
import { AT_REST, type Ghost, type Motion } from "./motion.ts";

function slot(id: string, zone: SlotZone, over: Partial<CardSlot> = {}, kind: SlotKind = "card"): CardSlot {
  return { x: 0, y: 0, w: 50, h: 70, id, code: id, zone, kind, exhausted: false, faceDown: false, landscape: false, resources: 0, damage: 0, progress: 0, tilt: 0, count: 0, committed: false, ...over };
}

const moved = (over: Partial<Motion>): Motion => ({ ...AT_REST, dx: 10, ...over });

describe("motion sounds", () => {
  it("lands a played card at the end of its glide and draws once for cards drawn together", () => {
    const slots = [slot("p", "play"), slot("h1", "hand"), slot("h2", "hand")];
    const motions = new Map([
      ["p", moved({ land: "squash", delay: 0 })],
      ["h1", moved({ arc: 18, flip: true, delay: 90 })],
      ["h2", moved({ arc: 18, flip: true, delay: 180 })],
    ]);
    expect(motionCues(motions, [], slots)).toEqual([
      { at: 90, slot: "card.draw" },
      { at: MOTION.lift.ms + MOTION.glide.ms, slot: "card.land" },
    ]);
  });

  it("turns a revealed card, deals a shadow card and turns an exhausted or readied card", () => {
    const slots = [slot("e", "staging"), slot("s", "engaged", {}, "shadow"), slot("x", "play", { exhausted: true }), slot("r", "play")];
    const motions = new Map([
      ["e", moved({ flip: true, land: "pop", delay: 40 })],
      ["s", moved({ delay: 10 })],
      ["x", { ...AT_REST, fromRot: 0, toRot: Math.PI / 2 }],
      ["r", { ...AT_REST, fromRot: Math.PI / 2, toRot: 0, delay: 5 }],
    ]);
    expect(motionCues(motions, [], slots).map((cue) => cue.slot)).toEqual(["card.exhaust", "card.ready", "dread.shadow", "card.flip"]);
  });

  it("makes no sound for a card that only shifts, and discards when a card shakes away", () => {
    const slots = [slot("a", "play")];
    const ghost = { slot: slot("g", "play"), dx: 0, dy: 0, scale: 1, rot: 0, leave: "shake" } as Ghost;
    expect(motionCues(new Map([["a", moved({})]]), [], slots)).toEqual([]);
    expect(motionCues(new Map(), [ghost], slots)).toEqual([{ at: 0, slot: "card.discard" }]);
    expect(motionCues(new Map(), [{ ...ghost, leave: "glide" }], slots)).toEqual([]);
  });

  it("pops a resource, damage or progress placed, and the removal of any token", () => {
    const fx = [
      { delta: { cardId: "a", token: "resources" as const, change: 1 }, start: 0 },
      { delta: { cardId: "b", token: "resources" as const, change: 2 }, start: 10 },
      { delta: { cardId: "c", token: "damage" as const, change: 2 }, start: 20 },
      { delta: { cardId: "d", token: "progress" as const, change: -3 }, start: 30 },
    ];
    expect(fxCues(fx)).toEqual([
      { at: 0, slot: "token.resource" },
      { at: 20, slot: "token.damage" },
      { at: 30, slot: "token.remove" },
    ]);
  });
});
