// The pose of a hand card while the scrub runs (phase 25; the bigger grow and its falloff, user request, 2026-10-29).
import { describe, expect, it } from "vitest";

import { SHAPE } from "./motion-tokens.ts";
import { magnify, scrubPose, type ScrubRoom } from "./scrub-pose.ts";

const slot = { x: 100, y: 300, w: 60, h: 84, tilt: 0.06 };
const target = { x: 40, y: 200, w: 90, h: 126, tilt: -0.14 };
const room: ScrubRoom = { left: 8, right: 836, top: 8, lift: SHAPE.scrubLiftScale };
const NONE = -1;

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
    const pose = scrubPose(slot, target, { rise: 0, apart: 0, lift: 0 }, NONE, room);
    expect([pose.dx + 0, pose.dy + 0, pose.scale, pose.rot + 0]).toEqual([0, 0, 1, 0]);
  });

  it("is the spread's place at progress 1: centered on the target, at its size, at the fan's angle", () => {
    const pose = scrubPose(slot, target, { rise: 1, apart: 1, lift: 0 }, NONE, room);
    expect(slot.x + slot.w / 2 + pose.dx).toBeCloseTo(target.x + target.w / 2, 9);
    expect(slot.y + slot.h / 2 + pose.dy).toBeCloseTo(target.y + target.h / 2, 9);
    expect(slot.w * pose.scale).toBeCloseTo(target.w, 9);
    expect(pose.rot + slot.tilt).toBeCloseTo(target.tilt, 9);
  });

  it("rises and spreads on their own clocks", () => {
    const rising = scrubPose(slot, target, { rise: 1, apart: 0, lift: 0 }, NONE, room);
    expect(rising.dx + 0).toBe(0);
    expect(rising.dy).toBeLessThan(0);
    const spreading = scrubPose(slot, target, { rise: 0, apart: 1, lift: 0 }, NONE, room);
    expect(spreading.dy + 0).toBe(0);
    expect(spreading.dx).toBeLessThan(0);
    expect(spreading.scale).toBe(1);
  });

  it("lifts the card under the finger 1.55 larger, grown from its foot, its foot a quarter of its height higher", () => {
    const rest = scrubPose(slot, target, { rise: 1, apart: 1, lift: 0 }, NONE, room);
    const lifted = scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, 0, room);
    expect(lifted.scale / rest.scale).toBeCloseTo(SHAPE.scrubLiftScale, 9);
    const before = posed(rest);
    const after = posed(lifted);
    expect(before.y + before.h - (after.y + after.h)).toBeCloseTo(target.h * SHAPE.scrubLiftRise, 9);
    // The lifted card straightens so it can be read; the others keep the fan's angle.
    expect(lifted.rot + slot.tilt).toBeCloseTo(0, 9);
    expect(rest.rot + slot.tilt).toBeCloseTo(target.tilt, 9);
  });

  it("grows the neighbours a little from their feet, 1.15 then 1.05, and leaves the rest alone", () => {
    const rest = scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, NONE, room);
    for (const [distance, grow] of [[1, SHAPE.scrubNear], [2, SHAPE.scrubNearer], [3, 1], [7, 1]] as const) {
      const pose = scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, distance, room);
      expect(pose.scale / rest.scale, `${distance}`).toBeCloseTo(grow, 9);
      const before = posed(rest);
      const after = posed(pose);
      expect(after.y + after.h, `${distance}`).toBeCloseTo(before.y + before.h, 9);
      expect(pose.rot).toBeCloseTo(rest.rot, 9);
    }
    expect([magnify(0, 1.4), magnify(1, 1.4), magnify(2, 1.4), magnify(3, 1.4), magnify(-1, 1.4)]).toEqual([1.4, SHAPE.scrubNear, SHAPE.scrubNearer, 1, 1]);
  });

  it("falls off smoothly as the finger slides: 1.15 within a card, 1.05 at two, none past about 2.2", () => {
    let before = Infinity;
    for (let d = 0.5; d <= 3; d += 0.05) {
      const grow = magnify(d, SHAPE.scrubLiftScale);
      expect(grow).toBeLessThanOrEqual(before + 1e-12);
      before = grow;
    }
    expect(magnify(0.7, SHAPE.scrubLiftScale)).toBeCloseTo(SHAPE.scrubNear, 9);
    expect(magnify(2, SHAPE.scrubLiftScale)).toBeCloseTo(SHAPE.scrubNearer, 9);
    expect(magnify(2.3, SHAPE.scrubLiftScale)).toBe(1);
    // Never past the lifted card's own grow.
    expect(magnify(1, 1.1)).toBe(1.1);
  });

  it("settles the card the finger left from its lift over the drop clock, down to its neighbour's grow", () => {
    const clock = { rise: 1, apart: 1, lift: 1 };
    const lifted = scrubPose(slot, target, clock, 0, room);
    const neighbour = scrubPose(slot, target, clock, 1, room);
    expect(scrubPose(slot, target, clock, 1, room, 1).scale).toBeCloseTo(lifted.scale, 9);
    expect(scrubPose(slot, target, clock, 1, room, 0)).toEqual(neighbour);
    const half = scrubPose(slot, target, clock, 1, room, 0.5).scale;
    expect(half).toBeLessThan(lifted.scale);
    expect(half).toBeGreaterThan(neighbour.scale);
  });

  it("keeps a grown end card inside the room, and its foot under the top edge's reach", () => {
    const edge = { ...target, x: 2 };
    const pose = scrubPose(slot, edge, { rise: 1, apart: 1, lift: 1 }, 0, room);
    expect(posed(pose).x).toBeGreaterThanOrEqual(room.left - 1e-9);
    // A hand risen near the top: spreadLayout grows the lifted card no taller than the room above its foot, and its foot stays put.
    const high = { ...target, y: 20 };
    const capped = scrubPose(slot, high, { rise: 1, apart: 1, lift: 1 }, 0, { ...room, lift: (high.y + high.h - room.top) / high.h });
    expect(posed(capped).y).toBeCloseTo(room.top, 9);
  });

  it("lifts nothing while the hand is down, whatever the lift clock says", () => {
    expect(scrubPose(slot, target, { rise: 0, apart: 0, lift: 1 }, 0, room)).toEqual(scrubPose(slot, target, { rise: 0, apart: 0, lift: 0 }, 0, room));
    expect(scrubPose(slot, target, { rise: 0, apart: 0, lift: 1 }, 1, room)).toEqual(scrubPose(slot, target, { rise: 0, apart: 0, lift: 0 }, NONE, room));
  });
});
