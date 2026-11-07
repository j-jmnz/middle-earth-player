// Rules: rr.fellowship-of-heroes, mec112.campaign-mode-aragorn (data/rules/entries.json). The hero-list arithmetic of a Two Towers Resolution, one place for the reducer's reading
// (resolution.ts) and the log's writing (src/campaign/log-two-towers.ts): a hero a boon brought back joins its player's list and leaves the fallen one, a hero a player removed leaves its list. Pure.
import type { ResolutionLog } from "../../core/campaign-state.ts";

/** A seat's hero list after the Resolution's changes: the heroes brought back to this seat join it, the heroes it removed leave it. */
export function heroesAfter(base: readonly string[], seat: number, log: Pick<ResolutionLog, "revived" | "removedHeroes">): string[] {
  const added = (log.revived ?? []).filter((item) => item.seat === seat).map((item) => item.hero);
  const gone = new Set((log.removedHeroes ?? []).filter((item) => item.seat === seat).map((item) => item.hero));
  return [...new Set([...base, ...added])].filter((hero) => !gone.has(hero));
}

/** A list of fallen heroes after the Resolution's changes: a hero brought back is on none of them. */
export function fallenAfter(fallen: readonly string[], log: Pick<ResolutionLog, "revived">): string[] {
  const back = new Set((log.revived ?? []).map((item) => item.hero));
  return fallen.filter((hero) => !back.has(hero));
}
