// Rules: rr.threat-elimination-level, rr.player-elimination (data/rules/entries.json).
//
// How loud the threat dial is. A player whose threat reaches 50 is eliminated at once, so the dial's meter fills toward 50
// and the dial warms as it nears it: tinted from 40, solid threat red from 45 (docs/design-system-table.md). The change
// badge says what the last intent did to it ("−6" when it fell, "+2" when it rose).

export const ELIMINATION_THREAT = 50;
/** The elimination level while the main quest has Dire (mec113.dire): the dial's meter, its warming and its words read it. */
export const DIRE_THREAT = 99;
/** The number a threat dial's meter fills toward: 99 under Dire, else the elimination level (undefined: the dial's own default). */
export const dialLimit = (dire: boolean): number | undefined => (dire ? DIRE_THREAT : undefined);
const NEAR = 40;
const CRITICAL = 45;

export type ThreatLevel = "calm" | "near" | "critical";

/** `limit` is the number that loses: the elimination level for a threat dial, 30 for the pursuit dial; it warms at four fifths of it and is critical from nine tenths. */
export function threatLevel(threat: number, limit: number = ELIMINATION_THREAT): ThreatLevel {
  if (threat >= (limit * CRITICAL) / ELIMINATION_THREAT) return "critical";
  if (threat >= (limit * NEAR) / ELIMINATION_THREAT) return "near";
  return "calm";
}

/** The meter's fill, 0 to 1: the threat against the elimination level (or the `limit` that loses). */
export function threatMeter(threat: number, limit: number = ELIMINATION_THREAT): number {
  return Math.max(0, Math.min(1, threat / limit));
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
