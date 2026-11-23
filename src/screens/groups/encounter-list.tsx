// The Cards tab's Encounter cards view (docs/design-system.md, Card groups): the Collapse all / Expand all button over one fold for each product,
// each holding its encounter sets and then its campaigns' sections as rows, with a heading over a pack's several sets and over each campaign.
// Every fold starts closed and its state is kept in `settings.sections`; a closed fold does not mount its rows. While a search is typed, the
// products it keeps show open, whatever their saved state, and the button is gone. A row opens its group: `onOpen` gets it, and the tab
// pushes the card-group route or, on a tablet in landscape, fills the pane beside the list.
import { useMemo } from "react";
import { View } from "react-native";

import { useUiScale } from "../../ui/ui-scale";
import { collectionSets } from "../collection/sets";
import { useDatabases } from "../data/databases";
import { BodyText, ListRow, ScreenScroll, Section } from "../kit/chrome";
import { FoldSection, type useFolds } from "../kit/fold-section";
import { groupDataOf } from "./cache";
import { searchWords } from "../kit/fold";
import { encounterList, searchEncounter, type EncounterRow } from "./encounter-tree";
import { FoldAllBar } from "./fold-all-bar";

/** A product's fold id; every product starts closed. */
export function productFoldId(id: string): string {
  return `cards-product-${id}`;
}

/** The key the tablet pane compares a row by: a set and a campaign section are told apart by their group. */
export function rowKey(row: Pick<EncounterRow, "group" | "key">): string {
  return `${row.group}:${row.key}`;
}

export function EncounterList({
  folds,
  search,
  selected,
  onOpen,
}: {
  folds: ReturnType<typeof useFolds>;
  search: string;
  /** The `rowKey` of the row whose group is open in the tablet pane, or null outside it. */
  selected: string | null;
  onOpen: (row: EncounterRow) => void;
}) {
  const s = useUiScale();
  const { catalog } = useDatabases();
  const products = useMemo(() => {
    const data = groupDataOf(catalog);
    return encounterList(data.scenario(), data.campaign(), collectionSets());
  }, [catalog]);
  const shown = useMemo(() => searchEncounter(products, search), [products, search]);
  const searching = searchWords(search).length > 0;
  const ids = useMemo(() => products.map((product) => ({ id: productFoldId(product.id), defaultFolded: true })), [products]);
  return (
    <ScreenScroll testID="cards-encounter" top={4}>
      {searching ? null : <FoldAllBar folds={folds} ids={ids} noun="product" />}
      {shown.length === 0 ? (
        <BodyText testID="cards-encounter-empty" tone="muted" className="mt-6">
          Nothing matches.
        </BodyText>
      ) : null}
      <View style={{ gap: 6 * s }}>
        {shown.map((product) => {
          const id = productFoldId(product.id);
          const folded = searching ? false : folds.folded(id, true);
          return (
            <FoldSection key={product.id} id={id} title={product.title} summary={product.summary} folded={folded} onFold={(next) => (searching ? undefined : folds.setFolded(id, next, true))}>
              {folded
                ? null
                : product.items.map((item) =>
                    item.kind === "heading" ? (
                      <Section key={item.id} title={item.title} className="mt-2" />
                    ) : (
                      <ListRow
                        key={rowKey(item)}
                        testID={item.testID}
                        label={item.label}
                        detail={item.detail}
                        selected={selected == null ? undefined : selected === rowKey(item)}
                        onPress={() => onOpen(item)}
                      />
                    ),
                  )}
            </FoldSection>
          );
        })}
      </View>
    </ScreenScroll>
  );
}
