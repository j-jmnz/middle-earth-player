// Rules: mec112.setup-journey-to-the-cross-roads (data/rules/entries.json); ledger lines 144027:A:1, 144027:A:2, 144030:A:2, 144031:A:1, 144068:B:1. The words of Journey to the Cross-roads' table dials (src/play/readouts/roads.ts).

/** What the Black Gate dial reads (144027:A:2): the enemies facedown under it against the number at which the players lose, and what puts an enemy there. */
export function gateWords(count: number, limit: number): string {
  return `${count} of ${limit} enemies facedown under The Black Gate; at ${limit} the players lose the game. A Harad enemy left in the staging area at the end of the planning phase goes under it, and Henneth Annûn ignores that`;
}

/** The Black Gate dial's own warning: one enemy from the loss, or two (a loss, so it warms and warns, never the accent). */
export function gateWarn(left: number): { level: "near" | "critical"; words: string } | undefined {
  if (left === 1) return { level: "critical", words: "1 more enemy under The Black Gate and the players lose the game" };
  return left === 2 ? { level: "near", words: "2 more enemies under The Black Gate and the players lose the game" } : undefined;
}

/** What the Harad deck dial reads (144030:A:2, 144068:B:1): the cards left under The Cross-roads, the Threat they take from it and the two bars on travelling there. */
export function haradWords(left: number, threat: number | null): string {
  const cards = `${left} ${left === 1 ? "card" : "cards"} facedown under The Cross-roads`;
  const taken = threat == null ? "" : `; The Cross-roads has ${threat} Threat`;
  return `${cards}${taken}. One is revealed each quest phase. The players cannot travel there while any is left, nor before 20 progress is on the stage`;
}
