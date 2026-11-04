// Card motion (phase 23; docs/design-system-table.md, Motion): what each card does when the table changes. The pure half only:
// where a card starts, whether it flips, how long it waits, how high it rises, how it lands.
import { describe, expect, it } from "vitest";

import type { ZoneName } from "../../rules/core/state.ts";

import type { CardSlot, Rect, SlotKind, SlotZone, TableLayout } from "../layout/layout.ts";
import { ease } from "./curves.ts";
import { ghostEnd, ghostPoseAt, landAt, motionEnd, motionSpan, poseAt } from "./pose.ts";
import { MOTION, SHAPE } from "../../ui/motion-tokens.ts";
import { motionsBetween, still } from "./motion.ts";

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

describe("motionsBetween: draw", () => {
  const before = layout([slot("h1", "hand", at(100, 230))]);
  const after = layout([slot("h1", "hand", at(90, 230)), slot("h2", "hand", at(150, 230)), slot("h3", "hand", at(210, 230)), slot("h4", "hand", at(270, 230))]);
  const { motions } = motionsBetween(before, after, nowhere);

  it("sends the cards drawn together out one after another, 90 ms apart", () => {
    const delays = ["h2", "h3", "h4"].map((id) => motions.get(id)?.delay);
    expect(delays).toEqual([0, 90, 180]);
    expect(MOTION.stagger.ms).toBe(90);
  });

  it("flips a drawn card, which starts at the deck and rises on an arc", () => {
    const drawn = motions.get("h2");
    expect(drawn?.flip).toBe(true);
    expect(drawn?.arc).toBe(24);
    // Its offset is the deck's center from its own slot's.
    expect(drawn?.dx).toBe(35 - 175);
    expect(drawn?.dy).toBe(235 - 265);
  });

  it("leaves a card that was in the hand where it was, not flipped and not waiting", () => {
    const kept = motions.get("h1");
    expect(kept?.flip).toBe(false);
    expect(kept?.delay).toBe(0);
    expect(kept?.land).toBeNull();
  });

  it("caps how long a long draw waits", () => {
    const hand = Array.from({ length: 9 }, (_, index) => slot(`d${index}`, "hand", at(index * 40, 230)));
    const { motions: many } = motionsBetween(before, layout(hand), nowhere);
    const delays = hand.map((card) => many.get(card.id)?.delay ?? 0);
    expect(Math.max(...delays)).toBe(SHAPE.maxStagger * 90);
  });
});

describe("motionsBetween: the encounter deck", () => {
  const before = layout([slot("e1", "staging", at(120, 20))]);
  const after = layout([slot("e1", "staging", at(120, 20)), slot("e2", "staging", at(180, 20)), slot("s1", "engaged", at(300, 100), { faceDown: true }, "shadow")]);
  const { motions } = motionsBetween(before, after, nowhere);

  it("flips a revealed encounter card and has it pop", () => {
    const revealed = motions.get("e2");
    expect(revealed?.flip).toBe(true);
    expect(revealed?.land).toBe("pop");
    expect(revealed?.dx).toBe(425 - 205);
  });

  it("deals a shadow card face down: it never flips", () => {
    const shadow = motions.get("s1");
    expect(shadow?.flip).toBe(false);
    expect(shadow?.land).toBeNull();
    expect(shadow?.dx).not.toBe(0);
  });

  it("leaves a card already in staging still", () => {
    expect(still(motions.get("e1") as never)).toBe(true);
  });
});

describe("motionsBetween: play and turn", () => {
  const before = layout([slot("a", "hand", at(100, 240)), slot("b", "play", at(300, 150))]);
  const after = layout([slot("a", "play", at(200, 150)), slot("b", "play", at(300, 150), { exhausted: true })]);
  const { motions } = motionsBetween(before, after, nowhere);

  it("squashes a card played from the hand when it lands", () => {
    const played = motions.get("a");
    expect(played?.land).toBe("squash");
    expect(played?.flip).toBe(false);
    expect(played?.dy).toBe(240 - 150);
  });

  it("turns an exhausted card in place and does not squash it", () => {
    const turned = motions.get("b");
    expect(turned?.land).toBeNull();
    expect(turned?.dx).toBe(0);
    expect(turned?.fromRot).toBe(0);
    expect(turned?.toRot).toBe(Math.PI / 2);
  });

  it("does not squash a card that only moved between rows of the hand", () => {
    const shifted = motionsBetween(layout([slot("a", "hand", at(100, 240))]), layout([slot("a", "hand", at(120, 240))]), nowhere);
    expect(shifted.motions.get("a")?.land).toBeNull();
  });
});

describe("motionsBetween: leaving", () => {
  const before = layout([slot("dead", "play", at(100, 150)), slot("event", "hand", at(200, 240)), slot("away", "play", at(300, 150)), slot("back", "play", at(400, 150))]);
  const after = layout([]);
  const where: Record<string, ZoneName> = { dead: "discard", event: "discard", back: "deck" };
  const { ghosts } = motionsBetween(before, after, (id) => where[id] ?? null);
  const by = (id: string) => ghosts.find((ghost) => ghost.slot.id === id);

  it("has a card destroyed or discarded from play shake on its way to the pile", () => {
    expect(by("dead")?.leave).toBe("shake");
    expect(by("dead")?.dx).toBe(95 - 125);
  });

  it("glides an event from the hand, or a card returned to a deck, without shaking", () => {
    expect(by("event")?.leave).toBe("glide");
    expect(by("back")?.leave).toBe("glide");
  });

  it("fades a card set aside where it stood", () => {
    expect(by("away")?.leave).toBe("fade");
    expect(by("away")?.dx).toBe(0);
  });
});

describe("poseAt", () => {
  const before = layout([slot("a", "hand", at(100, 240))]);
  const draw = motionsBetween(before, layout([slot("a", "hand", at(100, 240)), slot("b", "hand", at(160, 240)), slot("c", "hand", at(220, 240))]), nowhere).motions;
  const b = draw.get("b");
  const c = draw.get("c");
  if (!b || !c) throw new Error("no motions");

  it("shows the printed back, then the face after the midpoint, and rises on the arc", () => {
    const k = 1;
    expect(poseAt(b, 0, k).back).toBe(true);
    const mid = poseAt(b, MOTION.cardArrive.ms / 2, k);
    expect(mid.flipX).toBeLessThan(0.01);
    // At mid-path the card has risen 24 pt above the straight line from the deck.
    expect(mid.dy).toBeLessThan(b.dy * (1 - ease("outBack", 0.5)) - 20);
    const end = poseAt(b, MOTION.cardArrive.ms, k);
    expect(end.back).toBe(false);
    expect(end.flipX).toBeCloseTo(1, 5);
    expect(end.dx).toBeCloseTo(0, 5);
    expect(end.dy).toBeCloseTo(0, 5);
    expect(end.opacity).toBe(1);
  });

  it("keeps a card waiting for its turn out of sight", () => {
    expect(poseAt(c, 50, 1).opacity).toBe(0);
    expect(poseAt(c, 50, 1).back).toBe(true);
    expect(poseAt(c, 90 + 10, 1).opacity).toBeGreaterThan(0);
  });

  it("shortens everything at Quick", () => {
    const quick = 0.6;
    expect(poseAt(b, MOTION.cardArrive.ms * quick, quick).dx).toBeCloseTo(0, 5);
    expect(poseAt(b, MOTION.cardArrive.ms * quick, 1).dx).not.toBeCloseTo(0, 1);
  });

  it("is the rest pose from the end of the motion on", () => {
    for (const motion of [b, c]) {
      const rest = poseAt(motion, motionEnd(motion) + 1, 1);
      expect(rest).toMatchObject({ scale: 1, opacity: 1, flipX: 1, back: false });
      expect(rest.dx).toBeCloseTo(0, 9);
      expect(rest.dy).toBeCloseTo(0, 9);
      expect(rest.rot).toBe(motion.toRot);
    }
  });

  it("lifts a played card, glides it, squashes it on landing and settles at 1", () => {
    const played = motionsBetween(layout([slot("p", "hand", at(100, 240))]), layout([slot("p", "play", at(200, 150))]), nowhere).motions.get("p");
    if (!played) throw new Error("no motion");
    const lifted = poseAt(played, MOTION.lift.ms, 1);
    expect(lifted.scale).toBeCloseTo(SHAPE.lift * played.scale, 5);
    expect(lifted.dx).toBe(played.dx);
    const landed = poseAt(played, MOTION.lift.ms + MOTION.glide.ms, 1);
    expect(landed.scale).toBeCloseTo(SHAPE.squash, 5);
    expect(landed.dx).toBeCloseTo(0, 5);
    expect(poseAt(played, motionEnd(played), 1).scale).toBe(1);
  });

  it("pops a revealed card to 1.12 and back", () => {
    const revealed = motionsBetween(layout([]), layout([slot("r", "staging", at(120, 20))]), nowhere);
    // No previous cards at all is a first layout with a previous one that is empty: the card is new.
    const motion = revealed.motions.get("r");
    if (!motion) throw new Error("no motion");
    expect(motion.land).toBe("pop");
    const start = (MOTION.cardArrive.ms - MOTION.cardFlip.ms) / 2 + MOTION.cardFlip.ms;
    const held = poseAt(motion, start + MOTION.popRise.ms + 10, 1);
    expect(held.scale).toBeCloseTo(SHAPE.popScale, 5);
    expect(poseAt(motion, motionEnd(motion), 1).scale).toBe(1);
  });

  it("turns an exhausted card with a light overshoot", () => {
    const turn = motionsBetween(layout([slot("t", "play", at(100, 150))]), layout([slot("t", "play", at(100, 150), { exhausted: true })]), nowhere).motions.get("t");
    if (!turn) throw new Error("no motion");
    const seen = Array.from({ length: 36 }, (_, index) => poseAt(turn, index * 10, 1).rot);
    expect(Math.max(...seen)).toBeGreaterThan(Math.PI / 2);
    expect(poseAt(turn, MOTION.exhaust.ms, 1).rot).toBe(Math.PI / 2);
    expect(poseAt(turn, 0, 1).rot).toBe(0);
  });
});

describe("ghostPoseAt", () => {
  const ghost = motionsBetween(layout([slot("g", "play", at(100, 150))]), layout([]), (id) => (id === "g" ? "discard" : null)).ghosts[0];
  if (!ghost) throw new Error("no ghost");

  it("shakes three times, then shrinks and fades to the pile", () => {
    expect(ghost.leave).toBe("shake");
    const xs = [25, 50, 75, 100, 125].map((t) => ghostPoseAt(ghost, t, 1).dx);
    expect(xs[1]).toBeCloseTo(SHAPE.shakeAmplitude, 5);
    expect(xs[3]).toBeCloseTo(-SHAPE.shakeAmplitude, 5);
    const shake = MOTION.shakeStep.ms * SHAPE.shakeCount;
    expect(ghostPoseAt(ghost, shake, 1).opacity).toBe(1);
    const gone = ghostPoseAt(ghost, ghostEnd(ghost), 1);
    expect(gone.opacity).toBe(0);
    expect(gone.dx).toBeCloseTo(ghost.dx, 5);
    expect(gone.scale).toBeCloseTo(ghost.scale, 5);
    // It fades on the way out, not at the end: a quarter of the way into the run it is already down to 56%.
    expect(ghostPoseAt(ghost, shake + MOTION.cardLeave.ms * 0.25, 1).opacity).toBeCloseTo(0.5625, 5);
    expect(ghostPoseAt(ghost, shake + MOTION.cardLeave.ms * 0.5, 1).dx).toBeCloseTo(ghost.dx * 0.125, 5);
  });
});

describe("motionSpan", () => {
  it("is as long as the longest card, its wait included, and 0 when nothing moves", () => {
    const base = layout([slot("a", "hand", at(100, 240))]);
    expect(motionSpan(motionsBetween(base, base, nowhere))).toBe(0);
    const drawn = layout([slot("a", "hand", at(100, 240)), slot("b", "hand", at(160, 240)), slot("c", "hand", at(220, 240))]);
    expect(motionSpan(motionsBetween(base, drawn, nowhere))).toBe(90 + MOTION.cardArrive.ms);
    const played = layout([slot("a", "play", at(200, 150))]);
    expect(motionSpan(motionsBetween(base, played, nowhere))).toBe(MOTION.lift.ms + MOTION.glide.ms + MOTION.land.ms);
  });
});

describe("landAt", () => {
  it("is when the first played card lands, and null when none is played", () => {
    const base = layout([slot("a", "hand", at(100, 240)), slot("b", "hand", at(160, 240))]);
    const played = layout([slot("a", "play", at(200, 150)), slot("b", "play", at(260, 150))]);
    expect(landAt(motionsBetween(base, played, nowhere).motions)).toBe(MOTION.lift.ms + MOTION.glide.ms);
    expect(landAt(motionsBetween(base, base, nowhere).motions)).toBeNull();
  });
});

// Rules: dcce.boarding, dcce.corsair-deck, dcce.sailing-tests (data/rules/entries.json). Boarding's reveal, the Corsair pair and a Sailing test's look move as the other encounter cards do.
describe("motionsBetween: Boarding, the Corsair pair and the look strip", () => {
  const second = { ...piles, corsairDeck: { x: 400, y: 120, w: 50, h: 70 }, corsairDiscard: { x: 460, y: 120, w: 50, h: 70 } };
  const withPair = (slots: readonly CardSlot[]): TableLayout => ({ ...layout(slots), piles: second });
  const pileSlot = (id: string, count: number, rect: Rect) => slot(`pile:${id}`, id as SlotZone, rect, { count }, "pile");

  it("brings each Corsair card off the Corsair deck, flipped and popping, the cards 90 ms apart", () => {
    const before = withPair([slot("ship", "engaged", at(120, 100))]);
    const after = withPair([slot("ship", "engaged", at(120, 100)), slot("c1", "engaged", at(180, 100)), slot("c2", "engaged", at(240, 100))]);
    const { motions } = motionsBetween(before, after, nowhere, { zoneWas: (id) => (id.startsWith("c") ? "corsairDeck" : "engaged") });
    for (const [id, delay] of [["c1", 0], ["c2", 90]] as const) {
      const motion = motions.get(id);
      expect(motion?.flip, id).toBe(true);
      expect(motion?.land, id).toBe("pop");
      expect(motion?.delay, id).toBe(delay);
      // It starts at the Corsair deck: the deck's centre from its own slot's.
      const slotAt = after.slots.find((candidate) => candidate.id === id) as CardSlot;
      expect(motion?.dx, id).toBe(425 - (slotAt.x + 25));
      expect(motion?.dy, id).toBe(155 - (slotAt.y + 35));
    }
    expect(motions.get("ship")?.flip).toBe(false);
  });

  it("brings a card revealed from the encounter deck off the encounter deck, whichever pair the table has", () => {
    const before = withPair([]);
    const after = withPair([slot("e", "engaged", at(180, 100))]);
    const { motions } = motionsBetween(before, after, nowhere, { zoneWas: () => "encounterDeck" });
    expect(motions.get("e")?.dx).toBe(425 - 205);
    expect(motions.get("e")?.dy).toBe(45 - 135);
  });

  it("sends a non-ship enemy that is discarded toward the Corsair discard pile", () => {
    const before = withPair([slot("c", "engaged", at(180, 100), { damage: 3 })]);
    const after = withPair([]);
    const { ghosts } = motionsBetween(before, after, (id) => (id === "c" ? "corsairDiscard" : null));
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]?.leave).toBe("shake");
    expect(ghosts[0]?.dx).toBe(485 - 205);
    expect(ghosts[0]?.dy).toBe(155 - 135);
  });

  it("glides a Grotto location shuffled back into the deck to the Grotto deck's pile, not fading it where it stood", () => {
    const grotto = { ...piles, grottoDeck: { x: 400, y: 120, w: 50, h: 70 } };
    const withGrotto = (slots: readonly CardSlot[]): TableLayout => ({ ...layout(slots), piles: grotto });
    const before = withGrotto([slot("g", "staging", at(180, 100))]);
    const after = withGrotto([]);
    // The engine calls the Grotto deck the Uncharted deck.
    const { ghosts } = motionsBetween(before, after, (id) => (id === "g" ? "unchartedDeck" : null));
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]?.leave).toBe("glide");
    expect(ghosts[0]?.dx).toBe(425 - 205);
    expect(ghosts[0]?.dy).toBe(155 - 135);
  });

  it("glides the discard pile's cards to the deck when the Corsair deck is shuffled back, and keeps both piles still", () => {
    const before = withPair([pileSlot("corsairDeck", 0, second.corsairDeck), pileSlot("corsairDiscard", 4, second.corsairDiscard)]);
    const after = withPair([pileSlot("corsairDeck", 4, second.corsairDeck), pileSlot("corsairDiscard", 0, second.corsairDiscard)]);
    const { ghosts, motions } = motionsBetween(before, after, nowhere);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]?.leave).toBe("glide");
    expect(ghosts[0]?.dx).toBe(-60);
    expect(still(motions.get("pile:corsairDeck") as NonNullable<ReturnType<typeof motions.get>>)).toBe(true);
    // No reshuffle, no glide.
    expect(motionsBetween(before, before, nowhere).ghosts).toEqual([]);
  });

  it("brings the looked-at cards off the encounter deck face up, one after another, and glides them to the discard pile without a shake", () => {
    const before = layout([]);
    const looked = [slot("a", "encounterDeck", at(100, 20), { success: 1 }), slot("b", "encounterDeck", at(160, 20), { success: 0 }), slot("c", "encounterDeck", at(220, 20), { success: 2 })];
    const strip = layout(looked);
    const { motions } = motionsBetween(before, strip, nowhere);
    expect(["a", "b", "c"].map((id) => motions.get(id)?.delay)).toEqual([0, 90, 180]);
    for (const id of ["a", "b", "c"]) {
      expect(motions.get(id)?.flip, id).toBe(true);
      expect(motions.get(id)?.land, id).toBe("pop");
    }
    const { ghosts } = motionsBetween(strip, layout([]), (id) => (looked.some((card) => card.id === id) ? "encounterDiscard" : null));
    expect(ghosts.map((ghost) => ghost.leave)).toEqual(["glide", "glide", "glide"]);
    expect(ghosts[0]?.dx).toBe(485 - 125);
  });
});

// Rules: none (the table's own crowding rule, docs/design-system-table.md, Spacing and the play area's rows). A card moves out of and into a row's fold stack, and is not revealed again.
describe("motionsBetween: the fold stack", () => {
  const stack = { x: 100, y: 20, w: 50, h: 70 };
  const withFold = (slots: readonly CardSlot[], cards: readonly string[]): TableLayout => ({ ...layout(slots), folds: cards.length > 0 ? [{ id: "fold:staging", zone: "staging", rect: stack, cards, top: cards[0] ?? "" }] : [] });

  it("brings a card that left the stack out of the stack, face up and not revealed again", () => {
    const before = withFold([slot("fold:staging", "staging", stack, { count: 2 }, "pile")], ["a", "b"]);
    const after = withFold([slot("fold:staging", "staging", stack, { count: 1 }, "pile"), slot("a", "staging", at(200, 20))], ["b"]);
    const motion = motionsBetween(before, after, () => "staging", { zoneWas: () => "staging" }).motions.get("a");
    expect(motion?.dx).toBe(125 - 225);
    expect(motion?.dy).toBe(55 - 55);
    expect(motion?.flip).toBe(false);
    expect(motion?.land).toBeNull();
    expect(motion?.fromOpacity).toBe(1);
  });

  it("glides a card that folded into the stack toward it, and does not fade it where it stood", () => {
    const before = withFold([slot("a", "staging", at(200, 20))], []);
    const after = withFold([slot("fold:staging", "staging", stack, { count: 1 }, "pile")], ["a"]);
    const { ghosts } = motionsBetween(before, after, () => "staging");
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]).toMatchObject({ leave: "glide", dx: 125 - 225, dy: 0 });
  });
});
