// Rules: mec112.setup-shelobs-lair, rr.play-and-put-into-play, rr.active-location (data/rules/entries.json); ledger lines 144040:A:2, 144071:B:2, 144071:B:3, 144072:B:2. The words of Shelob's Lair's table dials (src/play/readouts/lair.ts).

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** What Shelob's dial reads (144040:A:2, 144072:B:2): her resources, the Threat each gives her and, once stage 3B is current, the damage each cancels. */
export function shelobWords(resources: number, shielded: boolean): string {
  const threat = `Shelob has ${plural(resources, "resource", "resources")}: +${resources} Threat`;
  if (!shielded) return `${threat}. Each beginning of the quest phase the first player places 1 more or has her attack`;
  return resources > 0 ? `${threat}. The next damage dealt to her is canceled, whatever its size, and 1 resource is discarded` : `${threat}. With no resource left she takes damage as usual`;
}

/** What the quest-progress dial reads (144071:B:3): the progress placed on the stage this round against the cap, the active location's share coming first. */
export function capWords(placed: number, limit: number): string {
  const left = Math.max(0, limit - placed);
  return `${placed} of ${limit} progress placed on the stage this round; ${left === 0 ? "no more can be placed" : `${left} more can be`}. The active location takes its progress first`;
}

/** What a player's ally dial reads (144071:B:2): the allies that player played or put into play this round against the one they may bring in. */
export function alliesWords(entered: number, limit: number, who: string): string {
  return entered >= limit ? `${who} cannot play or put into play another ally this round` : `${who} may play or put into play ${plural(limit - entered, "more ally", "more allies")} this round`;
}
