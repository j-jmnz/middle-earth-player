// The segmented switch (docs/design-system.md, Components): two or three words in a sunk night track. It lives in src/play, in the table
// tokens, because the table's settings panel uses it too and src/play cannot import src/screens; chrome-buttons.tsx re-exports it.
import { Pressable, View } from "react-native";

import { raisedEdgeOf, slateSurface } from "./surfaces.ts";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** Two or three mutually exclusive words in a sunk night track. Selected is a slate plate in an accent edge, semibold. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
  accessibilityLabel,
  stretch = false,
  compact = false,
  words,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  testIDPrefix: string;
  // The group's name to a screen reader ("Theme"); the rows that hold a title pass it.
  accessibilityLabel?: string;
  // Fill the width, each word an equal share (Easy / Normal on the briefing).
  stretch?: boolean;
  // A 36 pt track in label type, its 44 pt targets kept by a vertical hit slop: a view switch beside a count.
  compact?: boolean;
  // What each option says when its stored word is not the word to read ("system" says "Follow system"); the test id keeps the option.
  words?: Partial<Record<T, string>>;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  // The compact button is 32 pt tall (min-h-8) times the scale; a vertical slop makes up a 44 pt target at every scale.
  const slop = touchSlop(s, 32 * s);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className={`flex-row rounded-tile ${compact ? "p-0.5" : "p-1"} ${stretch ? "" : "self-start"}`} style={{ backgroundColor: t.night, borderWidth: 1, borderColor: t.hairline }}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            testID={`${testIDPrefix}-${option.toLowerCase()}`}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option)}
            hitSlop={compact ? { top: slop, bottom: slop } : undefined}
            className={`items-center justify-center rounded-chip ${compact ? "min-h-8 px-3" : "min-h-touch px-4"} ${stretch ? "flex-1" : ""}`}
            style={selected ? { ...slateSurface(false, t), borderWidth: 1, borderColor: t.accentLine, boxShadow: raisedEdgeOf(t) } : { borderWidth: 1, borderColor: "transparent" }}
          >
            <Text className={`${compact ? "text-label" : "text-body"} ${selected ? "font-semibold text-bone" : "text-muted"}`}>{words?.[option] ?? option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
