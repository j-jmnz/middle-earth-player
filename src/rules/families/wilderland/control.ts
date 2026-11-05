// Rules: rr.guarded, rr.ownership-and-control (data/rules/entries.json); ledger line 18070:A:1. "The first player gains control of Haldan while he is free of encounters": a guarded objective in the staging area that the first player gains control of
// when its guard is gone enters their play area. The constant verb GainControlWhenFree marks the card; the settle sweep moves it. Pure.
import type { Effect } from "../../../catalog/boundary.ts";

import { constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { giveControl } from "../play/control.ts";
import { queueEvent } from "../../windows/queue.ts";
import { freeOfEncounters } from "../objectives/free.ts";

const CLAIMING = new WeakMap<readonly Effect[], ReadonlySet<string>>();

/** The codes whose GainControlWhenFree says that gaining control is a claim (`claim`, 19054:A:2): the card is announced as claimed. */
function claimingCodes(ctx: ReduceContext): ReadonlySet<string> {
  let found = CLAIMING.get(ctx.effects);
  if (!found) {
    found = new Set(ctx.effects.filter((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "GainControlWhenFree" && instruction.claim)).map((effect) => effect.cardCode));
    CLAIMING.set(ctx.effects, found);
  }
  return found;
}

/** Each card with the marker that is free of encounters is controlled by the first player: one in the staging area enters their play area faceup, one already in play passes to the new first player when the token moves. The families hear `changedControl`. */
export function controlFreedObjectives(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure) return state;
  const codes = constantVerbCodes(ctx, "GainControlWhenFree");
  if (codes.size === 0 || state.seats[state.firstPlayer]?.eliminated) return state;
  let next = state;
  const first = state.firstPlayer;
  for (const card of Object.values(state.cards)) {
    if (card.zone !== "play" || !codes.has(card.code) || card.controller === first || !freeOfEncounters(next, card.id)) continue;
    // The card is an objective, not any player's: control moves without making the old controller its owner.
    next = updateCard(giveControl(next, card.id, first), card.id, { owner: undefined });
  }
  for (const id of state.staging) {
    const card = next.cards[id];
    if (!card || card.zone !== "staging" || !codes.has(card.code) || !freeOfEncounters(next, id)) continue;
    next = queueEvent(updateCard(moveCard(next, id, { zone: "play", seat: state.firstPlayer }), id, { face: "up" }), { trigger: "changedControl", seat: state.firstPlayer, cardId: id });
    if (claimingCodes(ctx).has(card.code)) next = queueEvent(next, { trigger: "claimed", seat: state.firstPlayer, cardId: id });
  }
  return next;
}
