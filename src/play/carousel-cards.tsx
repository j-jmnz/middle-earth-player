// The cards of the phase carousel (phase-carousel.tsx): one per phase, with its steps, what the player decides there and the action
// windows as Stop switches, on the night raised surface. Reading and the player's Stops settings only; nothing here sends an intent.
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import type { CarouselPhase, CarouselStep } from "./carousel.ts";
import { toggleStop, type TableSettings } from "./table-settings.ts";
import { tableTokens as t } from "./tokens.ts";

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

function StepBlock({
  step,
  settings,
  onChange,
  past,
}: {
  step: CarouselStep;
  settings: Pick<TableSettings, "stops">;
  onChange: (change: Partial<TableSettings>) => void;
  past: boolean;
}) {
  return (
    <View
      testID={`carousel-step-${step.id}`}
      style={{
        marginTop: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: step.current ? t.gold : "transparent",
        backgroundColor: step.current ? t.pressed : "transparent",
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text className="text-label font-semibold" style={{ color: past ? t.muted : t.bone }}>
        {step.current ? `${step.words}  · now` : step.words}
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
          dim={past}
        />
      ))}
    </View>
  );
}

export function PhaseCard({
  phase,
  width,
  settings,
  onChange,
}: {
  phase: CarouselPhase;
  width: number;
  settings: Pick<TableSettings, "stops">;
  onChange: (change: Partial<TableSettings>) => void;
}) {
  const past = phase.state === "past";
  const current = phase.state === "current";
  return (
    <View
      testID={`carousel-phase-${phase.id}`}
      style={{
        width,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: current ? t.goldLine : t.hairline,
        backgroundColor: current ? t.pressed : "transparent",
        paddingHorizontal: 10,
        paddingTop: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${phase.name} phase${past ? ", done this round" : current ? ", now" : ""}`}
          className="font-display text-body uppercase"
          style={{
            color: current ? t.gold : past ? t.muted : t.bone,
            lineHeight: 22,
          }}
        >
          {phase.name}
        </Text>
        {/* RingMark's done state (src/screens/chrome.tsx; src/play cannot import it): a solid gold ring. */}
        {past ? (
          <View
            testID={`carousel-done-${phase.id}`}
            accessibilityLabel="Done this round"
            accessible
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: t.gold,
            }}
          />
        ) : null}
      </View>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {phase.steps.map((step) => (
          <StepBlock key={step.id} step={step} settings={settings} onChange={onChange} past={past} />
        ))}
      </ScrollView>
    </View>
  );
}

