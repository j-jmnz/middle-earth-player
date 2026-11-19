// The combat spotlight's stage and plan (phase 24): where the cards stand and what is drawn for the attacks of a real state. The gate is
// in spotlight/gate.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { playUntil, type Reduced } from "../../../test/harness/combat-policy.ts";
import { starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { clashesOf } from "../store/clash.ts";
import { tableLayout, type TableLayout } from "../layout/layout.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { PILES, pileSelector, zoneSelector, type PileId, type PileView, type ZoneId } from "../store/selectors.ts";
import { spotlightSpan } from "./beats.ts";
import { buildPlan } from "./plan.ts";
import { SPOT } from "./shape.ts";
import { burstPoint, flown, sameArea, stageOf, type StageArea } from "./stage.ts";

const DECK = "stealth-and-steadfastness";
let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await starterWorld(DECK)).ctx;
});

const CANVAS = { width: 592, height: 346 };
// The screen the canvas sits on: the canvas is below a 52 pt top bar and 47 pt in from the left, with a command column to its right.
const AREA: StageArea = { width: 844, height: 390, origin: { x: 47, y: 52 }, safe: { top: 0, right: 47, bottom: 0, left: 47 } };

function layoutOf(game: ScenarioState): TableLayout {
  const zones: ZoneId[] = ["questStage", "staging", "activeLocation", "secondActiveLocation", "engaged", "play", "hand"];
  const views = Object.fromEntries(zones.map((zone) => [zone, zoneSelector(zone, 0)(game)])) as Record<ZoneId, ReturnType<ReturnType<typeof zoneSelector>>>;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, 0)(game)])) as Record<PileId, PileView>;
  return tableLayout(CANVAS.width, CANVAS.height, views, piles, {});
}

// The first attack of the seeded game `wanted` accepts, with the Keep that opened it.
function attack(seed: number, keep: number, wanted: (reduced: Reduced) => boolean): Reduced {
  const start = expectOk(reduce(startScenario(starterStart(DECK, seed), ctx), { type: "Keep" }, ctx)).state;
  const found = playUntil(ctx, start, keep, (reduced) => clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards).length > 0 && wanted(reduced));
  if (!found) throw new Error(`Seed ${seed} never reached that attack`);
  return found;
}

describe("the stage", () => {
  const card = { w: 51, h: 71 };
  const SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
  const area = (width: number, height: number, safe = SAFE, origin = { x: 0, y: 0 }): StageArea => ({ width, height, origin, safe });
  const PHONE = area(844, 390);

  it("stands the attacker at the left and the target at the right, 60% of the screen's height, a gap of at least 28 pt, centered", () => {
    const stage = stageOf(PHONE, card, 1, false);
    const [attacker] = stage.attackers;
    expect(attacker?.h).toBe(Math.round(SPOT.height * PHONE.height));
    expect(attacker?.h).toBe(234);
    expect(Math.abs((attacker?.w ?? 0) / (attacker?.h ?? 1) - card.w / card.h)).toBeLessThan(0.01);
    expect(stage.target.x - ((attacker?.x ?? 0) + (attacker?.w ?? 0))).toBe(Math.max(SPOT.gapMin, Math.round(SPOT.gapShare * (attacker?.w ?? 0))));
    expect(stage.gap).toBe(stage.target.x - ((attacker?.x ?? 0) + (attacker?.w ?? 0)));
    expect(attacker?.y).toBe(stage.target.y);
    // The pair is centered on the whole screen, with the cards' centers at 47% of its height.
    const left = attacker?.x ?? 0;
    const right = stage.target.x + stage.target.w;
    expect(Math.abs(left + right - PHONE.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(stage.target.y + stage.target.h / 2 - 0.47 * PHONE.height)).toBeLessThanOrEqual(1);
    // The attack value and the gauge straddle the cards' feet, the gauge may reach 25 pt past each side of the target, the caption is
    // under it; the point of contact is on the target's near edge, the number is at its center.
    expect(stage.badgeA.cy).toBe(stage.target.y + stage.target.h);
    expect(stage.gauge.cy).toBe(stage.target.y + stage.target.h);
    expect(stage.gauge.cx).toBeCloseTo(stage.target.x + stage.target.w / 2, 6);
    expect(stage.gauge.room).toBe(stage.target.w + 50);
    expect(stage.caption).toEqual({ cx: stage.gauge.cx, cy: stage.gauge.cy + SPOT.captionGap, right: PHONE.width - 8 });
    expect(stage.contact.x).toBe(stage.target.x);
    expect(stage.number).toEqual({ cx: stage.target.x + stage.target.w / 2, cy: stage.target.y + stage.target.h / 2 });
    expect(stage.corner.cx).toBeGreaterThan(stage.target.x + stage.target.w / 2);
    expect(stage.corner.cy).toBeLessThan(stage.target.y + stage.target.h / 2);
    expect(stage.drawBack).toBeGreaterThan(0);
  });

  it("caps the card at 340 pt on a tablet", () => {
    const tablet = stageOf(area(1280, 900), card, 1, false);
    expect(tablet.target.h).toBe(340);
    expect(tablet.cardH).toBe(340);
    expect(stageOf(area(1280, 500), card, 1, false).target.h).toBe(300);
  });

  it("fans up to three attackers 0.32 of a card apart, 6 degrees apart, and says +n for the rest, the front one nearest the target", () => {
    expect(stageOf(PHONE, card, 2, false).attackers).toHaveLength(2);
    const fan = stageOf(PHONE, card, 3, false);
    expect(fan.attackers).toHaveLength(3);
    expect(fan.more).toBeNull();
    const w = fan.attackers[0]?.w ?? 0;
    expect((fan.attackers[1]?.x ?? 0) - (fan.attackers[0]?.x ?? 0)).toBe(Math.round(w * 0.32));
    expect(fan.turns.map((turn) => Math.round((turn * 180) / Math.PI))).toEqual([-6, 0, 6]);
    const more = stageOf(PHONE, card, 5, false);
    expect(more.attackers).toHaveLength(SPOT.fan);
    expect(more.more).not.toBeNull();
    const xs = more.attackers.map((rect) => rect.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const front = more.attackers[2];
    expect(more.target.x - ((front?.x ?? 0) + (front?.w ?? 0))).toBe(more.gap);
    expect(more.turns[0]).toBeLessThan(more.turns[2] ?? 0);
    // The attack medallion sits under the fan, the defense one under the target.
    expect(more.badgeA.cx).toBeCloseTo((xs[0] ?? 0) + (w * (1 + 0.32 * 2)) / 2, 6);
  });

  it("makes room for a turned shadow card at 72%, bottom-aligned, 20 pt left of the fan", () => {
    const stage = stageOf(PHONE, card, 1, true);
    const [enemy] = stage.attackers;
    const shadow = stage.shadow;
    expect(shadow?.w).toBe(Math.round((enemy?.w ?? 0) * 0.72));
    expect((enemy?.x ?? 0) - ((shadow?.x ?? 0) + (shadow?.w ?? 0))).toBe(20);
    expect((shadow?.y ?? 0) + (shadow?.h ?? 0)).toBe((enemy?.y ?? 0) + (enemy?.h ?? 0));
    expect(stageOf(PHONE, card, 1, false).shadow).toBeNull();
    // The group, shadow card and all, is centered.
    const right = stage.target.x + stage.target.w;
    expect(Math.abs((shadow?.x ?? 0) + right - PHONE.width)).toBeLessThanOrEqual(2);
  });

  it("stays inside the screen and its safe insets, shrinking when the group is wider than the screen less the insets less 32 pt", () => {
    const safe = { top: 24, right: 47, bottom: 21, left: 47 };
    for (const screen of [area(844, 390, safe), area(667, 375, safe), area(568, 320, safe), area(480, 300, safe)]) {
      for (const attackers of [1, 2, 3, 6]) {
        for (const shadow of [false, true]) {
          const stage = stageOf(screen, card, attackers, shadow);
          const rects = [...stage.attackers, stage.target, ...(stage.shadow ? [stage.shadow] : [])];
          const key = `${screen.width} ${attackers} ${shadow}`;
          for (const rect of rects) {
            expect(rect.x, key).toBeGreaterThanOrEqual(safe.left);
            expect(rect.x + rect.w, key).toBeLessThanOrEqual(screen.width - safe.right);
            expect(rect.y, key).toBeGreaterThanOrEqual(0);
          }
          const left = Math.min(...rects.map((rect) => rect.x));
          const right = Math.max(...rects.map((rect) => rect.x + rect.w));
          expect(right - left, key).toBeLessThanOrEqual(screen.width - 2 * 47 - 32 + 1);
          // The note stands under the top inset and the cards clear it; the caption clears the bottom inset.
          expect(stage.note.cy - stage.note.h / 2, key).toBeGreaterThanOrEqual(safe.top);
          expect(stage.note.cy + stage.note.h / 2, key).toBeLessThan(stage.target.y);
          expect(stage.caption.cy + SPOT.captionHalf, key).toBeLessThanOrEqual(screen.height - safe.bottom);
          expect(stage.note.cx).toBe(screen.width / 2);
        }
      }
    }
    // A narrow screen shrinks the card below 60% of its height; a wide one does not.
    expect(stageOf(area(480, 300, safe), card, 3, true).target.h).toBeLessThan(Math.round(0.6 * 300));
    expect(stageOf(area(844, 390), card, 1, false).target.h).toBe(234);
  });

  it("shrinks a tall card when the caption would reach the bottom inset or the note the cards", () => {
    const flat = stageOf(area(844, 390), card, 1, false);
    const inset = stageOf(area(844, 390, { top: 0, right: 0, bottom: 34, left: 0 }), card, 1, false);
    expect(inset.target.h).toBeLessThan(flat.target.h);
    expect(inset.caption.cy + SPOT.captionHalf).toBeLessThanOrEqual(390 - 34);
    const notch = stageOf(area(844, 390, { top: 60, right: 0, bottom: 0, left: 0 }), card, 1, false);
    expect(notch.target.h).toBeLessThan(flat.target.h);
    expect(notch.note.cy + notch.note.h / 2).toBeLessThan(notch.target.y);
  });

  it("flies a card between its slot and the stage: at its slot at 0, at the stage at 1", () => {
    const from = { x: 20, y: 30, w: 51, h: 71 };
    const to = { x: 200, y: 60, w: 104, h: 145 };
    const there = flown(from, 0, to, 0, 1);
    expect([Math.abs(there.tx), Math.abs(there.ty), there.scale, there.turn]).toEqual([0, 0, 1, 0]);
    const home = flown(from, Math.PI / 2, to, 0, 0);
    expect(home.scale).toBeCloseTo(51 / 104, 6);
    expect(home.tx + to.x + to.w / 2).toBeCloseTo(from.x + from.w / 2, 6);
    expect(home.ty + to.y + to.h / 2).toBeCloseTo(from.y + from.h / 2, 6);
    expect(home.turn).toBeCloseTo(Math.PI / 2, 6);
  });

  it("sends each damage token from the point of contact to the target's corner, fading into it", () => {
    const stage = stageOf({ width: 844, height: 390, origin: { x: 0, y: 0 }, safe: { top: 0, right: 0, bottom: 0, left: 0 } }, card, 1, false);
    const start = burstPoint(stage, 1, 3, 0);
    const end = burstPoint(stage, 1, 3, 1);
    expect([start.x, start.y]).toEqual([stage.contact.x, stage.contact.y]);
    expect(end.x).toBeCloseTo(stage.corner.cx, 6);
    expect(end.y).toBeCloseTo(stage.corner.cy, 6);
    expect(end.scale).toBeCloseTo(1, 6);
    expect(end.opacity).toBeCloseTo(0, 6);
    expect(burstPoint(stage, 1, 3, 0.5).opacity).toBe(1);
  });
});

describe("the plan for a real state", () => {
  it("names who flies from where: the cards' slots before the state, the pictures, and the target's damage before and after", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const before = layoutOf(reduced.prev);
    const after = layoutOf(reduced.next);
    const plan = buildPlan({ seq: 7, clashes, canvas: CANVAS, area: AREA, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, after] });
    const [first] = plan.clashes;
    expect(plan.seq).toBe(7);
    expect(plan.clashes).toHaveLength(1);
    expect(plan.span).toBe(MOTION.spotlight.ms);
    expect(plan.span).toBe(3200);
    const enemy = first?.attackers[0];
    const slot = before.slots.find((candidate) => candidate.id === enemy?.id && candidate.kind !== "pile");
    // The slot is in canvas points; the plan carries it onto the screen by the canvas's origin.
    expect(enemy?.from).toEqual({ x: (slot?.x ?? 0) + AREA.origin.x, y: (slot?.y ?? 0) + AREA.origin.y, w: slot?.w, h: slot?.h });
    expect(plan.area).toBe(AREA);
    expect(enemy?.code).toBe(reduced.prev.cards[enemy?.id ?? ""]?.code);
    expect(first?.enemyAttack).toBe(true);
    // The count is the engine's: the state before and the state after.
    const target = first?.target.id ?? "";
    expect(first?.before).toBe(reduced.prev.cards[target]?.damage);
    expect(first?.after).toBe(reduced.next.cards[target]?.damage);
    expect((first?.after ?? 0) - (first?.before ?? 0)).toBe(first?.clash.damage);
    // The pictures it needs are the codes of the cards it draws, once each.
    expect(plan.codes).toContain(enemy?.code);
    expect(plan.codes).toContain(first?.target.code);
    expect(new Set(plan.codes).size).toBe(plan.codes.length);
  });

  it("flies a turned shadow card from under its enemy and flips to the face the state names", () => {
    const reduced = attack(1, 1, (found) => clashesOf(found.prev, found.next, found.steps, ctx.cards)[0]?.shadow != null);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const before = layoutOf(reduced.prev);
    const plan = buildPlan({ seq: 1, clashes, canvas: CANVAS, area: AREA, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] });
    const shadow = plan.clashes[0]?.shadow;
    expect(shadow?.id).toBe(clashes[0]?.shadow);
    expect(shadow?.code).toBe(reduced.next.cards[shadow?.id ?? ""]?.code);
    expect(plan.clashes[0]?.stage.shadow).not.toBeNull();
    expect(plan.clashes[0]?.shape.shadow).toBe(true);
    expect(plan.codes).toContain(shadow?.code);
  });

  it("stands the players' attackers in the fan, in the accent of the players' attack", () => {
    const reduced = attack(115, 2, (found) => found.steps.some((step) => step.kind === "strike" && step.side === "player"));
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const before = layoutOf(reduced.prev);
    const plan = buildPlan({ seq: 1, clashes, canvas: CANVAS, area: AREA, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] });
    expect(plan.clashes[0]?.enemyAttack).toBe(false);
    expect(plan.clashes[0]?.attackers.map((spot) => spot.id)).toEqual(clashes[0]?.attackers);
    expect(plan.clashes[0]?.stage.attackers).toHaveLength(2);
    expect(plan.clashes[0]?.shape).toEqual({ damage: clashes[0]?.damage, destroyed: true, shadow: false, first: true, last: true });
  });

  it("counts two attacks on one target up in turn, ending on the state's own count", () => {
    // Two consecutive attacks of a played game that hit the same card, joined as one state resolving both.
    for (const seed of [1, 2, 3, 4, 5, 6, 8, 9, 10]) {
      let state = expectOk(reduce(startScenario(starterStart(DECK, seed), ctx), { type: "Keep" }, ctx)).state;
      const seen: { prev: ScenarioState; next: ScenarioState; steps: Reduced["steps"] }[] = [];
      for (let turn = 0; turn < 900 && !state.lost; turn += 1) {
        const found = playUntil(ctx, state, 1, (reduced) => reduced.steps.some((step) => step.kind === "strike"));
        if (!found) break;
        seen.push(found);
        state = found.next;
      }
      for (const [index, first] of seen.entries()) {
        const second = seen.slice(index + 1).find((later) => clashesOf(later.prev, later.next, later.steps, ctx.cards)[0]?.target === clashesOf(first.prev, first.next, first.steps, ctx.cards)[0]?.target && !clashesOf(later.prev, later.next, later.steps, ctx.cards)[0]?.destroyed);
        if (!second) continue;
        const clashes = [...clashesOf(first.prev, first.next, first.steps, ctx.cards), ...clashesOf(second.prev, second.next, second.steps, ctx.cards)];
        const target = clashes[0]?.target ?? "";
        const before = layoutOf(first.prev);
        const plan = buildPlan({ seq: 1, clashes, canvas: CANVAS, area: AREA, card: before.card, prev: first.prev, next: second.next, layouts: [before, layoutOf(second.next)] });
        const [one, two] = plan.clashes;
        const start = first.prev.cards[target]?.damage ?? 0;
        expect([one?.before, one?.after]).toEqual([start, start + (clashes[0]?.damage ?? 0)]);
        expect(two?.before).toBe(one?.after);
        expect(two?.after).toBe((two?.before ?? 0) + (clashes[1]?.damage ?? 0));
        // The last count is the state's own.
        expect(two?.after).toBe(second.next.cards[target]?.damage);
        return;
      }
    }
    throw new Error("No two attacks on one target in those games");
  });

  it("marks the first attack as the one that dims and the last as the one that goes back", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const before = layoutOf(reduced.prev);
    const base = { canvas: CANVAS, area: AREA, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] };
    expect(buildPlan({ seq: 1, clashes, ...base }).clashes[0]?.shape).toMatchObject({ first: true, last: true });
    const three = buildPlan({ seq: 1, clashes: [...clashes, ...clashes, ...clashes], ...base });
    expect(three.clashes.map((plan) => [plan.shape.first, plan.shape.last])).toEqual([[true, false], [false, false], [false, true]]);
    expect(three.span).toBe(spotlightSpan(3));
  });

  it("seeds each attack's random effects with the moment's seq times 31 plus its index", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const before = layoutOf(reduced.prev);
    const base = { canvas: CANVAS, area: AREA, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] };
    const plan = buildPlan({ seq: 7, clashes: [...clashes, ...clashes, ...clashes], ...base });
    expect(plan.clashes.map((entry) => entry.seed)).toEqual([7 * 31, 7 * 31 + 1, 7 * 31 + 2]);
  });

  it("works the stage out on the screen area, and moves the whole stage with its size and insets, not with the canvas's origin", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const before = layoutOf(reduced.prev);
    const base = { seq: 1, clashes, canvas: CANVAS, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] };
    const one = buildPlan({ ...base, area: AREA }).clashes[0];
    const moved = buildPlan({ ...base, area: { ...AREA, origin: { x: 0, y: 0 } } }).clashes[0];
    expect(one?.stage).toEqual(moved?.stage);
    expect(one?.attackers[0]?.from.x).toBe((moved?.attackers[0]?.from.x ?? 0) + AREA.origin.x);
    expect(one?.stage.target.h).toBe(Math.round(0.6 * AREA.height));
    const tall = buildPlan({ ...base, area: { ...AREA, height: 500 } }).clashes[0];
    expect(tall?.stage.target.h).toBe(300);
    expect(sameArea(AREA, { ...AREA })).toBe(true);
    expect(sameArea(AREA, { ...AREA, origin: { x: 48, y: 52 } })).toBe(false);
    expect(sameArea(AREA, { ...AREA, safe: { ...AREA.safe, bottom: 1 } })).toBe(false);
    expect(sameArea(AREA, { ...AREA, height: 391 })).toBe(false);
  });

  it("runs several attacks one after another, and a card on neither table grows out of the middle", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const empty = layoutOf(reduced.prev);
    const bare: TableLayout = { ...empty, slots: [] };
    const plan = buildPlan({ seq: 1, clashes: [...clashes, ...clashes], canvas: CANVAS, area: AREA, card: empty.card, prev: reduced.prev, next: reduced.next, layouts: [bare] });
    expect(plan.clashes).toHaveLength(2);
    expect(plan.span).toBe(spotlightSpan(2));
    const from = plan.clashes[0]?.target.from;
    expect((from?.x ?? 0) + (from?.w ?? 0) / 2).toBeCloseTo(CANVAS.width / 2 + AREA.origin.x, 6);
    expect((from?.y ?? 0) + (from?.h ?? 0) / 2).toBeCloseTo(CANVAS.height / 2 + AREA.origin.y, 6);
  });
});
