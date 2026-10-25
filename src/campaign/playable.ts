// The scenarios whose dealt cards have an effect record for every printed line (the effect coverage test keeps
// this list honest both ways). Campaign-dealt cards have no inactive-text path, so a scenario not listed here is not
// dealt as a standalone game. Scenarios 3 to 6 join as phases 13 to 16 write their records.
export const PLAYABLE_SCENARIOS: readonly string[] = ["a-shadow-of-the-past", "a-knife-in-the-dark"];

export function isPlayable(scenarioId: string): boolean {
  return PLAYABLE_SCENARIOS.includes(scenarioId);
}
