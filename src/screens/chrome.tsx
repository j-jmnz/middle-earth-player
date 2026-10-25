import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { Tabs } from "expo-router";

import { Backdrop } from "./backdrop";
import type { SceneName } from "./backdrop-scenes";
import { palette } from "./palette.js";
import { GameIcon } from "../play/game-icon";
import { SPHERE_TINT } from "../play/icon-map";
import { SheetFrame } from "../play/sheet-paper";
import type { MarkedSphere } from "./sphere-mark";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export const pressedNight = { backgroundColor: palette.pressed };
const pressedPaper = { backgroundColor: palette.paperPressed };

/** Night page with a scene backdrop. Content is inset 24 and starts under the status bar. */
export function Screen({
  children,
  testID,
  scene = "plain",
  inset = true,
}: {
  children: ReactNode;
  testID?: string;
  scene?: SceneName;
  inset?: boolean;
}) {
  return (
    <View testID={testID} collapsable={false} className="flex-1 bg-night">
      <Backdrop scene={scene} />
      <View className={inset ? "flex-1 px-6 pt-safe" : "flex-1 pt-safe"}>{children}</View>
    </View>
  );
}

/** Top bar: labeled Back on the left, one optional text action or meta label on the right. */
export function NavBar({
  onBack,
  backTestID,
  backLabel = "Back",
  right,
}: {
  onBack: () => void;
  backTestID: string;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <View className="-mx-2 min-h-11 flex-row items-center justify-between">
      <Pressable
        testID={backTestID}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        className="min-h-11 justify-center rounded-tile px-2"
        style={({ pressed }) => (pressed ? pressedNight : undefined)}
      >
        <Text className="text-body text-muted">{`‹ ${backLabel}`}</Text>
      </Pressable>
      {right ? <View className="px-2">{right}</View> : null}
    </View>
  );
}

export function Eyebrow({ children, tone = "gold" }: { children: string; tone?: "gold" | "muted" | "inkLabel" }) {
  const color = tone === "gold" ? "text-gold" : tone === "muted" ? "text-muted" : "text-inkLabel";
  return <Text className={`font-display text-eyebrow uppercase ${color}`}>{children}</Text>;
}

export function ScreenTitle({ children, size = "display" }: { children: string; size?: "display" | "title" }) {
  return (
    <Text accessibilityRole="header" className={`font-display text-bone ${size === "display" ? "text-display" : "text-title"}`}>
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

/** Flat row on a hairline. Text, at most one 32×44 picture, a pressed fill. No shadow, no gradient. */
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
      {trailing ?? <Text className="text-body text-faint">›</Text>}
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
  tone?: "bone" | "gold" | "ink" | "danger";
  // What a screen reader says when the visible word is not enough alone ("Booklet" opens the campaign book).
  accessibilityLabel?: string;
  // Set for a text option in a radio group (the No boon decline): the button is a radio with this selected state.
  selected?: boolean;
  // Set for a button that shows and hides a group (Archived · n): a screen reader hears whether it is open.
  expanded?: boolean;
}) {
  const color = tone === "gold" ? "text-gold" : tone === "ink" ? "text-inkLabel" : tone === "danger" ? "text-danger" : "text-bone";
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

/**
 * The one filled action on a screen. Gold pill, display-face caps label.
 * Disabled is a dim pill; the sentence above it says why.
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
  const filled = surface === "paper" ? "bg-ink" : "border-t border-goldHigh bg-gold";
  const text = surface === "paper" ? "text-paper" : "text-onGold";
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 items-center justify-center rounded-pill px-8 ${disabled ? (surface === "paper" ? "border border-inkLine" : "bg-raised") : filled}`}
      style={({ pressed }) => (pressed && !disabled ? { backgroundColor: surface === "paper" ? palette.ink : palette.goldDeep } : undefined)}
    >
      <Text className={`font-display text-body uppercase tracking-widest ${disabled ? (surface === "paper" ? "text-inkMuted" : "text-faint") : text}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Raised panel. `current` gets the gold edge: the one thing the player should look at. `pressed` is the pressed fill.
 * `unfilled` is a hairline outline with no fill, for a thing put away (an archived playthrough).
 */
export function Panel({
  children,
  current = false,
  pressed = false,
  unfilled = false,
  className,
}: {
  children: ReactNode;
  current?: boolean;
  pressed?: boolean;
  unfilled?: boolean;
  className?: string;
}) {
  const edge = current ? "border-goldLine" : "border-hairline";
  return (
    <View className={`rounded-card border p-5 ${unfilled ? "" : "bg-raised "}${edge}${className ? ` ${className}` : ""}`} style={pressed ? pressedNight : undefined}>
      {children}
    </View>
  );
}

/** The Ring. Current node, app mark, completion. Never decorative filler. */
export function RingMark({ size = 18, state = "current" }: { size?: number; state?: "current" | "done" | "locked" }) {
  if (state === "done") {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.gold }} />;
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

/** Two or three mutually exclusive words. Selected is a gold pill with semibold text. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  testIDPrefix: string;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row self-start rounded-pill bg-raised p-1">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            testID={`${testIDPrefix}-${option.toLowerCase()}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            className={`min-h-11 justify-center rounded-pill px-4 ${selected ? "bg-gold" : ""}`}
          >
            <Text className={selected ? "text-body font-semibold text-onGold" : "text-body text-muted"}>{option}</Text>
          </Pressable>
        );
      })}
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

/** Text tabs on night. Current is semibold bone with a small gold dot above. */
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
            className="min-h-14 flex-1 items-center justify-center"
            style={({ pressed }) => (pressed ? pressedNight : undefined)}
          >
            <View className={`mb-1.5 h-1.5 w-1.5 rounded-pill ${focused ? "bg-gold" : ""}`} />
            <Text className={focused ? "text-label font-semibold text-bone" : "text-label text-muted"}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
