// What History shows (phase 28b): the runs filtered, sorted newest first and, for a campaign, grouped under their playthrough.
// Pure. The runs come in the order they were written (run-store.ts listRuns), which breaks a tie between two with no time.
import type { RunKind, RunRecord, RunResult } from "../campaign/runs";

export type RunFilter = {
  // A campaign id (campaign kind) or a box id (standalone kind); null for all.
  scope: string | null;
  result: RunResult | null;
};

export const NO_FILTER: RunFilter = { scope: null, result: null };

/** When a run happened: its end, else its start; null when the store never knew either (a back-filled campaign win). */
export function whenOf(run: RunRecord): number | null {
  return run.endedAt ?? run.startedAt;
}

/** What a run is filtered by: a campaign's id for a campaign run, the box's for a standalone one. */
export function scopeOf(run: RunRecord): string {
  return run.kind === "campaign" ? (run.campaignId ?? run.box) : run.box;
}

/** The runs of one kind that pass the filter, in the order they were given. */
export function filterRuns(runs: readonly RunRecord[], kind: RunKind, filter: RunFilter): RunRecord[] {
  return runs.filter((run) => run.kind === kind && (filter.scope == null || scopeOf(run) === filter.scope) && (filter.result == null || run.result === filter.result));
}

/** The scopes the runs of one kind span, in the order they first appear: the choices of the filter. */
export function scopesOf(runs: readonly RunRecord[], kind: RunKind): string[] {
  return [...new Set(runs.filter((run) => run.kind === kind).map(scopeOf))];
}

/** Newest first. A run with no time sorts below the ones with one, and the one written last comes first among equals. */
export function newestFirst(runs: readonly RunRecord[]): RunRecord[] {
  return runs
    .map((run, index) => ({ run, index }))
    .sort((a, b) => (whenOf(b.run) ?? -1) - (whenOf(a.run) ?? -1) || b.index - a.index)
    .map((entry) => entry.run);
}

export type RunGroup = { refId: string; runs: RunRecord[] };

/** Campaign runs by playthrough: the playthrough with the newest run first, each group's runs newest first. */
export function groupRuns(runs: readonly RunRecord[]): RunGroup[] {
  const sorted = newestFirst(runs);
  const groups = new Map<string, RunRecord[]>();
  for (const run of sorted) groups.set(run.refId, [...(groups.get(run.refId) ?? []), run]);
  return [...groups].map(([refId, list]) => ({ refId, runs: list }));
}
