import { useLocalSearchParams, useRouter } from "expo-router";
import { useDeferredValue, useMemo } from "react";

import { campaignOf } from "../../data/campaign-data";
import { useDatabases } from "../../data/databases";
import { groupDataOf } from "../../groups/cache";
import { cardsWord } from "../../groups/card-group";
import { scenarioRows } from "../../groups/campaign-scenarios";
import { BodyText, ListRow, NavBar, Screen, ScreenScroll, Section } from "../../kit/chrome";
import { goBack } from "../../nav/go-back";
import { routeCode } from "../../nav/route-code";

// A campaign's cards (docs/design-system.md, Campaign setup): its scenarios in book order, each a row that opens the scenario's cards on the
// card-group route, then the campaign's own sections (campaign cards, Boons, Burdens, Treasures). The campaign setup opens it with `after`
// set to 1 for the scenarios after the first (the setup shows the first and the sections itself); the path opens it whole. The groups ask
// the one spoiler question; the list itself holds only names.
export default function CampaignCardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ campaignId: string; after?: string }>();
  const campaignId = routeCode(params.campaignId);
  const after = Number(routeCode(params.after) ?? 0) || 0;
  const { catalog } = useDatabases();
  const data = campaignId ? campaignOf(campaignId) : null;
  const scenarios = useMemo(() => scenarioRows(data?.scenarios ?? [], after), [data, after]);
  // The sections need the catalog's campaign tree: read after the first paint, and only for the whole campaign.
  const ready = useDeferredValue(true, false);
  const sections = useMemo(() => (ready && after === 0 && campaignId ? (groupDataOf(catalog).campaign().campaigns.find((campaign) => campaign.id === campaignId)?.sections ?? []) : []), [ready, after, campaignId, catalog]);
  const back = () => goBack(router, "/");
  const open = (kind: "scenario" | "campaign", id: string) => router.push({ pathname: "/card-group/[kind]/[id]", params: { kind, id, from: "campaign" } });
  const last = data?.scenarios.length ?? 0;
  const subtitle = after > 0 ? `Scenarios ${after + 1} to ${last}` : "Every card of the campaign";
  return (
    <Screen scene="calm" testID="campaign-cards">
      <NavBar backLabel="Back" backTestID="campaign-cards-back" onBack={back} title={data?.name} subtitle={data ? subtitle : undefined} wrap />
      <ScreenScroll top={4}>
        {!data ? (
          <BodyText tone="muted" className="mt-6">
            That campaign is not in the app.
          </BodyText>
        ) : null}
        {scenarios.length > 0 ? <Section title="Scenarios" className="mt-2" /> : null}
        {scenarios.map((scenario) => (
          <ListRow key={scenario.id} testID={`campaign-cards-scenario-${scenario.id}`} label={scenario.name} detail={scenario.detail} onPress={() => open("scenario", scenario.id)} />
        ))}
        {sections.length > 0 ? <Section title="Campaign" className="mt-4" /> : null}
        {sections.map((section) => (
          <ListRow key={section.key} testID={`campaign-cards-section-${section.key}`} label={section.title} detail={cardsWord(section.count)} onPress={() => open("campaign", section.key)} />
        ))}
      </ScreenScroll>
    </Screen>
  );
}
