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

export const ENGINE_CHANGES: readonly EngineChange[] = [];

export const ENGINE_VERSION = 26;

/** The notes of the changes after `fromVersion`, up to the build's version, that can move a game of `scenarioId`. */
export function changesReaching(scenarioId: string, fromVersion: number, changes: readonly EngineChange[] = ENGINE_CHANGES): readonly string[] {
  return changes.filter((change) => change.version > fromVersion && change.version <= ENGINE_VERSION && (change.scenarios === "all" || change.scenarios.includes(scenarioId))).map((change) => change.note);
}
