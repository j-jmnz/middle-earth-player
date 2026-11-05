// Rules: emce.treasure, emce.boon-allies, emce.campaign-pool-encounter (data/rules/entries.json); ledger lines 120165:B:1, 12187:B:1, 12193:B:1. What the Ered Mithrin Resolution writes for the
// Campaign Log: the treasures discovered, the log line a boon ally was traded for, and the encounter cards the Campaign Pool tallies. Pure functions of the state; src/rules/setup/resolution.ts runs them.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ResolutionLog } from "../../core/campaign-state.ts";
import { inPlay, livingSeats, type ScenarioState } from "../../core/state.ts";
import { controlledTreasures } from "./treasure.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The option of BoonAllyOrLogLine that records the log line; the other options are the ally for a player, `<ally>><hero>`. */
export const LOG_LINE = "line";
/** The prefixes of a RemoveFromPool choice: an encounter card the pool tallies, a card of the pool itself (`<code>@<seat>`). */
const ENCOUNTER = "e:";
const POOLED = "p:";

/** The encounter cards of the pool with their copies, as the Resolution has them now: its own tally once a verb has changed it, else the log's. */
export function poolTally(state: ScenarioState): Readonly<Record<string, number>> {
  return state.resolutionLog.encounterPool ?? state.campaignFacts?.encounterPool ?? {};
}

function withCopies(tally: Readonly<Record<string, number>>, code: string, change: number): Record<string, number> {
  const next = { ...tally, [code]: Math.max(0, (tally[code] ?? 0) + change) };
  if (next[code] === 0) delete next[code];
  return next;
}

/** DiscoverTreasure: each treasure a player controls joins the discovered ones (emce.treasure). */
export function discoverTreasures(state: ScenarioState, ctx: ReduceContext): ResolutionLog {
  const have = new Set(state.resolutionLog.treasures ?? []);
  const found = controlledTreasures(state, ctx).filter((code) => !have.has(code));
  return found.length === 0 ? state.resolutionLog : { ...state.resolutionLog, treasures: [...have, ...found] };
}

/** AddEncounterToPool: a copy of each code, or a copy for each card of the code in play (emce.campaign-pool-encounter). The log caps the copies at what one collection holds. */
export function addEncounterCards(state: ScenarioState, instruction: Verb<"AddEncounterToPool">): ResolutionLog {
  let tally = poolTally(state);
  for (const code of instruction.codes) {
    const copies = instruction.inPlay ? Object.values(state.cards).filter((card) => card.code === code && inPlay(card.zone)).length : 1;
    if (copies > 0) tally = withCopies(tally, code, copies);
  }
  return { ...state.resolutionLog, encounterPool: tally };
}

/** RemoveFromPool `codes`: every copy of each encounter card leaves the pool. */
export function removeEncounterCards(state: ScenarioState, codes: readonly string[]): ResolutionLog {
  const tally = { ...poolTally(state) };
  for (const code of codes) delete tally[code];
  return { ...state.resolutionLog, encounterPool: tally };
}

/** The cards a seat may remove from the pool, none of them a burden: the encounter cards the pool tallies, and the pool's own cards no seat has removed yet. */
export function removalOptions(state: ScenarioState, ctx: ReduceContext): string[] {
  const removed = state.resolutionLog.poolRemoved ?? [];
  const notBurden = (code: string) => printedOf(ctx.cards, code).campaignKind !== "burden";
  const encounter = Object.keys(poolTally(state)).filter(notBurden).map((code) => `${ENCOUNTER}${code}`);
  const left = [...(state.campaignFacts?.pool ?? [])];
  for (const gone of removed) {
    const at = left.findIndex((entry) => entry.code === gone.code && entry.seat === gone.seat);
    if (at >= 0) left.splice(at, 1);
  }
  const seen = new Set<string>();
  const pooled = left.filter((entry) => notBurden(entry.code)).map((entry) => `${POOLED}${entry.code}@${entry.seat ?? ""}`).filter((id) => !seen.has(id) && seen.add(id));
  return [...encounter, ...pooled];
}

/** The card code an option of a RemoveFromPool choice names. */
export function removalCode(optionId: string): string {
  return optionId.slice(optionId.startsWith(POOLED) ? POOLED.length : ENCOUNTER.length).split("@")[0] ?? "";
}

/** One seat's removal: an encounter card loses a copy, a pool card is listed as removed (the log takes it out of the pool). */
export function applyRemoval(state: ScenarioState, optionId: string): ResolutionLog {
  const code = removalCode(optionId);
  if (optionId.startsWith(ENCOUNTER)) return { ...state.resolutionLog, encounterPool: withCopies(poolTally(state), code, -1) };
  const seat = optionId.split("@")[1] ?? "";
  return { ...state.resolutionLog, poolRemoved: [...(state.resolutionLog.poolRemoved ?? []), { code, seat: seat === "" ? null : Number(seat) }] };
}

/** The options of BoonAllyOrLogLine: the ally for each player in the game, named by their first hero, or the log line. */
export function allyOrLineOptions(state: ScenarioState, instruction: Verb<"BoonAllyOrLogLine">): string[] {
  const heroes = livingSeats(state).flatMap((seat) => (state.seats[seat]?.heroes[0] ? [`${instruction.ally}>${state.seats[seat]?.heroes[0]}`] : []));
  return [...heroes, LOG_LINE];
}

/** The answer to BoonAllyOrLogLine: the ally joins the pool for the chosen player (and goes in that player's deck), or the line is recorded. */
export function applyAllyOrLine(state: ScenarioState, instruction: Verb<"BoonAllyOrLogLine">, optionId: string, seat: number, step: number): ResolutionLog {
  const log = state.resolutionLog;
  if (optionId === LOG_LINE) return log.allyLines?.includes(instruction.line) ? log : { ...log, allyLines: [...(log.allyLines ?? []), instruction.line] };
  const hero = state.cards[optionId.split(">")[1] ?? ""];
  if (log.earned.some((item) => item.code === instruction.ally)) return log;
  return { ...log, earned: [...log.earned, { code: instruction.ally, to: "pool", seat: hero?.controller ?? seat, hero: null, step }] };
}
