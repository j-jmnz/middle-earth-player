// The three word buttons of the chrome (docs/design-system.md, Components): the primary, the secondary and the text button. They live in
// src/play because the table's dock, its sheets and its settings panel draw them too and src/play cannot import src/screens;
// chrome-buttons.tsx re-exports them. The glass button (round icon, capsule for a word) is IconButton / PillButton there, on
// `glassSurface`; the table's own round glass button, for a mark drawn as views (the menu's dots, a panel's ✕), is GlassIconButton here. Every button is a capsule and draws no glow, lit edge, shadow or ring: depth is tone alone. A press darkens the
// primary about 8% and sinks it 1 pt, and fills the others. A disabled button keeps its shape at DISABLED_OPACITY, and the sentence
// beside it says why. Every fill and text colour is a style, not only a class: on the phone a class on a Pressable whose style is a
// function can be dropped (user report, 2026-10-25), so the pressed state comes from the Pressable's children.
import { Pressable, useWindowDimensions, View, type ViewStyle } from "react-native";
import type { ComponentRef, ReactNode, Ref } from "react";

import { useFocusRing } from "./focus-ring.ts";
import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import { longPressA11y } from "./long-press-action.ts";
import { CONTROL_RADIUS } from "./radius.ts";
import { accentPlate, DISABLED_OPACITY, glassSurface, PRESSED_FILTER, slateSurface, textSurface } from "./surfaces.ts";
import { withAlphaHex } from "./tokens.ts";
import { capLines, touch, touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/**
 * The one filled action on a screen: wraith-light silver on Dark, elven green on Light, a capsule 52 pt tall (`compact` 44, `dock` 46:
 * the table's command column), its word in Marcellus SC 17 tracked 1.2. A press darkens it about 8% and sinks it 1 pt. On paper it is an
 * ink capsule. Disabled is the same shape at 35%; the sentence near it says why.
 */
export function PrimaryButton({
  label,
  onPress,
  testID,
  disabled = false,
  surface = "night",
  accessibilityLabel,
  accessibilityHint,
  compact = false,
  dock = false,
  onFocusChange,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
  surface?: "night" | "paper";
  accessibilityLabel?: string;
  accessibilityHint?: string;
  // 44 pt: a tray's foot, a short phone's dock.
  compact?: boolean;
  // The table's command column: 46 pt, and a long word takes a second line rather than shrinking.
  dock?: boolean;
  // Told when a keyboard moves focus onto the button or off it: the dock moves the armed bar clear of the ring (dock/buttons.tsx).
  onFocusChange?: (focused: boolean) => void;
}) {
  const paper = surface === "paper";
  const ring = useFocusRing(paper);
  return (
    <Pressable
      onFocus={() => {
        ring.props.onFocus();
        onFocusChange?.(true);
      }}
      onBlur={() => {
        ring.props.onBlur();
        onFocusChange?.(false);
      }}
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => <PrimaryFace label={label} pressed={pressed} disabled={disabled} paper={paper} compact={compact} dock={dock} ring={ring.style} />}
    </Pressable>
  );
}

/**
 * The primary's look with no press of its own: the capsule, its fill and its word. `PrimaryButton` draws it inside its Pressable; a
 * control that is itself the one press (the Scenarios banner, whose scene is the button) draws it as its "Resume" so the screen has one
 * primary and one control, not a button inside a button.
 */
export function PrimaryFace({
  label,
  pressed = false,
  disabled = false,
  paper = false,
  compact = false,
  dock = false,
  ring,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  paper?: boolean;
  compact?: boolean;
  dock?: boolean;
  // The focus ring's outline while a keyboard holds focus (focus-ring.ts).
  ring?: ViewStyle;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  // The dock's primary keeps two lines at the phone's default text size; larger text grows the button (capLines, ui/ui-scale.ts).
  const twoLines = capLines(2, useWindowDimensions().fontScale);
  const dockCap = dock ? twoLines : undefined;
  const fill = paper ? { backgroundColor: t.ink, opacity: pressed && !disabled ? 0.85 : 1 } : accentPlate(pressed && !disabled, t);
  return (
    // The ring is on a view of its own so a disabled capsule's opacity does not fade it (the capsule's corner radius is the ring's).
    <View style={{ borderRadius: CONTROL_RADIUS, ...ring }}>
      <View
        className="items-center justify-center rounded-control px-5"
        style={{
          minHeight: touch(s, compact ? 44 : dock ? 46 : 52),
          ...fill,
          ...(disabled ? { opacity: DISABLED_OPACITY } : {}),
          transform: [{ translateY: pressed && !disabled ? 1 : 0 }],
        }}
      >
        <Text
          numberOfLines={dockCap}
          className="font-display text-center"
          style={{ fontSize: 17 * s, lineHeight: 21 * s, letterSpacing: 1.2 * s, color: paper ? t.paper : t.onAccent }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/**
 * A button for the actions beside the primary (Path, Log, Change, Add cards, the dock's other answers): a capsule 44 pt tall on the
 * tonal fill, its word in Marcellus SC 15 in the accent, an optional printed icon before it and `trailing` (a count badge) after.
 * `tone` colours the word: danger for a loss. `tight` is a short phone's dock: a 36 pt capsule in a 40 pt row, its 44 pt target kept by a
 * vertical hit slop.
 */
export function SecondaryButton({
  label,
  onPress,
  testID,
  icon,
  trailing,
  tone = "accent",
  tight = false,
  accessibilityLabel,
  accessibilityHint,
  expanded,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: IconName;
  trailing?: ReactNode;
  tone?: "bone" | "accent" | "danger";
  tight?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  // Set for a button that opens and closes a list under it: a screen reader says whether it is open.
  expanded?: boolean;
  disabled?: boolean;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const color = tone === "danger" ? t.danger : tone === "bone" ? t.bone : t.accent;
  const row = tight ? 40 * s : touch(s, 44);
  const slop = touchSlop(s, row);
  const ring = useFocusRing();
  return (
    <Pressable
      {...ring.props}
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={expanded == null ? { disabled } : { disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={tight ? { top: slop, bottom: slop } : undefined}
      style={{ minHeight: row, justifyContent: "center" }}
    >
      {({ pressed }) => (
        // The ring is on a view of its own so a disabled capsule's opacity does not fade it.
        <View style={{ borderRadius: CONTROL_RADIUS, ...ring.style }}>
          <View
            className="flex-row items-center justify-center gap-2 rounded-control"
            style={{
              minHeight: tight ? 36 * s : touch(s, 44),
              minWidth: touch(s, 44),
              paddingHorizontal: 18 * s,
              ...slateSurface(pressed && !disabled, t),
              ...(disabled ? { opacity: DISABLED_OPACITY } : {}),
            }}
          >
            {icon ? <GameIcon name={icon} size={15 * s} tint={tone === "danger" ? "danger" : tone === "bone" ? "bone" : "accent"} /> : null}
            <Text className="font-display" style={{ fontSize: 15 * s, lineHeight: 19 * s, letterSpacing: 1 * s, color }}>
              {label}
            </Text>
            {trailing}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Words with no fill: the accent by default, a capsule fill while pressed, a 44 pt target. `tone` colours the word (ink on paper, danger
 * for an action that cannot be undone, muted for a reading aid); `small` sets it in label type (the dock's reading aids); `tight` is a
 * short phone's dock, a 40 pt row with a vertical hit slop that makes up the 44. A text button that stands alone in content takes an
 * `icon` (or a trailing chevron from the caller) so it does not read as body text.
 */
export function TextButton({
  label,
  onPress,
  testID,
  tone = "bone",
  accessibilityLabel,
  accessibilityHint,
  selected,
  expanded,
  icon,
  disabled = false,
  small = false,
  tight = false,
  onLongPress,
  longPressLabel = "Show card",
}: {
  label: string;
  onPress: () => void;
  // A long press on a button that names a card shows the card large (the briefing's choices, like the Ring-bearer rows).
  onLongPress?: () => void;
  // What a screen reader's actions menu calls the long press (docs/design-system.md, Screen reader).
  longPressLabel?: string;
  testID: string;
  tone?: "bone" | "accent" | "ink" | "danger" | "muted";
  // A printed icon before the word, in the word's colour (Full path, Campaign log, New playthrough on Campaigns).
  icon?: IconName;
  // What a screen reader says when the visible word is not enough alone ("Booklet" opens the campaign book).
  accessibilityLabel?: string;
  accessibilityHint?: string;
  // Set for a text option in a radio group (the No boon decline): the button is a radio with this selected state.
  selected?: boolean;
  // Set for a button that shows and hides a group (Archived · n): a screen reader hears whether it is open.
  expanded?: boolean;
  disabled?: boolean;
  small?: boolean;
  tight?: boolean;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const color = tone === "accent" ? t.accent : tone === "ink" ? t.inkLabel : tone === "danger" ? t.danger : tone === "muted" ? t.muted : t.bone;
  const row = tight ? 40 * s : touch(s, 44);
  const slop = touchSlop(s, row);
  // The state a screen reader hears: selected for a radio, expanded for a toggle of a group, disabled when it waits.
  const state = selected == null && expanded == null && !disabled ? null : { ...(selected == null ? {} : { selected }), ...(expanded == null ? {} : { expanded }), ...(disabled ? { disabled } : {}) };
  const word = (
    <Text className={`${small ? "text-label" : "text-body"} font-medium`} style={{ color }}>
      {label}
    </Text>
  );
  // A long press is also an action in the reader's menu; the hint names it after any hint the caller gave.
  const longPress = onLongPress ? longPressA11y(longPressLabel, onLongPress) : null;
  const hint = [accessibilityHint, longPress?.accessibilityHint].filter(Boolean).join(". ") || undefined;
  const ring = useFocusRing(tone === "ink");
  return (
    <Pressable
      {...ring.props}
      testID={testID}
      collapsable={false}
      accessibilityRole={selected == null ? "button" : "radio"}
      {...(state ? { accessibilityState: state } : {})}
      {...(selected == null ? {} : { "aria-checked": selected })}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      {...(longPress ? { accessibilityActions: longPress.accessibilityActions, onAccessibilityAction: longPress.onAccessibilityAction } : {})}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      hitSlop={tight ? { top: slop, bottom: slop } : undefined}
      style={{ minHeight: row, justifyContent: "center" }}
    >
      {/* The size and the pressed fill are on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
      {({ pressed }) => (
        // The ring is on a view of its own so a disabled button's opacity does not fade it.
        <View style={{ borderRadius: CONTROL_RADIUS, ...ring.style }}>
          <View
            className="flex-row items-center justify-center gap-2 px-3"
            style={{
              minHeight: row,
              minWidth: touch(s, 44),
              borderRadius: CONTROL_RADIUS,
              ...(disabled ? { opacity: DISABLED_OPACITY } : {}),
              ...(tone === "ink" ? { backgroundColor: pressed && !disabled ? t.paperPressed : "transparent" } : textSurface(pressed && !disabled, t)),
            }}
          >
            {icon ? <GameIcon name={icon} size={16 * s} tint={tone === "ink" ? "inkLabel" : tone} /> : null}
            {word}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The round glass icon button of the table: 44 pt, on `glassSurface` (a paper panel takes an ink wash instead), holding a mark the
 * caller draws in the colour it is given as views, since no printed icon fits. It always carries a label for a screen reader.
 * `active` turns the mark accent (the menu while it is open); `expanded` is for a button that shows and hides something.
 */
export function GlassIconButton({
  label,
  onPress,
  testID,
  mark,
  active = false,
  expanded,
  paper = false,
  tone = "bone",
  slop,
  pressRef,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  mark: (color: string) => ReactNode;
  active?: boolean;
  expanded?: boolean;
  paper?: boolean;
  // The mark's colour at rest: bone (the table) or accent (a screen's Back, gear and book).
  tone?: "bone" | "accent";
  // Hit slop on every side, in points already scaled: a screen's header button reaches a little past its disc.
  slop?: number;
  // The Pressable, for a popover that moves a screen reader's focus to its first control.
  pressRef?: Ref<ComponentRef<typeof Pressable>>;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const box = touch(s, 44);
  const color = active ? t.accent : paper ? t.ink : tone === "accent" ? t.accent : t.bone;
  const ring = useFocusRing(paper);
  return (
    <Pressable
      {...ring.props}
      ref={pressRef}
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(expanded == null ? {} : { accessibilityState: { expanded } })}
      onPress={onPress}
      hitSlop={slop}
    >
      {({ pressed }) => (
        <View
          style={{
            width: box,
            height: box,
            borderRadius: CONTROL_RADIUS,
            alignItems: "center",
            justifyContent: "center",
            ...(paper ? { backgroundColor: withAlphaHex(t.ink, 0.08), ...(pressed ? { filter: PRESSED_FILTER } : {}) } : glassSurface(pressed, t)),
            ...ring.style,
          }}
        >
          {mark(color)}
        </View>
      )}
    </Pressable>
  );
}

/** A ✕ of two crossed bars, drawn as views (no printed icon fits, and a glyph depends on the font). */
export function CrossMark({ color }: { color: string }) {
  const s = useUiScale();
  const bar = { position: "absolute", width: 16 * s, height: 1.75 * s, borderRadius: s, backgroundColor: color } as const;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 16 * s, height: 16 * s, alignItems: "center", justifyContent: "center" }}>
      <View style={{ ...bar, transform: [{ rotate: "45deg" }] }} />
      <View style={{ ...bar, transform: [{ rotate: "-45deg" }] }} />
    </View>
  );
}

/** The round ✕ that closes a reading panel, labelled "Close": on paper for the parchment panels, on night for the settings panel. */
export function CloseButton({ onPress, testID, paper = false, pressRef }: { onPress: () => void; testID: string; paper?: boolean; pressRef?: Ref<ComponentRef<typeof Pressable>> }) {
  return <GlassIconButton label="Close" testID={testID} paper={paper} onPress={onPress} pressRef={pressRef} mark={(color) => <CrossMark color={color} />} />;
}
