// Rules: emce.campaign-pool-encounter, emce.discover (data/rules/entries.json); ledger line 12189:B:6. The Resolution of The Ghost of Framsburg: "Shuffle the encounter discard pile into the encounter deck and discard cards from the top until 2 Hazard cards are
// discarded. The players, as a group, must choose 1 of those cards and add it to the campaign pool." Pure functions of the state; src/rules/setup/resolution.ts runs them.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { printedOf } from "../../core/printed.ts";
import type { ResolutionLog } from "../../core/campaign-state.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { shuffleDiscardIn } from "../encounter/moves.ts";
import { addEncounterCards } from "./pool.ts";

/** The discard pile shuffled into the deck, then cards discarded from the top until `count` Hazard cards are among them or the deck is empty: the state and the Hazard cards discarded, in order. */
export function discardHazards(state: ScenarioState, count: number, ctx: ReduceContext): { state: ScenarioState; hazards: string[] } {
  let next = shuffleDiscardIn(state);
  const hazards: string[] = [];
  for (const id of next.encounterDeck) {
    if (hazards.length >= count) break;
    next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
    if (hasTrait(next, id, "Hazard", ctx)) hazards.push(id);
  }
  return { state: next, hazards };
}

const BURDEN = "b:";
const ENCOUNTER = "e:";

/** The choices the group is offered among the Hazard cards discarded: one card for each code, since two copies of a card are the same choice. An option is `b:<card id>` for a burden (it joins the pool as a burden) and `e:<card id>` for any other encounter card. */
export function hazardOptions(state: ScenarioState, hazards: readonly string[], ctx: ReduceContext): string[] {
  const seen = new Set<string>();
  return hazards.flatMap((id) => {
    const code = state.cards[id]?.code ?? id;
    if (seen.has(code)) return [];
    seen.add(code);
    return [`${printedOf(ctx.cards, code).campaignKind === "burden" ? BURDEN : ENCOUNTER}${id}`];
  });
}

/** The card chosen joins the pool: a burden as a burden (one copy however often it is earned), any other encounter card as one more copy among the pool's encounter cards (the log keeps no more than one collection holds). */
export function applyHazard(state: ScenarioState, optionId: string, step: number): ResolutionLog {
  const card = state.cards[optionId.slice(ENCOUNTER.length)];
  if (!card) return state.resolutionLog;
  const log = state.resolutionLog;
  if (optionId.startsWith(BURDEN)) return log.earned.some((item) => item.code === card.code) ? log : { ...log, earned: [...log.earned, { code: card.code, to: "pool", seat: null, hero: null, step }] };
  return addEncounterCards(state, { verb: "AddEncounterToPool", codes: [card.code] });
}
