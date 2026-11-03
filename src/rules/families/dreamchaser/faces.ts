// Rules: dcce.scalable-upgradable, dcce.campaign-mode (data/rules/entries.json). A two-sided card shows one side: an upgraded card is dealt on
// its Upgraded side, side B (dreamchaser/facts.ts `dealtFace`), and only the abilities printed on the side it shows work. A record names the
// ledger lines it implements ("<code>:<side>:<n>"); a record whose lines are all on one side belongs to that side, and a record with lines on
// both sides to both.
import type { Effect } from "../../../catalog/boundary.ts";

import type { CardInstance } from "../../core/state.ts";

// Cards whose face does not choose between their sides' records: a quest stage shows its side B all game and keeps the A-side lines it
// was revealed with, and the campaign and Nightmare cards read their sides through their own zones.
const FACE_FREE: ReadonlySet<string> = new Set(["questStage", "questDeck", "campaign", "nightmare"]);

const SIDES = new WeakMap<Effect, "A" | "B" | null>();

/** The side every line of the record is on, or null when it implements lines of both sides. */
export function recordSide(effect: Effect): "A" | "B" | null {
  const known = SIDES.get(effect);
  if (known !== undefined) return known;
  const sides = new Set(effect.lines.map((line) => line.split(":")[1]));
  const side = sides.size === 1 ? (sides.has("B") ? "B" : sides.has("A") ? "A" : null) : null;
  SIDES.set(effect, side);
  return side;
}

/** The side the card shows: B when it is dealt or turned to its side B, A otherwise. */
export function shownSide(instance: Pick<CardInstance, "face">): "A" | "B" {
  return instance.face === "B" ? "B" : "A";
}

/** The records of the card that work on the side it shows. A card in a zone that has no sides to choose between keeps every record. */
export function recordsOfFace(instance: Pick<CardInstance, "face" | "zone">, records: readonly Effect[]): readonly Effect[] {
  if (FACE_FREE.has(instance.zone)) return records;
  const shown = shownSide(instance);
  // Only a card that has records on both sides is filtered: a card whose records are all on one side keeps them whatever its face (a contract flipped
  // to its side B, whose side-A records carry their own `faceUp` condition).
  if (!records.some((effect) => recordSide(effect) === "A") || !records.some((effect) => recordSide(effect) === "B")) return records;
  return records.filter((effect) => {
    const side = recordSide(effect);
    return side == null || side === shown;
  });
}
