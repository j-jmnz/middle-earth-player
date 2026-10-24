// The slices of the reducer's state the table draws. A selector returns the same object as long as the cards it reads are
// the same objects, so a Zustand subscriber of one zone does not render when another zone changes: a threat change leaves
// the hand slice alone (docs/architecture.md, State). The reducer keeps the references of the zones it did not touch;
// these selectors only keep that property through the join of ids and instances.
import type { CardInstance, ScenarioState } from "../rules/state.ts";
import { shadowCards } from "../rules/zones.ts";

export type ZoneId = "questStage" | "staging" | "activeLocation" | "secondActiveLocation" | "engaged" | "play" | "hand";

export const TABLE_ZONES: readonly ZoneId[] = ["questStage", "staging", "activeLocation", "secondActiveLocation", "engaged", "play", "hand"];

// One card on the table and the cards attached to it, in the order they were attached, then each shadow card dealt to it
// (the first one first; a Ringwraith can carry an additional one, 141069:A:2).
export type ZoneEntry = { card: CardInstance; attached: readonly CardInstance[] };
export type ZoneView = { zone: ZoneId; seat: number; entries: readonly ZoneEntry[] };

const NONE: readonly string[] = [];

/** The instance ids a zone holds, for the seat the table shows. A one-card zone is a list of zero or one. */
export function zoneIds(game: ScenarioState, zone: ZoneId, seat: number): readonly string[] {
  const owner = game.seats[seat];
  switch (zone) {
    case "questStage":
      return game.questStage ? [game.questStage] : NONE;
    case "staging":
      return game.staging;
    case "activeLocation":
      return game.activeLocation ? [game.activeLocation] : NONE;
    case "secondActiveLocation":
      return game.widgets.secondActiveLocation && game.secondActiveLocation ? [game.secondActiveLocation] : NONE;
    case "engaged":
      return owner?.engaged ?? NONE;
    case "play":
      return owner ? [...owner.heroes, ...owner.play] : NONE;
    case "hand":
      return owner?.hand ?? NONE;
  }
}

function sameEntries(previous: readonly ZoneEntry[], next: readonly ZoneEntry[]): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < next.length; index += 1) {
    const a = previous[index];
    const b = next[index];
    if (!a || !b || a.card !== b.card || a.attached.length !== b.attached.length) return false;
    for (let at = 0; at < b.attached.length; at += 1) if (a.attached[at] !== b.attached[at]) return false;
  }
  return true;
}

function entriesOf(game: ScenarioState, ids: readonly string[]): ZoneEntry[] {
  const entries: ZoneEntry[] = [];
  for (const id of ids) {
    const card = game.cards[id];
    if (!card) continue;
    const attached: CardInstance[] = [];
    for (const attachmentId of card.attachments) {
      const attachment = game.cards[attachmentId];
      if (attachment) attached.push(attachment);
    }
    // An engaged enemy's shadow cards travel with it, so turning one up changes this zone's view.
    for (const shadowId of shadowCards(card)) {
      const shadow = game.cards[shadowId];
      if (shadow) attached.push(shadow);
    }
    entries.push({ card, attached });
  }
  return entries;
}

/**
 * A memoized selector for one zone of one seat. It returns the previous view when every card and attachment in the zone is
 * the same object as before, whatever else changed in the state.
 */
export function zoneSelector(zone: ZoneId, seat: number): (game: ScenarioState) => ZoneView {
  let previous: ZoneView | null = null;
  return (game) => {
    const entries = entriesOf(game, zoneIds(game, zone, seat));
    if (previous && sameEntries(previous.entries, entries)) return previous;
    previous = { zone, seat, entries };
    return previous;
  };
}

export type SeatThreat = { seat: number; threat: number; eliminated: boolean };

/** Threat of every seat in the save, the numbers the threat overlay draws. Same array while no threat changed. */
export function threatSelector(): (game: ScenarioState) => readonly SeatThreat[] {
  let previous: readonly SeatThreat[] = [];
  return (game) => {
    const next = game.seats.slice(0, game.seatCount).map((seat, index) => ({ seat: index, threat: seat.threat, eliminated: seat.eliminated }));
    const same = next.length === previous.length && next.every((row, index) => row.threat === previous[index]?.threat && row.eliminated === previous[index]?.eliminated);
    if (same) return previous;
    previous = next;
    return next;
  };
}

/** The seat the table shows: the seat the engine is asking, so a two-handed game follows the decision. */
export function shownSeat(game: ScenarioState): number {
  const seat = game.activeSeat;
  return seat >= 0 && seat < game.seatCount ? seat : 0;
}

/**
 * What a tap on a table card can inspect: the card, then each card attached to it and each of its shadow cards once face up.
 * Attachments peek out only a strip from under their host, so a tap on the host lists them, each a full-size target.
 */
export function inspectTargets(game: ScenarioState, cardId: string): readonly string[] {
  const card = game.cards[cardId];
  if (!card) return [];
  const host = card.host && game.cards[card.host] ? game.cards[card.host] : card;
  if (!host) return [cardId];
  const under = [...host.attachments, ...shadowCards(host)].filter((id) => game.cards[id] != null && game.cards[id]?.face !== "down");
  return [host.id, ...under];
}
