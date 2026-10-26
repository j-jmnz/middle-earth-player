// Rules: rr.resource-match, rr.resources, rr.cost, rr.step-1-2 (data/rules/entries.json).
//
// Who may pay for a card, and with which icons: icons a card holds as a flag ("Amarthiúl gains the Tactics resource icon"),
// icons a hero has only while it pays for some cards (PaysAsIcons, PaidByIcons), pools that may not pay for some cards
// (CannotPayFor), and allies whose own pool pays for some cards (PaysFor on an ally: "Radagast collects 1 resource each
// resource phase. These resources can be used to pay for Creature cards played from your hand"). Resources spent this round
// are noted for "each hero that did not spend any resources this round".
import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import type { Cause } from "../cause.ts";
import { holds } from "../conditions.ts";
import type { EngineStep, Payment } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { effectsOf } from "../listen.ts";
import { matchesPick } from "../pick.ts";
import type { Sphere } from "../printed.ts";
import type { GameEvent, ScenarioState } from "../state.ts";
import { heldAmount, inPlay, updateCard } from "../state.ts";
import { openPool } from "./misc-guards.ts";

const ICON_FLAGS = [
  ["leadershipIcon", "leadership"],
  ["loreIcon", "lore"],
  ["tacticsIcon", "tactics"],
  ["spiritIcon", "spirit"],
] as const;

// The resource icons a card holds as a flag now (a constant, or a lasting effect until the end of the phase).
export function flagIcons(state: ScenarioState, id: string): Sphere[] {
  return ICON_FLAGS.filter(([flag]) => heldAmount(state, id, flag) > 0).map(([, sphere]) => sphere);
}

// Whether the card being paid for matches a filter, from its player's side (its zone is not read).
function fits(state: ScenarioState, cardId: string, pick: PickSpec, seat: number, ctx: ReduceContext): boolean {
  return matchesPick(state, cardId, pick, { seat, sourceId: null, counting: true }, ctx);
}

type Rule<V extends Instruction["verb"]> = Extract<Instruction, { verb: V }>;

// The constant instructions of one verb on one card in play whose conditions hold.
function ownRules<V extends Instruction["verb"]>(state: ScenarioState, cardId: string, verb: V, ctx: ReduceContext): Rule<V>[] {
  const card = state.cards[cardId];
  return card && inPlay(card.zone) ? cardRules(state, cardId, verb, ctx) : [];
}

// The constant instructions of one verb on a card (in play, or in hand about its own play) whose conditions hold for its
// player.
export function cardRules<V extends Instruction["verb"]>(state: ScenarioState, cardId: string, verb: V, ctx: ReduceContext): Rule<V>[] {
  const card = state.cards[cardId];
  if (!card || !effectsOf(ctx, card.code).some((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === verb))) return [];
  const seat = card.controller ?? state.activeSeat;
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  const found: Rule<V>[] = [];
  for (const effect of effectsOf(ctx, card.code)) {
    if (effect.timing !== "constant" || (effect.condition && !holds(state, effect.condition, scope, ctx))) continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== verb || ("when" in instruction && instruction.when && !holds(state, instruction.when, scope, ctx))) continue;
      found.push(instruction as Rule<V>);
    }
  }
  return found;
}

// The icons a hero has while it pays for this card: its own PaysAsIcons for cards like it, and the card's PaidByIcons for
// heroes like it.
export function payingIcons(state: ScenarioState, heroId: string, cardId: string, ctx: ReduceContext): Sphere[] {
  const hero = state.cards[heroId];
  if (!hero || hero.controller == null) return [];
  const seat = hero.controller;
  const icons: Sphere[] = [];
  for (const rule of ownRules(state, heroId, "PaysAsIcons", ctx)) if (fits(state, cardId, rule.pick, seat, ctx)) icons.push(...rule.icons);
  for (const rule of cardRules(state, cardId, "PaidByIcons", ctx)) {
    if (matchesPick(state, heroId, rule.heroes, { seat, sourceId: cardId, counting: true }, ctx)) icons.push(...rule.icons);
  }
  return icons;
}

// How many different pools must pay for the card (PayDistinctHeroes: "from 3 different heroes' pools", "from a single hero's
// resource pool"), for the table's first guess at a payment.
export function distinctRule(state: ScenarioState, cardId: string, ctx: ReduceContext): { min?: number; max?: number } | undefined {
  const rule = cardRules(state, cardId, "PayDistinctHeroes", ctx)[0];
  return rule ? { ...(rule.min != null ? { min: rule.min } : {}), ...(rule.max != null ? { max: rule.max } : {}) } : undefined;
}

// The card's resources cannot pay for this card ("Resources in Na'asiyah's resource pool cannot be used to pay for allies").
export function cannotPay(state: ScenarioState, payerId: string, cardId: string, ctx: ReduceContext): boolean {
  const payer = state.cards[payerId];
  if (!payer || payer.controller == null) return false;
  const seat = payer.controller;
  return ownRules(state, payerId, "CannotPayFor", ctx).some((rule) => fits(state, cardId, rule.pick, seat, ctx));
}

// A card of the seat that is not a hero and whose own pool may pay for this card (PaysFor on an ally in play).
export function isAllyPool(state: ScenarioState, payerId: string, cardId: string, ctx: ReduceContext): boolean {
  const payer = state.cards[payerId];
  if (!payer || payer.zone !== "play" || payer.controller == null) return false;
  const seat = payer.controller;
  return ownRules(state, payerId, "PaysFor", ctx).some((rule) => fits(state, cardId, rule.pick, seat, ctx) && !cannotPay(state, payerId, cardId, ctx));
}

// The seat's allies whose pools may pay for the card (none when no card is being played).
export function allyPools(state: ScenarioState, seat: number, cardId: string | undefined, ctx: ReduceContext): string[] {
  if (cardId == null) return [];
  return (state.seats[seat]?.play ?? []).filter((id) => isAllyPool(state, id, cardId, ctx));
}

// A pool that may hold resources to pay with: a hero of the seat, or an ally pool for this card.
export function payerOk(state: ScenarioState, payerId: string, seat: number, cardId: string | undefined, ctx: ReduceContext): boolean {
  const payer = state.cards[payerId];
  if (payer && cardId != null && openPool(state, payerId, cardId, ctx)) return true;
  if (!payer || payer.controller !== seat) return false;
  return payer.zone === "heroes" || (cardId != null && isAllyPool(state, payerId, cardId, ctx));
}

// Card codes whose records mention a piece of vocabulary, per effect list.
const READERS = new WeakMap<readonly Effect[], Map<string, ReadonlySet<string>>>();

// Whether a card in the game has a record that reads this piece of vocabulary. What the engine remembers only for such a card
// (resources spent this round, who paid for a card, a successful quest) is kept only in a game that has one, so every other
// game's state stays as it was.
export function gameReads(state: ScenarioState, ctx: ReduceContext, needle: string): boolean {
  let byNeedle = READERS.get(ctx.effects);
  if (!byNeedle) {
    byNeedle = new Map();
    READERS.set(ctx.effects, byNeedle);
  }
  let codes = byNeedle.get(needle);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => JSON.stringify(effect).includes(needle)).map((effect) => effect.cardCode));
    byNeedle.set(needle, codes);
  }
  const found = codes;
  return found.size > 0 && Object.values(state.cards).some((card) => found.has(card.code));
}

// The cards that spent resources this round (Tighten Our Belts).
export function noteSpent(state: ScenarioState, payments: readonly Payment[], ctx: ReduceContext): ScenarioState {
  const ids = payments.filter((payment) => payment.amount > 0).map((payment) => payment.heroId);
  if (ids.length === 0 || !gameReads(state, ctx, '"unspent":true')) return state;
  const before = state.spent?.round === state.round ? state.spent.ids : [];
  return { ...state, spent: { round: state.round, ids: [...new Set([...before, ...ids])] } };
}

export function spentThisRound(state: ScenarioState, id: string): boolean {
  return state.spent?.round === state.round && state.spent.ids.includes(id);
}

// This round's quest is remembered, in a game that reads it: who committed (the quest's resolution clears the flag before its
// Responses are offered) and whose quest succeeded ("If you quest successfully this phase", "After Hirgon quests successfully").
export function noteEvent(state: ScenarioState, event: GameEvent, ctx: ReduceContext): ScenarioState {
  if ((event.trigger !== "questSucceeded" && event.trigger !== "committed") || event.seat == null) return state;
  if (!gameReads(state, ctx, '"kind":"questSucceeded"')) return state;
  const now = state.quested?.round === state.round ? state.quested : { round: state.round, committed: [], succeeded: [] };
  if (event.trigger === "committed") return event.cardId ? { ...state, quested: { ...now, committed: [...now.committed, event.cardId] } } : state;
  return now.succeeded.includes(event.seat) ? state : { ...state, quested: { ...now, succeeded: [...now.succeeded, event.seat] } };
}

// The `questSucceeded` condition: the seat's quest succeeded this round; with `committed`, the card was committed to it.
export function questSucceeded(state: ScenarioState, seat: number, cardId: string | null, committed: boolean): boolean {
  const now = state.quested;
  if (now?.round !== state.round || !now.succeeded.includes(seat)) return false;
  return !committed || (cardId != null && now.committed.includes(cardId));
}

// Resource phase (rr.step-1-2): a card that is not a hero and "collects 1 resource each resource phase" adds them to its pool.
export function collectAllyResources(state: ScenarioState, seat: number, steps: EngineStep[], cause: Cause): ScenarioState {
  let next = state;
  for (const id of state.seats[seat]?.play ?? []) {
    const amount = heldAmount(next, id, "collectsResources");
    const card = next.cards[id];
    if (!card || amount <= 0) continue;
    next = updateCard(next, id, { resources: card.resources + amount });
    for (let count = 0; count < amount; count += 1) steps.push({ kind: "gainResource", seat, heroId: id, cause });
  }
  return next;
}
