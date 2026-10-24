// Rules: rr.surge, rr.doomed-x, rr.immune, mec109.immune-to-player-card-effects, rr.ranged, rr.sentinel, mec109.peril, mec109.indestructible, mec109.toughness, rr.victory, ltp.victory-x (data/rules/entries.json).
import type { ModifierStat, ModifierUntil } from "../catalog/boundary.ts";

import type { Cause } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import { isCharacterType, isPlayerType, printedOf, type PrintedCard } from "./printed.ts";
import { queueEvent } from "./queue.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { livingSeats, modifierActive, updateCard, withSeat, withThreat } from "./state.ts";
import { inPlay, moveCard, type Destination } from "./zones.ts";

export type DamageSource = "framework" | "player";

type CardStat = "willpower" | "attack" | "defense" | "threat" | "questPoints" | "engagementCost";

function printedStat(printed: PrintedCard, stat: ModifierStat): number {
  switch (stat) {
    case "willpower":
    case "attack":
    case "defense":
    case "threat":
    case "questPoints":
    case "engagementCost":
      return printed[stat satisfies CardStat] ?? 0;
    case "hitPoints":
      return printed.health ?? 0;
    default:
      return 0;
  }
}

// `against` is the enemy the instance is attacking, for a modifier that only holds against some enemies.
export function modifiedStat(
  state: ScenarioState,
  instance: CardInstance,
  stat: ModifierStat,
  cards: ReadonlyMap<string, PrintedCard>,
  against?: string,
): number {
  const printed = printedOf(cards, instance.code);
  let total = printedStat(printed, stat);
  for (const modifier of state.modifiers) {
    if (modifier.instanceId !== instance.id || modifier.stat !== stat) continue;
    if (!modifierActive(state, modifier)) continue;
    if (modifier.when?.kind === "versusHighEngagement" && !versusHighEngagement(state, modifier.when.role, instance, cards, against)) continue;
    total += modifier.amount;
  }
  return total;
}

// The enemy in this attack costs more to engage than the threat of the holder's controller. "Your threat" in "defending
// against an enemy with an engagement cost higher than your threat" is the threat of the player who controls the card.
export function versusHighEngagement(
  state: ScenarioState,
  role: "defending" | "attacking",
  holder: CardInstance,
  cards: ReadonlyMap<string, PrintedCard>,
  against?: string,
): boolean {
  if (holder.controller == null) return false;
  const threat = state.seats[holder.controller]?.threat ?? 0;
  let enemyId: string | undefined;
  if (role === "defending") {
    const attack = state.pendingAttack;
    if (!attack || attack.defenderId !== holder.id || attack.undefended) return false;
    enemyId = attack.enemyId;
  } else {
    enemyId = against;
  }
  const enemy = enemyId ? state.cards[enemyId] : undefined;
  if (!enemy || printedOf(cards, enemy.code).engagementCost == null) return false;
  return modifiedStat(state, enemy, "engagementCost", cards) > threat;
}

export function addModifier(
  state: ScenarioState,
  instanceId: string,
  sourceId: string,
  stat: ModifierStat,
  amount: number,
  until: ModifierUntil,
): ScenarioState {
  if (!state.cards[instanceId]) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId, sourceId, stat, amount, until }] };
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
  cause: Cause,
): ScenarioState {
  if (amount <= 0) return state;
  const current = state.seats[seat];
  if (!current || current.eliminated) return state;
  const raised = withThreat(state, seat, current.threat + amount);
  steps.push({ kind: "threat", seat, amount, cause });
  return eliminateEmpties(raised, steps);
}

// Lowers a threat dial. A dial stops at 0, and the step records what it actually dropped.
export function lowerThreat(state: ScenarioState, seat: number, amount: number, steps: EngineStep[], cause: Cause): ScenarioState {
  const current = state.seats[seat];
  if (!current || current.eliminated) return state;
  const dropped = Math.min(amount, current.threat);
  if (dropped <= 0) return state;
  steps.push({ kind: "threat", seat, amount: -dropped, cause });
  return withThreat(state, seat, current.threat - dropped);
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
  cause: Cause,
): ScenarioState {
  const instance = state.cards[id];
  if (!instance) return state;
  const printed = printedOf(cards, instance.code);
  if (source === "player" && !playerCardEffectCanChoose(printed)) return state;
  const dealt = placedAmount(printed, amount);
  const damage = instance.damage + dealt;
  steps.push({ kind: "damage", targetId: id, amount: dealt, cause });
  let next = updateCard(state, id, { damage });
  const hurt = dealt > 0 && inPlay(instance.zone);
  if (printed.type === "enemy" && printed.keywords.indestructible) return next;
  if (printed.health != null && damage >= modifiedStat(next, instance, "hitPoints", cards)) {
    next = destroyCard(next, id, cards, steps);
    // A hero or ally destroyed by damage is announced to Responses and Forced effects (rr.destroy).
    if (isCharacterType(printed)) next = queueEvent(next, { trigger: "characterDestroyed", seat: instance.controller, subject: id });
  } else if (hurt) {
    // A card that took damage and is still in play hears about it ("After Boromir takes any amount of damage").
    next = queueEvent(next, { trigger: "damaged", seat: instance.controller, cardId: id, subject: id });
  }
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
  if (isPlayerType(printed) && instance.controller != null) {
    return { zone: "discard", seat: instance.owner ?? instance.controller };
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
  explored = false,
): ScenarioState {
  const instance = state.cards[id];
  if (!instance) return state;
  const printed = printedOf(cards, instance.code);
  if (printed.keywords.permanent && heroHostInPlay(state, instance)) return state;
  // The cards attached to a location that leaves play hear about it (Elf-stone). Whether the location was explored is
  // decided here, while the attachments still count (rr.explored): an Elf-stone's extra quest point is gone once it is discarded.
  let next = state;
  if (printed.type === "location") {
    for (const attachmentId of instance.attachments) next = queueEvent(next, { trigger: "hostLeftPlay", seat: state.firstPlayer, cardId: attachmentId, subject: id, explored });
  }
  next = releaseAttachments(next, id, cards, steps);
  const latest = next.cards[id] ?? instance;
  next = moveCard(next, id, defeatedDestination(latest, printed));
  steps.push({ kind: "destroy", targetId: id });
  if (printed.type === "ally" && inPlay(instance.zone)) next = queueEvent(next, { trigger: "allyLeftPlay", seat: instance.controller, subject: id });
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
