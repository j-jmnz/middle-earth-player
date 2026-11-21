// Rules: sotm.guarding-gollum, rr.ownership-and-control, rr.first-player (data/rules/entries.json); ledger lines 02126:A:1, 02130:A:2.
import type { PrintedCard } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { giveControl } from "../play/control.ts";
import { lastPickedSeat } from "../play/refs.ts";
import type { Focus } from "../index.ts";
import { guardedGollum, guardianLocked } from "./seats.ts";

/** GuardGollum: the copy of the card in the encounter deck or set aside enters the play area of the player picked last (the first player with none), faceup and ready (sotm.guarding-gollum). */
export function guardGollum(state: ScenarioState, code: string, _focus: Focus): ScenarioState {
  if (Object.values(state.cards).some((card) => card.code === code && card.zone === "play")) return state;
  const id = [...state.setAside, ...state.encounterDeck].find((candidate) => state.cards[candidate]?.code === code);
  const seat = lastPickedSeat(state) ?? state.firstPlayer;
  if (!id || state.seats[seat]?.eliminated) return state;
  // Gollum comes from out of play, so he enters play (rr.enters-play), and the cards that hear that hear it.
  return queueEvent(updateCard(moveCard(state, id, { zone: "play", seat }), id, { face: "up", exhausted: false }), { trigger: "enteredPlay", seat, cardId: id });
}

/** ChangeGuardian: Gollum passes to the player picked last, with what is attached to him; announced as a change of control. */
export function changeGuardian(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  const gollum = guardedGollum(state);
  const seat = lastPickedSeat(state);
  if (!gollum || seat == null || guardianLocked(state)) return state;
  return giveControl(state, gollum.id, seat, cards);
}
