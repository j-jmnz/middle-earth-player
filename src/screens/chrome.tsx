import type { ComponentProps, ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";

import { Backdrop } from "./backdrop";
import type { SceneName } from "./backdrop-scenes";
import { palette } from "./palette.js";
import { GameIcon } from "../play/game-icon";
import { SPHERE_TINT, iconAspect, type IconName } from "../play/icon-map";
import { SheetFrame } from "../play/sheet-paper";
import { goldEdge, goldGlow, goldSurface, nightFade, panelSurface, raisedEdge, slateSurface } from "../play/surfaces";
import { withAlphaHex } from "../play/tokens";
import type { MarkedSphere } from "./sphere-mark";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export const pressedNight = { backgroundColor: palette.pressed };
const pressedPaper = { backgroundColor: palette.paperPressed };

/**
 * Night page with a scene backdrop. Content is inset 24 and starts under the status bar; in landscape (the card and booklet
 * screens can turn with the phone) it is inset past the side safe areas too. `bleed` drops both, for a screen that opens on a
 * picture running under the status bar (the briefing, the deck editor): it insets its own words.
 */
export function Screen({
  children,
  testID,
  scene = "plain",
  inset = true,
  bleed = false,
}: {
  children: ReactNode;
  testID?: string;
  scene?: SceneName;
  inset?: boolean;
  bleed?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} collapsable={false} className="flex-1 bg-night">
      <Backdrop scene={scene} />
      <View className={bleed ? "flex-1" : "flex-1 pt-safe"} style={inset && !bleed ? { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right } : undefined}>
        {children}
      </View>
    </View>
  );
}

/**
 * The scrolling body of a screen. It reaches 8 pt past the page inset on each side, with the same padding inside, so a framed
 * panel's corner ornaments (Corners) are not cut by the scroll edge.
 */
export function ScreenScroll({ children, bottom = 32, testID }: { children: ReactNode; bottom?: number; testID?: string }) {
  return (
    <ScrollView
      testID={testID}
      className="min-h-0 flex-1"
      style={{ marginHorizontal: -8 }}
      contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: bottom }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** A chevron drawn as views (no printed icon fits), pointing left for Back or right for a row that opens. */
export function Chevron({ direction = "left", color = palette.bone, size = 10 }: { direction?: "left" | "right"; color?: string; size?: number }) {
  return (
    <View
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ translateX: direction === "left" ? size * 0.2 : -size * 0.2 }, { rotate: direction === "left" ? "45deg" : "-135deg" }],
      }}
    />
  );
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
  const color = tone === "gold" ? palette.gold : palette.bone;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(expanded == null ? {} : { accessibilityState: { expanded } })}
      onPress={onPress}
      hitSlop={4}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? palette.pressed : overlay ? withAlphaHex(palette.night, 0.6) : withAlphaHex(palette.raised, 0.7),
            borderWidth: 1,
            borderColor: overlay ? withAlphaHex(palette.bone, 0.16) : palette.hairline,
          }}
        >
          {chevron ? <Chevron color={color} /> : icon ? <GameIcon name={icon} size={18} tint={tone === "gold" ? "gold" : "bone"} /> : <Text style={{ color, fontSize: 20, lineHeight: 22, fontWeight: "700" }}>{glyph}</Text>}
        </View>
      )}
    </Pressable>
  );
}

/**
 * The top of a screen: a round Back on the left, an optional title (and a muted line under it) centred, and one optional
 * control on the right. Back goes to the screen below; its label names that screen to a screen reader ("Back to Decks").
 */
export function NavBar({
  onBack,
  backTestID,
  backLabel = "Back",
  title,
  subtitle,
  right,
  overlay = false,
}: {
  onBack: () => void;
  backTestID: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  // Over a picture: the buttons take a night disc.
  overlay?: boolean;
}) {
  return (
    <View className="min-h-14 flex-row items-center justify-between gap-3 py-1">
      <IconButton chevron overlay={overlay} testID={backTestID} label={backLabel === "Back" ? "Back" : `Back to ${backLabel}`} onPress={onBack} />
      {title ? (
        <View className="flex-1 items-center">
          <Text accessibilityRole="header" numberOfLines={1} className="font-display text-heading text-bone">
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="text-label text-muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="flex-1" />
      )}
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

const eyebrowTone = { gold: "text-gold", moon: "text-moon", muted: "text-muted", inkLabel: "text-inkLabel" } as const;

/** One short tag above a title, in engraved capitals: gold above the thing to act on, moon for a section. */
export function Eyebrow({ children, tone = "gold", testID }: { children: string; tone?: keyof typeof eyebrowTone; testID?: string }) {
  return (
    <Text testID={testID} className={`font-display-bold text-eyebrow uppercase ${eyebrowTone[tone]}`}>
      {children}
    </Text>
  );
}

/** A section's heading: a moonlit eyebrow and a rule that fades out to its right, with one optional control at the end. */
export function Section({ title, right, testID, className }: { title: string; right?: ReactNode; testID?: string; className?: string }) {
  return (
    <View testID={testID} className={`min-h-11 flex-row items-center gap-3${className ? ` ${className}` : ""}`}>
      <Text accessibilityRole="header" className="font-display-bold text-eyebrow uppercase text-moon">
        {title}
      </Text>
      <View className="h-px flex-1" style={{ backgroundImage: `linear-gradient(90deg, ${palette.hairline}, ${withAlphaHex(palette.hairline, 0)})`, backgroundColor: "transparent" }} />
      {right}
    </View>
  );
}

const titleShadow = { textShadowColor: withAlphaHex(palette.night, 0.85), textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } };

export function ScreenTitle({ children, size = "display" }: { children: string; size?: "display" | "title" }) {
  return (
    <Text accessibilityRole="header" className={`font-display text-bone ${size === "display" ? "text-display" : "text-title"}`} style={titleShadow}>
      {children}
    </Text>
  );
}

const toneClass = {
  bone: "text-bone",
  ink: "text-bone",
  muted: "text-muted",
  faint: "text-faint",
  danger: "text-danger",
} as const;

export function BodyText({
  children,
  tone = "bone",
  testID,
  className,
}: {
  children: string;
  tone?: keyof typeof toneClass;
  testID?: string;
  className?: string;
}) {
  const base = `text-body ${toneClass[tone]}`;
  return (
    <Text testID={testID} className={className ? `${base} ${className}` : base}>
      {children}
    </Text>
  );
}

export function Label({
  children,
  tone = "muted",
  className,
  testID,
}: {
  children: string;
  tone?: keyof typeof toneClass;
  className?: string;
  testID?: string;
}) {
  const base = `text-label ${toneClass[tone]}`;
  return (
    <Text testID={testID} className={className ? `${base} ${className}` : base}>
      {children}
    </Text>
  );
}

/** Flat row on a hairline. Text, at most one small picture, a pressed fill. No shadow, no gradient. */
export function ListRow({
  label,
  detail,
  onPress,
  onLongPress,
  testID,
  leading,
  trailing,
  detailIcons,
}: {
  label: string;
  detail?: string;
  // A long press on a card row shows the card large (src/play/card-preview.tsx).
  onLongPress?: () => void;
  // Small game icons before the detail line (a sphere, a cost). The detail stays words.
  detailIcons?: ReactNode;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="min-h-14 flex-row items-center border-b border-hairline py-2"
      style={({ pressed }) => (pressed ? pressedNight : undefined)}
    >
      {leading ? <View className="mr-3">{leading}</View> : null}
      <View className="flex-1">
        <Text className="text-body text-bone">{label}</Text>
        {detail ? (
          <View className="mt-0.5 flex-row items-center gap-1.5">
            {detailIcons}
            <Text className="shrink text-label text-muted">{detail}</Text>
          </View>
        ) : null}
      </View>
      {trailing ?? (
        <View className="w-6 items-center">
          <Chevron direction="right" color={palette.faint} size={8} />
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
  const color = tone === "gold" ? "text-gold" : tone === "ink" ? "text-inkLabel" : tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : "text-bone";
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole={selected == null ? "button" : "radio"}
      {...(selected == null && expanded == null ? {} : { accessibilityState: selected == null ? { expanded } : { selected } })}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className="min-h-11 items-center justify-center rounded-tile px-3"
      style={({ pressed }) => (pressed ? (tone === "ink" ? pressedPaper : pressedNight) : undefined)}
    >
      <Text className={`text-body font-medium ${color}`}>{label}</Text>
    </Pressable>
  );
}

const buttonLabel = { fontSize: 15, lineHeight: 20, letterSpacing: 2.4 };

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
  const paper = surface === "paper";
  // The fill and the text colour are styles, not only classes: on the phone a class on a Pressable whose style is a function
  // can be dropped, which left a gold pill as dark text on night (user report, 2026-10-25). The pressed state comes from the
  // Pressable's children.
  const fill = (pressed: boolean) =>
    disabled
      ? paper
        ? { borderWidth: 1, borderColor: palette.inkLine }
        : { backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.hairline }
      : paper
        ? { backgroundColor: palette.ink, opacity: pressed ? 0.85 : 1 }
        : { ...goldSurface(pressed), borderWidth: 1, borderColor: palette.goldDeep, boxShadow: pressed ? goldEdge : `${goldEdge}, ${goldGlow}` };
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
        <View className="items-center justify-center rounded-button px-6" style={{ minHeight: 56, ...fill(pressed), transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] }}>
          <Text className="font-display-bold uppercase" style={{ ...buttonLabel, color }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * A plate for the actions beside the primary (Path, Log, Change, Add cards): slate lit from above, a hairline edge, engraved
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
  const color = disabled ? palette.faint : tone === "gold" ? palette.gold : tone === "danger" ? palette.danger : palette.bone;
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
      {({ pressed }) => (
        <View
          className="flex-row items-center justify-center gap-2 rounded-tile px-4"
          style={{ minHeight: compact ? 44 : 52, ...slateSurface(pressed && !disabled), borderWidth: 1, borderColor: palette.hairline, boxShadow: raisedEdge }}
        >
          {icon ? <GameIcon name={icon} size={15} tint={tone === "gold" ? "gold" : tone === "danger" ? "danger" : "bone"} /> : null}
          <Text className="font-display-bold uppercase" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 1.6, color }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Four small gold diamonds on the corners of a framed thing: the current panel, the scenario to play, the fellowship chosen. */
export function Corners() {
  const at = [
    { left: -4, top: -4 },
    { right: -4, top: -4 },
    { left: -4, bottom: -4 },
    { right: -4, bottom: -4 },
  ];
  return (
    <>
      {at.map((place, index) => (
        <View key={index} pointerEvents="none" importantForAccessibility="no" style={{ position: "absolute", width: 7, height: 7, backgroundColor: palette.gold, transform: [{ rotate: "45deg" }], ...place }} />
      ))}
    </>
  );
}

/**
 * Raised panel, lit from its top edge. `current` gets the gold frame (a goldLine edge and gold corners): the one thing the player
 * should look at. `pressed` is the pressed fill. `unfilled` is a hairline outline with no fill, for a thing put away.
 */
export function Panel({
  children,
  current = false,
  pressed = false,
  unfilled = false,
  className,
  padded = true,
}: {
  children: ReactNode;
  current?: boolean;
  pressed?: boolean;
  unfilled?: boolean;
  className?: string;
  // False for a panel whose content runs to its edges (a picture on top).
  padded?: boolean;
}) {
  return (
    <View
      className={`rounded-card ${padded ? "p-5" : ""}${className ? ` ${className}` : ""}`}
      style={{
        ...(unfilled ? { backgroundColor: "transparent" } : panelSurface(pressed)),
        borderWidth: 1,
        borderColor: current ? palette.goldLine : palette.hairline,
        ...(unfilled ? {} : { boxShadow: raisedEdge }),
      }}
    >
      {children}
      {current ? <Corners /> : null}
    </View>
  );
}

/** The Ring. Current node, app mark, completion. Never decorative filler. */
export function RingMark({ size = 18, state = "current" }: { size?: number; state?: "current" | "done" | "locked" }) {
  if (state === "done") {
    return <View style={{ width: size, height: size, borderRadius: size / 2, ...goldSurface() }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: state === "locked" ? 1.5 : Math.max(2, size / 9),
        borderColor: state === "locked" ? palette.hairline : palette.gold,
      }}
    />
  );
}

/** A magnifying glass drawn as views (no printed icon fits), for a search field. */
function Magnifier({ color }: { color: string }) {
  return (
    <View importantForAccessibility="no" style={{ width: 16, height: 16 }}>
      <View style={{ position: "absolute", left: 0, top: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 1.75, borderColor: color }} />
      <View style={{ position: "absolute", left: 10, top: 11, width: 6, height: 1.75, borderRadius: 1, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
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
  return (
    <View className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2.5 rounded-tile px-3.5" style={{ backgroundColor: palette.night, borderWidth: 1, borderColor: palette.hairline }}>
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
        className="min-h-11 min-w-0 flex-1 text-body text-bone"
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
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  testIDPrefix: string;
  // Fill the width, each word an equal share (Easy / Normal on the briefing).
  stretch?: boolean;
  // A 36 pt track in label type, its 44 pt targets kept by a hit slop: a view switch beside a count.
  compact?: boolean;
}) {
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
            hitSlop={compact ? { top: 4, bottom: 4 } : undefined}
            className={`items-center justify-center rounded-lg ${compact ? "min-h-8 px-3" : "min-h-11 px-4"} ${stretch ? "flex-1" : ""}`}
            style={selected ? { ...slateSurface(), borderWidth: 1, borderColor: palette.goldLine, boxShadow: raisedEdge } : { borderWidth: 1, borderColor: "transparent" }}
          >
            <Text className={`${compact ? "text-label" : "text-body"} ${selected ? "font-semibold text-bone" : "text-muted"}`}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const chipTone = {
  neutral: { fill: withAlphaHex(palette.bone, 0.06), edge: withAlphaHex(palette.bone, 0.1), text: palette.bone },
  gold: { fill: withAlphaHex(palette.gold, 0.14), edge: withAlphaHex(palette.gold, 0.38), text: palette.goldHigh },
  danger: { fill: withAlphaHex(palette.threat, 0.16), edge: withAlphaHex(palette.threat, 0.45), text: palette.danger },
  ok: { fill: withAlphaHex(palette.ok, 0.12), edge: withAlphaHex(palette.ok, 0.35), text: palette.ok },
  faint: { fill: "transparent", edge: palette.hairline, text: palette.faint },
} as const;

/** A small tag: a status, a reward, a rule. Words always, a mark beside them at most; colour is never the only signal. */
export function Chip({ label, tone = "neutral", leading, testID, onArt = false }: { label: string; tone?: keyof typeof chipTone; leading?: ReactNode; testID?: string; onArt?: boolean }) {
  const look = chipTone[tone];
  // Over a picture the tag sits on night first, so its words read over a bright sky.
  return (
    <View className="h-7 flex-row items-center gap-1.5 rounded-lg px-2.5" style={{ backgroundColor: onArt ? withAlphaHex(palette.night, 0.72) : look.fill, borderWidth: 1, borderColor: look.edge }}>
      {leading}
      <Text testID={testID} numberOfLines={1} className="text-label font-semibold" style={{ color: look.text }}>
        {label}
      </Text>
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
  selected: boolean;
  onPress: () => void;
  testID: string;
  leading?: ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} className="min-h-11 justify-center">
      {({ pressed }) => (
        <View
          className="h-9 flex-row items-center gap-1.5 rounded-tile px-3"
          style={selected ? { ...goldSurface(pressed), borderWidth: 1, borderColor: palette.goldDeep } : { backgroundColor: pressed ? palette.pressed : "transparent", borderWidth: 1, borderColor: palette.hairline }}
        >
          {leading}
          <Text className={`text-label ${selected ? "font-semibold" : ""}`} style={{ color: selected ? palette.onGold : palette.muted }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** A journey of steps as one segmented bar: gold for the steps done, a lit gold for the current one, night for the rest. */
export function JourneyBar({ total, done, current = done < total, testID }: { total: number; done: number; current?: boolean; testID?: string }) {
  return (
    <View testID={testID} className="flex-row gap-1" importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, index) => {
        const state = index < done ? "done" : index === done && current ? "current" : "locked";
        return (
          <View
            key={index}
            className="h-1 flex-1 rounded-pill"
            style={
              state === "done"
                ? { backgroundColor: palette.gold }
                : state === "current"
                  ? { backgroundColor: palette.goldHigh, boxShadow: `0 0 8px ${withAlphaHex(palette.gold, 0.7)}` }
                  : { backgroundColor: palette.hairline }
            }
          />
        );
      })}
    </View>
  );
}

/** A count against a goal as a thin bar (47 of 50 cards). The words beside it say the numbers. */
export function ProgressBar({ value, max, tone = "gold" }: { value: number; max: number; tone?: "gold" | "danger" }) {
  const share = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View className="h-1 overflow-hidden rounded-pill" style={{ backgroundColor: palette.hairline }} importantForAccessibility="no-hide-descendants">
      <View className="h-1 rounded-pill" style={{ width: `${Math.round(share * 100)}%`, backgroundColor: tone === "gold" ? palette.gold : palette.danger }} />
    </View>
  );
}

/** A number the player watches, on a small lit tile: its word above, its icon and value in engraved figures. */
export function StatTile({ label, value, icon, iconTint = "bone", detail, children, testID }: { label: string; value: string; icon?: IconName; iconTint?: "bone" | "danger" | "gold"; detail?: string; children?: ReactNode; testID?: string }) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label} ${value}${detail ? ` ${detail}` : ""}`} className="flex-1 rounded-tile px-3 py-2.5" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.hairline, boxShadow: raisedEdge }}>
      <Text className="text-label text-muted">{label}</Text>
      <View className="flex-row items-center gap-1.5">
        {icon ? <GameIcon name={icon} size={16} tint={iconTint} /> : null}
        <Text className="font-display-bold text-title text-bone">{value}</Text>
        {detail ? <Text className="text-label text-muted">{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The bar pinned at the foot of a screen, in thumb reach: the screen's primary and what sits beside it. The content scrolls
 * under a night fade above it. `safe` keeps it above the home indicator on a screen with no tab bar.
 */
export function ActionBar({ children, safe = true, testID }: { children: ReactNode; safe?: boolean; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} collapsable={false} className="pt-3" style={{ paddingBottom: safe ? Math.max(insets.bottom, 12) : 12 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: -24, right: -24, top: -24, height: 24, ...nightFade(0, 1) }} />
      <View pointerEvents="none" style={{ position: "absolute", left: -24, right: -24, top: 0, bottom: 0, backgroundColor: palette.night }} />
      {children}
    </View>
  );
}

export { markedSphere, sphereWord, type MarkedSphere } from "./sphere-mark";

/** The sphere's printed icon beside the sphere word, tinted with the sphere token. Color is never the only signal. */
export function SphereMark({ sphere, size = 14 }: { sphere: MarkedSphere; size?: number }) {
  return <GameIcon name={sphere} size={size} tint={SPHERE_TINT[sphere] ?? "faint"} />;
}

/** Parchment sheet over the rail or a list, on the table sheets' frame. Repeats the step in an eyebrow. */
export function PaperSheet({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <SheetFrame animated={false}>
      <View className="mb-4 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <View className="items-center">
        <Eyebrow tone="inkLabel">{step}</Eyebrow>
        <Text className="mt-1 text-center font-display text-title text-ink">{title}</Text>
      </View>
      <View className="mt-5">{children}</View>
    </SheetFrame>
  );
}

// A dock icon is 22 pt tall, and a wide one (the One Ring) may run to 30 pt across, so each carries about the same weight
// and the labels sit on one line.
const DOCK_ICON = 22;
const DOCK_ICON_WIDE = 30;

/** The `tabBarIcon` of a dock tab: one of the game's printed icons, gold on the current tab and faint on the others. */
export function dockIcon(name: IconName) {
  const aspect = iconAspect(name);
  const size = Math.round(Math.min(DOCK_ICON, DOCK_ICON_WIDE / aspect));
  return function DockIcon({ focused }: { focused: boolean }) {
    return <GameIcon name={name} size={size} tint={focused ? "goldHigh" : "faint"} />;
  };
}

/** The dock: five printed icons over their words on night. The current tab is lit: a gold bar glowing over a gold icon and word. */
export function AppTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  return (
    <View accessibilityRole="tablist" className="flex-row border-t border-hairline bg-night pb-safe">
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID}
            collapsable={false}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={() => {
              const event = emitter.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            }}
            className="min-h-14 flex-1 items-center justify-center pb-1 pt-2.5"
            style={({ pressed }) => (pressed ? pressedNight : undefined)}
          >
            {focused ? (
              <View pointerEvents="none" style={{ position: "absolute", top: 0, width: 32, height: 2, borderRadius: 1, backgroundColor: palette.gold, boxShadow: `0 0 10px 1px ${withAlphaHex(palette.gold, 0.6)}` }} />
            ) : null}
            {/* The icon in a fixed box, so each label sits on the same line; the label says the tab, the icon is not read. */}
            <View className="mb-1 items-center justify-center" style={{ height: DOCK_ICON }} importantForAccessibility="no-hide-descendants">
              {options.tabBarIcon?.({ focused, color: focused ? palette.goldHigh : palette.faint, size: DOCK_ICON })}
            </View>
            <Text className={focused ? "text-micro font-semibold text-goldHigh" : "text-micro text-faint"} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
