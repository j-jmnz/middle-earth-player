// The words for a card a player discards at random from their hand (Biting Insects, 17024:A:1): the log and the banner share
// the sentence. `who` names the player; it is null in a game of one player, as the other banner lines leave it out.
export function discardedRandomWords(card: string, who: string | null): string {
  return who ? `${who} discards ${card} at random` : `Discards ${card} at random`;
}
