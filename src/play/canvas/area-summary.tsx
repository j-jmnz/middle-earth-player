// The staging area the table draws, once stage 2B has split the table, as one accessible line (words/scenarios/area.ts): near-invisible, takes no touch, and 1 pt in size, so it
// changes nothing on the canvas. A screen reader reads it where the canvas has no element per card (its alpha is not 0: VoiceOver skips a view that is), the
// end-to-end flow asserts it by id, and the new words are announced when the area, the stage or the card count changes while no peek is open. The words
// are computed in a selector, so this renders only when they change.
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useStore } from "zustand";

import { areaWords } from "../words/scenarios/area.ts";
import { shownSeat } from "../store/selectors.ts";
import type { TableStore } from "../store/store.ts";
import { announce } from "../../ui/announce.ts";

export function AreaSummary({ store, nameOf }: { store: TableStore; nameOf: (code: string) => string }) {
  const words = useStore(store, (state) => areaWords(state.game, shownSeat(state.game, state.viewedSeat), nameOf));
  const peeking = useStore(store, (state) => state.viewedSeat != null);
  // The words last heard while no peek was open: a peek changes them to the other seat's, and its end must not read them again.
  const heard = useRef<string | null>(null);
  useEffect(() => {
    if (peeking) return;
    const before = heard.current;
    heard.current = words;
    if (words != null && before != null && before !== words) announce(words);
  }, [words, peeking]);
  if (words == null) return null;
  return <View testID="table-area" accessible accessibilityLabel={words} pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0.01 }} />;
}
