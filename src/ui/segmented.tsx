// The segmented switch (docs/design-system.md, Components): two to four words in a tonal capsule track with no edge, a word optionally
// led by a game icon. It lives in src/play, in the table tokens, because the table's settings panel uses it too and src/play cannot
// import src/screens; chrome-buttons.tsx re-exports it.
import { Pressable, View } from "react-native";

import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import { segmentRestSurface, segmentSurface, sunkSurface } from "./surfaces.ts";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** Two to four mutually exclusive words in a tonal capsule track. Selected is a lighter capsule thumb, its word semibold in bone. */
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
  // An icon before an option's word (the Eye of Sauron before Nightmare on the briefing): threat red on the selected option, muted
  // otherwise, so the option not picked never outshouts the one that is. The word stays, so it reads.
  icons?: Partial<Record<T, IconName>>;
  // An option's test id when it is not `<prefix>-<option>` (Campaigns' seats keep `seats-1`), and what a screen reader hears for it when the word alone is not enough.
  testIDs?: Partial<Record<T, string>>;
  labels?: Partial<Record<T, string>>;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  // The track is 44 pt tall (a 38 pt thumb in 3 pt of padding), 36 pt compact (a 32 pt thumb in 2 pt): the option's vertical slop makes up
  // a 44 pt target at every scale.
  const thumb = (compact ? 32 : 38) * s;
  const pad = (compact ? 2 : 3) * s;
  const slop = touchSlop(s, thumb);
  // The capsule radii are drawn in the style, not the `rounded-control` class: on Android the selected thumb lost the class's radius when
  // its fill changed on a pick and was drawn square (user report, 2026-11-01), so both corners are computed from their heights here.
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={`flex-row ${stretch ? "" : "self-start"}`}
      // A stretched track whose words no longer fit one line (four words at Extra large, or at the phone's larger text sizes) wraps its
      // options onto a second line, so none is cut or pushed off the screen.
      style={{ padding: pad, flexWrap: stretch ? "wrap" : "nowrap", borderRadius: thumb / 2 + pad, ...sunkSurface(t) }}
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
            // Stretched, each option grows from its own width (a word with an icon needs more than a third of a 320 pt phone's track),
            // with tighter padding; a word never breaks.
            style={stretch ? { flexGrow: 1, flexBasis: "auto" } : undefined}
          >
            {/* The thumb and its pressed fill are on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
            {({ pressed }) => (
              <View
                className={`flex-row items-center justify-center gap-1.5 ${compact ? "px-3" : stretch ? "px-2" : "px-4"}`}
                style={{ minHeight: thumb, borderRadius: thumb / 2, overflow: "hidden", ...(selected ? segmentSurface(t, pressed) : segmentRestSurface(pressed, t)) }}
              >
                {icons?.[option] ? <GameIcon name={icons[option]} size={(compact ? 14 : 16) * s} tint={selected ? "threat" : "muted"} /> : null}
                <Text numberOfLines={1} className={`${compact ? "text-label" : "text-body"} ${selected ? "font-semibold text-bone" : "text-muted"}`}>{words?.[option] ?? option}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
