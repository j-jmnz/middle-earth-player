// The cards of the phase carousel (phase-carousel.tsx): one per phase, numbered in the round, with its steps on a timeline, what the
// player decides there and the action windows as Stop switches. Reading and the player's Stops settings only; nothing here sends an intent.
import { useRef, type ComponentRef } from "react";
import { ScrollView, Text, View } from "react-native";

import type { CarouselPhase, CarouselStep } from "./carousel.ts";
import { toggleStop, type TableSettings } from "./table-settings.ts";
import { SettingSwitch } from "./setting-switch.tsx";
import { accentSurface, panelSurface } from "./surfaces.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

// The 44 pt target; callers draw it through `touch(s, ROW)`.
export const ROW = 44;

// A small capsule beside the current phase's name: "Now" in accent.
function NowChip() {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: t.accent, paddingHorizontal: 6 * s, backgroundColor: withAlphaHex(t.accent, 0.14) }}>
      <Text className="font-display-bold text-micro uppercase" style={{ color: t.accent, lineHeight: 15 * s }}>
        Now
      </Text>
    </View>
  );
}

// The step's place on the card's timeline: a dot (accent and ringed now, deep accent when done, an outline to come) on a hairline
// that runs on to the next step.
function StepDot({ state, last }: { state: "past" | "current" | "next"; last: boolean }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View style={{ width: 14 * s, alignItems: "center" }}>
      <View
        style={{
          marginTop: 5 * s,
          width: (state === "current" ? 10 : 8) * s,
          height: (state === "current" ? 10 : 8) * s,
          borderRadius: 5 * s,
          borderWidth: state === "next" ? 1.5 * s : 0,
          borderColor: t.muted,
          backgroundColor: state === "current" ? t.accent : state === "past" ? t.accentDeep : "transparent",
          boxShadow: state === "current" ? `0 0 0 ${3 * s}px ${withAlphaHex(t.accent, 0.22)}` : undefined,
        }}
      />
      {last ? null : <View style={{ flex: 1, width: 1, marginTop: 3 * s, backgroundColor: t.hairline }} />}
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
  const s = useUiScale();
  const now = state === "current";
  return (
    <View
      testID={`carousel-step-${step.id}`}
      onLayout={onLayoutY ? (event) => onLayoutY(event.nativeEvent.layout.y) : undefined}
      style={{ flexDirection: "row", gap: 8 * s }}
    >
      <StepDot state={state} last={last} />
      <View
        style={{
          flex: 1,
          marginBottom: last ? 0 : 6 * s,
          borderRadius: 10 * s,
          paddingHorizontal: now ? 8 * s : 0,
          paddingVertical: (now ? 6 : 1) * s,
          marginLeft: now ? -4 * s : 0,
          backgroundColor: now ? withAlphaHex(t.accent, 0.08) : "transparent",
          borderWidth: now ? 1 : 0,
          borderColor: withAlphaHex(t.accent, 0.45),
        }}
      >
        <Text accessibilityLabel={now ? `${step.words}, now` : undefined} className="text-label font-semibold" style={{ color: state === "past" ? t.muted : now ? t.accentHigh : t.bone }}>
          {step.words}
        </Text>
        <Text className="text-label" style={{ color: t.muted }}>
          {step.decision}
        </Text>
        {step.windows.map((window) => (
          <SettingSwitch
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
 * One phase: its number and name (accent with a Now chip when current, muted with an accent done disc when past), then its steps on a
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
  const s = useUiScale();
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
        borderRadius: 14 * s,
        borderWidth: 1,
        borderColor: current ? t.accentLine : t.hairline,
        ...(current ? panelSurface(false, t) : { backgroundColor: withAlphaHex(t.night, 0.35) }),
        opacity: focused ? 1 : 0.55,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * s, paddingHorizontal: 12 * s, paddingTop: 10 * s, paddingBottom: 8 * s }}>
        {/* The phase's place in the round, in a disc: worked accent now, a deep accent edge when done, a hairline to come. */}
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 22 * s,
            height: 22 * s,
            borderRadius: 11 * s,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: current ? 0 : 1,
            borderColor: past ? t.accentDeep : t.hairline,
            ...(current ? accentSurface(false, t) : {}),
          }}
        >
          <Text className="font-display-bold text-micro" style={{ color: current ? t.onAccent : past ? t.accent : t.muted, lineHeight: 15 * s }}>
            {String(number)}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${phase.name} phase${past ? ", done this round" : current ? ", now" : ""}`}
          numberOfLines={1}
          className="flex-1 font-display-bold text-body uppercase"
          style={{ color: current ? t.accent : past ? t.muted : t.bone, lineHeight: 22 * s, letterSpacing: 0.6 * s }}
        >
          {phase.name}
        </Text>
        {current ? <NowChip /> : null}
        {/* RingMark's done state (src/screens/chrome-marks.tsx; src/play cannot import it): a disc of worked accent. */}
        {past ? (
          <View
            testID={`carousel-done-${phase.id}`}
            accessibilityLabel="Done this round"
            accessible
            style={{ flexDirection: "row", alignItems: "center", gap: 5 * s }}
          >
            <View style={{ width: 10 * s, height: 10 * s, borderRadius: 5 * s, ...accentSurface(false, t) }} />
            <Text className="text-micro" style={{ color: t.muted }}>
              Done
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ height: 1, marginHorizontal: 12 * s, backgroundColor: current ? withAlphaHex(t.accent, 0.25) : t.hairline }} />
      <ScrollView ref={scroll} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={{ paddingHorizontal: 12 * s, paddingTop: 10 * s, paddingBottom: 12 * s }}>
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
