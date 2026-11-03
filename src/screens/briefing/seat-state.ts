// What a briefing seat's folded header says (docs/design-system.md, Briefing): the picked deck's state in words, and whether the seat
// needs the player before the deal, in which case it opens whatever its stored fold. Pure, so a test reads it.
import type { StarterSeed } from "../deck/starter-decks";

export type SeatStateInput = {
  seeded: StarterSeed;
  // The picked deck, or null; `heroes` are its hero codes.
  deck: { id: string; heroes: readonly string[] } | null;
  fallen: readonly string[];
  readiness: ReadonlyMap<string, { ready: boolean; text: string }>;
  // The deck's short line ("47 of 50 cards"), or null when it is whole.
  short: string | null;
  // The seat carries the Ring-bearer slot and none is picked.
  missingRingBearer: boolean;
};

export type SeatState = { text: string; attention: boolean };

/** A picked deck is ready when none of its heroes fell and its own readiness says so. */
export function pickedReady(input: Pick<SeatStateInput, "deck" | "fallen" | "readiness">): boolean {
  const { deck, fallen, readiness } = input;
  if (!deck) return false;
  if (fallen.some((code) => deck.heroes.includes(code))) return false;
  return readiness.get(deck.id)?.ready ?? false;
}

export function seatState(input: SeatStateInput): SeatState {
  const { seeded, deck, readiness, short, missingRingBearer } = input;
  if (seeded === "pending") return { text: "Loading", attention: false };
  if (!deck) return { text: "No deck yet", attention: true };
  if (!pickedReady(input)) return { text: readiness.get(deck.id)?.text ?? "Not ready", attention: true };
  if (missingRingBearer) return { text: "Needs a Ring-bearer", attention: true };
  return { text: short ?? "Ready", attention: false };
}

/** Whether the seat's body shows: a seat that needs the player opens whatever it was folded to. */
export function seatFolded(stored: boolean, state: SeatState): boolean {
  return stored && !state.attention;
}
