// The words History shows for a run. A field the store never knew (a back-filled run's end time, threats, start) is left out,
// never invented. Pure.
import type { RunRecord } from "../campaign/runs";
import { seatWord } from "./seats";
import { whenOf } from "./history-list";

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "24 Oct 2026", or null when the run has no time. */
export function runDate(run: RunRecord): string | null {
  const when = whenOf(run);
  return when == null ? null : new Date(when).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "Won", or "Lost" and the cause the engine gave. */
export function resultWords(run: RunRecord): string {
  return run.result === "won" ? "Won" : run.lossCause ? `Lost · ${run.lossCause}` : "Lost";
}

/** "Aragorn, Théodred" or, two-handed, "Aragorn, Théodred / Gimli"; null with no hero known. */
export function heroesWords(seats: readonly (readonly string[])[], nameOf: (code: string) => string): string | null {
  const named = seats.map((seat) => seat.map(nameOf).join(", ")).filter((words) => words.length > 0);
  return named.length > 0 ? named.join(" / ") : null;
}

/** "True solo · Aragorn, Théodred" or, two-handed, "Two-handed · Aragorn, Théodred / Gimli". */
export function seatsWords(run: RunRecord, nameOf: (code: string) => string): string {
  return [seatWord(run.seatCount), heroesWords(run.heroes, nameOf)].filter((part) => part != null).join(" · ");
}

/** "4 rounds · threat 31" or "4 rounds · threat 28 / 33"; each part left out when the store did not know it. */
export function courseWords(run: RunRecord): string | null {
  const parts = [run.rounds == null ? null : plural(run.rounds, "round"), run.threats && run.threats.length > 0 ? `threat ${run.threats.join(" / ")}` : null].filter((part) => part != null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "Score 41 · 2 victory points · Reward: Mendor, Mendor's Support": a win's score and, in a campaign, what it earned. */
export function scoreWords(run: RunRecord, nameOf: (code: string) => string): string | null {
  if (run.result !== "won") return null;
  const parts = [
    run.score == null ? null : `Score ${run.score}`,
    run.victoryPoints == null ? null : plural(run.victoryPoints, "victory point"),
    run.reward && run.reward.length > 0 ? `Reward: ${run.reward.map(nameOf).join(", ")}` : null,
  ].filter((part) => part != null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "<1 min", "42 min", "1 h 05 min", and past 24 hours "3 d 2 h". */
export function durationWords(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** The same length in words a screen reader says: "less than a minute", "42 minutes", "1 hour 5 minutes", "3 days 2 hours". */
export function durationSpoken(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? plural(hours, "hour") : `${plural(hours, "hour")} ${plural(minutes % 60, "minute")}`;
  return hours % 24 === 0 ? plural(Math.floor(hours / 24), "day") : `${plural(Math.floor(hours / 24), "day")} ${plural(hours % 24, "hour")}`;
}

// The playtime of a run in a given wording: the counted time and the time away, or only the whole span when the table did not count.
function playtime(run: RunRecord, length: (ms: number) => string, joiner: string, whole: string): string | null {
  const wall = run.startedAt != null && run.endedAt != null ? Math.max(0, run.endedAt - run.startedAt) : null;
  if (run.activeMs != null) {
    const played = `played ${length(run.activeMs)}`;
    if (wall == null) return played;
    const away = Math.max(0, wall - run.activeMs);
    return away >= 60000 ? `${played}${joiner}away ${length(away)}` : played;
  }
  return wall == null ? null : `${length(wall)} ${whole}`;
}

/**
 * "played 42 min · away 1 h 05 min" when the table counted its foreground time (away is the rest of the wall time, left out under a
 * minute); "1 h 47 min in all" when only the two times are known; null otherwise.
 */
export function playtimeWords(run: RunRecord): string | null {
  return playtime(run, durationWords, " · ", "in all");
}

/** The playtime as a screen reader says it: "played 42 minutes, away 1 hour 5 minutes", "1 hour 47 minutes in all". */
export function playtimeSpoken(run: RunRecord): string | null {
  return playtime(run, durationSpoken, ", ", "in all");
}

/** "4 rounds · threat 28 / 33 · Score 41 · Reward: Mendor · played 42 min": how a run went, or null when the store knew none of it. */
export function runDetail(run: RunRecord, nameOf: (code: string) => string): string | null {
  const parts = [courseWords(run), scoreWords(run, nameOf), playtimeWords(run)].filter((part) => part != null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The one line the screen reader gets for a run. */
export function runLabel(run: RunRecord, scenario: string, nameOf: (code: string) => string): string {
  return [scenario, resultWords(run), runDate(run), seatsWords(run, nameOf), courseWords(run), scoreWords(run, nameOf), playtimeSpoken(run)].filter((part) => part != null).join(", ");
}

/** The one line an empty library says. */
export function emptyWords(kind: RunRecord["kind"]): string {
  return kind === "campaign" ? "No playthrough yet. Start one from Campaigns." : "No game yet. Pick a scenario on Scenarios to deal one.";
}

/**
 * What tells two playthroughs of one campaign apart in History: "Two-handed · started 24 Oct · 3 of 6 completed" (the wording of the
 * campaign setup's carry-over row). The start is the earliest time any of its runs knows; progress only while the playthrough exists.
 */
export function playthroughWords(seats: string, startedAt: number | null, progress: { done: number; total: number } | null): string {
  const date = startedAt == null ? null : new Date(startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return [seats, date ? `started ${date}` : null, progress && progress.total > 0 ? `${progress.done} of ${progress.total} completed` : null].filter((part) => part != null).join(" · ");
}
