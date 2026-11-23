// Rules: hob.burgle, rr.modifiers (data/rules/entries.json); ledger lines 132040:A:3, 132043:A:1. The words of The Lonely Mountain's dials (readouts/the-hobbit/mountain.ts): each says the number the table holds and what it does. Pure.

const cards = (count: number): string => `${count} treasure card${count === 1 ? "" : "s"}`;

/** The stack under The Lonely Mountain: how many of the five treasure cards remain, and what that does to its Threat. */
export function stackWords(name: string, under: number, all: number, threat: number, printed: number): string {
  if (under === 0) return `No treasure card lies under ${name}: its Threat is ${threat} (${printed} printed) and a player card can affect it`;
  return `${cards(under)} of the ${all} lie facedown under ${name}. Each lowers its Threat by 2: it is ${threat} now (${printed} printed). The top one is the prize of a successful burgle attempt at The Burglar's Turn`;
}

/** What a screen reader hears of the stack's 5: the number the Setup stacks, not a loss. */
export const stackLimitWords = (all: number): string => `The Setup stacks ${all} treasure cards`;

/** The progress on Smaug the Golden against the 6th: the limit's words say what the 6th does, so the dial has no note. */
export const goldenLimitWords = (limit: number): string => `At ${limit} progress the players advance to stage 4A`;
export const goldenNearWords = (left: number): string => (left === 1 ? "1 more progress advances the players to stage 4A" : `${left} more progress advance the players to stage 4A`);
