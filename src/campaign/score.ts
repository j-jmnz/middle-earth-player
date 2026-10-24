// Rules: ltp.scoring, rr.scoring (data/rules/entries.json).
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import type { ScenarioState } from "../rules/state.ts";

export type ScenarioScore = { rounds: number; victoryPoints: number; score: number };

// The Learn to Play formula for a won scenario: the final threat of each player, plus the threat cost of each
// destroyed hero, plus the damage on each surviving hero, plus 10 for each round, minus the victory points earned.
// An eliminated player's threat is 50 and all of that player's heroes are defeated (rr.scoring). The round the
// players won in counts: the game ends inside it, and the log has no other round to record it under.
export function scoreOf(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ScenarioScore {
  let total = 0;
  for (const seat of state.seats.slice(0, state.seatCount)) {
    total += seat.eliminated ? 50 : seat.threat;
    for (const id of seat.discard) {
      const instance = state.cards[id];
      if (instance && printedOf(cards, instance.code).type === "hero") total += printedOf(cards, instance.code).threat ?? 0;
    }
    if (seat.eliminated) {
      for (const id of seat.heroes) total += printedOf(cards, state.cards[id]?.code ?? "").threat ?? 0;
    } else {
      for (const id of seat.heroes) total += state.cards[id]?.damage ?? 0;
    }
  }
  const victoryPoints = state.victory.reduce((sum, id) => sum + (printedOf(cards, state.cards[id]?.code ?? "").victory ?? 0), 0);
  const rounds = state.round;
  return { rounds, victoryPoints, score: total + 10 * rounds - victoryPoints };
}
