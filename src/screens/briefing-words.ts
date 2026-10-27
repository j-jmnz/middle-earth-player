// What the briefing's Deal bar says (docs/design-system.md, Briefing). The validator's sentences are worded for the rules, with a card's
// collector code; the bar shows them without codes, and words the missing Ring-bearer as the slot above asks for it rather than
// naming the first hero. Pure, so a test reads it.
import type { Problem } from "../campaign/briefing";
import type { Difficulty } from "../catalog/scenario-data";

// The rule name the briefing gives a missing Ring-bearer (src/campaign/briefing.ts, RULE_OF).
const NO_RING_BEARER = "A Ring-bearer is required";

/** A validator sentence as the Deal bar shows it. */
export function problemWords(problem: Problem): string {
  if (problem.rule === NO_RING_BEARER) return "Choose a Ring-bearer above: the first seat needs a Fellowship-sphere hero with the Ring-bearer trait.";
  return problem.message.replace(/ \(\d{5,6}[A-Za-z]?\)/g, "");
}

/** The sentence over Deal: the difficulty the deal uses, and what Deal does. */
export function dealSentence(difficulty: Difficulty, dropsOpen: boolean): string {
  return `${difficulty} difficulty. ${dropsOpen ? "A scenario is already open. Dealing again drops it." : "Dealing starts the scenario."}`;
}
