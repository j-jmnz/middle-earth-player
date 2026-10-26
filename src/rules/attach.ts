// Rules: rr.restricted, rr.resource-match (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { resolveAmount } from "./amounts.ts";
import { effectsOf } from "./listen.ts";
import { ruleCause } from "./cause.ts";
import { characters } from "./combat.ts";
import { hasTrait, holds } from "./conditions.ts";
import { pushEffectFrame } from "./effect-frames.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { playerCardEffectCanChoose } from "./keywords.ts";
import { printedOf } from "./printed.ts";
import { attachBlocked, restrictedAttachments } from "./restrictions.ts";
import type { ScenarioState } from "./state.ts";
import { heldAmount, livingSeats } from "./state.ts";
import { pickCandidates } from "./pick.ts";

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
  const rule = attachRule(ctx, code);
  const candidates: string[] = [];
  if (rule?.hosts) {
    // Any of the filters, from the playing seat's side; a filter that says `control: "you"` keeps the seat's own cards.
    for (const filter of rule.hosts) candidates.push(...pickCandidates(state, filter, seat, [], null, ctx).filter((id) => !candidates.includes(id)));
  } else if (!rule) {
    candidates.push(...characters(state, seat, ctx.cards));
  } else if (rule.host.kind === "activeLocation") {
    if (state.activeLocation) candidates.push(state.activeLocation);
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
    if (rule.limitPerHost && host.attachments.some((other) => state.cards[other]?.code === code)) return false;
    if (rule.hosts) return true;
    if (rule.host.kind === "ringBearer" && !hasTrait(state, id, "Ring-bearer", ctx)) return false;
    if (rule.host.trait && !hasTrait(state, id, rule.host.trait, ctx)) return false;
    if (rule.host.name && printedOf(ctx.cards, host.code).name !== rule.host.name) return false;
    if (rule.host.sphere && printedOf(ctx.cards, host.code).sphere !== rule.host.sphere) return false;
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
  // Secrecy X: X less while the player's threat is 20 or less.
  if (printed.keywords.secrecy != null && (state.seats[seat]?.threat ?? 99) <= 20) cost -= printed.keywords.secrecy;
  for (const effect of effectsOf(ctx, instance.code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "ReduceCost") continue;
      if (instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
      cost -= resolveAmount(state, instruction.amount, { actor: seat, sourceId: cardId }, ctx);
    }
  }
  return Math.max(0, cost);
}

// A character cannot have more than 2 restricted attachments (more when a card says it can have additional ones). When one
// too many arrives, its controller chooses one of the restricted attachments and it moves at once to its owner's discard
// pile (rr.restricted).
export function enforceRestricted(state: ScenarioState, hostId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (restrictedAttachments(state, hostId, ctx).length <= 2 + Math.max(0, heldAmount(state, hostId, "extraRestricted"))) return state;
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
