// An attachment's host that is not a card, in words (src/rules/families/attachments/play.ts): the staging area (`staging`) and a seat's play area (`seat:N`).
// `null` for a card id. `sentence` is the form read inside a sentence ("on the staging area"), the other heads a list row.
export function pseudoHostWords(id: string, sentence: boolean): string | null {
  if (id === "staging") return sentence ? "the staging area" : "The staging area";
  if (id.startsWith("seat:")) return `Player ${Number(id.slice(5)) + 1}`;
  return null;
}

/** The host's name for a sentence: its card name, or the words of a host that is not a card. */
export function hostName(card: (cardId: string) => string, id: string): string {
  return pseudoHostWords(id, true) ?? card(id);
}

/** What a card is played into, as the record's `PlayInto.into` prints it (src/rules/families/attachments/play.ts); a card with no such record has none. */
export type PlayInto = "staging" | "playArea" | "threatDial" | undefined;

/**
 * The words of playing a card on a host, in the printed verb: "Play Sting into the staging area", "Play X into your play area" (a one-seat game; "into Player 2's play area" with two seats),
 * "Attach X to Player 2" for a threat dial and "Attach X to Gandalf" for a card. `past` gives the banner's form ("Played Sting into the staging area", "Played X on Player 2's threat dial", "Played X on Gandalf").
 */
export function playWords(name: string, hostName: string, hostId: string, into: PlayInto, seatCount: number, past: boolean): string {
  const seat = hostId.startsWith("seat:") ? Number(hostId.slice(5)) : -1;
  if (hostId === "staging") return `${past ? "Played" : "Play"} ${name} into the staging area`;
  if (seat >= 0 && into !== "threatDial") return `${past ? "Played" : "Play"} ${name} into ${seatCount > 1 ? `Player ${seat + 1}'s` : "your"} play area`;
  if (seat >= 0) return past ? `Played ${name} on ${seatCount > 1 ? `Player ${seat + 1}'s` : "your"} threat dial` : `Attach ${name} to ${seatCount > 1 ? `Player ${seat + 1}` : "your threat dial"}`;
  return past ? `Played ${name} on ${hostName}` : `Attach ${name} to ${hostName}`;
}
