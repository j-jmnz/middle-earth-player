// Rules: rr.quest-advancement, hrd.orcs-area, rr.victory (data/rules/entries.json). The banner groups of a moment that no engine step tells, read from the two states of an intent: the cards an Underworld location took (The Steward's Fear),
// the Orcs' advance (Race Across Harad) and a player's return from stage 4B to stage 3B (Fog on the Barrow-downs). Pure; momentOf (store/outcome.ts) adds them to the groups its steps made.
import type { ScenarioState } from "../../rules/core/state.ts";

import { orcsBeats } from "../readouts/haradrim/orcs.ts";
import { returnLines } from "../readouts/standalone-scenarios/barrow-downs.ts";
import { BACK_TITLE } from "../readouts/standalone-scenarios/barrow-downs-words.ts";
import { stackTakes } from "../readouts/against-the-shadow/stewards-fear.ts";
import { UNDERWORLD_TITLE } from "../words/scenarios/against-the-shadow/stewards-fear.ts";

type PlainLine = { text: string; mark: null };

/** A banner group: `firm` keeps its lines whole when the banner cuts the others'. */
export type StateGroup = { rank: number; title: string; tone: "good" | "bad" | "plain"; lines: PlainLine[]; firm?: true };

const plain = (texts: readonly string[]): PlainLine[] => texts.map((text) => ({ text, mark: null }));

/** The groups the two states tell: the Underworld's takes (rank 9), the Orcs' advance (rank 1, firm: it says the stage and the loss it can bring, so the cut never hides it) and a return to stage 3B (rank 1). */
export function stateBeats(before: ScenarioState, after: ScenarioState, nameOf: (cardId: string) => string): StateGroup[] {
  const groups: StateGroup[] = [];
  const takes = stackTakes(before, after, nameOf);
  if (takes.length > 0) groups.push({ rank: 9, title: UNDERWORLD_TITLE, tone: "plain", lines: plain(takes) });
  for (const beat of orcsBeats(before, after, nameOf)) groups.push({ ...beat, lines: plain(beat.lines), firm: true });
  for (const text of returnLines(before, after, nameOf)) groups.push({ rank: 1, title: BACK_TITLE, tone: "good", lines: plain([text]) });
  return groups;
}
