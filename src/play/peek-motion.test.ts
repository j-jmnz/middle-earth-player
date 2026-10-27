// The peek's slide (phase 26; docs/design-system.md, Table, Motion): what a seat's zones do when the player peeks at the other seat.
// The pure half only: where each card starts, which cards leave and which way, and the pose at a moment.
import { describe, expect, it } from "vitest";

import type { ZoneName } from "../rules/state.ts";

import type { CardSlot, Rect, SlotKind, SlotZone, TableLayout } from "./layout.ts";
import { ease } from "./motion-curves.ts";
import { ghostEnd, ghostPoseAt, motionEnd, motionSpan, poseAt } from "./motion-pose.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import { motionsBetween, seatSlot, still } from "./motion.ts";

const CARD = { w: 50, h: 70 };
const piles = {
  deck: { x: 10, y: 200, w: 50, h: 70 },
  discard: { x: 70, y: 200, w: 50, h: 70 },
  encounterDeck: { x: 400, y: 10, w: 50, h: 70 },
  encounterDiscard: { x: 460, y: 10, w: 50, h: 70 },
};
const zones = { questStage: piles.deck, staging: piles.deck, activeLocation: piles.deck, secondActiveLocation: piles.deck, engaged: piles.deck, play: piles.deck, hand: piles.deck };

function slot(id: string, zone: SlotZone, rect: Rect, over: Partial<CardSlot> = {}, kind: SlotKind = "card"): CardSlot {
  return { ...rect, id, code: id, zone, kind, exhausted: false, faceDown: false, landscape: false, resources: 0, damage: 0, progress: 0, tilt: 0, count: 0, committed: false, ...over };
}

function layout(slots: readonly CardSlot[]): TableLayout {
  return { width: 600, height: 300, card: CARD, zones, piles, slots, marks: [], attacker: null };
}

const at = (x: number, y: number): Rect => ({ x, y, ...CARD });
const nowhere = (): ZoneName | null => null;

describe("motionsBetween: a peek at the other seat (phase 26)", () => {
  // Seat 0's zones and the shared staging, then seat 1's zones under the same staging.
  const own = layout([
    slot("h1", "hand", at(100, 230)),
    slot("h2", "hand", at(150, 230)),
    slot("hero", "play", at(100, 130)),
    slot("wolf", "engaged", at(100, 60)),
    slot("shade", "engaged", at(100, 70), { faceDown: true }, "shadow"),
    slot("pile:deck", "deck", piles.deck, { count: 5 }, "pile"),
    slot("rider", "staging", at(300, 10)),
  ]);
  const other = layout([slot("g1", "hand", at(100, 230)), slot("gimli", "play", at(100, 130)), slot("pile:deck", "deck", piles.deck, { count: 3 }, "pile"), slot("rider", "staging", at(300, 10))]);

  it("slides the other seat's zones in from the side it lies on and fades them in, dealing nothing", () => {
    const { motions } = motionsBetween(own, other, nowhere, { peek: 1 });
    for (const id of ["g1", "gimli", "pile:deck"]) {
      const motion = motions.get(id);
      expect(motion?.peek, id).toBe(true);
      expect(motion?.dx, id).toBe(other.width * SHAPE.peekShift);
      expect(motion?.dy, id).toBe(0);
      expect(motion?.fromOpacity, id).toBe(0);
      expect(motion?.flip, id).toBe(false);
      expect(motion?.delay, id).toBe(0);
      expect(motion?.slide, id).toBe(false);
      expect(motion?.land, id).toBeNull();
    }
    // Staging is shared: it does not move.
    expect(still(motions.get("rider") as never)).toBe(true);
  });

  it("slides the seat that was shown off the other way, face-down shadow cards with it, and leaves the shared cards", () => {
    const { ghosts } = motionsBetween(own, other, nowhere, { peek: 1 });
    expect(ghosts.map((ghost) => ghost.slot.id).sort()).toEqual(["h1", "h2", "hero", "shade", "wolf"]);
    for (const ghost of ghosts) {
      expect(ghost.leave, ghost.slot.id).toBe("peek");
      expect(ghost.dx, ghost.slot.id).toBe(-own.width * SHAPE.peekShift);
      expect(ghost.dy).toBe(0);
    }
  });

  it("reverses going back: the zones come in from the left and the seat peeked at leaves to the right", () => {
    const back = motionsBetween(other, own, nowhere, { peek: -1 });
    expect(back.motions.get("h1")?.dx).toBe(-own.width * SHAPE.peekShift);
    expect(back.ghosts.every((ghost) => ghost.dx === other.width * SHAPE.peekShift)).toBe(true);
    expect(back.ghosts.map((ghost) => ghost.slot.id).sort()).toEqual(["g1", "gimli"]);
  });

  it("is not the seat handoff: nothing rises, nothing fades in on its own clock, nothing is dealt", () => {
    const peek = motionsBetween(own, other, nowhere, { peek: 1 }).motions.get("g1");
    const handoff = motionsBetween(own, other, nowhere, { handoff: true }).motions.get("g1");
    expect(peek?.slide).toBe(false);
    expect(handoff?.slide).toBe(true);
    expect(handoff?.peek).toBe(false);
    expect(peek?.dy).toBe(0);
    expect(handoff?.dy).toBeGreaterThan(0);
  });

  it("is not a peek when the shown seat did not change: no option, the ordinary draw", () => {
    const { motions } = motionsBetween(own, other, nowhere);
    expect(motions.get("g1")?.peek).toBe(false);
    expect(motions.get("g1")?.flip).toBe(true);
  });

  it("is no motion under reduced motion (no previous layout): everything stands where it is", () => {
    const { motions, ghosts } = motionsBetween(null, other, nowhere);
    expect(ghosts).toEqual([]);
    for (const motion of motions.values()) expect(still(motion)).toBe(true);
  });

  it("takes 250 ms each way at Normal, 0.6 of it at Quick, and arrives at rest", () => {
    const { motions, ghosts } = motionsBetween(own, other, nowhere, { peek: 1 });
    const incoming = motions.get("g1");
    const outgoing = ghosts[0];
    if (!incoming || !outgoing) throw new Error("no motion");
    expect(motionEnd(incoming)).toBe(250);
    expect(ghostEnd(outgoing)).toBe(250);
    expect(motionSpan({ motions, ghosts })).toBe(250);
    expect(MOTION.peekSlide).toEqual({ ms: 250, easing: "outCubic" });
    expect(MOTION.peekLeave).toEqual({ ms: 250, easing: "inCubic" });
    for (const k of [1, 0.6]) {
      const run = 250 * k;
      expect(poseAt(incoming, 0, k).dx).toBe(incoming.dx);
      expect(poseAt(incoming, 0, k).opacity).toBe(0);
      const mid = poseAt(incoming, run / 2, k);
      expect(mid.dx).toBeCloseTo(incoming.dx * (1 - ease("outCubic", 0.5)), 6);
      expect(mid.dx).toBeLessThan(incoming.dx / 2);
      expect(mid.opacity).toBeCloseTo(0.5, 6);
      const done = poseAt(incoming, run, k);
      expect(done.dx).toBe(0);
      expect(done.opacity).toBe(1);
      const start = ghostPoseAt(outgoing, 0, k);
      expect(start.dx).toBeCloseTo(0, 9);
      expect(start.opacity).toBe(1);
      const away = ghostPoseAt(outgoing, run / 2, k);
      expect(away.dx).toBeCloseTo(outgoing.dx * ease("inCubic", 0.5), 6);
      expect(Math.abs(away.dx)).toBeLessThan(Math.abs(outgoing.dx) / 2);
      const gone = ghostPoseAt(outgoing, run, k);
      expect(gone.dx).toBe(outgoing.dx);
      expect(gone.opacity).toBe(0);
    }
    // Under reduced motion no motion is made at all (card-motion.native.tsx): the layout is drawn at rest, as the test above shows.
  });

  it("names the seat's own zones and no shared one", () => {
    const zonesOf = (zone: SlotZone) => seatSlot(slot("x", zone, at(0, 0)));
    for (const zone of ["hand", "play", "engaged", "deck", "discard"] as const) expect(zonesOf(zone), zone).toBe(true);
    for (const zone of ["questStage", "staging", "activeLocation", "secondActiveLocation", "encounterDeck", "encounterDiscard"] as const) expect(zonesOf(zone), zone).toBe(false);
  });
});
