// Rules: vom.controlling-locations, vom.losing-control-of-a-location, rr.travel, rr.quest-advancement (data/rules/entries.json); ledger lines 22025:B:3, 22026:B:2, 22014:A:2, 22014:A:3, 22022:A:1, 22015:A:3, 22016:A:2 (docs/scenarios/vengeance-of-mordor/wrath-and-ruin.md, Table).
// The words of Wrath and Ruin's top-bar dials, seat marks and card previews (wrath.ts beside them). Pure.
import { listAnd, plural } from "../../words/list.ts";

/** "you" or "Player 2" in a sentence. */
const who = (seatCount: number, seat: number): string => (seatCount > 1 ? `Player ${seat + 1}` : "you");

/** What a tap on the Control dial says: the locations the players control against those in the staging area, what that count decides and X (Gate of Dorwinion's Threat and Under Siege's X). */
export const controlWords = (held: readonly string[], staged: number): string => {
  const x = held.length + 1;
  const now = held.length === 0 ? "The players control no location" : `The players control ${plural(held.length, "location")}: ${listAnd(held)}`;
  const gate = held.length > staged ? "They control more than the staging area holds" : `They need ${staged + 1 - held.length} more to control more than the staging area holds`;
  return `${now}. ${plural(staged, "location")} lie${staged === 1 ? "s" : ""} in the staging area (the active location is not counted). ${gate}. Both stages are defeated, and the players can travel to Gate of Dorwinion on stage 2B, only then. X is ${x}, 1 more than the locations controlled: it is Gate of Dorwinion's Threat and Under Siege's X.`;
};

export const controlLimitWords = (staged: number): string => `More than the ${plural(staged, "location")} in the staging area must be controlled`;

/** What a tap on the Gate dial says: stage 2B's progress against the 12 that let the players travel to Gate of Dorwinion. */
export const gateWords = (progress: number): string => `${progress} of the 12 progress on Drive them Out. The players cannot travel to Gate of Dorwinion until stage 2B holds 12 progress and they control more locations than the staging area holds.`;

export const gateLimitWords = (): string => "12 progress let the players travel to Gate of Dorwinion";

/** The seat mark of the locations a seat controls (the count stays in a two-handed bar's caption). */
export const controlMarkLabel = (seat: number, held: number): string => `P${seat + 1} ${held}`;

export const controlMarkWords = (seatCount: number, seat: number, names: readonly string[]): string => {
  const x = names.length + 1;
  const held = names.length === 0 ? `${who(seatCount, seat)} control no location` : `${who(seatCount, seat)} control ${plural(names.length, "location")}: ${listAnd(names)}`;
  return `${held}. Street Fighting, Ulchor's Revenge and Easterling shadow effects count them: X is ${x}.`;
};

/** The preview of Gate of Dorwinion: its Threat now and what stops a travel. */
export const gateCardWords = (x: number, progress: number, held: number, staged: number): string =>
  `Threat ${x}, 1 more than the ${plural(held, "location")} the players control. The players cannot travel here until stage 2B holds 12 progress (${progress} now) and they control more locations than the staging area holds (${held} against ${staged}).`;

/** A controlled Contested Square or Ransacked House: the Forced line it gains under control. */
export const SQUARE_HELD = "While you control it, it returns to the staging area after a character you control is destroyed.";
export const HOUSE_HELD = "While you control it, it returns to the staging area after you lose control of another location.";
