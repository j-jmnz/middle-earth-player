import type { Effect } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as PELENNOR } from "./the-battle-of-the-pelennor-fields.ts";
import { AUTHORED_EFFECTS as SIEGE } from "./the-siege-of-gondor.ts";
import { AUTHORED_EFFECTS as CITY } from "../the-city-of-corsairs.ts";
import { withCopies } from "../reprint.ts";
import { ENEMY_RECORDS } from "./mount-doom/enemies.ts";
import { LOCATION_RECORDS } from "./mount-doom/locations.ts";
import { STAGE_RECORDS } from "./mount-doom/stages.ts";

// Records for Mount Doom (the-return-of-the-king part 6, campaign card 146079, whose Setup, Forced and Resolution records are in the-return-of-the-king.ts): the locations (mount-doom/locations.ts), the enemies and treacheries (mount-doom/enemies.ts) and the quest stages (mount-doom/stages.ts);
// the Fortitude test, the first treachery of each quest phase and the rest of the vocabulary are the mount-doom family's (src/catalog/families/mount-doom.ts). Every line is read from the scan ledger (data/printed/the-return-of-the-king.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests, mec113.dire (data/rules/entries.json).
export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([...LOCATION_RECORDS, ...ENEMY_RECORDS, ...STAGE_RECORDS], { pool: [...PELENNOR, ...SIEGE, ...CITY] });

export const AUTHORED_REPLACES: readonly string[] = [];
