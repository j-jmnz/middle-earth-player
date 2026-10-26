// The strip a tap on the phase rail opens (docs/design-system.md, Table; phase 20): the round's seven phases as cards in a
// horizontal snap-scroll, centered on the current one, each with its steps, what the player decides there and the action
// windows as Stop switches; the master Stops switch sits at its head. It is for reading: a night raised surface with a hairline,
// not paper. The data is carousel.ts. The only things it changes are the player's Stops settings (table-settings.ts); it sends
// no intent. It drops in on open and leaves on close, snaps under reduced motion, and nothing animates while it scrolls.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { Carousel } from "./carousel.ts";
import { NightSwitch, PhaseCard, ROW } from "./carousel-cards.tsx";
import { Chevron } from "./phase-rail.tsx";
import type { TableSettings } from "./table-settings.ts";
import { tableTokens as t } from "./tokens.ts";

// Motion values for phase 23's motion-tokens.ts: the strip drops in 240 ms ease-out (translateY -12 to 0 with a fade) and
// leaves in 180 ms.
const ENTER_MS = 240;
const LEAVE_MS = 180;
const DROP = 12;
const GAP = 10;
const CARD_MIN = 230;
const CARD_MAX = 340;

/** The card's width for a strip `width` wide: about 58% of it, so the neighbors show at the sides. */
export function cardWidth(width: number): number {
  return Math.round(Math.min(CARD_MAX, Math.max(CARD_MIN, width * 0.58)));
}

/** The index the strip starts on: the current phase; the first before Resource, the last after Refresh. */
export function startIndex(carousel: Carousel): number {
  const at = carousel.phases.findIndex((phase) => phase.state === "current");
  if (at >= 0) return at;
  return carousel.phases[0]?.state === "past" ? carousel.phases.length - 1 : 0;
}

function CarouselCards({
  carousel,
  width,
  settings,
  onChange,
}: {
  carousel: Carousel;
  width: number;
  settings: Pick<TableSettings, "stops" | "stopsOn">;
  onChange: (change: Partial<TableSettings>) => void;
}) {
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const placed = useRef(false);
  const card = cardWidth(width);
  const interval = card + GAP;
  const last = carousel.phases.length - 1;
  // Where the strip opens: fixed at mount, so a re-render never moves it.
  const [start] = useState(() => startIndex(carousel));
  const [index, setIndex] = useState(start);
  const go = (next: number) => {
    const to = Math.max(0, Math.min(last, next));
    setIndex(to);
    scroll.current?.scrollTo({
      x: to * interval,
      y: 0,
      animated: !reduceMotion,
    });
  };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        testID="carousel-scroll"
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={interval}
        snapToAlignment="start"
        contentOffset={{ x: start * interval, y: 0 }}
        onContentSizeChange={() => {
          // Android ignores contentOffset: place the strip on the current phase once its cards are laid out.
          if (placed.current) return;
          placed.current = true;
          scroll.current?.scrollTo({
            x: start * interval,
            y: 0,
            animated: false,
          });
        }}
        onMomentumScrollEnd={(event) => setIndex(Math.max(0, Math.min(last, Math.round(event.nativeEvent.contentOffset.x / interval))))}
        contentContainerStyle={{
          paddingHorizontal: Math.max(0, (width - card) / 2),
          gap: GAP,
        }}
      >
        {carousel.phases.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} width={card} settings={settings} onChange={onChange} />
        ))}
      </ScrollView>
      {[-1, 1].map((step) => {
        const target = index + step;
        const off = target < 0 || target > last;
        return (
          <Pressable
            key={step}
            testID={step < 0 ? "carousel-previous" : "carousel-next"}
            accessibilityRole="button"
            accessibilityLabel={step < 0 ? "Earlier phase" : "Later phase"}
            accessibilityState={{ disabled: off }}
            disabled={off}
            onPress={() => go(target)}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              [step < 0 ? "left" : "right"]: 0,
              width: ROW,
              alignItems: "center",
              justifyContent: "center",
              opacity: off ? 0.25 : 1,
            }}
          >
            <Chevron direction={step < 0 ? "previous" : "next"} color={t.bone} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The strip, absolutely placed under the top bar over the canvas (`left`, `width`: the canvas, so the dock stays clear) with the
 * layer behind it that closes it on a tap outside (`onClose`). Render it where the table's other overlays are; it draws nothing
 * while closed.
 */
export function PhaseCarousel({
  open,
  carousel,
  settings,
  top,
  left,
  width,
  height,
  onChange,
  onClose,
}: {
  open: boolean;
  carousel: Carousel;
  settings: Pick<TableSettings, "stops" | "stopsOn">;
  top: number;
  left: number;
  width: number;
  height: number;
  onChange: (change: Partial<TableSettings>) => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  // Mounted while it leaves (`leaving`), set while rendering when `open` turns off, as the table menu does.
  const [wasOpen, setWasOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && !reduceMotion);
  }
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    if (open)
      progress.set(
        reduceMotion
          ? 1
          : withTiming(1, {
              duration: ENTER_MS,
              easing: Easing.out(Easing.cubic),
            }),
      );
    else if (reduceMotion) progress.set(0);
    else {
      progress.set(
        withTiming(0, { duration: LEAVE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(setLeaving, false);
        }),
      );
    }
  }, [open, reduceMotion, progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (progress.get() - 1) * DROP }],
  }));
  if (!open && !leaving) return null;
  return (
    <View style={{ position: "absolute", top, left: 0, right: 0, bottom: 0 }} pointerEvents={open ? "auto" : "none"}>
      <Pressable
        testID="carousel-scrim"
        accessible={false}
        importantForAccessibility="no"
        onPress={onClose}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Animated.View
        testID="phase-carousel"
        accessibilityViewIsModal
        style={[
          {
            position: "absolute",
            top: 0,
            left,
            width,
            height,
            backgroundColor: t.raised,
            borderColor: t.hairline,
            borderWidth: 1,
            borderTopWidth: 0,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            overflow: "hidden",
          },
          motion,
        ]}
      >
        <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <NightSwitch
            label="Stops"
            detail="Pass the action windows that are not stops, unless a card usable there is new."
            hint="Pass the action windows that are not stops, unless a card usable there is new. Planning, the commit, Responses and every choice still ask."
            value={settings.stopsOn}
            onChange={(stopsOn) => onChange({ stopsOn })}
            testID="carousel-stops"
          />
        </View>
        <CarouselCards carousel={carousel} width={width} settings={settings} onChange={onChange} />
      </Animated.View>
    </View>
  );
}
