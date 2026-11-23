// Rules: rr.resources, rr.resource-match, rr.cost, rr.attachment-cards, rr.lasting-effects (data/rules/entries.json).
//
// The costs family's verbs that change a pool, the effect's X or a discount: ReduceNextCost ("reduce the cost of the next
// Silvan ally you play this phase by 1"), ChooseX ("discard X cards from your hand"), DiscardResources, SpendResources ("the
// players as a group may spend 2 Leadership resources"), HeroesGainResources ("each hero that player controls that did not
// spend any resources this round gains 1 resource") and Reattach ("attach Dúnedain Mark to another hero").
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { markShort } from "../../interpret/effect-verbs.ts";
import { attachmentHostIds, enforceRestricted } from "../../player/attach.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { askTarget, openBranch } from "../../windows/choices.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { heroPays } from "../../player/payments.ts";
import { mayGainResources } from "../misc/guards.ts";
import { lastPicked, seatOf } from "../../interpret/player-verbs.ts";
import { printedOf, type Sphere } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Discount, ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { attachTo } from "../../core/zones.ts";
import { noteSpent, spentThisRound, spheresOf } from "./pay.ts";

type Focus = { seat: number; sourceId: string | null; chosen?: string };

// ReduceNextCost: a discount waits on the state for the next matching card (cost-rules.ts spends it, costs/play.ts adds its
// riders). "That card gains Doomed 1" or "That ally does not require a resource match" makes it worth keeping at 0.
export function reduceNextCost(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReduceNextCost" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const seat = instruction.who === "picked" ? seatOf(lastPicked(state)) : focus.seat;
  const amount = resolveAmount(state, instruction.amount, scope, ctx);
  const rider = instruction.doomed != null || instruction.noMatch === true || instruction.cannotQuest === true;
  if (seat == null || (amount <= 0 && !rider)) return state;
  // "that matches attached hero's sphere": the host's spheres, read now (`hostSpheres`).
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const spheres = instruction.hostSphere ? hostSpheres(state, source?.host ?? "", ctx) : null;
  if (spheres != null && spheres.length === 0) return state;
  const pick = spheres ? { ...instruction.pick, spheres } : instruction.pick;
  const discount: Discount = {
    seat,
    sourceId: focus.sourceId ?? "",
    pick,
    amount,
    until: instruction.until,
    ...(instruction.min != null ? { min: instruction.min } : {}),
    ...(instruction.who === "any" ? { anySeat: true as const } : {}),
    ...(instruction.doomed != null ? { doomed: instruction.doomed } : {}),
    ...(instruction.noMatch ? { noMatch: true as const } : {}),
    ...(instruction.cannotQuest ? { cannotQuest: true as const } : {}),
  };
  return { ...state, discounts: [...(state.discounts ?? []), discount] };
}

// The spheres of influence of the hero a card is attached to: its printed sphere and every resource icon it gained (docs/brief.md, Three layers). A Baggins or Fellowship hero is of that
// sphere, so a Baggins or Fellowship card matches him; only a neutral hero has none, since a neutral card has no sphere (rr.neutral-cards).
export function hostSpheres(state: ScenarioState, hostId: string, ctx: ReduceContext): Sphere[] {
  const host = state.cards[hostId];
  if (!host) return [];
  return spheresOf(state, hostId, printedOf(ctx.cards, host.code).sphere, ctx).filter((sphere) => sphere !== "neutral");
}

// ChooseX: the actor picks X among the numbers that can be chosen (a branch per number); one number is taken without asking.
export function chooseX(state: ScenarioState, instruction: Extract<Instruction, { verb: "ChooseX" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const max = Math.min(...instruction.max.map((amount) => resolveAmount(state, amount, scope, ctx)));
  const min = instruction.min ?? 1;
  if (max < min) return state;
  if (max === min) return setX(state, min);
  const options = Array.from({ length: max - min + 1 }, (_, at) => ({ id: `x${min + at}`, instructions: [{ verb: "SetX" as const, value: min + at }] }));
  return openBranch(state, { instruction: { verb: "Choose", who: "actor", options }, seat: focus.seat, chosen: null }, 0, ctx);
}

export function setX(state: ScenarioState, value: number): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, x: value } }) : state;
}

// DiscardResources: resources leave a card's pool for the bank, without being spent.
export function discardResources(state: ScenarioState, instruction: Extract<Instruction, { verb: "DiscardResources" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const id = refCard(state, instruction.target ?? "picked", scope) ?? "";
  const card = state.cards[id];
  if (!card) return state;
  const named = instruction.all ? card.resources : resolveAmount(state, instruction.amount ?? 1, scope, ctx);
  const amount = Math.min(card.resources, named);
  const next = amount > 0 ? updateCard(state, id, { resources: card.resources - amount }) : state;
  // A discard that found fewer tokens than it names is not resolved in full, so the text after "then" is not attempted (the `thenResolves` condition, rr.then).
  return amount < named ? markShort(next, ctx) : next;
}

// The heroes whose resources can pay `sphere` for the actor, or for any player with `group`, and what they hold in all.
export function spendablePools(state: ScenarioState, actor: number, spec: { sphere?: Sphere | undefined; group?: boolean | undefined }, ctx: ReduceContext): { pools: string[]; total: number } {
  const seats = spec.group ? livingSeats(state) : [actor];
  const pools = seats.flatMap((seat) => state.seats[seat]?.heroes ?? []).filter((id) => (state.cards[id]?.resources ?? 0) > 0 && heroPays(state, id, spec.sphere ?? null, ctx));
  return { pools, total: pools.reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0) };
}

// SpendResources: a hero for each resource, chosen by the actor unless every resource left must pay.
export function spendResources(state: ScenarioState, instruction: Extract<Instruction, { verb: "SpendResources" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  if (instruction.target) {
    // From one card's own pool: nobody chooses, and a pool that cannot pay spends nothing.
    const id = refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId)) ?? "";
    if ((state.cards[id]?.resources ?? 0) < instruction.amount) return state;
    return noteSpent(updateCard(state, id, { resources: (state.cards[id]?.resources ?? 0) - instruction.amount }), [{ heroId: id, amount: instruction.amount }], ctx);
  }
  let paid = [...(instruction.paid ?? []), ...(focus.chosen ? [focus.chosen] : [])];
  const left = (id: string): number => (state.cards[id]?.resources ?? 0) - paid.filter((entry) => entry === id).length;
  const { pools } = spendablePools(state, focus.seat, instruction, ctx);
  if (paid.length === 0 && pools.reduce((sum, id) => sum + left(id), 0) < instruction.amount) return state;
  while (paid.length < instruction.amount) {
    const open = pools.filter((id) => left(id) > 0);
    if (open.length === 0) return state;
    if (open.length === 1 || open.reduce((sum, id) => sum + left(id), 0) <= instruction.amount - paid.length) {
      paid = [...paid, open[0] ?? ""];
      continue;
    }
    return askTarget(state, { instruction: { ...instruction, paid }, seat: focus.seat, chosen: null }, open);
  }
  let next = state;
  const payments: { heroId: string; amount: number }[] = [];
  for (const id of paid) {
    const card = next.cards[id];
    if (!card) continue;
    next = updateCard(next, id, { resources: card.resources - 1 });
    const entry = payments.find((payment) => payment.heroId === id);
    if (entry) entry.amount += 1;
    else payments.push({ heroId: id, amount: 1 });
  }
  return noteSpent(next, payments, ctx);
}

// HeroesGainResources: each hero of the seat (each one that spent nothing this round, with `unspent`) gains resources.
export function heroesGain(state: ScenarioState, instruction: Extract<Instruction, { verb: "HeroesGainResources" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = instruction.who === "picked" ? seatOf(lastPicked(state)) : focus.seat;
  if (seat == null) return state;
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (const id of state.seats[seat]?.heroes ?? []) {
    const hero = next.cards[id];
    if (!hero || amount <= 0 || (instruction.unspent && spentThisRound(state, id)) || !mayGainResources(state, id, focus.sourceId, ctx)) continue;
    for (let added = 0; added < amount; added += 1) steps.push({ kind: "gainResource", seat, heroId: id, cause: currentCause(steps, UNATTRIBUTED) });
    next = queueEvent(updateCard(next, id, { resources: hero.resources + amount }), { trigger: "resourcesAdded", seat, cardId: id });
  }
  return next;
}

// Reattach: the source attachment (the last picked one with `card: picked`) leaves its host for another card it may be attached to, which the actor chooses.
export function reattach(state: ScenarioState, instruction: Extract<Instruction, { verb: "Reattach" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const movedId = instruction.card === "picked" ? lastPicked(state) : focus.sourceId;
  const source = movedId ? state.cards[movedId] : undefined;
  if (!source?.host) return state;
  const options = attachmentHostIds(state, focus.seat, source.code, ctx).filter((id) => id !== source.host);
  const target = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!target) return options.length > 1 ? askTarget(state, { instruction, seat: focus.seat, chosen: null }, options) : state;
  const old = state.cards[source.host];
  let next = old ? updateCard(state, old.id, { attachments: old.attachments.filter((id) => id !== source.id) }) : state;
  next = attachTo(updateCard(next, source.id, { host: null }), source.id, target);
  next = queueEvent(next, { trigger: "attached", seat: source.controller, subject: source.id, other: target });
  return enforceRestricted(next, target, ctx, steps);
}
