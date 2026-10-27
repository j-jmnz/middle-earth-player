// The one fold control (phase 28b): a header that folds and unfolds the section under it. A 44 pt target; a chevron (down while
// open, right while folded), the title, a rule, and the count of what is inside while folded. A screen reader hears whether it is
// expanded and an announcement on each toggle. The body stays mounted and is hidden, so what it holds keeps its state; there is
// no animation (docs/design-system.md, Motion: a fold is a state change, not a motion).
import { useCallback, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { withAlphaHex } from "../play/tokens";
import { Chevron } from "./chrome-marks";
import { useDatabases } from "./databases";
import { foldWords, isFolded, type Sections } from "./fold-state";
import { palette } from "./palette.js";
import { readSections, writeSection } from "./section-store";

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
  return { folded, setFolded };
}

/**
 * A foldable section. The header's testID is `section-<id>` (`testID` overrides it: the archived lists keep `archived-toggle`) and
 * the body's is `section-<id>-body`. `right` is one optional control at the header's end while the section is open.
 */
export function FoldSection({
  id,
  title,
  folded,
  onFold,
  count,
  testID,
  right,
  children,
}: {
  id: string;
  title: string;
  folded: boolean;
  onFold: (folded: boolean) => void;
  // What the section holds, shown beside the title while folded.
  count?: number;
  testID?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const shown = count ?? null;
  return (
    <View>
      <View className="flex-row items-center">
        <Pressable
          testID={testID ?? `section-${id}`}
          collapsable={false}
          accessibilityRole="button"
          accessibilityState={{ expanded: !folded }}
          accessibilityLabel={foldWords(title, folded, shown)}
          onPress={() => {
            onFold(!folded);
            AccessibilityInfo.announceForAccessibility(`${title} ${folded ? "unfolded" : "folded"}`);
          }}
          className="min-h-11 flex-1 flex-row items-center gap-3 rounded-tile"
          style={({ pressed }) => (pressed ? { backgroundColor: palette.pressed } : undefined)}
        >
          <View className="w-3 items-center">
            <Chevron direction={folded ? "right" : "down"} color={palette.moon} size={8} />
          </View>
          <Text accessibilityRole="header" className="font-display-bold text-eyebrow uppercase text-moon">
            {title}
          </Text>
          <View className="h-px flex-1" style={{ backgroundImage: `linear-gradient(90deg, ${palette.hairline}, ${withAlphaHex(palette.hairline, 0)})`, backgroundColor: "transparent" }} />
          {folded && shown != null ? <Text className="pr-1 text-label text-muted">{String(shown)}</Text> : null}
        </Pressable>
        {folded ? null : right}
      </View>
      <View testID={`section-${id}-body`} style={folded ? { display: "none" } : undefined} accessibilityElementsHidden={folded} importantForAccessibility={folded ? "no-hide-descendants" : "auto"}>
        {children}
      </View>
    </View>
  );
}
