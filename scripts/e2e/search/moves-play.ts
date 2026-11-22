import { playCost } from "../../../src/rules/player/attach.ts";
import { heroPays } from "../../../src/rules/player/payments.ts";
import { printedOf } from "../../../src/rules/core/printed.ts";
import { modifiedStat } from "../../../src/rules/core/keywords.ts";
import type { LegalIntent, Payment, PlayerIntent } from "../../../src/rules/core/intents.ts";
import { legalTargets, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { triggerPayments } from "../../../test/harness/auto-player.ts";

// The moves of the planning and action windows for the fixture search: which card to play, onto which host, paid by which heroes, and
// which Action or Response to use. Each function lists the options best first; none sends anything.

/** The most cards (or Actions) one decision offers. */
const MOST_CARDS = 5;

const TYPE_RANK: Readonly<Record<string, number>> = { ally: 0, attachment: 1, event: 2 };

/** The resources the seat pays for a card, taking from its heroes in `order`, or null when it cannot pay. */
function payFrom(state: ScenarioState, ctx: ReduceContext, cardId: string, cost: number, order: readonly string[]): Payment[] | null {
  const sphere = printedOf(ctx.cards, state.cards[cardId]?.code ?? "").sphere;
  const out: Payment[] = [];
  let left = cost;
  for (const heroId of order) {
    if (left === 0) break;
    const hero = state.cards[heroId];
    if (!hero || hero.resources === 0 || !heroPays(state, heroId, sphere, ctx, cardId)) continue;
    const amount = Math.min(left, hero.resources);
    out.push({ heroId, amount });
    left -= amount;
  }
  return left === 0 ? out : null;
}

/** How much a hero is worth as the host of an attachment: the sum of its three stats. */
function hostValue(state: ScenarioState, ctx: ReduceContext, id: string): number {
  const card = state.cards[id];
  if (!card) return 0;
  return (["willpower", "attack", "defense"] as const).reduce((sum, stat) => sum + modifiedStat(state, card, stat, ctx.cards), 0);
}

/** The ways to pay `cost`: the heroes in order, then the other way round when that pays differently. */
function payments(state: ScenarioState, ctx: ReduceContext, cardId: string, cost: number): Payment[][] {
  const heroes = state.seats[state.activeSeat]?.heroes ?? [];
  const forward = payFrom(state, ctx, cardId, cost, heroes);
  if (!forward) return [];
  const backward = payFrom(state, ctx, cardId, cost, [...heroes].reverse());
  const same = backward != null && JSON.stringify(backward) === JSON.stringify(forward);
  return backward && !same ? [forward, backward] : [forward];
}

/** The PlayCard intents the seat can pay for: allies, then attachments, then events, the dearest first; an attachment once for each of its two best hosts, a card once for each way to pay it. */
export function playOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], memory: ReadonlySet<string>): PlayerIntent[] {
  const seat = state.activeSeat;
  const cards = legal.flatMap((intent) => (intent.type === "PlayCard" && !memory.has(passedKey(state, intent.cardId)) ? [intent.cardId] : []));
  const ranked = cards
    .map((cardId) => ({ cardId, printed: printedOf(ctx.cards, state.cards[cardId]?.code ?? "") }))
    .sort((left, right) => (TYPE_RANK[left.printed.type] ?? 3) - (TYPE_RANK[right.printed.type] ?? 3) || (right.printed.cost ?? 0) - (left.printed.cost ?? 0));
  const out: PlayerIntent[] = [];
  for (const { cardId, printed } of ranked) {
    if (out.length >= MOST_CARDS) break;
    if (printed.type === "attachment") {
      const hosts = [...legalTargets(state, { type: "PlayCard", cardId }, ctx)].sort((left, right) => hostValue(state, ctx, right) - hostValue(state, ctx, left)).slice(0, 2);
      for (const hostId of hosts) {
        const cost = playCost(state, cardId, seat, ctx, hostId);
        if (cost == null) continue;
        const [first] = payments(state, ctx, cardId, cost);
        if (first) out.push({ type: "PlayCard", cardId, payments: first, hostId });
      }
      continue;
    }
    const cost = playCost(state, cardId, seat, ctx, null);
    if (cost == null) continue;
    for (const paid of payments(state, ctx, cardId, cost)) out.push({ type: "PlayCard", cardId, payments: paid });
  }
  return out.slice(0, MOST_CARDS);
}

/** The key a card the search chose not to play is remembered by, so it is not offered again this round. */
export function passedKey(state: ScenarioState, cardId: string): string {
  return `${state.round}:pass:${cardId}`;
}

/** The key a used Action or Response is remembered by, so a policy uses it once a round. */
export function usedKey(state: ScenarioState, cardId: string, effectId: string): string {
  return `${state.round}:${cardId}:${effectId}`;
}

/** The Actions and Responses the seat can use and pay for, not yet used this round (`memory`). */
export function triggerOptions(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], memory: ReadonlySet<string>): PlayerIntent[] {
  const out: PlayerIntent[] = [];
  for (const intent of legal) {
    if (intent.type !== "Trigger" || memory.has(usedKey(state, intent.cardId, intent.effectId))) continue;
    const paid = triggerPayments(state, ctx, intent);
    if (!paid) continue;
    out.push(paid.length > 0 ? { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId, payments: paid } : { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId });
    if (out.length >= MOST_CARDS) break;
  }
  return out;
}
