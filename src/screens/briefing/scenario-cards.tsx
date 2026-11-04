// The scenario's own cards on the briefing, where the decks are picked and Deal waits (user request, 2026-11-01): the campaign card (its
// Setup side, rr.campaign-cards) and the quest cards. Each row opens the cards large in the list preview. Stage 1 opens at once; the later
// stages hold spoilers, so their row asks first, in place, before it shows every stage.
import { eq } from "drizzle-orm";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { cards } from "../../catalog/schema";
import { cardCorner } from "../../ui/card-corner";
import { Text } from "../../ui/text";
import { useUiScale } from "../../ui/ui-scale";
import { ListRow, Section, TextButton } from "../kit/chrome";
import { useDatabases } from "../data/databases";
import { RowCardImage } from "../images/picture";
import { cardImageUrl, shownCardImage } from "../images/policy";
import { scanAssets } from "../images/scan-map";
import { useCachedImage } from "../images/store";
import type { CardSide } from "../pool/list-preview";
import { questSides } from "./scenario-sides";

// A card's thumbnail at a list row's size: its downloaded file, its bundled scan, or its remote picture.
function Thumb({ code, imagesrc }: { code: string; imagesrc: string | null }) {
  const s = useUiScale();
  const cached = useCachedImage(code);
  const { source } = shownCardImage({ cached, imagesrc, bundled: scanAssets[code] ?? null });
  const remote = !source && imagesrc ? cardImageUrl(imagesrc) : null;
  const picture = source ?? (remote ? { uri: remote } : null);
  return (
    <View className="overflow-hidden bg-raised" style={{ width: 32 * s, height: 44 * s, borderRadius: cardCorner(32 * s, 44 * s) }}>
      {picture ? <RowCardImage code={code} source={picture} width={32 * s} height={44 * s} /> : null}
    </View>
  );
}

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
          <ListRow testID="briefing-campaign-card-open" label={campaign.name} detail="Setup · tap to see the card" leading={<Thumb code={campaignCard} imagesrc={campaign.imagesrc} />} onPress={() => onOpen([{ code: campaignCard, side: "A" }])} />
        </View>
      ) : null}
      {firstRow && first ? (
        <View testID="briefing-quest-cards" className="mt-5">
          <Section title="Quest cards" />
          <ListRow testID="briefing-quest-first" label={firstRow.name} detail="Stage 1 · both sides" leading={<Thumb code={first} imagesrc={firstRow.imagesrc} />} onPress={() => onOpen(questSides([first]))} />
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
