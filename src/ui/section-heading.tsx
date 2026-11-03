// A section's heading (docs/design-system.md, Type): its name in Marcellus SC 15 in the section colour, with one optional control at the
// end. It lives in src/play, in the table tokens, because the table's settings panel uses it and src/play cannot import
// src/screens; `Section` in chrome-text.tsx wraps it, and the fold header (fold-section.tsx) sets its title with the same style.
import type { ReactNode } from "react";
import { View } from "react-native";

import { useUiScale } from "./ui-scale.ts";
import { Text } from "./text.tsx";

/** A section title's size and tracking at the UI scale `s`; its colour is the class `text-moon`. */
export const sectionTitleStyle = (s: number) => ({ fontSize: 15 * s, lineHeight: 20 * s, letterSpacing: 1 * s });

export function SectionHeading({ title, right, testID, className }: { title: string; right?: ReactNode; testID?: string; className?: string }) {
  const s = useUiScale();
  return (
    <View testID={testID} className={`min-h-touch flex-row items-center gap-3${className ? ` ${className}` : ""}`}>
      <Text accessibilityRole="header" className="flex-1 font-display text-moon" style={sectionTitleStyle(s)}>
        {title}
      </Text>
      {right}
    </View>
  );
}
