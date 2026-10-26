// Rules: rr.engagement-check, rr.optional-engagement, rr.step-5-2, rr.step-5-3, rr.engaged, rr.lasting-effects
// (data/rules/entries.json).
// Engagement for the quest family: an enemy that makes no engagement checks against one player, or cannot engage one player
// (the modifier's seat), the mark an engagement leaves on the encounter phase, and optional engagements (an additional one,
// and the event "After you optionally engage an enemy").
import type { ReduceContext } from "../interpret.ts";
import { optionalEnemies } from "../quest.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, heldAmount, modifierActive } from "../state.ts";
import { queueHeard } from "./quest-events.ts";

// The enemy is barred from this seat: it cannot engage it (`engage`), or, for an engagement check, it also makes none against
// it (`checks`, 19009:A:2, 22061:A:1, 06056:A:1).
export function engagementBarred(state: ScenarioState, enemyId: string, seat: number, what: "checks" | "engage"): boolean {
  return state.modifiers.some(
    (modifier) =>
      modifier.instanceId === enemyId &&
      (modifier.stat === "cannotEngageSeat" || (what === "checks" && modifier.stat === "noChecksAgainst")) &&
      (modifier.seat == null || modifier.seat === seat) &&
      modifierActive(state, modifier),
  );
}

// An enemy engaged a player in the encounter phase: the table remembers it until the phase ends ("If no enemies were engaged
// this phase", 12065:A:2).
export function noteEngaged(state: ScenarioState, enemyId: string): ScenarioState {
  if (state.phase !== "Encounter" || flagged(state, "table", "engagedThisPhase")) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: enemyId, stat: "engagedThisPhase", amount: 1, until: "endOfPhase" }] };
}

// The seat optionally engaged the enemy (rr.optional-engagement): the event is announced, and a seat that may engage more than
// one counts the engagement until the phase ends.
export function optionallyEngaged(state: ScenarioState, seat: number, enemyId: string, ctx: ReduceContext): ScenarioState {
  const enemy = state.cards[enemyId];
  if (!enemy || enemy.zone !== "engaged" || enemy.controller !== seat) return state;
  const announced = queueHeard(state, ctx, { trigger: "optionallyEngaged", seat, subject: enemyId });
  if (heldAmount(announced, `seat:${seat}`, "extraOptionalEngage") <= 0) return announced;
  return { ...announced, modifiers: [...announced.modifiers, { instanceId: `seat:${seat}`, sourceId: enemyId, stat: "optionalEngagements", amount: 1, until: "endOfPhase" }] };
}

// "You may optionally engage 1 additional enemy during the encounter phase" (09002:A:2): the seat keeps its option while it has
// engaged fewer than 1 plus its additional engagements, and some enemy can still be engaged.
export function engagesAgain(state: ScenarioState, seat: number, ctx: ReduceContext): boolean {
  const extra = heldAmount(state, `seat:${seat}`, "extraOptionalEngage");
  if (extra <= 0 || state.window?.kind !== "optionalEngage") return false;
  return heldAmount(state, `seat:${seat}`, "optionalEngagements") < 1 + extra && optionalEnemies(state, ctx.cards).length > 0;
}
