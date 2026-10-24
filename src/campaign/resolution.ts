import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { resolutionResult } from "../rules/resolution.ts";
import type { ScenarioState } from "../rules/state.ts";

// The part of the campaign log that a scenario resolution writes. The rest of the log belongs to phase 10.
export type ResolutionLog = {
  // A won scenario and the codes its player chose, in group order.
  scenarios: Readonly<Record<string, { rewards: readonly string[] }>>;
  // Chosen cards that join the campaign pool.
  pool: readonly string[];
  // Chosen Permanent cards. They attach to a hero instead of joining the pool.
  attached: readonly string[];
};

export const EMPTY_LOG: ResolutionLog = { scenarios: {}, pool: [], attached: [] };

// A transaction on the log. A loss writes nothing, a scenario that is still being resolved writes nothing,
// and a scenario that is already on the log is not granted again. Each chosen card is recorded once.
export function applyResolution(
  log: ResolutionLog,
  scenarioId: string,
  state: ScenarioState,
  cards: ReadonlyMap<string, PrintedCard>,
): ResolutionLog {
  const rewards = resolutionResult(state);
  if (!rewards || state.scenarioId !== scenarioId || log.scenarios[scenarioId]) return log;
  const chosen = [...new Set(rewards)];
  const permanent = (code: string) => printedOf(cards, code).keywords.permanent;
  return {
    scenarios: { ...log.scenarios, [scenarioId]: { rewards: chosen } },
    pool: [...log.pool, ...chosen.filter((code) => !log.pool.includes(code) && !permanent(code))],
    attached: [...log.attached, ...chosen.filter((code) => !log.attached.includes(code) && permanent(code))],
  };
}
