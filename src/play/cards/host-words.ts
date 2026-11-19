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
