// The look strip of a banner beat: the cards a Discover (emce.discover) or a Track (hrd.track) lays face up under the table's veil. A beat carries the card ids it lays with a prefix (store/beat-store.ts keeps them as strings), and the keyword whose strip it is. Pure.

/** The prefix a banner beat puts on a card id to say "lay this card in the look strip" (store/beat-store.ts keeps the ids as a string). */
const LOOK_PREFIX = "look:";

/** A beat's card ids with the cards of the look strip told apart: the ids for the strip are returned without the prefix. */
export function lookIdsOf(beat: ReadonlySet<string>): readonly string[] {
  return [...beat].filter((id) => id.startsWith(LOOK_PREFIX)).map((id) => id.slice(LOOK_PREFIX.length));
}

/** The id a beat carries to name the keyword whose look strip it lays (Beneath the Sands' Track); a beat with none is a Discover's. It is no card, so no card is ringed for it. */
export const lookWordBeat = (word: string): string => `lookword:${word}`;

/** The keyword whose look strip a beat lays: `Discover` unless the beat says another. */
export function lookWordOf(beat: Iterable<string>): string {
  for (const id of beat) if (id.startsWith("lookword:")) return id.slice("lookword:".length);
  return "Discover";
}

/** The beat ids that lay these cards in the look strip. */
export function lookBeat(ids: readonly string[]): readonly string[] {
  return ids.map((id) => `${LOOK_PREFIX}${id}`);
}

/** What a screen reader hears of the strip, and the reader table's line for it. */
export function lookStripWords(count: number, word = "Discover"): string {
  return `${word} look, ${count} ${count === 1 ? "card" : "cards"} placed in the encounter discard pile`;
}
