// The pure parts of the two hubs (docs/design-system.md, Campaigns (campaign list) and Scenarios): which run is the hero, which
// scenarios wait under Coming later, and the words over a hero's next stop. hub-parts.tsx draws them.
import type { NextStep, PathNode } from "../../campaign/path";
import type { Box } from "../data/campaign-data";
import { nextWord } from "../history/save-line";
import { lockedBoxTiles, type CampaignRow, type LockedTile } from "./list";

/** The hub's hero and the runs under it: the first unfinished run in list order, and the other unfinished runs after it. */
export function splitRuns<T>(runs: readonly T[], unfinished: (run: T) => boolean): { hero: T | null; others: T[] } {
  const open = runs.filter(unfinished);
  return { hero: open[0] ?? null, others: open.slice(1) };
}

/** A scenario that waits under Coming later: its name, its box with its place in the book ("Coming soon · Revised Core Set · 2"), and the box's name as the words a search also finds it by. */
export type ComingScenario = { id: string; name: string; caption: string; find: string };

/** The scenarios no box can deal yet, in box and book order; a cycle's scenarios not built yet (`later`) follow its built ones. */
export function comingScenarios(boxes: readonly Box[], isPlayable: (scenarioId: string) => boolean, nameOf: (scenarioId: string) => string): ComingScenario[] {
  return boxes.flatMap((box) => {
    const built = box.scenarios.flatMap((id, index) => (isPlayable(id) ? [] : [{ id, name: nameOf(id), caption: `Coming soon · ${box.name} · ${index + 1}`, find: box.name }]));
    const unbuilt = (box.later ?? []).map((name, index) => ({ id: `${box.id}:${name}`, name, caption: `Coming soon · ${box.name} · ${box.scenarios.length + index + 1}`, find: box.name }));
    return [...built, ...unbuilt];
  });
}

/**
 * The Scenarios tab's Coming later, in the campaigns table's order: for each row, the waiting scenarios of the boxes that follow
 * its campaign, then the row itself when it is locked. Shelob's Lair, waiting in The Two Towers' box, sits beside The Return of
 * the King. A locked campaign whose box is listed is one tile named by that box ("9 scenarios · Coming soon"), not a tile for each scenario
 * and the row besides. A box whose campaign has no row goes last.
 */
export function comingLater(boxes: readonly Box[], rows: readonly CampaignRow[], isPlayable: (scenarioId: string) => boolean, nameOf: (scenarioId: string) => string): LockedTile[] {
  const locked = new Map(lockedBoxTiles(rows).map((tile) => [tile.id, tile]));
  const ids = new Set(rows.map((row) => row.id));
  const waiting = (campaignId: string) => comingScenarios(boxes.filter((box) => box.campaignId === campaignId), isPlayable, nameOf);
  const placed = rows.flatMap((row) => {
    const tile = locked.get(row.id);
    if (!tile) return waiting(row.id);
    const box = boxes.find((candidate) => candidate.campaignId === row.id);
    return box ? [{ ...tile, name: row.box ?? box.name }] : [tile];
  });
  return [...placed, ...comingScenarios(boxes.filter((box) => !ids.has(box.campaignId)), isPlayable, nameOf)];
}

/** The eyebrow over a hero's next stop: "Next · Scenario 3 of 6", "On the table · Scenario 3 of 6" for the open scenario ("Needs a choice · Scenario 3 of 6" when it asks to be continued or restarted), or "Coming soon · Scenario 7 of 9" for one the app cannot deal yet. */
export function nextLabel(next: NextStep, path: readonly PathNode[]): string {
  if (next.kind === "finished") return "Campaign won";
  if (next.kind === "soon") return `Coming soon \u00b7 Scenario ${next.node.number} of ${path.length}`;
  return `${nextWord(next)} · Scenario ${next.node.number} of ${path.length}`;
}
