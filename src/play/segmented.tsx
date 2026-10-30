// The segmented switch (docs/design-system.md, Components): two or three words in a sunk track with no edge, a word optionally led by
// a game icon. It lives in src/play, in the table
// tokens, because the table's settings panel uses it too and src/play cannot import src/screens; chrome-buttons.tsx re-exports it.
import { Pressable, View } from "react-native";

import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import { segmentSurface, sunkSurface } from "./surfaces.ts";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** Two or three mutually exclusive words in a sunk track. Selected is a small plate lit from above, its word semibold in bone. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
  accessibilityLabel,
  stretch = false,
  compact = false,
  words,
  icons,
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
  // An icon before an option's word (the Eye of Sauron before Nightmare on the briefing): threat red on the selected option, muted
  // otherwise, so the option not picked never outshouts the one that is. The word stays, so it reads.
  icons?: Partial<Record<T, IconName>>;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  // The compact button is 32 pt tall (min-h-8) times the scale; a vertical slop makes up a 44 pt target at every scale.
  const slop = touchSlop(s, 32 * s);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className={`flex-row rounded-tile ${compact ? "p-0.5" : "p-1"} ${stretch ? "" : "self-start"}`} style={sunkSurface(t)}>
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
            // Stretched, each option grows from its own width (a word with an icon needs more than a third of a 320 pt phone's track),
            // with tighter padding; a word never breaks.
            className={`items-center justify-center rounded-chip ${compact ? "min-h-8 px-3" : stretch ? "min-h-touch px-2" : "min-h-touch px-4"}`}
            style={[stretch ? { flexGrow: 1, flexBasis: "auto" } : null, selected ? segmentSurface(t) : null]}
          >
            <View className="flex-row items-center gap-1.5">
              {icons?.[option] ? <GameIcon name={icons[option]} size={(compact ? 14 : 16) * s} tint={selected ? "threat" : "muted"} /> : null}
              <Text numberOfLines={1} className={`${compact ? "text-label" : "text-body"} ${selected ? "font-semibold text-bone" : "text-muted"}`}>{words?.[option] ?? option}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
