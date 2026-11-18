import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { CardDetailPane } from "../../pool/card-detail";
import { CardPool, CardPoolBody } from "../../pool/card-pool";
import { cardsWord } from "../../groups/card-group";
import { CardGroupBody, useCardGroup } from "../../groups/group-body";
import { EncounterList, rowKey } from "../../groups/encounter-list";
import type { EncounterRow } from "../../groups/encounter-tree";
import { CARDS_VIEWS, viewOf, viewWrites, type CardsView } from "../../groups/view";
import { BodyText, HubHeader, PillButton, Screen, SearchField, Segmented } from "../../kit/chrome";
import { useFolds } from "../../kit/fold-section";
import { useListPreview } from "../../pool/list-preview";
import { ToastView } from "../../kit/toast-view";
import { Text } from "../../../ui/text";
import { useSizeClass } from "../../../ui/use-size-class";

// The detail pane beside the pool on a tablet in landscape.
const DETAIL = 360;

// The Cards tab: a switch under the head between Player cards (the pool) and Encounter cards (the encounter sets and the campaigns' cards).
// The choice is kept in `settings.sections` with the folds. Player cards is every deck-legal player card, searched and filtered, with the
// Messenger of the King heroes under a type chip and the Collection one tap away. On a tablet in landscape the pool fills the left and a tap
// fills the card's detail in a pane on the right, with the picked card ringed in the grid; elsewhere a tap opens the card screen. Encounter
// cards is a search over one fold for each product, holding its sets and its campaigns' sections: a row opens its group on its own route, or
// in the pane beside the list on a tablet in landscape (docs/design-system.md, Card pool and Card groups).
export default function Cards() {
  const router = useRouter();
  const { size, s } = useSizeClass();
  const [picked, setPicked] = useState<string | null>(null);
  // The group open in the pane (tablet).
  const [open, setOpen] = useState<Pick<EncounterRow, "group" | "key"> | null>(null);
  const [search, setSearch] = useState("");
  const preview = useListPreview();
  const folds = useFolds();
  const view = viewOf(folds.folded);
  const encounter = view === "Encounter cards";
  const group = useCardGroup(encounter && open ? open.group : null, encounter && open ? open.key : null);
  const choose = (next: CardsView) => {
    for (const { id, value } of viewWrites(next)) folds.setFolded(id, value, false);
  };
  const header = (
    <>
      <HubHeader title="Cards">
        <PillButton label="Collection" testID="collection-open" accessibilityHint="Choose the cycles and packs you own" onPress={() => router.push("/collection")} />
      </HubHeader>
      <View className="mb-1 mt-2">
        <Segmented options={CARDS_VIEWS} value={view} onChange={choose} testIDPrefix="cards-view" testIDs={{ "Player cards": "cards-view-player", "Encounter cards": "cards-view-encounter" }} stretch accessibilityLabel="Cards" />
      </View>
    </>
  );
  const expanded = size === "expanded";
  if (encounter) {
    const onOpen = (row: EncounterRow) =>
      expanded ? setOpen({ group: row.group, key: row.key }) : router.push({ pathname: "/card-group/[kind]/[id]", params: { kind: row.group, id: row.key } });
    const list = (
      <View className="min-h-0 flex-1">
        <View className="mt-2">
          <SearchField testID="cards-encounter-search" value={search} onChangeText={setSearch} placeholder="Search scenario, set or campaign" accessibilityLabel="Search encounter cards" accessibilityHint="Searches set, pack, product and campaign names" />
        </View>
        <EncounterList folds={folds} search={search} selected={expanded && open ? rowKey(open) : null} onOpen={onOpen} />
      </View>
    );
    return (
      <Screen scene="calm">
        {header}
        {expanded ? (
          <View className="min-h-0 flex-1 flex-row" style={{ gap: 28 * s }}>
            <View className="min-w-0" style={{ width: DETAIL * s }}>
              {list}
            </View>
            <View className="min-w-0 flex-1" testID="cards-set-pane">
              {open ? (
                <>
                  {group ? (
                    <Text testID="cards-pane-title" numberOfLines={1} className="mt-2 font-display text-body text-bone">
                      {`${group.title} · ${cardsWord(group.count)}`}
                    </Text>
                  ) : null}
                  <CardGroupBody group={group} onDecline={() => setOpen(null)} onPreview={preview.open} />
                </>
              ) : (
                <BodyText tone="muted" className="mt-6 text-center">
                  Pick a set or a campaign section to see its cards here.
                </BodyText>
              )}
            </View>
          </View>
        ) : (
          list
        )}
        {preview.overlay}
      </Screen>
    );
  }
  if (!expanded) return <CardPool adding={false} header={header} />;
  return (
    <Screen scene="calm">
      {header}
      <View className="min-h-0 flex-1 flex-row" style={{ gap: 28 * s }}>
        <View className="min-w-0 flex-1">
          <CardPoolBody adding={false} onPreview={preview.open} onOpen={setPicked} selected={picked} />
        </View>
        <View style={{ width: DETAIL * s }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12 * s, paddingBottom: 32 * s }}>
            {picked ? (
              <CardDetailPane code={picked} width={DETAIL * s} />
            ) : (
              <BodyText tone="muted" className="mt-6 text-center">
                Tap a card to read it here.
              </BodyText>
            )}
          </ScrollView>
        </View>
      </View>
      <ToastView />
      {preview.overlay}
    </Screen>
  );
}
