// The Cards tab's Scenario view (docs/design-system.md, Card groups): the products of the collection in order, each pack a fold of its encounter
// sets as rows ("Wilderlands", "14 cards"), every fold closed until opened and kept in `settings.sections` like the other folds. A row opens the set:
// `onOpen` gets its key, and the tab pushes the card-group route or, on a tablet in landscape, fills the pane beside the list.
import { useMemo } from "react";

import { useDatabases } from "../data/databases";
import { type useFolds } from "../kit/fold-section";
import { groupDataOf } from "./cache";
import { cardsWord } from "./card-group";
import { FoldList, type FoldBlock } from "./fold-list";

/** A pack's fold id; every pack starts closed. */
export function packFoldId(code: string): string {
  return `cards-pack-${code}`;
}

export function ScenarioList({ folds, selected, onOpen }: { folds: ReturnType<typeof useFolds>; selected: string | null; onOpen: (key: string) => void }) {
  const { catalog } = useDatabases();
  const blocks = useMemo(
    (): FoldBlock[] =>
      groupDataOf(catalog)
        .scenario()
        .products.map((product) => ({
          id: product.id,
          testID: `cards-product-${product.id}`,
          ...(product.packs.length > 1 ? { heading: product.title } : {}),
          folds: product.packs.map((pack) => ({
            id: packFoldId(pack.code),
            title: product.packs.length > 1 ? pack.name : product.title,
            unit: "set",
            rows: pack.sets.map((set) => ({ key: set.key, testID: `cards-set-${set.key}`, label: set.name, detail: cardsWord(set.count) })),
          })),
        })),
    [catalog],
  );
  return <FoldList testID="cards-scenarios" noun="pack" blocks={blocks} folds={folds} selected={selected} onOpen={onOpen} />;
}
