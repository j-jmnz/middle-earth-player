// Rules: rr.in-play-and-out-of-play, mec109.immune-to-player-card-effects, mec109.permanent (data/rules/entries.json).
import { pileOf } from "../core/piles.ts";
import { consideredEngagedSeats } from "../core/engaged.ts";
import { discardLockedFor } from "../families/angmar/lock.ts";
import { captiveIds } from "../families/captives/values.ts";
import type { Instruction, PickSpec } from "../../catalog/boundary.ts";

import { attachmentHostIds } from "../player/attach.ts";
import { canAttack, characters, legalAttackEnemies } from "../combat/combat.ts";
import { hostOf } from "./amounts.ts";
import { countsAsAttachment, hasTrait } from "./conditions.ts";
import { hungOnEncounter } from "../families/objectives/pick.ts";
import { attachmentsPickMatches } from "../families/attachments/pick.ts";
import { costsPickMatches, highestCost } from "../families/costs/pick.ts";
import { spheresOf } from "../families/costs/pay.ts";
import { attackPickMatches } from "../families/attack/pick.ts";
import { miscPickMatches } from "../families/misc/pick.ts";
import { questCardPool } from "../families/quest/quest-card.ts";
import { familyPickMatches, familyPool } from "./family-hooks.ts";
import { immuneToSource } from "../families/misc/guards.ts";
import { countsExtra } from "../families/misc/traits.ts";
import { seatThreat } from "../families/play/hooks.ts";
import { playPickMatches } from "../families/play/pick.ts";
import { playBlocked } from "../families/sidequests/contract.ts";
import { sidequestsPickMatches } from "../families/sidequests/pick.ts";
import { attachmentsOn, lootUnder } from "../core/attached.ts";
import { lookedPool } from "../families/deck/pick.ts";
import type { ReduceContext } from "./interpret.ts";
import { topmostMatching } from "./topmost.ts";
import { hasKeyword, isPlayerCardEffect, modifiedStat, playerCardEffectCanChoose, sourcePrinted, uniqueBlocked } from "../core/keywords.ts";
import { flaggedByClass } from "../core/holder-classes.ts";
import { cardTypeOf, isAllyLike, isCharacterType, isQuestCardType, isSideQuestType, isPlayerType, printedOf } from "../core/printed.ts";
import { activeFor, firstPlayerFor, headOf, sharedStaging, sharing } from "../families/breaking/areas.ts";
import { breakingPickMatches } from "../families/breaking/attack.ts";
import type { ScenarioState } from "../core/state.ts";
import { flagged, heldAmount, inPlay, isExhausted, livingSeats } from "../core/state.ts";
import { canDeclareDefender, isDefending } from "../families/defense/defenders.ts";
import { facedownShadow } from "../families/defense/shadow.ts";
import { deckPool, unchartedPickMatches } from "../families/uncharted/pick.ts";
import { aflamePickMatches, lowestAflame } from "../families/aflame/pick.ts";
import { lowestOf } from "../families/harad/pick.ts";
import { highestAttack } from "../families/sea/ramming.ts";
import { tiedExtreme } from "./tied-extreme.ts";
import { chosenCopies, levelAmount } from "../families/aflame/values.ts";
import { sidePickMatches } from "../families/grapple/values.ts";
import { islandPool, outsideCells } from "../families/island/pick.ts";
import { embassyPool, highestThreatOf } from "../families/black-gate/pick.ts";
import { highestThreatPlusRemaining } from "../families/long-dark/pick.ts";
import { fortitudePool } from "../families/mount-doom/pick.ts";
import { seatPickMatches } from "../families/wilderland/seat-pick.ts";
import { mostResources } from "../families/burgle/pick.ts";
import { committedInStaging } from "../families/pelargir/committed.ts";
import { swappable } from "../families/misc/collection.ts";
import { pickBarred } from "../families/pelargir/progress-bar.ts";
import { pickKeepsInPlay } from "../families/pelargir/vale/cannot-leave.ts";
import { resourcesLocked } from "../families/pelargir/spending.ts";

// What a filter is read against: who is choosing or counting, the effect's source, what it has picked, its X, and the
// characters of the attack a Response answers. `counting` reads every card that matches, immune ones too: a count or a
// condition is not a player card effect choosing a card.
export type PickContext = {
  seat: number;
  sourceId: string | null;
  picked?: readonly string[];
  x?: number;
  participants?: readonly string[];
  counting?: boolean;
  // The answered event's cards, when a condition is read for it (families/attack/pick.ts).
  subject?: string | null;
  other?: string | null;
  // The cards chosen are discarded by the effect (a DiscardPicked after the pick): the filter of a card that cannot be discarded by player card effects reads it (families/wilderland/pick.ts).
  discards?: boolean;
  // The cards chosen pay resources for the instruction after the pick (SpendFrom, SpendFromPool): a pool Orc Vanguard locks cannot pay, so it is not offered (families/pelargir/spending.ts).
  spends?: boolean;
  // The cards chosen get progress from the instruction after the pick (PlaceProgressOn picked): the bar on player cards leaves out a staged location (families/pelargir/progress-bar.ts).
  places?: boolean;
  // The cards chosen are taken out of play, not destroyed, by the instructions after the pick (a discard, a shuffle, a return to a hand): a card that cannot leave play is not offered (families/pelargir/vale/cannot-leave.ts).
  leaves?: boolean;
  // The card chosen is the hero SwapHero changes (Helm of Secrecy): a hero with no tokens to discard and no hero of the collection to swap in is not offered (families/misc/collection.ts).
  swaps?: boolean;
};

export function seatsOf(state: ScenarioState, spec: PickSpec, asking: number): number[] {
  if (spec.control === "you") return [asking];
  // "At this stage": the chooser's own once stages are separate (mec109.multiple-staging-areas).
  if (spec.atStage && state.separate) return sharing(state, asking);
  if (spec.otherArea === true && state.separate) return livingSeats(state).filter((seat) => headOf(state, seat) !== headOf(state, asking));
  if (spec.control === "other") return livingSeats(state).filter((seat) => seat !== asking);
  return livingSeats(state);
}

// The staging cards a filter reads: the staging area, or once stages are separate the asking seat's own (the default), the shared one, or every
// seat's (`stagingArea`, families/breaking/areas.ts).
function stagingFor(state: ScenarioState, spec: PickSpec, asking: number): readonly string[] {
  if (!state.separate || spec.stagingArea === "any") return state.staging;
  return spec.stagingArea === "shared" ? sharedStaging(state) : (state.seats[asking]?.staging ?? []);
}

// The cards a filter starts from: its zone group and whose cards they are.
function pool(state: ScenarioState, spec: PickSpec, asking: number, ctx: ReduceContext, sourceId: string | null): string[] {
  const seats = seatsOf(state, spec, asking);
  const raw: string[] = [];
  // The Island Map's filters start from its own cards (families/island/pick.ts).
  const mapped = islandPool(state, spec);
  if (mapped) return mapped;
  // The Embassy from the Dark Tower's faceup row (families/black-gate/pick.ts).
  const embassy = embassyPool(state, spec);
  if (embassy) return embassy;
  // The cards discarded for the Fortitude test in progress (families/mount-doom/pick.ts).
  const fortitude = fortitudePool(state, spec);
  if (fortitude) return fortitude;
  // A burden card in play or in the encounter deck or its discard pile (142074:A:2).
  if (spec.burden) {
    return Object.values(state.cards)
      .filter((card) => (inPlay(card.zone) || card.zone === "encounterDeck" || card.zone === "encounterDiscard") && printedOf(ctx.cards, card.code).campaignKind === "burden")
      .map((card) => card.id);
  }
  // The quest cards in play (families/quest/quest-card.ts).
  if (spec.questCard) return questCardPool(state, asking, ctx);
  // The captured cards a pick starts from (families/captured/values.ts).
  const captured = spec.captured ? familyPool(state, spec, asking, sourceId, ctx) : null;
  if (captured) return captured;
  // The cards of the riddle area (families/riddles/area.ts).
  const riddleArea = spec.riddleArea ? familyPool(state, spec, asking, sourceId, ctx) : null;
  if (riddleArea) return riddleArea;
  // Every card in play of any kind (families/angmar/reanimate/pick.ts).
  const everything = spec.allInPlay ? familyPool(state, spec, asking, sourceId, ctx) : null;
  if (everything) return everything;
  // The Uruk-hai's Captives, alone or among the heroes (families/captives).
  if (spec.captive === "only" || spec.captive === "free") return captiveIds(state, spec.captive, ctx.cards);
  const from = spec.from ?? "play";
  // Only the cards the running effect looked at or discarded (families/deck/pick.ts).
  if (spec.looked) return lookedPool(state, spec, seats);
  if (from === "hand") for (const index of seats) raw.push(...(state.seats[index]?.hand ?? []));
  else if (from === "victory") raw.push(...state.victory);
  // The encounter discard pile, the most recently discarded card first ("the opposing team chooses a card in the encounter discard pile", 51116:A:1).
  // With `topmost`, only the card of the pick's type nearest the top: "the topmost location in the encounter discard pile" (17079:A:1).
  else if (from === "encounterDiscard") {
    const pile = [...state.encounterDiscard].reverse();
    const top = spec.topmost ? topmostMatching(state, ctx, pile, { cardType: spec.type, trait: spec.trait, traits: spec.traits }) : null;
    raw.push(...(spec.topmost ? (top ? [top] : []) : pile));
  }
  // The Raven deck of The Antlered Crown, top first (rm.raven-deck).
  else if (from === "ravenDeck") raw.push(...pileOf(state, "ravenDeck"));
  else if (from === "loot") raw.push(...Object.values(state.cards).filter((card) => card.zone === "under" && card.controller != null && seats.includes(card.controller)).map((card) => card.id));
  else if (from === "discard") {
    for (const index of seats) {
      // `top`: the last cards put on the pile.
      const pile = spec.top != null ? (state.seats[index]?.discard ?? []).slice(-spec.top) : (state.seats[index]?.discard ?? []);
      if (!spec.topmost) raw.push(...pile);
      else {
        // The last card put on a discard pile is its top.
        const top = topmostMatching(state, ctx, [...pile].reverse(), spec);
        if (top) raw.push(top);
      }
    }
  } else if (from === "deck") for (const index of seats) raw.push(...deckPool(state, index, spec));
  else if (spec.type === "attachment") {
    for (const instance of Object.values(state.cards)) {
      if (instance.host == null || (instance.zone !== "play" && instance.zone !== "attached")) continue;
      // A boon guarded on an enemy is held for its owner, not an attachment any player controls (146069:B:1).
      if (instance.held === true) continue;
      // A player card lying on a Nameless enemy is no attachment a player controls (rr.ownership-and-control).
      if (instance.nameless === true) continue;
      // An encounter attachment (a Condition) has no controller: only a filter of `any` control sees it, `you`, `other` and `controlled` leave it out (rr.ownership-and-control: a player controls the player cards he plays; Whip Lash, 04148:A:1).
      if ((spec.controlled || spec.control !== "any") && instance.controller == null) continue;
      if (instance.controller != null && !seats.includes(instance.controller)) continue;
      raw.push(instance.id);
    }
  } else if (spec.type === "enemy") {
    const engagedSeats = spec.atStage && state.separate ? sharing(state, asking) : spec.engaged === "you" ? [asking] : spec.engaged === "other" ? livingSeats(state).filter((seat) => seat !== asking) : livingSeats(state);
    if (!spec.stagingOnly) for (const index of engagedSeats) raw.push(...(state.seats[index]?.engaged ?? []));
    // `staging` with `engaged`: the staging area and the enemies engaged as `engaged` says ("or engaged with another player").
    if (spec.staging || (spec.stagingOnly && spec.engaged == null)) raw.push(...stagingFor(state, spec, asking));
    // An enemy in the staging area that is considered engaged with one of those players is engaged with him too (the Watcher, the Balrog, Bolg at stage 5: rr.engaged); only a filter that names the engaged player reads it (after the staging area a `staging` filter lists, so none is listed twice).
    if (spec.engaged != null && !spec.stagingOnly) raw.push(...state.staging.filter((id) => !raw.includes(id) && consideredEngagedSeats(state, id, engagedSeats).length > 0));
    if (spec.inStormcallerArea) raw.push(...Object.values(state.cards).filter((card) => card.zone === "stormcallerArea").map((card) => card.id));
  } else if (spec.type === "location" && spec.controlled) {
    // The locations a player controls lie in his play area, not in the staging area and not as the active location (families/pelargir/location-control.ts).
    for (const index of seats) raw.push(...(state.seats[index]?.play ?? []).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location"));
  } else if (spec.type === "location") {
    if (!spec.active) raw.push(...stagingFor(state, spec, asking).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location"));
    if (!spec.stagingOnly) raw.push(...activeFor(state, asking, spec.stagingArea === "any"));
    // The locations of the Island Map outside the staging area are in play too (families/island/pick.ts).
    if (!spec.stagingOnly && !spec.active) raw.push(...outsideCells(state));
    // A location a player controls lies in his play area and is a location in play: "a location" names it too (06091:B:2, researched reading; families/pelargir/location-control.ts). Only a game that holds a controlled location reads it.
    if (!spec.stagingOnly && !spec.active && state.modifiers.some((modifier) => modifier.stat === "controlSeat")) raw.push(...seats.flatMap((index) => (state.seats[index]?.play ?? []).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location")));
  } else if (spec.type === "objective") {
    // The objectives in the staging area (any player's filter sees them) and, unless it asks for the staging area only, the ones a
    // player claimed: attached to a hero, controlled by that player (families/objectives.ts).
    if (spec.control !== "you" && !spec.controlled) raw.push(...stagingFor(state, spec, asking));
    if (!spec.stagingOnly) raw.push(...Object.values(state.cards).filter((card) => card.claimed === true && card.controller != null && seats.includes(card.controller)).map((card) => card.id));
    // An objective an encounter card attached to a character (a Sack card) is unclaimed and controlled by no one (131036:A:2).
    if (spec.onCharacter) raw.push(...Object.values(state.cards).filter((card) => card.zone === "attached" && card.host != null && !raw.includes(card.id) && isCharacterType(printedOf(ctx.cards, state.cards[card.host]?.code ?? ""))).map((card) => card.id));
    // A location with the safe keyword (an objective-location) may be the active location (10075:A:2).
    if (spec.safe && !spec.stagingOnly) raw.push(...activeFor(state, asking, spec.stagingArea === "any"));
    // `controlled` also counts a tower the players control as a group: freed of encounters, in the staging area, claimed with no controller (ControlWhenFree, families/objectives/control.ts).
    if (spec.controlled && spec.control !== "you") raw.push(...stagingFor(state, spec, asking).filter((id) => state.cards[id]?.claimed === true));
    // `onEncounter`: the objectives hanging on an encounter card are candidates too (families/objectives/pick.ts).
    if (spec.onEncounter === true) raw.push(...hungOnEncounter(state, ctx));
  } else if ((spec.type === "ally" || spec.type === "card") && spec.stagingOnly) {
    // The cards lying in the staging area; for allies, those under nobody's control (families/pelennor/allies.ts, 145074:B:2).
    raw.push(...stagingFor(state, spec, asking));
  } else if (spec.type === "card") {
    for (const index of seats) raw.push(...(state.seats[index]?.heroes ?? []), ...(state.seats[index]?.play ?? []));
    if (spec.engagedEnemies) for (const index of livingSeats(state)) raw.push(...(state.seats[index]?.engaged ?? []));
    if (spec.control === "any") raw.push(...stagingFor(state, spec, asking), ...(state.separate ? activeFor(state, asking, spec.stagingArea === "any").slice(0, 1) : [state.activeLocation].filter((id): id is string => id != null)));
  } else {
    for (const index of seats) raw.push(...characters(state, index, ctx.cards));
    // An ally a guard holds in the staging area (Arwen under Goblin Gate, 901402:B:1) is an ally in play that no player controls: any player's filter sees it, `controlled` leaves it out.
    if (spec.control !== "you" && !spec.controlled && state.modifiers.length > 0) raw.push(...state.staging.filter((id) => flagged(state, id, "guardedAlly")));
  }
  if (spec.captive === "include" && spec.control !== "you") raw.push(...captiveIds(state, "include", ctx.cards));
  return raw;
}

// The most a card may cost: a number, or the X of the source scalable card (its level plus the copies the Setup chose, 11201:A:5).
function maxCostOf(state: ScenarioState, max: NonNullable<PickSpec["maxCost"]>, sourceId: string | null, ctx: ReduceContext): number {
  if (typeof max === "number") return max;
  return levelAmount(state, sourceId, max.halved === true) + (max.plusChosen ? chosenCopies(state, sourceId, ctx) : 0);
}

// Whether one card matches a filter's predicates (not its zone): what the filter reads of the card itself.
export function matchesPick(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  const printed = printedOf(ctx.cards, instance.code);
  const asking = spec.who === "firstPlayer" ? firstPlayerFor(state, at.seat) : at.seat;
  const picked = at.picked ?? [];
  const from = spec.from ?? "play";
  if ((id === at.sourceId && (from !== "play" || spec.other)) || (spec.different && picked.includes(id))) return false;
  // A different enemy of the Raven deck is a different title, as a different search is (rm.raven-deck).
  if (spec.different && from === "ravenDeck" && picked.some((other) => state.cards[other]?.code === instance.code)) return false;
  if (spec.type !== "card" && spec.type !== "player") {
    // A card among a player's heroes is a hero: an ally that gained the hero card type sits there (heroType, families/play/sweep.ts).
    // An ally attached to another card (Wild Stallion) is an attachment while it is.
    const base = printed.type === "ally" && instance.host != null && instance.zone !== "heroes" ? "attachment" : cardTypeOf(instance, printed);
    // An objective ally with printed combat stats (Mendor, 01135) a player controls is an ally in play (isAllyLike), and still an objective card; so is one committed from the staging area (Celador, families/pelargir/committed.ts).
    const objectiveAlly = base === "objective" && isAllyLike(printed);
    const type = objectiveAlly && ((instance.zone === "play" && instance.host == null) || committedInStaging(state, id)) ? "ally" : base;
    // An Objective-Location counts as a location as the active location, travelled to, explored or in the victory display, and stays an objective in the staging area (docs/scenarios/ered-mithrin/lost-in-mirkwood.md, Lost in Mirkwood): revealing one is no "revealed location".
    const typed = spec.type === "character" ? type === "hero" || type === "ally" : type === spec.type || (spec.type === "location" && printed.objectiveLocation && type === "objective" && instance.zone !== "staging") || (spec.type === "objective" && printed.type === "objective") || (spec.type === "attachment" && countsAsAttachment(state, id, ctx));
    if (!typed) return false;
  }
  if (spec.affectable && immuneToSource(state, id, at.sourceId, ctx)) return false;
  if (spec.trait && !hasTrait(state, id, spec.trait, ctx)) return false;
  if (spec.traits && !spec.traits.some((trait) => hasTrait(state, id, trait, ctx))) return false;
  if (spec.notTraits && spec.notTraits.some((trait) => hasTrait(state, id, trait, ctx))) return false;
  if (spec.names && !spec.names.includes(printed.name)) return false;
  const spheres = spec.sphere || spec.spheres || spec.nonNeutral || spec.exceptSphere ? spheresOf(state, id, printed.sphere, ctx) : [];
  if (spec.sphere && !spheres.includes(spec.sphere)) return false;
  if (spec.spheres && !spheres.some((sphere) => spec.spheres?.includes(sphere))) return false;
  if (spec.printedIcon && !(printed.type === "hero" && printed.sphere === spec.printedIcon)) return false;
  if (spec.nonNeutral && !spheres.some((sphere) => sphere !== "neutral")) return false;
  if (spec.exceptSphere && spheres.some((sphere) => [spec.exceptSphere].flat().includes(sphere))) return false;
  if (spec.cardType && printed.type !== spec.cardType) return false;
  if (spec.enemyOrLocation && printed.type !== "enemy" && printed.type !== "location") return false;
  if (spec.questCardType && !isQuestCardType(printed.type)) return false;
  if (spec.sideQuest && !isSideQuestType(printed.type)) return false;
  if (spec.notCardType && printed.type === spec.notCardType) return false;
  if (spec.committed != null && (committedInStaging(state, id) || instance.committed) !== spec.committed) return false;
  if (spec.canQuest != null && flaggedByClass(state, instance, printed, "cannotQuest", (trait) => hasTrait(state, id, trait, ctx)) === spec.canQuest) return false;
  if (spec.participating && !(at.participants ?? []).includes(id)) return false;
  // No card is at another stage in a game with one stage (50805:B:2).
  if (spec.atOtherStage) return false;
  if (spec.nonUnique && printed.isUnique) return false;
  if (spec.unique && !printed.isUnique) return false;
  if (spec.hasShadow && !instance.shadowId) return false;
  if (spec.keyword && !hasKeyword(state, id, spec.keyword, ctx.cards)) return false;
  if (spec.damaged != null && instance.damage > 0 !== spec.damaged) return false;
  if (spec.hasResources && instance.resources <= 0) return false;
  if (at.spends && resourcesLocked(state, id)) return false;
  if (at.places && pickBarred(state, id, at.sourceId, ctx.cards)) return false;
  if (at.leaves && pickKeepsInPlay(state, id)) return false;
  if (at.swaps && !swappable(state, id, ctx)) return false;
  // The costs family's filters: a pool's size, a Valour ability, a lower threat cost, a pool that paid (families/costs/pick.ts).
  if (!costsPickMatches(state, id, spec, at.picked, ctx, at.subject)) return false;
  if (spec.on && !onHost(state, instance.host, spec.on, asking, ctx)) return false;
  if (spec.notHost && at.sourceId != null && hostOf(state, at.sourceId) === id) return false;
  if (spec.engagedThisRound && heldAmount(state, id, "engagedThisRound") <= 0) return false;
  if (spec.isHost && (at.sourceId == null || hostOf(state, at.sourceId) !== id)) return false;
  if (spec.active && !activeFor(state, asking, spec.stagingArea === "any").includes(id)) return false;
  // The attachments family's filters: attached or not, Guarded, progress tokens (families/attachments/pick.ts).
  if (!attachmentsPickMatches(state, id, spec, ctx, at.sourceId)) return false;
  // The uncharted family's filters: a Lost Island, progress enough (families/uncharted/pick.ts).
  if (!unchartedPickMatches(state, id, spec, ctx) || !aflamePickMatches(state, id, spec, ctx) || !sidePickMatches(state, id, spec)) return false;
  if (spec.attachable != null && !attachmentHostIds(state, asking, spec.attachable, ctx, { byEffect: true, anySeat: spec.control === "any" }).includes(id)) return false;
  // The attack family's filters: printed keywords, the source's host, engaged with whom, a shared Trait, an attachment on the
  // event's card, printed hit points, the top of a discard pile (families/attack/pick.ts).
  if (!attackPickMatches(state, id, spec, at, ctx)) return false;
  // The play family's filters: a Trait shared with the source or its host (families/play/pick.ts).
  if (!playPickMatches(state, id, spec, at.sourceId, ctx, at.seat)) return false;
  // The misc family's filters: controlled by the picked player, attached to the picked card, a player card, a Defense limit, drawn
  // in the resource phase (families/misc/pick.ts).
  if (!miscPickMatches(state, id, spec, at, ctx)) return false;
  if (spec.minAttack != null && modifiedStat(state, instance, "attack", ctx.cards) < spec.minAttack) return false;
  // The nightmare family's filters: a Willpower at most this, below 0 counting as 0 (900102:A:1).
  if (spec.maxWillpower != null && Math.max(0, modifiedStat(state, instance, "willpower", ctx.cards)) > spec.maxWillpower) return false;
  // A copy of it in its controller's discard pile (900309:A:2), or a card of its title in its owner's discard pile, itself counting when it lies there (09066:A:2, 09061:A:2, 09065:A:3).
  if (spec.copyInDiscard && !titleInDiscard(state, instance, spec.copyInDiscard === "owner", ctx)) return false;
  // The breaking family's filter: fewer printed hit points than the attacking enemy (families/breaking/attack.ts).
  if (!breakingPickMatches(state, id, spec, ctx)) return false;
  // The sidequests family's filters: a Trait or a title shared with another card, the quest a character is committed to
  // (families/sidequests/pick.ts).
  if (!sidequestsPickMatches(state, id, spec, at, ctx)) return false;
  if (spec.attacking && !attackingNow(state, id)) return false;
  // Every defender of the attack in progress, the extra ones too (rr.multiple-defenders).
  if (spec.defending && !isDefending(state, id)) return false;
  if (spec.canDefend && !canDeclareDefender(state, id, ctx.cards)) return false;
  if (spec.canExhaust && (instance.exhausted || flagged(state, id, "cannotExhaust"))) return false;
  if (spec.facedownShadow && !facedownShadow(state, id)) return false;
  if (spec.attackingEnemy != null && (state.pendingAttack?.enemyId === id) !== spec.attackingEnemy) return false;
  if (spec.hasAttachment) {
    const want = spec.hasAttachment;
    // The loot guarding a location is attached to it (core/attached.ts).
    const found = attachmentsOn(state, id).some((attachmentId) => {
      const attachment = state.cards[attachmentId];
      if (!attachment) return false;
      if (want.trait && !hasTrait(state, attachmentId, want.trait, ctx)) return false;
      if (want.names && !want.names.includes(printedOf(ctx.cards, attachment.code).name)) return false;
      if (want.playerCard && !isPlayerType(printedOf(ctx.cards, attachment.code))) return false;
      if (want.treasure && printedOf(ctx.cards, attachment.code).type !== "treasure") return false;
      return true;
    });
    if (want.none ? found : !found) return false;
  }
  if (spec.aboveThreat) {
    const threat = seatThreat(state, asking);
    if (printed.engagementCost == null || modifiedStat(state, instance, "engagementCost", ctx.cards) <= threat) return false;
  }
  if (spec.intoPlay && (uniqueBlocked(state, printed, ctx.cards) || playBlocked(state, id, asking, ctx, true))) return false;
  if (spec.costIsX && at.x != null && printed.cost !== at.x) return false;
  if (spec.maxCost != null && (printed.cost == null || printed.cost > maxCostOf(state, spec.maxCost, at.sourceId, ctx))) return false;
  if (spec.minCost != null && (printed.cost == null || printed.cost < spec.minCost)) return false;
  if (spec.oddCost && (printed.cost == null || printed.cost % 2 !== 1)) return false;
  if (spec.cost != null && (from === "play" || printed.cost !== spec.cost)) return false;
  if (spec.noVictory !== undefined && (printed.victory ?? 0) > 0 === spec.noVictory) return false;
  if (spec.state === "ready" && instance.exhausted) return false;
  // An unconscious character is neither ready nor exhausted (hob.unconscious-characters): the Weighed Down penalty and the "exhausted" filters do not reach it.
  if (spec.state === "exhausted" && !isExhausted(instance)) return false;
  if (spec.canAttack && !legalAttackEnemies(state, instance.controller ?? asking, id, ctx.cards, true).length) return false;
  if (spec.attackableByPicked) {
    const attacker = picked.at(-1);
    if (!attacker || !canAttack(state, state.cards[attacker]?.controller ?? asking, attacker, id, ctx.cards, true)) return false;
  }
  // The filters a family adds through its pick hook (interpret/family-hooks.ts).
  return familyPickMatches(state, id, spec, at, ctx);
}

// A host the pick's `control` allows from the chooser's side: any, the chooser's own, or another player's. A card no player controls (a location) is no player's host.
function hostControlFits(state: ScenarioState, id: string, control: PickSpec["control"], asking: number): boolean {
  if (control === "any") return true;
  const controller = state.cards[id]?.controller;
  return controller != null && (control === "you") === (controller === asking);
}

// An attachment's host is of the type and controlled as the filter's `on` says, from the chooser's side.
function onHost(state: ScenarioState, hostId: string | null, on: NonNullable<PickSpec["on"]>, asking: number, ctx: ReduceContext): boolean {
  const host = hostId ? state.cards[hostId] : undefined;
  if (!host || host.controller == null) return false;
  const type = cardTypeOf(host, printedOf(ctx.cards, host.code));
  if (on.type === "hero" ? type !== "hero" : type !== "hero" && type !== "ally") return false;
  if (on.minWillpower != null && modifiedStat(state, host, "willpower", ctx.cards) < on.minWillpower) return false;
  if (on.committed != null && host.committed !== on.committed) return false;
  return on.control === "any" || (on.control === "you") === (host.controller === asking);
}

// A card of the instance's title lies in a discard pile: another card in its controller's (`owner` false), or any card, the instance itself when it lies there, in its owner's (`owner` true; an owner not noted is the controller).
function titleInDiscard(state: ScenarioState, instance: ScenarioState["cards"][string], owner: boolean, ctx: ReduceContext): boolean {
  const seat = owner ? (instance.owner ?? instance.controller) : instance.controller;
  if (seat == null) return false;
  const name = printedOf(ctx.cards, instance.code).name;
  return (state.seats[seat]?.discard ?? []).some((other) => (owner || other !== instance.id) && printedOf(ctx.cards, state.cards[other]?.code ?? "").name === name);
}

// The character is attacking in the attack in progress: one of the attackers of a player attack.
function attackingNow(state: ScenarioState, id: string): boolean {
  return state.pendingStrike?.attackerIds.includes(id) === true;
}

// A Pick names cards or players a player may choose for the instructions after it. The seat is the one making the choice.
// Cards that are immune to player card effects cannot be chosen by a player card's Pick (mec109.immune-to-player-card-effects).
// An encounter card's Pick (141049:A:1, 141054:A:2, 141071:A:2) is not a player card effect.
export function pickCandidates(
  state: ScenarioState,
  spec: PickSpec,
  seat: number,
  picked: readonly string[],
  sourceId: string | null,
  ctx: ReduceContext,
  x?: number,
  participants?: readonly string[],
  counting = false,
  event?: { subject?: string | null; other?: string | null; discards?: boolean; spends?: boolean; places?: boolean; leaves?: boolean; swaps?: boolean },
): string[] {
  const found = candidatesOf(state, spec, seat, picked, sourceId, ctx, x, participants, counting, event);
  // "The opposing team chooses" (docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, reading 3): the first of the cards the ranking fields left (with `highestThreat` on enemies, the one with the highest Attack among those level on Threat), the order of seats and then of play breaking a tie, and nobody is asked. A count is not a choice.
  if (spec.challenge !== true || counting) return found;
  // "the highest Threat, then the highest Attack" (docs/scenarios/standalone-scenarios/the-woodland-realm.md, The Woodland Realm, reading 3): level on Threat, the enemy with the highest Attack.
  const level = spec.highestThreat === true && found.length > 1 ? tiedExtreme(found, (id) => (state.cards[id] ? modifiedStat(state, state.cards[id], "attack", ctx.cards) : 0), "highest") : found;
  // "the highest Attack, then the highest Threat" (docs/scenarios/standalone-scenarios/the-mines-of-moria.md, The Mines of Moria, reading 3: Denizen of the Deep): level on Attack, the enemy with the highest Threat.
  const levelAttack = spec.highestAttack === true && level.length > 1 ? tiedExtreme(level, (id) => (state.cards[id] ? modifiedStat(state, state.cards[id], "threat", ctx.cards) : 0), "highest") : level;
  return levelAttack.slice(0, 1);
}

function candidatesOf(
  state: ScenarioState,
  spec: PickSpec,
  seat: number,
  picked: readonly string[],
  sourceId: string | null,
  ctx: ReduceContext,
  // The X an event was played for, for a pick that asks for a printed cost of X.
  x?: number,
  // The characters that took part in the attack the Response answers.
  participants?: readonly string[],
  counting = false,
  // The answered event's subject and other card, for a condition read about it (families/attack/pick.ts).
  event?: { subject?: string | null; other?: string | null; discards?: boolean; spends?: boolean; places?: boolean; leaves?: boolean; swaps?: boolean },
): string[] {
  const asking = spec.who === "firstPlayer" ? firstPlayerFor(state, seat) : seat;
  if (spec.type === "player") return seatsOf(state, spec, asking).filter((index) => !state.seats[index]?.eliminated && seatPickMatches(state, index, spec, ctx)).map((index) => `seat:${index}`);
  if (spec.hostForPicked) {
    const card = state.cards[picked.at(-1) ?? ""];
    // An attachment already on a card moves to another one ("attach Dúnedain Warning to another hero", 02026:A:3). The pick's own `control` says whose characters may take it (`you`, `other`, `any`), within the hosts the card's record allows (a card with none: the characters of every seat unless the pick says `you`).
    return card ? attachmentHostIds(state, asking, card.code, ctx, { byEffect: true, anySeat: spec.control !== "you" }).filter((id) => id !== card.host && hostControlFits(state, id, spec.control, asking)) : [];
  }
  // Immunity is to player card effects: an encounter card's Pick may choose an immune card (mec109.immune-to-player-card-effects).
  // An ally with an encounter back is an encounter card and has encounter card effects (dcce.encounter-cards: the ship-objectives, the Modification attachments, Calaerion, Gavin, Send for Help). The Stormcaller Elite's objective allies have no encounter back (dcce.stormcaller-elite) and stay objectives.
  const playerEffect = !counting && isPlayerCardEffect(state, ctx.cards, sourceId);
  // The Power of Angmar: a player card effect cannot choose a card in a discard pile (families/angmar/lock.ts).
  if (spec.from === "discard" && !counting && discardLockedFor(state, sourceId, ctx)) return [];
  const raw = spec.attachedTo ? attachedPool(state, spec.attachedTo, sourceId) : pool(state, spec, asking, ctx, sourceId);
  const at: PickContext = { seat, sourceId, picked, ...(x != null ? { x } : {}), ...(participants ? { participants } : {}), counting, ...event };
  const found = raw.filter((id) => {
    const instance = state.cards[id];
    if (!instance) return false;
    // `controlled` on the attachments of a card leaves out an encounter attachment, which no player controls (Wiglaf, 19027:A:2: "exhaust an attachment", a cost, rr.cost).
    if (spec.attachedTo && spec.controlled && instance.controller == null) return false;
    // Only an attachment a player may discard is offered for one (141071:A:2): a Permanent card on a hero is not.
    if (spec.type === "attachment" && !counting && printedOf(ctx.cards, instance.code).keywords.permanent && (state.cards[instance.host ?? ""]?.zone === "heroes" || state.cards[instance.host ?? ""]?.captive === true)) return false;
    if (playerEffect && !playerCardEffectCanChoose(printedOf(ctx.cards, instance.code), state, id, sourcePrinted(state, ctx.cards, sourceId))) return false;
    // "Immune to non-Master card effects": a card without that Trait cannot choose or affect it (families/misc/guards.ts).
    if (!counting && immuneToSource(state, id, sourceId, ctx)) return false;
    return matchesPick(state, id, spec, at, ctx);
  });
  // "The hero you control with the most damage on it": of the cards that matched, those holding the most (every one, when tied).
  if (spec.mostDamaged) {
    const most = Math.max(0, ...found.map((id) => state.cards[id]?.damage ?? 0));
    return found.filter((id) => (state.cards[id]?.damage ?? 0) === most);
  }
  // "The hero with the most resources" (families/burgle/pick.ts).
  if (spec.mostResources) return mostResources(state, found);
  // "The Aflame location in play with the lowest Aflame value" (families/aflame/pick.ts).
  if (spec.lowestAflame) return lowestAflame(state, found, ctx);
  // "The Harad enemy engaged with you with the lowest Attack" (families/harad/pick.ts).
  if (spec.lowestAttack) return lowestOf(state, found, "attack", ctx);
  if (spec.lowestThreat) return lowestOf(state, found, "threat", ctx);
  // "The highest threat encounter card remaining" (families/black-gate/pick.ts).
  if (spec.highestThreat) return highestThreatOf(state, found, ctx);
  // "The location with the highest combined threat and remaining quest points" (families/long-dark/pick.ts).
  if (spec.highestThreatPlusRemaining) return highestThreatPlusRemaining(state, found, ctx);
  // "The highest cost attachment you control" (families/costs/pick.ts).
  if (spec.highestCost) return highestCost(state, found, ctx);
  // "The ally you control with the highest Willpower" (901304:A:2).
  if (spec.highestWillpower) return tiedExtreme(found, (id) => (state.cards[id] ? modifiedStat(state, state.cards[id], "willpower", ctx.cards) : 0), "highest");
  // "The enemy in the staging area with the highest engagement cost" (50926:A:2).
  if (spec.highestEngagementCost) return tiedExtreme(found, (id) => (state.cards[id] ? modifiedStat(state, state.cards[id], "engagementCost", ctx.cards) : 0), "highest");
  // "The lowest engagement cost enemy in the staging area" (51151:A:2).
  if (spec.lowestEngagementCost) return tiedExtreme(found, (id) => (state.cards[id] ? modifiedStat(state, state.cards[id], "engagementCost", ctx.cards) : 0), "lowest");
  // "The engaged Ship enemy with the highest Attack" (families/sea/ramming.ts).
  return spec.highestAttack ? highestAttack(state, found, ctx) : found;
}

// The cards attached to the source, to the source's host, to the active location, or to the defending character.
function attachedPool(state: ScenarioState, where: "source" | "host" | "activeLocation" | "defender", sourceId: string | null): string[] {
  const source = sourceId ? state.cards[sourceId] : undefined;
  const hostId = hostOf(state, sourceId);
  const defender = state.pendingAttack?.defenderId && !state.pendingAttack.undefended ? state.cards[state.pendingAttack.defenderId] : undefined;
  const holder =
    where === "defender" ? defender : where === "activeLocation" ? (state.activeLocation ? state.cards[state.activeLocation] : undefined) : where === "source" ? source : hostId ? state.cards[hostId] : undefined;
  if (!holder) return [];
  const attached = holder.attachments.filter((id) => state.cards[id] != null && inPlay(state.cards[id]?.zone ?? "removed"));
  // The loot guarding the active location is on it, out of play as it is (core/attached.ts; Mirkwood Hunter, 19087:A:2).
  return where === "activeLocation" ? [...attached, ...lootUnder(state, holder.id)] : attached;
}

/** Whether the instructions after a pick discard what it chose. */
export function feedsDiscard(instructions: readonly Instruction[]): boolean {
  return instructions.some((instruction) => instruction.verb === "DiscardPicked");
}

// How many cards match a filter from a seat's side: the count an amount or a condition reads.
export function countMatching(state: ScenarioState, spec: PickSpec, seat: number, sourceId: string | null, ctx: ReduceContext, participants?: readonly string[], picked: readonly string[] = [], event?: { subject?: string | null }): number {
  const found = pickCandidates(state, spec, seat, picked, sourceId, ctx, undefined, participants, true, event);
  // "When counting the number of Dwarf characters you control, Bombur counts as two" (families/misc/traits.ts).
  return found.length + countsExtra(state, found, spec);
}
