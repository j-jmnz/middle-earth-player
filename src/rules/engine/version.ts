// Bump ENGINE_VERSION when a change to the engine can move a game that was replayed from its intents: a rule, a verb, the shuffle, the order of ids.
// A bump adds an ENGINE_CHANGES entry for the new number: the scenarios it reaches (or "all") and one plain line for players. "all" is for a mechanic every scenario
// has (the planning phase, the Commit window, a stage held back); a change that reaches only some scenarios gets its own entry with the same version number, so
// no line names a scenario's game that it cannot move. The list holds the versions after ENGINE_CHANGES_SINCE; a game dealt on an earlier version still gets the sheet, with its generic sentence. The table's sheet for a game dealt on an earlier version lists the lines that reach its scenario, and the
// release notes name the scenarios the lines since the last release reach.

export type EngineChange = {
  version: number;
  /** The ids of the scenarios whose games the change can move, or "all". */
  scenarios: readonly string[] | "all";
  /** One sentence for a player (several entries of one version are several lines): what the rules now do, in sentence case, with no rule ids or code names. */
  note: string;
};

/** The version the list starts after: an entry is for a version above it, up to ENGINE_VERSION (src/rules/engine/version.test.ts). */
export const ENGINE_CHANGES_SINCE = 26;

export const ENGINE_CHANGES: readonly EngineChange[] = [
  { version: 27, scenarios: ["the-fate-of-wilderland"], note: "The Goblins' Assault hears the players' failed quest once, as the card prints it, with no once-a-round limit." },
  { version: 27, scenarios: ["a-storm-on-cobas-haven", "the-city-of-corsairs"], note: "The first player, not the player who revealed the card, chooses the player who searches for each Send for Help event, and who controls Gandalf." },
  { version: 27, scenarios: ["a-storm-on-cobas-haven", "the-city-of-corsairs"], note: "A card you upgraded in the campaign log is turned up on its Upgraded side when it comes out of a facedown deck, for example The Shattered Monument." },
  { version: 27, scenarios: ["the-kings-quest", "mount-gundabad"], note: "A Deep location that its own Response sends to the victory display, like Forked Passage, is still replaced by the top card of the Caves deck." },
  { version: 27, scenarios: ["the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"], note: "Command (Spirit) can put the campaign's own Spyglass from outside the game into play, on its Upgraded side when its boxes are marked, while no Spyglass is in play." },
  { version: 27, scenarios: ["the-passing-of-the-grey-company", "the-siege-of-gondor", "the-black-gate-opens"], note: "Raising each player's threat to search for Andúril happens after the starting threat level is set, so the threat floor no longer includes that raise." },
  { version: 28, scenarios: ["the-caves-of-nibin-dum"], note: "A quest stage that prints 0 quest points is no longer completed in the same quest phase that reveals it: its When Revealed effects resolve first." },
];

export const ENGINE_VERSION = 28;

/** The notes of the changes after `fromVersion`, up to the build's version, that can move a game of `scenarioId`. */
export function changesReaching(scenarioId: string, fromVersion: number, changes: readonly EngineChange[] = ENGINE_CHANGES): readonly string[] {
  return changes.filter((change) => change.version > fromVersion && change.version <= ENGINE_VERSION && (change.scenarios === "all" || change.scenarios.includes(scenarioId))).map((change) => change.note);
}
