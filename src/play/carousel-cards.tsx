// The cards of the phase carousel (phase-carousel.tsx): one per phase, numbered in the round, with its steps on a timeline, what the
// player decides there and the action windows as Stop switches. Reading and the player's Stops settings only; nothing here sends an intent.
import { useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import type { CarouselPhase, CarouselStep } from "./carousel.ts";
import { toggleStop, type TableSettings } from "./table-settings.ts";
import { goldSurface, panelSurface } from "./surfaces.ts";
import { withAlphaHex } from "./tokens.ts";
import { useTableTokens } from "./use-table-tokens.ts";

export const ROW = 44;

// A switch on the night surface: its whole row is one 44 pt target, the label and detail heard with it.
export function NightSwitch({
  label,
  detail,
  hint,
  value,
  onChange,
  testID,
  dim = false,
}: {
  label: string;
  detail?: string;
  // What a screen reader adds to the label; the detail when none.
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
  dim?: boolean;
}) {
  const t = useTableTokens();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint ?? detail}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({
        minHeight: ROW,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        backgroundColor: pressed ? t.pressed : "transparent",
        opacity: dim ? 0.75 : 1,
      })}
    >
      <View className="shrink" importantForAccessibility="no-hide-descendants">
        <Text className="text-label font-medium" style={{ color: t.bone }}>
          {label}
        </Text>
        {detail ? (
          <Text className="text-label" style={{ color: t.muted }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessible={false}
        importantForAccessibility="no"
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.hairline, true: t.goldLine }}
        thumbColor={value ? t.gold : t.muted}
        ios_backgroundColor={t.hairline}
      />
    </Pressable>
  );
}

// A small capsule beside the current phase's name: "Now" in gold.
function NowChip() {
  const t = useTableTokens();
  return (
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: t.gold, paddingHorizontal: 6, backgroundColor: withAlphaHex(t.gold, 0.14) }}>
      <Text className="font-display-bold text-micro uppercase" style={{ color: t.gold, lineHeight: 15 }}>
        Now
      </Text>
    </View>
  );
}

// The step's place on the card's timeline: a dot (gold and ringed now, deep gold when done, an outline to come) on a hairline
// that runs on to the next step.
function StepDot({ state, last }: { state: "past" | "current" | "next"; last: boolean }) {
  const t = useTableTokens();
  return (
    <View style={{ width: 14, alignItems: "center" }}>
      <View
        style={{
          marginTop: 5,
          width: state === "current" ? 10 : 8,
          height: state === "current" ? 10 : 8,
          borderRadius: 5,
          borderWidth: state === "next" ? 1.5 : 0,
          borderColor: t.muted,
          backgroundColor: state === "current" ? t.gold : state === "past" ? t.goldDeep : "transparent",
          boxShadow: state === "current" ? `0 0 0 3px ${withAlphaHex(t.gold, 0.22)}` : undefined,
        }}
      />
      {last ? null : <View style={{ flex: 1, width: 1, marginTop: 3, backgroundColor: t.hairline }} />}
    </View>
  );
}

function StepBlock({
  step,
  settings,
  onChange,
  state,
  last,
  onLayoutY,
}: {
  step: CarouselStep;
  settings: Pick<TableSettings, "stops">;
  onChange: (change: Partial<TableSettings>) => void;
  // Where the step stands against the game's: done, the engine's own, or to come.
  state: "past" | "current" | "next";
  last: boolean;
  // Called with the step's top inside its card: the current step's, so the card can open on it.
  onLayoutY?: (y: number) => void;
}) {
  const t = useTableTokens();
  const now = state === "current";
  return (
    <View
      testID={`carousel-step-${step.id}`}
      onLayout={onLayoutY ? (event) => onLayoutY(event.nativeEvent.layout.y) : undefined}
      style={{ flexDirection: "row", gap: 8 }}
    >
      <StepDot state={state} last={last} />
      <View
        style={{
          flex: 1,
          marginBottom: last ? 0 : 6,
          borderRadius: 10,
          paddingHorizontal: now ? 8 : 0,
          paddingVertical: now ? 6 : 1,
          marginLeft: now ? -4 : 0,
          backgroundColor: now ? withAlphaHex(t.gold, 0.08) : "transparent",
          borderWidth: now ? 1 : 0,
          borderColor: withAlphaHex(t.gold, 0.45),
        }}
      >
        <Text accessibilityLabel={now ? `${step.words}, now` : undefined} className="text-label font-semibold" style={{ color: state === "past" ? t.muted : now ? t.goldHigh : t.bone }}>
          {step.words}
        </Text>
        <Text className="text-label" style={{ color: t.muted }}>
          {step.decision}
        </Text>
        {step.windows.map((window) => (
          <NightSwitch
            key={window.id}
            label={`Stop: ${window.title}`}
            detail={window.note}
            value={window.stop}
            onChange={() => onChange({ stops: toggleStop(settings.stops, window.id) })}
            testID={`carousel-stop-${window.id}`}
            dim={state === "past"}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * One phase: its number and name (gold with a Now chip when current, muted with a gold done disc when past), then its steps on a
 * timeline. `focused` is the card the strip rests on; the others step back so the one being read stands out.
 */
export function PhaseCard({
  phase,
  number,
  width,
  focused,
  settings,
  onChange,
}: {
  phase: CarouselPhase;
  number: number;
  width: number;
  focused: boolean;
  settings: Pick<TableSettings, "stops">;
  onChange: (change: Partial<TableSettings>) => void;
}) {
  const t = useTableTokens();
  const past = phase.state === "past";
  const current = phase.state === "current";
  const nowAt = phase.steps.findIndex((step) => step.current);
  // The current card opens on its current step, so the step and its Stop switch show on a short phone.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  return (
    <View
      testID={`carousel-phase-${phase.id}`}
      style={{
        width,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: current ? t.goldLine : t.hairline,
        ...(current ? panelSurface(false, t) : { backgroundColor: withAlphaHex(t.night, 0.35) }),
        opacity: focused ? 1 : 0.55,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
        {/* The phase's place in the round, in a disc: worked gold now, a deep gold edge when done, a hairline to come. */}
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: current ? 0 : 1,
            borderColor: past ? t.goldDeep : t.hairline,
            ...(current ? goldSurface(false, t) : {}),
          }}
        >
          <Text className="font-display-bold text-micro" style={{ color: current ? t.onGold : past ? t.gold : t.muted, lineHeight: 15 }}>
            {String(number)}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${phase.name} phase${past ? ", done this round" : current ? ", now" : ""}`}
          numberOfLines={1}
          className="flex-1 font-display-bold text-body uppercase"
          style={{ color: current ? t.gold : past ? t.muted : t.bone, lineHeight: 22, letterSpacing: 0.6 }}
        >
          {phase.name}
        </Text>
        {current ? <NowChip /> : null}
        {/* RingMark's done state (src/screens/chrome-marks.tsx; src/play cannot import it): a disc of worked gold. */}
        {past ? (
          <View
            testID={`carousel-done-${phase.id}`}
            accessibilityLabel="Done this round"
            accessible
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, ...goldSurface(false, t) }} />
            <Text className="text-micro" style={{ color: t.muted }}>
              Done
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ height: 1, marginHorizontal: 12, backgroundColor: current ? withAlphaHex(t.gold, 0.25) : t.hairline }} />
      <ScrollView ref={scroll} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
        {phase.steps.map((step, index) => (
          <StepBlock
            key={step.id}
            step={step}
            settings={settings}
            onChange={onChange}
            state={past || (current && nowAt >= 0 && index < nowAt) ? "past" : current && index === nowAt ? "current" : "next"}
            last={index === phase.steps.length - 1}
            onLayoutY={step.current && current ? (y) => scroll.current?.scrollTo({ y, animated: false }) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}
