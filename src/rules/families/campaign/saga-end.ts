// Rules: mec113.campaign-mode, rr.campaign-cards, rr.campaign-pool, rr.fellowship-of-heroes (data/rules/entries.json). The Return of the King's Resolution verbs (src/catalog/families/campaign.ts): the copies attached to a threat dial, the
// counts recorded in the notes, the boons taken out of the pool, the heroes a discard pile leaves off the fallen list, and how the saga ends. Each reads the state and returns the Resolution log (or the entries earned);
// src/rules/setup/resolution.ts calls them.
import type { Instruction } from "../../../catalog/boundary.ts";
import type { Earned, ResolutionLog } from "../../core/campaign-state.ts";
import { printedOf } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { inPlay, type ScenarioState } from "../../core/state.ts";

type Verb<V extends Instruction["verb"]> = Extract<Instruction, { verb: V }>;

/** EarnOnThreatDial: a copy in play attached to a player's threat dial (controlled by the seat, on no card) is earned for that seat, once for each seat that holds one. */
export function threatDialCopies(state: ScenarioState, instruction: Verb<"EarnOnThreatDial">): Earned[] {
  const held = new Set<string>();
  const out: Earned[] = [];
  for (const card of Object.values(state.cards)) {
    if (!instruction.codes.includes(card.code) || card.zone !== "play" || card.host != null || card.controller == null) continue;
    const key = `${card.controller}:${card.code}`;
    if (held.has(key)) continue;
    held.add(key);
    out.push({ code: card.code, to: "pool", seat: card.controller, hero: null, step: state.resolutionAt, perPlayer: true });
  }
  return out.sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
}

/** The tokens of one counter (`resources` or `damage`) on the cards in play with these codes, added up. */
export function tokensOn(state: ScenarioState, codes: readonly string[], counter: "resources" | "damage"): number {
  return Object.values(state.cards).filter((card) => codes.includes(card.code) && inPlay(card.zone)).reduce((sum, card) => sum + card[counter], 0);
}

/** RecordTokens: the resources on the cards in play with these codes, added up, under the record's name. */
export function recordTokens(state: ScenarioState, instruction: Verb<"RecordTokens">): ResolutionLog {
  const count = tokensOn(state, instruction.codes, "resources");
  return { ...state.resolutionLog, recorded: { ...(state.resolutionLog.recorded ?? {}), [instruction.as]: count } };
}

/** RemoveFromPoolByCode: one pool entry of each code is struck out when the log is written (`poolRemoved`); with `perCopyInVictory`, one entry for each copy of the code in the victory display. */
export function removeFromPool(state: ScenarioState, instruction: Verb<"RemoveFromPoolByCode">): ResolutionLog {
  const copies = (code: string): number => (instruction.perCopyInVictory ? state.victory.filter((id) => state.cards[id]?.code === code).length : 1);
  const removed = instruction.codes.flatMap((code) => Array.from({ length: copies(code) }, () => ({ code, seat: null })));
  return { ...state.resolutionLog, poolRemoved: [...(state.resolutionLog.poolRemoved ?? []), ...removed] };
}

/** LoseGuardedBoons: every boon attached to a card in play with the host's code, struck out of the pool for the seat that owns it. */
export function loseGuardedBoons(state: ScenarioState, instruction: Verb<"LoseGuardedBoons">, ctx: ReduceContext): ResolutionLog {
  const hosts = new Set(Object.values(state.cards).filter((card) => card.code === instruction.host && inPlay(card.zone)).map((card) => card.id));
  const lost = Object.values(state.cards).filter((card) => card.host != null && hosts.has(card.host) && printedOf(ctx.cards, card.code).campaignKind === "boon");
  if (lost.length === 0) return state.resolutionLog;
  return { ...state.resolutionLog, poolRemoved: [...(state.resolutionLog.poolRemoved ?? []), ...lost.map((card) => ({ code: card.code, seat: card.owner ?? card.controller ?? null }))] };
}

/** IgnoreDiscardedHeroes: the log leaves a hero in its controller's discard pile off the list of fallen heroes. */
export function ignoreDiscardedHeroes(state: ScenarioState): ResolutionLog {
  return { ...state.resolutionLog, discardedNotFallen: true };
}

/** EndCampaign: the saga's end. */
export function endCampaign(state: ScenarioState, instruction: Verb<"EndCampaign">): ResolutionLog {
  return { ...state.resolutionLog, campaignEnd: instruction.result };
}
