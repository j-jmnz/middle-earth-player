// Conditions about the seats: threat, the first player, the hand, the heroes and what a seat could pay.
import { DIRE_VALOUR_SHIFT } from "../../families/black-gate/dire.ts";
import { firstPlayerFor } from "../../families/breaking/areas.ts";
import { spendablePools } from "../../families/costs/verbs.ts";
import { distinctTraitCount } from "../../families/misc/traits.ts";
import { raiseEliminates } from "../../core/eliminate.ts";
import { seatThreat } from "../../families/play/hooks.ts";
import { alliesWillpowerHolds } from "../../families/sea/skirmisher.ts";
import { lastHideFailed } from "../../families/nightmare/guards.ts";
import { livingSeats } from "../../core/state.ts";
import { resolveAmount, type AmountScope } from "../amounts.ts";
import type { ConditionHandlers } from "../condition-scope.ts";

export const playerHandlers = {
  hideFailed: (state, condition, scope) =>
    state.hideFailures.some(
      (failure) =>
        failure.seat === scope.actor &&
        failure.round === state.round &&
        (condition.scope === "round" || failure.phase === state.phase),
    ),
  lastHideFailed: (state) => lastHideFailed(state),
  handSize: (state, condition, scope) => (condition.actor === true ? [scope.actor] : livingSeats(state)).every((seat) => (state.seats[seat]?.hand.length ?? 0) <= condition.max),
  handHasCard: (state, _condition, scope) => (state.seats[scope.actor]?.hand ?? []).some((id) => id !== scope.sourceId),
  firstPlayer: (state, _condition, scope) => scope.actor === firstPlayerFor(state, scope.actor),
  less: (state, condition, scope, ctx) => {
    const read: AmountScope = { actor: scope.actor, sourceId: scope.sourceId, ...(scope.picked ? { picked: scope.picked } : {}), ...(scope.subject ? { subject: scope.subject } : {}), ...(scope.other ? { other: scope.other } : {}), ...(scope.x != null ? { x: scope.x } : {}), ...(scope.participants ? { participants: scope.participants } : {}) };
    return resolveAmount(state, condition.left, read, ctx) < resolveAmount(state, condition.right, read, ctx);
  },
  alliesWillpower: (state, condition, scope, ctx) => alliesWillpowerHolds(state, scope.actor, condition.min, scope.sourceId, ctx),
  survivorsThreat: (state, condition) => livingSeats(state).every((seat) => (state.seats[seat]?.threat ?? 0) <= condition.max),
  seatThreat: (state, condition) => livingSeats(state).includes(condition.seat) && seatThreat(state, condition.seat) >= condition.min,
  raiseEliminates: (state, condition) => raiseEliminates(state, condition.seat, condition.raise),
  anyThreat: (state, condition) => livingSeats(state).some((seat) => seatThreat(state, seat) <= condition.max),
  heroExhausted: (state, _condition, scope) => (state.seats[scope.actor]?.heroes ?? []).some((id) => state.cards[id]?.exhausted === true),
  otherPlayer: (state, _condition, scope) => livingSeats(state).some((seat) => seat !== scope.actor),
  threat: (state, condition, scope) => {
    const threat = seatThreat(state, scope.actor);
    // Valour's threshold is 80 while the main quest has Dire (mec113.dire): the marked bounds move up by 40.
    const shift = condition.valour && state.dire ? DIRE_VALOUR_SHIFT : 0;
    return (condition.min == null || threat >= condition.min + shift) && (condition.max == null || threat <= condition.max + shift);
  },
  resources: (state, condition, scope, ctx) => spendablePools(state, scope.actor, condition, ctx).total >= condition.min,
  distinctTraits: (state, condition, scope, ctx) => distinctTraitCount(state, scope.actor, ctx) >= condition.min,
  // Every seat of the game counts, and an eliminated player's threat is raised to 50 (rr.scoring).
  highestThreat: (state, condition) => Math.max(0, ...state.seats.slice(0, state.seatCount).map((seat, index) => (seat.eliminated ? 50 : seatThreat(state, index)))) <= condition.max,
} satisfies Partial<ConditionHandlers>;
