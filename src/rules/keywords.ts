import type { ModifierStat, ModifierUntil } from "../catalog/boundary.ts";

import type { EngineStep } from "./intents.ts";
import { isPlayerType, printedOf, type PrintedCard } from "./printed.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { livingSeats, modifierActive, updateCard, withSeat, withThreat } from "./state.ts";
import { inPlay, moveCard, type Destination } from "./zones.ts";

export type DamageSource = "framework" | "player";

export function modifiedStat(
  state: ScenarioState,
  instance: CardInstance,
  stat: ModifierStat,
  cards: ReadonlyMap<string, PrintedCard>,
): number {
  const printed = printedOf(cards, instance.code);
  let total = printed[stat] ?? 0;
  for (const modifier of state.modifiers) {
    if (modifier.instanceId !== instance.id || modifier.stat !== stat) continue;
    if (modifierActive(state, modifier)) total += modifier.amount;
  }
  return total;
}

export function addModifier(
  state: ScenarioState,
  sourceId: string,
  stat: ModifierStat,
  amount: number,
  until: ModifierUntil,
): ScenarioState {
  if (!state.cards[sourceId]) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: sourceId, sourceId, stat, amount, until }] };
}

export function placedAmount(printed: PrintedCard, amount: number): number {
  const toughness = printed.type === "enemy" ? printed.keywords.toughness : null;
  const reduced = toughness == null ? amount : amount - toughness;
  return Math.max(0, reduced);
}

export function raiseThreat(
  state: ScenarioState,
  seat: number,
  amount: number,
  steps: EngineStep[],
): ScenarioState {
  if (amount <= 0) return state;
  const current = state.seats[seat];
  if (!current || current.eliminated) return state;
  const raised = withThreat(state, seat, current.threat + amount);
  steps.push({ kind: "threat", seat, amount });
  return eliminateEmpties(raised, steps);
}

export function playerCardEffectCanChoose(printed: PrintedCard): boolean {
  return !printed.keywords.immuneToPlayerCardEffects;
}

export function placeDamage(
  state: ScenarioState,
  id: string,
  amount: number,
  cards: ReadonlyMap<string, PrintedCard>,
  steps: EngineStep[],
  source: DamageSource,
): ScenarioState {
  const instance = state.cards[id];
  if (!instance) return state;
  const printed = printedOf(cards, instance.code);
  if (source === "player" && !playerCardEffectCanChoose(printed)) return state;
  const dealt = placedAmount(printed, amount);
  const damage = instance.damage + dealt;
  steps.push({ kind: "damage", targetId: id, amount: dealt });
  let next = updateCard(state, id, { damage });
  if (printed.type === "enemy" && printed.keywords.indestructible) return next;
  if (printed.health != null && damage >= printed.health) next = destroyCard(next, id, cards, steps);
  return next;
}

export function uniqueBlocked(
  state: ScenarioState,
  printed: PrintedCard,
  cards: ReadonlyMap<string, PrintedCard>,
): boolean {
  if (!printed.isUnique) return false;
  for (const instance of Object.values(state.cards)) {
    if (!inPlay(instance.zone)) continue;
    const other = cards.get(instance.code);
    if (other?.isUnique && other.name === printed.name) return true;
  }
  return false;
}

function heroHostInPlay(state: ScenarioState, instance: CardInstance): boolean {
  if (!instance.host) return false;
  return state.cards[instance.host]?.zone === "heroes";
}

function markLoss(state: ScenarioState, reason: string): ScenarioState {
  if (state.lost) return state;
  return { ...state, lost: true, lossReason: reason };
}

export function defeatedDestination(
  instance: CardInstance,
  printed: PrintedCard,
): Destination {
  if ((printed.type === "enemy" || printed.type === "location") && printed.victory != null) {
    return { zone: "victory" };
  }
  if (isPlayerType(printed.type) && instance.controller != null) {
    return { zone: "discard", seat: instance.controller };
  }
  if (printed.type === "quest") return { zone: "setAside" };
  return { zone: "encounterDiscard" };
}

function releaseAttachments(
  state: ScenarioState,
  id: string,
  cards: ReadonlyMap<string, PrintedCard>,
  steps: EngineStep[],
): ScenarioState {
  const host = state.cards[id];
  if (!host || host.attachments.length === 0) return state;
  const hostPrinted = printedOf(cards, host.code);
  const attachmentIds = host.attachments;
  let next = state;
  for (const attachmentId of attachmentIds) {
    const attachment = next.cards[attachmentId];
    if (!attachment) continue;
    const printed = printedOf(cards, attachment.code);
    const dest: Destination =
      hostPrinted.type === "hero" && printed.keywords.permanent
        ? { zone: "removed" }
        : defeatedDestination(attachment, printed);
    next = moveCard(next, attachmentId, dest);
    steps.push({ kind: "destroy", targetId: attachmentId });
    if (printed.leavesPlayLoses) next = markLoss(next, `${printed.name} left play`);
  }
  return next;
}

export function destroyCard(
  state: ScenarioState,
  id: string,
  cards: ReadonlyMap<string, PrintedCard>,
  steps: EngineStep[],
): ScenarioState {
  const instance = state.cards[id];
  if (!instance) return state;
  const printed = printedOf(cards, instance.code);
  if (printed.keywords.permanent && heroHostInPlay(state, instance)) return state;
  let next = releaseAttachments(state, id, cards, steps);
  const latest = next.cards[id] ?? instance;
  next = moveCard(next, id, defeatedDestination(latest, printed));
  steps.push({ kind: "destroy", targetId: id });
  if (printed.leavesPlayLoses) next = markLoss(next, `${printed.name} left play`);
  return eliminateEmpties(next, steps);
}

export function eliminateEmpties(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat || seat.eliminated) continue;
    if (seat.threat >= 50 || seat.heroes.length === 0) {
      next = withSeat(next, index, { ...seat, eliminated: true });
      steps.push({ kind: "eliminate", seat: index });
    }
  }
  if (!next.lost && livingSeats(next).length === 0) next = markLoss(next, "No seats remain");
  return next;
}
