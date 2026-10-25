// Rules: ltp.scoring, rr.scoring, faq.scoring (data/rules/entries.json).
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import type { ScenarioState } from "../rules/state.ts";

export type ScenarioScore = { rounds: number; victoryPoints: number; score: number };

// The Learn to Play formula for a won scenario: the final threat of each player, plus the threat cost of each
// destroyed hero, plus the damage on each surviving hero, plus 10 for each completed round, minus the victory points
// earned. An eliminated player's threat is 50 and all of that player's heroes are defeated (rr.scoring). A round is
// tallied at the end of its refresh phase (faq.scoring), so the round the players won in, which ends before that,
// does not count.
// The rounds completed: a round is tallied at the end of its refresh phase (faq.scoring), so the round the game ended in
// is not one.
export function completedRounds(state: ScenarioState): number {
  return Math.max(0, state.round - 1);
}

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
  const rounds = completedRounds(state);
  return { rounds, victoryPoints, score: total + 10 * rounds - victoryPoints };
}
