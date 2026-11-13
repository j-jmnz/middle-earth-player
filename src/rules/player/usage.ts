// Rules: rr.limits, rr.triggering-condition (data/rules/entries.json).
import type { Cost, Effect, Limit } from "../../catalog/boundary.ts";
import { costsOf } from "../../catalog/costs.ts";

import { playCost } from "./attach.ts";
import type { EngineStep, Payment } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { destroyCard, placeDamage, raiseThreat } from "../core/keywords.ts";
import { deckPlayHero, markDeckPlay } from "./deck-play.ts";
import { hasResourceMatch, heroPays, validatePayments } from "./payments.ts";
import { distinctHeroesReason } from "./cost-rules.ts";
import { allyPools, noteSpent } from "../families/costs/pay.ts";
import { addToVictory } from "../families/sidequests/victory.ts";
import { eventPlayReason } from "../families/costs/play.ts";
import { printedOf, type Sphere } from "../core/printed.ts";
import type { CardInstance, ScenarioState } from "../core/state.ts";
import { inPlay, updateCard } from "../core/state.ts";
import { moveCard } from "../core/zones.ts";
import { queueEvent } from "../windows/queue.ts";
import { announceTopDiscard } from "../families/deck/pressure.ts";
import { currentCause, UNATTRIBUTED } from "../core/cause.ts";
import { areaHeadOf, firstOfArea } from "../families/breaking/areas.ts";
import { campaignUsed, noteCampaignUse } from "../families/campaign/used.ts";

// Costs and limits on an Action or a Response. A cost is paid when the effect is triggered, before
// it resolves. A limit is spent by the use, whether or not the effect then does anything.

export function controllerSeat(state: ScenarioState, source: CardInstance): number {
  if (source.controller != null) return source.controller;
  // Mount Gram: the first player of the card's own staging area answers for an encounter card while the areas are separate (mec108.create-staging-area).
  const head = state.capture ? areaHeadOf(state, source.id) : null;
  return head == null ? state.firstPlayer : firstOfArea(state, head);
}

type LimitRule = { times: number; per: "phase" | "round" | "attack" | "game"; eachPlayer?: boolean; group?: boolean; campaign?: boolean };

const LIMITS: Readonly<Record<Limit, LimitRule>> = {
  oncePerPhase: { times: 1, per: "phase" },
  oncePerRound: { times: 1, per: "round" },
  oncePerRoundEachPlayer: { times: 1, per: "round", eachPlayer: true },
  twicePerPhase: { times: 2, per: "phase" },
  twicePerRound: { times: 2, per: "round" },
  thricePerRound: { times: 3, per: "round" },
  thricePerPhase: { times: 3, per: "phase" },
  fivePerPhase: { times: 5, per: "phase" },
  oncePerAttack: { times: 1, per: "attack" },
  oncePerGame: { times: 1, per: "game" },
  oncePerCampaign: { times: 1, per: "game", campaign: true },
  oncePerGameGroup: { times: 1, per: "game", group: true },
  thricePerGameGroup: { times: 3, per: "game", group: true },
  oncePerRoundGroupEachPlayer: { times: 1, per: "round", eachPlayer: true, group: true },
  oncePerPhaseGroupEachPlayer: { times: 1, per: "phase", eachPlayer: true, group: true },
};

// The attack in progress, as a key a once-per-attack use is recorded under.
function attackKey(state: ScenarioState): string | undefined {
  const enemy = state.pendingAttack?.enemyId ?? state.pendingStrike?.enemyId;
  return enemy ? `${state.round}:${state.phase}:${enemy}` : undefined;
}

// A limit counts the uses of this record on this card (on any card, for a group limit) in this round, in this phase for a
// phase limit, in this attack, or in the whole game, by this player for a per-player limit (rr.limits). A per-game limit is
// the player's, whichever copy of the card they used it on (rr.limits: "regardless of which card is used").
export function limitSpent(state: ScenarioState, effect: Effect, sourceId: string, seat: number): boolean {
  if (!effect.limit) return false;
  const rule = LIMITS[effect.limit];
  if (rule.campaign && campaignUsed(state, sourceId)) return true;
  const attack = attackKey(state);
  const used = state.uses.filter(
    (use) =>
      use.effectId === effect.id &&
      (rule.group || use.sourceId === sourceId || (rule.per === "game" && use.seat === seat)) &&
      (rule.per === "game" || use.round === state.round) &&
      (rule.per !== "phase" || use.phase === state.phase) &&
      (rule.per !== "attack" || use.attack === attack) &&
      (!rule.eachPlayer || use.seat === seat),
  ).length;
  return used >= rule.times;
}

// Heroes of the seat that can pay `sphere` and the resources they hold. `only` keeps the one hero a cost names.
function pool(state: ScenarioState, seat: number, sphere: Sphere | null, ctx: ReduceContext, forCard?: string, only?: string | null): number {
  // One card's own pool pays, an ally's too ("Pay 2 resources from Treebeard's pool"); allies whose pool pays for the card
  // count beside the heroes (families/costs/pay.ts).
  if (only != null && sphere == null) return state.cards[only]?.resources ?? 0;
  let total = 0;
  for (const id of [...(state.seats[seat]?.heroes ?? []), ...allyPools(state, seat, forCard, ctx)]) {
    const hero = state.cards[id];
    if (only !== undefined && id !== only) continue;
    if (hero && heroPays(state, id, sphere, ctx, forCard)) total += hero.resources;
  }
  return total;
}

// The one card whose pool must pay a resource cost (`from: self` or `host`), or undefined when any hero may.
export function costPayer(state: ScenarioState, cost: Extract<Cost, { kind: "resources" }>, source: CardInstance): string | null | undefined {
  if (cost.from === "self") return source.id;
  if (cost.from === "host") return source.host;
  return undefined;
}

// A resource cost paid from one card's own pool takes any of its resources; otherwise the sphere must match.
export function costSphere(cost: Extract<Cost, { kind: "resources" }>, source: CardInstance, ctx: ReduceContext): Sphere | null {
  if (cost.from && !cost.sphere) return null;
  return cost.sphere ?? printedOf(ctx.cards, source.code).sphere;
}

function payable(state: ScenarioState, cost: Cost, source: CardInstance, seat: number, ctx: ReduceContext): boolean {
  switch (cost.kind) {
    case "exhaustSelf":
      return !source.exhausted;
    case "exhaustHost": {
      const host = source.host ? state.cards[source.host] : undefined;
      return host != null && !host.exhausted;
    }
    case "exhaustCode":
      return Object.values(state.cards).some((card) => card.code === cost.code && inPlay(card.zone) && !card.exhausted && (card.controller ?? seat) === seat);
    // An attachment whose host just left play answers from its owner's discard pile (families/attachments/hold.ts hostDefeated).
    case "addSelfToVictory":
      return inPlay(source.zone) || source.zone === "discard";
    case "discardSelf":
    case "damageSelf":
    case "returnSelfToHand":
      return inPlay(source.zone);
    case "raiseThreat":
      return true;
    case "discardDeckTop":
      return (state.seats[seat]?.deck.length ?? 0) >= cost.amount;
    case "resources": {
      const payer = costPayer(state, cost, source);
      if (payer === null) return false;
      return pool(state, seat, costSphere(cost, source, ctx), ctx, undefined, payer) >= cost.amount;
    }
    case "playEvent": {
      // Its play restrictions and its resource match first: a 0-cost event is offered only when it could be played.
      if (eventPlayReason(state, source.id, seat, ctx)) return false;
      const price = playCost(state, source.id, seat, ctx);
      const sphere = printedOf(ctx.cards, source.code).sphere;
      // A card that costs nothing still needs a hero with its resource icon (rr.resource-match), as the payment check says.
      return price != null && hasResourceMatch(state, seat, sphere, ctx, source.id) && pool(state, seat, sphere, ctx, source.id) >= price;
    }
  }
}

// True when the effect may be offered for an event: its source is there, its limit is not spent, and every cost but resources
// could be paid. A resource cost is not read here: in a response window another Response may yet add the resources it needs
// (rr.triggering-condition: the responses of one occurrence are used in any order), and `usable` decides what the window
// lists at each turn.
export function offerable(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext): boolean {
  const source = state.cards[sourceId];
  if (!source || limitSpent(state, effect, sourceId, seat)) return false;
  return costsOf(effect).every((cost) => cost.kind === "resources" || cost.kind === "playEvent" || payable(state, cost, source, seat, ctx));
}

// True when the costs could be paid and the limit is not spent. Used to decide what to offer.
export function usable(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext): boolean {
  const source = state.cards[sourceId];
  if (!source || limitSpent(state, effect, sourceId, seat)) return false;
  return costsOf(effect).every((cost) => payable(state, cost, source, seat, ctx));
}

// Why this use is refused, or null. `payments` is what the player offers toward a resource cost.
export function usageReason(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  seat: number,
  payments: readonly Payment[],
  ctx: ReduceContext,
): string | null {
  const source = state.cards[sourceId];
  if (!source) return "That effect cannot be triggered";
  if (limitSpent(state, effect, sourceId, seat)) return "That effect has already been used";
  const costs = costsOf(effect);
  const event = costs.find((cost) => cost.kind === "playEvent");
  if (event) {
    const refused = eventPlayReason(state, sourceId, seat, ctx);
    if (refused) return refused;
    const price = playCost(state, sourceId, seat, ctx);
    if (price == null) return "That card has no printed cost";
    return validatePayments(state, payments, { seat, sphere: printedOf(ctx.cards, source.code).sphere, amount: price, forCard: sourceId }, ctx) ?? distinctHeroesReason(state, sourceId, payments, ctx);
  }
  for (const cost of costs) if (cost.kind !== "resources" && !payable(state, cost, source, seat, ctx)) return "That cost cannot be paid";
  const resources = costs.find((cost): cost is Extract<Cost, { kind: "resources" }> => cost.kind === "resources");
  if (!resources) return payments.length > 0 ? "That effect has no resource cost" : null;
  const payer = costPayer(state, resources, source);
  if (payer === null) return "That cost cannot be paid";
  if (payer !== undefined && payments.some((payment) => payment.heroId !== payer && payment.amount > 0)) return "Only that card's resources can pay";
  if (payer !== undefined) {
    // One card's own pool pays: its controller spends any of its resources (it need not be a hero of the actor's).
    const sum = payments.reduce((total, payment) => total + payment.amount, 0);
    if (sum !== resources.amount) return sum > resources.amount ? "Overpay" : "Underpay";
    return (state.cards[payer]?.resources ?? 0) >= sum ? null : "That card does not have those resources";
  }
  return validatePayments(state, payments, { seat, sphere: costSphere(resources, source, ctx), amount: resources.amount }, ctx);
}

// Pays the costs and records the use. Call it only after usageReason accepted the use.
export function payUsage(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  payments: readonly Payment[],
  ctx: ReduceContext,
  steps: EngineStep[],
  seat = 0,
): ScenarioState {
  let next = state;
  const source = next.cards[sourceId];
  for (const cost of costsOf(effect)) {
    switch (cost.kind) {
      case "exhaustSelf":
        next = updateCard(next, sourceId, { exhausted: true });
        break;
      case "exhaustHost": {
        const host = next.cards[sourceId]?.host;
        if (host) next = updateCard(next, host, { exhausted: true });
        break;
      }
      case "exhaustCode": {
        const ring = Object.values(next.cards).find((card) => card.code === cost.code && inPlay(card.zone) && !card.exhausted && (card.controller ?? seat) === seat);
        if (ring) next = updateCard(next, ring.id, { exhausted: true });
        break;
      }
      case "addSelfToVictory":
        next = addToVictory(next, sourceId, ctx);
        break;
      case "discardSelf":
        next = destroyCard(next, sourceId, ctx.cards, steps);
        break;
      case "damageSelf":
        next = placeDamage(next, sourceId, cost.amount, ctx.cards, steps, "player", currentCause(steps, UNATTRIBUTED));
        break;
      case "returnSelfToHand": {
        const card = next.cards[sourceId];
        if (card?.controller != null) next = moveCard(next, sourceId, { zone: "hand", seat: card.owner ?? card.controller });
        break;
      }
      case "raiseThreat":
        next = raiseThreat(next, seat, cost.amount, steps, currentCause(steps, UNATTRIBUTED));
        break;
      case "discardDeckTop": {
        // Each card is announced ("After ~ is discarded from your deck", families/deck/moves.ts).
        // The deck is the one being paid from (`next`), read before the cards move.
        const top = (next.seats[seat]?.deck ?? []).slice(0, cost.amount);
        for (const id of top) next = queueEvent(moveCard(next, id, { zone: "discard", seat }), { trigger: "discardedFromDeck", seat, cardId: id });
        next = announceTopDiscard(next, seat, top.length, ctx);
        break;
      }
      case "playEvent":
        // A Response event played from the top of the deck (Gandalf, 142002) spends that permission and is held like a card
        // in the hand until its effect is done.
        if (source?.zone === "deck" && source.controller != null) {
          const permission = deckPlayHero(next, source.controller, ctx);
          if (permission) next = markDeckPlay(next, permission);
          next = moveCard(next, sourceId, { zone: "hand", seat: source.controller });
        }
        next = noteSpent(spend(next, payments), payments, ctx);
        break;
      case "resources":
        next = noteSpent(spend(next, payments), payments, ctx);
        break;
    }
  }
  if (!effect.limit || !source) return next;
  const rule = LIMITS[effect.limit];
  const attack = attackKey(state);
  const use = {
    effectId: effect.id,
    sourceId,
    round: next.round,
    phase: next.phase,
    ...(rule.eachPlayer || (rule.per === "game" && !rule.group) ? { seat } : {}),
    ...(rule.per === "game" ? { game: true } : {}),
    ...(rule.per === "attack" && attack ? { attack } : {}),
  };
  return noteCampaignUse({ ...next, uses: [...next.uses, use] }, effect, sourceId);
}

// A Forced or triggered effect with a limit spends it when it resolves ("Limit once per game", 01130:A:4): the use is recorded as a
// player's Response's is, and `limitSpent` keeps the effect from firing again (rules/windows/triggers.ts).
export function noteForcedUse(state: ScenarioState, effect: Effect, sourceId: string, seat: number): ScenarioState {
  if (!effect.limit) return state;
  const rule = LIMITS[effect.limit];
  const attack = attackKey(state);
  const use = {
    effectId: effect.id,
    sourceId,
    round: state.round,
    phase: state.phase,
    ...(rule.eachPlayer || (rule.per === "game" && !rule.group) ? { seat } : {}),
    ...(rule.per === "game" ? { game: true } : {}),
    ...(rule.per === "attack" && attack ? { attack } : {}),
  };
  return noteCampaignUse({ ...state, uses: [...state.uses, use] }, effect, sourceId);
}

function spend(state: ScenarioState, payments: readonly Payment[]): ScenarioState {
  let next = state;
  for (const payment of payments) {
    const hero = next.cards[payment.heroId];
    if (hero) next = updateCard(next, payment.heroId, { resources: hero.resources - payment.amount });
  }
  return next;
}

// Uses from earlier rounds can never block anything again, except a once-per-game use.
export function pruneUses(state: ScenarioState): ScenarioState {
  const kept = state.uses.filter((use) => use.round === state.round || use.game === true);
  return kept.length === state.uses.length ? state : { ...state, uses: kept };
}
