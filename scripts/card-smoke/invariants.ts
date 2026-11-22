import { eliminationLevel } from "../../src/rules/core/eliminate.ts";
import { modifiedStat } from "../../src/rules/core/keywords.ts";
import { flagged, inPlay } from "../../src/rules/core/state.ts";
import type { CardInstance, ZoneName } from "../../src/rules/core/state-types.ts";
import type { ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

// What must hold of every table a game reaches, whatever the cards did (the third check of scripts/card-smoke/encounter-games.ts, beside the throw and the refusal): each card is in the one list its zone
// names, the links between a card and its attachments agree, no counter is negative, and a table with nothing resolving holds no character or enemy at lethal damage and no seat at its elimination level.
// A fault is a sentence that names the card's code, so the same fault reads the same in every game.

// The lists a seat holds, each named for the zone of the cards in it.
const SEAT_LISTS = ["deck", "hand", "discard", "heroes", "play", "engaged"] as const;
// The zones whose cards are all in one list of the state.
const LISTED: ReadonlySet<ZoneName> = new Set<ZoneName>([...SEAT_LISTS, "staging", "encounterDeck", "encounterDiscard", "victory", "removed", "setAside"]);
// Out of play, where a card keeps its attachments by design: set aside with them, held as a prisoner or a captive, in the victory display or out of the game.
const KEEPS_ATTACHMENTS: ReadonlySet<ZoneName> = new Set<ZoneName>(["setAside", "captive", "captured", "under", "removed", "victory", "questDeck"]);
const COUNTERS = ["damage", "progress", "resources"] as const;

type Lists = { faults: string[]; where: Map<string, string> };

function listed(state: ScenarioState, lists: Lists, ids: readonly string[] | undefined, name: string, zones: readonly ZoneName[] | null): void {
  for (const id of ids ?? []) {
    const card = state.cards[id];
    if (!card) {
      lists.faults.push(`The list ${name} holds an id that is no card`);
      continue;
    }
    const other = lists.where.get(id);
    if (other != null) lists.faults.push(`Card ${card.code} is in two lists: ${other} and ${name}`);
    lists.where.set(id, name);
    if (zones && !zones.includes(card.zone)) lists.faults.push(`Card ${card.code} is in the list ${name} with the zone ${card.zone}`);
  }
}

// Nothing is resolving: no frame, no attack, no strike. Lethal damage and an elimination level wait for nothing here.
function quiet(state: ScenarioState): boolean {
  return state.stack.length === 0 && state.pendingAttack == null && state.pendingStrike == null && !state.lost && !state.stageCleared;
}

function hitPoints(state: ScenarioState, card: CardInstance, ctx: ReduceContext): number {
  const printed = ctx.cards.get(card.code);
  if (!printed || printed.health == null || (printed.type !== "hero" && printed.type !== "ally" && printed.type !== "enemy")) return 0;
  return modifiedStat(state, card, "hitPoints", ctx.cards);
}

function cardFaults(state: ScenarioState, card: CardInstance, lists: Lists, ctx: ReduceContext): void {
  const { faults } = lists;
  for (const key of COUNTERS) if (!Number.isInteger(card[key]) || card[key] < 0) faults.push(`Card ${card.code} has ${key} ${card[key]}`);
  if (LISTED.has(card.zone) && !lists.where.has(card.id)) faults.push(`Card ${card.code} has the zone ${card.zone} and is in no list`);
  if (card.host != null) {
    const host = state.cards[card.host];
    if (!host) faults.push(`Card ${card.code} has a host that is no card`);
    else if (card.zone === "attached" && !host.attachments.includes(card.id)) faults.push(`Card ${card.code} is attached to ${host.code}, which does not list it`);
  }
  for (const id of card.attachments) {
    const attachment = state.cards[id];
    if (!attachment) faults.push(`Card ${card.code} lists an attachment that is no card`);
    else if (attachment.host !== card.id) faults.push(`Card ${card.code} lists the attachment ${attachment.code}, whose host is another card`);
  }
  if (card.attachments.length > 0 && !inPlay(card.zone) && !KEEPS_ATTACHMENTS.has(card.zone)) faults.push(`Card ${card.code} is out of play (${card.zone}) and keeps its attachments`);
  if (card.shadowId != null && state.cards[card.shadowId]?.zone !== "shadow") faults.push(`Card ${card.code} has a shadow card in the zone ${state.cards[card.shadowId]?.zone ?? "none"}`);
  if (!quiet(state)) return;
  const live = (card.zone === "heroes" || card.zone === "play" || card.zone === "engaged" || card.zone === "staging") && card.face !== "down" && !card.prisoner && !card.captive && !card.guardedHero;
  if (!live) return;
  const points = hitPoints(state, card, ctx);
  if (points > 0 && card.damage >= points && !flagged(state, card.id, "indestructible")) faults.push(`Card ${card.code} is in play (${card.zone}) with ${card.damage} damage of ${points} hit points while nothing resolves`);
}

/** The faults of the table, each a sentence; none on a sound table. */
export function tableFaults(state: ScenarioState, ctx: ReduceContext): string[] {
  const lists: Lists = { faults: [], where: new Map() };
  state.seats.forEach((seat, index) => {
    for (const list of SEAT_LISTS) listed(state, lists, seat[list], `${list} of seat ${index}`, [list]);
  });
  listed(state, lists, state.staging, "staging", ["staging", "seatStaging"]);
  listed(state, lists, state.encounterDeck, "encounterDeck", ["encounterDeck"]);
  listed(state, lists, state.encounterDiscard, "encounterDiscard", ["encounterDiscard"]);
  listed(state, lists, state.victory, "victory", ["victory"]);
  listed(state, lists, state.removed, "removed", ["removed"]);
  listed(state, lists, state.setAside, "setAside", ["setAside"]);
  listed(state, lists, state.questDeck, "questDeck", null);
  listed(state, lists, state.burdenDeck, "burdenDeck", null);
  for (const card of Object.values(state.cards)) cardFaults(state, card, lists, ctx);
  for (let index = 0; index < state.seatCount; index += 1) {
    const seat = state.seats[index];
    if (!seat) continue;
    if (!Number.isInteger(seat.threat) || seat.threat < 0) lists.faults.push(`Seat ${index} has threat ${seat.threat}`);
    if (quiet(state) && !seat.eliminated && seat.threat >= eliminationLevel(state, index)) lists.faults.push(`Seat ${index} is at threat ${seat.threat} and is not eliminated while nothing resolves`);
  }
  return lists.faults;
}
