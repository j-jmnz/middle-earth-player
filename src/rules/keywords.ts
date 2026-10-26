// Rules: rr.attachment-cards, rr.surge, rr.doomed-x, rr.immune, mec109.immune-to-player-card-effects, rr.ranged, rr.sentinel, mec109.peril, mec109.indestructible, mec109.toughness, rr.victory, ltp.victory-x, rr.modifiers, rr.lasting-effects, rr.damage (data/rules/entries.json).
import type { ModifierStat, ModifierUntil } from "../catalog/boundary.ts";

import type { Cause } from "./cause.ts";
import { threatSaved } from "./families/quest-threat.ts";
import { isGuarded, noteHostDefeated, releaseGuarded, textBlank } from "./families/attachments-hold.ts";
import type { EngineStep } from "./intents.ts";
import { cardTypeOf, fromEncounterDeck, isCharacterType, printedOf, type PrintedCard } from "./printed.ts";
import { queueEvent } from "./queue.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { flagged, heldAmount, livingSeats, modifierActive, updateCard, withSeat, withThreat } from "./state.ts";
import { inPlay, moveCard, type Destination } from "./zones.ts";
import { damageGoesTo, defenseFromWillpower } from "./families/defense-damage.ts";
import { attackingHolds } from "./families/attack-strike.ts";
import { discardedFromPlay, doomedRaised, seatThreat } from "./families/play-hooks.ts";
import { alliesToHandDestination } from "./families/deck-rules.ts";
import { reduceLife, takesLifeInstead } from "./families/burden-life.ts";

// `combat` is the damage of an attack (rr.step-6-4-3, rr.step-6-8-3); every other kind is non-combat damage.
export type DamageSource = "framework" | "player" | "combat";

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

// The stats of a card. A value below 0 is treated as 0 (rr.modifiers).
const CARD_STATS: ReadonlySet<ModifierStat> = new Set(["willpower", "attack", "defense", "threat", "questPoints", "engagementCost", "hitPoints"]);

// The holder of a modifier on every ally in play, now and entering play later: an encounter card's lasting effect
// (rr.lasting-effects, 141071:A:1). It stands in the modifier's instance id.
export const ALLIES_CLASS = "allies";

// Whether a modifier is held by this card: by its id, or by the class ALLIES_CLASS.
export function heldBy(modifier: { instanceId: string }, instance: CardInstance, printed: PrintedCard): boolean {
  return modifier.instanceId === instance.id || (modifier.instanceId === ALLIES_CLASS && cardTypeOf(instance, printed) === "ally" && inPlay(instance.zone));
}

// `against` is the enemy the instance is attacking, for a modifier that only holds against some enemies.
// A set modifier overrides every other one, the most recent set winning (rr.modifiers).
export function modifiedStat(
  state: ScenarioState,
  instance: CardInstance,
  stat: ModifierStat,
  cards: ReadonlyMap<string, PrintedCard>,
  against?: string,
): number {
  // "Use their Willpower instead of Defense" (06038).
  if (stat === "defense" && defenseFromWillpower(state, instance.id)) return modifiedStat(state, instance, "willpower", cards, against);
  const printed = printedOf(cards, instance.code);
  let total = printedStat(printed, stat);
  let set: number | null = null;
  // The value with no modifier that lowers it: what a card that "cannot have its Willpower reduced" keeps (09013:A:2).
  let floor = total;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== stat || !heldBy(modifier, instance, printed)) continue;
    if (!modifierActive(state, modifier)) continue;
    if (modifier.when?.kind === "versusHighEngagement" && !versusHighEngagement(state, modifier.when.role, instance, cards, against)) continue;
    // "+2 Attack while attacking that enemy": only while the holder attacks it.
    if (modifier.against != null && modifier.against !== against) continue;
    // "+1 Attack when attacking an Orc" (families/attack-strike.ts).
    if (modifier.when?.kind === "attacking" && !attackingHolds(state, modifier.when, instance, { effects: [], cards }, against)) continue;
    if (modifier.set) set = modifier.amount;
    else total += modifier.amount;
    if (!modifier.set && modifier.amount > 0) floor += modifier.amount;
  }
  const lowered = set ?? total;
  const value = stat === "willpower" && lowered < floor && flagged(state, instance.id, "cannotReduceWillpower") ? floor : lowered;
  return CARD_STATS.has(stat) ? Math.max(0, value) : value;
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
  const threat = seatThreat(state, holder.controller);
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

// A character's defense as the defender of the attack in progress, read as if it were declared, so a modifier that holds
// only while it defends counts ("while defending against an enemy with an engagement cost higher than your threat":
// Hobbit Cloak 141013, Boromir 142004).
export function defenseAsDefender(state: ScenarioState, defenderId: string, cards: ReadonlyMap<string, PrintedCard>): number {
  const defender = state.cards[defenderId];
  if (!defender) return 0;
  const attack = state.pendingAttack;
  const declared = attack ? { ...state, pendingAttack: { ...attack, defenderId, undefended: false } } : state;
  return modifiedStat(declared, defender, "defense", cards);
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

// A modifier held by a class of cards rather than one card (ALLIES_CLASS): no card has to exist for it yet.
export function addClassModifier(
  state: ScenarioState,
  holder: typeof ALLIES_CLASS,
  sourceId: string,
  stat: ModifierStat,
  amount: number,
  until: ModifierUntil,
): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, { instanceId: holder, sourceId, stat, amount, until }] };
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
  const raised = doomedRaised(queueEvent(withThreat(state, seat, current.threat + amount), { trigger: "threatRaised", seat }), seat, cause);
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
  assigned: string,
  amount: number,
  cards: ReadonlyMap<string, PrintedCard>,
  steps: EngineStep[],
  source: DamageSource,
  cause: Cause,
): ScenarioState {
  // Damage assigned to a card another takes for it ("attached hero takes all damage assigned to the chosen hero", 02099).
  const id = damageGoesTo(state, assigned);
  const instance = state.cards[id];
  // Damage goes only on a card in play (rr.in-play-and-out-of-play): a defender that already left play takes none.
  if (!instance || !inPlay(instance.zone)) return state;
  const printed = printedOf(cards, instance.code);
  if (source === "player" && !playerCardEffectCanChoose(printed)) return state;
  // "When attached hero would take any amount of damage, reduce the Ring-bearer's life by an equal amount instead" (141057:A:2).
  if (takesLifeInstead(state, id)) return reduceLife(state, amount, steps, cause);
  // "Enemies cannot take damage" (141048:A:1), "cannot take non-combat damage" (141070:A:2): no damage is placed.
  if (flagged(state, id, "cannotTakeDamage") || (source !== "combat" && flagged(state, id, "cannotTakeNonCombatDamage"))) return state;
  const dealt = placedAmount(printed, amount);
  const damage = instance.damage + dealt;
  steps.push({ kind: "damage", targetId: id, amount: dealt, cause });
  let next = updateCard(state, id, { damage });
  const hurt = dealt > 0 && inPlay(instance.zone);
  if (printed.type === "enemy" && printed.keywords.indestructible) return next;
  const lethal = printed.health != null && damage >= modifiedStat(next, instance, "hitPoints", cards);
  // Damage dealt to a character is first offered to the Responses that cancel it ("cancel X damage just dealt", rr.cancel).
  // A character it would destroy is destroyed by the sweep once they have had their chance (destroyOverwhelmed, damageHeld).
  if (hurt && isCharacterType(printed)) {
    next = queueEvent(next, { trigger: "damageDealt", seat: instance.controller, cardId: id, subject: id, amount: dealt });
    if (lethal && state.holdLethal) return next;
  }
  if (lethal) {
    // The cards attached to an enemy hear that it was destroyed ("When attached enemy is destroyed", families/attachments-hold.ts).
    if (printed.type === "enemy" || printed.type === "hero") next = noteHostDefeated(next, id, printed.type === "hero" ? cards : undefined);
    next = destroyCard(next, id, cards, steps, false, true);
    // A hero or ally destroyed by damage is announced to Responses and Forced effects (rr.destroy), and so is an enemy.
    if (isCharacterType(printed)) next = queueEvent(next, { trigger: "characterDestroyed", seat: instance.controller, subject: id });
    if (printed.type === "enemy") next = queueEvent(next, { trigger: "enemyDestroyed", seat: instance.controller, subject: id });
  } else if (hurt) {
    // A card that took damage and is still in play hears about it ("After Boromir takes any amount of damage").
    next = queueEvent(next, { trigger: "damaged", seat: instance.controller, cardId: id, subject: id, amount: dealt });
  }
  return next;
}

// A character or enemy whose damage is at or above its hit points is destroyed however the hit points came down
// (rr.hit-points): a hit point bonus that ends, or leaves with its source, puts the card it held up in the discard pile.
// `held` keeps a card whose damage is still being answered (damageHeld, when some card could cancel it).
export function destroyOverwhelmed(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[], held: (state: ScenarioState, id: string) => boolean = () => false): ScenarioState {
  let next = state;
  for (const instance of Object.values(state.cards)) {
    if (instance.damage <= 0 || !inPlay(instance.zone)) continue;
    const printed = printedOf(cards, instance.code);
    if (printed.health == null || (printed.type === "enemy" && printed.keywords.indestructible)) continue;
    const current = next.cards[instance.id];
    if (!current || !inPlay(current.zone) || current.damage < modifiedStat(next, current, "hitPoints", cards)) continue;
    if (held(next, instance.id)) continue;
    if (printed.type === "hero") next = noteHostDefeated(next, instance.id, cards);
    next = destroyCard(next, instance.id, cards, steps, false, true);
    if (isCharacterType(printed)) next = queueEvent(next, { trigger: "characterDestroyed", seat: instance.controller, subject: instance.id });
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
  if (!fromEncounterDeck(printed) && instance.controller != null) {
    return { zone: "discard", seat: instance.owner ?? instance.controller };
  }
  if (printed.type === "quest") return { zone: "setAside" };
  return { zone: "encounterDiscard" };
}

// Each card attached to a card that leaves play is discarded at the same time (rr.attachment-cards), to the discard pile of
// its own deck (rr.discard-pile-and-victory-display). A Permanent boon or burden on a hero is removed from the game instead.
export function releaseAttachments(
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
    // A Guarded attachment the card guarded goes to its player instead (families/attachments-hold.ts).
    if (isGuarded(next, attachmentId)) {
      next = releaseGuarded(next, attachmentId);
      continue;
    }
    const printed = printedOf(cards, attachment.code);
    const dest: Destination =
      cardTypeOf(host, hostPrinted) === "hero" && printed.keywords.permanent
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
  // Damage destroyed it: it was not discarded (rr.destroy, families/play-hooks.ts).
  byDamage = false,
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
  // The active location explored: every card hears it, with the number of attachments it had (10006:A:1, 19026:A:2).
  if (explored && printed.type === "location" && state.activeLocation === id) next = queueEvent(next, { trigger: "activeExplored", seat: null, subject: id, amount: instance.attachments.length });
  next = releaseAttachments(next, id, cards, steps);
  const latest = next.cards[id] ?? instance;
  // "Add each ally that leaves play to its owner's hand instead of placing it in the discard pile" (families/deck-rules.ts).
  next = moveCard(next, id, alliesToHandDestination(next, latest, printed) ?? defeatedDestination(latest, printed), instance.attachments);
  steps.push({ kind: "destroy", targetId: id });
  if (cardTypeOf(instance, printed) === "ally" && inPlay(instance.zone)) next = queueEvent(next, { trigger: "allyLeftPlay", seat: instance.controller, subject: id });
  next = discardedFromPlay(next, instance, byDamage);
  if (printed.leavesPlayLoses) next = markLoss(next, `${printed.name} left play`);
  return eliminateEmpties(next, steps);
}

// An eliminated seat leaves the game (rr.player-elimination): its hand, its deck and every card it controls go to their
// owners' discard piles, and the enemies engaged with it return to the staging area with their damage. An attack on
// that seat ends, and a Peril lock it held is released. If it held the first player token, the token passes clockwise at once (rr.first-player,
// faq.first-player-elimination). Nothing is cleared once the game is lost.
export function clearEliminated(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  if (state.lost) return state;
  let next = state;
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat?.eliminated) continue;
    const controlled = Object.values(next.cards).filter(
      (card) => card.controller === index && (inPlay(card.zone) || card.zone === "hand" || card.zone === "deck") && card.zone !== "engaged" && card.zone !== "staging",
    );
    if (controlled.length === 0 && seat.engaged.length === 0) continue;
    for (const enemyId of seat.engaged) {
      next = moveCard(next, enemyId, { zone: "staging" });
      next = updateCard(next, enemyId, { controller: null });
    }
    for (const card of controlled) {
      const current = next.cards[card.id];
      if (!current || current.controller !== index) continue;
      const printed = printedOf(cards, card.code);
      const wasInPlay = inPlay(current.zone);
      const dest: Destination = fromEncounterDeck(printed) ? { zone: "encounterDiscard" } : { zone: "discard", seat: current.owner ?? index };
      next = moveCard(next, card.id, dest);
      if (wasInPlay && printed.leavesPlayLoses) next = markLoss(next, `${printed.name} left play`);
    }
    // The action window between two steps of that attack closes with it.
    if (next.pendingAttack?.seat === index) {
      const between = next.pendingAttack.awaiting != null && next.window?.kind === "frameAction";
      next = { ...next, pendingAttack: null, window: next.window?.kind === "defense" || between ? null : next.window };
    }
    if (next.window?.kind === "chooseEnemy" && next.window.seat === index) next = { ...next, window: null };
    if (next.pendingStrike?.seat === index) {
      const between = next.pendingStrike.awaiting != null && next.window?.kind === "frameAction";
      next = { ...next, pendingStrike: null, window: next.window?.kind === "playerAttack" || between ? null : next.window };
    }
    // A Peril card the seat was resolving locks no one now (mec109.peril).
    if (next.perilSeat === index) next = { ...next, perilSeat: null };
  }
  if (next.seats[next.firstPlayer]?.eliminated) {
    for (let step = 1; step <= next.seatCount; step += 1) {
      const candidate = (next.firstPlayer + step) % next.seatCount;
      if (!next.seats[candidate]?.eliminated) {
        next = { ...next, firstPlayer: candidate };
        break;
      }
    }
  }
  return next;
}

// `final`: the play sweep has already let an ally gain the hero card type, so a seat in heroSavers with no heroes is eliminated now.
export function eliminateEmpties(state: ScenarioState, steps: EngineStep[], final = false): ScenarioState {
  let next = state;
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat || seat.eliminated) continue;
    // The elimination level, lowered by a card the seat holds (The One Ring, families/misc.ts).
    const level = 50 - Math.max(0, heldAmount(next, `seat:${index}`, "eliminationReduction"));
    if (!final && seat.threat < level && seat.heroes.length === 0 && (state.heroSavers ?? []).includes(index)) continue;
    if (seat.threat >= level || seat.heroes.length === 0) {
      // A card that keeps the seat in the game at its threat elimination level is asked instead (10124:A:2).
      const saved = seat.heroes.length > 0 ? threatSaved(next, index) : null;
      if (saved) {
        next = saved;
        continue;
      }
      next = withSeat(next, index, { ...seat, eliminated: true });
      steps.push({ kind: "eliminate", seat: index });
    }
  }
  if (!next.lost && livingSeats(next).length === 0) next = markLoss(next, "No seats remain");
  return next;
}

// A keyword a card prints or has gained: a flag modifier of the same name ("Attached hero gains sentinel", rr.sentinel,
// rr.ranged).
export function hasKeyword(state: ScenarioState, id: string, keyword: "sentinel" | "ranged" | "restricted" | "doomed" | "surge", cards: ReadonlyMap<string, PrintedCard>): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  const printed = printedOf(cards, instance.code);
  // A card whose printed text box is blank has none of its printed keywords; one gained from another source stays (rr.blank).
  const blank = textBlank(state, id);
  if (keyword === "doomed") return !blank && (printed.keywords.doomed ?? 0) > 0;
  if (!blank && printed.keywords[keyword]) return true;
  return (keyword === "sentinel" || keyword === "ranged") && flagged(state, id, keyword);
}

// A character's destruction by damage waits while that damage is still being answered: its `damageDealt` event is queued, its
// Responses are being offered, or one of them is resolving (rr.cancel: "cancel X damage just dealt").
export function damageHeld(state: ScenarioState, id: string): boolean {
  if ((state.pendingEvents ?? []).some((event) => event.trigger === "damageDealt" && event.cardId === id)) return true;
  return state.stack.some(
    (frame) =>
      ((frame.data.kind === "responses" || frame.data.kind === "event") && frame.data.event.trigger === "damageDealt" && frame.data.event.cardId === id) ||
      (frame.data.kind === "effect" && frame.data.hold === id),
  );
}
