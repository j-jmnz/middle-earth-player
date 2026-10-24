// Rules: rr.step-6-2 (data/rules/entries.json).
import { pushEffectFrame } from "./effect-frames.ts";
import { holdsNow } from "./verbs.ts";
import type { EngineStep } from "./intents.ts";
import { runInstruction, type ReduceContext } from "./interpret.ts";
import { modifiedStat, placeDamage } from "./keywords.ts";
import type { ScenarioState } from "./state.ts";
import { expireModifiers, updateCard } from "./state.ts";
import { withFrame } from "./windows.ts";
import { moveCard } from "./zones.ts";
import { effectCause, inCause, ruleCause } from "./cause.ts";
import { offerResponses } from "./responses.ts";

// Turns the attacker's shadow card up and runs its shadow effects in their own frame. The attack in
// progress is on state.pendingAttack, so an effect can read whether it is defended and change it.
function resolveShadow(state: ScenarioState, enemyId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const shadowId = state.cards[enemyId]?.shadowId;
  const shadow = shadowId ? state.cards[shadowId] : undefined;
  if (!shadowId || !shadow) return state;
  const turned = updateCard(state, shadowId, { face: "up" });
  const resolved = withFrame(turned, "shadow", shadowId, false, (framed) => {
    let next = framed;
    for (const effect of ctx.effects) {
      if (effect.cardCode !== shadow.code || effect.timing !== "shadow") continue;
      for (const instruction of effect.instructions) {
        if (!holdsNow(next, instruction, { actor: seat, sourceId: shadowId, returned: 0 }, ctx)) continue;
        next = inCause(steps, effectCause(effect), () => runInstruction(next, instruction, { seat, sourceId: shadowId }, ctx, steps));
        if (next.lost || next.failure) return next;
      }
    }
    return next;
  }, steps);
  if (!resolved.cards[shadowId]) return resolved;
  return moveCard(resolved, shadowId, { zone: "encounterDiscard" });
}

// End of the combat phase: every shadow card still dealt is discarded unused (Learn to Play p16).
export function discardShadows(state: ScenarioState): ScenarioState {
  let next = state;
  for (const instance of Object.values(state.cards)) {
    if (instance.zone === "shadow") next = moveCard(next, instance.id, { zone: "encounterDiscard" });
  }
  return next;
}

function hasShadowEffect(state: ScenarioState, enemyId: string, ctx: ReduceContext): boolean {
  const shadow = state.cards[state.cards[enemyId]?.shadowId ?? ""];
  return shadow != null && ctx.effects.some((effect) => effect.cardCode === shadow.code && effect.timing === "shadow");
}

// Runs once the defender is declared or the hero is named. The shadow resolves first, then damage.
export function resolveAttack(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  const begun = next.pendingAttack;
  if (!begun) return state;
  if (!begun.shadowResolved) {
    // The shadow effect has just triggered: a Response may cancel it first (Hasty Stroke). The attack waits for the
    // Responses, and settle comes back here when they are done.
    if (!begun.shadowOffered && hasShadowEffect(next, begun.enemyId, ctx)) {
      const offered = offerResponses({ ...next, pendingAttack: { ...begun, shadowOffered: true } }, { trigger: "shadowPending", seat: begun.seat }, ctx, steps);
      // The defense window is over: the defender is declared. Settle runs the Responses, then the attack goes on.
      if (offered.stack.length > next.stack.length) return { ...offered, window: null };
      next = offered;
    }
    const current = next.pendingAttack ?? begun;
    next = { ...next, pendingAttack: { ...current, shadowResolved: true } };
    if (!current.shadowCanceled) next = resolveShadow(next, begun.enemyId, begun.seat, ctx, steps);
    if (next.lost || next.failure) return next;
  }
  const attack = next.pendingAttack;
  const enemy = attack ? next.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || enemy.zone !== "engaged") return finishAttack(next, ctx, steps);
  if (attack.defenderId != null && !attack.undefended) {
    const defender = next.cards[attack.defenderId];
    const raw = defender ? Math.max(0, modifiedStat(next, enemy, "attack", ctx.cards) - modifiedStat(next, defender, "defense", ctx.cards)) : 0;
    const damaged = defender ? placeDamage(next, attack.defenderId, raw, ctx.cards, steps, "framework", ruleCause("rr.step-6-4-3")) : next;
    return damaged.lost ? damaged : finishAttack(damaged, ctx, steps);
  }
  // A shadow effect made a defended attack undefended: the player still names the hero who takes it.
  if (attack.heroId == null) return { ...next, window: { kind: "defense", enemyId: attack.enemyId, seat: attack.seat } };
  const hit = placeDamage(next, attack.heroId, modifiedStat(next, enemy, "attack", ctx.cards), ctx.cards, steps, "framework", ruleCause("rr.step-6-4-3"));
  return hit.lost ? hit : finishAttack(hit, ctx, steps);
}

// Ends the attack: endOfAttack modifiers expire, the enemy's attack is used up, and instructions a
// shadow effect left for after the attack run in a frame of their own.
export function finishAttack(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  const done = expireModifiers(state, ["endOfAttack"]);
  const resolvedAttacks =
    attack.immediate || done.resolvedAttacks.includes(attack.enemyId) ? done.resolvedAttacks : [...done.resolvedAttacks, attack.enemyId];
  const ended: ScenarioState = { ...done, pendingAttack: null, window: null, resolvedAttacks };
  const after = attack.after ?? [];
  if (after.length === 0 || ended.cards[attack.enemyId]?.zone !== "engaged") return ended;
  return pushEffectFrame(
    ended,
    {
      frame: "shadow",
      sourceId: attack.enemyId,
      actor: attack.seat,
      peril: false,
      effectId: `${attack.enemyId}:afterAttack`,
      instructions: after,
      cancel: null,
      blockCancel: null,
      ...(attack.afterCause ? { cause: attack.afterCause } : {}),
    },
    steps,
  );
}
