// The slices of the reducer's state the table draws. A selector returns the same object as long as the cards it reads are
// the same objects, so a Zustand subscriber of one zone does not render when another zone changes: a threat change leaves
// the hand slice alone (docs/architecture.md, State). The reducer keeps the references of the zones it did not touch;
// these selectors only keep that property through the join of ids and instances.
import type { ReduceContext } from "../rules/reduce.ts";
import type { CardInstance, ScenarioState } from "../rules/state.ts";
import { shadowCards } from "../rules/zones.ts";
import { captiveUnder } from "../rules/families/south-captive.ts";
import { prisonersOfSeat } from "../rules/families/prisoner.ts";
import { declaredDefenders } from "../rules/families/defense-defenders.ts";

import { threatRows } from "./foresight.ts";

export type ZoneId = "questStage" | "staging" | "activeLocation" | "secondActiveLocation" | "engaged" | "play" | "hand";

export const TABLE_ZONES: readonly ZoneId[] = ["questStage", "staging", "activeLocation", "secondActiveLocation", "engaged", "play", "hand"];

// The four piles the table shows. Only the two discard piles open a list (docs/design-system.md, Table).
export type PileId = "deck" | "discard" | "encounterDeck" | "encounterDiscard";

export const PILES: readonly PileId[] = ["deck", "discard", "encounterDeck", "encounterDiscard"];

export const PILE_WORDS: Readonly<Record<PileId, string>> = { deck: "Deck", discard: "Discard pile", encounterDeck: "Encounter deck", encounterDiscard: "Encounter discard pile" };

// How characters fight an engaged enemy in the attack in progress: defending it, hit by it undefended, or attacking it.
export type FightKind = "defense" | "undefended" | "attack";

// One card on the table and the cards attached to it, in the order they were attached, then each shadow card dealt to it
// (the first one first; a Ringwraith can carry an additional one, 141069:A:2). An engaged enemy in an attack also carries
// the characters fighting it (`paired`) and how (`fight`): the defender, the hero an undefended attack hits, or the
// attackers.
export type ZoneEntry = { card: CardInstance; attached: readonly CardInstance[]; paired: readonly CardInstance[]; fight: FightKind | null };
export type ZoneView = { zone: ZoneId; seat: number; entries: readonly ZoneEntry[] };

/** A card whose face the table hides: facedown, except the prisoner, whose owner knows the card and may still open it (01123:B:1). */
export function hidesFace(card: Pick<CardInstance, "face" | "prisoner" | "zone" | "host"> | undefined): boolean {
  return card?.face === "down" && !isPrisoner(card);
}

/** The hero that is the prisoner: facedown in the captive zone under no card (the cards held with it are not). */
export function isPrisoner(card: Pick<CardInstance, "prisoner" | "zone" | "host">): boolean {
  return card.prisoner === true && card.zone === "captive" && card.host == null;
}

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

/** The instance ids a zone holds, for the seat the table shows. A one-card zone is a list of zero or one. */
export function zoneIds(game: ScenarioState, zone: ZoneId, seat: number): readonly string[] {
  const owner = game.seats[seat];
  switch (zone) {
    case "questStage":
      return game.questStage ? [game.questStage] : NONE;
    case "staging":
      return stagingOrder(game);
    case "activeLocation":
      return game.activeLocation ? [game.activeLocation] : NONE;
    case "secondActiveLocation":
      return game.widgets.secondActiveLocation && game.secondActiveLocation ? [game.secondActiveLocation] : NONE;
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
      // The seat's player side quest stands first in its row: its quest area (families/sidequests-play.ts).
      const quest = owner.questStage && game.cards[owner.questStage] ? [owner.questStage] : [];
      // The hero this seat's player holds as the prisoner is still in play: facedown beside the seat's cards, with Mendor under it.
      return [...quest, ...here, ...prisonersOfSeat(game, seat)];
    }
    case "hand":
      return owner?.hand ?? NONE;
  }
}

// The staging area's cards in the order the table draws them: each guarded objective is followed by the encounter cards attached to it
// (rr.guarded), so a guard stands beside the objective it guards.
function stagingOrder(game: ScenarioState): readonly string[] {
  if (!game.staging.some((id) => game.cards[id]?.guard === true)) return game.staging;
  const ordered: string[] = [];
  for (const id of game.staging) {
    const card = game.cards[id];
    if (!card || card.guard === true) continue;
    ordered.push(id);
    for (const attached of card.attachments) if (game.cards[attached]?.guard === true && game.staging.includes(attached)) ordered.push(attached);
  }
  // A guard whose objective left the staging area is a card of its own again.
  for (const id of game.staging) if (!ordered.includes(id)) ordered.push(id);
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
    if (!a || !b || a.card !== b.card || a.fight !== b.fight || !sameCards(a.attached, b.attached) || !sameCards(a.paired, b.paired)) return false;
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

function entriesOf(game: ScenarioState, ids: readonly string[], pairs: ReturnType<typeof combatPairs>): ZoneEntry[] {
  const entries: ZoneEntry[] = [];
  for (const id of ids) {
    const card = game.cards[id];
    if (!card) continue;
    // An engaged enemy's shadow cards travel with it, so turning one up changes this zone's view.
    // The Ring-bearer facedown under the Watcher in the Water is drawn under it, in play and facedown (mec109.stage-4).
    // Mendor, captured with the prisoner, is drawn under it (01131:A:3). An encounter card guarding an objective is a card of the staging area
    // beside it, not a card drawn under it.
    const captive = card.zone === "staging" || card.zone === "captive" ? captiveUnder(game, id) : null;
    const attached = cardsOf(game, [...card.attachments.filter((other) => game.cards[other]?.guard !== true), ...shadowCards(card), ...(captive ? [captive] : [])]);
    const pair = pairs.get(id);
    entries.push({ card, attached, paired: pair ? cardsOf(game, pair.ids) : EMPTY, fight: pair?.kind ?? null });
  }
  return entries;
}

/**
 * A memoized selector for one zone of one seat. It returns the previous view when every card and attachment in the zone is
 * the same object as before, whatever else changed in the state.
 */
export function zoneSelector(zone: ZoneId, seat: number): (game: ScenarioState) => ZoneView {
  let previous: ZoneView | null = null;
  let lastGame: ScenarioState | null = null;
  return (game) => {
    // The same game object is the same view (a state is never changed once the reducer returns it): the store runs every selector on each
    // `set`, also one that changed no game (a card picked, a peek), so the zone is not walked again.
    if (previous && game === lastGame) return previous;
    lastGame = game;
    const pairs = zone === "engaged" ? combatPairs(game, seat) : new Map<string, { ids: readonly string[]; kind: FightKind }>();
    const entries = entriesOf(game, zoneIds(game, zone, seat), pairs);
    if (previous && sameEntries(previous.entries, entries)) return previous;
    previous = { zone, seat, entries };
    return previous;
  };
}

// A pile: how many cards it holds and, for a discard pile, the card on top (the last one put there).
// A deck also carries the encounter cards attached to it (Iron Shackles, 01105:A:1), drawn under it.
export type PileView = { pile: PileId; seat: number; ids: readonly string[]; top: CardInstance | null; attached?: readonly CardInstance[] };

function pileIds(game: ScenarioState, pile: PileId, seat: number): readonly string[] {
  switch (pile) {
    case "deck":
      return game.seats[seat]?.deck ?? NONE;
    case "discard":
      return game.seats[seat]?.discard ?? NONE;
    case "encounterDeck":
      return game.encounterDeck;
    case "encounterDiscard":
      return game.encounterDiscard;
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
    const faceUp = pile === "discard" || pile === "encounterDiscard";
    const last = ids[ids.length - 1];
    const top = faceUp && last ? (game.cards[last] ?? null) : null;
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

/**
 * The engagement costs of the enemies in staging that can be engaged, lowest first, as one string ("2,4"; "" for none): the ticks marked on each
 * dial's meter. A string compares by value, so a subscriber renders only when a cost changes. It is made for one context (`ctx`), and the same game
 * object gives the previous string without asking the engine again.
 */
export function tickKeySelector(ctx: ReduceContext): (game: ScenarioState) => string {
  let previous = "";
  let lastGame: ScenarioState | null = null;
  return (game) => {
    if (game === lastGame) return previous;
    lastGame = game;
    previous = threatRows(game, ctx)
      .filter((row) => !row.blocked)
      .map((row) => row.cost)
      .join(",");
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
  const host = card.host && game.cards[card.host] ? game.cards[card.host] : card;
  if (!host) return [cardId];
  const under = [...host.attachments, ...shadowCards(host)].filter((id) => game.cards[id] != null && game.cards[id]?.face !== "down");
  return [host.id, ...under];
}

/**
 * Whether a card is drawn whole on the table the seat sees, a full target for a tap: in staging, the active location or the
 * quest; in the seat's hand, heroes, play area or engagement area; fighting one of its enemies; or the top of its deck when
 * the rules let it be played from there. An attachment or a shadow card only peeks out under its host, so a choice among
 * them is made on a panel's tiles instead.
 */
export function onTableFor(game: ScenarioState, seat: number): (cardId: string) => boolean {
  const fighting = fightingIds(game, seat);
  return (cardId) => {
    const card = game.cards[cardId];
    if (!card) return false;
    if (fighting.has(cardId)) return true;
    switch (card.zone) {
      case "staging":
      case "activeLocation":
      case "secondActiveLocation":
      case "questStage":
        return true;
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
