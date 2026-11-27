// Rules: rr.attachment-cards, rr.engaged, rr.response (data/rules/entries.json); ledger lines 17027:A:1, 17011:A:1, 17012:A:1, 17013:A:1, 17014:A:1.
// What the table says of The Mûmakil's Capture objectives: where a Capture was attached, and, on the row of its Response, where its Mûmak stands and what the engine's numbers ask of the test. The engine decided each fact; these only say it.
import type { EngineStep } from "../../../../rules/core/intents.ts";

import { capturedStepWords } from "./captured-table.ts";

/** Where a Wild Mûmak stands: in the staging area, or engaged with a player ("engaged with Player 1"; `seat` null is the staging area). */
export const mumakPlace = (seat: number | null, seatCount: number): string => (seat == null ? "in the staging area" : seatCount > 1 ? `engaged with Player ${seat + 1}` : "engaged with you");

/** The same place as the log tells it: the log names a player as "Player N" in every game, so a solo game says "engaged with Player 1" too. */
export const mumakLogPlace = (seat: number | null): string => mumakPlace(seat, 2);

/** The banner and log line of a random Capture attached to a Mûmak (17027:A:1); `place` is the Mûmak's place in the form of the line's reader (`mumakPlace`, `mumakLogPlace`). */
export const captureAttachedLine = (capture: string, host: string, place: string): string => `${capture} is attached to ${host}, ${place}.`;

/** The row of a Capture's Response: the Capture on its Mûmak, and where the Mûmak stands. */
export const captureRowLabel = (capture: string, host: string, seat: number | null, seatCount: number): string => `${capture} · on ${host} ${mumakPlace(seat, seatCount)}`;

/** What each Capture asks of its test, from the Mûmak's remaining hit points the engine read: the Lasso's cost, the Spear's and the Pit Trap's Threat, the Noose's defender. */
const ASKED: Readonly<Record<string, (left: number) => string>> = {
  "17011": (left) => `A card that costs ${left} or more captures it.`,
  "17012": (left) => `An encounter card with ${left} or more Threat captures it.`,
  "17013": (left) => `A location with ${left} or more Threat captures it.`,
  "17014": (left) => `A defender with more than ${left} hit points left captures it.`,
};

/** The line under a Capture's Response: the Mûmak's hit points left, and the number that captures it. Null for a card that is no Capture. */
export function captureNumbers(code: string, host: string, left: number): string | null {
  const asked = ASKED[code];
  return asked ? `${host} has ${left} hit points left. ${asked(left)}` : null;
}

/** The banner and log line of a claimed objective (`claim` step): the objective is claimed and attached to the hero, with the player when more than one plays ("Banner of the Serpent is claimed: attached to Aragorn, Player 1"). */
export const claimLine = (objective: string, hero: string, seat: number, seatCount: number): string => `${objective} is claimed: attached to ${hero}${seatCount > 1 ? `, Player ${seat + 1}` : ""}.`;

/** The line of an `attachDrawn`, `claim` or `captive` step: where a Capture was attached, which hero holds the objective, or who a captive is held by or freed to. `seats` is 2 for the log, which names a player as "Player N" in every game. */
export function attachedWords(step: Extract<EngineStep, { kind: "attachDrawn" | "claim" | "captive" }>, name: (id: string) => string, seats: number): string {
  if (step.kind === "captive") return capturedStepWords(step, name(step.cardId), name(step.hostId), seats);
  return step.kind === "claim" ? claimLine(name(step.cardId), name(step.heroId), step.seat, seats) : captureAttachedLine(name(step.cardId), name(step.hostId), mumakPlace(step.seat, seats));
}
