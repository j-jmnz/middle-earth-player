// A section's heading (docs/design-system.md, Type): its name in Marcellus SC 15 in the section colour, and a rule that fades out to
// its right, with one optional control at the end. It lives in src/play, in the table tokens, because the table's settings panel uses it and src/play cannot import
// src/screens; `Section` in chrome-text.tsx wraps it.
import type { ReactNode } from "react";
import { View } from "react-native";

import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

export function SectionHeading({ title, right, testID, className }: { title: string; right?: ReactNode; testID?: string; className?: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View testID={testID} className={`min-h-touch flex-row items-center gap-3${className ? ` ${className}` : ""}`}>
      <Text accessibilityRole="header" className="font-display text-moon" style={{ fontSize: 15 * s, lineHeight: 20 * s, letterSpacing: 1 * s }}>
        {title}
      </Text>
      <View className="h-px flex-1" style={{ backgroundImage: `linear-gradient(90deg, ${withAlphaHex(t.moon, 0.45)}, ${withAlphaHex(t.moon, 0)})`, backgroundColor: "transparent" }} />
      {right}
    </View>
  );
}
