// Rules: rr.restricted, rr.resource-match, rr.attachment-cards, rr.play-restrictions-and-permissions (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { ruleCause } from "./cause.ts";
import { characters } from "./combat.ts";
import { hasTrait, holds } from "./conditions.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { playerCardEffectCanChoose } from "./keywords.ts";
import { heroPays } from "./payments.ts";
import { printedOf } from "./printed.ts";
import { stagingLocations } from "./quest.ts";
import { attachBlocked, restrictedAttachments } from "./restrictions.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats } from "./state.ts";

type AttachRule = Extract<Instruction, { verb: "AttachesTo" }>;

// The "Attach to ..." line of an attachment, as its constant record. A card with no record may go on any character.
export function attachRule(ctx: ReduceContext, code: string): AttachRule | undefined {
  for (const effect of ctx.effects) {
    if (effect.cardCode !== code || effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "AttachesTo") return instruction;
  }
  return undefined;
}

// The cards an attachment with this code may be attached to. A card with an "Attach to" record may go on a card of any
// seat; one without goes on a character of the seat that plays it.
export function attachmentHostIds(state: ScenarioState, seat: number, code: string, ctx: ReduceContext): string[] {
  const rule = attachRule(ctx, code);
  const candidates: string[] = [];
  if (!rule) {
    candidates.push(...characters(state, seat, ctx.cards));
  } else if (rule.host.kind === "activeLocation") {
    if (state.activeLocation) candidates.push(state.activeLocation);
  } else if (rule.host.kind === "location") {
    // "Attach to a location" (01056:A:1): one in the staging area or the active location.
    candidates.push(...stagingLocations(state, ctx.cards), ...[state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null));
  } else if (rule.host.kind === "engagedEnemy") {
    // "Attach to an enemy engaged with a player" (01069:A:1).
    for (const index of livingSeats(state)) candidates.push(...(state.seats[index]?.engaged ?? []).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy"));
  } else {
    for (const index of livingSeats(state)) {
      if (rule.host.kind === "hero" || rule.host.kind === "ringBearer") candidates.push(...(state.seats[index]?.heroes ?? []));
      else candidates.push(...characters(state, index, ctx.cards));
    }
  }
  return candidates.filter((id) => {
    const host = state.cards[id];
    if (!host || !playerCardEffectCanChoose(printedOf(ctx.cards, host.code))) return false;
    if (attachBlocked(state, ctx, id, code)) return false;
    if (!rule) return true;
    if (rule.host.kind === "ringBearer" && !hasTrait(state, id, "Ring-bearer", ctx)) return false;
    if (rule.host.trait && !hasTrait(state, id, rule.host.trait, ctx)) return false;
    if (rule.host.name && printedOf(ctx.cards, host.code).name !== rule.host.name) return false;
    if (rule.limitPerHost && host.attachments.some((other) => state.cards[other]?.code === code)) return false;
    return true;
  });
}

// What a card costs to play from the hand: its printed cost less each ReduceCost record whose condition holds.
export function playCost(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): number | null {
  const instance = state.cards[cardId];
  if (!instance) return null;
  const printed = printedOf(ctx.cards, instance.code);
  if (printed.cost == null) return null;
  let cost = printed.cost;
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  for (const effect of ctx.effects) {
    if (effect.cardCode !== instance.code || effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "ReduceCost") continue;
      if (instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
      cost -= instruction.amount;
    }
  }
  return Math.max(0, cost);
}

// "You must use resources from 3 different heroes' pools to pay for this card" (01036:A:1): a play restriction checked on the
// payment (rr.play-restrictions-and-permissions). Why the payment is refused, or null.
export function payFromHeroesReason(state: ScenarioState, cardId: string, payments: readonly { heroId: string; amount: number }[], ctx: ReduceContext): string | null {
  const count = payFromHeroes(state, cardId, ctx);
  const heroes = new Set(payments.filter((payment) => payment.amount > 0).map((payment) => payment.heroId)).size;
  return count != null && heroes < count ? `Pay with resources from ${count} different heroes` : null;
}

// The heroes whose pools must pay for the card, or null when any may (01036:A:1).
export function payFromHeroes(state: ScenarioState, cardId: string, ctx: ReduceContext): number | null {
  const code = state.cards[cardId]?.code;
  for (const effect of ctx.effects) {
    if (effect.cardCode !== code || effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "PayFromHeroes") return instruction.count;
  }
  return null;
}

// The seat has that many heroes with a resource of the card's sphere, so the card can be paid for as it must.
export function payFromHeroesPossible(state: ScenarioState, seat: number, cardId: string, ctx: ReduceContext): boolean {
  const count = payFromHeroes(state, cardId, ctx);
  if (count == null) return true;
  const sphere = printedOf(ctx.cards, state.cards[cardId]?.code ?? "").sphere;
  return (state.seats[seat]?.heroes ?? []).filter((id) => (state.cards[id]?.resources ?? 0) > 0 && heroPays(state, id, sphere, ctx, cardId)).length >= count;
}

// A character cannot have more than 2 restricted attachments. When a third arrives, its controller chooses one of the
// restricted attachments and it moves at once to its owner's discard pile (rr.restricted).
export function enforceRestricted(state: ScenarioState, hostId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (restrictedAttachments(state, hostId, ctx).length <= 2) return state;
  const host = state.cards[hostId];
  const actor = host?.controller ?? state.activeSeat;
  return pushEffectFrame(
    { ...state, window: null },
    {
      frame: "ResolveEffect",
      sourceId: hostId,
      actor,
      peril: false,
      effectId: "rr.restricted",
      instructions: [{ verb: "DiscardRestricted" }],
      cancel: null,
      blockCancel: null,
      cause: ruleCause("rr.restricted"),
      ...(state.window ? { resume: { window: state.window, seat: state.activeSeat } } : {}),
    },
    steps,
  );
}
