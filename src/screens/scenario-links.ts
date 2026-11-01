import type { NextStep } from "../campaign/path";

// Where a playthrough's buttons go. The campaign list's Continue panel and the path's Resume and Begin share them.
export function pathHref(saveId: string) {
  return { pathname: "/path/[saveId]", params: { saveId } } as const;
}

export function tableHref(saveId: string) {
  return { pathname: "/table/[saveId]", params: { saveId } } as const;
}

export function briefingHref(saveId: string, scenarioId: string) {
  return { pathname: "/briefing/[saveId]/[scenarioId]", params: { saveId, scenarioId } } as const;
}

/** Resume opens the table, Begin the briefing, and a finished campaign or one whose next scenario is coming soon its path. */
export function nextStepHref(saveId: string, step: NextStep) {
  if (step.kind === "resume") return tableHref(saveId);
  if (step.kind === "begin") return briefingHref(saveId, step.node.id);
  return pathHref(saveId);
}
