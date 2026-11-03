// Rules: dcce.grapple (data/rules/entries.json); ledger lines 12051:A:1, 12052:A:2, 12053:A:1, 12054:A:1. Grapple (highest or lowest printed Threat or quest points): an enemy with the keyword that is revealed,
// or whose keyword an effect resolves, attaches facedown to the location in the staging area the keyword names. While grappled with a location an enemy is in play, not in the staging area: it cannot
// be engaged, no player card effect can choose it (it is immune: no filter looks at its zone) and it adds 2 Threat to its location (grapple/values.ts). When the location becomes the active location, or is
// explored from the staging area, the enemies grappled with it are detached, flipped faceup and added to the staging area (zones.ts releaseGrappled); any other exit discards them with it (discardGrappled).
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../choices.ts";
import { currentCause, ruleCause, UNATTRIBUTED } from "../../cause.ts";
import { pushEffectFrame } from "../../effect-frames.ts";
import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import { lastPicked } from "../../player-verbs.ts";
import { printedOf, type PrintedCard } from "../../printed.ts";
import { printedStat } from "../../printed-stat.ts";
import type { ScenarioState } from "../../state.ts";
import { updateCard } from "../../state.ts";
import { moveCard } from "../../zones.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The locations in the staging area the keyword names: the highest or lowest printed Threat or quest points among those there. More than one when they are tied. */
export function grappleTargets(state: ScenarioState, rule: NonNullable<PrintedCard["keywords"]["grapple"]>, ctx: ReduceContext): string[] {
  const stat = rule.endsWith("Threat") ? "threat" : "questPoints";
  const locations = state.staging.filter((id) => {
    const card = state.cards[id];
    return card != null && printedOf(ctx.cards, card.code).type === "location";
  });
  const value = (id: string): number => {
    const card = state.cards[id];
    return card ? printedStat(printedOf(ctx.cards, card.code), stat, card.face) : 0;
  };
  const best = locations.reduce<number | null>((found, id) => (found == null ? value(id) : rule.startsWith("highest") ? Math.max(found, value(id)) : Math.min(found, value(id))), null);
  return locations.filter((id) => value(id) === best);
}

/** Whether the enemy being revealed grapples: it has the keyword and a location is in the staging area (with none it is added to the staging area as any enemy is). */
export function grapplesOnReveal(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  const rule = card ? printedOf(ctx.cards, card.code).keywords.grapple : null;
  return rule != null && printedOf(ctx.cards, card?.code ?? "").type === "enemy" && grappleTargets(state, rule, ctx).length > 0;
}

/** The enemy is revealed: "when an enemy with the Grapple keyword is revealed ... immediately attach that enemy facedown" (dcce.grapple). The resolution waits for the first player in a frame of its own, above the reveal. */
export function pushGrapple(state: ScenarioState, id: string, seat: number, steps: EngineStep[]): ScenarioState {
  return pushEffectFrame(state, { frame: "forced", sourceId: id, actor: state.firstPlayer, peril: false, effectId: `${state.cards[id]?.code ?? ""}:grapple`, instructions: [{ verb: "ResolveGrapple", card: id }], eventSeat: seat, cancel: null, blockCancel: null, cause: ruleCause("dcce.grapple") }, steps);
}

/** ResolveGrapple: the enemy attaches facedown to the location its keyword names, the first player choosing among those tied; with no location in the staging area it is added to the staging area. */
export function resolveGrapple(state: ScenarioState, instruction: Verb<"ResolveGrapple">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = instruction.card ?? (instruction.target === "picked" ? lastPicked(state) : focus.sourceId);
  const enemy = id ? state.cards[id] : undefined;
  const printed = enemy ? printedOf(ctx.cards, enemy.code) : null;
  const rule = printed?.keywords.grapple ?? null;
  if (!id || !enemy || printed?.type !== "enemy" || rule == null || enemy.zone === "grappled") return state;
  const targets = grappleTargets(state, rule, ctx);
  if (targets.length === 0) return enemy.zone === "staging" ? state : moveEncounter(state, id, "staging", state.firstPlayer, ctx, steps);
  const chosen = focus.chosen && targets.includes(focus.chosen) ? focus.chosen : targets.length === 1 ? targets[0] : undefined;
  if (!chosen) {
    // The first player chooses among tied locations (dcce.grapple): with no effect frame there is nobody to ask, and no location is picked for them.
    if (!effectData(state)) throw new Error(`Grapple of ${enemy.code} ties ${targets.length} locations with no effect open to ask the first player`);
    return askTarget(state, { instruction: { ...instruction, card: id }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, targets);
  }
  steps.push({ kind: "grapple", enemyId: id, locationId: chosen });
  return updateCard(moveCard(state, id, { zone: "grappled", locationId: chosen }), id, { face: "down", controller: null, exhausted: false });
}
