// The one fold control (phase 28b): a header that folds and unfolds the section under it. A 44 pt target; a chevron (down while
// open, right while folded), the title, a rule, and the count of what is inside while folded. A screen reader hears whether it is
// expanded and an announcement on each toggle. The body stays mounted and is hidden, so what it holds keeps its state; there is
// no animation (docs/design-system.md, Motion: a fold is a state change, not a motion).
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";

import { SectionRule, sectionTitleStyle } from "../play/section-heading";
import { useUiScale } from "../play/ui-scale";
import { Chevron, Chip } from "./chrome-marks";
import { useDatabases } from "./databases";
import { foldWords, isFolded, type Sections } from "./fold-state";
import { plural } from "./history-words";
import { usePalette } from "./palette-hook";
import { readSections, writeSection } from "./section-store";
import { Text } from "../play/text";

/** The screen's fold state: `folded` reads a section (its default when the viewer never changed it), `setFolded` changes and stores it. */
export function useFolds(): { folded: (id: string, defaultFolded?: boolean) => boolean; setFolded: (id: string, folded: boolean, defaultFolded?: boolean) => void } {
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
  // One object while neither function changes, so a caller can depend on it (or on `setFolded`, which only a new user changes).
  return useMemo(() => ({ folded, setFolded }), [folded, setFolded]);
}

/**
 * A foldable section. The header's testID is `section-<id>` (`testID` overrides it: the archived lists keep `archived-toggle`) and
 * the body's is `section-<id>-body`. `right` is one optional control at the header's end while the section is open.
 */
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
  // Replaces the count while folded, on a second line: what the viewer would otherwise lose sight of ("Next: A Knife in the Dark").
  summary?: string;
  // A second line under the title, always: what tells two sections with one title apart.
  detail?: string;
  // A word in a chip after the title (Archived, Deleted): the state is a word, not only a colour.
  badge?: string;
  testID?: string;
  right?: ReactNode;
  // A row of a FlashList draws no gradient (docs/design-system.md, Performance): the rule is a solid hairline.
  solid?: boolean;
};

/** The header alone: a FlashList row (History) folds a group without mounting its rows, so the header cannot own the body. */
export function FoldHeader({ id, title, folded, onFold, count, unit, summary, detail, badge, testID, right, solid = false }: FoldHeaderProps) {
  const palette = usePalette();
  const s = useUiScale();
  const counted = count == null ? null : unit ? plural(count, unit) : String(count);
  const second = folded && summary ? summary : (detail ?? null);
  // The count says what is inside while folded, unless the summary says it better.
  const note = folded && !summary ? counted : null;
  const spoken = folded ? (summary ?? counted) : counted;
  return (
    // The heading is the row, so screen-reader heading navigation lands on it and the button stays inside.
    <View accessibilityRole="header" className="flex-row items-center">
      <Pressable
        testID={testID ?? `section-${id}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityState={{ expanded: !folded }}
        accessibilityLabel={foldWords([title, detail, badge].filter((part) => part != null).join(", "), folded, spoken)}
        onPress={() => {
          onFold(!folded);
          AccessibilityInfo.announceForAccessibility(`${title} ${folded ? "unfolded" : "folded"}`);
        }}
        className="min-h-touch flex-1 justify-center rounded-tile"
        style={({ pressed }) => (pressed ? { backgroundColor: palette.pressed } : undefined)}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-3 items-center">
            <Chevron direction={folded ? "right" : "down"} color={palette.moon} size={8} />
          </View>
          <Text className="shrink font-display text-moon" style={sectionTitleStyle(s)}>
            {title}
          </Text>
          {badge ? <Chip label={badge} tone="faint" /> : null}
          <SectionRule solid={solid} />
          {note != null ? <Text className="pr-1 text-label text-muted">{note}</Text> : null}
        </View>
        {second ? <Text className="pb-1.5 pl-6 text-label text-muted">{second}</Text> : null}
      </Pressable>
      {folded ? null : right}
    </View>
  );
}
