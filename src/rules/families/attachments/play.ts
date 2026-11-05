// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.reveal, rr.staging, rr.guarded, rr.restricted
// (data/rules/entries.json). The player Guarded (X) keyword and the Trap cards' "Play ~ into the staging area unattached" have
// no rules text in data/rules: the card text and the objective Guarded rule (rr.guarded) are read instead.
//
// Attachments that go somewhere other than a card's host when played: into the staging area or a play area unattached (Traps),
// onto a player's threat dial, or guarded by an encounter card (Guarded). Attaching a card to a card an event names (a Trap to
// the enemy that enters the staging area, Thrór's Key to a location), and putting an attachment into play.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import { attachmentHostIds, enforceRestricted } from "../../player/attach.ts";
import { effectCause } from "../../core/cause.ts";
import { askTarget } from "../../windows/choices.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { playerCardEffectCanChoose, uniqueBlocked } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { lastPicked, seatOf } from "../../interpret/player-verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { discardUntilType } from "../encounter/discard-until.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type PlayInto = Extract<Instruction, { verb: "PlayInto" }>;
type PutIntoPlay = Extract<Instruction, { verb: "PutIntoPlay" }>;
type GuardType = Extract<Instruction, { verb: "Guarded" }>["types"][number];

// The pseudo host a card played into the staging area names.
export const STAGING_HOST = "staging";

function constantOf<V extends Instruction["verb"]>(ctx: ReduceContext, code: string, verb: V): { effect: Effect; instruction: Extract<Instruction, { verb: V }> } | undefined {
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === verb) return { effect, instruction: instruction as Extract<Instruction, { verb: V }> };
  }
  return undefined;
}

// "Play ~ into the staging area unattached", "Play into your play area unattached", "Attach to a player's threat dial".
export function playIntoRule(ctx: ReduceContext, code: string): PlayInto | undefined {
  return constantOf(ctx, code, "PlayInto")?.instruction;
}

// The Guarded (X) keyword of a card, and the record that prints it.
export function guardedRule(ctx: ReduceContext, code: string): { effect: Effect; types: readonly GuardType[] } | undefined {
  const found = constantOf(ctx, code, "Guarded");
  return found ? { effect: found.effect, types: found.instruction.types } : undefined;
}

// Some card in play with this code is controlled by the seat (a threat dial's "Limit 1 per player").
function controlsCopy(state: ScenarioState, seat: number, code: string): boolean {
  return Object.values(state.cards).some((card) => card.code === code && card.controller === seat && inPlay(card.zone));
}

// Where a card that does not go on a card's host may be played: "staging", or "seat:N" for a play area or a threat dial.
// Null for an ordinary attachment.
export function playTargets(state: ScenarioState, seat: number, code: string, ctx: ReduceContext): string[] | null {
  const into = playIntoRule(ctx, code);
  if (into?.into === "staging") return [STAGING_HOST];
  if (into?.into === "playArea") return [`seat:${seat}`];
  if (into?.into === "threatDial") return livingSeats(state).filter((index) => !into.limitPerPlayer || !controlsCopy(state, index, code)).map((index) => `seat:${index}`);
  return guardedRule(ctx, code) ? [STAGING_HOST] : null;
}

// Moves an attachment where a pseudo host puts it: the staging area, unattached, or a seat's play area (that seat controls it).
function placeUnattached(state: ScenarioState, id: string, hostId: string, seat: number): ScenarioState {
  if (hostId === STAGING_HOST) return updateCard(moveCard(state, id, { zone: "staging" }), id, { controller: seat, face: "up", exhausted: false });
  const target = seatOf(hostId) ?? seat;
  const moved = updateCard(moveCard(state, id, { zone: "play", seat: target }), id, { exhausted: false });
  return target === seat ? moved : updateCard(moved, id, { owner: seat });
}

// The card waits out of play, under its player's control, while the encounter deck is searched for its guard.
export function startGuard(state: ScenarioState, id: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  const card = state.cards[id];
  const rule = card ? guardedRule(ctx, card.code) : undefined;
  if (!card || !rule) return null;
  const owner = card.owner ?? card.controller ?? seat;
  const aside = updateCard(moveCard(state, id, { zone: "setAside" }), id, { controller: owner, host: null, face: "up", exhausted: false });
  return pushEffectFrame(
    { ...aside, window: null },
    {
      frame: "ResolveEffect",
      sourceId: id,
      actor: owner,
      peril: false,
      effectId: rule.effect.id,
      instructions: [{ verb: "GuardWith", card: id, types: [...rule.types] }],
      cancel: null,
      blockCancel: null,
      cause: effectCause(rule.effect),
      ...(state.window ? { resume: { window: state.window, seat: state.activeSeat } } : {}),
    },
    steps,
  );
}

// A card played onto a pseudo host (planning.ts playCard): a Guarded card starts its search for a guard, any other goes into
// the staging area or a play area. Null when the host is a card.
export function playElsewhere(state: ScenarioState, id: string, hostId: string | undefined, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (!hostId || state.cards[hostId]) return null;
  const card = state.cards[id];
  if (!card) return null;
  if (guardedRule(ctx, card.code)) {
    const played = queueEvent(state, { trigger: "played", seat, cardId: id });
    return startGuard(played, id, seat, ctx, steps);
  }
  const placed = placeUnattached(state, id, hostId, seat);
  return queueEvent(queueEvent(placed, { trigger: "played", seat, cardId: id }), { trigger: "enteredPlay", seat, cardId: id });
}

// The card is guarded by the encounter card: it stays out of play and is shown attached to it.
function guardBy(state: ScenarioState, id: string, guardId: string): ScenarioState {
  return attachTo(state, id, guardId);
}

// Puts an instruction at the front of the running effect's queue.
function next(state: ScenarioState, instruction: Instruction, seat: number): ScenarioState {
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, queue: [{ instruction, seat, chosen: null }, ...data.queue] } }) : state;
}

// GuardWith (wor.guarded-x): cards come off the top of the encounter deck into its discard pile until one of a named type is
// discarded, and that card is added to the staging area and guards the attachment. With the deck empty the encounter discard pile is
// shuffled into it and the search goes on. With no card of a named type in the deck or the discard pile, the attachment enters play
// at once.
export function guardWith(state: ScenarioState, instruction: Extract<Instruction, { verb: "GuardWith" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[instruction.card];
  if (!card || card.zone !== "setAside" || card.host) return state;
  const { state: searched, found } = discardUntilType(state, instruction.types, ctx);
  if (found == null) return next(state, { verb: "PutIntoPlay", card: "self", unguarded: true }, focus.seat);
  return guardBy(moveEncounter(searched, found, "staging", focus.seat, ctx, steps), card.id, found);
}

// Attaches a card in its owner's play area to a card, or places it on a pseudo host, and announces it.
function putOn(state: ScenarioState, id: string, hostId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!state.cards[hostId]) return queueEvent(placeUnattached(state, id, hostId, seat), { trigger: "enteredPlay", seat, cardId: id });
  const placed = updateCard(moveCard(state, id, { zone: "play", seat }), id, { exhausted: false, host: null });
  const attached = attachTo(placed, id, hostId);
  const announced = queueEvent(queueEvent(attached, { trigger: "enteredPlay", seat, cardId: id }), { trigger: "attached", seat, subject: id, other: hostId });
  return enforceRestricted(announced, hostId, ctx, steps);
}

// The hosts an attachment put into play may go on: where its PlayInto rule puts it, else the cards it may be attached to for the
// seat, that match the instruction's `host` filter (its `control` read from the actor's side).
function hostsFor(state: ScenarioState, instruction: PutIntoPlay, card: CardInstance, seat: number, focus: Focus, ctx: ReduceContext): string[] {
  const filter = instruction.host;
  const base = (playIntoRule(ctx, card.code) ? playTargets(state, seat, card.code, ctx) : null) ?? attachmentHostIds(state, seat, card.code, ctx);
  return base.filter((hostId) => {
    if (hostId === card.id) return false;
    if (!filter) return true;
    const host = state.cards[hostId];
    if (!host) return false;
    if (filter.control === "you" && host.controller !== focus.seat) return false;
    if (filter.control === "other" && (host.controller == null || host.controller === focus.seat)) return false;
    return matchesPick(state, hostId, filter, { seat: focus.seat, sourceId: focus.sourceId, counting: true }, ctx);
  });
}

// PutIntoPlay of an attachment (the play family's verb, families/play/enter.ts, the only way an effect puts one into play): it
// enters play on a host the actor chooses, under the actor's, its owner's or the picked player's control, and is announced as
// entered and attached. A card with Guarded (X) that comes from out of play is guarded first: an encounter card of the named type is
// found and the attachment cannot be attached until it is free of encounters, when its owner gains control of it and attaches it
// (wor.guarded-x). `unguarded` is that last step (the guard left play): the owner puts it into play; with nowhere to go it goes to
// the owner's discard pile. With nowhere to go otherwise it stays where it is.
export function putAttachmentIntoPlay(state: ScenarioState, instruction: PutIntoPlay, id: string, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || inPlay(card.zone)) return state;
  const printed = printedOf(ctx.cards, card.code);
  if (printed.type !== "attachment" || uniqueBlocked(state, printed, ctx.cards)) return state;
  const owner = card.owner ?? card.controller ?? focus.seat;
  if (!instruction.unguarded && guardedRule(ctx, card.code)) return startGuard(state, id, owner, ctx, steps) ?? state;
  const seat = instruction.unguarded || instruction.who === "owner" ? owner : instruction.who === "picked" ? seatOf(lastPicked(state)) : focus.seat;
  if (seat == null || !state.seats[seat] || state.seats[seat]?.eliminated) return state;
  const hosts = hostsFor(state, instruction, card, seat, focus, ctx);
  if (hosts.length === 0) return instruction.unguarded ? updateCard(moveCard(state, id, { zone: "discard", seat: owner }), id, { host: null }) : state;
  const host = focus.chosen && hosts.includes(focus.chosen) ? focus.chosen : hosts.length === 1 ? hosts[0] : undefined;
  if (!host) return effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null }, hosts) : putOn(state, id, hosts[0] ?? "", seat, ctx, steps);
  const placed = putOn(state, id, host, seat, ctx, steps);
  // A card that came from another player's deck stays that player's card (rr.ownership-and-control).
  return owner !== seat && placed.cards[id]?.owner == null ? updateCard(placed, id, { owner }) : placed;
}

// AttachSourceTo: the source attachment goes onto the card the reference names, if that card is in play and may have it.
export function attachSourceTo(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttachSourceTo" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const targetId = refCard(state, instruction.card, frameScope(state, focus.seat, focus.sourceId));
  const target = targetId ? state.cards[targetId] : undefined;
  if (!source || !target || target.id === source.id || target.id === source.host || !inPlay(source.zone) || !inPlay(target.zone)) return state;
  if (!playerCardEffectCanChoose(printedOf(ctx.cards, target.code), state, target.id) || attachBlocked(state, ctx, target.id, source.code)) return state;
  const seat = source.controller ?? focus.seat;
  const old = source.host ? state.cards[source.host] : undefined;
  let moved = old ? updateCard(state, old.id, { attachments: old.attachments.filter((other) => other !== source.id) }) : state;
  moved = updateCard(moved, source.id, { host: null });
  if (source.zone !== "play") moved = moveCard(moved, source.id, { zone: "play", seat });
  return queueEvent(attachTo(moved, source.id, target.id), { trigger: "attached", seat, subject: source.id, other: target.id });
}
