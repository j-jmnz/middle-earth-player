// Rules: rr.destroy, rr.hit-points, rr.attachment-cards, rr.discard-pile-and-victory-display, rr.victory, ltp.victory-x (data/rules/entries.json). A card leaving play: its destruction by damage, the attachments it releases and the zone it goes to.
import { announceHostLeaving, isGuarded, noteHostDefeated, releaseGuarded } from "../families/attachments/hold.ts";
import type { EngineStep } from "./intents.ts";
import { cardTypeOf, fromEncounterDeck, isCharacterType, isLocationCard, printedOf, type PrintedCard } from "./printed.ts";
import { queueEvent } from "../windows/queue.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { flagged, heldAmount } from "./state.ts";
import { claimedDestination, discardedDetached, returnedToDeck } from "../families/objectives/claimed.ts";
import { returnAttachedEnemy } from "../families/angmar/reanimate/attached.ts";
import { attachmentsOn, inPlay, moveCard, releaseGrappled, type Destination } from "./zones.ts";
import { noteExplored } from "../families/haradrim/explored.ts";
import { discardedFromPlay } from "../families/play/hooks.ts";
import { alliesToHandDestination } from "../families/deck/rules.ts";
import { victoryOf } from "./printed-stat.ts";
import { eliminateEmpties, markLoss } from "./eliminate.ts";
import { announceAllyLeft } from "./ally-left.ts";
import { indestructible } from "./keyword-flags.ts";
import { addModifier, modifiedStat } from "./modified-stat.ts";

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

function heroHostInPlay(state: ScenarioState, instance: CardInstance): boolean {
  if (!instance.host) return false;
  return state.cards[instance.host]?.zone === "heroes";
}

export function defeatedDestination(
  instance: CardInstance,
  printed: PrintedCard,
  state: ScenarioState,
): Destination {
  if ((printed.type === "enemy" || isLocationCard(printed)) && victoryOf(instance, printed) != null) {
    return { zone: "victory" };
  }
  // A card put into play for a time leaves the game when it leaves play (PutIntoPlay `then: removeFromGame`, 11212:A:2).
  if (instance.temporary) return { zone: "removed" };
  // A claimed objective whose text returns it (01108:A:2, 12071:A:1) goes back to the staging area when discarded or detached (families/objectives/claimed.ts).
  // A Captive destroyed under To Isengard! or an enemy goes to its owner's discard pile (families/captives).
  const usual: Destination =
    // An ally in the staging area under nobody's control (Retreat from Osgiliath, 145074:B:2) and a player card lying on a Nameless enemy (families/nameless) are still their owner's: they go to that discard pile.
    !fromEncounterDeck(printed) && (instance.controller != null || ((instance.captive === true || instance.zone === "staging" || instance.nameless === true) && instance.owner != null))
      ? { zone: "discard", seat: instance.owner ?? instance.controller ?? 0 }
      : printed.type === "quest"
        ? { zone: "setAside" }
        : { zone: "encounterDiscard" };
  return claimedDestination(state, instance, usual);
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
    // A claimed objective that is discarded when it is detached (The Old Thrush, 50208:A:2).
    const detached = discardedDetached(next, attachmentId);
    if (detached) {
      next = detached;
      steps.push({ kind: "destroy", targetId: attachmentId });
      continue;
    }
    const printed = printedOf(cards, attachment.code);
    const dest: Destination =
      (cardTypeOf(host, hostPrinted) === "hero" && printed.keywords.permanent) || flagged(next, attachmentId, "removedWithHost")
        ? { zone: "removed" }
        : defeatedDestination(attachment, printed, next);
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
  // The cards attached to a leaving location or destroyed enemy hear about it, with whether the location was explored decided here (announceHostLeaving).
  // A location that cannot leave the staging area cannot be explored while it cannot (rr.cannot is absolute, rr.explored places it in the discard pile; FFG's answer: docs/brief.md, Core round): nothing happens, and the sweep that finds its progress at its quest points
  // explores it the ordinary way, once, when the effect that holds it has ended. A card whose own text answers its exploring (`exploresWhileHeld`, The Crossing at Tharbad 08071:A:3) is explored in place, once: `exploredHeld` stops a second exploring.
  const held = explored && isLocationCard(printed) && instance.zone === "staging" && flagged(state, id, "cannotLeaveStaging");
  if (held && (!flagged(state, id, "exploresWhileHeld") || flagged(state, id, "exploredHeld"))) return state;
  const stays = held;
  let next = announceHostLeaving(state, id, cards, explored);
  // The active location explored: every card hears it, with the number of attachments it had (10006:A:1, 19026:A:2).
  if (explored && isLocationCard(printed) && (state.activeLocation === id || state.secondActiveLocation === id)) next = queueEvent(next, { trigger: "activeExplored", seat: null, subject: id, amount: attachmentsOn(state, id).length });
  // A location explored in the staging area (not the active location, which announced itself above) is heard by "after a location is explored" (Northern Tracker, The Evening Star).
  if (explored && isLocationCard(printed) && instance.zone === "staging") next = queueEvent(next, { trigger: "locationExplored", seat: null, subject: id, amount: attachmentsOn(state, id).length });
  // A location in the staging area that is explored detaches the enemies grappled with it (dcce.grapple).
  if (explored && isLocationCard(printed) && instance.zone === "staging") next = releaseGrappled(next, id);
  next = noteExplored(next, id, explored, cards);
  if (stays) return addModifier(next, id, id, "exploredHeld", 1, "whileSourceInPlay");
  next = releaseAttachments(next, id, cards, steps);
  const latest = next.cards[id] ?? instance;
  // "Add each ally that leaves play to its owner's hand instead of placing it in the discard pile" (families/deck/rules.ts).
  // An enemy that "gains victory" (the flag gainsVictory, 11178:A:1) goes to the victory display as one that prints it does.
  const victorious = heldAmount(state, id, "gainsVictory") > 0 && printed.type === "enemy" && printed.victory == null ? { ...printed, victory: heldAmount(state, id, "gainsVictory") } : printed;
  next = moveCard(next, id, alliesToHandDestination(next, latest, victorious) ?? defeatedDestination(latest, victorious, next), { released: instance.attachments, defeated: byDamage, destroyed: true });
  steps.push({ kind: "destroy", targetId: id });
  next = announceAllyLeft(next, instance, cards);
  next = discardedFromPlay(next, instance, byDamage);
  // "If attached hero leaves play, the players lose the game" (19143:A:3): the hero holds the flag while Wormsbane is attached to it.
  if (printed.leavesPlayLoses || flagged(state, id, "lossOnLeavingPlay")) next = markLoss(next, `${printed.name} left play`);
  return eliminateEmpties(next, steps);
}
