// The staging area the table draws, once stage 2B has split the table, as one accessible line (area-words.ts): invisible, takes no touch, and 1 pt in size, so it
// changes nothing on the canvas. A screen reader reads it where the canvas has no element per card, and the end-to-end flow asserts it by id. The words are
// computed in a selector, so this renders only when they change.
import { View } from "react-native";
import { useStore } from "zustand";

import { areaWords } from "./area-words.ts";
import { shownSeat } from "./selectors.ts";
import type { TableStore } from "./store.ts";

export function AreaSummary({ store, nameOf }: { store: TableStore; nameOf: (code: string) => string }) {
  const words = useStore(store, (state) => areaWords(state.game, shownSeat(state.game, state.viewedSeat), nameOf));
  if (words == null) return null;
  return <View testID="table-area" accessible accessibilityLabel={words} pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0 }} />;
}
