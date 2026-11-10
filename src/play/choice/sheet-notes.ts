// The sentences and numbers the live sheets (sheets.ts) are built from where one window needs more than a line: the Hide test's numbers and commit note,
// the card a Response window answers, a response window's note, the optional engagement's note and what a look window shows.
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import type { Frame, GameEvent, ResponseOffer } from "../../rules/core/state.ts";
import { hideWillpower } from "../../rules/quest/hide.ts";
import { threatRows } from "../store/foresight.ts";
import { tokenOutcome } from "../words/scenarios/oath.ts";
import { switchNote } from "../words/scenarios/uncharted.ts";
import { nightResponseNote } from "../words/scenarios/night.ts";
import { framsburgEngageNote, framsburgResponseNote } from "../words/scenarios/framsburg.ts";
import { fateEngageNote, fateResponseNote } from "../words/scenarios/fate.ts";
import { gundabadResponseNote } from "../words/scenarios/gundabad.ts";
import type { HideNumbers, SheetNames, TriggerOption } from "./sheet-types.ts";

export function hideNumbers(game: ScenarioState, ctx: ReduceContext, frame: Frame | undefined): HideNumbers | null {
  for (let index = game.stack.length - 1; index >= 0; index -= 1) {
    const hide = game.stack[index];
    const data = hide?.data;
    if (!hide || data?.kind !== "hide") continue;
    // The engine's own total: committed characters in play plus what the seat and the table hold for the test.
    return { x: data.x, threat: data.threat, willpower: hideWillpower(game, hide.seat, data.committedIds, ctx), committed: data.committedIds };
  }
  return frame?.data.kind === "hide" ? { x: frame.data.x, threat: frame.data.threat, willpower: 0, committed: [] } : null;
}

// The card the listed Responses answer. One window may hold the Responses of one occurrence (each character of one commit,
// rr.triggering-condition): it is named after the card they answer when they share one, and not named when they do not.
export function answeredCard(event: GameEvent, offers: readonly ResponseOffer[], listed: readonly TriggerOption[]): string | null {
  const about = (answered: GameEvent) => answered.subject ?? answered.cardId ?? null;
  const cards = new Set(listed.flatMap((item) => offers.filter((offer) => offer.cardId === item.cardId && offer.effectId === item.effectId).map((offer) => about(offer.event ?? event))));
  if (cards.size === 0) return about(event);
  return cards.size === 1 ? ([...cards][0] ?? null) : null;
}

// A response window's sentence, naming the Responses of this occurrence that wait for a cost another one may pay
// (rr.triggering-condition: Aragorn's ready waits for Théodred's resource).
export function responseNote(game: ScenarioState, names: SheetNames, offers: readonly { cardId: string; effectId: string; seat: number }[], listed: readonly TriggerOption[], ctx: ReduceContext, event: GameEvent | null): string {
  const seat = game.window?.kind === "response" ? game.window.seat : game.activeSeat;
  const waiting = offers.filter((offer) => offer.seat === seat && !listed.some((item) => item.cardId === offer.cardId && item.effectId === offer.effectId));
  // At the end of the round, a card that counts tokens says what the count leads to (41050:B:1).
  const leads = event?.trigger === "endOfRound" ? offers.flatMap((offer) => tokenOutcome(ctx, game.cards[offer.cardId]?.code ?? "")).slice(0, 1) : [];
  const night = nightResponseNote(game, names, event, listed.map((item) => item.cardId)) ?? framsburgResponseNote(game, ctx, names, event, listed.map((item) => item.cardId)) ?? gundabadResponseNote(game, ctx, names, event, listed.map((item) => item.cardId)) ?? fateResponseNote(game, ctx, names, event, listed.map((item) => item.cardId));
  const base = night ?? ["A Response may be used now, or passed.", ...leads].join(" ");
  if (waiting.length === 0) return base;
  // The side quest's sentence already says that passing gives it up.
  return `${base} Waiting for its cost, and offered once it can be paid: ${waiting.map((offer) => names.card(offer.cardId)).join(", ")}.${night ? "" : " Passing gives it up too."}`;
}

// What the optional engagement is against: the seat's threat, and which enemies the engagement checks engage anyway or
// leave in staging (rr.optional-engagement, rr.engagement-check).
export function optionalEngageNote(game: ScenarioState, ctx: ReduceContext, names: SheetNames): string {
  const seat = game.activeSeat;
  const rows = threatRows(game, ctx, seat);
  const threat = game.seats[seat]?.threat ?? 0;
  const anyway = rows.filter((row) => row.engagesSeat === seat).map((row) => `${names.card(row.id)} (${row.cost})`);
  const stays = rows.filter((row) => row.engagesSeat == null).map((row) => `${names.card(row.id)} (${row.cost})`);
  const parts = [`You may engage one enemy in staging. Your threat is ${threat}.`];
  if (anyway.length > 0) parts.push(`The checks engage ${anyway.join(", ")} anyway.`);
  if (stays.length > 0) parts.push(`${stays.join(", ")} ${stays.length === 1 ? "stays" : "stay"} in staging.`);
  const barred = framsburgEngageNote(game, ctx, names, seat) ?? fateEngageNote(game, ctx, names);
  if (barred) parts.push(barred);
  return parts.join(" ");
}

// What a look window shows: a shadow card dealt to an enemy, the top of a player's deck, or the top of the encounter deck.
export function lookNote(game: ScenarioState, cardIds: readonly string[], seat: number, side?: "A"): string {
  if (side === "A") return "The facedown side of a Lost Island. Nothing on it happens and it stays facedown.";
  if (cardIds.some((id) => game.cards[id]?.zone === "shadow")) return "A shadow card dealt to an enemy attacking you. Nothing moves.";
  const first = game.cards[cardIds[0] ?? ""];
  if (first?.zone === "deck") {
    const deck = game.seats[first.controller ?? seat]?.deck ?? [];
    const end = deck[0] === first.id ? "top" : "bottom";
    const count = cardIds.length;
    const cards = count > 1 ? `The ${end} ${count} cards of` : `The ${end} of`;
    return `${cards} ${first.controller === seat ? "your" : "that player's"} deck. ${switchNote(game, count) ?? "Nothing moves."}`;
  }
  const deck = game.encounterDeck;
  return `The ${deck[0] === cardIds[0] || deck.length === 0 ? "top" : "bottom"} of the encounter deck. Nothing moves.`;
}

// The Hide sheet's note, with the most characters a card lets commit ("players cannot commit more than 2 characters to a Hide test",
// 906106:A:1).
export function hideCommitNote(limit: number | null): string {
  const base = "Commit characters to the Hide test. Their willpower is compared with the threat of the cards discarded.";
  return limit == null ? base : `${base} No more than ${limit} can commit.`;
}
