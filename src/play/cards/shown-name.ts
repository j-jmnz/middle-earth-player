// Rules: dcce.uncharted (data/rules/entries.json). The name a card shows. A double-sided location lying on its Lost Island side is a Lost Island, whatever its other side is called: the table never
// says which location a facedown Lost Island is. `key` is the picture key of the card as it lies (picture-key.ts).
import { isReanimatedCode, type PrintedCard } from "../../rules/core/printed.ts";

import { pictureCode } from "../canvas/picture-key.ts";
import { LOST_ISLAND_NAME, TEMPLE_NAME } from "../words/scenarios/uncharted.ts";

// A Reanimated Dead (`<code>~dead`, mec108.reanimated-dead) is named "Reanimated Dead" everywhere and never by the card it was: the catalog has no entry for its code, so every name comes from here.
export const REANIMATED_DEAD_NAME = "Reanimated Dead";

export function shownName(key: string, printed: Pick<PrintedCard, "name" | "keywords" | "upgraded"> | undefined): string {
  const code = pictureCode(key);
  if (isReanimatedCode(code)) return REANIMATED_DEAD_NAME;
  // The Temple of the Deceived side prints a Threat of its own (a Lost Island's is the same on every copy): it is a Temple location, whatever it turns out to be.
  return key !== code && printed?.keywords.uncharted === true ? (printed.upgraded?.threat != null ? TEMPLE_NAME : LOST_ISLAND_NAME) : (printed?.name ?? code);
}
