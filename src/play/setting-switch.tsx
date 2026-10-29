// The one switch row on the night surface (docs/design-system.md, Components): the phase carousel's Stops and the Settings screen's rows
// are this same row, so the two do not drift apart. src/screens re-exports it through chrome-buttons.tsx.
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
 */
function SwitchMark({ value }: { value: boolean }) {
  const t = useTableTokens();
  const s = useUiScale();
  const light = t.depth === "light";
  const width = 46 * s;
  const height = 26 * s;
  const knob = 20 * s;
  const track = value
    ? {
        backgroundColor: t.accent,
        backgroundImage: `linear-gradient(180deg, ${light ? t.primaryTop : t.accentHigh} 0%, ${t.accentDeep} 100%)`,
        boxShadow: light ? `0 2px 6px ${withAlphaHex(t.shade, 0.25)}` : `0 0 12px ${withAlphaHex(t.glow, 0.35)}`,
      }
    : { backgroundColor: light ? t.pressed : t.dusk, boxShadow: `inset 0 1px 3px ${withAlphaHex(t.shade, light ? 0.3 : 0.9)}` };
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width, height, borderRadius: height / 2, justifyContent: "center", ...track }}>
      <View
        style={{
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          marginLeft: value ? width - knob - 3 * s : 3 * s,
          backgroundColor: value ? t.onAccent : t.faint,
          boxShadow: `0 1px 3px ${withAlphaHex(t.shade, 0.5)}`,
        }}
      />
    </View>
  );
}

// A switch on the night surface: its whole row is one 44 pt target, the label and detail heard with it.
export function SettingSwitch({
  label,
  detail,
  hint,
  value,
  onChange,
  testID,
  dim = false,
  roomy = false,
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
}) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint ?? detail}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({
        minHeight: touch(s, ROW),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12 * s,
        paddingVertical: roomy ? 6 * s : 0,
        backgroundColor: pressed ? withAlphaHex(t.pressed, 0.6) : "transparent",
        opacity: dim ? 0.75 : 1,
      })}
    >
      <View className="shrink" importantForAccessibility="no-hide-descendants">
        <Text className={roomy ? "text-body font-semibold" : "text-label font-semibold"} style={{ color: t.bone }}>
          {label}
        </Text>
        {detail ? (
          <Text className="text-label" style={{ color: t.muted, marginTop: roomy ? 2 * s : 0 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <SwitchMark value={value} />
    </Pressable>
  );
}
