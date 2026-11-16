// Rules: sotm.escape-test, rr.then (data/rules/entries.json); ledger lines 02107:A:1, 900802:A:2. The resource tokens The Dead Marshes puts on Gollum: where they go when he is not in play (`redirectResources`), and the shuffle once he holds too many (`shufflesAtTokens`).
import type { Effect } from "../../../catalog/boundary.ts";

import { syncConstants } from "../../interpret/constants.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, heldAmount, inPlay, updateCard } from "../../core/state.ts";
import { moveEncounter } from "../encounter/moves.ts";

/** The card in play with this code, or the first card in play holding `redirectResources` when none is (900802:A:2), or null. */
export function tokenTarget(state: ScenarioState, code: string): string | null {
  const named = Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone));
  if (named) return named.id;
  return Object.values(state.cards).find((card) => inPlay(card.zone) && flagged(state, card.id, "redirectResources"))?.id ?? null;
}

const CODES = new WeakMap<readonly Effect[], ReadonlySet<string>>();

// The cards whose constants name `shufflesAtTokens`, read once per effect list.
function shufflingCodes(ctx: ReduceContext): ReadonlySet<string> {
  let known = CODES.get(ctx.effects);
  if (!known) {
    known = new Set(ctx.effects.filter((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "shufflesAtTokens")).map((effect) => effect.cardCode));
    CODES.set(ctx.effects, known);
  }
  return known;
}

/** A card in play that holds `shufflesAtTokens` and has that many resource tokens is shuffled into the encounter deck, its tokens gone with it (02107:A:1). A standing state, checked each time the engine settles. */
export function shuffleFullCards(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const codes = shufflingCodes(ctx);
  if (codes.size === 0) return state;
  const holders = Object.values(state.cards).filter((card) => codes.has(card.code) && inPlay(card.zone) && card.resources > 0);
  if (holders.length === 0) return state;
  const synced = syncConstants(state, ctx);
  let next = synced;
  for (const holder of holders) {
    const limit = heldAmount(next, holder.id, "shufflesAtTokens");
    const card = next.cards[holder.id];
    if (!card || limit <= 0 || card.resources < limit) continue;
    next = updateCard(moveEncounter(next, card.id, "shuffle", state.firstPlayer, ctx, steps), card.id, { resources: 0 });
  }
  return next === synced && synced === state ? state : next;
}
