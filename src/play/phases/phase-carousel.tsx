// The panel a tap on the phase rail opens (docs/design-system-table.md; phase 20): the round's seven phases in a column at the left
// ("Round 3" above them), and at the right the steps of the phase being read on a dot timeline, each step's action windows as Stop
// switches on their rows, the Stops switch for the whole table at the top right. A tap on a phase shows its steps; the game's own phase
// is shown on open. It is for reading: a lit night panel floating over the canvas with 20 pt corners, not paper. The data is
// carousel.ts. The only things it changes are the player's Stops settings (table-settings.ts); it sends no intent. It drops in on open and
// leaves on close (MOTION.carouselEnter, MOTION.carouselLeave), snaps under reduced motion, and nothing animates while it scrolls.
import { useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { startIndex, STOP_AHEAD_WORDS, STOPS_TEXT, type Carousel } from "./carousel.ts";
import { CAROUSEL_FOOT, CAROUSEL_INSET, ROUND_HEAD } from "./carousel-size.ts";
import { PhaseRow, ROW, StepBlock } from "./carousel-columns.tsx";
import { SettingSwitch } from "../../ui/setting-switch.tsx";
import { useOpenMotion } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import type { TableSettings } from "../../ui/table-settings.ts";
import { CONTAINER_RADIUS, CONTROL_RADIUS } from "../../ui/radius.ts";
import { floatingSurface, raisedEdgeOf } from "../../ui/surfaces.ts";
import { withAlphaHex } from "../../ui/tokens.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

// The panel drops in by this much (translateY -12 to 0 with a fade).
const DROP = 12;
// The panel floats this far inside the canvas and under the top bar (carousel-size.ts), a lit panel of its own rather than a slab hung off the bar.
const INSET = CAROUSEL_INSET;
// The phase column's width: about a third of the panel, at least wide enough for "Encounter" and its dot, at most this.
const PHASES_MIN = 132;
const PHASES_MAX = 168;

// The accent S in a wash, with its words: a stop of the player's lies ahead in this phase.
function StopAhead() {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View testID="carousel-stop-ahead" accessible accessibilityLabel={STOP_AHEAD_WORDS} style={{ flexDirection: "row", alignItems: "center", gap: 6 * s }}>
      <View style={{ width: 18 * s, height: 18 * s, borderRadius: CONTROL_RADIUS, backgroundColor: withAlphaHex(t.accent, 0.18), alignItems: "center", justifyContent: "center" }}>
        <Text className="font-display text-micro text-accent" style={{ lineHeight: 14 * s }}>
          S
        </Text>
      </View>
      <Text numberOfLines={1} className="shrink text-label" style={{ color: t.muted }}>
        {STOP_AHEAD_WORDS}
      </Text>
    </View>
  );
}

function CarouselBody({ carousel, width, settings, onChange }: { carousel: Carousel; width: number; settings: Pick<TableSettings, "stops" | "stopsOn">; onChange: (change: Partial<TableSettings>) => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  // The phase being read: the game's own on open (fixed at mount, so a re-render never moves it), then the one tapped.
  const [index, setIndex] = useState(() => startIndex(carousel));
  const phases = useRef<ComponentRef<typeof ScrollView>>(null);
  const steps = useRef<ComponentRef<typeof ScrollView>>(null);
  const shown = carousel.phases[index];
  const nowAt = shown ? shown.steps.findIndex((step) => step.current) : -1;
  const current = shown?.state === "current";
  const where = carousel.round > 0 ? `Round ${carousel.round}` : "Before the round";
  const left = Math.min(PHASES_MAX * s, Math.max(PHASES_MIN * s, Math.round(width * 0.34)));
  const row = touch(s, ROW);
  return (
    <View style={{ flex: 1, flexDirection: "row", paddingHorizontal: 4 * s, paddingBottom: CAROUSEL_FOOT * s }}>
      <View style={{ width: left }}>
        {/* The round's label: Marcellus SC (small caps) in label type on one line, clear of the panel's 20 pt corner. */}
        <View style={{ height: ROUND_HEAD * s, justifyContent: "center", paddingLeft: (CONTAINER_RADIUS - 4) * s, paddingRight: 8 * s }}>
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="font-display text-micro" style={{ color: t.muted, letterSpacing: 1.2 * s }}>
            {where}
          </Text>
        </View>
        <ScrollView ref={phases} testID="carousel-scroll" nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {carousel.phases.map((phase, at) => (
            <PhaseRow
              key={phase.id}
              phase={phase}
              selected={at === index}
              onPress={() => setIndex(at)}
              // The game's own phase opens in view: the column scrolls to it, one row of room above.
              onLayoutY={at === index ? (y) => phases.current?.scrollTo({ y: Math.max(0, y - row), animated: false }) : undefined}
            />
          ))}
        </ScrollView>
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingLeft: 8 * s }}>
        <View style={{ height: row, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 * s, paddingRight: 8 * s }}>
          {carousel.stopAhead ? <StopAhead /> : null}
          <SettingSwitch label="Stops" hint={STOPS_TEXT} value={settings.stopsOn} onChange={(stopsOn) => onChange({ stopsOn })} testID="carousel-stops" />
        </View>
        {/* Keyed on the phase, so each one opens at its top (the game's own on its current step). */}
        <ScrollView key={shown?.id} ref={steps} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar style={{ flex: 1 }} contentContainerStyle={{ paddingRight: 8 * s, paddingBottom: 4 * s }}>
          {shown?.steps.map((step, at) => (
            <StepBlock
              key={step.id}
              step={step}
              settings={settings}
              onChange={onChange}
              state={shown.state === "past" || (current && nowAt >= 0 && at < nowAt) ? "past" : current && at === nowAt ? "current" : "next"}
              last={at === shown.steps.length - 1}
              onLayoutY={step.current && current ? (y) => steps.current?.scrollTo({ y, animated: false }) : undefined}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * The panel, absolutely placed under the top bar over the canvas (`left`, `width`: the canvas, so the dock stays clear) with the
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
  // The data of the panel; null while there is none to show (it is built only while the panel is open, and held while it leaves).
  carousel: Carousel | null;
  settings: Pick<TableSettings, "stops" | "stopsOn">;
  top: number;
  left: number;
  width: number;
  height: number;
  onChange: (change: Partial<TableSettings>) => void;
  onClose: () => void;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const { progress, leaving } = useOpenMotion(open, MOTION.carouselEnter, MOTION.carouselLeave);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (progress.get() - 1) * DROP * s }],
  }));
  if ((!open && !leaving) || !carousel) return null;
  const inner = width - 2 * INSET * s;
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
            top: (INSET * s) / 2,
            left: left + INSET * s,
            width: inner,
            height: height - (INSET * s) / 2,
            borderRadius: CONTAINER_RADIUS * s,
            ...floatingSurface(t),
            boxShadow: `${raisedEdgeOf(t)}, 0 10px 28px ${withAlphaHex(t.night, 0.6)}`,
            overflow: "hidden",
          },
          motion,
        ]}
      >
        <CarouselBody carousel={carousel} width={inner} settings={settings} onChange={onChange} />
      </Animated.View>
    </View>
  );
}
