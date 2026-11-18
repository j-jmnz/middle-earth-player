// The list the Cards tab's Scenario and Campaign views share (docs/design-system.md, Card groups): the Collapse all / Expand all button over folds, each fold
// a `FoldSection` of rows that open a group. A fold starts closed, its state is kept in `settings.sections`, and a closed fold does not mount its rows. A
// block may carry a heading over its folds (a cycle's name over its packs).
import { useMemo } from "react";
import { View } from "react-native";

import { useUiScale } from "../../ui/ui-scale";
import { ListRow, ScreenScroll, Section } from "../kit/chrome";
import { FoldSection, type useFolds } from "../kit/fold-section";
import { FoldAllBar } from "./fold-all-bar";

export type FoldRow = { key: string; testID: string; label: string; detail: string };
export type FoldItem = { id: string; title: string; /** What the fold's header counts while folded: "set" for "3 sets". */ unit: string; rows: readonly FoldRow[] };
export type FoldBlock = { id: string; heading?: string; testID?: string; folds: readonly FoldItem[] };

export function FoldList({
  testID,
  noun,
  blocks,
  folds,
  selected,
  onOpen,
}: {
  testID: string;
  /** What "Fold all" names in its hint: "pack", "campaign". */
  noun: string;
  blocks: readonly FoldBlock[];
  folds: ReturnType<typeof useFolds>;
  /** The key of the row whose group is open in the tablet pane, or null outside it. */
  selected: string | null;
  onOpen: (key: string) => void;
}) {
  const s = useUiScale();
  const ids = useMemo(() => blocks.flatMap((block) => block.folds.map((fold) => ({ id: fold.id, defaultFolded: true }))), [blocks]);
  return (
    <ScreenScroll testID={testID} top={4}>
      <FoldAllBar folds={folds} ids={ids} noun={noun} />
      <View style={{ gap: 6 * s }}>
        {blocks.map((block) => (
          <View key={block.id} {...(block.testID ? { testID: block.testID } : {})}>
            {block.heading ? <Section title={block.heading} className="mt-3" /> : null}
            {block.folds.map((fold) => {
              const folded = folds.folded(fold.id, true);
              return (
                <FoldSection key={fold.id} id={fold.id} title={fold.title} count={fold.rows.length} unit={fold.unit} folded={folded} onFold={(next) => folds.setFolded(fold.id, next, true)}>
                  {folded ? null : fold.rows.map((row) => <ListRow key={row.key} testID={row.testID} label={row.label} detail={row.detail} selected={selected == null ? undefined : selected === row.key} onPress={() => onOpen(row.key)} />)}
                </FoldSection>
              );
            })}
          </View>
        ))}
      </View>
    </ScreenScroll>
  );
}
