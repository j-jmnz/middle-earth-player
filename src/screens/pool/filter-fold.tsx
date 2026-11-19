// The pool's filters that fold away under the search while the Cards tab scrolls down in portrait, and come back as it scrolls up
// (docs/design-system.md, Card pool (the Cards tab)). The turn of the scroll is scroll-fold.ts; this feeds it the list's offsets and
// draws the fold.
import { useRef, useState, type ReactNode } from "react";
import { View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useOpenMotion } from "../../ui/motion-run";
import { MOTION } from "../../ui/motion-tokens";
import { OPEN_FOLD, foldOnScroll } from "./scroll-fold";

/**
 * Whether the filters are folded, the list's scroll handler, and the filters' measured height to fold from. A new `shown` (the cards
 * the pool lists) shows the filters again: a search or a filter that changes the list never leaves its count hidden.
 */
export function useFilterFold(enabled: boolean, shown: unknown): {
  folded: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  height: number;
  onMeasure: (height: number) => void;
} {
  // The scroll's state lives in a ref (every offset moves its anchor); a render sees only the fold. `round` counts the resets: a ref
  // from an earlier round starts again from open.
  const state = useRef({ round: 0, fold: OPEN_FOLD });
  const [folded, setFolded] = useState(false);
  const [height, setHeight] = useState(0);
  const [round, setRound] = useState(0);
  // Turned off (a rotation to landscape) or a new list, the filters show; the next scroll starts from open.
  const [seen, setSeen] = useState({ enabled, shown });
  if (enabled !== seen.enabled || shown !== seen.shown) {
    setSeen({ enabled, shown });
    setFolded(false);
    setRound(round + 1);
  }
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!enabled) return;
    const from = state.current.round === round ? state.current.fold : OPEN_FOLD;
    const fold = foldOnScroll(from, event.nativeEvent.contentOffset.y, Date.now(), height);
    state.current = { round, fold };
    setFolded(fold.folded);
  };
  const onMeasure = (next: number) => setHeight((current) => (current === next ? current : next));
  return { folded: enabled && folded, onScroll, height, onMeasure };
}

/**
 * The filters' fold: their full height while open, none while folded, over `filtersUnfold` and `filtersFold` (reduced motion snaps).
 * It spans the screen's 24 pt inset, so the type chips' row still runs to the edges inside it. Folded, the filters are hidden from a
 * screen reader and take no touch.
 */
export function FilterFold({ fold, children }: { fold: ReturnType<typeof useFilterFold>; children: ReactNode }) {
  const { progress } = useOpenMotion(!fold.folded, MOTION.filtersUnfold, MOTION.filtersFold);
  const measured = fold.height;
  const style = useAnimatedStyle(() => (measured > 0 ? { height: measured * progress.get(), opacity: progress.get() } : {}));
  return (
    <Animated.View
      style={[{ overflow: "hidden", marginHorizontal: -24, paddingHorizontal: 24 }, style]}
      pointerEvents={fold.folded ? "none" : "auto"}
      aria-hidden={fold.folded}
      importantForAccessibility={fold.folded ? "no-hide-descendants" : "auto"}
    >
      <View onLayout={(event) => fold.onMeasure(Math.ceil(event.nativeEvent.layout.height))}>{children}</View>
    </Animated.View>
  );
}
