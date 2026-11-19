// Rules: rr.triggered-ability, rr.in-play-and-out-of-play, rr.triggering-condition (data/rules/entries.json).
import type { Effect, PickSpec } from "../../catalog/boundary.ts";

import { textBlank } from "../families/attachments/hold.ts";
import { triggerHears } from "../families/play/hooks.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { matchesPick } from "../interpret/pick.ts";
import type { CardInstance, GameEvent, ScenarioState } from "../core/state.ts";
import { flagged } from "../core/state.ts";

// Effect records by card code, built once per effect list: the triggers, constants and Actions look a card's records up
// many times a step, and the list holds every card's.
const BY_CODE = new WeakMap<readonly Effect[], ReadonlyMap<string, readonly Effect[]>>();

export function effectsOf(ctx: { effects: readonly Effect[] }, code: string): readonly Effect[] {
  let index = BY_CODE.get(ctx.effects);
  if (!index) {
    const built = new Map<string, Effect[]>();
    for (const effect of ctx.effects) built.set(effect.cardCode, [...(built.get(effect.cardCode) ?? []), effect]);
    index = built;
    BY_CODE.set(ctx.effects, index);
  }
  return index.get(code) ?? [];
}

// Effect records by id, built once per effect list: a Response offer, a sheet or a log line names its record by id.
const BY_ID = new WeakMap<readonly Effect[], ReadonlyMap<string, Effect>>();

export function effectById(ctx: { effects: readonly Effect[] }, id: string): Effect | undefined {
  let index = BY_ID.get(ctx.effects);
  if (!index) {
    const built = new Map<string, Effect>();
    // The first record wins, as `find` did.
    for (const effect of ctx.effects) if (!built.has(effect.id)) built.set(effect.id, effect);
    index = built;
    BY_ID.set(ctx.effects, index);
  }
  return index.get(id);
}

// The card an event is about: the one it is limited to, or the one it names.
export function aboutCard(event: GameEvent): string | undefined {
  return event.cardId ?? event.subject;
}

// Whether a card matches an effect's subject filter, from the listener's side: the filter's predicates, and whose card it
// is (`control`, an enemy's `engaged`). Its zone is not read, so a card that just left play still matches.
export function subjectMatches(state: ScenarioState, id: string, spec: PickSpec, listener: CardInstance, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return false;
  const seat = listener.controller ?? state.firstPlayer;
  if (spec.type === "enemy") {
    if (spec.engaged === "you" && !(card.zone === "engaged" && card.controller === seat)) return false;
    if (spec.engaged === "other" && !(card.zone === "engaged" && card.controller !== seat)) return false;
    if (spec.stagingOnly && card.zone !== "staging") return false;
  } else if (spec.control === "you" && card.controller !== seat) return false;
  else if (spec.control === "other" && (card.controller == null || card.controller === seat)) return false;
  return matchesPick(state, id, spec, { seat, sourceId: listener.id, counting: true }, ctx);
}

// Whether an effect on this card hears the event. Without a subject an event about one card is heard by that card only
// (an event about no card, by every card). `eventSeat` asks that it happened to the card's controller, or to another player.
export function hears(state: ScenarioState, effect: Effect, listener: CardInstance, event: GameEvent, ctx: ReduceContext): boolean {
  if (!triggerHears(effect.trigger, event.trigger)) return false;
  // A card whose printed text box is blank has none of its abilities (rr.blank).
  if (textBlank(state, listener.id, ctx.cards)) return false;
  // A character that cannot trigger its effect cannot use its own Responses (Sacked!, 02048:A:1).
  if (effect.timing === "response" && (flagged(state, listener.id, "cannotTriggerEffects") || (listener.controller != null && flagged(state, `seat:${listener.controller}`, "cannotTriggerEffects")))) return false;
  if (effect.byEncounterDeck && !event.fromDeck) return false;
  // Damage that cannot be canceled (DamageCard `uncancelable`) is not offered to an ability that cancels it.
  if (event.uncancelable && effect.instructions.some((instruction) => instruction.verb === "CancelDamage")) return false;
  if (effect.notFromDiscard && event.fromDiscard) return false;
  // An event stamped with the clock is heard only by cards that were in play when it occurred (rr.forced: a Forced effect must be in play and active at the time its trigger occurs).
  if (event.at != null && listener.enteredPlay > event.at) return false;
  if (effect.eventSeat) {
    const mine = listener.controller ?? state.firstPlayer;
    if (event.seat == null || (effect.eventSeat === "you") !== (event.seat === mine)) return false;
  }
  const about = aboutCard(event);
  if (effect.subject == null) return event.cardId == null || event.cardId === listener.id;
  if (effect.subject === "self") return about === listener.id;
  if (effect.subject === "host") return about != null && about === listener.host;
  return about != null && subjectMatches(state, about, effect.subject, listener, ctx);
}

// An ability that hears an event about its own card resolves from wherever the card went (rr.in-play-and-out-of-play: "after
// ~ leaves play"); any other listens only while its card is in play.
export function hearsFromAnywhere(effect: Effect, listener: CardInstance, event: GameEvent): boolean {
  const about = aboutCard(event);
  return about === listener.id && (effect.subject === "self" || (effect.subject == null && event.cardId === listener.id));
}
