// Rules: rr.in-play-and-out-of-play (data/rules/entries.json). The seeded draw of one set-aside card, shared by the verbs that pick a random card among those set aside (RandomSetAside, AttachRandomSetAside, RevealRandomSetAside, ShuffleRandomSetAside, EngageRandomSetAside).
import { nextUint } from "./seed.ts";
import type { ScenarioState } from "./state.ts";

/**
 * The id of one set-aside card for which `matches` holds, drawn by the game seed: the matching ids in id order (so one seed always picks the same card), one step of the seed. Undefined when none matches. The caller advances `seedCursor` when it uses the card.
 * What the card does next (revealed, attached, left facedown) is the caller's, and so is whether the players see which one it was (the set-aside sites check).
 */
export function drawRandomSetAside(state: ScenarioState, matches: (id: string) => boolean): string | undefined {
  const ids = state.setAside.filter(matches).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return ids[nextUint(state.seed, state.seedCursor) % Math.max(ids.length, 1)];
}
