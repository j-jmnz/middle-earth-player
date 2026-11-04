// Rules: rr.keywords (data/rules/entries.json).
//
// A printed line as the effect templates read it: keywords stripped, the card's own name as {self}, numbers kept. Two lines with the same result are
// the same sentence on different cards. The data build (scripts/data/effects/generate.ts) and the copy of a line's records (src/effects/authored/reprint.ts)
// share this one reading.
import { stripKeywords } from "./keyword-line.ts";

export function selfNamed(name: string, line: string): string {
  return stripKeywords(line).replaceAll(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "{self}");
}
