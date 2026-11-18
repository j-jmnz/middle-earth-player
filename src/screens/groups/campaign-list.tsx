// The Cards tab's Campaign view (docs/design-system.md, Card groups): each campaign, cycle or box a fold, closed until opened and kept in
// `settings.sections` like the other folds, of its sections as rows ("Boons", "12 cards"). A row opens the section as the Scenario view's set rows
// do: `onOpen` gets its key, and the tab pushes the card-group route or, on a tablet in landscape, fills the pane beside the list.
import { useMemo } from "react";

import { useDatabases } from "../data/databases";
import { type useFolds } from "../kit/fold-section";
import { groupDataOf } from "./cache";
import { cardsWord } from "./card-group";
import { FoldList, type FoldBlock } from "./fold-list";

/** A campaign's fold id; every campaign starts closed. */
export function campaignFoldId(id: string): string {
  return `cards-campaign-${id}`;
}

export function CampaignList({ folds, selected, onOpen }: { folds: ReturnType<typeof useFolds>; selected: string | null; onOpen: (key: string) => void }) {
  const { catalog } = useDatabases();
  const blocks = useMemo(
    (): FoldBlock[] => [
      {
        id: "campaigns",
        folds: groupDataOf(catalog)
          .campaign()
          .campaigns.map((campaign) => ({
            id: campaignFoldId(campaign.id),
            title: campaign.name,
            unit: "section",
            rows: campaign.sections.map((section) => ({ key: section.key, testID: `cards-section-${section.key}`, label: section.title, detail: cardsWord(section.count) })),
          })),
      },
    ],
    [catalog],
  );
  return <FoldList testID="cards-campaigns" noun="campaign" blocks={blocks} folds={folds} selected={selected} onOpen={onOpen} />;
}
