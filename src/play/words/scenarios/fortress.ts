// Rules: mec112.defense (data/rules/entries.json). The words of Helm's Deep's table pieces (src/play/readouts/fortress.ts): the Defense dial's reading, what a quest with Defense would do, and what filling a stage that loses says.

/** What a screen reader hears after the Defense dial's number, where the players lose at the pursuit dial's: "at 8 the players advance to stage 5A". */
export const defenseLimitWords = (limit: number): string => `at ${limit} the players advance to stage 5A`;

/** The result line of a quest resolved now on a stage with Defense: the Threat that beats the Willpower goes to the stage as progress, and nobody's threat rises. */
export function defenseQuestResult(willpower: number, threat: number): string {
  if (willpower < threat) return `The encounter deck places ${threat - willpower} progress, not your threat`;
  return "No progress: the stage has Defense";
}

/** The line under a stage with Defense in its preview and on the advance screen. */
export const DEFENSE_STAGE = "Defense: questing places no progress. The encounter deck places the Threat that beats the Willpower on this stage, through the active location first, and no player's threat rises";

/** The line under a stage whose filling loses the game (The Wall is Breached!, 143075:B:3). */
export const STAGE_DEFEAT_LOSS = "When this stage is full the players lose";
