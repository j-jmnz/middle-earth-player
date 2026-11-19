// Where the combat spotlight's cards stand (docs/design-system-table.md, Spotlight). Pure
// geometry, like layout.ts, for the whole screen: the attacker (or a fan of up to three attackers, then "+n") at the left and the
// target at the right, centered on the screen at 60% of its height (at most 340 pt), the attack value under the attackers' feet,
// the matchup line and the result in the middle of the stage over the gap between the cards, the gauge under them, a turned shadow
// card beside the enemy, and the note under the top safe inset. The beats that move them are in
// spotlight/beats.ts. At a UI `scale` (ui-scale.ts) the stage is worked out in logical points (the area and the card over the
// scale) and every length comes back times the scale.
import type { Rect } from "../layout/layout.ts";
import { SPOT } from "./shape.ts";

export type Insets = { top: number; right: number; bottom: number; left: number };

/**
 * The area the stage fills: the screen's size, where the table canvas's top-left corner is on it (the layout's slots are in canvas
 * points, so `origin` carries them onto the screen), and the safe insets. The stage is in screen points.
 */
export type StageArea = { width: number; height: number; origin: { x: number; y: number }; safe: Insets };

/** Whether two areas are the same size, place and insets. */
export function sameArea(a: StageArea, b: StageArea): boolean {
  return a.width === b.width && a.height === b.height && a.origin.x === b.origin.x && a.origin.y === b.origin.y && a.safe.top === b.safe.top && a.safe.right === b.safe.right && a.safe.bottom === b.safe.bottom && a.safe.left === b.safe.left;
}

export type Stage = {
  // The attackers left to right (the front one last, nearest the target), and each one's turn in radians.
  attackers: Rect[];
  turns: number[];
  target: Rect;
  // The turned shadow card, at 72% and bottom-aligned, to the left of the fan; null when the attack turned none.
  shadow: Rect | null;
  // The centre of the attack value (under the attackers' feet); the middle of the stage, over the gap between the front attacker and
  // the target at the cards' middle height, where the matchup line and the result stand; and the gauge's centre under it with the
  // width it may take (spotlight/gauge.ts).
  badgeA: { cx: number; cy: number };
  focus: { cx: number; cy: number };
  gauge: { cx: number; cy: number; room: number };
  // Where the attacker meets the target, and the target's damage corner: the damage tokens fly from one to the other. `token` is their size.
  contact: { x: number; y: number };
  corner: { cx: number; cy: number };
  token: number;
  // The "+n" for the attackers past the fan, at the top of the first card.
  more: { cx: number; cy: number } | null;
  // The note (a dot for each attack, then "Tap to skip"), centered on the screen under the top inset: its center and its height.
  note: { cx: number; cy: number; h: number };
  // The card height, the gap between the fan and the target, how far the attacker draws back, how far it is knocked back when it is
  // blocked and the target when it is hit (all pt); the attackers' lunge reaches the target after `gap`.
  cardH: number;
  gap: number;
  drawBack: number;
  recoil: number;
  knock: number;
};

/**
 * The stage on an area of this size. `card` is the table's card size (its aspect is kept). With `attackers` characters the fan
 * shows up to three; with a `shadow` card an enemy's attack makes room for it at the left. The whole group is centered on the
 * screen, and shrinks when the screen is too narrow for it, or too short for the note above it and the attack value at its feet.
 */
export function stageOf(area: StageArea, card: { w: number; h: number }, attackers: number, shadow: boolean, scale = 1): Stage {
  const safe = area.safe;
  const logical: StageArea = { width: area.width / scale, height: area.height / scale, origin: area.origin, safe: { top: safe.top / scale, right: safe.right / scale, bottom: safe.bottom / scale, left: safe.left / scale } };
  const stage = stageIn(logical, card.w / card.h, attackers, shadow);
  return scale === 1 ? stage : scaledStage(stage, scale);
}

// The stage with every length times `s`; the turns are angles and stay.
function scaledStage(stage: Stage, s: number): Stage {
  const rect = (r: Rect): Rect => ({ x: r.x * s, y: r.y * s, w: r.w * s, h: r.h * s });
  const at = (p: { cx: number; cy: number }) => ({ cx: p.cx * s, cy: p.cy * s });
  return {
    attackers: stage.attackers.map(rect),
    turns: stage.turns,
    target: rect(stage.target),
    shadow: stage.shadow ? rect(stage.shadow) : null,
    badgeA: at(stage.badgeA),
    focus: at(stage.focus),
    gauge: { ...at(stage.gauge), room: stage.gauge.room * s },
    contact: { x: stage.contact.x * s, y: stage.contact.y * s },
    corner: at(stage.corner),
    token: stage.token * s,
    more: stage.more ? at(stage.more) : null,
    note: { ...at(stage.note), h: stage.note.h * s },
    cardH: stage.cardH * s,
    gap: stage.gap * s,
    drawBack: stage.drawBack * s,
    recoil: stage.recoil * s,
    knock: stage.knock * s,
  };
}

function stageIn(area: StageArea, aspect: number, attackers: number, shadow: boolean): Stage {
  const { width, height, safe } = area;
  const shown = Math.max(1, Math.min(attackers, SPOT.fan));
  // The group is centered on the screen, so it keeps the larger inset at both sides.
  const room = width - 2 * Math.max(safe.left, safe.right) - SPOT.margin;
  const gapOf = (w: number) => Math.max(SPOT.gapMin, Math.round(SPOT.gapShare * w));
  const wide = (w: number) => (shadow ? Math.round(w * SPOT.shadow) + SPOT.shadowGap : 0) + w * (1 + SPOT.fanStep * (shown - 1)) + gapOf(w) + w;
  // The note sits under the top safe inset and the cards keep clear of it; the attack value at the cards' feet keeps clear of the bottom inset.
  const noteH = SPOT.noteHeight;
  const noteCy = safe.top + SPOT.noteRoom + noteH / 2;
  const centerY = Math.round(SPOT.centerY * height);
  const below = height - safe.bottom - SPOT.noteRoom - SPOT.footRoom;
  const tallest = Math.floor(2 * Math.min(below - centerY, centerY - (noteCy + noteH / 2 + SPOT.noteClear)));
  let h = Math.max(1, Math.min(Math.round(SPOT.height * height), SPOT.maxHeight, tallest));
  let w = Math.max(1, Math.round(h * aspect));
  if (wide(w) > room) {
    for (let guard = 0; wide(w) > room && w > 8 && guard < 64; guard += 1) w = Math.min(w - 1, Math.floor((w * room) / wide(w)));
    h = Math.round(w / aspect);
  }
  const sw = Math.round(w * SPOT.shadow);
  const sh = Math.round(h * SPOT.shadow);
  const gap = gapOf(w);
  const total = wide(w);
  const top = centerY - Math.round(h / 2);
  const left = Math.round((width - total) / 2);
  const fanLeft = left + (shadow ? sw + SPOT.shadowGap : 0);
  const step = Math.round(w * SPOT.fanStep);
  const turn = (SPOT.fanTurn * Math.PI) / 180;
  const attackerRects = Array.from({ length: shown }, (_, index) => ({ x: fanLeft + index * step, y: top, w, h }));
  const front = attackerRects[shown - 1] ?? { x: fanLeft, y: top, w, h };
  const target = { x: front.x + w + gap, y: top, w, h };
  const token = Math.round(SPOT.token * h);
  const foot = top + h;
  return {
    attackers: attackerRects,
    turns: attackerRects.map((_, index) => (index - (shown - 1) / 2) * turn),
    target,
    shadow: shadow ? { x: left, y: top + (h - sh), w: sw, h: sh } : null,
    badgeA: { cx: fanLeft + (w * (1 + SPOT.fanStep * (shown - 1))) / 2, cy: foot },
    focus: { cx: target.x - gap / 2, cy: top + h / 2 },
    gauge: { cx: target.x - gap / 2, cy: top + h / 2 + Math.round(SPOT.gaugeDrop * h), room: SPOT.gaugeRoom * w },
    contact: { x: target.x, y: top + h / 2 },
    corner: { cx: target.x + w - token / 2 - SPOT.tokenInset, cy: top + token / 2 + SPOT.tokenInset },
    token,
    more: attackers > shown ? { cx: fanLeft + 22, cy: top + 20 } : null,
    note: { cx: width / 2, cy: noteCy, h: noteH },
    cardH: h,
    gap,
    drawBack: Math.round(SPOT.drawBack * h),
    recoil: Math.round(SPOT.recoil * h),
    knock: Math.round(SPOT.knock * h),
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
export function burstPoint(stage: Stage, index: number, count: number, u: number, scale = 1): { x: number; y: number; scale: number; opacity: number } {
  "worklet";
  const arc = Math.sin(Math.PI * u);
  const side = count > 1 ? (index / (count - 1)) * 2 - 1 : 0;
  return {
    x: stage.contact.x + (stage.corner.cx - stage.contact.x) * u + side * 22 * scale * arc,
    y: stage.contact.y + (stage.corner.cy - stage.contact.y) * u - 26 * scale * arc,
    scale: 0.6 + 0.4 * u + 0.25 * arc,
    opacity: u > 0.85 ? (1 - u) / 0.15 : 1,
  };
}

/** How far the attacker stands from its place in the fan, in points (negative is away from the target), from a frame's `back`, `strike` and `recoil`. */
export function strikeOffset(stage: Stage, pose: { back: number; strike: number; recoil: number }): number {
  "worklet";
  return -stage.drawBack * pose.back + (stage.gap + stage.drawBack) * pose.strike - stage.recoil * pose.recoil;
}
