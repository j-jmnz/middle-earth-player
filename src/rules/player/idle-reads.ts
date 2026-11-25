// Rules: rr.triggered-ability, rr.cost (data/rules/entries.json).
// What the idle check of a player card's ability (idle.ts, potential.ts) reads from the table: the amounts and conditions that hold before the effect runs, the
// cards a pick may find for each card an earlier pick may have chosen, and the seats an instruction names. The families' idle hooks (families/<family>/idle.ts)
// read through these too, so the reads are written once.
import type { Amount, Condition, PickSpec } from "../../catalog/boundary.ts";

import type { CardInstance, ScenarioState } from "../core/state.ts";
import { livingSeats } from "../core/state.ts";
import { resolveAmount } from "../interpret/amounts.ts";
import type { IdleFrame, IdleMark } from "../interpret/family-manifest.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { pickCandidates } from "../interpret/pick.ts";

// The amount kinds read from the effect as it resolves (its X, the damage it answers) are not read here.
function settledAmount(amount: Amount): boolean {
  return typeof amount === "number" || (!amount.x && !amount.dealt && !amount.excess && !amount.resourcesOn);
}

/**
 * Whether a pick reads what the running effect chose, looked at or paid (not the table alone), so it finds nothing definite before the effect runs. These are the
 * pick fields that read the effect (src/catalog/effect-schema-pick.ts): `onPicked`, `controlledBy`, `engagedWith` and `sameTitleAs` with `picked`, `hostForPicked`,
 * `looked` (the cards the effect looked at or discarded), `fortitudeDiscarded` (the cards the Fortitude test in progress discarded), `paidFor`, `lowerThreatCost`,
 * `different` and `attackableByPicked`.
 */
export function readsEffect(pick: PickSpec): boolean {
  return (
    pick.onPicked === true ||
    pick.controlledBy === "picked" ||
    pick.engagedWith === "picked" ||
    pick.sameTitleAs === "picked" ||
    pick.hostForPicked === true ||
    pick.looked === true ||
    pick.fortitudeDiscarded === true ||
    pick.paidFor != null ||
    pick.lowerThreatCost === true ||
    pick.different === true ||
    pick.attackableByPicked === true
  );
}

/** Whether a condition on a step or an option reads only the table, so that it holds the same outside the running effect. */
export function readsTable(condition: Condition): boolean {
  switch (condition.kind) {
    case "threat":
    case "phase":
    case "resources":
      return true;
    // A pick that reads the running effect is not settled before the effect runs.
    case "count":
    case "canPick":
      return !readsEffect(condition.pick);
    case "matches":
      return condition.card === "activeLocation";
    case "not":
      return readsTable(condition.condition);
    case "all":
    case "any":
      return condition.conditions.every(readsTable);
    default:
      return false;
  }
}

export interface AmountReadOptions {
  /** A stat change: a negative amount still changes the game, so only 0 is idle. Without it, 0 or less is idle (damage, healing, resources, threat). */
  signed?: boolean;
}

/** Whether the amount reads 0 (or less, unless `signed`) for every card the earlier Pick may have chosen. A second choice in between is not settled (see idleList). */
export function amountIdle(state: ScenarioState, amount: Amount | undefined, frame: IdleFrame, ctx: ReduceContext, options: AmountReadOptions = {}): boolean {
  if (amount == null || !settledAmount(amount)) return false;
  return (frame.picked ?? [null]).every((id) => {
    const read = resolveAmount(state, amount, id == null ? frame.scope : { ...frame.scope, picked: [id] }, ctx);
    return options.signed === true ? read === 0 : read <= 0;
  });
}

/**
 * Whether X cannot be chosen (the engine takes no X then, `chooseX`):
 * 1. every number of `max` must be settled, or X is not read;
 * 2. for each card the earlier Pick may have chosen (or none), the lowest number of `max` is read;
 * 3. X cannot be chosen when that lowest number is below `min` for every one of those cards.
 */
export function xUnchoosable(state: ScenarioState, max: readonly Amount[], min: number, frame: IdleFrame, ctx: ReduceContext): boolean {
  if (!max.every(settledAmount)) return false;
  return (frame.picked ?? [null]).every((id) => Math.min(...max.map((amount) => resolveAmount(state, amount, id == null ? frame.scope : { ...frame.scope, picked: [id] }, ctx))) < min);
}

/** The scope a condition is read in: the actor, the source and the card the answered event is about. */
export function conditionScope(frame: IdleFrame, sourceId: string) {
  return { actor: frame.seat, sourceId, returned: 0, ...(frame.scope.subject ? { subject: frame.scope.subject } : {}), ...(frame.scope.other ? { other: frame.scope.other } : {}), ...(frame.eventSeat != null ? { eventSeat: frame.eventSeat } : {}) };
}

export interface CandidateReadOptions {
  /** Read every card that matches, immune ones too (a count, not a choice). */
  counting?: boolean;
  /** The pick's filter reads the card an earlier Pick chose ("lower threat cost than the chosen hero"): read it for each card that Pick may have chosen. */
  dependent?: boolean;
}

/** The cards a pick finds when it is read with `picked` as the cards an earlier Pick chose. */
export function readCandidates(state: ScenarioState, pick: PickSpec, sourceId: string, frame: IdleFrame, ctx: ReduceContext, picked: readonly string[], counting = false): string[] {
  return pickCandidates(state, pick, frame.seat, picked, sourceId, ctx, frame.scope.x, frame.scope.participants, counting, { subject: frame.scope.subject ?? null, other: frame.scope.other ?? null });
}

/** The cards a pick finds, read once for each card the earlier Pick may have chosen when `dependent`: the cards any of those readings finds. */
export function candidatesOf(state: ScenarioState, pick: PickSpec, sourceId: string, frame: IdleFrame, ctx: ReduceContext, options: CandidateReadOptions = {}): string[] {
  const froms = options.dependent === true && frame.picked != null ? frame.picked : [null];
  return [...new Set(froms.flatMap((from) => readCandidates(state, pick, sourceId, frame, ctx, from == null ? [] : [from], options.counting === true)))];
}

/** The seats an instruction acts on, or null when the table cannot name them. */
export function seatsOfWho(state: ScenarioState, who: string | undefined, frame: IdleFrame): number[] | null {
  if (who == null || who === "actor") return [frame.seat];
  if (who === "firstPlayer") return [state.firstPlayer];
  if (who === "eachSeat") return livingSeats(state);
  if (who === "eventSeat") return frame.eventSeat == null ? null : [frame.eventSeat];
  if (who === "picked" && frame.picked != null && frame.picked.every((id) => id.startsWith("seat:"))) return frame.picked.map((id) => Number(id.slice(5)));
  return null;
}

/** The card a Ready, a Heal or an AddResources names when it is the host, the source itself, the picked card or the subject of the event; undefined for any other target (not read here). */
export function namedCards(state: ScenarioState, target: string | undefined, source: CardInstance, bare: "self" | "picked", frame: IdleFrame, mark: IdleMark): readonly (CardInstance | null)[] | undefined {
  const named = target ?? bare;
  if (named === "picked") return frame.picked?.map((id) => state.cards[id] ?? null);
  // The card the answered event is about (the hero whose attack destroyed an enemy): not read when the frame holds none.
  if (named === "subject") return frame.scope.subject == null ? undefined : [state.cards[frame.scope.subject] ?? null];
  if (mark.event) return undefined;
  if (named === "host") return [source.host ? (state.cards[source.host] ?? null) : null];
  // The other card of the event the Response answers (the defending character of an attack that resolved): an undefended attack has none, and the step reads no card.
  if (named === "other") return frame.scope.other == null ? [] : [state.cards[frame.scope.other] ?? null];
  return named === "self" ? [source] : undefined;
}
