// Whose a seat's card is, in words: shared by the scenarios that name an owner (The Tower of Cirith Ungol, The Black Gate Opens, the dungeon previews). Pure.

/** Whose a seat's card is, lower case for the middle of a sentence: "Player 2's" two-handed, "your" solo ("yours" as a noun, in a list). Null when the card has no owner. */
export function ownerWords(seatCount: number, seat: number, noun?: boolean): string;
export function ownerWords(seatCount: number, seat: number | null | undefined, noun?: boolean): string | null;
export function ownerWords(seatCount: number, seat: number | null | undefined, noun?: boolean): string | null {
  if (seat == null) return null;
  return seatCount > 1 ? `Player ${seat + 1}'s` : noun === true ? "yours" : "your";
}
