import { parse as parseJsonc } from "jsonc-parser";

import type { RuleEntry } from "./spans.ts";

export type FrameworkStep = { id: string; phase: string; label: string; entries: string[] };

// DragnCards' steps.json groups some Rules Reference steps under one id ("1.R" is 1.2 to 1.3, "6.E" is 6.3 to 6.6).
// The label says which: "id:step-1.2-1.3". Each id joins to the Rules Reference entries it covers.
export function buildSteps(stepsJson: string, entries: readonly RuleEntry[]): FrameworkStep[] {
  const raw = parseJsonc(stepsJson) as { steps: Record<string, { phaseId: string; label: string }> };
  const byNumber = new Map(entries.filter((entry) => entry.id.startsWith("rr.step-")).map((entry) => [entry.id.replace("rr.step-", "").replaceAll("-", "."), entry.id]));
  return Object.entries(raw.steps).map(([id, step]) => {
    const match = /step-([\d.]+[a-z]?)(?:-([\d.]+[a-z]?))?$/.exec(step.label);
    const from = match?.[1] ?? id;
    const to = match?.[2] ?? from;
    const [fromMajor = 0, fromMinor = 0] = from.split(".").map(Number);
    const [toMajor = 0, toMinor = 0] = to.split(".").map(Number);
    const covered = [...byNumber]
      .filter(([number]) => {
        const [major = 0, minor = 0] = number.split(".").map((part) => parseInt(part, 10));
        return major === fromMajor && major === toMajor && minor >= fromMinor && minor <= toMinor;
      })
      .map(([, entry]) => entry)
      .sort();
    return { id, phase: step.phaseId, label: step.label.replace(/^id:/, ""), entries: covered };
  });
}
