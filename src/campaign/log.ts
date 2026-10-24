// Rules: ltp.campaign-log, rr.campaign-log, ltp.campaign-pool, rr.campaign-pool, ltp.fellowship-of-heroes
// (data/rules/entries.json). The log is what a won scenario writes and the next scenario's checklist reads.
import { resolutionResult } from "../rules/resolution.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import type { ScenarioState } from "../rules/state.ts";

import { scoreOf, type ScenarioScore } from "./score.ts";

// A boon or burden the players have earned. `back` says which deck it joins; `attachedTo` is the hero (a code) a
// Permanent card is stuck to, recorded in the Notes of the paper log.
export type PoolCard = { code: string; back: "player" | "encounter"; burdenSet: string | null; attachedTo: string | null; seat: number | null };

export type CampaignLog = {
  heroesBySeat: readonly (readonly string[])[];
  fallenHeroesBySeat: readonly (readonly string[])[];
  // The permanent +1 starting threat penalty, one number for every player (Campaign Setup Checklist step 3 and 4).
  threatPenalty: number;
  campaignPool: readonly PoolCard[];
  // The heroes the players named as captives in the Notes, by seat.
  captives: readonly { seat: number; hero: string }[];
  completed: readonly string[];
  // The codes each won scenario's Resolution recorded, by scenario id: what the path shows on a completed node.
  earned: Readonly<Record<string, readonly string[]>>;
  scenarios: Readonly<Record<string, ScenarioScore>>;
  // The campaign total: the sum of the scenario scores. Lower is better.
  score: number;
  notes: string;
};

export function emptyLog(seatCount: number): CampaignLog {
  const seats = Array.from({ length: seatCount }, () => [] as readonly string[]);
  return { heroesBySeat: seats, fallenHeroesBySeat: seats, threatPenalty: 0, campaignPool: [], captives: [], completed: [], earned: {}, scenarios: {}, score: 0, notes: "" };
}

function ringBearerOf(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): string | null {
  for (const id of state.seats[0]?.heroes ?? []) {
    const code = state.cards[id]?.code;
    if (code && printedOf(cards, code).traits.includes("Ring-bearer")) return code;
  }
  return null;
}

// A transaction on the log. A loss writes nothing, a scenario that is still being resolved writes nothing, and a
// scenario that is already on the log is not granted again.
export function applyResolution(log: CampaignLog, scenarioId: string, state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): CampaignLog {
  const result = resolutionResult(state);
  if (!result || state.scenarioId !== scenarioId || log.completed.includes(scenarioId)) return log;
  const bearer = ringBearerOf(state, cards);
  const heroesBySeat = state.seats.slice(0, state.seatCount).map((seat, index) => (log.heroesBySeat[index]?.length ? log.heroesBySeat[index] ?? [] : seat.heroes.map((id) => state.cards[id]?.code ?? "")));
  // A hero in a discard pile at the end of the game is a fallen hero (ltp.fellowship-of-heroes), and so is one a
  // Resolution names.
  const fellBy = new Set<string>(result.fallen);
  for (const seat of state.seats.slice(0, state.seatCount)) {
    for (const id of seat.discard) {
      const code = state.cards[id]?.code;
      if (code && printedOf(cards, code).type === "hero") fellBy.add(code);
    }
  }
  const fallenHeroesBySeat = heroesBySeat.map((heroes, index) => [...new Set([...(log.fallenHeroesBySeat[index] ?? []), ...heroes.filter((code) => fellBy.has(code))])]);
  const fallen = new Set(fallenHeroesBySeat.flat());
  const pool: PoolCard[] = log.campaignPool.filter((card) => card.attachedTo == null || !fallen.has(card.attachedTo));
  for (const earned of result.earned) {
    if (pool.some((card) => card.code === earned.code)) continue;
    const printed = printedOf(cards, earned.code);
    const attachedTo = earned.hero ?? (printed.keywords.permanent ? bearer : null);
    if (attachedTo != null && fallen.has(attachedTo)) continue;
    pool.push({ code: earned.code, back: printed.backType ?? "player", burdenSet: printed.burdenSet, attachedTo, seat: earned.seat });
  }
  const scenario = scoreOf(state, cards);
  const scenarios = { ...log.scenarios, [scenarioId]: scenario };
  return {
    heroesBySeat,
    fallenHeroesBySeat,
    threatPenalty: log.threatPenalty,
    campaignPool: pool,
    captives: [...log.captives, ...result.captives],
    completed: [...log.completed, scenarioId],
    earned: { ...log.earned, [scenarioId]: result.earned.map((item) => item.code) },
    scenarios,
    score: Object.values(scenarios).reduce((sum, item) => sum + item.score, 0),
    notes: log.notes,
  };
}
