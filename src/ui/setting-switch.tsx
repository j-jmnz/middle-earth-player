// The one switch row (docs/design-system.md, Components): the phase carousel's Stops and the Settings screen's rows, on night, and the
// card pool's filter sheet, on paper, are this same row, so they do not drift apart. src/screens re-exports it through chrome-buttons.tsx.
import { Pressable, View } from "react-native";

import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { withAlphaHex } from "./tokens.ts";
import { Text } from "./text.tsx";

// The 44 pt target; drawn through `touch(s, ROW)`.
const ROW = 44;

/**
 * The Carved Stone switch, 46 × 26 with a round knob: on, a lit accent track with a glow and a dark knob; off, a sunk track and a
 * grey knob. A drawing, not the platform's Switch, so it looks the same on every platform; the row is the control.
 * The Collection rows draw it at the end of a row that unfolds, as a control of its own, with a dash while only some of the row
 * is owned (src/screens/collection/owned-row.tsx).
 */
export function SwitchMark({ value, paper, mixed }: { value: boolean; paper: boolean; mixed?: boolean }) {
  const t = useTableTokens();
  const s = useUiScale();
  const light = t.depth === "light";
  const width = 46 * s;
  const height = 26 * s;
  const knob = 20 * s;
  const track = paper
    ? { backgroundColor: value ? t.ink : withAlphaHex(t.ink, 0.18) }
    : value
    ? {
        backgroundColor: t.accent,
        backgroundImage: `linear-gradient(180deg, ${light ? t.primaryTop : t.accentHigh} 0%, ${t.accentDeep} 100%)`,
        boxShadow: light ? `0 2px 6px ${withAlphaHex(t.shade, 0.25)}` : `0 0 12px ${withAlphaHex(t.glow, 0.35)}`,
      }
    : { backgroundColor: light ? t.pressed : t.dusk, boxShadow: `inset 0 1px 3px ${withAlphaHex(t.shade, light ? 0.3 : 0.9)}` };
  // Partly on (some packs of a cycle, on the night surface only): a dash in the middle of a track between off and on.
  if (mixed) {
    return (
      <View importantForAccessibility="no-hide-descendants" style={{ width, height, borderRadius: height / 2, alignItems: "center", justifyContent: "center", backgroundColor: t.accentLine }}>
        <View style={{ width: knob, height: 4 * s, borderRadius: 2 * s, backgroundColor: t.onAccent }} />
      </View>
    );
  }
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width, height, borderRadius: height / 2, justifyContent: "center", ...track }}>
      <View
        style={{
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          marginLeft: value ? width - knob - 3 * s : 3 * s,
          backgroundColor: paper ? (value ? t.paper : t.inkMuted) : value ? t.onAccent : t.faint,
          ...(paper ? {} : { boxShadow: `0 1px 3px ${withAlphaHex(t.shade, 0.5)}` }),
        }}
      />
    </View>
  );
}

// A switch on the night surface, or on paper (`surface`): its whole row is one 44 pt target, the label and detail heard with it.
export function SettingSwitch({
  label,
  detail,
  hint,
  value,
  onChange,
  testID,
  dim = false,
  roomy = false,
  surface = "night",
}: {
  label: string;
  detail?: string;
  // What a screen reader adds to the label; the detail when none.
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID: string;
  dim?: boolean;
  // The Settings page's row: a title in semibold body type and room above and below. The carousel keeps the dense row.
  roomy?: boolean;
  surface?: "night" | "paper";
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const paper = surface === "paper";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint ?? detail}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({
        minHeight: touch(s, ROW),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12 * s,
        paddingVertical: roomy ? 6 * s : 0,
        backgroundColor: pressed ? (paper ? t.paperPressed : withAlphaHex(t.pressed, 0.6)) : "transparent",
        opacity: dim ? 0.75 : 1,
      })}
    >
      <View className="shrink" importantForAccessibility="no-hide-descendants">
        <Text className={roomy ? "text-body font-semibold" : "text-label font-semibold"} style={{ color: paper ? t.ink : t.bone }}>
          {label}
        </Text>
        {detail ? (
          <Text className="text-label" style={{ color: paper ? t.inkMuted : t.muted, marginTop: roomy ? 2 * s : 0 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <SwitchMark value={value} paper={paper} />
    </Pressable>
  );
}
