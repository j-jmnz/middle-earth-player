// Rules: rr.restricted, rr.resource-match, trg.secrecy (data/rules/entries.json).
import type { Instruction } from "../../catalog/boundary.ts";

import { resolveAmount } from "../interpret/amounts.ts";
import { effectsOf } from "../windows/listen.ts";
import { costIncrease, costReduction } from "./cost-rules.ts";
import { ruleCause } from "../core/cause.ts";
import { characters } from "../combat/combat.ts";
import { hasTrait, holds } from "../interpret/conditions.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import { playIntoRule } from "../families/attachments/play.ts";
import { activeOf } from "../families/breaking/areas.ts";
import { questHosts } from "../families/attachments/quest.ts";
import { seatThreat } from "../families/play/hooks.ts";
import { fixedX, grantedSecrecy } from "../families/misc/cost.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { playerCardEffectCanChoose } from "../core/keywords.ts";
import { printedOf } from "../core/printed.ts";
import { attachBlocked, restrictedLoad } from "../interpret/restrictions.ts";
import type { ScenarioState } from "../core/state.ts";
import { heldAmount, livingSeats } from "../core/state.ts";
import { matchesPick, pickCandidates } from "../interpret/pick.ts";

type AttachRule = Extract<Instruction, { verb: "AttachesTo" }>;

// The "Attach to ..." line of an attachment, as its constant record. A card with no record may go on any character.
export function attachRule(ctx: ReduceContext, code: string): AttachRule | undefined {
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "AttachesTo") return instruction;
  }
  return undefined;
}

// The cards an attachment with this code may be attached to. A card with an "Attach to" record may go on a card of any
// seat; one without goes on a character of the seat that plays it.
export function attachmentHostIds(state: ScenarioState, seat: number, code: string, ctx: ReduceContext): string[] {
  // A card played unattached or onto a threat dial goes on no card (families/attachments/play.ts).
  if (playIntoRule(ctx, code)) return [];
  const rule = attachRule(ctx, code);
  const named = rule?.host ?? { kind: "character" as const };
  const candidates: string[] = [];
  if (rule?.hosts) {
    // Any of the filters, from the playing seat's side; a filter that says `control: "you"` keeps the seat's own cards.
    for (const filter of rule.hosts) candidates.push(...pickCandidates(state, filter, seat, [], null, ctx).filter((id) => !candidates.includes(id)));
  } else if (!rule) {
    candidates.push(...characters(state, seat, ctx.cards));
  } else if (named.kind === "activeLocation") {
    // The playing seat's own active location once stages are separate (families/breaking/areas.ts).
    const active = activeOf(state, seat);
    if (active) candidates.push(active);
  } else if (named.kind === "quest") {
    candidates.push(...questHosts(state, seat, ctx));
  } else {
    for (const index of livingSeats(state)) {
      if (named.kind === "hero" || named.kind === "ringBearer") candidates.push(...(state.seats[index]?.heroes ?? []));
      else candidates.push(...characters(state, index, ctx.cards));
    }
  }
  return candidates.filter((id) => {
    const host = state.cards[id];
    if (!host || !playerCardEffectCanChoose(printedOf(ctx.cards, host.code), state, id, printedOf(ctx.cards, code))) return false;
    if (attachBlocked(state, ctx, id, code)) return false;
    if (!rule) return true;
    if (rule.limitPerHost && host.attachments.some((other) => state.cards[other]?.code === code)) return false;
    if (rule.hosts) return true;
    if (named.kind === "ringBearer" && !hasTrait(state, id, "Ring-bearer", ctx)) return false;
    if (named.trait && !hasTrait(state, id, named.trait, ctx)) return false;
    if (named.name && printedOf(ctx.cards, host.code).name !== named.name) return false;
    if (named.sphere && printedOf(ctx.cards, host.code).sphere !== named.sphere) return false;
    return true;
  });
}

// What a card costs to play from the hand: its printed cost less each ReduceCost record whose condition holds, Secrecy, the
// seat's discounts and the constants of its cards in play (cost-rules.ts). `hostId` is where an attachment goes.
export function playCost(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, hostId?: string | null): number | null {
  const instance = state.cards[cardId];
  if (!instance) return null;
  const printed = printedOf(ctx.cards, instance.code);
  // A cost of X that a record fixes ("X is the number of players in the game") is that number (families/misc/cost.ts).
  const base = printed.cost ?? fixedX(state, cardId, ctx);
  if (base == null) return null;
  let cost = base;
  const scope = { actor: seat, sourceId: cardId, returned: 0 };
  // Secrecy X: X less while the player's threat is 20 or less, and the Secrecy a card in play grants this card.
  if (printed.keywords.secrecy != null && state.seats[seat] && seatThreat(state, seat) <= 20) cost -= printed.keywords.secrecy;
  cost -= grantedSecrecy(state, cardId, seat, ctx);
  for (const effect of effectsOf(ctx, instance.code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "ReduceCost") continue;
      if (instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
      // "Reduce the cost to play Herugrim on Théoden by 1": only onto a host that matches.
      if (instruction.host && (hostId == null || !matchesPick(state, hostId, instruction.host, { seat, sourceId: cardId, counting: true }, ctx))) continue;
      cost -= resolveAmount(state, instruction.amount, { actor: seat, sourceId: cardId }, ctx);
    }
  }
  const reduced = costReduction(state, cardId, seat, ctx, hostId);
  if (reduced.amount > 0) cost = Math.max(Math.min(cost, reduced.min), cost - reduced.amount);
  // A constant of a card in play makes it cost more (IncreaseCost, rr.modifiers: not below 0).
  return Math.max(0, cost + costIncrease(state, cardId, seat, ctx));
}

// How many Restricted attachments a character can hold: 2, and more when a card says it can have additional ones (rr.restricted).
export function restrictedLimit(state: ScenarioState, hostId: string): number {
  return 2 + Math.max(0, heldAmount(state, hostId, "extraRestricted"));
}

// A character cannot have more than 2 restricted attachments (more when a card says it can have additional ones). When one
// too many arrives, its controller chooses one of the restricted attachments and it moves at once to its owner's discard
// pile (rr.restricted).
export function enforceRestricted(state: ScenarioState, hostId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (restrictedLoad(state, hostId, ctx) <= restrictedLimit(state, hostId)) return state;
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
