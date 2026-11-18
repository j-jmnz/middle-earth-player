// The one fold control (phase 28b): a header that folds and unfolds the section under it. A 44 pt target; a chevron (down while
// open, right while folded), the title, and the count of what is inside while folded. A screen reader hears whether it is
// expanded and an announcement on each toggle. The body stays mounted and is hidden, so what it holds keeps its state; there is
// no animation (docs/design-system.md, Performance: a fold is a state change, not a motion).
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { usePlainTitles } from "../../ui/display-prefs";
import { sectionTitleStyle } from "../../ui/section-heading";
import { textSurface } from "../../ui/surfaces";
import { useUiScale } from "../../ui/ui-scale";
import { useTableTokens } from "../../ui/use-table-tokens";
import { Chevron } from "./chrome-marks";
import { useDatabases } from "../data/databases";
import { foldWords, isFolded, withAllFolded, type Sections } from "./fold-state";
import { plural } from "../history/words";
import { usePalette } from "./palette-hook";
import { readSections, writeSection, writeSections } from "../data/section-store";
import { Text } from "../../ui/text";
import { announce } from "../../ui/announce";

export type FoldIds = readonly { id: string; defaultFolded: boolean }[];

/** The screen's fold state: `folded` reads a section (its default when the viewer never changed it), `setFolded` changes and stores it, `setAll` sets several at once. */
export function useFolds(): {
  folded: (id: string, defaultFolded?: boolean) => boolean;
  setFolded: (id: string, folded: boolean, defaultFolded?: boolean) => void;
  setAll: (ids: FoldIds, folded: boolean) => void;
} {
  const { user } = useDatabases();
  const [sections, setSections] = useState<Sections>(() => readSections(user));
  const folded = useCallback((id: string, defaultFolded = false) => isFolded(sections, id, defaultFolded), [sections]);
  const setFolded = useCallback(
    (id: string, next: boolean, defaultFolded = false) => {
      try {
        setSections(writeSection(user, id, next, defaultFolded));
      } catch {
        // The fold still changes for this viewing when the row cannot be written.
        setSections((current) => ({ ...current, [id]: next }));
      }
    },
    [user],
  );
  const setAll = useCallback(
    (ids: FoldIds, next: boolean) => {
      try {
        setSections(writeSections(user, ids, next));
      } catch {
        setSections((current) => withAllFolded(current, ids, next));
      }
    },
    [user],
  );
  // One object while no function changes, so a caller can depend on it (or on `setFolded`, which only a new user changes).
  return useMemo(() => ({ folded, setFolded, setAll }), [folded, setFolded, setAll]);
}

/** A foldable section. The header's testID is `section-<id>` (`testID` overrides it) and the body's is `section-<id>-body`. */
export function FoldSection({ children, id, ...header }: FoldHeaderProps & { children: ReactNode }) {
  const { folded } = header;
  return (
    <View>
      <FoldHeader id={id} {...header} />
      <View testID={`section-${id}-body`} style={folded ? { display: "none" } : undefined} accessibilityElementsHidden={folded} importantForAccessibility={folded ? "no-hide-descendants" : "auto"}>
        {children}
      </View>
    </View>
  );
}

export type FoldHeaderProps = {
  id: string;
  title: string;
  folded: boolean;
  onFold: (folded: boolean) => void;
  // What the section holds, said beside the title while folded ("3 scenarios" with a unit, else the bare number).
  count?: number;
  unit?: string;
  // Words beside the title while folded, in place of the count (a seat's state): they never truncate, and `attention` sets them in danger.
  // `lead` goes before them and shrinks to one line (the seat's deck name).
  summary?: string;
  lead?: string;
  attention?: boolean;
  testID?: string;
};

/** The header alone: a FlashList row (History) folds a group without mounting its rows, so the header cannot own the body. */
export function FoldHeader({ id, title, folded, onFold, count, unit, summary, lead, attention, testID }: FoldHeaderProps) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const plain = usePlainTitles();
  const counted = summary != null ? (lead ? `${lead}, ${summary}` : summary) : count == null ? null : unit ? plural(count, unit) : String(count);
  const summaryTone = attention ? "text-danger" : "text-muted";
  return (
    // The heading is the row, so screen-reader heading navigation lands on it and the button stays inside.
    <View accessibilityRole="header" className="flex-row items-center">
      <Pressable
        testID={testID ?? `section-${id}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityState={{ expanded: !folded }}
        accessibilityLabel={foldWords(title, folded, counted)}
        onPress={() => {
          onFold(!folded);
          announce(`${title} ${folded ? "unfolded" : "folded"}`);
        }}
        className="flex-1"
      >
        {/* The pressed fill is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
        {({ pressed }) => (
          <View className="min-h-touch justify-center rounded-item" style={textSurface(pressed, t)}>
            <View className="flex-row items-center gap-3">
              <View className="w-3 items-center">
                <Chevron direction={folded ? "right" : "down"} color={palette.moon} size={8} />
              </View>
              <Text className="shrink font-display text-moon" style={sectionTitleStyle(s, plain)}>
                {title}
              </Text>
              <View className="min-w-3 flex-1" />
              {folded && summary != null ? (
                <>
                  {lead ? (
                    <Text className="min-w-0 shrink text-label text-muted" numberOfLines={1}>
                      {lead}
                    </Text>
                  ) : null}
                  <Text className={`shrink-0 pr-1 text-label ${summaryTone}`}>{lead ? `· ${summary}` : summary}</Text>
                </>
              ) : folded && counted != null ? (
                <Text className="pr-1 text-label text-muted">{counted}</Text>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}
