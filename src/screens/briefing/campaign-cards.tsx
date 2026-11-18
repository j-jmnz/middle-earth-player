// The campaign's own cards on the campaign setup (user request, 2026-11-18): the first scenario's campaign card, open at once on both sides (Setup and
// Resolution, rr.campaign-cards), and "All campaign cards", every scenario's in book order, which asks the same in-place spoiler question as the
// briefing's "All quest cards" before it shows them. Rows and the ask are the briefing's (card-rows.tsx); the cards open in the list preview.
import { useState } from "react";
import { View } from "react-native";

import { ListRow, Section } from "../kit/chrome";
import type { CardSide } from "../pool/list-preview";
import { CardThumb } from "./card-thumb";
import { SpoilerAsk, useCardFacts } from "./card-rows";
import { campaignSides, type CampaignCardEntry } from "./scenario-sides";

export function CampaignCards({ entries, onOpen }: { entries: readonly CampaignCardEntry[]; onOpen: (sides: readonly CardSide[]) => void }) {
  const [warning, setWarning] = useState(false);
  const first = entries[0];
  const firstRow = useCardFacts(first?.code);
  if (!first || !firstRow) return null;
  const later = entries.length > 1;
  return (
    <View testID="setup-campaign-cards" className="mt-5">
      <Section title="Campaign cards" />
      <ListRow
        testID="setup-campaign-first"
        label={firstRow.name}
        detail={`${first.scenario} · Setup and Resolution`}
        leading={<CardThumb code={first.code} imagesrc={firstRow.imagesrc} />}
        onPress={() => onOpen(campaignSides([first]))}
      />
      {later ? <ListRow testID="setup-campaign-all" label="All campaign cards" detail={`${entries.length} scenarios · spoilers`} onPress={() => setWarning(true)} /> : null}
      {later && warning ? (
        <SpoilerAsk
          testID="setup-campaign-spoiler"
          text="The later campaign cards show what this campaign holds before you meet it. Read them anyway?"
          showLabel="Show all cards"
          onShow={() => {
            setWarning(false);
            onOpen(campaignSides(entries));
          }}
          onCancel={() => setWarning(false)}
        />
      ) : null}
    </View>
  );
}
