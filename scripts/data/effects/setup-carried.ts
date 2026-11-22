// Which sentences of a Setup line the scenario's piles already carry out, so `pnpm effects draft` marks them and the effect author writes no record for them.
// The piles are data/overrides.json `scenarioPiles` (read in scripts/data/normalize/scenarios.ts): a card the Setup puts in the staging area, sets aside, attaches
// or moves to another pile is dealt there at the start, so a sentence that only names that move needs no record.
import type { Overrides } from "../normalize/overrides.ts";

export type PileRule = Overrides["scenarioPiles"][number];

// What a sentence says of a pile it moves a card to; a pile not listed is carried by the card's name alone.
const ACTION: Readonly<Record<string, RegExp>> = {
  staging: /staging area/i,
  setAside: /\baside\b/i,
  attached: /\battach/i,
  attachedChosen: /\battach/i,
};

/** The sentences of a printed line: a sentence ends at a full stop, "!" or "?" followed by a capital or an opening quote. */
export function sentencesOf(line: string): string[] {
  return line.split(/(?<=[.!?])\s+(?=[A-Z"“])/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

/** Whether the piles of `scenario` carry out `sentence`: it names a card the scenario's pile rules move, and says that move. */
export function carriedByPiles(sentence: string, scenario: string, rules: readonly PileRule[], nameOf: (code: string) => string): boolean {
  const text = sentence.toLowerCase();
  return rules.some((rule) => {
    if (rule.scenario !== scenario) return false;
    const name = nameOf(rule.code).toLowerCase();
    if (name === "" || !text.includes(name)) return false;
    const action = ACTION[rule.pile];
    return action === undefined || action.test(sentence);
  });
}

/** The sentences of `line` the piles carry out, and the rest. */
export function splitCarried(line: string, scenario: string, rules: readonly PileRule[], nameOf: (code: string) => string): { carried: string[]; open: string[] } {
  const carried: string[] = [];
  const open: string[] = [];
  for (const sentence of sentencesOf(line)) (carriedByPiles(sentence, scenario, rules, nameOf) ? carried : open).push(sentence);
  return { carried, open };
}
