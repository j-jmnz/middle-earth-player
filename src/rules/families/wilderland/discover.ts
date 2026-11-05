// Rules: emce.discover, emce.loot, emce.guarded-x (data/rules/entries.json). Discover X: when a location with the keyword becomes the active location, the first player (1) looks at the top X cards of the encounter deck, (2) chooses 1 looked-at
// objective with the Loot keyword and attaches it to the active location as a guarded objective, (3) randomly selects 1 looked-at card with the Hazard trait, reveals it and adds it to the staging area, and (4) places the remaining looked-at cards in the
// encounter discard pile. With fewer than X cards in the encounter deck the discard pile is shuffled into it and the looking goes on.
import type { Instruction } from "../../../catalog/boundary.ts";

import { constantVerbCodes } from "../../interpret/constant-records.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, ruleCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { shuffleDiscardIn, effectData, moveEncounter } from "../encounter/moves.ts";
import { askTarget } from "../../windows/choices.ts";
import { moveCard } from "../../core/zones.ts";
import { startReveal } from "../../windows/frames.ts";
import { guardWith } from "../objectives/guard.ts";
import type { Focus } from "../index.ts";
import { ignoresKeyword } from "./markers.ts";

type Verb = Extract<Instruction, { verb: "Discover" }>;

// At least `depth` cards are on top of the encounter deck: when it holds fewer, the cards it has stay on top and the discard pile, shuffled, follows them ("shuffle the encounter discard pile into the encounter deck and continue").
// The cards looked at are then the first `depth`, and asking again finds the same ones (the deck is deep enough, so nothing is shuffled twice).
function deepEnough(state: ScenarioState, depth: number, steps: EngineStep[]): ScenarioState {
  if (state.encounterDeck.length >= depth || state.encounterDiscard.length === 0) return state;
  steps.push({ kind: "resetEncounterDeck", count: state.encounterDiscard.length, cause: ruleCause("emce.discover") });
  const kept = state.encounterDeck;
  const shuffled = shuffleDiscardIn({ ...state, encounterDeck: [] });
  return { ...shuffled, encounterDeck: [...kept, ...shuffled.encounterDeck] };
}

/** Discover X for the location that became the active location (the source of the Forced record). */
export function discover(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const locationId = focus.sourceId;
  if (!locationId || (state.activeLocation !== locationId && state.secondActiveLocation !== locationId) || ignoresKeyword(state, ctx, "discover")) return state;
  const depth = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, locationId), ctx);
  if (depth <= 0) return state;
  const ready = deepEnough(state, depth, steps);
  const looked = ready.encounterDeck.slice(0, depth);
  const loot = constantVerbCodes(ctx, "Loot");
  const candidates = looked.filter((id) => loot.has(ready.cards[id]?.code ?? ""));
  // Several Loot objectives were looked at: the first player chooses one (the verb is run again with the choice). Run where no player can be asked, the first is taken.
  if (focus.chosen == null && candidates.length > 1 && effectData(ready)) return askTarget(ready, { instruction, seat: ready.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, candidates);
  const chosen = focus.chosen != null && candidates.includes(focus.chosen) ? focus.chosen : candidates[0];
  const seat = ready.firstPlayer;
  let next = ready;
  if (chosen !== undefined) next = guardWith(moveEncounter(next, chosen, "staging", seat, ctx, steps), locationId, chosen);
  // The Hazard cards among those looked at: one is selected at random, with the game's seed.
  const hazards = looked.filter((id) => id !== chosen && hasTrait(next, id, "Hazard", ctx));
  const drawn = shuffleIds(hazards, next.seed, next.seedCursor);
  const hazard = drawn.ids[0];
  next = { ...next, seedCursor: drawn.cursor };
  // The rest are discarded before the Hazard is revealed, a deliberate order: emce.discover lists the reveal as step 3 and the discard as step 4, but the reveal is a frame that resolves after this verb returns, so the
  // discard has to be done by then; the Hazard is moved to the top of the deck and revealed by it, added to the staging area (or resolved, a treachery).
  for (const id of looked) if (id !== chosen && id !== hazard) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  if (hazard === undefined) return next;
  const onTop = { ...next, encounterDeck: [hazard, ...next.encounterDeck.filter((id) => id !== hazard)] };
  return startReveal(onTop, seat, ctx, steps);
}
