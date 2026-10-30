// The pure parts of the two hubs (docs/design-system.md, Campaigns (campaign list) and Scenarios): which run is the hero, which
// scenarios wait under Coming later, and the words over a hero's next stop. hub-parts.tsx draws them.
import type { NextStep, PathNode } from "../campaign/path";
import type { Box } from "./campaign-data";

/** The hub's hero and the runs under it: the first unfinished run in list order, and the other unfinished runs after it. */
export function splitRuns<T>(runs: readonly T[], unfinished: (run: T) => boolean): { hero: T | null; others: T[] } {
  const open = runs.filter(unfinished);
  return { hero: open[0] ?? null, others: open.slice(1) };
}

/** A scenario that waits under Coming later: its name, and its box with its place in the book ("Revised Core Set · 2"). */
export type ComingScenario = { id: string; name: string; caption: string };

/** The scenarios no box can deal yet, in box and book order. */
export function comingScenarios(boxes: readonly Box[], isPlayable: (scenarioId: string) => boolean, nameOf: (scenarioId: string) => string): ComingScenario[] {
  return boxes.flatMap((box) =>
    box.scenarios.flatMap((id, index) => (isPlayable(id) ? [] : [{ id, name: nameOf(id), caption: `${box.name} · ${index + 1}` }])),
  );
}

/** The eyebrow over a hero's next stop: "Next · Scenario 3 of 6", or "On the table · Scenario 3 of 6" for the open scenario. */
export function nextLabel(next: NextStep, path: readonly PathNode[]): string {
  if (next.kind === "finished") return "Every scenario is won";
  return `${next.kind === "resume" ? "On the table" : "Next"} · Scenario ${next.node.number} of ${path.length}`;
}
