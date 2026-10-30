// The poses of the combat spotlight's cards (spotlight-card.ts).
import { describe, expect, it } from "vitest";

import { cardTransform, CARD, flightArc, flipTurn, trailTransform } from "./spotlight-card.ts";
import { frameAt, type ClashShape } from "./spotlight-beats.ts";
import { stageOf, strikeOffset, type StageArea } from "./spotlight-stage.ts";

const AREA: StageArea = { width: 844, height: 390, origin: { x: 0, y: 40 }, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const stage = stageOf(AREA, { w: 60, h: 84 }, 1, true, 1);
const SHAPE: ClashShape = { damage: 2, destroyed: false, shadow: true, first: true, last: true };
const from = { x: 20, y: 200, w: 60, h: 84 };
type Step = Record<string, number>;
const get = (list: readonly object[], key: string) => (list as readonly Step[]).find((step) => key in step)?.[key];

describe("the flight arc", () => {
  it("is 0 at both ends and past the end, and the highest at the middle", () => {
    expect(flightArc(0, 234)).toBeCloseTo(0, 9);
    expect(flightArc(1, 234)).toBeCloseTo(0, 9);
    expect(flightArc(1.04, 234)).toBeCloseTo(0, 9);
    expect(flightArc(0.5, 234)).toBeCloseTo(CARD.arc * 234, 9);
    expect(flightArc(0.25, 234)).toBeLessThan(flightArc(0.5, 234));
  });
});

describe("the flip", () => {
  it("shows the back up to a quarter turn and the face unmirrored after it", () => {
    expect(flipTurn(0)).toBe(0);
    expect(flipTurn(Math.PI / 2 - 0.01)).toBeCloseTo(Math.PI / 2 - 0.01, 9);
    expect(flipTurn(Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9);
    expect(flipTurn(Math.PI)).toBeCloseTo(0, 9);
  });
});

describe("a card's transform", () => {
  const target = stage.target;
  it("rests at the stage once the cards have flown in, and at the slot before", () => {
    const start = cardTransform("target", from, 0, target, 0, stage, frameAt(SHAPE, 0, 1, 3));
    expect(get(start, "scale")).toBeCloseTo(from.w / target.w, 9);
    const mid = frameAt(SHAPE, 1000, 1, 3);
    const rest = cardTransform("target", from, 0, target, 0, stage, { ...mid, flyTarget: 1, knock: 0 });
    expect(get(rest, "translateX")).toBeCloseTo(0, 9);
    expect(get(rest, "translateY")).toBeCloseTo(0, 9);
    expect(get(rest, "scale")).toBeCloseTo(1, 9);
  });

  it("moves the attacker by the strike offset and tilts it", () => {
    const frame = { ...frameAt(SHAPE, 800, 1, 3), flyAttackers: 1 };
    const list = cardTransform("attacker", from, 0, stage.attackers[0]!, 0, stage, frame);
    expect(get(list, "translateX")).toBeCloseTo(strikeOffset(stage, frame), 9);
    expect(get(list, "rotate")).toBeCloseTo(frame.tilt, 9);
  });

  it("flips only the shadow card, with perspective", () => {
    const frame = frameAt(SHAPE, 450, 1, 3);
    const shadow = cardTransform("shadow", from, 0, stage.shadow!, 0, stage, frame);
    expect(get(shadow, "perspective")).toBeGreaterThan(0);
    expect(get(shadow, "rotateY")).toBeCloseTo(flipTurn(frame.flipAngle), 9);
    expect(get(cardTransform("target", from, 0, stage.target, 0, stage, frame), "rotateY")).toBeUndefined();
  });

  it("drops a burning target only by the fall it is given", () => {
    const burning = { ...frameAt({ ...SHAPE, destroyed: true }, 2900, 1, 3), flyTarget: 1, knock: 0 };
    expect(get(cardTransform("target", from, 0, stage.target, 0, stage, burning), "translateY")).toBeCloseTo(0, 9);
    expect(get(cardTransform("target", from, 0, stage.target, 0, stage, burning, 12), "translateY")).toBeCloseTo(12 * burning.dissolve, 9);
    expect(burning.dissolve).toBeGreaterThan(0);
  });
});

describe("an afterimage", () => {
  it("follows the strike offset and tilt of the pose it copies", () => {
    const list = trailTransform(stage, 0.1, { back: 0.5, strike: 0.2, tilt: -0.03 });
    expect(get(list, "translateX")).toBeCloseTo(strikeOffset(stage, { back: 0.5, strike: 0.2, recoil: 0 }), 9);
    expect(get(list, "rotate")).toBeCloseTo(0.07, 9);
  });
});
