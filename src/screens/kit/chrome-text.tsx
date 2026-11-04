// The chrome's words (docs/design-system.md, Type): eyebrows, section headings, the screen title, body and label text.
// Re-exported by chrome.tsx.
import { useMemo, type ReactNode } from "react";
import { View } from "react-native";


import { usePalette } from "./palette-hook";
import { SectionHeading } from "../../ui/section-heading";
import { useTheme } from "../../ui/theme";
import { withAlphaHex } from "../../ui/tokens";
import { Text } from "../../ui/text";

const eyebrowTone = { accent: "text-accent", moon: "text-moon", muted: "text-muted", inkLabel: "text-inkLabel", bone: "text-bone" } as const;

/**
 * An overline: one short tag above a title in bold Barlow capitals, tracked wide (Fellowship of the Ring · 2 of 6, In progress ·
 * Round 4). Moon by default; accent above the thing to act on. `rule` draws the short line before it that the hero text opens with.
 * `onArt` is an overline over a picture: it takes the title's colour (bone) and its shadow, since moon or accent is too faint on a bright painting.
 */
export function Eyebrow({ children, tone = "moon", testID, rule = false, onArt = false }: { children: string; tone?: keyof typeof eyebrowTone; testID?: string; rule?: boolean; onArt?: boolean }) {
  const palette = usePalette();
  const shadow = useTitleShadow();
  const text = (
    <Text testID={testID} className={`font-bold text-eyebrow uppercase ${eyebrowTone[onArt ? "bone" : tone]}`} style={onArt ? shadow : undefined}>
      {children}
    </Text>
  );
  if (!rule) return text;
  return (
    <View className="flex-row items-center gap-2.5">
      <View style={{ width: 22, height: 1, backgroundColor: onArt ? palette.bone : palette.moon }} />
      {text}
    </View>
  );
}

/** A section's heading: its name in Marcellus SC in the section colour, with one optional control at the end (src/ui/section-heading.tsx). */
export function Section({ title, right, testID, className }: { title: string; right?: ReactNode; testID?: string; className?: string }) {
  return <SectionHeading title={title} right={right} testID={testID} className={className} />;
}

/** The dark shadow under a title, so it reads over the fog or a picture. Light uses no text shadows. */
export function useTitleShadow() {
  const palette = usePalette();
  const light = useTheme() === "light";
  return useMemo(() => (light ? {} : { textShadowColor: withAlphaHex(palette.night, 0.95), textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } }), [light, palette]);
}

export function ScreenTitle({ children, size = "display" }: { children: string; size?: "display" | "title" }) {
  const titleShadow = useTitleShadow();
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
