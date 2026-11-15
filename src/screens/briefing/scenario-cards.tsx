// The scenario's own cards on the briefing, where the decks are picked and Deal waits (user request, 2026-11-01): the campaign card (its
// Setup side, rr.campaign-cards) and the quest cards. Each row opens the cards large in the list preview. Stage 1 opens at once; the later
// stages hold spoilers, so their row asks first, in place, before it shows every stage.
import { eq } from "drizzle-orm";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { cards } from "../../catalog/schema";
import { Text } from "../../ui/text";
import { ListRow, Section, TextButton } from "../kit/chrome";
import { useDatabases } from "../data/databases";
import type { CardSide } from "../pool/list-preview";
import { CardThumb } from "./card-thumb";
import { questSides } from "./scenario-sides";

export function ScenarioCards({ campaignCard, stages, onOpen }: { campaignCard?: string; stages: readonly string[]; onOpen: (sides: readonly CardSide[]) => void }) {
  const { catalog } = useDatabases();
  // The spoiler warning under All quest cards, until the player shows them or says not now.
  const [warning, setWarning] = useState(false);
  const campaign = useMemo(() => (campaignCard ? (catalog.select({ name: cards.name, imagesrc: cards.imagesrc }).from(cards).where(eq(cards.code, campaignCard)).get() ?? null) : null), [catalog, campaignCard]);
  const first = stages[0];
  const firstRow = useMemo(() => (first ? (catalog.select({ name: cards.name, imagesrc: cards.imagesrc }).from(cards).where(eq(cards.code, first)).get() ?? null) : null), [catalog, first]);
  const later = stages.length > 1;
  return (
    <View testID="briefing-scenario-cards">
      {campaign && campaignCard ? (
        <View testID="briefing-campaign-card" className="mt-5">
          <Section title="Campaign card" />
          <ListRow testID="briefing-campaign-card-open" label={campaign.name} detail="Setup · tap to see the card" leading={<CardThumb code={campaignCard} imagesrc={campaign.imagesrc} />} onPress={() => onOpen([{ code: campaignCard, side: "A" }])} />
        </View>
      ) : null}
      {firstRow && first ? (
        <View testID="briefing-quest-cards" className="mt-5">
          <Section title="Quest cards" />
          <ListRow testID="briefing-quest-first" label={firstRow.name} detail="Stage 1 · both sides" leading={<CardThumb code={first} imagesrc={firstRow.imagesrc} />} onPress={() => onOpen(questSides([first]))} />
          {later ? (
            <ListRow
              testID="briefing-quest-all"
              label="All quest cards"
              detail={`Stages 1 to ${stages.length} · spoilers`}
              onPress={() => setWarning(true)}
            />
          ) : null}
          {later && warning ? (
            <View testID="briefing-quest-spoiler" className="mt-2 gap-1">
              <Text className="text-label text-danger">The later quest cards show what this scenario holds before you meet it. Read them anyway?</Text>
              <View className="flex-row gap-4">
                <TextButton
                  label="Show all stages"
                  testID="briefing-quest-spoiler-show"
                  tone="accent"
                  onPress={() => {
                    setWarning(false);
                    onOpen(questSides(stages));
                  }}
                />
                <TextButton label="Not now" testID="briefing-quest-spoiler-cancel" onPress={() => setWarning(false)} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
