// Rules: ltp.scoring, rr.scoring, faq.scoring (data/rules/entries.json).
import { printedOf, type PrintedCard } from "../rules/core/printed.ts";
import { victoryPointsOf } from "../rules/core/printed-stat.ts";
import { endedInDefeat } from "../rules/core/eliminate.ts";
import type { ScenarioState } from "../rules/core/state.ts";

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

// The parts the score adds up (ltp.scoring): the players' final threat (50 for an eliminated player), the threat cost of each
// destroyed hero (every hero of an eliminated player), the damage on the surviving heroes, the completed rounds and the
// victory points.
export type ScoreParts = { threat: number; destroyed: number; damage: number; rounds: number; victoryPoints: number };

export function scoreParts(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ScoreParts {
  let threat = 0;
  let destroyed = 0;
  let damage = 0;
  // A scenario that ends when its last player falls (The Black Gate Opens) leaves that seat as it stood for the Resolution, but every player fell: it scores as eliminated like the seats that fell before it.
  const everyoneFell = endedInDefeat(state);
  for (const seat of state.seats.slice(0, state.seatCount)) {
    const out = seat.eliminated || everyoneFell;
    threat += out ? 50 : seat.threat;
    for (const id of seat.discard) {
      const instance = state.cards[id];
      if (instance && printedOf(cards, instance.code).type === "hero") destroyed += printedOf(cards, instance.code).threat ?? 0;
    }
    if (out) {
      for (const id of seat.heroes) destroyed += printedOf(cards, state.cards[id]?.code ?? "").threat ?? 0;
    } else {
      for (const id of seat.heroes) damage += state.cards[id]?.damage ?? 0;
    }
  }
  const victoryPoints = state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, cards), 0);
  return { threat, destroyed, damage, rounds: completedRounds(state), victoryPoints };
}

export function scoreTotal(parts: ScoreParts): number {
  return parts.threat + parts.destroyed + parts.damage + 10 * parts.rounds - parts.victoryPoints;
}

export function scoreOf(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ScenarioScore {
  const parts = scoreParts(state, cards);
  return { rounds: parts.rounds, victoryPoints: parts.victoryPoints, score: scoreTotal(parts) };
}
