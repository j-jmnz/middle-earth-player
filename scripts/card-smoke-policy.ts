import { firstShares, playRequest, sharesReady, toPayments, triggerRequest, type PayRequest } from "../src/play/pay.ts";
import type { Payment } from "../src/rules/intents.ts";
import { printedOf } from "../src/rules/printed.ts";
import { legalTargets, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import { nextUint } from "../src/rules/seed.ts";
import { topFrame } from "../src/rules/windows.ts";

// Test helper for scripts/card-smoke.ts. Turns an intent the engine offers for the smoked card (a PlayCard, a Trigger, an
// attack or a defense it can take part in, a choice its own effect opened) into the whole intent the reducer takes, the way
// the table's sheets do: payments from the pay request's first shares, the first legal host. It never types a number the
// engine did not offer, except X, which the player names.

/** A seeded roll, so a smoke run is the same every time for one card and seed. */
export type Dice = { roll(): number; pick<T>(items: readonly T[]): T | undefined; shuffle<T>(items: readonly T[]): T[] };

export function dice(seed: number): Dice {
  let cursor = 0;
  const next = () => nextUint(seed, cursor++);
  return {
    roll: () => next() / 2 ** 32,
    pick: (items) => (items.length === 0 ? undefined : items[next() % items.length]),
    shuffle: (items) => items.map((item) => ({ item, key: next() })).sort((left, right) => left.key - right.key).map(({ item }) => item),
  };
}

/** A whole number from a card code and a seed, for the dice. */
export function seedOf(code: string, seed: number): number {
  let hash = seed >>> 0;
  for (const char of code) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

export type Smoked = {
  // The smoked card's instances (every copy spawned so far, and the starting hero when it was already on the table).
  ids: ReadonlySet<string>;
  // Its effect record ids.
  records: ReadonlySet<string>;
  // True once a copy has been played: the first chance to play it is always taken.
  played: boolean;
};

export type Preference = { prefer: number; dice: Dice; uses: Map<string, number> };

// A free Action with no limit could be used again and again in one window; the smoke stops preferring it after this many
// uses in one phase of a round (the auto-player may still use it).
const USES_PER_PHASE = 3;

// The first shares of a fixed cost, or null when the pools cannot meet it. For X, which the player names and the reducer
// takes whatever it is, the dice name a number from 1 to what the pools hold.
function paymentsOf(request: PayRequest | null, roll: Dice): Payment[] | null {
  if (!request) return [];
  if (!request.exact) {
    const held = request.pools.reduce((sum, pool) => sum + pool.max, 0);
    const x = roll.pick(Array.from({ length: held }, (_, index) => index + 1)) ?? 0;
    return toPayments(firstShares({ ...request, total: x, exact: true }));
  }
  const shares = firstShares(request);
  return sharesReady(shares, request.total, true) ? toPayments(shares) : null;
}

/** The PlayCard the table would send for this card: its first shares and, for an attachment, the first legal host. */
export function playIntent(state: ScenarioState, ctx: ReduceContext, cardId: string, roll: Dice): PlayerIntent | null {
  const instance = state.cards[cardId];
  const payments = paymentsOf(playRequest(state, ctx, cardId), roll);
  if (!instance || !payments) return null;
  if (printedOf(ctx.cards, instance.code).type !== "attachment") return { type: "PlayCard", cardId, payments };
  const host = legalTargets(state, { type: "PlayCard", cardId }, ctx)[0];
  return host ? { type: "PlayCard", cardId, payments, hostId: host } : null;
}

/** The Trigger the table would send for an offered Action or Response: its first shares when its cost takes resources. */
export function triggerIntent(state: ScenarioState, ctx: ReduceContext, cardId: string, effectId: string, roll: Dice): PlayerIntent | null {
  const effect = ctx.effects.find((entry) => entry.id === effectId);
  if (!effect) return null;
  const payments = paymentsOf(triggerRequest(state, ctx, cardId, effect), roll);
  if (!payments) return null;
  return payments.length > 0 ? { type: "Trigger", cardId, effectId, payments } : { type: "Trigger", cardId, effectId };
}

// The characters the smoked card fights with: itself, or the card it is attached to.
function actors(state: ScenarioState, smoked: Smoked): string[] {
  const out: string[] = [];
  for (const id of smoked.ids) {
    const card = state.cards[id];
    if (card?.zone === "heroes" || card?.zone === "play") out.push(id);
    else if (card?.zone === "attached" && card.host) out.push(card.host);
  }
  return out;
}

function offered(legal: readonly LegalIntent[], smoked: Smoked): Extract<LegalIntent, { type: "PlayCard" | "Trigger" }>[] {
  return legal.flatMap((intent) => ((intent.type === "PlayCard" || intent.type === "Trigger") && smoked.ids.has(intent.cardId) ? [intent] : []));
}

function fromWindow(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], smoked: Smoked, preference: Preference): PlayerIntent | null {
  for (const offer of preference.dice.shuffle(offered(legal, smoked))) {
    // The first chance to play a copy from the hand (an event's Trigger is played from there too) is always taken.
    const take = (!smoked.played && state.cards[offer.cardId]?.zone === "hand") || preference.dice.roll() < preference.prefer;
    if (offer.type === "PlayCard") {
      const intent = playIntent(state, ctx, offer.cardId, preference.dice);
      if (intent && take) return intent;
      continue;
    }
    const key = `${state.round}:${state.phase}:${offer.cardId}:${offer.effectId}`;
    if ((preference.uses.get(key) ?? 0) >= USES_PER_PHASE || !take) continue;
    const intent = triggerIntent(state, ctx, offer.cardId, offer.effectId, preference.dice);
    if (!intent) continue;
    preference.uses.set(key, (preference.uses.get(key) ?? 0) + 1);
    return intent;
  }
  return null;
}

/**
 * The intent that exercises the smoked card in this window, or null to leave the window to the auto-player: a choice its
 * own effect opened (any option, by the dice), playing it, using its Actions and Responses, attacking or defending with it.
 */
export function smokeIntent(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], smoked: Smoked, preference: Preference): PlayerIntent | null {
  const window = state.window;
  switch (window?.kind) {
    case "choose": {
      const top = topFrame(state);
      const ours = (top?.cardId != null && smoked.ids.has(top.cardId)) || (top?.data.kind === "effect" && smoked.records.has(top.data.effectId));
      const optionId = ours ? preference.dice.pick(window.options) : undefined;
      return optionId ? { type: "Choose", optionId } : null;
    }
    case "pass":
    case "frameAction":
    case "response":
      return fromWindow(state, ctx, legal, smoked, preference);
    case "playerAttack": {
      if (!legal.some((intent) => intent.type === "DeclareAttackers") || preference.dice.roll() >= preference.prefer) return null;
      for (const id of actors(state, smoked)) {
        const enemyId = legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx)[0];
        if (enemyId) return { type: "DeclareAttackers", enemyId, attackerIds: [id] };
      }
      return null;
    }
    case "defense": {
      if (!legal.some((intent) => intent.type === "DeclareDefender") || preference.dice.roll() >= preference.prefer) return null;
      const defenders = new Set(legalTargets(state, { type: "DeclareDefender" }, ctx));
      const defenderId = actors(state, smoked).find((id) => defenders.has(id));
      return defenderId ? { type: "DeclareDefender", defenderId } : null;
    }
    default:
      return null;
  }
}
