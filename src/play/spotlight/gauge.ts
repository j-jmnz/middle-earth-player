// The gauge under the combat spotlight's target (docs/design-system-table.md, Spotlight): one shield glyph for each point of the
// target's defense, then one heart glyph for each of its hit points, on a patch of smoke straddling the card's foot. The attack breaks
// shields from the left; the hearts already lost before the attack are dark; each heart this attack fills lights red as its damage
// token lands in the target's corner (the token that lights it is `token`, in landing order). An undefended hero shows a struck-out
// shield instead. A row too long for the room it has turns its hearts, then its shields, into one glyph and a count.
// Pure: the layer draws what this returns, a Vitest reads it. Every number is the engine's (clash.ts, plan.ts): the attack, the
// defense, the target's hit points as the strike found them, its damage before the attack and the damage the attack placed.
import { SPOT } from "./shape.ts";

export type GaugeInput = { attack: number; defense: number; hitPoints: number; undefended: boolean; before: number; damage: number };

/** A shield glyph's centre, whether the attack breaks it, and whether it held a blocked attack. */
export type GaugeShield = { x: number; breaks: boolean; holds: boolean };

/** A heart glyph's centre and what it shows: lost before the attack, filled by it (lit when token `token` lands), or still whole. */
export type GaugeHeart = { x: number; was: "lost" | "fresh" | "whole"; token: number };

/**
 * A row shown as one glyph and a count: the glyph's centre, where its words start (`textX`), the number before the attack and after
 * it, the most it can be (a heart's hit points; a shield's is its defense), and the share of it the attack breaks or holds.
 */
export type GaugeCount = { x: number; textX: number; before: number; after: number; max: number; breaks: boolean; holds: boolean };

export type Gauge = {
  cx: number;
  cy: number;
  // The glyphs' size and the step between their centres; the whole row's width.
  size: number;
  step: number;
  width: number;
  // The struck-out shield of an undefended hero, at this centre; null when the target defended.
  mark: number | null;
  shields: GaugeShield[];
  shieldCount: GaugeCount | null;
  // The faint dot between the shields and the hearts; null with no shields.
  dot: number | null;
  hearts: GaugeHeart[];
  heartCount: GaugeCount | null;
  // Where each lit heart's sparks rise from, in landing order (a counted row: its one heart, once for each token).
  sparks: number[];
};

type Fit = { units: number; fixed: number };

// The units (glyph steps) and fixed points (counts' words) a row takes.
function fitOf(shields: number, hearts: number, mark: boolean, shieldCount: boolean, heartCount: boolean, s: number): Fit {
  const shieldUnits = shields === 0 ? 0 : shieldCount ? 1 : shields;
  const heartUnits = heartCount ? 1 : hearts;
  const sep = shieldUnits > 0 && heartUnits > 0 ? SPOT.gaugeSep : 0;
  return { units: (mark ? SPOT.gaugeMark : 0) + shieldUnits + sep + heartUnits, fixed: ((shieldCount && shields > 0 ? 1 : 0) + (heartCount ? 1 : 0)) * SPOT.gaugeCount * s };
}

/** The gauge at `at` (the stage's, in screen points) for an attack; `s` is the UI scale the stage was worked out at. */
export function gaugeOf(at: { cx: number; cy: number; room: number }, input: GaugeInput, s = 1): Gauge {
  const shields = input.undefended ? 0 : Math.max(0, input.defense);
  const hearts = Math.max(1, input.hitPoints);
  const mark = input.undefended;
  let shieldCount = shields > SPOT.gaugeShields;
  let heartCount = hearts > SPOT.gaugeHearts;
  const stepFor = (fit: Fit) => Math.min(SPOT.gaugeStep * s, (at.room - fit.fixed) / Math.max(1, fit.units));
  let fit = fitOf(shields, hearts, mark, shieldCount, heartCount, s);
  if (stepFor(fit) < SPOT.gaugeMinStep * s && !heartCount) {
    heartCount = true;
    fit = fitOf(shields, hearts, mark, shieldCount, heartCount, s);
  }
  if (stepFor(fit) < SPOT.gaugeMinStep * s && !shieldCount && shields > 0) {
    shieldCount = true;
    fit = fitOf(shields, hearts, mark, shieldCount, heartCount, s);
  }
  const step = stepFor(fit);
  const size = Math.min(SPOT.gaugeGlyph * s, step * 0.8);
  // The row's width: every step and count, less the space after the last glyph.
  const width = fit.units * step + fit.fixed - (step - size);
  let cursor = at.cx - width / 2;
  const centre = () => cursor + size / 2;

  const markX = mark ? centre() : null;
  if (mark) cursor += SPOT.gaugeMark * step;

  // The attack breaks the shields from the left, at most all of them; a blocked attack leaves the rest standing, and they held.
  const broken = Math.min(Math.max(0, input.attack), shields);
  const blocked = input.damage === 0;
  const shieldList: GaugeShield[] = [];
  let shieldBox: GaugeCount | null = null;
  if (shields > 0 && shieldCount) {
    const x = centre();
    shieldBox = { x, textX: x + size / 2 + 4 * s, before: shields, after: shields, max: shields, breaks: broken > 0, holds: blocked && broken < shields };
    cursor += step + SPOT.gaugeCount * s;
  } else {
    for (let at = 0; at < shields; at += 1) {
      shieldList.push({ x: centre(), breaks: at < broken, holds: blocked && at >= broken });
      cursor += step;
    }
  }
  // The dot sits halfway between the last shield's edge and the first heart's.
  const dot = shields > 0 ? (cursor - (step - size) + cursor + SPOT.gaugeSep * step) / 2 : null;
  if (shields > 0) cursor += SPOT.gaugeSep * step;

  // The hearts: the damage before the attack (at most every heart), then the damage it placed (at most what is left).
  const lost = Math.min(Math.max(0, input.before), hearts);
  const fresh = Math.min(Math.max(0, input.damage), hearts - lost);
  const heartList: GaugeHeart[] = [];
  let heartBox: GaugeCount | null = null;
  const sparks: number[] = [];
  if (heartCount) {
    const x = centre();
    heartBox = { x, textX: x + size / 2 + 4 * s, before: hearts - lost, after: Math.max(0, hearts - lost - Math.max(0, input.damage)), max: hearts, breaks: input.damage > 0, holds: false };
    for (let token = 0; token < Math.min(Math.max(0, input.damage), SPOT.embers); token += 1) sparks.push(x);
  } else {
    for (let at = 0; at < hearts; at += 1) {
      const x = centre();
      const was = at < lost ? "lost" : at < lost + fresh ? "fresh" : "whole";
      heartList.push({ x, was, token: was === "fresh" ? at - lost : -1 });
      if (was === "fresh" && sparks.length < SPOT.embers) sparks.push(x);
      cursor += step;
    }
  }
  return { cx: at.cx, cy: at.cy, size, step, width, mark: markX, shields: shieldList, shieldCount: shieldBox, dot, hearts: heartList, heartCount: heartBox, sparks };
}
