// The combat spotlight's stage and plan (phase 24): where the cards stand and what is drawn for the attacks of a real state. The gate is
// in spotlight-gate.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { playUntil, type Reduced } from "../../scripts/combat-policy.ts";
import { starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { clashesOf } from "./clash.ts";
import { tableLayout, type TableLayout } from "./layout.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import { PILES, pileSelector, zoneSelector, type PileId, type PileView, type ZoneId } from "./selectors.ts";
import { spotlightSpan } from "./spotlight-beats.ts";
import { buildPlan } from "./spotlight-plan.ts";
import { burstPoint, flown, stageOf } from "./spotlight-stage.ts";

const DECK = "stealth-and-steadfastness";
let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await starterWorld(DECK)).ctx;
});

const CANVAS = { width: 592, height: 346 };

function layoutOf(game: ScenarioState): TableLayout {
  const zones: ZoneId[] = ["questStage", "staging", "activeLocation", "secondActiveLocation", "engaged", "play", "hand"];
  const views = Object.fromEntries(zones.map((zone) => [zone, zoneSelector(zone, 0)(game)])) as Record<ZoneId, ReturnType<ReturnType<typeof zoneSelector>>>;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, 0)(game)])) as Record<PileId, PileView>;
  return tableLayout(CANVAS.width, CANVAS.height, views, piles, {});
}

// The first attack of the seeded game `wanted` accepts, with the Keep that opened it.
function attack(seed: number, keep: number, wanted: (reduced: Reduced) => boolean): Reduced {
  const start = expectOk(reduce(startScenario(starterStart(DECK, seed), ctx), { type: "Keep" }, ctx)).state;
  const found = playUntil(ctx, start, keep, (reduced) => clashesOf(reduced.prev, reduced.next, reduced.steps).length > 0 && wanted(reduced));
  if (!found) throw new Error(`Seed ${seed} never reached that attack`);
  return found;
}

describe("the stage", () => {
  const card = { w: 51, h: 71 };

  it("stands the attacker at the left and the target at the right, enlarged to 42% of the canvas, 24 pt apart, centered", () => {
    const stage = stageOf(CANVAS, card, 1, false);
    const [attacker] = stage.attackers;
    expect(attacker?.h).toBe(Math.round(SHAPE.spotlightHeight * CANVAS.height));
    expect(attacker?.w / attacker?.h).toBeCloseTo(card.w / card.h, 1);
    expect(stage.target.x - ((attacker?.x ?? 0) + (attacker?.w ?? 0))).toBe(SHAPE.spotlightGap);
    expect(attacker?.y).toBe(stage.target.y);
    // The pair is centered on the canvas.
    const left = attacker?.x ?? 0;
    const right = stage.target.x + stage.target.w;
    expect(Math.abs(left + right - CANVAS.width)).toBeLessThanOrEqual(2);
    // A pill under each, and the point of contact on the target's near edge.
    expect(stage.attackPill.cy).toBeGreaterThan(stage.target.y + stage.target.h);
    expect(stage.targetPill.cx).toBeCloseTo(stage.target.x + stage.target.w / 2, 6);
    expect(stage.contact.x).toBe(stage.target.x);
    expect(stage.corner.cx).toBeGreaterThan(stage.target.x + stage.target.w / 2);
    expect(stage.corner.cy).toBeLessThan(stage.target.y + stage.target.h / 2);
  });

  it("fans up to three attackers and says +n for the rest, the front one nearest the target", () => {
    expect(stageOf(CANVAS, card, 2, false).attackers).toHaveLength(2);
    const fan = stageOf(CANVAS, card, 3, false);
    expect(fan.attackers).toHaveLength(3);
    expect(fan.more).toBeNull();
    const more = stageOf(CANVAS, card, 5, false);
    expect(more.attackers).toHaveLength(SHAPE.spotlightFan);
    expect(more.more).not.toBeNull();
    const xs = more.attackers.map((rect) => rect.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const front = more.attackers[2];
    expect(more.target.x - ((front?.x ?? 0) + (front?.w ?? 0))).toBe(SHAPE.spotlightGap);
    expect(more.turns[0]).toBeLessThan(more.turns[2] ?? 0);
  });

  it("makes room for a turned shadow card at 80% to the left of the enemy, clear of its draw back", () => {
    const stage = stageOf(CANVAS, card, 1, true);
    const [enemy] = stage.attackers;
    const shadow = stage.shadow;
    expect(shadow?.w).toBe(Math.round((enemy?.w ?? 0) * SHAPE.spotlightShadow));
    expect((enemy?.x ?? 0) - ((shadow?.x ?? 0) + (shadow?.w ?? 0))).toBeGreaterThan(SHAPE.spotlightDrawBack);
    expect(stageOf(CANVAS, card, 1, false).shadow).toBeNull();
  });

  it("stays inside the canvas, shrinking when it is narrow", () => {
    for (const canvas of [CANVAS, { width: 500, height: 330 }, { width: 380, height: 300 }]) {
      for (const attackers of [1, 2, 3, 6]) {
        for (const shadow of [false, true]) {
          const stage = stageOf(canvas, card, attackers, shadow);
          const rects = [...stage.attackers, stage.target, ...(stage.shadow ? [stage.shadow] : [])];
          for (const rect of rects) {
            expect(rect.x, `${canvas.width} ${attackers} ${shadow}`).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.w).toBeLessThanOrEqual(canvas.width);
            expect(rect.y).toBeGreaterThanOrEqual(0);
          }
          expect(stage.word.cy + 9).toBeLessThanOrEqual(canvas.height);
          // The "2 of 3 · Tap to skip" line fits under the pills too, centered.
          expect(stage.note.cy + 9).toBeLessThanOrEqual(canvas.height);
          expect(stage.note.cy).toBeGreaterThan(stage.word.cy);
          expect(stage.note.cx).toBe(canvas.width / 2);
        }
      }
    }
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
    const stage = stageOf(CANVAS, card, 1, false);
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
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps);
    const before = layoutOf(reduced.prev);
    const after = layoutOf(reduced.next);
    const plan = buildPlan({ seq: 7, clashes, canvas: CANVAS, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, after] });
    const [first] = plan.clashes;
    expect(plan.seq).toBe(7);
    expect(plan.clashes).toHaveLength(1);
    expect(plan.span).toBe(MOTION.spotlight.ms);
    const enemy = first?.attackers[0];
    const slot = before.slots.find((candidate) => candidate.id === enemy?.id && candidate.kind !== "pile");
    expect(enemy?.from).toEqual({ x: slot?.x, y: slot?.y, w: slot?.w, h: slot?.h });
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
    const reduced = attack(1, 1, (found) => clashesOf(found.prev, found.next, found.steps)[0]?.shadow != null);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps);
    const before = layoutOf(reduced.prev);
    const plan = buildPlan({ seq: 1, clashes, canvas: CANVAS, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] });
    const shadow = plan.clashes[0]?.shadow;
    expect(shadow?.id).toBe(clashes[0]?.shadow);
    expect(shadow?.code).toBe(reduced.next.cards[shadow?.id ?? ""]?.code);
    expect(plan.clashes[0]?.stage.shadow).not.toBeNull();
    expect(plan.clashes[0]?.shape.shadow).toBe(true);
    expect(plan.codes).toContain(shadow?.code);
  });

  it("stands the players' attackers in the fan, in the gold of the players' attack", () => {
    const reduced = attack(115, 2, (found) => found.steps.some((step) => step.kind === "strike" && step.side === "player"));
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps);
    const before = layoutOf(reduced.prev);
    const plan = buildPlan({ seq: 1, clashes, canvas: CANVAS, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] });
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
        const second = seen.slice(index + 1).find((later) => clashesOf(later.prev, later.next, later.steps)[0]?.target === clashesOf(first.prev, first.next, first.steps)[0]?.target && !clashesOf(later.prev, later.next, later.steps)[0]?.destroyed);
        if (!second) continue;
        const clashes = [...clashesOf(first.prev, first.next, first.steps), ...clashesOf(second.prev, second.next, second.steps)];
        const target = clashes[0]?.target ?? "";
        const before = layoutOf(first.prev);
        const plan = buildPlan({ seq: 1, clashes, canvas: CANVAS, card: before.card, prev: first.prev, next: second.next, layouts: [before, layoutOf(second.next)] });
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
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps);
    const before = layoutOf(reduced.prev);
    const base = { canvas: CANVAS, card: before.card, prev: reduced.prev, next: reduced.next, layouts: [before, layoutOf(reduced.next)] };
    expect(buildPlan({ seq: 1, clashes, ...base }).clashes[0]?.shape).toMatchObject({ first: true, last: true });
    const three = buildPlan({ seq: 1, clashes: [...clashes, ...clashes, ...clashes], ...base });
    expect(three.clashes.map((plan) => [plan.shape.first, plan.shape.last])).toEqual([[true, false], [false, false], [false, true]]);
    expect(three.span).toBe(spotlightSpan(3));
  });

  it("runs several attacks one after another, and a card on neither table grows out of the middle", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps);
    const empty = layoutOf(reduced.prev);
    const bare: TableLayout = { ...empty, slots: [] };
    const plan = buildPlan({ seq: 1, clashes: [...clashes, ...clashes], canvas: CANVAS, card: empty.card, prev: reduced.prev, next: reduced.next, layouts: [bare] });
    expect(plan.clashes).toHaveLength(2);
    expect(plan.span).toBe(spotlightSpan(2));
    const from = plan.clashes[0]?.target.from;
    expect((from?.x ?? 0) + (from?.w ?? 0) / 2).toBeCloseTo(CANVAS.width / 2, 6);
  });
});
