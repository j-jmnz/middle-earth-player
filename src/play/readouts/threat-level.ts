// Rules: rr.threat-elimination-level, rr.player-elimination (data/rules/entries.json).
//
// How loud the threat dial is. A player whose threat reaches 50 is eliminated at once, so the dial's meter fills toward 50
// and the dial warms as it nears it: tinted from 40, solid threat red from 45 (docs/design-system-table.md). The change
// badge says what the last intent did to it ("−6" when it fell, "+2" when it rose).

export const ELIMINATION_THREAT = 50;
// The dial warms this far below its limit: tinted from 10 under it, solid from 5 under it (50: 40 and 45; The Uruk-hai's pursuit value, which loses at 30: 20 and 25).
const NEAR_BELOW = 10;
const CRITICAL_BELOW = 5;

export type ThreatLevel = "calm" | "near" | "critical";

export function threatLevel(threat: number, limit?: number): ThreatLevel {
  const top = limit ?? ELIMINATION_THREAT;
  if (threat >= top - CRITICAL_BELOW) return "critical";
  if (threat >= top - NEAR_BELOW) return "near";
  return "calm";
}

/** The meter's fill, 0 to 1: the threat against the elimination level (or the limit of another dial). */
export function threatMeter(threat: number, limit?: number): number {
  return Math.max(0, Math.min(1, threat / (limit ?? ELIMINATION_THREAT)));
}

/** The change badge: a true minus sign when the threat fell, a plus when it rose; null when it did not move. */
export function threatDelta(before: number, after: number): { text: string; lowered: boolean } | null {
  const change = after - before;
  if (change === 0) return null;
  return { text: change < 0 ? `−${-change}` : `+${change}`, lowered: change < 0 };
}

/** What a screen reader hears for the change: "Threat lowered by 6, now 24". */
export function threatDeltaWords(name: string, before: number, after: number): string | null {
  const change = after - before;
  if (change === 0) return null;
  return `${name} ${change < 0 ? "lowered" : "raised"} by ${Math.abs(change)}, now ${after}`;
}
