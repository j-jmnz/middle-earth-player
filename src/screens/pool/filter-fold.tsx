// The pool's filters that fold away under the search while the Cards tab scrolls down, and come back as it scrolls up
// (docs/design-system.md, Card pool (the Cards tab)). The turn of the scroll is scroll-fold.ts; this feeds it the list's offsets and
// draws the fold.
import { useRef, useState, type ReactNode } from "react";
import { View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";

import { useOpenMotion } from "../../ui/motion-run";
import { MOTION } from "../../ui/motion-tokens";
import { useUiScale } from "../../ui/ui-scale";
import { usePalette } from "../kit/palette-hook";
import { OPEN_FOLD, foldOnScroll, openAt, shadeOf } from "./scroll-fold";

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
  // Turned off (a screen reader turned on) or a new list, the filters show.
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
    scrolled.set(Math.min(Math.max(0, contentOffset.y), 96));
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
 * The filters over the top of the list, which starts under them by their height, so a fold changes no layout and renders nothing
 * under it. Folding lifts them 24 pt and fades them, over `filtersFold` and `filtersUnfold` (reduced motion snaps), clipped at the
 * list's top, so they slide away under the search row. A night shade behind them, solid under the rows and easing to nothing over 56 pt
 * below them (`shadeOf`), hides the cards that scroll under them; it comes in over the list's first 48 pt of scroll. It rises with the rows and stops 16 pt under
 * the search row, so folded the cards still pass under a short band and never touch the search. It runs as far past the screen's inset
 * as the type chips' row does, so the row reaches the edges; the shade does too where the pool runs to the screen's sides, and keeps to
 * the pool's column (`column`) where a pane stands beside it, so it ends on the cards' edge and not in the gap. Folded, the filters are
 * hidden from a screen reader and take no touch; a keyboard's focus landing in them shows them.
 */
export function FilterFold({ fold, column = false, children }: { fold: FilterFoldState; column?: boolean; children: ReactNode }) {
  const palette = usePalette();
  const s = useUiScale();
  const { progress } = useOpenMotion(!fold.folded, MOTION.filtersUnfold, MOTION.filtersFold);
  const lift = 24 * s;
  const fall = 56 * s;
  const comeIn = 48 * s;
  const band = 16 * s;
  const scrolled = fold.scrolled;
  // How far the shade rises when folded: all of its solid part but the band.
  const rise = Math.max(0, fold.height - band);
  const rows = useAnimatedStyle(() => {
    const p = progress.get();
    // The words fade a little ahead of the lift, so they are gone before they reach the search row.
    return { opacity: p * p, transform: [{ translateY: -lift * (1 - p) }] };
  });
  const shade = useAnimatedStyle(() => ({ opacity: Math.min(1, scrolled.get() / comeIn), transform: [{ translateY: -rise * (1 - progress.get()) }] }));
  const height = fold.height + fall;
  const gradient = shadeOf(palette.night, fold.height / height);
  return (
    // NativeWind does not style a Reanimated view: the place, the bleed and the clip are the plain view around them, the inset the view
    // inside.
    <View
      className="absolute -left-6 -right-6 top-0 overflow-hidden"
      style={{ zIndex: 1, height }}
      pointerEvents={fold.folded ? "none" : "box-none"}
      onFocus={fold.folded ? fold.reveal : undefined}
    >
      <View pointerEvents="none" className={`absolute top-0 ${column ? "left-6 right-6" : "left-0 right-0"}`} style={{ height }}>
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, height, backgroundImage: gradient }, shade]} />
      </View>
      <Animated.View style={rows} aria-hidden={fold.folded} importantForAccessibility={fold.folded ? "no-hide-descendants" : "auto"}>
        <View className="px-6 pb-2" onLayout={(event) => fold.onMeasure(Math.ceil(event.nativeEvent.layout.height))}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
