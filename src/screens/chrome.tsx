import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { Tabs } from "expo-router";

import { Backdrop } from "./backdrop";
import type { SceneName } from "./backdrop-scenes";
import { palette } from "./palette.js";
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

export function Label({ children, tone = "muted", className }: { children: string; tone?: keyof typeof toneClass; className?: string }) {
  const base = `text-label ${toneClass[tone]}`;
  return <Text className={className ? `${base} ${className}` : base}>{children}</Text>;
}

/** Flat row on a hairline. Text, at most one 32×44 picture, a pressed fill. No shadow, no gradient. */
export function ListRow({
  label,
  detail,
  onPress,
  testID,
  leading,
  trailing,
}: {
  label: string;
  detail?: string;
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
      className="min-h-14 flex-row items-center border-b border-hairline py-2"
      style={({ pressed }) => (pressed ? pressedNight : undefined)}
    >
      {leading ? <View className="mr-3">{leading}</View> : null}
      <View className="flex-1">
        <Text className="text-body text-bone">{label}</Text>
        {detail ? <Text className="mt-0.5 text-label text-muted">{detail}</Text> : null}
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
}: {
  label: string;
  onPress: () => void;
  testID: string;
  tone?: "bone" | "gold" | "ink";
}) {
  const color = tone === "gold" ? "text-gold" : tone === "ink" ? "text-inkLabel" : "text-bone";
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 items-center justify-center rounded-tile px-3"
      style={({ pressed }) => (pressed ? (tone === "ink" ? pressedPaper : pressedNight) : undefined)}
    >
      <Text className={`text-body font-medium ${color}`}>{label}</Text>
    </Pressable>
  );
}

/** Bottom-pinned labeled Back. Used where a screen has no top bar (debug). */
export function BackButton({
  label = "Back",
  onPress,
  testID,
}: {
  label?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View className="pb-safe">
      <TextButton label={label} onPress={onPress} testID={testID} />
    </View>
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
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
  surface?: "night" | "paper";
}) {
  const filled = surface === "paper" ? "bg-ink" : "border-t border-goldHigh bg-gold";
  const text = surface === "paper" ? "text-paper" : "text-onGold";
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 items-center justify-center rounded-pill px-8 ${disabled ? "bg-raised" : filled}`}
      style={({ pressed }) => (pressed && !disabled ? { backgroundColor: surface === "paper" ? palette.ink : palette.goldDeep } : undefined)}
    >
      <Text className={`font-display text-body uppercase tracking-widest ${disabled ? "text-faint" : text}`}>{label}</Text>
    </Pressable>
  );
}

/** Raised panel. `current` gets the gold edge: the one thing the player should look at. */
export function Panel({ children, current = false, className }: { children: ReactNode; current?: boolean; className?: string }) {
  const edge = current ? "border-goldLine" : "border-hairline";
  return <View className={`rounded-card border bg-raised p-5 ${edge}${className ? ` ${className}` : ""}`}>{children}</View>;
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

const sphereClass = {
  leadership: "bg-leadership",
  tactics: "bg-tactics",
  spirit: "bg-spirit",
  lore: "bg-lore",
  fellowship: "bg-fellowship",
} as const;

export { markedSphere, sphereWord, type MarkedSphere } from "./sphere-mark";

/** 8 point disc beside the sphere word. Neutral has no mark. Color is never the only signal. */
export function SphereMark({ sphere }: { sphere: MarkedSphere }) {
  if (sphere === "neutral") return null;
  return <View className={`h-2 w-2 rounded-pill ${sphereClass[sphere]}`} />;
}

/** Parchment sheet over the rail or a list. Repeats the step in an eyebrow. */
export function PaperSheet({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <View className="rounded-t-sheet bg-paper px-6 pb-safe pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <View className="items-center">
        <Eyebrow tone="inkLabel">{step}</Eyebrow>
        <Text className="mt-1 text-center font-display text-title text-ink">{title}</Text>
      </View>
      <View className="mt-5">{children}</View>
    </View>
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
