// Conditions about the combat phase: the attack in progress, the defender, who is engaged and the stats a holder reads against an enemy.
import { engagedThisRound } from "../../families/attack/events.ts";
import { attackingHolds } from "../../families/attack/strike.ts";
import { defendingAgainst } from "../../families/angmar/combat.ts";
import { inAreaOf } from "../../families/breaking/areas.ts";
import { encounterUncancelable } from "../../families/encounter/cancel.ts";
import { flagged } from "../../core/state.ts";
import { hasShadowEffect } from "../../families/defense/shadow.ts";
import { combatStepIs } from "../../families/defense/conditions.ts";
import { engagedThisPhase } from "../../families/quest/conditions.ts";
import { seatThreat } from "../../families/play/hooks.ts";
import { modifiedStat, versusDefender, versusHighEngagement } from "../../core/modified-stat.ts";
import { printedOf } from "../../core/printed.ts";
import { hostOf } from "../amounts.ts";
import type { ConditionHandlers } from "../condition-scope.ts";

export const combatHandlers = {
  // The attack in progress has no defender yet (or a shadow effect made it count as undefended); `is: false` asks for the defended one.
  undefended: (state, condition) => {
    const attack = state.pendingAttack;
    if (attack == null) return false;
    const undefended = attack.defenderId == null || attack.undefended === true;
    return undefended === (condition.is !== false);
  },
  // The shadow card dealt to the attacking enemy has an effect that is not resolved or canceled yet, whether it is dealt face down or face up (07009 shadowsFaceUp).
  shadowPending: (state, _condition, _scope, ctx) => {
    const attack = state.pendingAttack;
    if (attack == null || attack.shadowResolved === true || attack.shadowCanceled === true) return false;
    // No shadow effect of the Beast of Taur-nu-Fuin, of any enemy while Chieftain of the Pit is in play, or of an encounter card under The Eaves of Mirkwood can be canceled (rules/families/encounter/cancel.ts).
    if (flagged(state, attack.enemyId, "shadowsUncancelable") || flagged(state, "table", "allShadowsUncancelable") || encounterUncancelable(state)) return false;
    const shadowId = state.cards[attack.enemyId]?.shadowId;
    return shadowId != null && hasShadowEffect(state, shadowId, ctx);
  },
  defendingAgainst: (state, condition, scope, ctx) => {
    const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
    return holder != null && defendingAgainst(state, holder, condition.trait, ctx);
  },
  versusDefender: (state, condition, scope, ctx) => {
    const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
    return holder != null && versusDefender(state, holder, condition, ctx.cards);
  },
  versusHighEngagement: (state, condition, scope, ctx) => {
    const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
    return holder != null && versusHighEngagement(state, condition.role, holder, ctx.cards, scope.against);
  },
  inArea: (state, condition, scope) => {
    const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
    return holder != null && inAreaOf(state, holder, condition.seat);
  },
  attacking: (state, condition, scope, ctx) => {
    const id = scope.holderId ?? (condition.card === "host" ? hostOf(state, scope.sourceId) : condition.card === "subject" ? scope.subject : scope.sourceId);
    return attackingHolds(state, condition, id ? state.cards[id] : undefined, ctx, scope.against);
  },
  engagedThisRound: (state, condition, scope) => engagedThisRound(state, scope.actor) === condition.is,
  engagedThisPhase: (state, condition) => engagedThisPhase(state) === condition.is,
  // The combat step a card may be played in (09008, 02118, 143012).
  combatStep: (state, condition) => combatStepIs(state, condition.is),
  engagedWithActor: (state, _condition, scope) => {
    const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
    return source != null && source.zone === "engaged" && source.controller === scope.actor;
  },
  engagedAboveThreat: (state, _condition, scope, ctx) => {
    const enemy = scope.subject ? state.cards[scope.subject] : undefined;
    if (!enemy || scope.eventSeat !== scope.actor || enemy.controller !== scope.actor || printedOf(ctx.cards, enemy.code).engagementCost == null) return false;
    return modifiedStat(state, enemy, "engagementCost", ctx.cards) > seatThreat(state, scope.actor);
  },
} satisfies Partial<ConditionHandlers>;
