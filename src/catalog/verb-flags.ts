// What the engine's routes need to know about a verb, which the verb's own schema entry says through `verbFlags(schema, flags)` (zod's `.meta()`), so a new verb joins a list in its family file and no
// list in the engine grows beside it (setup-role.ts does the same for a campaign card's Setup). The sets are read off the schemas in verb-sets.ts and pinned in verb-sets.test.ts.
import { z } from "zod";

// Whether a quest card's Setup record is run in a frame of its own after the deal (src/rules/families/quest/setup.ts revealsPerPlayer), a record the scenario's piles cannot place:
// - "top": the record runs when one of its top-level instructions is this verb.
// - "inForEachPlayer", "inEach": the record runs when a top-level ForEachPlayer (or Each) holds this verb. Alone, the verb is placed by the piles or runs nowhere in Setup. The suffix names the wrapper verb.
export type SetupRuns = "top" | "inForEachPlayer" | "inEach";

// What a record that names the verb needs from the player's collection (src/campaign/world.ts loadWorld):
// - "hero": it chooses a hero card of the collection, so every deck-legal hero is loaded.
// - "card": it takes the card with its `code` from the collection, so that code is loaded whether or not the scenario deals it.
export type CollectionUse = "hero" | "card";

export interface VerbFlags {
  // A Shadow effect with this verb at its top level runs in a frame (src/rules/combat/shadow.ts runsInFrame): only a frame asks a player, expands a Repeat or an Each, or waits for the effects the verb pushes.
  runsInFrame?: true;
  setupRuns?: SetupRuns;
  collection?: CollectionUse;
}

/** Marks a verb's schema entry with the routes it takes. Keeps the flags it already carries. Returns the same schema type. */
export function verbFlags<Schema extends z.ZodType>(schema: Schema, flags: VerbFlags): Schema {
  return schema.meta({ ...z.globalRegistry.get(schema), ...flags });
}

/** The flags a verb's schema entry carries. */
export function verbFlagsOf(schema: z.ZodType): VerbFlags {
  const meta = z.globalRegistry.get(schema);
  const flags: VerbFlags = {};
  if (meta?.runsInFrame === true) flags.runsInFrame = true;
  if (meta?.setupRuns === "top" || meta?.setupRuns === "inForEachPlayer" || meta?.setupRuns === "inEach") flags.setupRuns = meta.setupRuns;
  if (meta?.collection === "hero" || meta?.collection === "card") flags.collection = meta.collection;
  return flags;
}
