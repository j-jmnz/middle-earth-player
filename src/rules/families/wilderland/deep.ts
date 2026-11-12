// Rules: emce.deep, emce.caves-deck, emce.dragon-signs (data/rules/entries.json). Deep: after the players travel to a Deep location, they discard it and replace it with the top card of the Caves deck, which becomes the active location.
// The travel step (quest/travel.ts) pushes a frame under the Responses to the travel when the location is Deep, so the Responses ("When you travel ... before resolving the deep keyword", 18055:A) resolve first; the frame runs the
// Deep record's instruction.
import type { EngineStep } from "../../core/intents.ts";
import { effectCause } from "../../core/cause.ts";
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { textBlank } from "../attachments/hold.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { topOf } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { guardedByType } from "../objectives/index.ts";
import type { Focus } from "../index.ts";
import { ignoresKeyword } from "./markers.ts";

/** The players traveled to the location: when it is a Deep location whose keyword is not blanked, a frame that resolves the keyword goes under the Responses to the travel. Any other location leaves the state as it is. */
export function pushDeep(state: ScenarioState, locationId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[locationId];
  if (!card || !constantVerbCodes(ctx, "Deep").has(card.code) || textBlank(state, locationId, ctx.cards)) return state;
  const record = effectsOf(ctx, card.code).find((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "Deep"));
  if (!record) return state;
  return pushEffectFrame(state, { frame: "ResolveEffect", sourceId: locationId, actor: state.firstPlayer, peril: false, effectId: record.id, instructions: [{ verb: "Deep" }], cancel: null, blockCancel: null, cause: effectCause(record) }, steps);
}

/**
 * The Deep keyword of the source location (emce.deep). It is ignored (nothing happens) with the keyword ignored, with the Caves deck empty ("If there are no cards remaining in the Caves deck, the Deep keyword is ignored"), and when the
 * location has left play by another route (a Response moved it to the discard pile, say). A location that its own Response added to the victory display ("before resolving the deep keyword", Forked Passage, 18055:A:2) still has the keyword
 * resolved: nothing is left to discard, and the top card of the Caves deck becomes the active location. Otherwise the location is discarded and the top card of the Caves deck becomes the active location, entering play; a Caves card that is not a location (a Dragon
 * Sign) is added to the staging area instead and its guarded keyword is resolved (emce.dragon-signs). A Dragon Sign did not enter play by being revealed, so its When Revealed record of the keyword does not run on its own: the keyword
 * (a GuardObjective with a type, emce.guarded-x: "When a card with guarded (X) enters play") is resolved here, once the sign is in the staging area.
 */
export function resolveDeep(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (ignoresKeyword(state, ctx, "deep")) return state;
  const id = focus.sourceId;
  if (id && claimedByVictoryDisplay(state, id)) return replaceWithTop(state, focus, ctx, steps, false);
  return replaceFromCaves(state, focus, ctx, steps);
}

/** The source active location is discarded and the top card of the Caves deck replaces it (a Caves card that is not a location goes to the staging area). Nothing happens with the Caves deck empty or the source no longer an active location. */
export function replaceFromCaves(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  if (!id || (state.activeLocation !== id && state.secondActiveLocation !== id)) return state;
  return replaceWithTop(state, focus, ctx, steps, true);
}

/** The Deep keyword's own case: a source its own Response added to the victory display, with no location active, has nothing to discard and is replaced all the same. */
function claimedByVictoryDisplay(state: ScenarioState, id: string): boolean {
  return state.cards[id]?.zone === "victory" && state.activeLocation == null && state.secondActiveLocation !== id;
}

// The top card of the Caves deck replaces the source (`discardSource`: the source is discarded first). Nothing happens with the Caves deck empty.
function replaceWithTop(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[], discardSource: boolean): ScenarioState {
  const id = focus.sourceId;
  const top = topOf(state, "cavesDeck");
  if (!id || top === undefined) return state;
  const replacement = state.cards[top];
  if (!replacement) return state;
  const discarded = discardSource ? moveEncounter(state, id, "discard", focus.seat, ctx, steps) : state;
  if (printedOf(ctx.cards, replacement.code).type === "location") return moveEncounter(discarded, top, "activeLocation", focus.seat, ctx, steps);
  return resolveGuarded(moveEncounter(discarded, top, "staging", focus.seat, ctx, steps), top, focus, ctx, steps);
}

// The guarded keyword of a Dragon Sign added to the staging area: each typed GuardObjective of its When Revealed records, run for the sign itself.
export function resolveGuarded(state: ScenarioState, signId: string, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const sign = state.cards[signId];
  if (!sign || textBlank(state, signId, ctx.cards)) return state;
  let next = state;
  for (const effect of effectsOf(ctx, sign.code)) {
    if (effect.timing !== "whenRevealed") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb === "GuardObjective" && instruction.types && (instruction.target ?? "self") === "self" && next.cards[signId]?.zone === "staging") next = guardedByType(next, signId, instruction.types, focus, ctx, steps);
    }
  }
  return next;
}
