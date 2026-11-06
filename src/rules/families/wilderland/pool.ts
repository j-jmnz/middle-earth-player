// Rules: emce.treasure, emce.boon-allies, emce.campaign-pool-encounter (data/rules/entries.json); ledger lines 120165:B:1 to 120165:B:3, 12187:B:1, 12187:B:4, 12193:B:4. What the Ered Mithrin Resolution writes for the
// Campaign Log: the treasures discovered, the log line a boon ally was traded for, and the encounter cards the Campaign Pool tallies. Pure functions of the state; src/rules/setup/resolution.ts runs them.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { isLocationCard, printedOf } from "../../core/printed.ts";
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

/**
 * The copies of a code in play that the pool does not already hold: the game dealt the pool's tallied copies into the encounter deck (they are in the pool already), so of the copies in play at most
 * the ones the scenario itself dealt are new. A copy has no identity, so the pool's copies are taken to be in play only as far as the scenario's own cannot fill the play areas.
 */
function newCopiesInPlay(state: ScenarioState, code: string, deck?: string): number {
  const dealt = Object.values(state.cards).filter((card) => card.code === code && (deck == null || card.deck === deck));
  const own = Math.max(0, dealt.length - (state.campaignFacts?.encounterPool?.[code] ?? 0));
  return Math.min(own, dealt.filter((card) => inPlay(card.zone)).length);
}

/** AddEncounterToPool: a copy of each code, or a copy for each card of the code in play that the pool does not hold already (emce.campaign-pool-encounter). The log caps the copies at what one collection holds. */
export function addEncounterCards(state: ScenarioState, instruction: Verb<"AddEncounterToPool">): ResolutionLog {
  let tally = poolTally(state);
  // `fromDeck`: the codes of the deck's cards in play, found in the order the cards entered play.
  const codes = instruction.codes ?? [...new Set(Object.values(state.cards).filter((card) => card.deck === instruction.fromDeck && inPlay(card.zone)).map((card) => card.code))];
  for (const code of codes) {
    const copies = instruction.inPlay || instruction.fromDeck ? newCopiesInPlay(state, code, instruction.fromDeck) : 1;
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

/** Whether an option of a RemoveFromPool choice is an encounter card the pool tallies (else it is a card of the pool itself). */
export function isEncounterOption(optionId: string): boolean {
  return optionId.startsWith(ENCOUNTER);
}

/** The seat of the pool card a RemoveFromPool option names, or null for an encounter card or a card no seat holds. */
export function removalSeat(optionId: string): number | null {
  const seat = optionId.startsWith(POOLED) ? (optionId.split("@")[1] ?? "") : "";
  return seat === "" ? null : Number(seat);
}

/** One seat's answer to the choice of a card to remove (or of a location to add, ChooseStagedLocationForPool), kept so the screen can say what each seat chose and the next player's options leave it out (`option` is the option taken, or the decline). */
export function noteRemovalAnswer(log: ResolutionLog, seat: number, option: string): ResolutionLog {
  return { ...log, poolAnswers: [...(log.poolAnswers ?? []), { seat, option }] };
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

/** A card for a player: one option for each player in the game, named by the first hero they control (`<code>><hero>`). */
export function playerOptions(state: ScenarioState, codes: readonly string[]): string[] {
  return codes.flatMap((code) => livingSeats(state).flatMap((index) => (state.seats[index]?.heroes[0] ? [`${code}>${state.seats[index]?.heroes[0]}`] : [])));
}

/** The options of BoonAllyOrLogLine: the ally for each player in the game, named by their first hero, or the log line. */
export function allyOrLineOptions(state: ScenarioState, instruction: Verb<"BoonAllyOrLogLine">): string[] {
  return [...playerOptions(state, [instruction.ally]), LOG_LINE];
}

/** The answer to BoonAllyOrLogLine: the ally joins the pool for the chosen player (and goes in that player's deck), or the line is recorded. */
export function applyAllyOrLine(state: ScenarioState, instruction: Verb<"BoonAllyOrLogLine">, optionId: string, seat: number, step: number): ResolutionLog {
  const log = state.resolutionLog;
  if (optionId === LOG_LINE) return log.allyLines?.includes(instruction.line) ? log : { ...log, allyLines: [...(log.allyLines ?? []), instruction.line] };
  const hero = state.cards[optionId.split(">")[1] ?? ""];
  if (log.earned.some((item) => item.code === instruction.ally)) return log;
  return { ...log, earned: [...log.earned, { code: instruction.ally, to: "pool", seat: hero?.controller ?? seat, hero: null, step }] };
}

/**
 * The options of ChooseStagedLocationForPool (12184:B:4): one code for each title of the locations in the staging area, none of them a burden (it joins the pool as one), leaving out the titles an earlier player chose ("Players must choose different locations, if able"):
 * when every title is taken, any of them is offered again. No location in the staging area offers nothing.
 */
export function stagedLocationOptions(state: ScenarioState, ctx: ReduceContext): string[] {
  // One code per title: two copies of a location, or two cards that share a title, are one choice ("different" is by title).
  const byTitle = new Map<string, string>();
  for (const id of state.staging) {
    const card = state.cards[id];
    const printed = card ? printedOf(ctx.cards, card.code) : null;
    if (card && card.zone === "staging" && printed && isLocationCard(printed) && printed.campaignKind !== "burden" && !byTitle.has(printed.name)) byTitle.set(printed.name, card.code);
  }
  const taken = new Set((state.resolutionLog.poolAnswers ?? []).map((item) => printedOf(ctx.cards, item.option).name));
  const different = [...byTitle].filter(([title]) => !taken.has(title)).map(([, code]) => code);
  return different.length > 0 ? different : [...byTitle.values()];
}

/** One seat's choice of a location: a copy joins the pool's encounter cards, and the answer is kept for the next player. */
export function applyStagedLocation(state: ScenarioState, code: string, seat: number): ResolutionLog {
  return noteRemovalAnswer({ ...state.resolutionLog, encounterPool: withCopies(poolTally(state), code, 1) }, seat, code);
}
