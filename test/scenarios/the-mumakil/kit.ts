import { expect } from "vitest";

import type { ScenarioState } from "../../../src/rules/core/state.ts";

// Test helpers of The Mûmakil's tests (no game is played here, so a test file that only needs a layout does not load the scenario).
export const MUMAK = "17015";
export const CAPTURE_CODES = ["17011", "17012", "17013", "17014"];

/** Capture objectives attached to the Wild Mûmak, faceup and controlled by nobody, as a layout's `attached` list. */
export const captures = (...codes: string[]) => codes.map((code) => ({ code, to: MUMAK, encounter: true as const }));

export const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));

/** The opening of the standalone game (17026:A:1): the four Wild Mûmak and the four Captures set aside, one different location staged for each player. */
export function expectOpening(state: ScenarioState, seatCount: number, label: string): void {
  expect(cardsOf(state, [MUMAK]).map((card) => card.zone), label).toEqual(["setAside", "setAside", "setAside", "setAside"]);
  expect(cardsOf(state, CAPTURE_CODES).map((card) => card.zone), label).toEqual(["setAside", "setAside", "setAside", "setAside"]);
  const locations = Object.values(state.cards).filter((card) => card.zone === "staging" && ["17020", "16056", "16057", "16058"].includes(card.code));
  expect(locations, label).toHaveLength(seatCount);
  expect(new Set(locations.map((card) => card.code)).size, label).toBe(seatCount);
}
