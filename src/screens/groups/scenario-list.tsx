// The Cards tab's Scenario view (docs/design-system.md, Card groups): the products of the collection in order, each pack a fold of its encounter
// sets as rows ("Wilderlands", "14 cards"), every fold closed until opened and kept in `settings.sections` like the other folds. A row opens the set:
// `onOpen` gets its key, and the tab pushes the card-group route or, on a tablet in landscape, fills the pane beside the list.
import { useMemo } from "react";
import { View } from "react-native";

import { useUiScale } from "../../ui/ui-scale";
import { useDatabases } from "../data/databases";
import { FoldSection, type useFolds } from "../kit/fold-section";
import { ListRow, ScreenScroll, Section } from "../kit/chrome";
import { groupDataOf } from "./cache";
import { cardsWord } from "./card-group";
import { FoldAllBar } from "./fold-all-bar";

/** A pack's fold id; every pack starts closed. */
export function packFoldId(code: string): string {
  return `cards-pack-${code}`;
}

export function ScenarioList({ folds, selected, onOpen }: { folds: ReturnType<typeof useFolds>; selected: string | null; onOpen: (key: string) => void }) {
  const { catalog } = useDatabases();
  const s = useUiScale();
  const tree = useMemo(() => groupDataOf(catalog).scenario(), [catalog]);
  const ids = useMemo(() => tree.products.flatMap((product) => product.packs.map((pack) => ({ id: packFoldId(pack.code), defaultFolded: true }))), [tree]);
  return (
    <ScreenScroll testID="cards-scenarios" top={4}>
      <FoldAllBar folds={folds} ids={ids} noun="pack" />
      <View style={{ gap: 6 * s }}>
        {tree.products.map((product) => (
          <View key={product.id} testID={`cards-product-${product.id}`}>
            {product.packs.length > 1 ? <Section title={product.title} className="mt-3" /> : null}
            {product.packs.map((pack) => {
              const id = packFoldId(pack.code);
              const folded = folds.folded(id, true);
              return (
                <FoldSection key={pack.code} id={id} title={product.packs.length > 1 ? pack.name : product.title} count={pack.sets.length} unit="set" folded={folded} onFold={(next) => folds.setFolded(id, next, true)}>
                  {folded
                    ? null
                    : pack.sets.map((set) => (
                        <ListRow key={set.key} testID={`cards-set-${set.key}`} label={set.name} detail={cardsWord(set.count)} selected={selected == null ? undefined : selected === set.key} onPress={() => onOpen(set.key)} />
                      ))}
                </FoldSection>
              );
            })}
          </View>
        ))}
      </View>
    </ScreenScroll>
  );
}
