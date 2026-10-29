// The chrome's words (docs/design-system.md, Type): eyebrows, section headings, the screen title, body and label text.
// Re-exported by chrome.tsx.
import { useMemo, type ReactNode } from "react";
import { Text } from "react-native";

import { usePalette } from "./palette-hook";
import { SectionHeading } from "../play/section-heading";
import { withAlphaHex } from "../play/tokens";

const eyebrowTone = { accent: "text-accent", moon: "text-moon", muted: "text-muted", inkLabel: "text-inkLabel" } as const;

/** One short tag above a title, in engraved capitals: accent above the thing to act on, moon for a section. */
export function Eyebrow({ children, tone = "accent", testID }: { children: string; tone?: keyof typeof eyebrowTone; testID?: string }) {
  return (
    <Text testID={testID} className={`font-display-bold text-eyebrow uppercase ${eyebrowTone[tone]}`}>
      {children}
    </Text>
  );
}

/** A section's heading: a moonlit eyebrow and a rule that fades out to its right, with one optional control at the end (src/play/section-heading.tsx). */
export function Section({ title, right, testID, className }: { title: string; right?: ReactNode; testID?: string; className?: string }) {
  return <SectionHeading title={title} right={right} testID={testID} className={className} />;
}

/** The soft night under a title, so it reads over a backdrop or a picture (the theme's own page color). */
export function useTitleShadow() {
  const palette = usePalette();
  return useMemo(() => ({ textShadowColor: withAlphaHex(palette.night, 0.85), textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } }), [palette]);
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
