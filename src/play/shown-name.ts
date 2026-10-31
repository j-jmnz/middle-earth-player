// Rules: dcce.uncharted (data/rules/entries.json). The name a card shows. A double-sided location lying on its Lost Island side is a Lost Island, whatever its other side is called: the table never
// says which location a facedown Lost Island is. `key` is the picture key of the card as it lies (picture-key.ts).
import type { PrintedCard } from "../rules/printed.ts";

import { pictureCode } from "./picture-key.ts";
import { LOST_ISLAND_NAME } from "./uncharted-words.ts";

export function shownName(key: string, printed: Pick<PrintedCard, "name" | "keywords"> | undefined): string {
  const code = pictureCode(key);
  return key !== code && printed?.keywords.uncharted === true ? LOST_ISLAND_NAME : (printed?.name ?? code);
}
