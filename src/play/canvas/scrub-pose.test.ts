// The pose of a hand card while the scrub runs (phase 25; the bigger grow, and no wave, user request, 2026-10-29).
import { describe, expect, it } from "vitest";

import { SHAPE } from "../../ui/motion-tokens.ts";
import { scrubPose, type ScrubRoom } from "./scrub-pose.ts";

const slot = { x: 100, y: 300, w: 60, h: 84, tilt: 0.06 };
const target = { x: 40, y: 200, w: 90, h: 126, tilt: -0.14 };
const room: ScrubRoom = { left: 8, right: 836, top: 8, lift: SHAPE.scrubLiftScale };

// The card's rectangle (unturned) once posed.
function posed(pose: { dx: number; dy: number; scale: number }, from = slot) {
  const w = from.w * pose.scale;
  const h = from.h * pose.scale;
  const cx = from.x + from.w / 2 + pose.dx;
  const cy = from.y + from.h / 2 + pose.dy;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

describe("scrubPose", () => {
  it("is the layout's place at progress 0", () => {
    const pose = scrubPose(slot, target, { rise: 0, apart: 0, lift: 0 }, false, room);
    expect([pose.dx + 0, pose.dy + 0, pose.scale, pose.rot + 0]).toEqual([0, 0, 1, 0]);
  });

  it("is the spread's place at progress 1: centered on the target, at its size, at the fan's angle", () => {
    const pose = scrubPose(slot, target, { rise: 1, apart: 1, lift: 0 }, false, room);
    expect(slot.x + slot.w / 2 + pose.dx).toBeCloseTo(target.x + target.w / 2, 9);
    expect(slot.y + slot.h / 2 + pose.dy).toBeCloseTo(target.y + target.h / 2, 9);
    expect(slot.w * pose.scale).toBeCloseTo(target.w, 9);
    expect(pose.rot + slot.tilt).toBeCloseTo(target.tilt, 9);
  });

  it("rises and spreads on their own clocks", () => {
    const rising = scrubPose(slot, target, { rise: 1, apart: 0, lift: 0 }, false, room);
    expect(rising.dx + 0).toBe(0);
    expect(rising.dy).toBeLessThan(0);
    const spreading = scrubPose(slot, target, { rise: 0, apart: 1, lift: 0 }, false, room);
    expect(spreading.dy + 0).toBe(0);
    expect(spreading.dx).toBeLessThan(0);
    expect(spreading.scale).toBe(1);
  });

  it("lifts the card under the finger 1.55 larger, grown from its foot, its foot a quarter of its height higher", () => {
    const rest = scrubPose(slot, target, { rise: 1, apart: 1, lift: 0 }, false, room);
    const lifted = scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, true, room);
    expect(lifted.scale / rest.scale).toBeCloseTo(SHAPE.scrubLiftScale, 9);
    const before = posed(rest);
    const after = posed(lifted);
    expect(before.y + before.h - (after.y + after.h)).toBeCloseTo(target.h * SHAPE.scrubLiftRise, 9);
    // The lifted card straightens so it can be read; the others keep the fan's angle.
    expect(lifted.rot + slot.tilt).toBeCloseTo(0, 9);
    expect(rest.rot + slot.tilt).toBeCloseTo(target.tilt, 9);
  });

  it("leaves the cards beside the lifted one at the spread's size", () => {
    const rest = scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, false, room);
    expect(rest.scale * slot.w).toBeCloseTo(target.w, 9);
  });

  it("settles the card the finger left from its lift over the drop clock, down to the spread's size", () => {
    const clock = { rise: 1, apart: 1, lift: 1 };
    const lifted = scrubPose(slot, target, clock, true, room);
    const rest = scrubPose(slot, target, clock, false, room);
    expect(scrubPose(slot, target, clock, false, room, 1).scale).toBeCloseTo(lifted.scale, 9);
    expect(scrubPose(slot, target, clock, false, room, 0)).toEqual(rest);
    const half = scrubPose(slot, target, clock, false, room, 0.5).scale;
    expect(half).toBeLessThan(lifted.scale);
    expect(half).toBeGreaterThan(rest.scale);
  });

  it("keeps a grown end card inside the room, and its foot under the top edge's reach", () => {
    const edge = { ...target, x: 2 };
    const pose = scrubPose(slot, edge, { rise: 1, apart: 1, lift: 1 }, true, room);
    expect(posed(pose).x).toBeGreaterThanOrEqual(room.left - 1e-9);
    // A hand risen near the top: spreadLayout grows the lifted card no taller than the room above its foot, and its foot stays put.
    const high = { ...target, y: 20 };
    const capped = scrubPose(slot, high, { rise: 1, apart: 1, lift: 1 }, true, { ...room, lift: (high.y + high.h - room.top) / high.h });
    expect(posed(capped).y).toBeCloseTo(room.top, 9);
  });

  it("lifts nothing while the hand is down, whatever the lift clock says", () => {
    expect(scrubPose(slot, target, { rise: 0, apart: 0, lift: 1 }, true, room)).toEqual(scrubPose(slot, target, { rise: 0, apart: 0, lift: 0 }, true, room));
  });
});
