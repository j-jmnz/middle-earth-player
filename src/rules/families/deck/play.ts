// Rules: rr.initiating-abilities-playing-cards, rr.play-and-put-into-play, rr.cost, rr.resource-match, rr.limits, rr.search,
// rr.mulligan, rr.response (data/rules/entries.json).
//
// Playing cards in ways the deck family adds: an event played from a discard pile "as if it were in your hand" (Book of
// Eldacar) and an attachment played from any player's discard pile for no cost (Reforged) — PlayFrom; an event with two
// Actions on different lines, of which its player uses one (Hope Rekindled's Action and Valour Action); an event that may be
// played once a phase; a Response that lowers a card's cost as it is played (Erebor Guard); and a Response offered in the
// mulligan window in place of the mulligan (Galdor of the Havens).
import type { Effect, Instruction, PickSpec, SimpleInstruction } from "../../../catalog/boundary.ts";

import { attachmentHostIds, playCost } from "../../player/attach.ts";
import { effectCause } from "../../core/cause.ts";
import { askTarget } from "../../windows/choices.ts";
import { holds } from "../../interpret/conditions.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { EngineStep, LegalIntent, PlayerIntent } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { uniqueBlocked } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import { heroPays } from "../../player/payments.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { playCard } from "../../player/planning.ts";
import { printedOf } from "../../core/printed.ts";
import { finishMulliganChoice } from "../../setup/setup.ts";
import type { ScenarioState } from "../../core/state.ts";
import { distinctChoices, inPlay, updateCard } from "../../core/state.ts";
import { limitSpent, payUsage, usable } from "../../player/usage.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { moveCard } from "../../core/zones.ts";
import { afterPlay, eventPlayReason } from "../costs/play.ts";
import { allyPools, payerOk } from "../costs/pay.ts";
import type { Focus } from "../index.ts";

type TriggerIntent = Extract<PlayerIntent, { type: "Trigger" }>;
type PlayIntent = Extract<PlayerIntent, { type: "PlayCard" }>;
type PlayFrom = Extract<Instruction, { verb: "PlayFrom" }>;

/** A Pick that does not keep an event from being played when it finds nothing: one that depends on an earlier pick, a search
 * of a deck or of the cards the effect looked at (rr.search: a search is not a target, and finding nothing still resolves),
 * or one made only if a condition holds when the effect resolves. */
export function searchOrLaterPick(pick: PickSpec, when: unknown): boolean {
  return pick.different === true || pick.attackableByPicked === true || pick.from === "deck" || pick.looked === true || when != null;
}

// The Action records of an event its player could resolve now: the condition holds, the limit is unspent, and each target it
// chooses exists.
function eventActionsNow(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): Effect[] {
  const code = state.cards[cardId]?.code ?? "";
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  return effectsOf(ctx, code).filter((effect) => {
    if (effect.timing !== "action" || (effect.condition && !holds(state, effect.condition, scope, ctx)) || limitSpent(state, effect, cardId, seat)) return false;
    return effect.instructions.every((instruction) => instruction.verb !== "Pick" || searchOrLaterPick(instruction.pick, instruction.when) || pickCandidates(state, instruction.pick, seat, [], cardId, ctx).length > 0);
  });
}

// The resources the seat's heroes (and allies whose pools may pay) hold that could pay for the card.
function payable(state: ScenarioState, seat: number, cardId: string, ctx: ReduceContext): number {
  const sphere = printedOf(ctx.cards, state.cards[cardId]?.code ?? "").sphere;
  return [...(state.seats[seat]?.heroes ?? []), ...allyPools(state, seat, cardId, ctx)]
    .filter((id) => payerOk(state, id, seat, cardId, ctx) && heroPays(state, id, sphere, ctx, cardId))
    .reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);
}

// Whether the seat could play the card now under PlayFrom's terms.
function playableFrom(state: ScenarioState, id: string, instruction: PlayFrom, seat: number, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return false;
  const printed = printedOf(ctx.cards, card.code);
  if (printed.type === "attachment") return instruction.free === true && !uniqueBlocked(state, printed, ctx.cards) && attachmentHostIds(state, seat, card.code, ctx).length > 0;
  // An ally is played only for free too ("draw it or play it at no cost", 11211:A:2); a unique one with a copy in play stays where it is.
  if (printed.type === "ally") return instruction.free === true && !uniqueBlocked(state, printed, ctx.cards);
  if (printed.type !== "event" || (printed.costX && !instruction.free)) return false;
  if (eventPlayReason(state, id, seat, ctx, instruction.free) || eventActionsNow(state, id, seat, ctx).length === 0) return false;
  if (instruction.free) return true;
  const cost = playCost(state, id, seat, ctx);
  return cost != null && payable(state, seat, id, ctx) >= cost;
}

// Instructions at the front of the running effect.
function queueFront(state: ScenarioState, seat: number, instructions: readonly Instruction[]): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return state;
  return patchTop(state, { data: { ...data, queue: [...instructions.map((instruction) => ({ instruction, seat, chosen: null })), ...data.queue] } });
}

// The card goes to the seat's hand to be played from there; a card from another player's pile stays its owner's.
function intoHand(state: ScenarioState, id: string, seat: number): ScenarioState {
  const card = state.cards[id];
  const owner = card?.owner ?? card?.controller;
  const moved = moveCard(state, id, { zone: "hand", seat });
  return owner != null && owner !== seat ? updateCard(moved, id, { owner }) : moved;
}

// An attachment played for no cost onto the host the actor chose, or an ally played for no cost (no host): a play, announced, by the actor.
function playForFree(state: ScenarioState, id: string, hostId: string | undefined, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = topFrame(state)?.data;
  const marked = data?.kind === "effect" ? patchTop(state, { data: { ...data, picked: [...(data.picked ?? []), id] } }) : state;
  const before = { ...intoHand(marked, id, seat), activeSeat: seat };
  const intent: PlayIntent = { type: "PlayCard", cardId: id, payments: [], hostId };
  const played = afterPlay(before, playCard(before, intent, ctx, steps), intent, ctx, steps);
  return { ...played, activeSeat: state.activeSeat };
}

/** PlayFrom: the actor chooses a card that matches and could be played now, and plays it: an event is paid for with the
 * costs family's PayToPlay (nothing with `free`), an attachment goes on a host the actor chooses. */
export function playFrom(state: ScenarioState, instruction: PlayFrom, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = focus.seat;
  if (instruction.card) {
    const card = state.cards[instruction.card];
    if (!card || inPlay(card.zone)) return state;
    const hosts = attachmentHostIds(state, seat, card.code, ctx);
    const host = focus.chosen && hosts.includes(focus.chosen) ? focus.chosen : hosts.length === 1 ? hosts[0] : undefined;
    if (!host) return hosts.length > 1 ? askTarget(state, { instruction, seat, chosen: null }, hosts) : state;
    return playForFree(state, card.id, host, seat, ctx, steps);
  }
  const data = topFrame(state)?.data;
  const frame = data?.kind === "effect" ? data : undefined;
  const found = pickCandidates(state, instruction.pick, seat, frame?.picked ?? [], focus.sourceId, ctx, frame?.x, frame?.participants).filter((id) => playableFrom(state, id, instruction, seat, ctx));
  const options = distinctChoices(state, found);
  const chosen = focus.chosen && found.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return options.length > 1 ? askTarget(state, { instruction, seat, chosen: null }, options) : state;
  const printed = printedOf(ctx.cards, state.cards[chosen]?.code ?? "");
  if (printed.type === "attachment") return playFrom(state, { ...instruction, card: chosen }, { seat, sourceId: focus.sourceId }, ctx, steps);
  if (printed.type === "ally") return playForFree(state, chosen, undefined, seat, ctx, steps);
  // The event is the picked card, for the instructions that follow the play (Book of Eldacar puts it on the bottom of the deck).
  const marked = frame ? patchTop(state, { data: { ...frame, picked: [...(frame.picked ?? []), chosen] } }) : state;
  return queueFront(intoHand(marked, chosen, seat), seat, [{ verb: "PayToPlay", card: chosen, ...(instruction.free ? { free: true } : {}), paid: [] }]);
}

/** An event whose Action records that hold now are on different printed lines ("Action: ..." and "Valour Action: ...") uses
 * one of them: its player chooses which (a Choose with an option per record). Null when they are one ability. */
export function alternativeActions(running: readonly Effect[]): Instruction[] | null {
  if (running.length < 2 || new Set(running.map((effect) => effect.lines.join(","))).size < 2) return null;
  return [{ verb: "Choose", who: "actor", options: running.map((effect) => ({ id: effect.id, instructions: effect.instructions as SimpleInstruction[] })) }];
}

/** Why the event cannot be played now because of a limit on its Action ("You can only play 1 copy of ~ each phase"), or null. */
export function eventLimitReason(state: ScenarioState, running: readonly Effect[], cardId: string, seat: number): string | null {
  return running.some((effect) => effect.limit && limitSpent(state, effect, cardId, seat)) ? "That card has been played as often as it may be" : null;
}

/** The play of the event spends the limits of its Actions. */
export function noteEventLimits(state: ScenarioState, running: readonly Effect[], cardId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  return running.filter((effect) => effect.limit).reduce((next, effect) => payUsage(next, effect, cardId, [], ctx, steps, seat), state);
}

// The card's Response to its own `paying` that lowers its cost (ReducePlayCost), when its cost can be paid now.
function payingRecord(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): { effect: Effect; amount: number } | null {
  const code = state.cards[cardId]?.code ?? "";
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "response" || effect.trigger !== "paying") continue;
    const reduce = effect.instructions.find((instruction): instruction is Extract<Instruction, { verb: "ReducePlayCost" }> => instruction.verb === "ReducePlayCost");
    if (reduce && usable(state, effect, cardId, seat, ctx)) return { effect, amount: reduce.amount };
  }
  return null;
}

/** How much less than its cost the seat may pay for the card by using its `paying` Response ("discard the top 2 cards of your
 * deck to reduce its cost by 2"). */
export function payingSlack(state: ScenarioState, seat: number, cardId: string, ctx: ReduceContext): number {
  return payingRecord(state, cardId, seat, ctx)?.amount ?? 0;
}

/** After a card was played from the hand for less than its cost: its `paying` Response was used, so its cost is paid. */
export function afterPaying(before: ScenarioState, after: ScenarioState, intent: PlayIntent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (after === before || before.cards[intent.cardId]?.zone !== "hand") return after;
  const seat = before.activeSeat;
  const record = payingRecord(before, intent.cardId, seat, ctx);
  if (!record) return after;
  const cost = playCost(before, intent.cardId, seat, ctx, intent.hostId ?? null) ?? 0;
  const paid = intent.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return paid < cost ? payUsage(after, record.effect, intent.cardId, [], ctx, steps, seat) : after;
}

// The Responses to `setupHandDrawn` the mulligan window's seat could use now: on a card it controls in play, its condition
// holding and its limit unspent, and only before it has taken a mulligan ("instead of taking a mulligan").
function mulliganOffers(state: ScenarioState, ctx: ReduceContext): { cardId: string; effect: Effect }[] {
  const seat = state.activeSeat;
  if (state.window?.kind !== "mulligan" || state.mulliganSeats.includes(seat)) return [];
  const found: { cardId: string; effect: Effect }[] = [];
  for (const card of Object.values(state.cards)) {
    if (card.controller !== seat || !inPlay(card.zone)) continue;
    for (const effect of effectsOf(ctx, card.code)) {
      if (effect.timing !== "response" || effect.trigger !== "setupHandDrawn") continue;
      if (effect.condition && !holds(state, effect.condition, { actor: seat, sourceId: card.id, returned: 0 }, ctx)) continue;
      if (usable(state, effect, card.id, seat, ctx)) found.push({ cardId: card.id, effect });
    }
  }
  return found;
}

/** The Trigger intents the mulligan window offers beside Keep and Mulligan. */
export function mulliganTriggers(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  return mulliganOffers(state, ctx).map(({ cardId, effect }) => ({ type: "Trigger", cardId, effectId: effect.id }));
}

export function mulliganTriggerReason(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext): string | null {
  return mulliganOffers(state, ctx).some((offer) => offer.cardId === intent.cardId && offer.effect.id === intent.effectId) ? null : "That effect cannot be triggered";
}

/** The Response resolves in its own frame; its last instruction (KeepOpeningHand) passes the mulligan choice on. */
export function applyMulliganTrigger(state: ScenarioState, intent: TriggerIntent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const offer = mulliganOffers(state, ctx).find((entry) => entry.cardId === intent.cardId && entry.effect.id === intent.effectId);
  if (!offer) return state;
  const seat = state.activeSeat;
  const paid = payUsage(state, offer.effect, offer.cardId, intent.payments ?? [], ctx, steps, seat);
  return pushEffectFrame(
    { ...paid, window: null },
    {
      frame: "ResolveEffect",
      sourceId: offer.cardId,
      actor: seat,
      peril: false,
      effectId: offer.effect.id,
      instructions: offer.effect.instructions,
      cancel: null,
      blockCancel: null,
      cause: effectCause(offer.effect),
    },
    steps,
  );
}

/** KeepOpeningHand: in the mulligan, the actor keeps their hand and the next player decides. */
export function keepOpeningHand(state: ScenarioState, focus: Focus): ScenarioState {
  if (state.mode !== "mulligan") return state;
  const next = finishMulliganChoice({ ...state, activeSeat: focus.seat }, false);
  // The next player's choice opens the window again; once every player has chosen, setup goes on.
  return next.mode === "mulligan" ? { ...next, window: { kind: "mulligan" } } : next;
}
