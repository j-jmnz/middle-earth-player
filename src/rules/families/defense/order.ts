// Rules: rr.combat-phase, rr.step-6-4a, rr.step-6-5 (data/rules/entries.json). A player who resolves the step in which they
// attack enemies before enemy attacks are resolved (Oath of Eorl, 17085): the seat holds attacksFirst for the phase; its
// attack windows open before the first enemy attack, and once it is done (attackedFirst) the combat phase goes on as normal
// and the player attack step leaves that seat out.
import { hasLegalAttack } from "../../combat/combat.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Modifier, ScenarioState } from "../../core/state.ts";
import { flagged, livingSeats } from "../../core/state.ts";

export function attackedEarly(state: ScenarioState, seat: number): boolean {
  return flagged(state, `seat:${seat}`, "attackedFirst");
}

// Called before the next enemy attack (6.4a): the player attack window of a seat that attacks first, or that seat marked done
// once it passed or has nothing to attack. Null when no seat attacks first.
export function earlyAttacks(state: ScenarioState, ctx: ReduceContext): ScenarioState | null {
  for (const seat of livingSeats(state)) {
    if (!flagged(state, `seat:${seat}`, "attacksFirst") || attackedEarly(state, seat)) continue;
    if (!state.passed.includes(seat) && hasLegalAttack(state, seat, ctx.cards)) return { ...state, window: { kind: "playerAttack" }, activeSeat: seat };
    const done: Modifier = { instanceId: `seat:${seat}`, sourceId: `seat:${seat}`, stat: "attackedFirst", amount: 1, until: "endOfPhase" };
    return { ...state, passed: state.passed.filter((entry) => entry !== seat), modifiers: [...state.modifiers, done] };
  }
  return null;
}
