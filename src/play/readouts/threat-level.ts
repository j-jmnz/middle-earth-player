// Rules: rr.threat-elimination-level, rr.player-elimination (data/rules/entries.json).
//
// How loud the threat dial is. A player whose threat reaches 50 is eliminated at once, so the dial's meter fills toward 50
// and the dial warms as it nears it: tinted from 40, solid threat red from 45 (docs/design-system-table.md). The change
// badge says what the last intent did to it ("−6" when it fell, "+2" when it rose).

export const ELIMINATION_THREAT = 50;
const NEAR = 40;
const CRITICAL = 45;

export type ThreatLevel = "calm" | "near" | "critical";

export function threatLevel(threat: number): ThreatLevel {
  if (threat >= CRITICAL) return "critical";
  if (threat >= NEAR) return "near";
  return "calm";
}

/** The meter's fill, 0 to 1: the threat against the elimination level. */
export function threatMeter(threat: number): number {
  return Math.max(0, Math.min(1, threat / ELIMINATION_THREAT));
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
