// The two seat counts by name: one local seat (true solo) or two on the same phone (two-handed). brief: Product.
export const SEAT_WORDS = ["True solo", "Two-handed"] as const;

export type SeatWord = (typeof SEAT_WORDS)[number];

export function seatWord(seatCount: 1 | 2): SeatWord {
  return seatCount === 1 ? "True solo" : "Two-handed";
}

export function seatCountOf(word: SeatWord): 1 | 2 {
  return word === "True solo" ? 1 : 2;
}
