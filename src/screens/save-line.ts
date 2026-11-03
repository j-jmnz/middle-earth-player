// How a playthrough is worded in the lists, the hubs and History (docs/design-system.md, Campaigns (campaign list)): the line that
// names its campaign, seats and progress, and the sentences a screen reader hears for it. Pure: no component.
import { campaignPath, nextStep, soonWords, type NextStep, type PathNode } from "../campaign/path";
import { campaignOf, scenarioNames } from "./campaign-data";
import type { ListedSave } from "./campaign-store";
import { seatWord } from "./seats";

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
// `path` is the campaign's scenarios as the path screen reads them.
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep; path: readonly PathNode[] };

/** A save as the lists word it: `name` is its campaign's, and the path is read from its log. */
export function saveLine(save: ListedSave, name: string): SaveLine {
  const campaign = campaignOf(save.campaignId);
  const path = campaign ? campaignPath(campaign, scenarioNames(campaign), save.log) : [];
  return {
    name,
    seats: seatWord(save.seatCount),
    done: path.filter((node) => node.status === "completed").length,
    total: campaign?.scenarios.length ?? 0,
    next: nextStep(path, save.loadout?.scenarioId),
    path,
  };
}

/** The fellowship a playthrough plays, seat by seat: the heroes the campaign log records, else the heroes the last loadout dealt. */
export function partySeats(save: ListedSave): readonly (readonly string[])[] {
  if (save.log.heroesBySeat.flat().length > 0) return save.log.heroesBySeat;
  return save.loadout?.seats.map((seat) => seat.heroes) ?? [];
}

export function partyCodes(save: ListedSave): string[] {
  return partySeats(save).flat();
}

export function describe(line: SaveLine): string {
  return `${line.name}, ${line.seats}, ${line.done} of ${line.total} completed`;
}

/** "Next: A Knife in the Dark", "On the table: ...", "The Drowned Ruins is coming soon" or "Every scenario is won": the next step in one phrase (a row, a folded header). */
export function nextSummary(next: NextStep): string {
  if (next.kind === "soon") return soonWords(next.node);
  return next.kind === "finished" ? "Every scenario is won" : `${next.kind === "resume" ? "On the table" : "Next"}: ${next.node.name}`;
}

/** What Delete asks, naming the playthrough by `describe`, since two of one campaign differ only there. */
export function deleteSentence(described: string): string {
  return `Delete ${described}? Its log, pool and any open scenario are gone for good. Your decks stay.`;
}
