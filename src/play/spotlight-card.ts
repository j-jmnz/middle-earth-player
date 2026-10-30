// How a card of the combat spotlight is posed on the stage (docs/plans/done/combat-spotlight-redesign.md, §5), as arithmetic on a frame
// (spotlight-beats.ts): the transform of a flying card with its arc and its perspective flip, and of an afterimage. Pure and worklet-safe (in Node the "worklet" directive is an unused string); the native pieces
// (spotlight-pieces.native.tsx) hand the result to a Skia group. Lengths come back in screen points: the stage is already times the UI scale.
import type { Transforms3d } from "@shopify/react-native-skia";

import type { Rect } from "./layout.ts";
import type { Frame } from "./spotlight-beats.ts";
import { flown, strikeOffset, type Stage } from "./spotlight-stage.ts";

/** Which of an attack's cards this is: it decides how the frame moves it. */
export type Role = "attacker" | "target" | "shadow";

export const CARD = {
  // How high (a share of a card's height) a card rises on its flight between its slot and the stage, at the middle of the flight.
  arc: 0.12,
  // The eye's distance for the shadow card's flip, in card heights.
  depth: 4,
  // How far (pt, Medium's) a destroyed target drops when no burn shader can run, by the end of the fade.
  fall: 12,
} as const;

/** How far a card is lifted `f` of the way (0 at its slot, 1 on the stage; past 1 as it overshoots) along its flight: a sine, 0 at both ends. */
export function flightArc(f: number, cardH: number): number {
  "worklet";
  return Math.sin(Math.PI * Math.min(1, Math.max(0, f))) * CARD.arc * cardH;
}

/** The turn about the vertical axis that shows a card at flip angle `angle` (0 the back, pi the face): the face is drawn unmirrored, from -pi/2 to 0. */
export function flipTurn(angle: number): number {
  "worklet";
  return angle < Math.PI / 2 ? angle : angle - Math.PI;
}

/** The pose of a card from its slot (`from`, `fromTurn`) to its place on the stage (`rect`, `turn`) in a frame; `fall` is the drop of a burning target without the shader (pt). */
export function cardTransform(role: Role, from: Rect, fromTurn: number, rect: Rect, turn: number, stage: Stage, frame: Frame, fall = 0): Transforms3d {
  "worklet";
  const fly = role === "target" ? frame.flyTarget : frame.flyAttackers;
  const p = flown(from, fromTurn, rect, turn, fly);
  const dx = role === "attacker" ? strikeOffset(stage, frame) : role === "target" ? frame.knock * stage.knock : 0;
  const dy = -flightArc(fly, stage.cardH) + (role === "target" ? fall * frame.dissolve : 0);
  const pose: Transforms3d = [{ translateX: p.tx + dx }, { translateY: p.ty + dy }, { rotate: p.turn + (role === "attacker" ? frame.tilt : 0) }, { scale: p.scale }];
  return role === "shadow" ? [...pose, { perspective: CARD.depth * stage.cardH }, { rotateY: flipTurn(frame.flipAngle) }] : pose;
}

/** An afterimage of the attacker on the stage (it has landed, so it is at its place in the fan): the pose a trail step ago. */
export function trailTransform(stage: Stage, turn: number, then: { back: number; strike: number; tilt: number }): Transforms3d {
  "worklet";
  return [{ translateX: strikeOffset(stage, { back: then.back, strike: then.strike, recoil: 0 }) }, { rotate: turn + then.tilt }];
}
