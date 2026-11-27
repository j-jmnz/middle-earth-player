// Rules: rr.in-play-and-out-of-play (data/rules/entries.json). The seeded draw of one set-aside card, shared by the verbs that pick a random card among those set aside (RandomSetAside, AttachRandomSetAside, RevealRandomSetAside, ShuffleRandomSetAside, EngageRandomSetAside).
import { printedOf, type PrintedCard } from "./printed.ts";
import { nextUint } from "./seed.ts";
import type { ScenarioState } from "./state.ts";

/** Ids in id order, numbers by their value ("i9" before "i10"): the order a seed picks among, so one seed always picks the same card. */
export const byId = (left: string, right: string): number => left.localeCompare(right, undefined, { numeric: true });

/** The ids of cards that print `trait`, for `drawRandomSetAside` (AttachRandomSetAside, RevealRandomSetAside). */
export const withTrait = (state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, trait: string) => (id: string): boolean => printedOf(cards, state.cards[id]?.code ?? "").traits.includes(trait);

/**
 * The id of one set-aside card for which `matches` holds, drawn by the game seed: the matching ids in id order (so one seed always picks the same card), one step of the seed. Undefined when none matches. The caller advances `seedCursor` when it uses the card.
 * What the card does next (revealed, attached, left facedown) is the caller's, and so is whether the players see which one it was (the set-aside sites check).
 */
export function drawRandomSetAside(state: ScenarioState, matches: (id: string) => boolean): string | undefined {
  const ids = state.setAside.filter(matches).sort(byId);
  return ids[nextUint(state.seed, state.seedCursor) % Math.max(ids.length, 1)];
}
