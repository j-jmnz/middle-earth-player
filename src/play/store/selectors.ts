// The slices of the reducer's state the table draws. A selector returns the same object as long as the cards it reads are
// the same objects, so a Zustand subscriber of one zone does not render when another zone changes: a threat change leaves
// the hand slice alone (docs/architecture.md, State). The reducer keeps the references of the zones it did not touch;
// these selectors only keep that property through the join of ids and instances.
import { BLACK_GATE } from "../../rules/families/harad/under.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import type { CardInstance, ScenarioState } from "../../rules/core/state.ts";
import { cardsUnder, shadowCards } from "../../rules/core/zones.ts";
import { lookedIds } from "../../rules/families/sea/sailing.ts";
import { captivesOf, captivesUnder } from "../../rules/families/captives/values.ts";
import { captiveUnder } from "../../rules/families/south/captive.ts";
import { grappledWith } from "../../rules/families/grapple/values.ts";
import { prisonersOfSeat } from "../../rules/families/prisoner/index.ts";
import { declaredDefenders } from "../../rules/families/defense/defenders.ts";
import { activeOf, areaOf, isSeparate, sharedStaging, stageOf, stagingOf } from "../../rules/families/breaking/areas.ts";

import { threatRows } from "./foresight.ts";
import { isDiscardPile, opensList, PILE_WORDS, PILES, SECOND_PILES, secondPilesOf, type BasePileId, type PileId, type SecondPileId, type VictoryPileId } from "./pile-ids.ts";
import { areaGroup, areaRoleOf, type AreaRole } from "./stormcaller-table.ts";

export type ZoneId = "questStage" | "staging" | "activeLocation" | "secondActiveLocation" | "engaged" | "play" | "hand";

export const TABLE_ZONES: readonly ZoneId[] = ["questStage", "staging", "activeLocation", "secondActiveLocation", "engaged", "play", "hand"];

// The piles, by name, live in pile-ids.ts and are read through here.
export { isDiscardPile, opensList, PILE_WORDS, PILES, SECOND_PILES, secondPilesOf, type BasePileId, type PileId, type SecondPileId, type VictoryPileId };

// How characters fight an engaged enemy in the attack in progress: defending it, hit by it undefended, or attacking it.
export type FightKind = "defense" | "undefended" | "attack";

// One card on the table and the cards attached to it, in the order they were attached, then each shadow card dealt to it
// (the first one first; a Ringwraith can carry an additional one, 141069:A:2). An engaged enemy in an attack also carries
// the characters fighting it (`paired`) and how (`fight`): the defender, the hero an undefended attack hits, or the
// attackers.
// `kind` and `ship` are what the table knows of the card's printing when it is given the facts (ZoneFacts): the fold order of staging reads the kind, and the
// play area stands ships first (0 the Dream-chaser, 1 any other ship-objective). `area` is the card's place in the Stormcaller's area (stormcaller-table.ts): its group heads staging.
export type ZoneEntry = { card: CardInstance; attached: readonly CardInstance[]; paired: readonly CardInstance[]; fight: FightKind | null; kind?: "enemy" | "location" | "other"; ship?: 0 | 1; area?: AreaRole };

/** What the zone selectors read of a card's printing: its type, and its place among the ships (null for a card that is no ship). Absent: nothing is known. */
export type ZoneFacts = { typeOf: (code: string) => string | null; shipRank: (code: string) => 0 | 1 | null; pointsOf?: (game: ScenarioState, cardId: string) => number };
export type ZoneView = { zone: ZoneId; seat: number; entries: readonly ZoneEntry[] };

/** A card whose face the table hides: facedown, except the prisoner, whose owner knows the card and may still open it (01123:B:1). */
export function hidesFace(card: Pick<CardInstance, "face" | "prisoner" | "zone" | "host"> | undefined): boolean {
  return card?.face === "down" && !isPrisoner(card);
}

/** The hero that is the prisoner: facedown in the captive zone under no card (the cards held with it are not). */
export function isPrisoner(card: Pick<CardInstance, "prisoner" | "zone" | "host">): boolean {
  return card.prisoner === true && card.zone === "captive" && card.host == null;
}

/** Whether a staging card with more than one card under it shows one counted peek (layout.ts, `stacks`): a sea game (a grappled arm, Black Key) and a game with the Harad deck (the enemies under The Black Gate, 144027:A:2); every other game peeks each card. */
export const stacksUnder = (state: { game: ScenarioState }): boolean => state.game.sea != null || state.game.piles?.haradDeck !== undefined;

const NONE: readonly string[] = [];
const EMPTY: readonly CardInstance[] = [];

/**
 * The characters in the attack in progress, by the enemy they fight: the declared defender, or the hero an undefended attack
 * hits once named; the attackers of a player attack. Only enemies engaged with `seat`.
 */
export function combatPairs(game: ScenarioState, seat: number): ReadonlyMap<string, { ids: readonly string[]; kind: FightKind }> {
  const pairs = new Map<string, { ids: readonly string[]; kind: FightKind }>();
  const engaged = game.seats[seat]?.engaged ?? NONE;
  const attack = game.pendingAttack;
  if (attack && engaged.includes(attack.enemyId)) {
    const defended = attack.defenderId != null && !attack.undefended;
    // Every defender declared (Stand Together, rr.multiple-defenders), or the hero an undefended attack hits.
    const fighters = (defended ? declaredDefenders(attack) : [attack.heroId]).filter((id): id is string => id != null && game.cards[id] != null);
    if (fighters.length > 0) pairs.set(attack.enemyId, { ids: fighters, kind: defended ? "defense" : "undefended" });
  }
  const strike = game.pendingStrike;
  if (strike && engaged.includes(strike.enemyId)) {
    const attackers = strike.attackerIds.filter((id) => game.cards[id] != null);
    if (attackers.length > 0) pairs.set(strike.enemyId, { ids: attackers, kind: "attack" });
  }
  return pairs;
}

function fightingIds(game: ScenarioState, seat: number): ReadonlySet<string> {
  return new Set([...combatPairs(game, seat).values()].flatMap((pair) => pair.ids));
}

/**
 * The instance ids a zone holds, for the seat the table shows. A one-card zone is a list of zero or one. While stages are separate (Breaking
 * of the Fellowship, stage 2B on) the staging area, the quest stage and the active location are the shown seat's own, and there is no second
 * active location of a shared quest: each seat has one (families/breaking/areas.ts).
 */
export function zoneIds(game: ScenarioState, zone: ZoneId, seat: number, facts?: ZoneFacts): readonly string[] {
  const owner = game.seats[seat];
  switch (zone) {
    case "questStage": {
      // A seat that has not chosen its stage yet (stage 2B resolving) still sees the shared stage.
      const stage = stageOf(game, seat) ?? game.questStage;
      return stage ? [stage] : NONE;
    }
    case "staging":
      return withArea(game, stagingOrder(game, areaOrShared(game, seat)));
    case "activeLocation": {
      const active = activeOf(game, seat);
      return active ? [active] : NONE;
    }
    case "secondActiveLocation":
      return !isSeparate(game) && game.widgets.secondActiveLocation && game.secondActiveLocation ? [game.secondActiveLocation] : NONE;
    case "engaged":
      return owner?.engaged ?? NONE;
    case "play": {
      if (!owner) return NONE;
      // An attachment is in its controller's play list and on its host; the table draws it on the host only. A character in
      // the attack in progress is drawn beside the enemy it fights, in the engagement area.
      const fighting = fightingIds(game, seat);
      const here = [...owner.heroes, ...owner.play].filter((id) => {
        const card = game.cards[id];
        return card != null && card.host == null && !fighting.has(id);
      });
      // The seat's player side quest stands first in its row: its quest area (families/sidequests/play.ts).
      const quest = owner.questStage && game.cards[owner.questStage] ? [owner.questStage] : [];
      // Then its ships, the Dream-chaser before any other (dcce.ship-objectives), then its heroes and the rest.
      const ships = facts ? shipsFirst(game, here, facts) : [];
      const rest = facts ? here.filter((id) => !ships.includes(id)) : here;
      // The hero this seat's player holds as the prisoner is still in play: facedown beside the seat's cards, with Mendor under it.
      return [...quest, ...ships, ...rest, ...prisonersOfSeat(game, seat)];
    }
    case "hand":
      return owner?.hand ?? NONE;
  }
}

// The shown seat's staging area; the cards in no seat's area yet (the shared staging area stage 2B is dealing out) stay in view until each has an owner.
function areaOrShared(game: ScenarioState, seat: number): readonly string[] {
  const own = stagingOf(game, seat);
  if (!isSeparate(game)) return own;
  const shared = sharedStaging(game);
  return shared.length > 0 ? [...own, ...shared] : own;
}

// The Stormcaller's area heads the staging row (dcce.stormcallers-area): its stage and its cards first, wherever they stand, then the rest of the staging area. A game with no area is unchanged.
function withArea(game: ScenarioState, ids: readonly string[]): readonly string[] {
  const group = areaGroup(game);
  if (group.length === 0) return ids;
  const heads = new Set(group);
  return [...group, ...ids.filter((id) => !heads.has(id))];
}

// The ship-objectives among `ids`, the Dream-chaser first (`shipRank`), the rest in the order they were given.
function shipsFirst(game: ScenarioState, ids: readonly string[], facts: ZoneFacts): string[] {
  const rank = (id: string) => facts.shipRank(game.cards[id]?.code ?? "");
  return ids.filter((id) => rank(id) != null).sort((a, b) => (rank(a) ?? 1) - (rank(b) ?? 1));
}

// The staging area's cards in the order the table draws them: each guarded objective is followed by the encounter cards attached to it
// (rr.guarded), so a guard stands beside the objective it guards.
function stagingOrder(game: ScenarioState, staging: readonly string[]): readonly string[] {
  if (!staging.some((id) => game.cards[id]?.guard === true)) return staging;
  const ordered: string[] = [];
  for (const id of staging) {
    const card = game.cards[id];
    if (!card || card.guard === true) continue;
    ordered.push(id);
    for (const attached of card.attachments) if (game.cards[attached]?.guard === true && staging.includes(attached)) ordered.push(attached);
  }
  // A guard whose objective left the staging area is a card of its own again.
  for (const id of staging) if (!ordered.includes(id)) ordered.push(id);
  return ordered;
}

function sameCards(previous: readonly CardInstance[], next: readonly CardInstance[]): boolean {
  if (previous.length !== next.length) return false;
  for (let at = 0; at < next.length; at += 1) if (previous[at] !== next[at]) return false;
  return true;
}

function sameEntries(previous: readonly ZoneEntry[], next: readonly ZoneEntry[]): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < next.length; index += 1) {
    const a = previous[index];
    const b = next[index];
    if (!a || !b || a.card !== b.card || a.fight !== b.fight || a.area !== b.area || !sameCards(a.attached, b.attached) || !sameCards(a.paired, b.paired)) return false;
  }
  return true;
}

function cardsOf(game: ScenarioState, ids: readonly string[]): CardInstance[] {
  const out: CardInstance[] = [];
  for (const id of ids) {
    const card = game.cards[id];
    if (card) out.push(card);
  }
  return out;
}

function kindOf(type: string | null): ZoneEntry["kind"] {
  return type === "enemy" || type === "location" ? type : "other";
}

function entriesOf(game: ScenarioState, ids: readonly string[], pairs: ReturnType<typeof combatPairs>, facts?: ZoneFacts): ZoneEntry[] {
  const entries: ZoneEntry[] = [];
  // The Captives in play, read once for the zone (none in every game but The Uruk-hai's): the zone's cards then ask this list, not every card of the game.
  const held = ids.length > 0 ? captivesOf(game) : EMPTY;
  for (const id of ids) {
    const card = game.cards[id];
    if (!card) continue;
    // An engaged enemy's shadow cards travel with it, so turning one up changes this zone's view.
    // The Ring-bearer facedown under the Watcher in the Water is drawn under it, in play and facedown (mec109.stage-4).
    // Mendor, captured with the prisoner, is drawn under it (01131:A:3). An encounter card guarding an objective is a card of the staging area
    // beside it, not a card drawn under it.
    const captive = card.zone === "staging" || card.zone === "captive" || card.zone === "activeLocation" ? captiveUnder(game, id) : null;
    // The Captives of The Uruk-hai lie under To Isengard! or the enemy that holds one, wherever that enemy is (staging or engaged): every one of them is drawn (families/captives).
    const captives = card.zone === "staging" || card.zone === "engaged" || card.zone === "captive" ? (held.length === 0 ? NONE : captivesUnder(game, id, held)) : NONE;
    const under = captives.length > 0 ? captives : captive ? [captive] : NONE;
    // The enemies grappled with a location are drawn facedown under it, as its attachments are (dcce.grapple).
    // The enemies facedown under The Black Gate lie under it, one counted peek (144027:A:2).
    const gated = card.code === BLACK_GATE ? cardsUnder(game, id) : NONE;
    const attached = cardsOf(game, [...card.attachments.filter((other) => game.cards[other]?.guard !== true), ...shadowCards(card), ...under, ...gated, ...(card.zone === "staging" ? grappledWith(game, id) : [])]);
    const pair = pairs.get(id);
    const rank = facts?.shipRank(card.code) ?? null;
    const area = game.sea?.stormcaller ? areaRoleOf(game, id) : null;
    entries.push({ card, attached, paired: pair ? cardsOf(game, pair.ids) : EMPTY, fight: pair?.kind ?? null, ...(facts ? { kind: kindOf(facts.typeOf(card.code)) } : {}), ...(rank != null ? { ship: rank } : {}), ...(area ? { area } : {}) });
  }
  return entries;
}

/**
 * A memoized selector for one zone of one seat. It returns the previous view when every card and attachment in the zone is
 * the same object as before, whatever else changed in the state.
 */
export function zoneSelector(zone: ZoneId, seat: number, facts?: ZoneFacts): (game: ScenarioState) => ZoneView {
  let previous: ZoneView | null = null;
  let lastGame: ScenarioState | null = null;
  return (game) => {
    // The same game object is the same view (a state is never changed once the reducer returns it): the store runs every selector on each
    // `set`, also one that changed no game (a card picked, a peek), so the zone is not walked again.
    if (previous && game === lastGame) return previous;
    lastGame = game;
    const pairs = zone === "engaged" ? combatPairs(game, seat) : new Map<string, { ids: readonly string[]; kind: FightKind }>();
    const entries = entriesOf(game, zoneIds(game, zone, seat, facts), pairs, facts);
    if (previous && sameEntries(previous.entries, entries)) return previous;
    previous = { zone, seat, entries };
    return previous;
  };
}

// A pile: how many cards it holds and, for a discard pile, the card on top (the last one put there).
// A deck also carries the encounter cards attached to it (Iron Shackles, 01105:A:1), drawn under it. The victory display also carries
// the two cards under its top, fanned behind it, and the Victory points its cards score (victoryPileSelector).
export type PileView = { pile: PileId; seat: number; ids: readonly string[]; top: CardInstance | null; attached?: readonly CardInstance[]; fan?: readonly CardInstance[]; points?: number };

/** The cards of a pile, bottom first: the shown seat's deck or discard pile, the encounter pair, the second slot's piles. */
export function pileIds(game: ScenarioState, pile: PileId, seat: number): readonly string[] {
  switch (pile) {
    case "deck":
      return game.seats[seat]?.deck ?? NONE;
    case "discard":
      return game.seats[seat]?.discard ?? NONE;
    case "encounterDeck":
      return game.encounterDeck;
    case "encounterDiscard":
      return game.encounterDiscard;
    case "corsairDeck":
      return game.corsairDeck ?? NONE;
    case "corsairDiscard":
      return game.corsairDiscard ?? NONE;
    case "unchartedDeck":
    case "grottoDeck":
      return game.uncharted?.deck ?? NONE;
    case "evilCreaturesDeck":
    case "evilCreaturesDiscard":
    case "cavesDeck":
    case "haradDeck":
    case "angmarOrcDeck":
      return game.piles?.[pile] ?? NONE;
    case "victory":
      return game.victory;
  }
}

/** A memoized selector for one pile: the same view while the pile's list and its top card are the same objects. */
export function pileSelector(pile: PileId, seat: number): (game: ScenarioState) => PileView {
  let previous: PileView | null = null;
  let lastGame: ScenarioState | null = null;
  return (game) => {
    if (previous && game === lastGame) return previous;
    lastGame = game;
    const ids = pileIds(game, pile, seat);
    const faceUp = opensList(pile);
    const last = ids[ids.length - 1];
    // The Uncharted deck shows its top card's Lost Island side; every copy of it is the same picture (dcce.uncharted-deck). The Grotto deck shows its top card's Grotto side, which the players may look at (dcce.grotto-deck).
    const topId = pile === "unchartedDeck" || pile === "grottoDeck" ? ids[0] : faceUp ? last : undefined;
    const top = topId ? (game.cards[topId] ?? null) : null;
    const attached = pile === "deck" ? cardsOf(game, game.seats[seat]?.deckAttached ?? NONE) : EMPTY;
    if (previous && previous.ids === ids && previous.top === top && sameCards(previous.attached ?? EMPTY, attached)) return previous;
    previous = { pile, seat, ids, top, attached };
    return previous;
  };
}

export type SeatThreat = { seat: number; threat: number; eliminated: boolean };

/** Threat of every seat in the save, the numbers the threat overlay draws. Same array while no threat changed. */
export function threatSelector(): (game: ScenarioState) => readonly SeatThreat[] {
  let previous: readonly SeatThreat[] = [];
  let lastGame: ScenarioState | null = null;
  return (game) => {
    if (game === lastGame) return previous;
    lastGame = game;
    const next = game.seats.slice(0, game.seatCount).map((seat, index) => ({ seat: index, threat: seat.threat, eliminated: seat.eliminated }));
    const same = next.length === previous.length && next.every((row, index) => row.threat === previous[index]?.threat && row.eliminated === previous[index]?.eliminated);
    if (same) return previous;
    previous = next;
    return next;
  };
}

function ticksOf(game: ScenarioState, ctx: ReduceContext, seat?: number): string {
  return threatRows(game, ctx, seat)
    .filter((row) => !row.blocked)
    .map((row) => row.cost)
    .join(",");
}

/**
 * The engagement costs of the enemies in staging that can be engaged, lowest first, as one string ("2,4"; "" for none): the ticks marked on a dial's
 * meter. A string compares by value, so a subscriber renders only when a cost changes. It is made for one context (`ctx`), and the same game
 * object gives the previous string without asking the engine again. Once stages are separate they are the enemies in the staging area of `shown`.
 */
export function tickKeySelector(ctx: ReduceContext, shown?: number): (game: ScenarioState) => string {
  let previous = "";
  let lastGame: ScenarioState | null = null;
  return (game) => {
    if (game === lastGame) return previous;
    lastGame = game;
    previous = ticksOf(game, ctx, shown);
    return previous;
  };
}

/**
 * The ticks of every dial, one key for each seat joined by "|": each seat's own staging area once stages are separate (mec109.multiple-staging-areas), the
 * one staging area for every dial before. Same string-by-value contract as `tickKeySelector`.
 */
export function dialTicksSelector(ctx: ReduceContext): (game: ScenarioState) => string {
  let previous = "";
  let lastGame: ScenarioState | null = null;
  return (game) => {
    if (game === lastGame) return previous;
    lastGame = game;
    previous = Array.from({ length: game.seatCount }, (_, seat) => ticksOf(game, ctx, isSeparate(game) ? seat : undefined)).join("|");
    return previous;
  };
}

/**
 * The seat the engine is asking, in range. It picks, pays and sends: the table's choices, the dock and the sheets are its, whichever
 * seat the table draws. Nothing about a peek can change it, so the picking code calls this and never `shownSeat`.
 */
export function actingSeat(game: ScenarioState): number {
  const seat = game.activeSeat;
  return seat >= 0 && seat < game.seatCount ? seat : 0;
}

/**
 * The seat whose staging area and stage the quest numbers (committed willpower against staging threat) read: the acting seat once stages are
 * separate, each seat quests against its own (mec109.multiple-staging-areas); undefined before, when the whole table is one area.
 */
export function questSeat(game: ScenarioState): number | undefined {
  return isSeparate(game) ? actingSeat(game) : undefined;
}

/**
 * The seat the table draws: the seat the player is peeking at (`viewed`, a UI-only choice of the table store; peek.ts), else the
 * acting seat, so a two-handed game follows the decision. A peek changes what is drawn and nothing else: whatever picks, pays or
 * sends reads `actingSeat`.
 */
export function shownSeat(game: ScenarioState, viewed: number | null): number {
  return viewed != null && viewed >= 0 && viewed < game.seatCount ? viewed : actingSeat(game);
}

/**
 * What a long press on a table card shows: the card, then each card attached to it and each of its shadow cards once face
 * up. Attachments peek out only a strip from under their host, so the preview lists them, each one a full card to read.
 */
export function inspectTargets(game: ScenarioState, cardId: string): readonly string[] {
  const card = game.cards[cardId];
  if (!card) return [];
  // A card names its host only while the host lists it: a shadow card moved on (Stalking Goblin, "Shadow: Add ~ to the staging area") keeps its `host` after
  // the enemy has dropped it, and previewing it must show the card itself, not that enemy.
  const named = card.host ? game.cards[card.host] : undefined;
  const host = named && (named.attachments.includes(cardId) || shadowCards(named).includes(cardId)) ? named : card;
  const under = [...host.attachments, ...shadowCards(host)].filter((id) => game.cards[id] != null && game.cards[id]?.face !== "down");
  return [host.id, ...under];
}

/**
 * Whether a card is drawn whole on the table the seat sees, a full target for a tap: in staging, the active location or the
 * quest (the seat's own once stages are separate); in the seat's hand, heroes, play area or engagement area; fighting one of its enemies; or the top of its deck when
 * the rules let it be played from there. A card `folded` into a row's stack (row-fold.ts) is not. An attachment or a shadow card only peeks out under its host, so a choice among
 * them is made on a panel's tiles instead.
 */
export function onTableFor(game: ScenarioState, seat: number, folded?: ReadonlySet<string>): (cardId: string) => boolean {
  const fighting = fightingIds(game, seat);
  return (cardId) => {
    const card = game.cards[cardId];
    if (!card) return false;
    // A card folded into a row's stack is not drawn whole (row-fold.ts): a pick that reaches it opens as the choice tray.
    if (folded?.has(cardId)) return false;
    if (fighting.has(cardId)) return true;
    switch (card.zone) {
      // Once stages are separate the table draws the seat's own area, stage and active location: a card of another seat's is not on it.
      case "staging": {
        const area = areaOf(game, cardId);
        return area == null || area === seat;
      }
      case "activeLocation":
      case "secondActiveLocation":
        return !isSeparate(game) || activeOf(game, seat) === cardId;
      case "questStage":
        return !isSeparate(game) || stageOf(game, seat) === cardId || game.questStage === cardId;
      case "hand":
      case "heroes":
      case "engaged":
        return card.controller === seat;
      case "play":
        return card.host == null && card.controller === seat;
      case "deck":
        return game.seats[seat]?.deck[0] === cardId;
      default:
        return false;
    }
  };
}

const LOOKED = new WeakMap<object, readonly CardInstance[]>();
const NO_LOOKED: readonly CardInstance[] = [];

/**
 * The cards a Sailing test looked at, still on top of the encounter deck, in the order they were looked at (dcce.sailing-tests): the table lays them in a strip, face up.
 * The same array for the same test, so a canvas that selects it renders only when the look changes.
 */
export function lookedOf(game: ScenarioState): readonly CardInstance[] {
  const test = game.sea?.sailing;
  if (test?.step !== "shift" && test?.step !== "look") return NO_LOOKED;
  const held = LOOKED.get(test);
  if (held) return held;
  const cards = cardsOf(game, test.looked);
  LOOKED.set(test, cards);
  return cards;
}

/** Whether a card is one of those a Sailing test looked at: its face is shown to every player, though the card is still on the deck. */
export function isLooked(game: ScenarioState, cardId: string): boolean {
  return lookedIds(game).includes(cardId);
}

/**
 * The victory display as a pile (docs/design-system-table.md, Piles): its newest card on top, the two before it fanned behind, and the
 * Victory points the cards score on the side they lie (`pointsOf`, the count the score adds up). Null while it is empty, so the table draws
 * no pile. The same view while the display's list, its cards and the modifiers are the same objects.
 */
export function victoryPileSelector(pointsOf: (game: ScenarioState, cardId: string) => number): (game: ScenarioState) => PileView | null {
  let previous: PileView | null = null;
  let held: { victory: ScenarioState["victory"]; cards: ScenarioState["cards"]; modifiers: ScenarioState["modifiers"] } | null = null;
  return (game) => {
    const ids = game.victory;
    if (ids.length === 0) {
      previous = null;
      held = null;
      return null;
    }
    if (previous && held && held.victory === ids && held.cards === game.cards && held.modifiers === game.modifiers) return previous;
    const top = game.cards[ids[ids.length - 1] as string] ?? null;
    const fan = cardsOf(game, ids.slice(Math.max(0, ids.length - 3), -1));
    const points = ids.reduce((sum, id) => sum + pointsOf(game, id), 0);
    held = { victory: ids, cards: game.cards, modifiers: game.modifiers };
    if (previous && previous.ids === ids && previous.top === top && previous.points === points && sameCards(previous.fan ?? EMPTY, fan)) return previous;
    previous = { pile: "victory", seat: 0, ids, top, fan, points };
    return previous;
  };
}
