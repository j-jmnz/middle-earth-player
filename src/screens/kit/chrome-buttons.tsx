// The chrome's controls (docs/design-system.md, Components): the round glass button and its capsule, the primary, secondary and text
// buttons (src/ui/buttons.tsx), filter chips, the segmented switch and the search field. Every control is a capsule. Re-exported by
// chrome.tsx.
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import { useMemo, type ReactNode } from "react";

import { Chevron, Magnifier } from "./chrome-marks";
import { usePalette } from "./palette-hook";
import { GameIcon } from "../../ui/game-icon";
import type { IconName } from "../../ui/icon-map";
import { CONTROL_RADIUS } from "../../ui/radius";
import { chipSurface, glassSurface, sunkSurface } from "../../ui/surfaces";
import { useTableTokens } from "../../ui/use-table-tokens";
import { touch, useUiScale } from "../../ui/ui-scale";
import { Text, TextInput } from "../../ui/text";
import { GlassIconButton } from "../../ui/buttons";
import { withSound } from "../../ui/sound/sound";
import type { SoundSlot } from "../../ui/sound/slots";

// The night switch row the phase carousel's Stops and the Settings screen share (src/play cannot import screens, so it lives there).
export { SettingSwitch } from "../../ui/setting-switch";
// The segmented switch and the word buttons are shared the same way (src/ui/segmented.tsx, src/ui/buttons.tsx).
export { Segmented } from "../../ui/segmented";
export { PrimaryButton, PrimaryFace, SecondaryButton, TextButton } from "../../ui/buttons";

/** The fill of a pressed button on night, and on paper, in the theme in force. */
export function usePressedNight() {
  const palette = usePalette();
  return useMemo(() => ({ backgroundColor: palette.pressed }), [palette]);
}

/**
 * The round glass button (Back, the gear, the book): 44 pt, a dark disc (a pale one on Light) and one mark in the
 * accent: a chevron, a printed game icon or a glyph. It always carries a label, which a screen reader says. It is the table's
 * `GlassIconButton` (src/ui/buttons.tsx) with a mark built from its icon, glyph or chevron.
 */
export function IconButton({
  label,
  onPress,
  testID,
  icon,
  glyph,
  mark,
  chevron = false,
  tone = "accent",
  expanded,
  sound,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: IconName;
  glyph?: string;
  // A mark the chrome draws (the gear), in the button's colour.
  mark?: (props: { color: string; size?: number }) => ReactNode;
  chevron?: boolean;
  tone?: "bone" | "accent";
  // Set for a button that shows and hides something (Manage): a screen reader hears whether it is open.
  expanded?: boolean;
  // The tap's sound: the click by default, Back's for a chevron, the open sound for Settings.
  sound?: SoundSlot;
}) {
  const s = useUiScale();
  return (
    <GlassIconButton
      label={label}
      onPress={onPress}
      testID={testID}
      tone={tone}
      expanded={expanded}
      sound={sound ?? (chevron ? "ui.back" : undefined)}
      slop={4 * s}
      mark={(color) =>
        chevron ? (
          <Chevron color={color} />
        ) : mark ? (
          mark({ color, size: 20 })
        ) : icon ? (
          <GameIcon name={icon} size={18 * s} tint={tone === "accent" ? "accent" : "bone"} />
        ) : (
          <Text style={{ color, fontSize: 20 * s, lineHeight: 22 * s, fontWeight: "700" }}>{glyph}</Text>
        )
      }
    />
  );
}

/** The glass capsule for a word (History, Manage, Import, Packs): 44 pt tall, body type in muted. */
export function PillButton({ label, onPress, testID, accessibilityLabel, accessibilityHint }: { label: string; onPress: () => void; testID: string; accessibilityLabel?: string; accessibilityHint?: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={accessibilityHint} onPress={withSound(onPress, "ui.confirm")}>
      {({ pressed }) => (
        <View style={{ minHeight: touch(s, 44), minWidth: touch(s, 44), borderRadius: CONTROL_RADIUS, paddingHorizontal: 14 * s, alignItems: "center", justifyContent: "center", ...glassSurface(pressed, t) }}>
          <Text className="text-body" style={{ color: t.muted }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * A capsule text field on the tonal fill: a magnifier when it searches, the words, no edge, and nothing that reads as a button. A
 * search that holds text ends with a clear mark (`<testID>-clear`, a 44 pt target spoken as "Clear search") that empties it.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
  accessibilityLabel,
  accessibilityHint,
  search = true,
  minWidth,
  onFocus,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  testID: string;
  accessibilityLabel: string;
  // What the field searches, said after its name.
  accessibilityHint?: string;
  // False for a field that takes a value rather than searching (a RingsDB link): no magnifier.
  search?: boolean;
  // The narrowest the field gets: in a row that wraps, the field then moves to its own line instead of shrinking to nothing.
  minWidth?: number;
  onFocus?: () => void;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const clears = search && value !== "";
  return (
    <View className={`min-h-touch min-w-0 flex-1 flex-row items-center gap-2.5 rounded-control pl-4 ${clears ? "pr-0" : "pr-4"}`} style={minWidth == null ? sunkSurface(t) : { ...sunkSurface(t), minWidth }}>
      {search ? <Magnifier color={palette.faint} /> : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.faint}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onFocus={onFocus}
        className="min-h-touch min-w-0 flex-1 text-body text-bone"
      />
      {clears ? (
        <Pressable testID={`${testID}-clear`} accessibilityRole="button" accessibilityLabel="Clear search" onPress={withSound(() => onChangeText(""), "ui.confirm")} className="min-h-touch min-w-touch items-center justify-center">
          <Text className="text-body text-muted">{"\u2715"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// A chip that switches plays the switch's sound for where it goes; one that goes somewhere plays the click.
function chipSound(selected: boolean | undefined): SoundSlot {
  if (selected == null) return "ui.confirm";
  return selected ? "ui.toggle-off" : "ui.toggle-on";
}

/** A filter that is on or off (All, Ready, a card type): a 36 pt capsule in a 44 pt target, tonal when off and tinted in the accent when on. */
export function ToggleChip({
  label,
  selected,
  onPress,
  testID,
  leading,
  accessibilityLabel,
  onLayout,
  asSwitch = false,
}: {
  label: string;
  // Left out for a chip that goes somewhere rather than switching (the deck editor's jump chips): no on or off state is said.
  selected?: boolean;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
  accessibilityLabel?: string;
  // A row that scrolls to a chip reads where it sits.
  onLayout?: (event: LayoutChangeEvent) => void;
  // A chip that switches a setting rather than choosing a value (Applied only): a screen reader hears a switch that is on or off.
  asSwitch?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const on = selected === true;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole={asSwitch ? "switch" : "button"}
      {...(selected == null ? {} : { accessibilityState: asSwitch ? { checked: selected } : { selected } })}
      {...(selected != null && asSwitch ? { "aria-checked": selected } : {})}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={withSound(onPress, chipSound(selected))}
      onLayout={onLayout}
      className="min-h-touch min-w-touch justify-center"
    >
      {({ pressed }) => (
        // The capsule radius is in the style, as on the Segmented thumb (segmented.tsx): a class radius was drawn square on Android when the fill changed.
        <View className="min-w-touch flex-row items-center justify-center gap-1.5 px-3.5" style={{ height: 36 * s, borderRadius: 18 * s, ...chipSurface(on, pressed, t) }}>
          {leading}
          <Text className={`text-label ${on ? "font-semibold" : ""}`} style={{ color: on ? palette.accentHigh : palette.muted }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
