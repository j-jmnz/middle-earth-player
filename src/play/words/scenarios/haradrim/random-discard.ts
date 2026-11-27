// The words for a card a player discards at random from their hand (Biting Insects, 17024:A:1): the log and the banner share
// the sentence. The seat is left out in a game of one player, as the other banner lines do.
export function discardedRandomWords(card: string, seat: number, seats: number): string {
  return seats > 1 ? `Player ${seat + 1} discards ${card} at random` : `Discards ${card} at random`;
}
