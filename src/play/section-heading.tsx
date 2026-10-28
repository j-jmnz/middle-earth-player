// A section's heading (docs/design-system.md, Type): a moonlit eyebrow and a rule that fades out to its right, with one optional control
// at the end. It lives in src/play, in the table tokens, because the table's settings panel uses it and src/play cannot import
// src/screens; `Section` in chrome-text.tsx wraps it.
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { withAlphaHex } from "./tokens.ts";
import { useTableTokens } from "./use-table-tokens.ts";

export function SectionHeading({ title, right, testID, className }: { title: string; right?: ReactNode; testID?: string; className?: string }) {
  const t = useTableTokens();
  return (
    <View testID={testID} className={`min-h-touch flex-row items-center gap-3${className ? ` ${className}` : ""}`}>
      <Text accessibilityRole="header" className="font-display-bold text-eyebrow uppercase text-moon">
        {title}
      </Text>
      <View className="h-px flex-1" style={{ backgroundImage: `linear-gradient(90deg, ${t.hairline}, ${withAlphaHex(t.hairline, 0)})`, backgroundColor: "transparent" }} />
      {right}
    </View>
  );
}
