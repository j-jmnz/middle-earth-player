// Rules: dcce.uncharted, dcce.uncharted-deck (data/rules/entries.json). The uncharted family's state, types only; state.ts holds it as `uncharted`.

// The Uncharted deck (top card first) and the codes of the double-sided locations that are shuffled back into it when they would be discarded. Present only in a game that
// deals an Uncharted deck.
export type UnchartedState = { deck: readonly string[]; codes: readonly string[] };
