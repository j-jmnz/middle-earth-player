// Drag to reorder the deck list (docs/design-system.md, Decks): a long press lifts a deck, the others make room, and letting go
// writes the order. The list is still a FlashList; the layout of each deck's cell (`getLayout`) says where the slots are, so the
// same code serves the Cards grid and the List column. The decks' own taps and the list's scrolling are untouched until the press.
import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref, type RefObject } from "react";
import { View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewProps } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { tickArmed, tickLand } from "../../ui/haptics";
import { useReduceMotion } from "../../ui/motion-run";
import { moveItem, nearestSlot, shiftsFor, type Shift, type SlotRect } from "./order";

const LONG_PRESS_MS = 350;
const SETTLE_MS = 140;
const SHIFT_MS = 160;
const LIFT_SCALE = 1.03;
// Dragging within this many points of the list's top or bottom edge scrolls it, this many points a frame.
const EDGE = 48;
const SCROLL_STEP = 10;
// The list's header and footer spacers, past the last deck's cell.
const LIST_ENDS = 36;

export type DeckReorder = {
  enabled: boolean;
  // A deck is held: the list stops scrolling under the finger.
  dragging: boolean;
  // The list row of the held deck (-1 when none), so its cell is drawn above the others.
  liftedRow: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  // A drag ended a moment ago: opening a deck ignores a tap this soon after it (a release over a deck can read as one).
  recentlyDragged: () => boolean;
  from: SharedValue<number>;
  target: SharedValue<number>;
  armed: SharedValue<number>;
  held: SharedValue<number>;
  settle: SharedValue<number>;
  px: SharedValue<number>;
  py: SharedValue<number>;
  scroll: SharedValue<number>;
  startScroll: SharedValue<number>;
  shifts: SharedValue<Shift[]>;
  begin: (index: number) => void;
  commit: (from: number, to: number) => void;
};

// What the drag uses of the FlashList (its ref).
type ListHandle = {
  getLayout: (index: number) => SlotRect | undefined;
  getWindowSize: () => { height: number };
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
};

type Options = {
  // The decks on the list, in order; their cells are the list rows from `rowOffset`.
  ids: readonly string[];
  rowOffset: number;
  listRef: RefObject<ListHandle | null>;
  enabled: boolean;
  onReorder: (ids: string[], from: number, to: number) => void;
};

/** The state of a drag over the deck list, on the UI thread (shared values) and on the JS thread (begin and commit). */
export function useDeckReorder({ ids, rowOffset, listRef, enabled, onReorder }: Options): DeckReorder {
  const from = useSharedValue(-1);
  const target = useSharedValue(-1);
  const armed = useSharedValue(-1);
  const held = useSharedValue(0);
  const settle = useSharedValue(0);
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const scroll = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const viewport = useSharedValue(0);
  const edge = useSharedValue(0);
  const rects = useSharedValue<SlotRect[]>([]);
  const shifts = useSharedValue<Shift[]>([]);
  const [dragging, setDragging] = useState(false);
  const [liftedRow, setLiftedRow] = useState(-1);
  const offset = useRef(0);
  const maxOffset = useRef(0);
  const dragEnded = useRef(0);
  const resetOnOrder = useRef(false);
  const live = useRef({ ids, rowOffset, listRef, onReorder });
  useEffect(() => {
    live.current = { ids, rowOffset, listRef, onReorder };
  });

  function reset(): void {
    from.set(-1);
    target.set(-1);
    armed.set(-1);
    held.set(0);
    settle.set(0);
    px.set(0);
    py.set(0);
    edge.set(0);
    shifts.set([]);
    setDragging(false);
    setLiftedRow(-1);
  }

  // The list was re-read after a drop: the decks are in their new places, so the shifts that stood in for them end.
  const afterOrder = useEffectEvent(() => {
    if (!resetOnOrder.current) return;
    resetOnOrder.current = false;
    reset();
  });
  // Before paint, so the decks never show one frame at their new places with the old shifts still on them.
  useLayoutEffect(() => {
    afterOrder();
  }, [ids]);

  function begin(index: number): void {
    const current = live.current;
    const list = current.listRef.current;
    const slots = current.ids.map((_, at) => list?.getLayout(current.rowOffset + at));
    if (!list || slots.some((slot) => !slot)) return;
    const layouts = slots.map((slot) => ({ x: slot!.x, y: slot!.y, width: slot!.width, height: slot!.height }));
    const height = list.getWindowSize().height;
    const last = layouts[layouts.length - 1];
    viewport.set(height);
    maxOffset.current = last ? Math.max(0, last.y + last.height + LIST_ENDS - height) : 0;
    startScroll.set(offset.current);
    scroll.set(offset.current);
    rects.set(layouts);
    shifts.set(layouts.map(() => ({ x: 0, y: 0 })));
    from.set(index);
    target.set(index);
    setLiftedRow(current.rowOffset + index);
    setDragging(true);
    tickArmed();
  }

  function commit(start: number, to: number): void {
    tickLand();
    dragEnded.current = Date.now();
    const current = live.current;
    if (start === to || start < 0 || start >= current.ids.length) {
      reset();
      return;
    }
    resetOnOrder.current = true;
    current.onReorder(moveItem(current.ids, start, to), start, to);
  }

  // Where the held deck would land, and the shifts of the decks around it.
  useAnimatedReaction(
    () => {
      const start = from.get();
      if (start < 0 || held.get() === 1) return -1;
      const slots = rects.get();
      const own = slots[start];
      if (!own) return -1;
      return nearestSlot(slots, own.x + own.width / 2 + px.get(), own.y + own.height / 2 + py.get() + scroll.get() - startScroll.get());
    },
    (slot, before) => {
      if (slot < 0 || slot === before) return;
      target.set(slot);
      shifts.set(shiftsFor(rects.get(), from.get(), slot));
    },
  );

  // Near the list's top or bottom edge, in the direction of the drag, the list scrolls.
  useAnimatedReaction(
    () => {
      const start = from.get();
      const own = rects.get()[start];
      if (start < 0 || held.get() === 1 || !own) return 0;
      const top = own.y + py.get() - startScroll.get();
      if (py.get() < 0 && top < EDGE) return -1;
      if (py.get() > 0 && top + own.height > viewport.get() - EDGE) return 1;
      return 0;
    },
    (direction) => edge.set(direction),
  );

  useEffect(() => {
    if (!dragging) return;
    const timer = setInterval(() => {
      const direction = edge.get();
      const list = live.current.listRef.current;
      if (direction === 0 || !list) return;
      const next = Math.min(maxOffset.current, Math.max(0, offset.current + direction * SCROLL_STEP));
      if (next === offset.current) return;
      offset.current = next;
      scroll.set(next);
      list.scrollToOffset({ offset: next, animated: false });
    }, 16);
    return () => clearInterval(timer);
  }, [dragging, edge, scroll]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    offset.current = event.nativeEvent.contentOffset.y;
    scroll.set(offset.current);
  }

  function recentlyDragged(): boolean {
    return Date.now() - dragEnded.current < 400;
  }

  return { enabled, dragging, liftedRow, onScroll, recentlyDragged, from, target, armed, held, settle, px, py, scroll, startScroll, shifts, begin, commit };
}

const LiftedRow = createContext(-1);

/** Provides the held deck's list row to the cells under it. */
export function LiftedRowProvider({ row, children }: { row: number; children: ReactNode }) {
  return <LiftedRow.Provider value={row}>{children}</LiftedRow.Provider>;
}

/** The list's cell renderer (FlashList `CellRendererComponent`): the held deck's cell is drawn above its neighbours. */
export function DeckCell({ index, style, ...rest }: Omit<ViewProps, "ref"> & { index: number; ref?: Ref<ComponentRef<typeof View>> }) {
  const lifted = useContext(LiftedRow);
  return <View {...rest} style={[style, { zIndex: lifted === index ? 10 : 0 }]} />;
}

/**
 * One deck of the list under the drag gesture. At rest it is its cell as before. Held, it follows the finger, lifted; the decks
 * between it and its target slide one place, and on release it settles into the slot before the order is written. With reduced motion
 * the others and the settle snap; the held deck still follows the finger.
 */
export function ReorderItem({ reorder, index, children }: { reorder: DeckReorder; index: number; children: ReactNode }) {
  const { enabled, from, target, armed, held, settle, px, py, scroll, startScroll, shifts, begin, commit } = reorder;
  const reduced = useReduceMotion();
  const pan = Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      armed.set(index);
      scheduleOnRN(begin, index);
    })
    .onUpdate((event) => {
      px.set(event.translationX);
      py.set(event.translationY);
    })
    .onFinalize(() => {
      if (armed.get() !== index) return;
      armed.set(-1);
      if (from.get() !== index) {
        // Let go before the list answered: nothing moved.
        scheduleOnRN(commit, index, index);
        return;
      }
      const slot = target.get();
      held.set(1);
      if (reduced) {
        settle.set(1);
        scheduleOnRN(commit, index, slot);
        return;
      }
      settle.set(withTiming(1, { duration: SETTLE_MS }, () => scheduleOnRN(commit, index, slot)));
    });
  const style = useAnimatedStyle(() => {
    const start = from.get();
    if (start < 0) return { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }], shadowOpacity: 0 };
    const shift = shifts.get()[index];
    if (start !== index) {
      const x = shift?.x ?? 0;
      const y = shift?.y ?? 0;
      return { transform: [{ translateX: reduced ? x : withTiming(x, { duration: SHIFT_MS }) }, { translateY: reduced ? y : withTiming(y, { duration: SHIFT_MS }) }, { scale: 1 }], shadowOpacity: 0 };
    }
    const x = px.get();
    const y = py.get() + scroll.get() - startScroll.get();
    const k = settle.get();
    return {
      transform: [{ translateX: x + ((shift?.x ?? 0) - x) * k }, { translateY: y + ((shift?.y ?? 0) - y) * k }, { scale: LIFT_SCALE - (LIFT_SCALE - 1) * k }],
      shadowColor: "#000",
      shadowOpacity: 0.35 * (1 - k),
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    };
  });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
