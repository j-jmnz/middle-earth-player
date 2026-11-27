// Rules: rr.search, rr.the-word-choose, rr.resources, rr.doomed-x, rr.initiating-abilities-playing-cards
// (data/rules/entries.json).
//
// The encounter family's verbs that ask a player to choose: they run from the effect frame (effect-frames.ts hands them the
// queue item, so the choice comes back to them), and from anywhere else take the first option.
import { announceLooked } from "./looked.ts";
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { attachmentHostIds, enforceRestricted, hostTakesControl } from "../../player/attach.ts";
import { effectCause, ruleCause } from "../../core/cause.ts";
import { askTarget } from "../../windows/choices.ts";
import { hasTrait, holds } from "../../interpret/conditions.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, playerCardEffectCanChoose, raiseThreat, uniqueBlocked } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import { heroPays } from "../../player/payments.ts";
import { eventActionReason } from "../../player/potential.ts";
import { entersExhausted } from "../../player/planning.ts";
import { isPlayerType, printedOf } from "../../core/printed.ts";
import { lastPicked, putOnDeck } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Frame, QueueItem, ScenarioState } from "../../core/state.ts";
import { distinctChoices, inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { effectData, pushPicked } from "./moves.ts";
import { resourcesLocked } from "../pelargir/spending.ts";

type PickEncounter = Extract<Instruction, { verb: "PickEncounter" }>;

// The cards a LookAtTop showed that are still on top of the encounter deck, top first.
export function lookedOnTop(state: ScenarioState): string[] {
  const looked = effectData(state)?.looked ?? [];
  const found: string[] = [];
  for (const id of state.encounterDeck) {
    if (!looked.includes(id)) break;
    found.push(id);
  }
  return found;
}

// The looked-at cards still on top, but the picked one, go to the bottom of the encounter deck in their order, or to the encounter discard pile faceup. The picked card is then on top.
export function moveOtherLooked(state: ScenarioState, to: "bottom" | "discard"): ScenarioState {
  const picked = lastPicked(state);
  const others = lookedOnTop(state).filter((id) => id !== picked);
  if (others.length === 0) return state;
  if (to === "bottom") return { ...state, encounterDeck: [...state.encounterDeck.filter((id) => !others.includes(id)), ...others] };
  let next = state;
  for (const id of others) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  return picked && next.cards[picked]?.zone === "encounterDeck" ? { ...next, encounterDeck: [picked, ...next.encounterDeck.filter((id) => id !== picked)] } : next;
}

function encounterPool(state: ScenarioState, instruction: PickEncounter): string[] {
  const top = instruction.top ?? Number.MAX_SAFE_INTEGER;
  switch (instruction.from) {
    case "deck":
      return state.encounterDeck.slice(0, top);
    case "deckAndDiscard":
      return [...state.encounterDeck.slice(0, top), ...state.encounterDiscard];
    case "looked":
      return lookedOnTop(state);
    case "play":
      return [...state.staging, ...[state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null), ...livingSeats(state).flatMap((seat) => state.seats[seat]?.engaged ?? [])];
  }
}

// The encounter cards a PickEncounter offers. A player card's effect cannot choose a card in play that is immune to it.
export function encounterCandidates(state: ScenarioState, instruction: PickEncounter, seat: number, sourceId: string | null, ctx: ReduceContext): string[] {
  const source = sourceId ? state.cards[sourceId] : undefined;
  const playerEffect = source == null || isPlayerType(printedOf(ctx.cards, source.code));
  const max = instruction.maxThreat == null ? null : resolveAmount(state, instruction.maxThreat, frameScope(state, seat, sourceId), ctx);
  const found = encounterPool(state, instruction).filter((id) => {
    const card = state.cards[id];
    if (!card) return false;
    const printed = printedOf(ctx.cards, card.code);
    if (instruction.type && printed.type !== instruction.type) return false;
    if (instruction.notType && printed.type === instruction.notType) return false;
    if (instruction.noVictory && (printed.victory ?? 0) > 0) return false;
    if (instruction.nonUnique && printed.isUnique) return false;
    if (instruction.trait && !hasTrait(state, id, instruction.trait, ctx)) return false;
    if (inPlay(card.zone) && playerEffect && !playerCardEffectCanChoose(printed)) return false;
    if (max != null && (inPlay(card.zone) ? modifiedStat(state, card, "threat", ctx.cards) : (printed.threat ?? 0)) > max) return false;
    return true;
  });
  return instruction.from === "play" ? found : distinctChoices(state, found);
}

function pickEncounter(state: ScenarioState, item: QueueItem, sourceId: string | null, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  if (instruction.verb !== "PickEncounter") return state;
  const options = encounterCandidates(state, instruction, item.seat, sourceId, ctx);
  if (!item.chosen && options.length > 1 && effectData(state)) return askTarget(state, item, options);
  const picked = pushPicked(state, item.chosen ?? options[0] ?? "");
  // A search of the encounter deck looks at its cards (901506:A:1, looked.ts).
  return instruction.from === "deck" || instruction.from === "deckAndDiscard" ? announceLooked(picked, ctx, item.seat) : picked;
}

// Puts the looked-at cards still on top of the encounter deck back in the order the actor chooses: the card for the top
// position first, then the next, until one choice is left.
function arrangeEncounter(state: ScenarioState, item: QueueItem): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const offset = item.offset ?? 0;
  const count = lookedOnTop(state).length;
  const rest = state.encounterDeck.slice(offset, count);
  if (rest.length <= 1 || distinctChoices(state, rest).length <= 1) return state;
  if (!item.chosen) return askTarget(state, { ...item, offset }, distinctChoices(state, rest));
  const from = state.encounterDeck.indexOf(item.chosen);
  if (from < offset) return state;
  const deck = [...state.encounterDeck];
  [deck[offset], deck[from]] = [deck[from] ?? "", deck[offset] ?? ""];
  const arranged: ScenarioState = { ...state, encounterDeck: deck };
  if (rest.length <= 2) return arranged;
  const next = effectData(arranged);
  return next ? patchTop(arranged, { data: { ...next, queue: [{ ...item, chosen: null, offset: offset + 1 }, ...next.queue] } }) : arranged;
}

// Pays resources one at a time from the heroes that can pay that sphere; the actor chooses the hero when several can. `offset`
// counts what is paid so far. Nothing is paid when the heroes cannot pay it all. Once all is paid the last hero that paid is
// the picked card ("" when nothing was paid), so what follows can depend on the payment.
function payResources(state: ScenarioState, item: QueueItem, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  if (instruction.verb !== "PayResources") return state;
  const paid = item.offset ?? 0;
  const heroes = (state.seats[item.seat]?.heroes ?? []).filter((id) => (state.cards[id]?.resources ?? 0) > 0 && heroPays(state, id, instruction.sphere, ctx) && !resourcesLocked(state, id));
  const total = heroes.reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);
  if (paid === 0 && total < instruction.amount) return pushPicked(state, "");
  if (!item.chosen && heroes.length > 1 && effectData(state)) return askTarget(state, { ...item, offset: paid }, heroes);
  const payer = state.cards[item.chosen ?? heroes[0] ?? ""];
  if (!payer || payer.resources <= 0) return pushPicked(state, "");
  const spent = updateCard(state, payer.id, { resources: payer.resources - 1 });
  if (paid + 1 >= instruction.amount) return pushPicked(spent, payer.id);
  const data = effectData(spent);
  return data ? patchTop(spent, { data: { ...data, queue: [{ ...item, chosen: null, offset: paid + 1 }, ...data.queue] } }) : spent;
}

// The Action records of an event that could resolve now: the condition holds and each choice it makes has a candidate.
function playableActions(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): Effect[] {
  const code = state.cards[cardId]?.code ?? "";
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  return effectsOf(ctx, code).filter((effect) => {
    if (effect.timing !== "action" || (effect.condition && !holds(state, effect.condition, scope, ctx))) return false;
    return eventActionReason(state, effect.instructions, cardId, seat, ctx) == null;
  });
}

// A card played: it joins this round's plays, and Doomed X raises each player's threat (rr.doomed-x).
function played(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[cardId];
  if (!card) return state;
  let next: ScenarioState = { ...state, played: [...(state.played ?? []).filter((entry) => entry.round === state.round), { id: cardId, code: card.code, seat, round: state.round, phase: state.phase }] };
  const doomed = printedOf(ctx.cards, card.code).keywords.doomed;
  if (doomed != null && doomed > 0) for (const index of livingSeats(next)) next = raiseThreat(next, index, doomed, steps, ruleCause("rr.doomed-x"));
  return next;
}

// A card that can be played for no cost now by this seat: an ally unless a unique one is in play, an attachment with a host, an event with an Action that could resolve (rr.play-and-put-into-play). The Embassy from the Dark Tower offers that option only for such a card (146072:B:1).
export function canPlayFree(state: ScenarioState, id: string, seat: number, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return false;
  const printed = printedOf(ctx.cards, card.code);
  if ((printed.type === "ally" || printed.type === "attachment") && uniqueBlocked(state, printed, ctx.cards)) return false;
  if (printed.type === "ally") return true;
  if (printed.type === "attachment") return attachmentHostIds(state, seat, card.code, ctx).length > 0;
  return printed.type === "event" && playableActions(state, id, seat, ctx).length > 0;
}

// The top card of the actor's deck, revealed, is played for no cost if it can be (Vilya, 04137:A:2): an ally enters play, an
// attachment goes on a host the actor chooses, an event's Action resolves. Otherwise it goes to the bottom of the deck.
// `embassy`: the player card of the Embassy from the Dark Tower's current pair, lying faceup in front of its owner, is played by its owner, and goes to his discard pile when it cannot be (146072:B:1).
function playRevealedFree(state: ScenarioState, item: QueueItem, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const embassy = item.instruction.verb === "PlayRevealedFree" && item.instruction.embassy === true;
  const id = embassy ? (state.embassy?.pairs[state.embassy.at - 1]?.player ?? "") : lastPicked(state);
  const card = state.cards[id];
  const seat = embassy ? (card?.controller ?? item.seat) : item.seat;
  if (!card || card.zone !== (embassy ? "setAside" : "deck") || card.controller !== seat) return state;
  const printed = printedOf(ctx.cards, card.code);
  const bottom = embassy ? moveCard(state, id, { zone: "discard", seat: card.owner ?? seat }) : putOnDeck(state, id, "bottom");
  if (!canPlayFree(state, id, seat, ctx)) return bottom;
  if (printed.type === "ally") {
    const entered = updateCard(moveCard(played(state, id, seat, ctx, steps), id, { zone: "play", seat }), id, { exhausted: entersExhausted(ctx, card.code) });
    return queueEvent(queueEvent(entered, { trigger: "played", seat, cardId: id }), { trigger: "enteredPlay", seat, cardId: id });
  }
  if (printed.type === "attachment") {
    const hosts = attachmentHostIds(state, seat, card.code, ctx);
    if (!item.chosen && hosts.length > 1 && effectData(state)) return askTarget(state, { ...item, seat }, hosts);
    const host = item.chosen && hosts.includes(item.chosen) ? item.chosen : hosts[0];
    if (!host) return bottom;
    const placed = updateCard(moveCard(played(state, id, seat, ctx, steps), id, { zone: "play", seat }), id, { exhausted: entersExhausted(ctx, card.code) });
    return enforceRestricted(queueEvent(hostTakesControl(attachTo(placed, id, host), id, ctx), { trigger: "played", seat, cardId: id }), host, ctx, steps);
  }
  const running = playableActions(state, id, seat, ctx);
  const first = running[0];
  if (!first) return bottom;
  // The event is held like a card in the hand while its effect resolves, and goes to the discard pile after (rr.cancel).
  const held = queueEvent(moveCard(played(state, id, seat, ctx, steps), id, { zone: "hand", seat }), { trigger: "played", seat, cardId: id });
  return pushEffectFrame(
    held,
    {
      frame: "ResolveEffect",
      sourceId: id,
      actor: seat,
      peril: held.perilSeat != null,
      effectId: first.id,
      instructions: running.flatMap((effect) => effect.instructions),
      causes: running.flatMap((effect) => effect.instructions.map(() => effectCause(effect))),
      cancel: null,
      blockCancel: null,
      finish: "discardSource",
      announceResolved: true,
    },
    steps,
  );
}

// Runs one of the family's choosing verbs for the queue item, or returns null when the verb is not one of them.
export function runEncounterItem(state: ScenarioState, item: QueueItem, frame: Pick<Frame, "cardId">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (item.instruction.verb) {
    case "PickEncounter":
      return pickEncounter(state, item, frame.cardId, ctx);
    case "ArrangeEncounter":
      return arrangeEncounter(state, item);
    case "PayResources":
      return payResources(state, item, ctx);
    case "PlayRevealedFree":
      return playRevealedFree(state, item, ctx, steps);
    default:
      return null;
  }
}
