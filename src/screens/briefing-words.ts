// What the briefing's Deal bar says (docs/design-system.md, Briefing). The validator's sentences are worded for the rules, with a card's
// collector code; the bar shows them without codes, and words the missing Ring-bearer as the seat that needs one rather than
// naming the first hero. Pure, so a test reads it.
import type { Problem } from "../campaign/briefing";
import { COUNSEL } from "../play/aflame-words";
import { ruleSource } from "./rules-glossary";

// The rule name the briefing gives a missing Ring-bearer (src/campaign/briefing.ts, RULE_OF).
const NO_RING_BEARER = "A Ring-bearer is required";

/** A validator sentence as the Deal bar shows it. */
export function problemWords(problem: Problem): string {
  if (problem.rule === NO_RING_BEARER) return "Seat 1 needs a Ring-bearer.";
  // A collector code goes; a rule span id ("mec109.the-fellowship-sphere") becomes the book and page a player can open.
  return problem.message.replace(/ \(\d{5,6}[A-Za-z]?\)/g, "").replace(/\(([a-z0-9-]+\.[a-z0-9-]+)\)/g, (whole, id: string) => {
    const source = ruleSource(id);
    return source ? `(${source})` : whole;
  });
}

/** The sentence over Deal: only a warning, that Deal drops the scenario already open; null when Deal just starts one. */
export function dealSentence(dropsOpen: boolean): string | null {
  return dropsOpen ? "A scenario is already open. Dealing again drops it." : null;
}

/** The Action line of a card's printed text ("Action: Choose and discard 3 cards ..."), or null when it has none. */
export function actionLine(text: string | null | undefined): string | null {
  return text?.split("\n").find((line) => line.startsWith("Action:")) ?? null;
}

/**
 * What a campaign card's Setup choice says at the briefing: the sentence under "Seat N chooses" and the line the Deal bar gives while the choice
 * is unanswered. The Oath's choice (41050:A:2) is of Adaptation boons, which join the Campaign Pool; any other choice is a card.
 */
export function needWords(seat: number, options: readonly string[], traitsOf: (code: string) => readonly string[], nameOf?: (code: string) => string): { intro: string | null; waiting: string } {
  const codes = options.filter((option) => option !== "skip").map((option) => option.split(">")[0] ?? "");
  const adaptation = codes.length > 0 && codes.every((code) => traitsOf(code).includes("Adaptation"));
  // Raid on the Grey Havens (11182:A:2): each player may take one Galdor's Counsel into hand; it joins the Campaign Pool only if the scenario is won.
  const counsel = codes.length > 0 && nameOf != null && codes.every((code) => nameOf(code) === COUNSEL);
  return {
    intro: adaptation ? "Choose 1 Adaptation boon and the hero who carries it. It joins your Campaign Pool." : counsel ? `Choose 1 ${COUNSEL} to add to your hand, or skip. It joins your Campaign Pool if you win the scenario.` : null,
    waiting: `Choose ${adaptation ? "an Adaptation" : counsel ? COUNSEL : "a card"} for seat ${seat + 1} above.`,
  };
}

