// The chrome's controls (docs/design-system.md, Components): the round glass button and its pill, text buttons, the primary and
// secondary plates, filter chips, the segmented switch and the search field. Every fill and text colour of a button is a style, not only a
// class. Re-exported by chrome.tsx.
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import { useMemo, type ReactNode } from "react";

import { Chevron, Magnifier } from "./chrome-marks";
import { usePalette } from "./palette-hook";
import { GameIcon } from "../play/game-icon";
import type { IconName } from "../play/icon-map";
import { accentPlate, glassSurface, rowSurface, segmentSurface, slateSurface, sunkSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { withAlphaHex } from "../play/tokens";
import { touch, useUiScale } from "../play/ui-scale";
import { Text, TextInput } from "../play/text";

// The night switch row the phase carousel's Stops and the Settings screen share (src/play cannot import screens, so it lives there).
export { SettingSwitch } from "../play/setting-switch";
// The segmented switch is shared the same way (src/play/segmented.tsx).
export { Segmented } from "../play/segmented";

/** The fill of a pressed button on night, and on paper, in the theme in force. */
export function usePressedNight() {
  const palette = usePalette();
  return useMemo(() => ({ backgroundColor: palette.pressed }), [palette]);
}

export function usePressedPaper() {
  const palette = usePalette();
  return useMemo(() => ({ backgroundColor: palette.paperPressed }), [palette]);
}

/**
 * The round glass button (Back, the gear, the book): 44 pt, a dark disc (a pale one on Light) with a soft shadow and one mark in the
 * accent: a chevron, a printed game icon or a glyph. It always carries a label, which a screen reader says. `overlay` is kept for the
 * callers over a picture; the glass reads over a picture and over the fog alike.
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
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: IconName;
  glyph?: string;
  // A mark the chrome draws (the gear), in the button's colour.
  mark?: (props: { color: string; size?: number }) => ReactNode;
  chevron?: boolean;
  overlay?: boolean;
  tone?: "bone" | "accent";
  // Set for a button that shows and hides something (Manage): a screen reader hears whether it is open.
  expanded?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const color = tone === "accent" ? palette.accent : palette.bone;
  const box = touch(s, 44);
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(expanded == null ? {} : { accessibilityState: { expanded } })}
      onPress={onPress}
      hitSlop={4 * s}
    >
      {({ pressed }) => (
        <View style={{ width: box, height: box, borderRadius: box / 2, alignItems: "center", justifyContent: "center", ...glassSurface(pressed, t) }}>
          {chevron ? (
            <Chevron color={color} />
          ) : mark ? (
            mark({ color, size: 20 })
          ) : icon ? (
            <GameIcon name={icon} size={18 * s} tint={tone === "accent" ? "accent" : "bone"} />
          ) : (
            <Text style={{ color, fontSize: 20 * s, lineHeight: 22 * s, fontWeight: "700" }}>{glyph}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

/** A pill on the glass of the top bar holding a word (History): 40 pt tall, round ends, body type in the accent. */
export function PillButton({ label, onPress, testID, accessibilityLabel }: { label: string; onPress: () => void; testID: string; accessibilityLabel?: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} hitSlop={{ top: 2 * s, bottom: 2 * s }}>
      {({ pressed }) => (
        <View style={{ minHeight: 40 * s, borderRadius: 20 * s, paddingHorizontal: 14 * s, alignItems: "center", justifyContent: "center", ...glassSurface(pressed, t) }}>
          <Text className="text-body" style={{ color: t.muted }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  testID,
  tone = "bone",
  accessibilityLabel,
  selected,
  expanded,
  icon,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  // Danger is for an action that cannot be undone (Delete a playthrough).
  tone?: "bone" | "accent" | "ink" | "danger" | "muted";
  // A printed icon before the word, in the word's colour (Full path, Campaign log, New playthrough on Campaigns).
  icon?: IconName;
  // What a screen reader says when the visible word is not enough alone ("Booklet" opens the campaign book).
  accessibilityLabel?: string;
  // Set for a text option in a radio group (the No boon decline): the button is a radio with this selected state.
  selected?: boolean;
  // Set for a button that shows and hides a group (Archived · n): a screen reader hears whether it is open.
  expanded?: boolean;
}) {
  const pressedNight = usePressedNight();
  const pressedPaper = usePressedPaper();
  const s = useUiScale();
  const color = tone === "accent" ? "text-accent" : tone === "ink" ? "text-inkLabel" : tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : "text-bone";
  const word = <Text className={`text-body font-medium ${color}`}>{label}</Text>;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole={selected == null ? "button" : "radio"}
      {...(selected == null && expanded == null ? {} : { accessibilityState: selected == null ? { expanded } : { selected } })}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className="min-h-touch items-center justify-center rounded-tile px-3"
      style={({ pressed }) => (pressed ? (tone === "ink" ? pressedPaper : pressedNight) : undefined)}
    >
      {icon ? (
        <View className="flex-row items-center gap-2">
          <GameIcon name={icon} size={16 * s} tint={tone === "ink" ? "inkLabel" : tone} />
          {word}
        </View>
      ) : (
        word
      )}
    </Pressable>
  );
}

const buttonLabelOf = (s: number, size: number) => ({ fontSize: size * s, lineHeight: size * 1.25 * s, letterSpacing: (size >= 20 ? 2.5 : 1.6) * s });

/**
 * The one filled action on a screen: wraith-light silver on Dark, elven green on Light, square corners, a lit top edge and a glow
 * under it, its word in Marcellus SC. A press darkens it about 8% and sinks it 1 pt. On paper it is an ink plate. Disabled is a flat
 * night plate with faint words; the sentence above it says why.
 */
export function PrimaryButton({
  label,
  onPress,
  testID,
  disabled = false,
  surface = "night",
  accessibilityLabel,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
  surface?: "night" | "paper";
  accessibilityLabel?: string;
  // 44 pt with a 16 pt word: the table's action panel and a tray's foot.
  compact?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const paper = surface === "paper";
  // The fill and the text colour are styles, not only classes: on the phone a class on a Pressable whose style is a function
  // can be dropped (user report, 2026-10-25). The pressed state comes from the Pressable's children.
  const fill = (pressed: boolean) =>
    disabled
      ? paper
        ? { borderWidth: 1, borderColor: withAlphaHex(palette.inkLine, 0.5) }
        : { backgroundColor: withAlphaHex(palette.raised, 0.9) }
      : paper
        ? { backgroundColor: palette.ink, opacity: pressed ? 0.85 : 1 }
        : accentPlate(pressed, t);
  const color = disabled ? (paper ? palette.inkMuted : palette.faint) : paper ? palette.paper : palette.onAccent;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          className="items-center justify-center rounded-button px-5"
          style={{ minHeight: (compact ? 44 : 54) * s, ...fill(pressed), transform: [{ translateY: pressed && !disabled ? 1 : 0 }] }}
        >
          <Text className="font-display text-center" style={{ ...buttonLabelOf(s, compact ? 16 : 20), color }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * A plate for the actions beside the primary (Path, Log, Change, Add cards): slate lit from above with a short shadow and no drawn
 * edge, its word in Marcellus SC in the accent, an optional printed icon before it. `icon` alone (no label shown) makes the 54 pt
 * square icon plate. `tone` colours the word: danger for a loss.
 */
export function SecondaryButton({
  label,
  onPress,
  testID,
  icon,
  tone = "accent",
  compact = false,
  iconOnly = false,
  accessibilityLabel,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: IconName;
  tone?: "bone" | "accent" | "danger";
  // 44 pt, not 54: a plate in a card's head or a row.
  compact?: boolean;
  // The square icon plate: the icon alone, the label said to a screen reader.
  iconOnly?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const color = disabled ? palette.faint : tone === "accent" ? palette.accent : tone === "danger" ? palette.danger : palette.bone;
  const height = compact ? touch(s, 44) : 54 * s;
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
      {({ pressed }) => (
        <View
          className="flex-row items-center justify-center gap-2 rounded-tile"
          style={{ minHeight: height, ...(iconOnly ? { width: height } : { paddingHorizontal: 16 * s }), ...slateSurface(pressed && !disabled, t), transform: [{ translateY: pressed && !disabled ? 1 : 0 }] }}
        >
          {icon ? <GameIcon name={icon} size={(iconOnly ? 22 : 15) * s} tint={disabled ? "faint" : tone === "danger" ? "danger" : tone === "accent" ? "accent" : "bone"} /> : null}
          {iconOnly ? null : (
            <Text className="font-display" style={{ fontSize: (compact ? 15 : 17) * s, lineHeight: (compact ? 19 : 22) * s, letterSpacing: 1 * s, color }}>
              {label}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

/** A text field sunk into the ground: a magnifier when it searches, the words, no edge, and nothing that reads as a button. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
  accessibilityLabel,
  search = true,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  testID: string;
  accessibilityLabel: string;
  // False for a field that takes a value rather than searching (a RingsDB link): no magnifier.
  search?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  return (
    <View className="min-h-touch min-w-0 flex-1 flex-row items-center gap-2.5 rounded-tile px-3.5" style={sunkSurface(t)}>
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
        className="min-h-touch min-w-0 flex-1 text-body text-bone"
      />
    </View>
  );
}

/** A filter that is on or off (All, Ready, a card type): a lit plate with an accent bar along its foot when on, a dark wash when off. 44 pt target. */
export function ToggleChip({
  label,
  selected,
  onPress,
  testID,
  leading,
  accessibilityLabel,
  onLayout,
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
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const on = selected === true;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      {...(selected == null ? {} : { accessibilityState: { selected } })}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onLayout={onLayout}
      className="min-h-touch min-w-touch justify-center"
    >
      {({ pressed }) => (
        <View
          className="h-9 min-w-touch flex-row items-center justify-center gap-1.5 rounded-tile px-3"
          style={on ? { ...segmentSurface(t), boxShadow: `inset 0 -2px 0 ${palette.accentHigh}, ${segmentSurface(t).boxShadow}` } : rowSurface(pressed, t)}
        >
          {leading}
          <Text className={`text-label ${on ? "font-semibold" : ""}`} style={{ color: on ? palette.bone : palette.muted }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
