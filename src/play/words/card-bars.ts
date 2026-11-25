// Rules: rr.blank, rr.cannot (data/rules/entries.json).
// What the table says of a card whose text box a `blankText` modifier blanks and of a card a `cannotReadyByPlayerCard` modifier bars from readying (src/play/cards/card-effects.ts reads the engine's facts; these only say them). Any scenario's card can put either on a card.

/** The pill on a character whose text box is blank. */
export const BLANK_WORD = "Blank";

/** What stays of a blank text box, from the engine's facts: the Traits unless a modifier blanks them too, and the keywords when one keeps them (rr.blank: a text box holds its abilities, keywords and Traits). */
export type BlankKeeps = "none" | "traits" | "keywordsAndTraits";

const KEPT: Readonly<Record<BlankKeeps, string>> = {
  none: "none of its text applies",
  traits: "only its Traits stay",
  keywordsAndTraits: "only its keywords and Traits stay",
};

/** What the preview and the reader say of a card with a blank text box: the cards that blank it, each with how long, and what stays. */
export const blankWords = (sources: string, keeps: BlankKeeps): string => `Its text box is blank (${sources}): ${KEPT[keeps]}.`;

/** The line in the preview of a card player card effects cannot ready. */
export const noReadyWords = (sources: string): string => `Player card effects cannot ready it (${sources}). The refresh phase still readies it.`;
