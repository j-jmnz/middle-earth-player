// A spotlight nobody sees, for the web layer to draw once while the table is idle (spotlight/held-layer.tsx, use-warm-up.ts): on the
// web a canvas compiles each pipeline the first time something draws with it (about 200 ms for the spotlight), so the layer draws this plan
// through its one persistent canvas ahead of the first real attack, and every later spotlight finds the pipelines built. Three attacks
// reach every kind of picture the spotlight draws: a fan with a turned shadow card and a "+n" that hits, one that destroys and one that is
// blocked. The cards carry the code `WARM_CODE`, which the layer maps to a card back. Pure, so a test reads it.
import type { Clash } from "../store/clash.ts";
import { spotlightSpan } from "./beats.ts";
import { gaugeOf } from "./gauge.ts";
import type { ClashPlan, SpotCard, SpotlightPlan } from "./plan.ts";
import { SPOT } from "./shape.ts";
import { stageOf, type StageArea } from "./stage.ts";

/** The picture code the warm plan's cards carry. */
export const WARM_CODE = "warm";

// An upright card's size on the table, only for the stage's aspect.
const CARD = { w: 63, h: 88 };

const spot = (id: string, area: StageArea): SpotCard => ({ id, code: WARM_CODE, from: { x: area.width / 2, y: area.height / 2, w: CARD.w, h: CARD.h }, turn: 0 });

function clashOf(area: StageArea, index: number, total: number, clash: Clash): ClashPlan {
  const attackers = clash.attackers.slice(0, SPOT.fan).map((id) => spot(id, area));
  const shadow = clash.shadow ? spot(clash.shadow, area) : null;
  const before = 0;
  const stage = stageOf(area, CARD, clash.attackers.length, shadow != null);
  const gauge = gaugeOf(stage.gauge, { attack: clash.attack, defense: clash.defense, hitPoints: clash.hitPoints, undefended: clash.undefended, before, damage: clash.damage });
  return {
    clash,
    enemyAttack: index % 2 === 0,
    attackers,
    more: clash.attackers.length - attackers.length,
    target: spot(clash.target, area),
    shadow,
    stage,
    shape: { damage: clash.damage, destroyed: clash.destroyed, shadow: shadow != null, first: index === 0, last: index === total - 1, steps: gauge.steps },
    seed: index,
    before,
    after: before + clash.damage,
    gauge,
  };
}

/** The warm plan on a screen of this size. */
export function warmPlan(width: number, height: number): SpotlightPlan {
  const area: StageArea = { width, height, origin: { x: 0, y: 0 }, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  const base = { attack: 3, defense: 2, undefended: false, hitPoints: 4 };
  const clashes = [
    { ...base, attackers: ["a1", "a2", "a3", "a4"], target: "t1", damage: 2, destroyed: false, shadow: "s1" },
    { ...base, attackers: ["a5"], target: "t2", damage: 3, destroyed: true, shadow: null, hitPoints: 3 },
    { ...base, attackers: ["a6"], target: "t3", damage: 0, destroyed: false, shadow: null },
  ].map((clash, index, all) => clashOf(area, index, all.length, clash));
  return { seq: -1, clashes, codes: [WARM_CODE], span: spotlightSpan(clashes.length), canvas: { width, height }, area };
}
