// The two columns of the phase carousel (phase-carousel.tsx): the round's seven phases as rows, and the steps of the phase being read on a
// plain dot timeline, each step's action windows as Stop switches on rows of their own. Reading and the player's Stops settings only;
// nothing here sends an intent.
import { Pressable, View } from "react-native";

import type { CarouselPhase, CarouselStep } from "./carousel.ts";
import { PHASE_ROW, phaseSlop } from "./carousel-size.ts";
import { toggleStop, type TableSettings } from "./table-settings.ts";
import { SettingSwitch } from "./setting-switch.tsx";
import { ITEM_RADIUS } from "./radius.ts";
import { chipOnSurface } from "./surfaces.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// The 44 pt target; callers draw it through `touch(s, ROW)`.
export const ROW = 44;

// A phase's place against the game's, as a dot: accent now, deep accent when done, an outline to come. The same dots mark the steps.
function PhaseDot({ state }: { state: CarouselPhase["state"] }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 8 * s,
        height: 8 * s,
        borderRadius: 4 * s,
        borderWidth: state === "next" ? 1.5 * s : 0,
        borderColor: t.muted,
        backgroundColor: state === "current" ? t.accent : state === "past" ? t.accentDeep : "transparent",
      }}
    />
  );
}

/**
 * One of the round's seven phases, a row of the left column, PHASE_ROW tall with a hit slop that makes up the 44 pt target (seven rows and
 * the round's label must fit the shortest tables, carousel-size.ts): its dot and its name in Marcellus SC (accent when it is the game's, bone to
 * come, muted when done). The phase being read is washed in accent; a tap on a row shows that phase's steps.
 */
export function PhaseRow({ phase, selected, onPress, onLayoutY }: { phase: CarouselPhase; selected: boolean; onPress: () => void; onLayoutY?: (y: number) => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const past = phase.state === "past";
  const current = phase.state === "current";
  const slop = phaseSlop(s);
  return (
    <Pressable
      testID={`carousel-phase-${phase.id}`}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={`${phase.name} phase${past ? ", done this round" : current ? ", now" : ""}`}
      accessibilityHint="Shows its steps"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop }}
      onLayout={onLayoutY ? (event) => onLayoutY(event.nativeEvent.layout.y) : undefined}
    >
      {({ pressed }) => (
        <View
          style={{
            height: PHASE_ROW * s,
            flexDirection: "row",
            alignItems: "center",
            gap: 10 * s,
            paddingHorizontal: 12 * s,
            borderRadius: ITEM_RADIUS * s,
            ...(pressed ? { backgroundColor: t.pressed } : selected ? chipOnSurface(t) : { backgroundColor: "transparent" }),
          }}
        >
          <PhaseDot state={phase.state} />
          <Text numberOfLines={1} className="flex-1 font-display text-body uppercase" style={{ color: current ? t.accent : past ? t.muted : t.bone, lineHeight: 22 * s, letterSpacing: 0.6 * s }}>
            {phase.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// The step's place on the timeline: a dot (accent with a soft ring now, deep accent when done, an outline to come) on a line to the next step.
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

/** One step of the phase being read: its rule titles, what the player decides, and its action windows as Stop switches. */
export function StepBlock({
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
  // Called with the step's top inside its column: the current step's, so the column can open on it.
  onLayoutY?: (y: number) => void;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const now = state === "current";
  return (
    <View testID={`carousel-step-${step.id}`} onLayout={onLayoutY ? (event) => onLayoutY(event.nativeEvent.layout.y) : undefined} style={{ flexDirection: "row", gap: 8 * s }}>
      <StepDot state={state} last={last} />
      <View style={{ flex: 1, minWidth: 0, marginBottom: last ? 0 : 8 * s, paddingVertical: 1 * s }}>
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
