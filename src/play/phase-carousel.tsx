// The strip a tap on the phase rail opens (docs/design-system.md, Table; phase 20): the round's seven phases as cards in a
// horizontal snap-scroll, centered on the current one, each with its steps, what the player decides there and the action
// windows as Stop switches; the master Stops switch sits at its head. It is for reading: a night raised surface with a hairline,
// not paper. The data is carousel.ts. The only things it changes are the player's Stops settings (table-settings.ts); it sends
// no intent. It drops in on open and leaves on close (MOTION.carouselEnter, MOTION.carouselLeave), snaps under reduced motion, and
// nothing animates while it scrolls.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";

import { cardWidth, startIndex, STOP_AHEAD_WORDS, STOPS_TEXT, type Carousel } from "./carousel.ts";
import { NightSwitch, PhaseCard, ROW } from "./carousel-cards.tsx";
import { useOpenMotion } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import { Chevron } from "./phase-rail.tsx";
import type { TableSettings } from "./table-settings.ts";
import { tableTokens as t } from "./tokens.ts";

// The strip drops in by this much (translateY -12 to 0 with a fade).
const DROP = 12;
const GAP = 10;

// The head: Earlier and Later chevrons (44 pt, one at each side, clear of the cards' text) around the master Stops switch, and
// the gold S's meaning while a stop is ahead.
function CarouselHead({
  settings,
  stopAhead,
  index,
  last,
  onChange,
  onGo,
}: {
  settings: Pick<TableSettings, "stopsOn">;
  stopAhead: boolean;
  index: number;
  last: number;
  onChange: (change: Partial<TableSettings>) => void;
  onGo: (to: number) => void;
}) {
  const arrow = (step: -1 | 1) => {
    const off = index + step < 0 || index + step > last;
    return (
      <Pressable
        testID={step < 0 ? "carousel-previous" : "carousel-next"}
        accessibilityRole="button"
        accessibilityLabel={step < 0 ? "Earlier phase" : "Later phase"}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => onGo(index + step)}
        style={{ width: ROW, height: ROW, alignItems: "center", justifyContent: "center", opacity: off ? 0.25 : 1 }}
      >
        <Chevron direction={step < 0 ? "previous" : "next"} color={t.bone} />
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
      {arrow(-1)}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NightSwitch label="Stops" hint={STOPS_TEXT} value={settings.stopsOn} onChange={(stopsOn) => onChange({ stopsOn })} testID="carousel-stops" />
        </View>
        {stopAhead ? (
          <View testID="carousel-stop-ahead" accessible accessibilityLabel={STOP_AHEAD_WORDS} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text className="font-display-bold text-label text-gold">S</Text>
            <Text className="text-label" style={{ color: t.muted }}>
              {STOP_AHEAD_WORDS}
            </Text>
          </View>
        ) : null}
      </View>
      {arrow(1)}
    </View>
  );
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
  // The index as the scroll handlers last set it, so a change of width keeps the strip on the same card.
  const at = useRef(start);
  const choose = (to: number) => {
    at.current = to;
    setIndex(to);
  };
  const go = (next: number) => {
    const to = Math.max(0, Math.min(last, next));
    choose(to);
    scroll.current?.scrollTo({ x: to * interval, y: 0, animated: !reduceMotion });
  };
  useEffect(() => {
    scroll.current?.scrollTo({ x: at.current * interval, y: 0, animated: false });
  }, [interval]);
  return (
    <View style={{ flex: 1 }}>
      <CarouselHead settings={settings} stopAhead={carousel.stopAhead} index={index} last={last} onChange={onChange} onGo={go} />
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
          scroll.current?.scrollTo({ x: start * interval, y: 0, animated: false });
        }}
        onMomentumScrollEnd={(event) => choose(Math.max(0, Math.min(last, Math.round(event.nativeEvent.contentOffset.x / interval))))}
        contentContainerStyle={{ paddingHorizontal: Math.max(0, (width - card) / 2), gap: GAP }}
      >
        {carousel.phases.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} width={card} settings={settings} onChange={onChange} />
        ))}
      </ScrollView>
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
  const { progress, leaving } = useOpenMotion(open, MOTION.carouselEnter, MOTION.carouselLeave);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (progress.get() - 1) * DROP }],
  }));
  if (!open && !leaving) return null;
  return (
    <View style={{ position: "absolute", top, left: 0, right: 0, bottom: 0 }} pointerEvents={open ? "auto" : "none"}>
      <Pressable
        testID="carousel-scrim"
        accessibilityRole="button"
        accessibilityLabel="Close the phase list"
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
        <CarouselCards carousel={carousel} width={width} settings={settings} onChange={onChange} />
      </Animated.View>
    </View>
  );
}
