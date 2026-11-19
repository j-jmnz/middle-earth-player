// The pool's filters that fold away under the search while the Cards tab scrolls down in portrait, and come back as it scrolls up
// (docs/design-system.md, Card pool (the Cards tab)). The turn of the scroll is scroll-fold.ts; this feeds it the list's offsets and
// draws the fold.
import { useRef, useState, type ReactNode } from "react";
import { View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";

import { useOpenMotion } from "../../ui/motion-run";
import { MOTION } from "../../ui/motion-tokens";
import { withAlphaHex } from "../../ui/tokens";
import { useUiScale } from "../../ui/ui-scale";
import { usePalette } from "../kit/palette-hook";
import { OPEN_FOLD, foldOnScroll, openAt } from "./scroll-fold";

export type FilterFoldState = {
  // Whether the filters fold at all here: they then sit over the top of the list (FilterFold), and the list starts under them.
  enabled: boolean;
  folded: boolean;
  // The list's offset, up to a few dozen points: the shade behind the filters comes in as the list leaves its top.
  scrolled: SharedValue<number>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  // Shows the filters at once: one of them took the keyboard's focus.
  reveal: () => void;
  height: number;
  onMeasure: (height: number) => void;
};

/**
 * Whether the filters are folded, the list's scroll handler, and the filters' measured height to fold from. A new `shown` (the cards
 * the pool lists) shows the filters again: a search or a filter that changes the list never leaves its count hidden.
 */
export function useFilterFold(enabled: boolean, shown: unknown): FilterFoldState {
  // The scroll's state lives in a ref (every offset moves its anchor); a render sees only the fold. `round` counts the resets: a ref
  // from an earlier round starts again, open, from the last offset.
  const state = useRef({ round: 0, fold: OPEN_FOLD, y: 0 });
  const [folded, setFolded] = useState(false);
  const [height, setHeight] = useState(0);
  const [round, setRound] = useState(0);
  const scrolled = useSharedValue(0);
  // Turned off (a rotation to landscape, a screen reader turned on) or a new list, the filters show.
  const [seen, setSeen] = useState({ enabled, shown });
  if (enabled !== seen.enabled || shown !== seen.shown) {
    setSeen({ enabled, shown });
    setFolded(false);
    setRound(round + 1);
  }
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!enabled) return;
    // The shade's offset moves on every event; only the fold renders.
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const last = state.current;
    const from = last.round === round ? last.fold : openAt(last.y);
    const fold = foldOnScroll(from, contentOffset.y, contentSize.height - layoutMeasurement.height, height);
    state.current = { round, fold, y: contentOffset.y };
    scrolled.set(Math.min(Math.max(0, contentOffset.y), 64));
    setFolded(fold.folded);
  };
  const reveal = () => {
    state.current = { round, fold: openAt(state.current.y), y: state.current.y };
    setFolded(false);
  };
  const onMeasure = (next: number) => setHeight((current) => (current === next ? current : next));
  return { enabled, folded: enabled && folded, scrolled, onScroll, reveal, height, onMeasure };
}

/**
 * The filters over the top of the list, which starts under them by their height: folding fades them and lifts them 16 pt over
 * `filtersFold` and `filtersUnfold` (reduced motion snaps), and the list's size never changes, so a fold renders nothing under it. A
 * night shade behind them, solid under the rows and falling to nothing below them, hides the cards that scroll under them; it shows
 * only once the list has left its top. It runs as far past the screen's inset as the type chips' row does, so the row reaches the
 * edges. Folded, the filters are hidden from a screen reader and take no touch; a keyboard's focus landing in them shows them.
 */
export function FilterFold({ fold, children }: { fold: FilterFoldState; children: ReactNode }) {
  const palette = usePalette();
  const s = useUiScale();
  const { progress } = useOpenMotion(!fold.folded, MOTION.filtersUnfold, MOTION.filtersFold);
  const lift = 16 * s;
  const fall = 24 * s;
  const scrolled = fold.scrolled;
  const rows = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: -lift * (1 - progress.get()) }] }));
  const shade = useAnimatedStyle(() => ({ opacity: progress.get() * Math.min(1, scrolled.get() / fall) }));
  const height = fold.height + fall;
  const solid = Math.round((fold.height / height) * 100);
  const night = withAlphaHex(palette.night, 0.94);
  const clear = withAlphaHex(palette.night, 0);
  return (
    // NativeWind does not style a Reanimated view: the place and the bleed are the plain view around them, the inset the view inside.
    <View className="absolute -left-6 -right-6 top-0" style={{ zIndex: 1 }} pointerEvents={fold.folded ? "none" : "box-none"} onFocus={fold.folded ? fold.reveal : undefined}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", left: 0, right: 0, top: 0, height, backgroundImage: `linear-gradient(180deg, ${night} ${solid}%, ${clear} 100%)` }, shade]}
      />
      <Animated.View style={rows} aria-hidden={fold.folded} importantForAccessibility={fold.folded ? "no-hide-descendants" : "auto"}>
        <View className="px-6 pb-2" onLayout={(event) => fold.onMeasure(Math.ceil(event.nativeEvent.layout.height))}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
