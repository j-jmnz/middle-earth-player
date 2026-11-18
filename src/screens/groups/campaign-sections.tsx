// A campaign's sections (campaign cards, Boons, Burdens, Treasures, Other cards) as rows that open their card group: under Campaign on the
// campaign setup and on the campaign's cards screen (docs/design-system.md, Campaign setup). The catalog's campaign tree is read after the
// first paint, so the rows come a frame after the screen.
import { useRouter } from "expo-router";
import { useDeferredValue, useMemo } from "react";

import { useDatabases } from "../data/databases";
import { ListRow, Section } from "../kit/chrome";
import { groupDataOf } from "./cache";
import { cardsWord } from "./card-group";

export function CampaignSections({ campaignId, testIDPrefix, from, suffix }: { campaignId: string; testIDPrefix: string; from: string; /** Words after each count (" · spoilers"). */ suffix?: string }) {
  const router = useRouter();
  const { catalog } = useDatabases();
  const ready = useDeferredValue(true, false);
  const sections = useMemo(() => (ready ? (groupDataOf(catalog).campaign().byId.get(campaignId)?.sections ?? []) : []), [ready, catalog, campaignId]);
  if (sections.length === 0) return null;
  return (
    <>
      <Section title="Campaign" className="mt-4" />
      {sections.map((section) => (
        <ListRow
          key={section.key}
          testID={`${testIDPrefix}-${section.key}`}
          label={section.title}
          detail={`${cardsWord(section.count)}${suffix ?? ""}`}
          onPress={() => router.push({ pathname: "/card-group/[kind]/[id]", params: { kind: "campaign", id: section.key, from } })}
        />
      ))}
    </>
  );
}
