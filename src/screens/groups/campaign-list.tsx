// The Cards tab's Campaign view (docs/design-system.md, Card groups): each campaign, cycle or box a fold, closed until opened and kept in
// `settings.sections` like the other folds, of its sections as rows ("Boons", "12 cards"). A row opens the section as the Scenario view's set rows
// do: `onOpen` gets its key, and the tab pushes the card-group route or, on a tablet in landscape, fills the pane beside the list.
import { useMemo } from "react";
import { View } from "react-native";

import { useUiScale } from "../../ui/ui-scale";
import { useDatabases } from "../data/databases";
import { FoldSection, type useFolds } from "../kit/fold-section";
import { ListRow, ScreenScroll } from "../kit/chrome";
import { groupDataOf } from "./cache";
import { cardsWord } from "./card-group";
import { FoldAllBar } from "./fold-all-bar";

/** A campaign's fold id; every campaign starts closed. */
export function campaignFoldId(id: string): string {
  return `cards-campaign-${id}`;
}

export function CampaignList({ folds, selected, onOpen }: { folds: ReturnType<typeof useFolds>; selected: string | null; onOpen: (key: string) => void }) {
  const { catalog } = useDatabases();
  const s = useUiScale();
  const tree = useMemo(() => groupDataOf(catalog).campaign(), [catalog]);
  const ids = useMemo(() => tree.campaigns.map((campaign) => ({ id: campaignFoldId(campaign.id), defaultFolded: true })), [tree]);
  return (
    <ScreenScroll testID="cards-campaigns" top={4}>
      <FoldAllBar folds={folds} ids={ids} noun="campaign" />
      <View style={{ gap: 6 * s }}>
        {tree.campaigns.map((campaign) => {
          const id = campaignFoldId(campaign.id);
          const folded = folds.folded(id, true);
          return (
            <FoldSection key={campaign.id} id={id} title={campaign.name} count={campaign.sections.length} unit="section" folded={folded} onFold={(next) => folds.setFolded(id, next, true)}>
              {folded
                ? null
                : campaign.sections.map((section) => (
                    <ListRow key={section.key} testID={`cards-section-${section.key}`} label={section.title} detail={cardsWord(section.count)} selected={selected == null ? undefined : selected === section.key} onPress={() => onOpen(section.key)} />
                  ))}
            </FoldSection>
          );
        })}
      </View>
    </ScreenScroll>
  );
}
