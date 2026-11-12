// What the engine's routes need to know about a verb, which the verb's own schema entry says through `verbFlags(schema, flags)` (zod's `.meta()`), so a new verb joins a list in its family file and no
// list in the engine grows beside it. The sets are read off the schemas in verb-sets.ts and pinned in verb-sets.test.ts.
import { z } from "zod";

// Whether a quest card's Setup record is run in a frame of its own after the deal (src/rules/families/quest/setup.ts revealsPerPlayer), a record the scenario's piles cannot place:
// - "top": the record runs when one of its top-level instructions is this verb.
// - "inForEachPlayer", "inEach": the record runs when a top-level ForEachPlayer (or Each) holds this verb. Alone, the verb is placed by the piles or runs nowhere in Setup. The suffix names the wrapper verb.
// - "inChoose": the record runs when a top-level Choose has an option that holds this verb (the players choose how the Setup goes on, 143072:A:1).
export type SetupRuns = "top" | "inForEachPlayer" | "inEach" | "inChoose";

// What a record that names the verb needs from the player's collection (src/campaign/world.ts loadWorld):
// - "hero": it chooses a hero card of the collection, so every deck-legal hero is loaded.
// - "card": it takes the card with its `code` from the collection, so that code is loaded whether or not the scenario deals it.
// - "treasure": it draws from the treasures of the catalog, so every treasure card is loaded (Ered Mithrin, emce.treasure).
export type CollectionUse = "hero" | "card" | "treasure";

// Which of a campaign card's Setup verbs the scenario's start handles itself (src/campaign/start.ts):
// - "dealt": the engine runs it in Setup, in the campaign card's printed order, before the quest card's Setup (the Fellowship's two verbs, an objective ally put into play, a card set aside).
// - "afterSetup": it names the ships or cards the quest card's Setup prepares, so it resolves in a frame after it (ScenarioDefinition.afterSetup).
// - "beforeReveal": it resolves in a frame after the quest card's Setup and before its side B's When Revealed (ScenarioDefinition.beforeReveal): Escape from Mount Gram's campaign Setup captures cards from the decks the quest card's Setup prepared, before stage 2A captures.
export type SetupRole = "dealt" | "afterSetup" | "beforeReveal";

export interface VerbFlags {
  // A Shadow effect with this verb at its top level runs in a frame (src/rules/combat/shadow.ts runsInFrame): only a frame asks a player, expands a Repeat or an Each, or waits for the effects the verb pushes.
  runsInFrame?: true;
  setupRuns?: SetupRuns;
  setupRole?: SetupRole;
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
  if (meta?.setupRuns === "top" || meta?.setupRuns === "inForEachPlayer" || meta?.setupRuns === "inEach" || meta?.setupRuns === "inChoose") flags.setupRuns = meta.setupRuns;
  if (meta?.setupRole === "dealt" || meta?.setupRole === "afterSetup" || meta?.setupRole === "beforeReveal") flags.setupRole = meta.setupRole;
  if (meta?.collection === "hero" || meta?.collection === "card" || meta?.collection === "treasure") flags.collection = meta.collection;
  return flags;
}
