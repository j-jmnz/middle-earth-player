// The one switch row on the night surface (docs/design-system.md, Components; user request, 2026-10-28): the phase carousel's Stops and the
// Settings screen's rows are this same row, so the two do not drift apart. src/screens re-exports it through chrome-buttons.tsx.
import { Pressable, Switch, Text, View } from "react-native";

import { useTheme } from "./theme.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

// The 44 pt target; drawn through `touch(s, ROW)`.
const ROW = 44;

// A switch on the night surface: its whole row is one 44 pt target, the label and detail heard with it. The track is hairline when
// off and the gold line when on.
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
  // The Settings page's row: a body-size title and room above and below. The carousel keeps the dense row.
  roomy?: boolean;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  // The off track holds 3:1 against the Daylight page (the hairline is 1.3:1 there); Dark keeps the hairline.
  const off = useTheme() === "light" ? t.faint : t.hairline;
  return (
    <Pressable
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
        backgroundColor: pressed ? t.pressed : "transparent",
        opacity: dim ? 0.75 : 1,
      })}
    >
      <View className="shrink" importantForAccessibility="no-hide-descendants">
        <Text className={roomy ? "text-body" : "text-label font-medium"} style={{ color: t.bone }}>
          {label}
        </Text>
        {detail ? (
          <Text className="text-label" style={{ color: t.muted, marginTop: roomy ? 2 * s : 0 }}>
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
        trackColor={{ false: off, true: t.goldLine }}
        thumbColor={value ? t.gold : t.muted}
        ios_backgroundColor={off}
        // react-native-web draws the on thumb from activeThumbColor (teal by default); the RN types do not list it.
        {...({ activeThumbColor: t.gold } as object)}
      />
    </Pressable>
  );
}
