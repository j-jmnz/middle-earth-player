// Rules: rr.defending-player, rr.exhausted (data/rules/entries.json); ledger line 132059:A:1.
// "The defending player must declare the character he controls with the most damage as the defender. (Even if exhausted.)": the attack in progress holds `mustDefend`, so only the most damaged characters of the defending seat may be declared (an exhausted one too) and the attack
// cannot be left undefended while one can defend.
import { isAllyLike, printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

/** MustDefendMostDamaged: the attack in progress must be defended by the most damaged character of the defending seat. */
export function mustDefendMostDamaged(state: ScenarioState): ScenarioState {
  return state.pendingAttack ? { ...state, pendingAttack: { ...state.pendingAttack, mustDefend: true } } : state;
}

/** The characters of the defending seat with the most damage, while the attack in progress must be defended by one (null otherwise). */
function mostDamaged(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): string[] | null {
  const attack = state.pendingAttack;
  if (!attack?.mustDefend) return null;
  const seat = state.seats[attack.seat];
  const ids = [...(seat?.heroes ?? []), ...(seat?.play ?? []).filter((id) => state.cards[id] != null && state.cards[id].host == null && isAllyLike(printedOf(cards, state.cards[id].code)))];
  const most = Math.max(0, ...ids.map((id) => state.cards[id]?.damage ?? 0));
  return ids.filter((id) => (state.cards[id]?.damage ?? 0) === most);
}

/** The character must be declared (it is one of the most damaged, so an exhausted one defends too). */
export function mustBeDeclared(state: ScenarioState, defenderId: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  return mostDamaged(state, cards)?.includes(defenderId) === true;
}

/** Why a character may not defend this attack: it is not one of the most damaged, or null. */
export function mostDamagedReason(state: ScenarioState, defenderId: string, cards: ReadonlyMap<string, PrintedCard>): string | null {
  const must = mostDamaged(state, cards);
  return must != null && !must.includes(defenderId) ? "The defending player must declare the character with the most damage" : null;
}
