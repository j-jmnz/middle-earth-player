// Where the combat spotlight's cards stand (docs/design-system.md, Table, Spotlight; phase 24). Pure geometry, like layout.ts:
// the attacker (or a fan of up to three attackers, then "+n") at the left and the target at the right, side by side at the middle of the
// canvas, enlarged to 42% of its height with a 24 pt gap, a pill under each, and a turned shadow card beside the enemy. The beats
// that move them are in spotlight-beats.ts; the canvas draws them in spotlight.native.tsx.
import type { Rect } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";

// The pills under the cards.
export const PILL_H = 34;
const PILL_GAP = 8;
// The word "Blocked" under the target's pill.
const WORD_H = 18;
// A fan card is this share of a card to the right of the one before it, and turns this many degrees from its neighbor.
const FAN_STEP = 0.36;
const FAN_TURN = (5 * Math.PI) / 180;
// Room between a shadow card and the enemy: wider than the draw back, so the attacker never touches it.
const SHADOW_GAP = 16;
// The canvas keeps this much at each side.
const EDGE = 8;

export type Stage = {
  // The attackers left to right (the front one last, nearest the target), and each one's turn in radians.
  attackers: Rect[];
  turns: number[];
  target: Rect;
  // The turned shadow card, at 80%, to the left of the enemy; null when the attack turned none.
  shadow: Rect | null;
  // The centers of the pill under the attackers, the pill under the target, and the word under it.
  attackPill: { cx: number; cy: number };
  targetPill: { cx: number; cy: number };
  word: { cx: number; cy: number };
  // Where the attacker meets the target, and the target's damage corner: the damage tokens fly from one to the other.
  contact: { x: number; y: number };
  corner: { cx: number; cy: number };
  // The "+n" for the attackers past the fan, at the top of the first card.
  more: { cx: number; cy: number } | null;
};

/**
 * The stage on a canvas of this size. `card` is the table's card size (its aspect is kept). With `attackers` characters the fan
 * shows up to three; with a `shadow` card an enemy's attack makes room for it at the left. The whole group is centered, and
 * shrinks when the canvas is too narrow for it.
 */
export function stageOf(canvas: { width: number; height: number }, card: { w: number; h: number }, attackers: number, shadow: boolean): Stage {
  const aspect = card.w / card.h;
  const shown = Math.max(1, Math.min(attackers, SHAPE.spotlightFan));
  const room = canvas.width - 2 * EDGE;
  const wide = (w: number) => (shadow ? w * SHAPE.spotlightShadow + SHADOW_GAP : 0) + w * (1 + FAN_STEP * (shown - 1)) + SHAPE.spotlightGap + w;
  let h = Math.round(SHAPE.spotlightHeight * canvas.height);
  let w = Math.round(h * aspect);
  if (wide(w) > room) {
    w = Math.floor(w * (room / wide(w)));
    h = Math.round(w / aspect);
  }
  const sw = Math.round(w * SHAPE.spotlightShadow);
  const sh = Math.round(h * SHAPE.spotlightShadow);
  const total = wide(w);
  const top = Math.max(EDGE, Math.round((canvas.height - (h + PILL_GAP + PILL_H + WORD_H)) / 2));
  const left = Math.round((canvas.width - total) / 2);
  const fanLeft = left + (shadow ? sw + SHADOW_GAP : 0);
  const step = Math.round(w * FAN_STEP);
  const attackerRects = Array.from({ length: shown }, (_, index) => ({ x: fanLeft + index * step, y: top, w, h }));
  const front = attackerRects[shown - 1] ?? { x: fanLeft, y: top, w, h };
  const target = { x: front.x + w + SHAPE.spotlightGap, y: top, w, h };
  const radius = SHAPE.spotlightToken / 2;
  const pillY = top + h + PILL_GAP + PILL_H / 2;
  return {
    attackers: attackerRects,
    turns: attackerRects.map((_, index) => (index - (shown - 1) / 2) * FAN_TURN),
    target,
    shadow: shadow ? { x: left, y: top + (h - sh), w: sw, h: sh } : null,
    attackPill: { cx: fanLeft + (w * (1 + FAN_STEP * (shown - 1))) / 2, cy: pillY },
    targetPill: { cx: target.x + w / 2, cy: pillY },
    word: { cx: target.x + w / 2, cy: pillY + PILL_H / 2 + WORD_H / 2 + 2 },
    contact: { x: target.x, y: top + h / 2 },
    corner: { cx: target.x + w - radius - 2, cy: top + radius + 2 },
    more: attackers > shown ? { cx: fanLeft + 16, cy: top + 14 } : null,
  };
}

/** Where a card is drawn between its slot (`f` 0) and the stage (`f` 1): a shift, a scale and a turn about its center. */
export function flown(from: Rect, fromTurn: number, stage: Rect, stageTurn: number, f: number): { tx: number; ty: number; scale: number; turn: number } {
  "worklet";
  const dx = from.x + from.w / 2 - (stage.x + stage.w / 2);
  const dy = from.y + from.h / 2 - (stage.y + stage.h / 2);
  return { tx: dx * (1 - f), ty: dy * (1 - f), scale: from.w / stage.w + (1 - from.w / stage.w) * f, turn: fromTurn + (stageTurn - fromTurn) * f };
}

/**
 * A damage token `u` (0..1) of the way from the point of contact to the target's corner: it rises on an arc, fans out by its place
 * in the burst, grows a little in flight and settles at the size of the token in the corner, fading into it at the end.
 */
export function burstPoint(stage: Stage, index: number, count: number, u: number): { x: number; y: number; scale: number; opacity: number } {
  "worklet";
  const arc = Math.sin(Math.PI * u);
  const side = count > 1 ? (index / (count - 1)) * 2 - 1 : 0;
  return {
    x: stage.contact.x + (stage.corner.cx - stage.contact.x) * u + side * 22 * arc,
    y: stage.contact.y + (stage.corner.cy - stage.contact.y) * u - 26 * arc,
    scale: 0.6 + 0.4 * u + 0.25 * arc,
    opacity: u > 0.85 ? (1 - u) / 0.15 : 1,
  };
}
