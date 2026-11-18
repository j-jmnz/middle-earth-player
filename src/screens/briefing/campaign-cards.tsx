// The campaign's cards on the campaign setup (docs/design-system.md, Campaign setup; user decision, 2026-11-18), in three sections. Scenario 1:
// its campaign card, open at once on its Setup side only (its Resolution side is turned over after the scenario is defeated, rr.campaign-cards),
// its quest cards (every stage, both sides) and its encounter cards (the scenario's card group). Later scenarios: one row that opens the
// campaign's cards screen on the scenarios after the first. Campaign: the campaign's sections (campaign cards, Boons, Burdens, Treasures),
// read after the first paint. Every row that shows spoilers waits on the one spoiler answer (groups/reveal.ts): the quest cards ask it in
// place, the groups on their route.
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { printedScenarioName } from "../../campaign/printed-name";
import { scenarioOf } from "../data/campaign-data";
import { encounterWords, stagesWords } from "../groups/campaign-scenarios";
import { CampaignSections } from "../groups/campaign-sections";
import { revealSpoilers, SPOILER_TEXT, useSpoilersRevealed } from "../groups/reveal";
import { ListRow, Section } from "../kit/chrome";
import { SpoilerAsk } from "../kit/spoiler-ask";
import type { CardSide } from "../pool/list-preview";
import { CardThumb } from "./card-thumb";
import { useCardFacts } from "./card-rows";
import { questSides } from "./scenario-sides";

export type CampaignSetupCardsProps = { id: string; scenarios: readonly string[]; campaignCards: Readonly<Record<string, string>> };

export function CampaignSetupCards({ campaign, onOpen }: { campaign: CampaignSetupCardsProps; onOpen: (sides: readonly CardSide[]) => void }) {
  const router = useRouter();
  const shown = useSpoilersRevealed();
  const [asking, setAsking] = useState(false);
  const firstId = campaign.scenarios[0];
  const first = firstId ? scenarioOf(firstId) : null;
  const cardCode = firstId ? campaign.campaignCards[firstId] : undefined;
  const card = useCardFacts(cardCode);
  if (!first || !firstId) return null;
  const name = printedScenarioName(first.name);
  const spoilers = shown ? "" : " · spoilers";
  const later = campaign.scenarios.length - 1;
  const openQuest = () => onOpen(questSides(first.stages));
  const openScenario = (id: string) => router.push({ pathname: "/card-group/[kind]/[id]", params: { kind: "scenario", id, from: "setup" } });
  return (
    <View testID="setup-campaign-cards" className="mt-5">
      <Section title={`Scenario 1 · ${name}`} />
      {cardCode && card ? (
        <ListRow
          testID="setup-campaign-first"
          label="Campaign card"
          detail={`${card.name} · Setup`}
          leading={<CardThumb code={cardCode} imagesrc={card.imagesrc} />}
          onPress={() => onOpen([{ code: cardCode, side: "A", label: `${name} · Setup` }])}
        />
      ) : null}
      <ListRow testID="setup-quest-cards" label="Quest cards" detail={`${stagesWords(first.stages.length)}${spoilers}`} onPress={() => (shown ? openQuest() : setAsking(true))} />
      {asking && !shown ? (
        <SpoilerAsk
          testID="setup-spoiler"
          text={SPOILER_TEXT}
          showLabel="Show them"
          onShow={() => {
            setAsking(false);
            revealSpoilers();
            openQuest();
          }}
          onCancel={() => setAsking(false)}
        />
      ) : null}
      <ListRow testID="setup-encounter-cards" label="Encounter cards" detail={`${encounterWords(first.encounterSets)}${spoilers}`} onPress={() => openScenario(firstId)} />
      {later > 0 ? (
        <>
          <Section title="Later scenarios" className="mt-4" />
          <ListRow
            testID="setup-later-scenarios"
            label={`${later} ${later === 1 ? "scenario" : "scenarios"}`}
            detail={`${later === 1 ? "Scenario 2" : `Scenarios 2 to ${later + 1}`}${spoilers}`}
            onPress={() => router.push({ pathname: "/campaign-cards/[campaignId]", params: { campaignId: campaign.id, after: "1" } })}
          />
        </>
      ) : null}
      <CampaignSections campaignId={campaign.id} testIDPrefix="setup-section" from="setup" suffix={spoilers} />
    </View>
  );
}
