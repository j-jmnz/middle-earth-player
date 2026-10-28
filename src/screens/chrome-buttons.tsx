// The chrome's controls (docs/design-system.md, Components): the round icon button, text buttons, the primary and secondary
// plates, filter chips, the segmented switch and the search field. Every fill and text colour of a button is a style, not only a
// class. Re-exported by chrome.tsx.
import { Pressable, Text, TextInput, View } from "react-native";
import { useMemo, type ReactNode } from "react";

import { Chevron, Magnifier } from "./chrome-marks";
import { usePalette } from "./palette-hook";
import { GameIcon } from "../play/game-icon";
import type { IconName } from "../play/icon-map";
import { goldPlate, goldSurface, raisedEdgeOf, slateSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { withAlphaHex } from "../play/tokens";
import { touch, touchSlop, useUiScale } from "../play/ui-scale";

// The night switch row the phase carousel's Stops and the Settings screen share (src/play cannot import screens, so it lives there).
export { SettingSwitch } from "../play/setting-switch";

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
 * A round 44 pt button holding one mark: a chevron, a printed game icon or a glyph. It always carries a label, which a screen
 * reader says. `overlay` sits it on a picture: a night disc with a light ring, so it reads over a bright sky.
 */
export function IconButton({
  label,
  onPress,
  testID,
  icon,
  glyph,
  chevron = false,
  overlay = false,
  tone = "bone",
  expanded,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: IconName;
  glyph?: string;
  chevron?: boolean;
  overlay?: boolean;
  tone?: "bone" | "gold";
  // Set for a button that shows and hides something (Manage): a screen reader hears whether it is open.
  expanded?: boolean;
}) {
  const palette = usePalette();
  const s = useUiScale();
  const color = tone === "gold" ? palette.gold : palette.bone;
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
        <View
          style={{
            width: box,
            height: box,
            borderRadius: box / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? palette.pressed : overlay ? withAlphaHex(palette.night, 0.6) : withAlphaHex(palette.raised, 0.7),
            borderWidth: 1,
            borderColor: overlay ? withAlphaHex(palette.bone, 0.16) : palette.hairline,
          }}
        >
          {chevron ? <Chevron color={color} /> : icon ? <GameIcon name={icon} size={18 * s} tint={tone === "gold" ? "gold" : "bone"} /> : <Text style={{ color, fontSize: 20 * s, lineHeight: 22 * s, fontWeight: "700" }}>{glyph}</Text>}
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
}: {
  label: string;
  onPress: () => void;
  testID: string;
  // Danger is for an action that cannot be undone (Delete a playthrough).
  tone?: "bone" | "gold" | "ink" | "danger" | "muted";
  // What a screen reader says when the visible word is not enough alone ("Booklet" opens the campaign book).
  accessibilityLabel?: string;
  // Set for a text option in a radio group (the No boon decline): the button is a radio with this selected state.
  selected?: boolean;
  // Set for a button that shows and hides a group (Archived · n): a screen reader hears whether it is open.
  expanded?: boolean;
}) {
  const pressedNight = usePressedNight();
  const pressedPaper = usePressedPaper();
  const color = tone === "gold" ? "text-gold" : tone === "ink" ? "text-inkLabel" : tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : "text-bone";
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
      <Text className={`text-body font-medium ${color}`}>{label}</Text>
    </Pressable>
  );
}

const buttonLabelOf = (s: number) => ({ fontSize: 15 * s, lineHeight: 20 * s, letterSpacing: 2.4 * s });

/**
 * The one filled action on a screen: worked gold with a lit top edge and a soft glow, engraved capitals. It sinks a little
 * when pressed. On paper it is an ink plate. Disabled is a flat night plate with faint words; the sentence above it says why.
 */
export function PrimaryButton({
  label,
  onPress,
  testID,
  disabled = false,
  surface = "night",
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
  surface?: "night" | "paper";
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const paper = surface === "paper";
  // The fill and the text colour are styles, not only classes: on the phone a class on a Pressable whose style is a function
  // can be dropped, which left a gold pill as dark text on night (user report, 2026-10-25). The pressed state comes from the
  // Pressable's children.
  const fill = (pressed: boolean) =>
    disabled
      ? paper
        ? { borderWidth: 1, borderColor: palette.inkLine }
        : { backgroundColor: palette.raised }
      : paper
        ? { backgroundColor: palette.ink, opacity: pressed ? 0.85 : 1 }
        : goldPlate(pressed, t);
  const color = disabled ? (paper ? palette.inkMuted : palette.faint) : paper ? palette.paper : palette.onGold;
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
        <View className="items-center justify-center rounded-button px-6" style={{ minHeight: 56 * s, ...fill(pressed), transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] }}>
          <Text className="font-display-bold uppercase" style={{ ...buttonLabelOf(s), color }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * A plate for the actions beside the primary (Path, Log, Change, Add cards): slate lit from above with no drawn edge, engraved
 * capitals, an optional printed icon before the word. `tone` colours the word: gold for a link to read, danger for a loss.
 */
export function SecondaryButton({
  label,
  onPress,
  testID,
  icon,
  tone = "bone",
  compact = false,
  accessibilityLabel,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: IconName;
  tone?: "bone" | "gold" | "danger";
  // 44 pt, not 52: a plate in a card's head or a row.
  compact?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const color = disabled ? palette.faint : tone === "gold" ? palette.gold : tone === "danger" ? palette.danger : palette.bone;
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
      {({ pressed }) => (
        <View
          className="flex-row items-center justify-center gap-2 rounded-tile px-4"
          style={{ minHeight: compact ? touch(s, 44) : 52 * s, ...slateSurface(pressed && !disabled, t), boxShadow: raisedEdgeOf(t) }}
        >
          {icon ? <GameIcon name={icon} size={15 * s} tint={tone === "gold" ? "gold" : tone === "danger" ? "danger" : "bone"} /> : null}
          <Text className="font-display-bold uppercase" style={{ fontSize: 13 * s, lineHeight: 18 * s, letterSpacing: 1.6 * s, color }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** A text field sunk into the night: a magnifier when it searches, the words, and nothing that reads as a button. */
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
  return (
    <View className="min-h-touch min-w-0 flex-1 flex-row items-center gap-2.5 rounded-tile px-3.5" style={{ backgroundColor: palette.night, borderWidth: 1, borderColor: palette.hairline }}>
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

/** Two or three mutually exclusive words in a sunk night track. Selected is a slate plate in a gold edge, semibold. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
  stretch = false,
  compact = false,
  words,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  testIDPrefix: string;
  // Fill the width, each word an equal share (Easy / Normal on the briefing).
  stretch?: boolean;
  // A 36 pt track in label type, its 44 pt targets kept by a vertical hit slop: a view switch beside a count.
  compact?: boolean;
  // What each option says when its stored word is not the word to read ("system" says "Follow system"); the test id keeps the option.
  words?: Partial<Record<T, string>>;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  // The compact button is 32 pt tall (min-h-8) times the scale; a vertical slop makes up a 44 pt target at every scale.
  const slop = touchSlop(s, 32 * s);
  return (
    <View accessibilityRole="radiogroup" className={`flex-row rounded-tile ${compact ? "p-0.5" : "p-1"} ${stretch ? "" : "self-start"}`} style={{ backgroundColor: palette.night, borderWidth: 1, borderColor: palette.hairline }}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            testID={`${testIDPrefix}-${option.toLowerCase()}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            hitSlop={compact ? { top: slop, bottom: slop } : undefined}
            className={`items-center justify-center rounded-chip ${compact ? "min-h-8 px-3" : "min-h-touch px-4"} ${stretch ? "flex-1" : ""}`}
            style={selected ? { ...slateSurface(false, t), borderWidth: 1, borderColor: palette.goldLine, boxShadow: raisedEdgeOf(t) } : { borderWidth: 1, borderColor: "transparent" }}
          >
            <Text className={`${compact ? "text-label" : "text-body"} ${selected ? "font-semibold text-bone" : "text-muted"}`}>{words?.[option] ?? option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A filter that is on or off (All, Ready, a sphere, a card type): gold plate when on, a hairline outline when off. 44 pt target. */
export function ToggleChip({
  label,
  selected,
  onPress,
  testID,
  leading,
  accessibilityLabel,
}: {
  label: string;
  // Left out for a chip that goes somewhere rather than switching (the deck editor's jump chips): no on or off state is said.
  selected?: boolean;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
  accessibilityLabel?: string;
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
      className="min-h-touch min-w-touch justify-center"
    >
      {({ pressed }) => (
        <View
          className="h-9 min-w-touch flex-row items-center justify-center gap-1.5 rounded-tile px-3"
          style={on ? { ...goldSurface(pressed, t), borderWidth: 1, borderColor: palette.goldDeep } : { backgroundColor: pressed ? palette.pressed : "transparent", borderWidth: 1, borderColor: palette.hairline }}
        >
          {leading}
          <Text className={`text-label ${on ? "font-semibold" : ""}`} style={{ color: on ? palette.onGold : palette.muted }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
