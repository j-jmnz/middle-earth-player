// Rules: mec112.defense (data/rules/entries.json); ledger line 143045:A:2. The words of Helm's Deep's table pieces (src/play/readouts/fortress.ts): the Defense dial's reading, what a quest with Defense would do, and what filling a stage says.
import type { Instruction } from "../../../catalog/boundary.ts";

/** What a stage with Defense does when the quest resolves now and its progress fills it (found on a copy by `defenseOutcome`, readouts/fortress.ts). */
export type DefenseOutcome = {
  /** What the stage's filling does: nothing yet, the players lose (a stage whose defeat loses), or the quest advances to stage `stage` (1-based). */
  fills: "nothing" | "loses" | { advancesTo: number };
  /** The first player reveals an encounter card because the encounter deck placed no progress on the stage (143074:B:2). */
  reveals: boolean;
};

/** What a screen reader hears after a goal dial's number: how many more the stage or objective still needs, and where the players go ("2 more and the players advance to stage 5"). Helm's Deep's Defense dial and The Road to Isengard's Damage dial. */
export const advanceLimitWords = (value: number, limit: number, destination: string): string => `${Math.max(0, limit - value)} more and the players advance to ${destination}`;

/** The Defense dial's words: the stage the objective's record advances to. */
export const defenseLimitWords = (value: number, limit: number, stage: number): string => advanceLimitWords(value, limit, `stage ${stage}`);

function outcomeWords(outcome: DefenseOutcome): string {
  const fills = outcome.fills === "nothing" ? "" : `; the stage fills: ${outcome.fills === "loses" ? "the players lose" : `advance to stage ${outcome.fills.advancesTo}`}`;
  return `${fills}${outcome.reveals ? "; the first player reveals 1 encounter card" : ""}`;
}

/** The result line of a quest resolved now on a stage with Defense: the Threat that beats the Willpower goes to the stage as progress, nobody's threat rises, and what that does to the stage. */
export function defenseQuestResult(willpower: number, threat: number, outcome: DefenseOutcome): string {
  const placed = willpower < threat ? `The encounter deck places ${threat - willpower} progress, not your threat` : "The encounter deck places no progress";
  return `${placed}${outcomeWords(outcome)}`;
}

/** The line under a stage with Defense in its preview and on the advance screen. */
export const DEFENSE_STAGE = "Defense: the Threat that beats the Willpower goes on this stage as progress; no threat rises";

/** What a stage's progress does when it is full, on the screen that tells the advance to it and in its preview: "The players lose at 8 progress" (a stage whose defeat loses, 143075:B:3), "The encounter deck advances it at 8 progress" (a stage with Defense). */
export const defenseFillsWords = (points: number, loses: boolean): string => (loses ? `The players lose at ${points} progress` : `The encounter deck advances it at ${points} progress`);

/** One of the fortress family's verbs in words for a choice's branch ("remove 1 resource token from The Defense of Helm's Deep"), or null when the instruction is not one of them. */
export function fortressWords(instruction: Instruction, nameOf: (code: string) => string): string | null {
  if (instruction.verb !== "RemoveResourceTokens") return null;
  const amount = typeof instruction.amount === "number" ? instruction.amount : 1;
  return `remove ${amount} resource token${amount === 1 ? "" : "s"} from ${instruction.code != null ? nameOf(instruction.code) : "the chosen card"}`;
}
