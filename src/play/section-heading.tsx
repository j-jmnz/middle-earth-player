// A section's heading (docs/design-system.md, Type): its name in Marcellus SC 15 in the section colour, and a rule that fades out to
// its right, with one optional control at the end. It lives in src/play, in the table tokens, because the table's settings panel uses it and src/play cannot import
// src/screens; `Section` in chrome-text.tsx wraps it, and the fold header (fold-section.tsx) draws its title and rule with the same parts.
import type { ReactNode } from "react";
import { View } from "react-native";

import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** A section title's size and tracking at the UI scale `s`; its colour is the class `text-moon`. */
export const sectionTitleStyle = (s: number) => ({ fontSize: 15 * s, lineHeight: 20 * s, letterSpacing: 1 * s });

/** The rule after a section's title: moonlight fading out to its right, or a solid hairline in a FlashList row (which draws no gradient). */
export function SectionRule({ solid = false }: { solid?: boolean }) {
  const t = useTableTokens();
  return (
    <View
      className="h-px min-w-3 flex-1"
      style={solid ? { backgroundColor: withAlphaHex(t.moon, 0.3) } : { backgroundImage: `linear-gradient(90deg, ${withAlphaHex(t.moon, 0.45)}, ${withAlphaHex(t.moon, 0)})`, backgroundColor: "transparent" }}
    />
  );
}

export function SectionHeading({ title, right, testID, className }: { title: string; right?: ReactNode; testID?: string; className?: string }) {
  const s = useUiScale();
  return (
    <View testID={testID} className={`min-h-touch flex-row items-center gap-3${className ? ` ${className}` : ""}`}>
      <Text accessibilityRole="header" className="font-display text-moon" style={sectionTitleStyle(s)}>
        {title}
      </Text>
      <SectionRule />
      {right}
    </View>
  );
}
