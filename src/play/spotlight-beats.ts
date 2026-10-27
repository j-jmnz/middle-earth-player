// The combat spotlight's beats as arithmetic on a time (docs/design-system.md, Table, Spotlight; phase 24). Pure: the canvas's UI
// thread calls `frameAt`, `burstAt` and `scrimAt` once per frame from one clock, and a Vitest reads them (the functions marked
// "worklet" run there; in Node the directive is an unused string). motion-tokens.ts says how long each beat is and how far things
// move; spotlight-stage.ts says where the cards stand. `t` is ms since the attack's run began and `k` the motion scale (Quick 0.6),
// so every length passes through the scale: a gate or a timer is not in here.
//
// One attack, at Normal (ms), when it is the only one (or the first of several, then without the last row):
//   0   dim      the table dims, the cards fly from their slots to the center, the pills fade in
//   250 draw     the attacker draws back and tilts away; a turned shadow card flips face up beside the enemy
//   500 lunge    the attacker moves to touch the target
//   650 hold     everything holds; the impact haptic plays
//   730 impact   the target shakes; the damage tokens fly to its corner and the count pops, or the defense bounces ("Blocked")
//   1100 return  both go back to their slots and the table lights again; a destroyed target greys and drops instead
//   1500
// Several attacks in one state play under one night: the table is already dark, so the second and later attacks swap in over 150 ms
// (no dim, no flight from the slots, a draw back of 125 ms), the one before them fades out in the same 150 ms, and only the last goes back.
import { clamp01, ease, length, popScale } from "./motion-curves.ts";
import { MOTION, SHAPE, type Tween } from "./motion-tokens.ts";
import { tokenPopScale } from "./token-fx.ts";

const TILT = (SHAPE.spotlightTilt * Math.PI) / 180;

function curve(token: Tween, x: number): number {
  "worklet";
  return ease(token.easing ?? "linear", x);
}

/** Where an attack stands among the attacks of its state: the first dims the table, the last goes back. */
export type Place = { first: boolean; last: boolean };

/**
 * The beats of one attack at a scale: each one's length and where it starts, in ms. `dim` is the first attack's dim or a later one's
 * swap, `ret` is 0 unless it is the last, `end` is the attack's own length, and `exit` is how long it fades out into the next attack.
 */
export type Beats = { dim: number; draw: number; lunge: number; hold: number; impact: number; ret: number; drawAt: number; lungeAt: number; holdAt: number; impactAt: number; retAt: number; end: number; exit: number };

export function beatsAt(k: number, place: Place = { first: true, last: true }): Beats {
  "worklet";
  const dim = length(place.first ? MOTION.spotlightDim : MOTION.spotlightSwap, k);
  const draw = length(place.first ? MOTION.spotlightDraw : MOTION.spotlightDrawAgain, k);
  const lunge = length(MOTION.spotlightLunge, k);
  const hold = length(MOTION.spotlightHold, k);
  const impact = length(MOTION.spotlightImpact, k);
  const ret = place.last ? length(MOTION.spotlightReturn, k) : 0;
  const drawAt = dim;
  const lungeAt = drawAt + draw;
  const holdAt = lungeAt + lunge;
  const impactAt = holdAt + hold;
  const retAt = impactAt + impact;
  return { dim, draw, lunge, hold, impact, ret, drawAt, lungeAt, holdAt, impactAt, retAt, end: retAt + ret, exit: place.last ? 0 : length(MOTION.spotlightSwap, k) };
}

function placeOf(index: number, count: number): Place {
  "worklet";
  return { first: index === 0, last: index === count - 1 };
}

/** Where attack `index` of `count` begins, ms into the whole run at a scale: the lengths of the attacks before it. */
export function runStart(index: number, count: number, k: number): number {
  "worklet";
  let at = 0;
  for (let before = 0; before < index; before += 1) at += beatsAt(k, placeOf(before, count)).end;
  return at;
}

/** How long `count` attacks run one after another at a scale, in ms: the first 1500 at Normal, each later one 875, the last going back. */
export function spotlightRun(count: number, k: number): number {
  return Math.ceil(runStart(count - 1, count, k) + beatsAt(k, placeOf(count - 1, count)).end);
}

/** The run of `count` attacks, unscaled. */
export function spotlightSpan(count: number): number {
  return spotlightRun(count, 1);
}

/** Attack `index` of `count`: where it begins in the run and how long it stays drawn (its own length and the fade into the next one). */
export function windowOf(index: number, count: number, k: number): { start: number; length: number } {
  "worklet";
  const beats = beatsAt(k, placeOf(index, count));
  return { start: runStart(index, count, k), length: beats.end + beats.exit };
}

/** The ms, from the start of the whole run at a scale, at which the strike of attack `index` lands (its hit stop begins). */
export function hitTime(index: number, count: number, k: number): number {
  return runStart(index, count, k) + beatsAt(k, placeOf(index, count)).holdAt;
}

/** The ms at which the last attack begins to go back, so the scrim over the bar and the dock can fade out with the canvas. */
export function leaveTime(count: number, k: number): number {
  return runStart(count - 1, count, k) + beatsAt(k, placeOf(count - 1, count)).retAt;
}

/** What one attack needs to know to be drawn: the damage placed, whether the target is destroyed, a turned shadow card, and its place among the attacks. */
export type ClashShape = { damage: number; destroyed: boolean; shadow: boolean; first: boolean; last: boolean };

export type Frame = {
  // 0 at their slots, 1 at the center: the attackers (and the shadow card), and the target, which stays when it is destroyed.
  flyAttackers: number;
  flyTarget: number;
  // The pills and the words under the cards, and the whole attack's opacity (a later attack swaps in, an earlier one swaps out).
  pills: number;
  fade: number;
  // The attacker's offset toward the target in pt (negative while it draws back), and its tilt in radians.
  strike: number;
  tilt: number;
  // The target's offset in pt while it shakes, how far a destroyed one has fallen (0..1) and drops, its night veil (0..1 of 50%)
  // and its own opacity.
  shake: number;
  fall: number;
  veil: number;
  targetOpacity: number;
  // The shadow card's flip: 0 is the back, 1 the face.
  flip: number;
  // The defense pill's scale and the "Blocked" word's opacity.
  bounce: number;
  word: number;
  // The count in the target's damage corner: the last token has landed (it shows the new count), and its pop.
  landed: boolean;
  pop: number;
};

/** The ms between two damage tokens leaving the point of contact at a scale: 90, less when many would not land by the end of the impact. */
export function burstGap(count: number, k: number): number {
  "worklet";
  if (count < 2) return 0;
  return Math.max(1, Math.min(length(MOTION.spotlightBurstStep, k), (length(MOTION.spotlightImpact, k) - length(MOTION.spotlightBurstFly, k)) / (count - 1)));
}

/** When the last damage token lands, ms into the attack; 0 when there is no damage. */
function landAt(damage: number, b: Beats, k: number): number {
  "worklet";
  return damage > 0 ? b.impactAt + (damage - 1) * burstGap(damage, k) + length(MOTION.spotlightBurstFly, k) : 0;
}

/** The pose of one attack's cards at `t`. Before 0 or past the run it is the rest: nothing flown out. */
export function frameAt(shape: ClashShape, t: number, k: number): Frame {
  "worklet";
  const b = beatsAt(k, shape);
  const appear = curve(shape.first ? MOTION.spotlightDim : MOTION.spotlightSwap, t / b.dim);
  const out = shape.last && t >= b.retAt ? curve(MOTION.spotlightReturn, (t - b.retAt) / b.ret) : 0;
  // Only the first attack flies out from the slots; a later one is already in the middle of the dark table.
  const flyAttackers = shape.last && t >= b.retAt ? 1 - out : shape.first ? appear : 1;
  const flyTarget = shape.destroyed && t >= b.retAt ? 1 : flyAttackers;
  const pills = shape.last && t >= b.retAt ? 1 - clamp01((t - b.retAt) / (b.ret / 2)) : appear;
  const fade = (shape.first ? 1 : appear) * (shape.last ? 1 : 1 - clamp01((t - b.retAt) / b.exit));

  // The attacker draws back and tilts away, lunges to touch the target, then goes home with the rest.
  let strike = 0;
  let tilt = 0;
  if (t >= b.holdAt) {
    strike = SHAPE.spotlightGap * (1 - out);
  } else if (t >= b.lungeAt) {
    const l = curve(MOTION.spotlightLunge, (t - b.lungeAt) / b.lunge);
    strike = -SHAPE.spotlightDrawBack + (SHAPE.spotlightDrawBack + SHAPE.spotlightGap) * l;
    tilt = -TILT * (1 - l);
  } else if (t >= b.drawAt) {
    const d = curve(shape.first ? MOTION.spotlightDraw : MOTION.spotlightDrawAgain, (t - b.drawAt) / b.draw);
    strike = -SHAPE.spotlightDrawBack * d;
    tilt = -TILT * d;
  }

  // The target shakes through the impact, decaying over three swings; a defender that blocked it shakes less.
  const u = clamp01((t - b.impactAt) / b.impact);
  const reach = SHAPE.spotlightShake * (shape.damage === 0 ? SHAPE.spotlightShakeBlocked : 1);
  const shake = t < b.impactAt ? 0 : reach * (1 - u) * Math.sin(2 * Math.PI * SHAPE.spotlightSwings * u);
  // A destroyed target greys under the night veil (full by 40% of its fall), then fades out over the rest of it.
  const fall = shape.destroyed && t >= b.retAt ? curve(MOTION.spotlightFall, (t - b.retAt) / length(MOTION.spotlightFall, k)) : 0;
  const veil = SHAPE.spotlightVeil * clamp01(fall / SHAPE.spotlightVeilBy);
  const targetOpacity = 1 - clamp01((fall - SHAPE.spotlightVeilBy) / (1 - SHAPE.spotlightVeilBy));

  const flip = shape.shadow ? clamp01((t - b.drawAt) / length(MOTION.cardFlip, k)) : 0;
  const hit = t - b.impactAt;
  const blocked = shape.damage === 0;
  const bounce = blocked && hit > 0 ? popScale(hit, k, SHAPE.spotlightBounce, MOTION.spotlightBounceRise, 0, MOTION.spotlightBounceSettle) : 1;
  const word = blocked ? clamp01(hit / length(MOTION.spotlightBounceRise, k)) * pills : 0;
  const landed = shape.damage > 0 && t >= landAt(shape.damage, b, k);
  const pop = landed ? tokenPopScale(t - landAt(shape.damage, b, k), k) : 1;
  return { flyAttackers, flyTarget, pills, fade, strike, tilt, shake, fall, veil, targetOpacity, flip, bounce, word, landed, pop };
}

/** One damage token on its way from the point of contact to the target's corner: how far (0..1), and whether it is in the air. */
export function burstAt(index: number, count: number, t: number, k: number, place: Place = { first: true, last: true }): { u: number; flying: boolean } {
  "worklet";
  const b = beatsAt(k, place);
  const start = b.impactAt + index * burstGap(count, k);
  const fly = length(MOTION.spotlightBurstFly, k);
  const x = (t - start) / fly;
  return { u: curve(MOTION.spotlightBurstFly, x), flying: x >= 0 && x < 1 };
}

/** The night over the table, 0..1 of its opacity, `t` ms into a run of `count` attacks: in over the first dim, out over the last return. */
export function scrimAt(t: number, k: number, count: number): number {
  "worklet";
  const first = beatsAt(k, placeOf(0, count));
  if (t < first.dim) return curve(MOTION.spotlightDim, t / first.dim);
  const last = runStart(count - 1, count, k) + beatsAt(k, placeOf(count - 1, count)).retAt;
  if (t >= last) return 1 - clamp01((t - last) / length(MOTION.spotlightReturn, k));
  return 1;
}
