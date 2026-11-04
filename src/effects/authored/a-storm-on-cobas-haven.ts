import type { Effect } from "../../catalog/boundary.ts";

// Records for A Storm on Cobas Haven (dream-chaser part 8, campaign card 11209). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data:build) or another card prints
// word for word needs no record here. `pnpm effects:draft a-storm-on-cobas-haven` writes the bundle of open lines and the effect-author agent turns it into records.
// Rules: TODO name the rule ids the records implement (data/rules/entries.json).
// TODO: wrap the list in withCopies(...) from ./reprint.ts when a card takes the records of another card's identical line.
export const AUTHORED_EFFECTS: readonly Effect[] = [];

export const AUTHORED_REPLACES: readonly string[] = [];
