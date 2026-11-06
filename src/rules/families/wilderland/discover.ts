// Rules: emce.discover, emce.loot, emce.guarded-x (data/rules/entries.json). Discover X: when a location with the keyword becomes the active location, the first player (1) looks at the top X cards of the encounter deck, (2) chooses 1 looked-at
// objective with the Loot keyword and attaches it to the active location as a guarded objective, (3) randomly selects 1 looked-at card with the Hazard trait, reveals it and adds it to the staging area, and (4) places the remaining looked-at cards in the
// encounter discard pile. With fewer than X cards in the encounter deck the discard pile is shuffled into it and the looking goes on. A location the players travel to resolves it once the Responses to the travel are done (`pushDiscover`), so a Response that changes its value (19094:A:3) comes first;
// "Each player resolves the Discover keyword of the active location" (ResolveDiscover, 19106:A:1) is the same steps for the player asked. The location hears `discovered` afterwards, its amount 1 when a Hazard was revealed (19103:A:3).
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { constantVerbCodes } from "../../interpret/constant-records.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { textBlank } from "../attachments/hold.ts";
import { effectsOf } from "../../windows/listen.ts";
import { queueHeard } from "../defense/listen.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, effectCause, ruleCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount, updateCard } from "../../core/state.ts";
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

/** The Discover instruction a location prints (its Forced record on becameActive), unless its text is blank. */
function keywordOf(state: ScenarioState, locationId: string, ctx: ReduceContext): { record: Effect; instruction: Verb } | null {
  const card = state.cards[locationId];
  if (!card || textBlank(state, locationId)) return null;
  for (const record of effectsOf(ctx, card.code)) {
    if (record.timing !== "forced" || record.trigger !== "becameActive") continue;
    const instruction = record.instructions.find((item): item is Verb => item.verb === "Discover");
    if (instruction) return { record, instruction };
  }
  return null;
}

/** The Discover value of a location: its Discover X read now, with the adjustment a Response made this phase (never below 0); 0 when it prints none or the keyword is ignored. */
function valueOf(state: ScenarioState, ctx: ReduceContext, locationId: string, actor: number): number {
  const found = keywordOf(state, locationId, ctx);
  if (!found || ignoresKeyword(state, ctx, "discover")) return 0;
  return Math.max(0, resolveAmount(state, found.instruction.amount, frameScope(state, actor, locationId), ctx) + heldAmount(state, locationId, "discoverValue"));
}

/** The Discover value of the active location (the amount `discoverValue`), 0 with none. */
export function discoverValue(state: ScenarioState, ctx: ReduceContext, actor: number): number {
  return state.activeLocation ? valueOf(state, ctx, state.activeLocation, actor) : 0;
}

/** Whether the active location has no Discover keyword to resolve now (none printed, text blank, or ignored): the case of "If they cannot" (19106:A:1). */
export function discoverUnavailable(state: ScenarioState, ctx: ReduceContext): boolean {
  const id = state.activeLocation;
  return !id || keywordOf(state, id, ctx) == null || ignoresKeyword(state, ctx, "discover");
}

/**
 * The steps of emce.discover for `locationId`, the active location, resolved for `seat` (the first player for the keyword itself). With several looked-at Loot objectives the player chooses one (the instruction that asked is run again with the choice);
 * run where no player can be asked the first is taken. Then the location hears `discovered`.
 */
function resolveKeyword(state: ScenarioState, asked: Instruction, locationId: string, seat: number, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const depth = valueOf(state, ctx, locationId, focus.seat);
  const ready = depth > 0 ? deepEnough(state, depth, steps) : state;
  const looked = ready.encounterDeck.slice(0, depth);
  const loot = constantVerbCodes(ctx, "Loot");
  const candidates = looked.filter((id) => loot.has(ready.cards[id]?.code ?? ""));
  if (focus.chosen == null && candidates.length > 1 && effectData(ready)) return askTarget(ready, { instruction: asked, seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, candidates);
  const chosen = focus.chosen != null && candidates.includes(focus.chosen) ? focus.chosen : candidates[0];
  let next = ready;
  if (chosen !== undefined) next = guardWith(moveEncounter(next, chosen, "staging", seat, ctx, steps), locationId, chosen);
  // The Hazard cards among those looked at: one is selected at random, with the game's seed.
  const hazards = looked.filter((id) => id !== chosen && hasTrait(next, id, "Hazard", ctx));
  const drawn = shuffleIds(hazards, next.seed, next.seedCursor);
  const hazard = drawn.ids[0];
  next = { ...next, seedCursor: drawn.cursor };
  if (depth > 0) steps.push({ kind: "discover", locationId, looked, ...(chosen !== undefined ? { loot: chosen } : {}), ...(hazard !== undefined ? { hazard } : {}), cause: currentCause(steps, ruleCause("emce.discover")) });
  // The rest are discarded before the Hazard is revealed, a deliberate order: emce.discover lists the reveal as step 3 and the discard as step 4, but the reveal is a frame that resolves after this verb returns, so the
  // discard has to be done by then; the Hazard is moved to the top of the deck and revealed by it, added to the staging area (or resolved, a treachery).
  for (const id of looked) if (id !== chosen && id !== hazard) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  const announced = queueHeard(next, ctx, { trigger: "discovered", seat: null, cardId: locationId, amount: hazard === undefined ? 0 : 1 });
  if (hazard === undefined) return announced;
  const onTop = { ...announced, encounterDeck: [hazard, ...announced.encounterDeck.filter((id) => id !== hazard)] };
  return startReveal(onTop, seat, ctx, steps);
}

/** Discover X for the location that became the active location (the source of the Forced record). A location the players traveled to has it held back to the end of the travel step (`pushDiscover`). */
export function discover(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const locationId = focus.sourceId;
  const { discoverHeld: _held, ...open } = state;
  // The frame that resolves the held keyword clears the hold even when it finds nothing to resolve (the location left, or the keyword is ignored now).
  const released = instruction.afterTravel && state.discoverHeld === locationId ? open : state;
  if (!locationId || (state.activeLocation !== locationId && state.secondActiveLocation !== locationId) || ignoresKeyword(state, ctx, "discover")) return released;
  if (state.discoverHeld === locationId && !instruction.afterTravel) return state;
  return resolveKeyword(state.discoverHeld === locationId ? open : state, instruction, locationId, state.firstPlayer, focus, ctx, steps);
}

/** ResolveDiscover: the actor resolves the Discover keyword of the active location (19106:A:1); the player asked is the one who looks, chooses and reveals. */
export function resolveDiscover(state: ScenarioState, instruction: Extract<Instruction, { verb: "ResolveDiscover" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const locationId = state.activeLocation;
  if (!locationId || discoverUnavailable(state, ctx)) return state;
  return resolveKeyword(state, instruction, locationId, focus.seat, { ...focus, sourceId: locationId }, ctx, steps);
}

/**
 * The players traveled to the location: when it prints the Discover keyword (and it is not ignored or blank), the keyword is held back and a frame that resolves it goes under the Responses to the travel, as Deep's does, so a Response that adjusts its value
 * (Crypt Key, 19094:A:3: "before resolving it") comes first. The Forced record of the location, which fires with the active location, finds the keyword held and does nothing. Any other location leaves the state as it is.
 */
export function pushDiscover(state: ScenarioState, locationId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const found = keywordOf(state, locationId, ctx);
  if (!found || ignoresKeyword(state, ctx, "discover")) return state;
  const held = { ...state, discoverHeld: locationId };
  return pushEffectFrame(held, { frame: "ResolveEffect", sourceId: locationId, actor: state.firstPlayer, peril: false, effectId: found.record.id, instructions: [{ ...found.instruction, afterTravel: true }], cancel: null, blockCancel: null, cause: effectCause(found.record) }, steps);
}

/**
 * AttachLootFromDiscard (19101:A:2): a Loot objective of the encounter discard pile is added to the staging area and the last picked enemy, which a DiscardUntil and a MoveEncounterCard put in the staging area, guards it. With several in the pile the first player chooses (the verb is run again with the
 * choice). Nothing happens when no enemy was found or no Loot objective lies in the discard pile.
 */
export function attachLootFromDiscard(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttachLootFromDiscard" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const guard = lastPicked(state);
  const enemy = guard ? state.cards[guard] : undefined;
  if (!guard || !enemy || enemy.zone !== "staging") return state;
  const loot = constantVerbCodes(ctx, "Loot");
  const candidates = state.encounterDiscard.filter((id) => loot.has(state.cards[id]?.code ?? ""));
  if (focus.chosen == null && candidates.length > 1 && effectData(state)) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, candidates);
  const chosen = focus.chosen != null && candidates.includes(focus.chosen) ? focus.chosen : candidates[0];
  if (chosen === undefined) return state;
  return guardWith(updateCard(moveEncounter(state, chosen, "staging", state.firstPlayer, ctx, steps), chosen, { face: "up" }), guard, chosen);
}
