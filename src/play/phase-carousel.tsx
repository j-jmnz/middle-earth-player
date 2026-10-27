// The strip a tap on the phase rail opens (docs/design-system.md, Table; phase 20): the round's seven phases as cards in a
// horizontal snap-scroll, centered on the current one, each with its steps, what the player decides there and the action
// windows as Stop switches; the round's track and the master Stops switch sit at its head. It is for reading: a lit night panel
// floating over the canvas with a hairline, not paper. The data is carousel.ts. The only things it changes are the player's Stops settings (table-settings.ts); it sends
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
import { raisedEdge, tileSurface } from "./surfaces.ts";
import { tableTokens as t, withAlphaHex } from "./tokens.ts";

// The strip drops in by this much (translateY -12 to 0 with a fade).
const DROP = 12;
const GAP = 10;
// The strip floats this far inside the canvas and under the top bar, a lit panel of its own rather than a slab hung off the bar.
const INSET = 8;

// The round as seven segments under the head's words: deep gold for the phases done, gold for the game's, a hairline for those to
// come. The one the strip rests on stands taller, so the track says both where the game is and which card is being read.
function RoundTrack({ phases, index }: { phases: Carousel["phases"]; index: number }) {
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 6, marginTop: 4 }}>
      {phases.map((phase, at) => (
        <View
          key={phase.id}
          style={{
            flex: 1,
            height: at === index ? 5 : 3,
            borderRadius: 3,
            backgroundColor: phase.state === "current" ? t.gold : phase.state === "past" ? t.goldDeep : t.hairline,
          }}
        />
      ))}
    </View>
  );
}

// The head: Earlier and Later chevrons (44 pt, one at each side, clear of the cards' text) around the round and the card being read
// over the round's track, the gold S's meaning while a stop is ahead, and the master Stops switch.
function CarouselHead({
  carousel,
  settings,
  index,
  onChange,
  onGo,
}: {
  carousel: Carousel;
  settings: Pick<TableSettings, "stopsOn">;
  index: number;
  onChange: (change: Partial<TableSettings>) => void;
  onGo: (to: number) => void;
}) {
  const last = carousel.phases.length - 1;
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
        style={({ pressed }) => ({ width: ROW, height: ROW, borderRadius: ROW / 2, alignItems: "center", justifyContent: "center", opacity: off ? 0.25 : 1, backgroundColor: pressed ? t.pressed : "transparent" })}
      >
        <Chevron direction={step < 0 ? "previous" : "next"} color={t.bone} />
      </Pressable>
    );
  };
  const shown = carousel.phases[index];
  const where = carousel.round > 0 ? `Round ${carousel.round}` : "Before the round";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 4, gap: 4 }}>
      {arrow(-1)}
      <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityLabel={shown ? `${where}. Phase ${index + 1} of ${carousel.phases.length}, ${shown.name}` : where}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text numberOfLines={1} className="font-display-bold text-micro uppercase" style={{ color: t.muted }}>
            {where}
          </Text>
          <Text numberOfLines={1} className="text-micro" style={{ color: t.faint }}>
            {`Phase ${index + 1} of ${carousel.phases.length}`}
          </Text>
        </View>
        <RoundTrack phases={carousel.phases} index={index} />
      </View>
      {carousel.stopAhead ? (
        <View testID="carousel-stop-ahead" accessible accessibilityLabel={STOP_AHEAD_WORDS} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: t.gold, alignItems: "center", justifyContent: "center" }}>
            <Text className="font-display-bold text-micro text-gold" style={{ lineHeight: 14 }}>
              S
            </Text>
          </View>
          <Text numberOfLines={1} className="text-label" style={{ color: t.muted }}>
            {STOP_AHEAD_WORDS}
          </Text>
        </View>
      ) : null}
      <View style={{ marginLeft: 8, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: t.hairline }}>
        <NightSwitch label="Stops" hint={STOPS_TEXT} value={settings.stopsOn} onChange={(stopsOn) => onChange({ stopsOn })} testID="carousel-stops" />
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
      <CarouselHead carousel={carousel} settings={settings} index={index} onChange={onChange} onGo={go} />
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
        style={{ marginTop: 6 }}
        contentContainerStyle={{ paddingHorizontal: Math.max(0, (width - card) / 2), paddingBottom: INSET, gap: GAP }}
      >
        {carousel.phases.map((phase, at) => (
          <PhaseCard key={phase.id} phase={phase} number={at + 1} width={card} focused={at === index} settings={settings} onChange={onChange} />
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
  const inner = width - 2 * INSET;
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
            top: INSET / 2,
            left: left + INSET,
            width: inner,
            height: height - INSET / 2,
            borderRadius: 18,
            ...tileSurface(),
            boxShadow: `${raisedEdge}, 0 10px 28px ${withAlphaHex(t.night, 0.6)}`,
            overflow: "hidden",
          },
          motion,
        ]}
      >
        <CarouselCards carousel={carousel} width={inner} settings={settings} onChange={onChange} />
      </Animated.View>
    </View>
  );
}
