// The segmented switch (docs/design-system.md, Components): two or three words in a tonal capsule track with no edge. It lives in src/play, in the table
// tokens, because the table's settings panel uses it too and src/play cannot import src/screens; chrome-buttons.tsx re-exports it.
import { Pressable, View } from "react-native";

import { segmentRestSurface, segmentSurface, sunkSurface } from "./surfaces.ts";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** Two or three mutually exclusive words in a tonal capsule track. Selected is a lighter capsule thumb, its word semibold in bone. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
  accessibilityLabel,
  stretch = false,
  compact = false,
  words,
  testIDs,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  testIDPrefix: string;
  // The group's name to a screen reader ("Theme"); the rows that hold a title pass it.
  accessibilityLabel?: string;
  // Fill the width, each word an equal share (Easy / Normal on the briefing).
  stretch?: boolean;
  // A 36 pt track in label type: a view switch beside a count.
  compact?: boolean;
  // What each option says when its stored word is not the word to read ("system" says "Follow system"); the test id keeps the option.
  words?: Partial<Record<T, string>>;
  // An option's test id when it is not `<prefix>-<option>` (Campaigns' seats keep `seats-1`), and what a screen reader hears for it when the word alone is not enough.
  testIDs?: Partial<Record<T, string>>;
  labels?: Partial<Record<T, string>>;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  // The track is 44 pt tall (a 38 pt thumb in 3 pt of padding), 36 pt compact (a 32 pt thumb in 2 pt): the option's vertical slop makes up
  // a 44 pt target at every scale.
  const thumb = (compact ? 32 : 38) * s;
  const slop = touchSlop(s, thumb);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={`flex-row rounded-control ${stretch ? "" : "self-start"}`}
      style={{ padding: (compact ? 2 : 3) * s, ...sunkSurface(t) }}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            testID={testIDs?.[option] ?? `${testIDPrefix}-${option.toLowerCase()}`}
            accessibilityRole="radio"
            accessibilityLabel={labels?.[option]}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option)}
            hitSlop={{ top: slop, bottom: slop }}
            className={stretch ? "flex-1" : ""}
          >
            {/* The thumb and its pressed fill are on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
            {({ pressed }) => (
              <View
                className={`items-center justify-center rounded-control ${compact ? "px-3" : "px-4"}`}
                style={{ minHeight: thumb, ...(selected ? segmentSurface(t, pressed) : segmentRestSurface(pressed, t)) }}
              >
                <Text className={`${compact ? "text-label" : "text-body"} ${selected ? "font-semibold text-bone" : "text-muted"}`}>{words?.[option] ?? option}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
