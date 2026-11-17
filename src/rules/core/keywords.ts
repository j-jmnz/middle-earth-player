// Rules: rr.attachment-cards, rr.surge, rr.doomed-x, rr.immune, mec109.immune-to-player-card-effects, rr.ranged, rr.sentinel, mec109.peril, mec109.indestructible, mec109.toughness, rr.victory, ltp.victory-x, rr.modifiers, rr.lasting-effects, rr.damage (data/rules/entries.json).
import type { ModifierStat, ModifierUntil } from "../../catalog/boundary.ts";

import type { Cause } from "./cause.ts";
import { isGuarded, noteHostDefeated, releaseGuarded, textBlank } from "../families/attachments/hold.ts";
import { keywordsKept } from "../families/angmar/blank.ts";
import { defendingAgainst } from "../families/angmar/combat.ts";
import type { EngineStep } from "./intents.ts";
import { cardTypeOf, fromEncounterDeck, isCharacterType, isLocationCard, isPlayerType, printedOf, type PrintedCard } from "./printed.ts";
import { queueEvent } from "../windows/queue.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { flagged, heldAmount, modifierActive, updateCard, withThreat } from "./state.ts";
import { claimedDestination, returnedToDeck } from "../families/objectives/claimed.ts";
import { returnAttachedEnemy } from "../families/angmar/reanimate/attached.ts";
import { inPlay, moveCard, releaseGrappled, type Destination } from "./zones.ts";
import { damageGoesTo, defenseFromWillpower } from "../families/defense/damage.ts";
import { attackingHolds } from "../families/attack/strike.ts";
import { resourceCancel, resourceShield } from "../families/aflame/attack.ts";
import { cancelAllDamage, damageShield } from "../families/wilderland/shield.ts";
import { discardedFromPlay, doomedRaised, seatThreat } from "../families/play/hooks.ts";
import { alliesToHandDestination } from "../families/deck/rules.ts";
import { reduceLife, takesLifeInstead } from "../families/burden/life.ts";
import { placedLimit } from "../families/uncharted/limit.ts";
import { grappleThreat } from "../families/grapple/values.ts";
import { perDamage, threatPerHostWillpower } from "../families/cirith-ungol/values.ts";
import { printedStat, victoryOf } from "./printed-stat.ts";
import { wallRoom } from "../families/pelennor/wall.ts";
import { heldBy } from "./holder-classes.ts";
import { inAreaOf } from "../families/breaking/areas.ts";
import { versusVictoryTrait } from "../families/captured/values.ts";
import { eliminateEmpties, markLoss } from "./eliminate.ts";

// `combat` is the damage of an attack (rr.step-6-4-3, rr.step-6-8-3); every other kind is non-combat damage.
// `quest`: an effect of a quest card or a side quest (framework damage that a card's "non-quest effects" limit does not count, 19074:A:2).
export type DamageSource = "framework" | "player" | "combat" | "quest";

export { printedStat };

// The stats of a card. A value below 0 is treated as 0 (rr.modifiers).
const CARD_STATS: ReadonlySet<ModifierStat> = new Set(["willpower", "attack", "defense", "threat", "questPoints", "engagementCost", "hitPoints"]);

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
  // "During the encounter phase, treat each enemy's engagement cost as if it were 0" (41005:B:1).
  if (stat === "engagementCost" && state.phase === "Encounter" && flagged(state, "table", "engagementCostZero")) return 0;
  const printed = printedOf(cards, instance.code);
  // The Threat of the enemies grappled with a location is added to it (dcce.grapple).
  let total = printedStat(printed, stat, instance.face) + (stat === "threat" ? grappleThreat(state, instance.id) : 0);
  let set: number | null = null;
  // The value with no modifier that lowers it: what a card that "cannot have its Willpower reduced" keeps (09013:A:2), or its Defense (900506:A:1).
  let floor = total;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== stat || !heldBy(modifier, instance, printed)) continue;
    if (!modifierActive(state, modifier)) continue;
    if (modifier.when?.kind === "versusHighEngagement" && !versusHighEngagement(state, modifier.when.role, instance, cards, against)) continue;
    if (modifier.when?.kind === "versusDefender" && !versusDefender(state, instance, modifier.when, cards)) continue;
    if (modifier.when?.kind === "defendingAgainst" && !defendingAgainst(state, instance, modifier.when.trait, { effects: [], cards })) continue;
    if (modifier.when?.kind === "versusVictoryTrait" && !versusVictoryTrait(state, instance, cards, against)) continue;
    if (modifier.when?.kind === "inArea" && !inAreaOf(state, instance, modifier.when.seat)) continue;
    // "+2 Attack while attacking that enemy": only while the holder attacks it.
    if (modifier.against != null && modifier.against !== against) continue;
    // "+1 Attack when attacking an Orc" (families/attack/strike.ts).
    if (modifier.when?.kind === "attacking" && !attackingHolds(state, modifier.when, instance, { effects: [], cards }, against)) continue;
    if (modifier.set) set = modifier.amount;
    else total += modifier.amount;
    if (!modifier.set && modifier.amount > 0) floor += modifier.amount;
  }
  // Effects that count the damage on the card or the Willpower of its host (146023:A:1, 146022:A:3, 146014:A:2), recalculated as they change (faq.lasting-effects).
  total += perDamage(state, instance, printed, stat);
  if (stat === "threat") total += threatPerHostWillpower(state, instance, printed, cards);
  const lowered = set ?? total;
  const value = lowered < floor && ((stat === "willpower" && flagged(state, instance.id, "cannotReduceWillpower")) || (stat === "defense" && flagged(state, instance.id, "cannotReduceDefense"))) ? floor : lowered;
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

// The holder is the enemy making the attack in progress and the character defending it has at most this many printed hit points (142071:A:2).
// With `ally`, the defender is an ally (12054:A:2).
export function versusDefender(state: ScenarioState, holder: CardInstance, versus: { maxHitPoints?: number; ally?: true }, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const attack = state.pendingAttack;
  if (!attack || attack.enemyId !== holder.id || attack.defenderId == null || attack.undefended) return false;
  const defender = state.cards[attack.defenderId];
  const printed = defender ? printedOf(cards, defender.code) : null;
  if (printed == null || (versus.ally === true && cardTypeOf(defender!, printed) !== "ally")) return false;
  return versus.maxHitPoints == null || (printed.health != null && printed.health <= versus.maxHitPoints);
}

// A character's defense as the defender of the attack in progress, read as if it were declared, so a modifier that holds
// only while it defends counts ("while defending against an enemy with an engagement cost higher than your threat":
// Hobbit Cloak 141013, Boromir 142004).
export function defenseAsDefender(state: ScenarioState, defenderId: string, cards: ReadonlyMap<string, PrintedCard>): number {
  const defender = state.cards[defenderId];
  if (!defender) return 0;
  const attack = state.pendingAttack;
  // The enemy making the attack says its defenders do not count their Defense (19067:A:1).
  if (attack && flagged(state, attack.enemyId, "defenseIgnored")) return 0;
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

// The damage a card takes of `amount` once Toughness has reduced it (mec109.toughness): the printed keyword, and the Toughness the card holds from a card effect ("gains Toughness 2 until the end of the round", 143043:A:2).
export function toughnessOf(state: ScenarioState, id: string, printed: PrintedCard): number {
  return printed.type === "enemy" ? (printed.keywords.toughness ?? 0) + heldAmount(state, id, "toughness") : 0;
}

export function placedAmount(state: ScenarioState, id: string, printed: PrintedCard, amount: number): number {
  return Math.max(0, amount - toughnessOf(state, id, printed));
}

// Whether a card's printed keywords count: a card whose printed text box is blank has none of them, unless a keepsKeywords modifier says they stay (09054:A:1); one gained from another source stays (rr.blank).
export function printedKeywordsBlank(state: ScenarioState, id: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  return textBlank(state, id, cards) && !keywordsKept(state, id, cards);
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

// Immune to player card effects: printed, or gained while a card says so (`immuneToPlayerCards`, families/nightmare.ts, 906201:A:2).
// `source` is the printed player card whose effect it is, when known: "Immune to non-Fellowship player card effects" (`immuneToNonFellowship`, 144075:A:1) lets a Fellowship card's effect through. Every path a player card's effect takes (a pick, an attachment host, damage, the enemy list) asks this one predicate.
export function playerCardEffectCanChoose(printed: PrintedCard, state?: ScenarioState, id?: string, source?: PrintedCard | null): boolean {
  if (state && id && (flagged(state, id, "immuneToPlayerCards") || flagged(state, id, "immuneToCardEffects"))) return false;
  if (state && id && source && isPlayerType(source) && source.sphere !== "fellowship" && flagged(state, id, "immuneToNonFellowship")) return false;
  return !printed.keywords.immuneToPlayerCardEffects;
}

/** The printed card behind an effect's source, for playerCardEffectCanChoose. */
export function sourcePrinted(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, sourceId: string | null | undefined): PrintedCard | null {
  const card = sourceId ? state.cards[sourceId] : undefined;
  return card ? printedOf(cards, card.code) : null;
}

/** Whether an effect from `sourceId` is an encounter card effect: a card that is neither a player card nor a quest or campaign card (a quest card's effect is not an encounter card's, "Unique locations cannot be discarded from play by encounter card effects", 12193:B:1). */
export function isEncounterCardEffect(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, sourceId: string | null): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source || isPlayerCardEffect(state, cards, sourceId)) return false;
  const type = printedOf(cards, source.code).type;
  return type !== "quest" && type !== "campaign";
}

/** Whether an effect from `sourceId` is a player card effect: a player card without an encounter back, or no card at all (a choice a player makes). An ally with an encounter back is an encounter card and has encounter card effects (dcce.encounter-cards). */
export function isPlayerCardEffect(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, sourceId: string | null): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return true;
  const printed = printedOf(cards, source.code);
  return isPlayerType(printed) && printed.backType !== "encounter";
}

// An enemy with the Indestructible keyword, unless a card took its keywords away (`losesKeywords`, The Great Bridge, 142050:A:2).
export function indestructible(state: ScenarioState, id: string, printed: PrintedCard): boolean {
  return printed.type === "enemy" && (printed.keywords.indestructible || flagged(state, id, "indestructible")) && !flagged(state, id, "losesKeywords");
}

export function placeDamage(state: ScenarioState, assigned: string, amount: number, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[], source: DamageSource, cause: Cause, sourceId?: string | null): ScenarioState {
  // "Damage that would be placed on Minas Tirith must be placed on City Wall first" (145046:A:1): the wall takes what it has room for, the rest goes on the card.
  const wall = amount > 0 ? wallRoom(state, assigned, cards) : null;
  if (!wall) return placeDamageHere(state, assigned, amount, cards, steps, source, cause, sourceId);
  const onWall = Math.min(amount, wall.room);
  const first = placeDamageHere(state, wall.wall, onWall, cards, steps, source, cause, sourceId);
  return amount > onWall ? placeDamageHere(first, assigned, amount - onWall, cards, steps, source, cause, sourceId) : first;
}

function placeDamageHere(state: ScenarioState, assigned: string, amount: number, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[], source: DamageSource, cause: Cause, sourceId?: string | null): ScenarioState {
  // Damage assigned to a card another takes for it ("attached hero takes all damage assigned to the chosen hero", 02099).
  const id = damageGoesTo(state, assigned);
  const instance = state.cards[id];
  // Damage goes only on a card in play (rr.in-play-and-out-of-play): a defender that already left play takes none.
  if (!instance || !inPlay(instance.zone)) return state;
  const printed = printedOf(cards, instance.code);
  if (source === "player" && !playerCardEffectCanChoose(printed, state, id, sourcePrinted(state, cards, sourceId))) return state;
  // "When attached hero would take any amount of damage, reduce the Ring-bearer's life by an equal amount instead" (141057:A:2).
  if (takesLifeInstead(state, id)) return reduceLife(state, amount, steps, cause);
  // "Enemies cannot take damage" (141048:A:1), "cannot take non-combat damage" (141070:A:2): no damage is placed.
  // "Cannot take damage" is lost by Goblin Chieftain while the stage says so (41007:B:1); combat damage dealt to an attacking enemy is canceled
  // by Lightless Passage's Shadow (41033:A:2).
  if ((flagged(state, id, "cannotTakeDamage") && !flagged(state, id, "losesNoDamage")) || (source !== "combat" && flagged(state, id, "cannotTakeNonCombatDamage"))) return state;
  // "Cannot take damage from non-quest effects" (19127:A:1): the damage of a combat or of a quest card's effect is still placed.
  if (source !== "combat" && source !== "quest" && flagged(state, id, "cannotTakeNonQuestDamage")) return state;
  if (source === "combat" && flagged(state, id, "combatDamageCanceled")) return state;
  // "While Shelob has at least 1 resource, cancel all damage she would be dealt and discard 1 resource from her instead" (144072:B:2).
  const paid = resourceCancel(state, id, amount);
  if (paid) return paid;
  // "When attached enemy would take any amount of damage, cancel all of that damage. Then, discard Dragon Scales" (18059:A:2).
  const scaled = flagged(state, id, "cancelsDamage") ? cancelAllDamage(state, id, amount) : null;
  if (scaled) return scaled;
  // A card that takes no more than a number of damage each round ("cannot take more than 4 damage each round", 11177:A:4) takes what is left of it.
  const cap = source === "quest" && flagged(state, id, "damageCapSparesQuest") ? 0 : heldAmount(state, id, "damageCap");
  const taken = state.roundDamage?.[id] ?? 0;
  const resources = resourceShield(state, id, placedLimit(state, id, placedAmount(state, id, printed, amount)));
  // "The next time that character would be dealt damage this round, cancel 1 of that damage" (12166:A:2): the flag's points come off first, and it is spent.
  const shield = damageShield(resources.state, id, resources.amount);
  const capped = cap > 0 ? Math.max(0, Math.min(shield.amount, cap - taken)) : shield.amount;
  // "It cannot have more than 18 damage" (19023:B:3): a card with a ceiling takes what room is left under it.
  const ceiling = heldAmount(state, id, "damageCeiling");
  const dealt = ceiling > 0 ? Math.max(0, Math.min(capped, ceiling - instance.damage)) : capped;
  const damage = instance.damage + dealt;
  steps.push({ kind: "damage", targetId: id, amount: dealt, cause });
  let next = updateCard(cap > 0 ? { ...shield.state, roundDamage: { ...state.roundDamage, [id]: taken + dealt } } : shield.state, id, { damage });
  const hurt = dealt > 0 && inPlay(instance.zone);
  // An indestructible enemy keeps its damage but is never destroyed; it hears that it took damage (the Watcher in the Water, 142024:A:3).
  if (indestructible(state, id, printed)) return hurt ? queueEvent(next, { trigger: "damaged", seat: instance.controller, cardId: id, subject: id, amount: dealt }) : next;
  const lethal = printed.health != null && damage >= modifiedStat(next, instance, "hitPoints", cards);
  // Damage dealt to a character is first offered to the Responses that cancel it ("cancel X damage just dealt", rr.cancel).
  // A character it would destroy is destroyed by the sweep once they have had their chance (destroyOverwhelmed, damageHeld).
  // An enemy whose own Forced effect answers the damage dealt to it (Patrol Leader, 03014:A:1) is offered it the same way (families/encounter/patrol.ts markEnemyDamage).
  if (hurt && (isCharacterType(printed) || (printed.type === "enemy" && state.enemyDamageHeard?.includes(instance.code) === true))) {
    next = queueEvent(next, { trigger: "damageDealt", seat: instance.controller, cardId: id, subject: id, amount: dealt });
    if (lethal && state.holdLethal) return next;
  }
  if (lethal) {
    next = destroyAndAnnounce(next, instance, printed, cards, steps);
  } else if (hurt) {
    // A card that took damage and is still in play hears about it ("After Boromir takes any amount of damage").
    next = queueEvent(next, { trigger: "damaged", seat: instance.controller, cardId: id, subject: id, amount: dealt });
  }
  return next;
}

// A hero, ally or enemy whose damage reached its hit points: the cards attached to it hear it ("When attached enemy is destroyed", families/attachments/hold.ts), it is
// destroyed, and Responses and Forced effects hear that a hero or ally (rr.destroy) or an enemy was destroyed. Damage and the sweep below both end this way.
export function destroyAndAnnounce(state: ScenarioState, instance: CardInstance, printed: PrintedCard, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[]): ScenarioState {
  let next = state;
  if (printed.type === "enemy" || printed.type === "hero") next = noteHostDefeated(next, instance.id, printed.type === "hero" ? cards : undefined);
  next = destroyCard(next, instance.id, cards, steps, false, true);
  if (isCharacterType(printed)) next = queueEvent(next, { trigger: "characterDestroyed", seat: instance.controller, subject: instance.id });
  // Under Assault (145075:B:4) the event carries the enemy's total Threat as it stood in play, for the progress its destruction places (a Wraith on Wings' resources count; they stop counting once it has left play).
  const threat = printed.type === "enemy" && state.questStage != null && flagged(state, state.questStage, "assault") ? { amount: modifiedStat(state, instance, "threat", cards) } : {};
  if (printed.type === "enemy") next = queueEvent(next, { trigger: "enemyDestroyed", seat: instance.controller, subject: instance.id, ...threat });
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
    if (printed.health == null || indestructible(state, instance.id, printed)) continue;
    const current = next.cards[instance.id];
    if (!current || !inPlay(current.zone) || current.damage < modifiedStat(next, current, "hitPoints", cards)) continue;
    if (held(next, instance.id)) continue;
    // An enemy whose indestructible lapsed with its lethal damage still on it (Captain Sahír once no enemy has a resource, 12150:B:1), or whose hit points fell under its damage
    // (The Thing in the Depths with a seat eliminated, 12049), is destroyed all the same and announces it: Sahír's win (12150:B:3) and the Thing's (12041:B:3) hear it.
    next = destroyAndAnnounce(next, instance, printed, cards, steps);
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

export function defeatedDestination(
  instance: CardInstance,
  printed: PrintedCard,
): Destination {
  if ((printed.type === "enemy" || isLocationCard(printed)) && victoryOf(instance, printed) != null) {
    return { zone: "victory" };
  }
  // A card put into play for a time leaves the game when it leaves play (PutIntoPlay `then: removeFromGame`, 11212:A:2).
  if (instance.temporary) return { zone: "removed" };
  // A claimed objective that is discarded or loses its hero returns to the staging area (01108:A:2, families/objectives/claimed.ts).
  // A Captive destroyed under To Isengard! or an enemy goes to its owner's discard pile (families/captives).
  const usual: Destination =
    // An ally in the staging area under nobody's control (Retreat from Osgiliath, 145074:B:2) is still its owner's: it goes to that discard pile.
    !fromEncounterDeck(printed) && (instance.controller != null || ((instance.captive === true || instance.zone === "staging") && instance.owner != null))
      ? { zone: "discard", seat: instance.owner ?? instance.controller ?? 0 }
      : printed.type === "quest"
        ? { zone: "setAside" }
        : { zone: "encounterDiscard" };
  return claimedDestination(instance, usual);
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
    // A Guarded attachment the card guarded goes to its player instead (families/attachments/hold.ts).
    if (isGuarded(next, attachmentId)) {
      next = releaseGuarded(next, attachmentId);
      continue;
    }
    // An enemy that was lying on the host as an attachment returns to the staging area as an enemy (families/angmar/reanimate/attached.ts).
    const returned = returnAttachedEnemy(next, attachmentId);
    if (returned) {
      next = returned;
      continue;
    }
    // A claimed objective that returns to the top of the encounter deck when its hero leaves play (Signs of Gollum, families/objectives/claimed.ts).
    const toDeck = returnedToDeck(next, attachmentId);
    if (toDeck) {
      next = toDeck;
      steps.push({ kind: "destroy", targetId: attachmentId });
      continue;
    }
    const printed = printedOf(cards, attachment.code);
    const dest: Destination =
      (cardTypeOf(host, hostPrinted) === "hero" && printed.keywords.permanent) || flagged(next, attachmentId, "removedWithHost")
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
  // Damage destroyed it: it was not discarded (rr.destroy, families/play/hooks.ts).
  byDamage = false,
): ScenarioState {
  const instance = state.cards[id];
  if (!instance) return state;
  const printed = printedOf(cards, instance.code);
  if (printed.keywords.permanent && heroHostInPlay(state, instance)) return state;
  // The cards attached to a location that leaves play hear about it (Elf-stone). Whether the location was explored is
  // decided here, while the attachments still count (rr.explored): an Elf-stone's extra quest point is gone once it is discarded.
  let next = state;
  if (isLocationCard(printed)) {
    for (const attachmentId of instance.attachments) next = queueEvent(next, { trigger: "hostLeftPlay", seat: state.firstPlayer, cardId: attachmentId, subject: id, explored });
  }
  // The active location explored: every card hears it, with the number of attachments it had (10006:A:1, 19026:A:2).
  if (explored && isLocationCard(printed) && (state.activeLocation === id || state.secondActiveLocation === id)) next = queueEvent(next, { trigger: "activeExplored", seat: null, subject: id, amount: instance.attachments.length });
  // A location explored in the staging area (not the active location, which announced itself above) is heard by "after a location is explored" (Northern Tracker, The Evening Star).
  if (explored && isLocationCard(printed) && instance.zone === "staging") next = queueEvent(next, { trigger: "locationExplored", seat: null, subject: id, amount: instance.attachments.length });
  // A location in the staging area that is explored detaches the enemies grappled with it (dcce.grapple).
  if (explored && isLocationCard(printed) && instance.zone === "staging") next = releaseGrappled(next, id);
  next = releaseAttachments(next, id, cards, steps);
  const latest = next.cards[id] ?? instance;
  // "Add each ally that leaves play to its owner's hand instead of placing it in the discard pile" (families/deck/rules.ts).
  // An enemy that "gains victory" (the flag gainsVictory, 11178:A:1) goes to the victory display as one that prints it does.
  const victorious = heldAmount(state, id, "gainsVictory") > 0 && printed.type === "enemy" && printed.victory == null ? { ...printed, victory: heldAmount(state, id, "gainsVictory") } : printed;
  next = moveCard(next, id, alliesToHandDestination(next, latest, victorious) ?? defeatedDestination(latest, victorious), { released: instance.attachments, defeated: byDamage });
  steps.push({ kind: "destroy", targetId: id });
  if (cardTypeOf(instance, printed) === "ally" && inPlay(instance.zone)) next = queueEvent(next, { trigger: "allyLeftPlay", seat: instance.controller, subject: id });
  next = discardedFromPlay(next, instance, byDamage);
  // "If attached hero leaves play, the players lose the game" (19143:A:3): the hero holds the flag while Wormsbane is attached to it.
  if (printed.leavesPlayLoses || flagged(state, id, "lossOnLeavingPlay")) next = markLoss(next, `${printed.name} left play`);
  return eliminateEmpties(next, steps);
}

// A keyword a card prints or has gained: a flag modifier of the same name ("Attached hero gains sentinel", rr.sentinel,
// rr.ranged).
export function hasKeyword(state: ScenarioState, id: string, keyword: "sentinel" | "ranged" | "restricted" | "doomed" | "surge", cards: ReadonlyMap<string, PrintedCard>): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  const printed = printedOf(cards, instance.code);
  const blank = printedKeywordsBlank(state, id, cards);
  if (keyword === "doomed") return !blank && (printed.keywords.doomed ?? 0) > 0;
  if (keyword === "ranged" && flagged(state, id, "loseRanged")) return false;
  if (keyword === "sentinel" && flagged(state, id, "loseSentinel")) return false;
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
