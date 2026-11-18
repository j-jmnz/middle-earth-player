import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { CardDetailPane } from "../../pool/card-detail";
import { CardPool, CardPoolBody } from "../../pool/card-pool";
import { CardGroupBody, useCardGroup } from "../../groups/group-body";
import { CampaignList } from "../../groups/campaign-list";
import { MotkRow } from "../../groups/motk-row";
import { ScenarioList } from "../../groups/scenario-list";
import { CARDS_VIEWS, viewOf, viewWrites, type CardsView } from "../../groups/view";
import { BodyText, HubHeader, PillButton, Screen, Segmented } from "../../kit/chrome";
import { useFolds } from "../../kit/fold-section";
import { useListPreview } from "../../pool/list-preview";
import { ToastView } from "../../kit/toast-view";
import { useSizeClass } from "../../../ui/use-size-class";

// The detail pane beside the pool on a tablet in landscape.
const DETAIL = 360;

// The Cards tab: a switch under the head between the player pool, the encounter sets by scenario and the campaigns' cards. The
// choice is kept in `settings.sections` with the folds. Player is every deck-legal player card, searched and filtered, with the Collection one
// tap away. On a tablet in landscape the pool fills the left and a tap fills the card's detail in a pane on the right, with the picked card
// ringed in the grid; elsewhere a tap opens the card screen. Scenario lists the packs as folds of encounter sets and Campaign the campaigns as folds of
// their sections: a set or section opens on its own route, or in the pane beside the list on a tablet in landscape; the Player view also
// holds the Messenger of the King heroes' row (browse only) (docs/design-system.md, Card pool and Card groups).
export default function Cards() {
  const router = useRouter();
  const { size, s } = useSizeClass();
  const [picked, setPicked] = useState<string | null>(null);
  // The group open in the pane (tablet), with the view it belongs to, so a key from the other view is never looked up.
  const [open, setOpen] = useState<{ view: CardsView; key: string } | null>(null);
  const preview = useListPreview();
  const folds = useFolds();
  const view = viewOf(folds.folded);
  const openKey = open?.view === view ? open.key : null;
  const group = useCardGroup(view === "Scenario" ? "set" : view === "Campaign" ? "campaign" : null, openKey);
  const choose = (next: CardsView) => {
    for (const { id, value } of viewWrites(next)) folds.setFolded(id, value, false);
  };
  const header = (
    <>
      <HubHeader title="Cards">
        <PillButton label="Collection" testID="collection-open" accessibilityHint="Choose the cycles and packs you own" onPress={() => router.push("/collection")} />
      </HubHeader>
      <View className="mb-1 mt-2">
        <Segmented options={CARDS_VIEWS} value={view} onChange={choose} testIDPrefix="cards-view" stretch accessibilityLabel="Cards" />
      </View>
      {view === "Player" ? <MotkRow /> : null}
    </>
  );
  const expanded = size === "expanded";
  if (view !== "Player") {
    const params = { kind: view === "Scenario" ? "set" : "campaign" };
    const onOpen = (key: string) => (expanded ? setOpen({ view, key }) : router.push({ pathname: "/card-group/[kind]/[id]", params: { ...params, id: key } }));
    const list = view === "Scenario" ? <ScenarioList folds={folds} selected={expanded ? openKey : null} onOpen={onOpen} /> : <CampaignList folds={folds} selected={expanded ? openKey : null} onOpen={onOpen} />;
    return (
      <Screen scene="calm">
        {header}
        {expanded ? (
          <View className="min-h-0 flex-1 flex-row" style={{ gap: 28 * s }}>
            <View className="min-w-0" style={{ width: DETAIL * s }}>
              {list}
            </View>
            <View className="min-w-0 flex-1" testID="cards-set-pane">
              {openKey ? (
                <CardGroupBody group={group} onDecline={() => setOpen(null)} onPreview={preview.open} />
              ) : (
                <BodyText tone="muted" className="mt-6 text-center">
                  {view === "Scenario" ? "Pick a set to see its cards here." : "Pick a section to see its cards here."}
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
