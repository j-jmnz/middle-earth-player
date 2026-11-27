// Rules: rr.attachment-cards, rr.first-player, rr.treachery-cards, rr.ownership-and-control (data/rules/entries.json); ledger line 05041:A:1.
// Local Trouble: "Attach this card to the hero with the highest threat cost without a copy of Local Trouble attached."
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import type { ScenarioState } from "../../core/state.ts";
import { attachHeroHosts } from "../play/hooks.ts";
import type { Focus } from "../index.ts";

/** The heroes AttachToHighestThreatCost may use: of the heroes that carry no copy of the source and may have it, those with the highest printed threat cost. */
export function highestThreatHosts(state: ScenarioState, sourceId: string, ctx: ReduceContext): string[] {
  const code = state.cards[sourceId]?.code;
  if (code == null) return [];
  const free = attachHeroHosts(state, { kind: "hero", control: "any" }, state.firstPlayer, ctx)
    .filter((id) => !(state.cards[id]?.attachments ?? []).some((other) => state.cards[other]?.code === code) && !attachBlocked(state, ctx, id, code));
  const cost = (id: string): number => printedOf(ctx.cards, state.cards[id]?.code ?? "").threat ?? 0;
  const top = Math.max(...free.map(cost));
  return free.filter((id) => cost(id) === top);
}

/**
 * AttachToHighestThreatCost: the source goes onto the hero with the highest printed threat cost among those without a copy of it; the first player chooses among those tied. With no such hero the source is not attached.
 */
export function attachToHighestThreatCost(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttachToHighestThreatCost" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!focus.sourceId) return state;
  const hosts = highestThreatHosts(state, focus.sourceId, ctx);
  if (hosts.length === 0) return state;
  const chosen = focus.chosen && hosts.includes(focus.chosen) ? focus.chosen : hosts.length === 1 ? hosts[0] : undefined;
  if (!chosen) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, hosts);
  return attachSelf(state, focus.sourceId, chosen, ctx);
}
