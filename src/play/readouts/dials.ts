// The shape every scenario's extra top-bar dial shares (The Road to Isengard's readouts/isengard.ts, The Passage of the Marshes' readouts/marshes.ts) and what the top bar hands the ThreatRing for one. The engine decided each number; nothing here changes one. Pure, so a test reads it.
import { useMemo } from "react";

import { inPlay, type ScenarioState } from "../../rules/core/state.ts";

/** One dial of the top bar: its label, what a screen reader calls it, its number, and what it counts toward. `goal`: the limit is the players' way out (the ring fills in the accent, never warms). `warms`: the limit loses or discards, so the ring warms toward it as the pursuit dial does. `warn`: the dial's own level and words (a last card, one mire token from a discard). `filled`: the number the ring fills with when it is not the disc's (the gate's damage). */
/** One headed list of names in a dial's panel. */
export type DialList = { heading: string; lines: readonly string[] };

export type TableDial = {
  id: string;
  // The dial's test id when it is not `isengard-<id>` (The Passage of the Marshes' dials).
  testID?: string;
  label: string;
  name: string;
  value: number;
  limit?: number;
  filled?: number;
  goal?: true;
  warms?: true;
  warn?: { level: "near" | "critical"; words: string };
  limitWords?: string;
  note?: string;
  // The disc says this word in place of the number (the Day and Night dial: "Day"); the number only tells the dial that it changed.
  word?: string;
  // The card a tap on the dial shows large (the Night objective's, Derufin's): absent, the dial does nothing.
  cardId?: string;
  // Cards a tap shows after that card, in the same preview (the staging cards of a stage no player is at): absent, the card alone.
  extra?: readonly string[];
  // The lists a tap on the dial reads in a panel (the Investigation List's checked off and not checked off names): absent, the dial opens none. `said` is what a screen reader hears of the panel.
  lists?: readonly DialList[];
  said?: string;
  // The line at the foot of that panel.
  foot?: string;
  // The pile a tap on the dial opens, as its list (the victory display's, on The Old Forest's stage 2): absent, the dial does nothing.
  pile?: string;
};

/** The cards of a code that are in play (the staging area, the active location, a play area): what a scenario's dial reads its tokens from. */
export const cardsOf = (game: ScenarioState, code: string) => Object.values(game.cards).filter((card) => card.code === code && inPlay(card.zone));

/** The ThreatRing props one dial gets: only a `warms` dial counts toward an elimination-like limit; a goal dial never warms. */
export function dialProps(dial: TableDial) {
  return {
    threat: { seat: 0, threat: dial.value, eliminated: false },
    label: dial.label,
    accessibilityName: dial.name,
    testID: dial.testID ?? `isengard-${dial.id}`,
    icon: null,
    elimination: dial.warms === true,
    limit: dial.limit,
    filled: dial.filled,
    limitWords: dial.limitWords,
    goal: dial.goal,
    warn: dial.warn,
    note: dial.note,
    word: dial.word,
    hint: dial.cardId ? (dial.extra && dial.extra.length > 0 ? "Shows the stage and its cards" : "Shows the card") : dial.pile ? "Shows the cards" : undefined,
  } as const;
}

/** The same list while no dial's words or number changed, so the bar re-renders only when a token, a hit point or a card moves. */
export function useStableDials(dials: readonly TableDial[]): readonly TableDial[] {
  const key = JSON.stringify(dials);
  return useMemo((): readonly TableDial[] => JSON.parse(key), [key]);
}
