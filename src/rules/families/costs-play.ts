// Rules: rr.initiating-abilities-playing-cards, rr.play-and-put-into-play, rr.cost, rr.resource-match, rr.doomed-x,
// rr.keywords (data/rules/entries.json).
//
// Playing a card beyond the planning window's play: the additional costs a card names (PlayCost: "As an additional cost ...
// you must discard 2 cards from your hand"; ExhaustToReduce: "You may exhaust any number of Healer characters you control as
// part of this card's cost"), what the discount a card spends adds to it (Doomed, no resource match, cannot quest), and a card
// an effect plays from the hand (PlayFromHand: "play a Tactics ally from your hand, reducing its cost by 1").
import type { Instruction } from "../../catalog/boundary.ts";

import { attachmentHostIds, playCost } from "../attach.ts";
import { effectCause, ruleCause } from "../cause.ts";
import { askTarget } from "../choices.ts";
import { holds } from "../conditions.ts";
import { discountFor } from "../cost-rules.ts";
import { pushEffectFrame } from "../effect-frames.ts";
import type { EngineStep, Payment, PlayerIntent } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { addModifier, raiseThreat, uniqueBlocked } from "../keywords.ts";
import { playBlocked } from "./sidequests-contract.ts";
import { effectsOf } from "../listen.ts";
import { heroPays, hasResourceMatch } from "../payments.ts";
import { matchesPick, pickCandidates } from "../pick.ts";
import { playCard } from "../planning.ts";
import { pickedList } from "../player-verbs.ts";
import { printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats } from "../state.ts";
import { patchTop, topFrame } from "../windows.ts";
import { gameReads } from "../game-reads.ts";
import { allyPools, cannotPay, cardRules, distinctRule, noteSpent, payerOk } from "./costs-pay.ts";

type PlayIntent = Extract<PlayerIntent, { type: "PlayCard" }>;
type PlayFromHand = Extract<Instruction, { verb: "PlayFromHand" }>;
type PayToPlay = Extract<Instruction, { verb: "PayToPlay" }>;
type Terms = Pick<PayToPlay, "free" | "reduce" | "min" | "noMatch" | "onSelf">;

// How many ready characters the seat could exhaust toward the card's cost (ExhaustToReduce), so many resources it may leave
// unpaid.
export function exhaustSlack(state: ScenarioState, seat: number, cardId: string, ctx: ReduceContext): number {
  const rule = cardRules(state, cardId, "ExhaustToReduce", ctx)[0];
  if (!rule) return 0;
  return pickCandidates(state, { ...rule.pick, control: "you", state: "ready" }, seat, [], cardId, ctx).length;
}

// Why the card's additional cost cannot be paid now, or null (rr.cost: a cost must be paid in full).
export function extraCostReason(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): string | null {
  const others = (state.seats[seat]?.hand ?? []).filter((id) => id !== cardId).length;
  for (const rule of cardRules(state, cardId, "PlayCost", ctx)) if (others < rule.discard) return "That card's additional cost cannot be paid";
  // "You must use resources from 3 different heroes' pools": fewer pools that could pay for it than that.
  const need = distinctRule(state, cardId, ctx)?.min;
  if (need != null) {
    const sphere = printedOf(ctx.cards, state.cards[cardId]?.code ?? "").sphere;
    const pools = [...(state.seats[seat]?.heroes ?? []), ...allyPools(state, seat, cardId, ctx)].filter((id) => (state.cards[id]?.resources ?? 0) > 0 && heroPays(state, id, sphere, ctx, cardId));
    if (pools.length < need) return `Pay from at least ${need} different heroes`;
  }
  return null;
}

// Why an event cannot be played from a Response window now: a play restriction (rr.initiating-abilities-playing-cards, step
// 1: "Play only if ..."), no resource match (rr.resource-match: a 0-cost card needs one too), or an additional cost it cannot
// pay. The ordinary play checks the same in planning.ts's playWindowReason.
export function eventPlayReason(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): string | null {
  const card = state.cards[cardId];
  if (!card) return "That card is not in hand";
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  if (cardRules(state, cardId, "PlayOnlyIf", ctx).some((rule) => !holds(state, rule.condition, scope, ctx))) return "That card's play restriction is not met";
  if (!hasResourceMatch(state, seat, printedOf(ctx.cards, card.code).sphere, ctx, cardId)) return "No hero matches that card's sphere";
  return extraCostReason(state, cardId, seat, ctx);
}

// The constant record of the card that holds a verb, for the frame that pays its additional cost.
function costRecord(ctx: ReduceContext, code: string, verb: Instruction["verb"]) {
  return effectsOf(ctx, code).find((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === verb));
}

// A frame for instructions a play still owes: the window it interrupts opens again afterwards.
function pushOwed(state: ScenarioState, cardId: string, seat: number, verb: Instruction["verb"], instructions: Instruction[], ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const record = costRecord(ctx, state.cards[cardId]?.code ?? "", verb);
  return pushEffectFrame(
    { ...state, window: null },
    {
      frame: "ResolveEffect",
      sourceId: cardId,
      actor: seat,
      peril: false,
      effectId: record?.id ?? "rr.cost",
      instructions,
      cancel: null,
      blockCancel: null,
      cause: record ? effectCause(record) : ruleCause("rr.cost"),
      ...(state.window ? { resume: { window: state.window, seat: state.activeSeat } } : {}),
    },
    steps,
  );
}

// What a card play does beyond planning.ts's playCard, once it is paid for: the resources spent and who paid (Linhir
// Sea-captain), the discount's riders, the attachment's "attached" event, and the additional costs still to pay.
export function afterPlay(before: ScenarioState, state: ScenarioState, intent: PlayIntent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = before.cards[intent.cardId];
  if (!card || state === before) return state;
  const seat = before.activeSeat;
  const printed = printedOf(ctx.cards, card.code);
  let next = noteSpent(state, intent.payments, ctx);
  const paid = intent.payments.filter((payment) => payment.amount > 0);
  const played = next.played ?? [];
  const last = played.at(-1);
  if (last?.id === intent.cardId && paid.length > 0 && gameReads(next, ctx, '"paidFor"')) next = { ...next, played: [...played.slice(0, -1), { ...last, paid }] };
  const discount = discountFor(before, intent.cardId, seat, ctx);
  // "That card gains Doomed 1": each player raises their threat as it is played (rr.doomed-x, rr.keywords: it stacks).
  if (discount?.doomed) for (const index of livingSeats(next)) next = raiseThreat(next, index, discount.doomed, steps, ruleCause("rr.doomed-x"));
  // "Those allies cannot quest this round."
  if (discount?.cannotQuest && printed.type !== "event") next = addModifier(next, intent.cardId, discount.sourceId || intent.cardId, "cannotQuest", 1, "endOfRound");
  if (printed.type === "attachment" && intent.hostId) next = queueEvent(next, { trigger: "attached", seat, subject: intent.cardId, other: intent.hostId });
  // Characters exhausted for the cost not paid in resources (ExhaustToReduce).
  const rule = cardRules(before, intent.cardId, "ExhaustToReduce", ctx)[0];
  const owed = rule ? (playCost(before, intent.cardId, seat, ctx, intent.hostId ?? null) ?? 0) - paid.reduce((sum, payment) => sum + payment.amount, 0) : 0;
  if (rule && owed > 0) {
    const ready = { ...rule.pick, control: "you" as const, state: "ready" as const };
    const exhaust = { verb: "Exhaust" as const, target: { kind: "picked" as const } };
    // Every one of them must exhaust: nobody chooses.
    const all = exhaustSlack(before, seat, intent.cardId, ctx) <= owed;
    const instructions: Instruction[] = all ? [{ verb: "Each", pick: ready, instructions: [exhaust] }] : Array.from({ length: owed }, () => [{ verb: "Pick" as const, pick: ready }, exhaust]).flat();
    next = pushOwed(next, intent.cardId, seat, "ExhaustToReduce", instructions, ctx, steps);
  }
  // "As an additional cost ... discard 2 cards from your hand."
  for (const extra of cardRules(before, intent.cardId, "PlayCost", ctx)) {
    next = pushOwed(next, intent.cardId, seat, "PlayCost", [{ verb: "DiscardFromHand", amount: extra.discard }], ctx, steps);
  }
  return next;
}

// What the card costs under an effect's terms: nothing (`free`), or its cost less `reduce` but not below `min`.
function termsCost(state: ScenarioState, cardId: string, seat: number, terms: Terms, hostId: string | null, ctx: ReduceContext): number | null {
  if (terms.free) return 0;
  const cost = playCost(state, cardId, seat, ctx, hostId);
  if (cost == null) return null;
  if (!terms.reduce) return cost;
  return Math.max(0, Math.max(Math.min(cost, terms.min ?? 0), cost - terms.reduce));
}

// The pools that may pay one more resource for the card, given the ones already chosen (`paid`, one entry per resource).
function openPools(state: ScenarioState, seat: number, cardId: string, terms: Terms, paid: readonly string[], ctx: ReduceContext): string[] {
  const sphere = printedOf(ctx.cards, state.cards[cardId]?.code ?? "").sphere;
  return [...(state.seats[seat]?.heroes ?? []), ...allyPools(state, seat, cardId, ctx)].filter((id) => {
    const left = (state.cards[id]?.resources ?? 0) - paid.filter((entry) => entry === id).length;
    if (left <= 0 || !payerOk(state, id, seat, cardId, ctx)) return false;
    return terms.noMatch ? !cannotPay(state, id, cardId, ctx) : heroPays(state, id, sphere, ctx, cardId);
  });
}

function poolTotal(state: ScenarioState, pools: readonly string[], paid: readonly string[]): number {
  return pools.reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0) - paid.filter((entry) => entry === id).length, 0);
}

// Whether the seat could play this card from the hand now under the terms: its play restrictions, its resource match, its
// cost, and for an attachment played on the source, that host.
function playableNow(state: ScenarioState, seat: number, cardId: string, terms: Terms, sourceId: string | null, ctx: ReduceContext): boolean {
  const card = state.cards[cardId];
  if (!card || card.zone !== "hand" || card.controller !== seat) return false;
  const printed = printedOf(ctx.cards, card.code);
  // An ally, an event, or an attachment (on the source with `onSelf`, otherwise on a host it may be attached to: "search your deck
  // for a card and play it, reducing its cost by 3").
  if (printed.type !== "ally" && printed.type !== "event" && printed.type !== "attachment") return false;
  if (printed.type === "event" && eventPlayReason(state, cardId, seat, ctx)) return false;
  if (printed.type === "attachment" && !terms.onSelf && attachmentHostIds(state, seat, card.code, ctx).length === 0) return false;
  if (printed.cost == null || uniqueBlocked(state, printed, ctx.cards) || playBlocked(state, cardId, seat, ctx)) return false;
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  if (cardRules(state, cardId, "PlayOnlyIf", ctx).some((rule) => !holds(state, rule.condition, scope, ctx))) return false;
  if (extraCostReason(state, cardId, seat, ctx)) return false;
  if (!terms.noMatch && !hasResourceMatch(state, seat, printed.sphere, ctx, cardId)) return false;
  const hostId = terms.onSelf ? sourceId : null;
  if (terms.onSelf && (!sourceId || !attachmentHostIds(state, seat, card.code, ctx).includes(sourceId))) return false;
  const cost = termsCost(state, cardId, seat, terms, hostId, ctx);
  return cost != null && poolTotal(state, openPools(state, seat, cardId, terms, [], ctx), []) >= cost;
}

function termsOf(instruction: PlayFromHand | PayToPlay): Terms {
  return {
    ...(instruction.free ? { free: true } : {}),
    ...(instruction.reduce ? { reduce: instruction.reduce } : {}),
    ...(instruction.min != null ? { min: instruction.min } : {}),
    ...(instruction.noMatch ? { noMatch: true } : {}),
    ...(instruction.onSelf ? { onSelf: true } : {}),
  };
}

// Queues instructions at the front of the running effect.
function queueFront(state: ScenarioState, seat: number, instructions: readonly Instruction[]): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return state;
  return patchTop(state, { data: { ...data, queue: [...instructions.map((instruction) => ({ instruction, seat, chosen: null })), ...data.queue] } });
}

// PlayFromHand: the actor chooses a card in their hand that can be played under the terms (or plays each picked card), and
// pays for it with PayToPlay.
export function playFromHand(state: ScenarioState, instruction: PlayFromHand, seat: number, sourceId: string | null, chosen: string | undefined, ctx: ReduceContext): ScenarioState {
  const terms = termsOf(instruction);
  const fitsPick = (id: string): boolean => matchesPick(state, id, { ...instruction.pick, from: "hand" }, { seat, sourceId, counting: true }, ctx);
  if (instruction.picked) {
    const ids = pickedList(state).filter((id, at, all) => id !== "" && all.indexOf(id) === at && fitsPick(id) && playableNow(state, state.cards[id]?.controller ?? seat, id, terms, sourceId, ctx));
    return queueFront(state, seat, ids.map((id): PayToPlay => ({ verb: "PayToPlay", card: id, ...terms, paid: [] })));
  }
  if (chosen) return queueFront(state, seat, [{ verb: "PayToPlay", card: chosen, ...terms, paid: [] }]);
  const options = (state.seats[seat]?.hand ?? []).filter((id) => fitsPick(id) && playableNow(state, seat, id, terms, sourceId, ctx));
  if (options.length === 0) return state;
  if (options.length === 1 && options[0]) return queueFront(state, seat, [{ verb: "PayToPlay", card: options[0], ...terms, paid: [] }]);
  return askTarget(state, { instruction, seat, chosen: null }, options);
}

// PayToPlay: one resource at a time from a pool the actor chooses (or the only way to pay), then the card is played.
export function payToPlay(state: ScenarioState, instruction: PayToPlay, seat: number, sourceId: string | null, chosen: string | undefined, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cardId = instruction.card ?? pickedList(state).at(-1) ?? "";
  const card = state.cards[cardId];
  const owner = card?.controller ?? seat;
  const terms = termsOf(instruction);
  if (!card || card.zone !== "hand") return state;
  let hostId = terms.onSelf ? sourceId : instruction.host || null;
  let answer = chosen;
  if (card.zone === "hand" && printedOf(ctx.cards, card.code).type === "attachment" && !terms.onSelf) {
    // The host comes first: the only one, or the one the player names (the answer to the question this asked).
    const hosts = attachmentHostIds(state, owner, card.code, ctx);
    if (instruction.host === "" && chosen) {
      hostId = chosen;
      answer = undefined;
    } else if (instruction.host == null) {
      if (hosts.length === 0) return state;
      if (hosts.length > 1) return askTarget(state, { instruction: { ...instruction, card: cardId, host: "" }, seat: owner, chosen: null }, hosts);
      hostId = hosts[0] ?? null;
    }
  }
  const cost = termsCost(state, cardId, owner, terms, hostId, ctx);
  if (cost == null) return state;
  let paid = answer ? [...instruction.paid, answer] : [...instruction.paid];
  while (paid.length < cost) {
    const pools = openPools(state, owner, cardId, terms, paid, ctx);
    if (pools.length === 0) return state;
    // Every resource left must pay: nobody chooses.
    if (poolTotal(state, pools, paid) <= cost - paid.length || pools.length === 1) {
      paid = [...paid, pools[0] ?? ""];
      continue;
    }
    return askTarget(state, { instruction: { ...instruction, card: cardId, paid, ...(hostId ? { host: hostId } : {}) }, seat: owner, chosen: null }, pools);
  }
  const payments: Payment[] = [];
  for (const id of paid) {
    const entry = payments.find((payment) => payment.heroId === id);
    if (entry) entry.amount += 1;
    else payments.push({ heroId: id, amount: 1 });
  }
  // The card is the one the instructions after it name ("that ally"), picked before it is played: its play may open frames.
  const data = topFrame(state)?.data;
  const marked = data?.kind === "effect" ? patchTop(state, { data: { ...data, picked: [...(data.picked ?? []), cardId] } }) : state;
  const intent: PlayIntent = { type: "PlayCard", cardId, payments, ...(hostId ? { hostId } : {}) };
  // An effect's play: the card is played (paid for and announced) outside the planning window, by its owner.
  const before = { ...marked, activeSeat: owner };
  const played = afterPlay(before, playCard(before, intent, ctx, steps), intent, ctx, steps);
  return { ...played, activeSeat: state.activeSeat };
}
