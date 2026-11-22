// Rules: rr.triggered-ability, rr.running-out-of-cards, rr.initiating-abilities-playing-cards (data/rules/entries.json).
// The idle checks of the deck family's verbs (src/rules/player/potential.ts, Whether an ability could change the game): a discard from an empty deck changes nothing,
// and a PlayFrom makes the cards the steps after it read, the ones of its pick the seat could play now.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { IdleCardsHook, IdleHook } from "../../interpret/family-manifest.ts";
import { candidatesOf } from "../../player/idle-reads.ts";
import { playableFrom } from "./play.ts";

export const deckIdle: IdleHook = (state, instruction, _sourceId, frame) => {
  if (instruction.verb !== "DiscardFromDeck") return null;
  return (state.seats[frame.seat]?.deck.length ?? 0) === 0;
};

type PlayFrom = Extract<Instruction, { verb: "PlayFrom" }>;

// A PlayFrom that names its card (`card`) is the engine's own step: the table does not settle it.
export const deckIdleCards: IdleCardsHook = (state, instruction, sourceId, frame, ctx) => {
  if (instruction.verb !== "PlayFrom") return null;
  const playFrom: PlayFrom = instruction;
  if (playFrom.card != null) return null;
  return candidatesOf(state, playFrom.pick, sourceId, frame, ctx).filter((id) => playableFrom(state, id, playFrom, frame.seat, ctx));
};
