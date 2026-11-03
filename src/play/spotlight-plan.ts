// What the combat spotlight draws for the attacks of one new state (docs/design-system-table.md, Spotlight; phase 24). Pure: the
// clashes (clash.ts) say who fought and every number; this adds where each card stands on the table now (so it can fly from its slot
// and back to it), its picture's code, and the target's damage count before and after (the engine's, read from the two states). The
// canvas holds the pictures; the plan names the codes it needs.
import type { ScenarioState } from "../rules/core/state.ts";

import type { Clash } from "./clash.ts";
import type { Rect, TableLayout } from "./layout.ts";
import { slotRotation } from "./motion.ts";
import { SPOT } from "./spotlight-shape.ts";
import type { ClashShape } from "./spotlight-beats.ts";
import { spotlightSpan } from "./spotlight-beats.ts";
import { stageOf, type Stage, type StageArea } from "./spotlight-stage.ts";

/** A card in the spotlight: its picture's code, the rectangle it stands in on the table (upright) and the turn it is drawn with. */
export type SpotCard = { id: string; code: string; from: Rect; turn: number };

export type ClashPlan = {
  clash: Clash;
  // An enemy attacks (its attack icon is threat red) or the players do (accent).
  enemyAttack: boolean;
  // The attackers in the fan, and how many more there are than it shows.
  attackers: SpotCard[];
  more: number;
  target: SpotCard;
  // The shadow card the attack turned: the face it flips to, standing beside the enemy; null when none was turned.
  shadow: SpotCard | null;
  stage: Stage;
  shape: ClashShape;
  // The seed of the attack's random effects (the shake, the particles, the burn): the moment's `seq` times 31 plus the attack's index.
  seed: number;
  // The target's damage count before this attack and after it: the state's count before the intent, plus the damage of the
  // attacks before this one on the same target (all the engine's numbers).
  before: number;
  after: number;
};

export type SpotlightPlan = {
  // The moment whose clashes these are (store.ts, `spotlight.seq`).
  seq: number;
  clashes: ClashPlan[];
  // The pictures the plan draws, which the canvas asks its image cache for.
  codes: string[];
  // The run of all the attacks, unscaled.
  span: number;
  canvas: { width: number; height: number };
  // The screen area the stage was worked out for.
  area: StageArea;
};

export type PlanInput = {
  seq: number;
  clashes: readonly Clash[];
  canvas: { width: number; height: number };
  // The screen area the stage fills: its size, where the canvas's corner is on it, and the safe insets (spotlight-stage.ts).
  area: StageArea;
  // The table's card size, which the stage keeps the aspect of.
  card: { w: number; h: number };
  prev: ScenarioState;
  next: ScenarioState;
  // The layouts before and after the state: a card flies from where it stood before, else where it stands now.
  layouts: readonly TableLayout[];
  // The UI scale the table is laid out at (ui-scale.ts); the stage is Medium's sizes times it. Default 1.
  scale?: number;
};

function cardOf(state: ScenarioState, other: ScenarioState, id: string): { code: string } | null {
  const card = state.cards[id] ?? other.cards[id];
  return card ? { code: card.code } : null;
}

// A card's place on the screen in the first layout that has it: its slot (canvas points) moved by the canvas's origin on the screen.
// A card on neither (an enemy engaged with the other seat) grows out of the middle of the canvas.
function placeOf(layouts: readonly TableLayout[], id: string, card: { w: number; h: number }, canvas: { width: number; height: number }, origin: { x: number; y: number }): { from: Rect; turn: number } {
  for (const layout of layouts) {
    const slot = layout.slots.find((candidate) => candidate.id === id && candidate.kind !== "pile");
    if (slot) return { from: { x: slot.x + origin.x, y: slot.y + origin.y, w: slot.w, h: slot.h }, turn: slotRotation(slot) };
  }
  return { from: { x: (canvas.width - card.w) / 2 + origin.x, y: (canvas.height - card.h) / 2 + origin.y, w: card.w, h: card.h }, turn: 0 };
}

/** The plan for a state's clashes, in order. A clash with a card the game does not know (no code) is left out. */
export function buildPlan(input: PlanInput): SpotlightPlan {
  const { prev, next, layouts, canvas, card, area } = input;
  const spot = (id: string, place = id): SpotCard | null => {
    const known = cardOf(next, prev, id);
    return known ? { id, code: known.code, ...placeOf(layouts, place, card, canvas, area.origin) } : null;
  };
  const isEnemy = (id: string) => prev.staging.includes(id) || prev.seats.some((seat) => seat.engaged.includes(id));
  const entries: Omit<ClashPlan, "shape" | "seed">[] = [];
  // The damage each target took from the attacks before this one, so two attacks on one target count up in turn.
  const taken = new Map<string, number>();
  for (const clash of input.clashes) {
    const before = (prev.cards[clash.target]?.damage ?? 0) + (taken.get(clash.target) ?? 0);
    taken.set(clash.target, (taken.get(clash.target) ?? 0) + clash.damage);
    const everyone = clash.attackers.flatMap((id) => spot(id) ?? []);
    const target = spot(clash.target);
    if (everyone.length === 0 || !target) continue;
    // A shadow card lies under its enemy until it turns, so it flies out from there when no slot of its own is found.
    const enemy = clash.attackers[0] ?? "";
    const turned = clash.shadow ? spot(clash.shadow, layouts.some((layout) => layout.slots.some((slot) => slot.id === clash.shadow)) ? clash.shadow : enemy) : null;
    const shown = everyone.slice(0, SPOT.fan);
    entries.push({
      clash,
      enemyAttack: isEnemy(enemy) && clash.attackers.length === 1,
      attackers: shown,
      more: Math.max(0, everyone.length - shown.length),
      target,
      shadow: turned,
      stage: stageOf(area, card, everyone.length, turned != null, input.scale ?? 1),
      before,
      after: before + clash.damage,
    });
  }
  const clashes: ClashPlan[] = entries.map((entry, index) => ({ ...entry, seed: input.seq * 31 + index, shape: { damage: entry.clash.damage, destroyed: entry.clash.destroyed, shadow: entry.shadow != null, first: index === 0, last: index === entries.length - 1 } }));
  const codes = [...new Set(clashes.flatMap((plan) => [...plan.attackers, plan.target, ...(plan.shadow ? [plan.shadow] : [])].map((entry) => entry.code)))];
  return { seq: input.seq, clashes, codes, span: spotlightSpan(clashes.length), canvas, area };
}
