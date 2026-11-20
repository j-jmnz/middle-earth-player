// Rules: docs/brief.md (Murder at the Prancing Pony, reading 23 and The table); ledger lines 50701:A:1, 50702:B:2. The words of the Investigation List dial (pony.ts beside it). Pure.

const RULE = "A name is checked off once a look showed its card or it is in play, in the victory display or in the discard pile.";

/** The panel's last line: when a name is checked off. */
export const listRuleWords = (): string => RULE;

/** What a tap on the dial says: the names the players have checked off and the names left, by kind. Only names the players have seen are checked off; the rest stay in one list, with no sign of which card is hidden or in the Investigation deck. */
export const listWords = (checked: readonly string[], unchecked: readonly string[]): string =>
  `The Investigation List names 5 Suspects and 5 Hideouts. Checked off: ${checked.length > 0 ? checked.join(", ") : "none"}. Not checked off: ${unchecked.length > 0 ? unchecked.join(", ") : "none"}. ${RULE}`;

export const listLimitWords = (): string => "names on the Investigation List";
