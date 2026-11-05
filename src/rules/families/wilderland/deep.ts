// Rules: emce.deep, emce.caves-deck, emce.dragon-signs (data/rules/entries.json). Deep: after the players travel to a Deep location, they discard it and replace it with the top card of the Caves deck, which becomes the active location.
// The travel step (quest/travel.ts) pushes a frame under the Responses to the travel when the location is Deep, so the Responses ("When you travel ... before resolving the deep keyword", 18055:A) resolve first; the frame runs the
// Deep record's instruction.
import type { EngineStep } from "../../core/intents.ts";
import { effectCause } from "../../core/cause.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { textBlank } from "../attachments/hold.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { topOf } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";
import { moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { ignoresKeyword, markedCodes } from "./markers.ts";

/** The players traveled to the location: when it is a Deep location whose keyword is not blanked, a frame that resolves the keyword goes under the Responses to the travel. Any other location leaves the state as it is. */
export function pushDeep(state: ScenarioState, locationId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[locationId];
  if (!card || !markedCodes(ctx, "Deep").has(card.code) || textBlank(state, locationId)) return state;
  const record = effectsOf(ctx, card.code).find((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "Deep"));
  if (!record) return state;
  return pushEffectFrame(state, { frame: "ResolveEffect", sourceId: locationId, actor: state.firstPlayer, peril: false, effectId: record.id, instructions: [{ verb: "Deep" }], cancel: null, blockCancel: null, cause: effectCause(record) }, steps);
}

/**
 * The Deep keyword of the source location (emce.deep). It is ignored (nothing happens) with the keyword ignored, with the Caves deck empty ("If there are no cards remaining in the Caves deck, the Deep keyword is ignored"), and when the
 * location is no longer an active location (a Response moved it away first). Otherwise the location is discarded and the top card of the Caves deck becomes the active location, entering play; a Caves card that is not a location (a Dragon
 * Sign) is added to the staging area instead (emce.dragon-signs; its guarded keyword is the card's own record).
 */
export function resolveDeep(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const top = topOf(state, "cavesDeck");
  if (!id || top === undefined || (state.activeLocation !== id && state.secondActiveLocation !== id) || ignoresKeyword(state, ctx, "deep")) return state;
  const replacement = state.cards[top];
  if (!replacement) return state;
  const discarded = moveEncounter(state, id, "discard", focus.seat, ctx, steps);
  return moveEncounter(discarded, top, printedOf(ctx.cards, replacement.code).type === "location" ? "activeLocation" : "staging", focus.seat, ctx, steps);
}
