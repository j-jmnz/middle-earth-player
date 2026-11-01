// Rules: dcce.uncharted, dcce.uncharted-deck, dcce.island-map (data/rules/entries.json). The uncharted family's state, types only; state.ts holds it as `uncharted`.

// The Uncharted deck (top card first) and the codes of the double-sided locations that are shuffled back into it when they would be discarded. Present only in a game that deals an Uncharted deck.
// `island`: the Island Map a Setup laid out of the dealt locations (families/island-map.ts).
export type UnchartedState = { deck: readonly string[]; codes: readonly string[]; island?: IslandState };

// The Island Map (dcce.island-map): the fifteen locations in a grid of three rows by five columns, row by row from the top left, and the last travel on it (the cells it left and reached), which "when you
// travel to the right" reads until the next one, and the cells the players have traveled from, which are explored (dcce.exploration); a cell flipped over and never left (the second corner) is only revealed.
export type IslandState = { cells: readonly string[]; moved?: { from: string; to: string }; explored?: readonly string[] };
