import type { Effect } from "../../../catalog/boundary.ts";

// Records for Mount Doom (the-return-of-the-king part 6, campaign card 146079). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. `pnpm effects draft mount-doom` writes the bundle of open lines and the effect-author agent turns it into records.
// Rules: TODO name the rule ids the records implement (data/rules/entries.json).
// TODO: wrap the list in withCopies(...) from ../reprint.ts when a card takes the records of another card's identical line.
export const AUTHORED_EFFECTS: readonly Effect[] = [];

export const AUTHORED_REPLACES: readonly string[] = [];
