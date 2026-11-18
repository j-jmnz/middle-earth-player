// The scenario's own cards on the briefing, where the decks are picked and Deal waits (user request, 2026-11-01): the campaign card (its
// Setup side, rr.campaign-cards) and the quest cards. Each row opens the cards large in the list preview. Stage 1 opens at once; the later
// stages hold spoilers, so their row asks first, in place, before it shows every stage. Under them, one row per encounter set opens that set on the
// card-group route (its own spoiler ask included).
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { groupDataOf } from "../groups/cache";
import { cardsWord } from "../groups/card-group";
import { setKeyFor } from "../groups/scenario-sets";
import { ListRow, Section } from "../kit/chrome";
import { useDatabases } from "../data/databases";
import type { CardSide } from "../pool/list-preview";
import { CardThumb } from "./card-thumb";
import { SpoilerAsk, useCardFacts } from "./card-rows";
import { questSides } from "./scenario-sides";

/** The encounter sets the briefing lists, with the counts it shows, and the codes the scenario deals (what picks the set of a name held by several packs). */
export type EncounterSets = { sets: readonly { name: string; count: number }[]; codes: ReadonlySet<string> };

export function ScenarioCards({ campaignCard, stages, encounter, onOpen }: { campaignCard?: string; stages: readonly string[]; encounter?: EncounterSets; onOpen: (sides: readonly CardSide[]) => void }) {
  const router = useRouter();
  const { catalog } = useDatabases();
  // The spoiler warning under All quest cards, until the player shows them or says not now.
  const [warning, setWarning] = useState(false);
  const campaign = useCardFacts(campaignCard);
  const first = stages[0];
  const firstRow = useCardFacts(first);
  const later = stages.length > 1;
  // The set's route asks about spoilers itself; the tree is read on the tap, not while the briefing opens.
  const openSet = (name: string) => {
    const key = encounter ? setKeyFor(groupDataOf(catalog).scenario(), name, encounter.codes) : null;
    if (key) router.push({ pathname: "/card-group/[kind]/[id]", params: { kind: "set", id: key } });
  };
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
            <SpoilerAsk
              testID="briefing-quest-spoiler"
              text="The later quest cards show what this scenario holds before you meet it. Read them anyway?"
              showLabel="Show all stages"
              onShow={() => {
                setWarning(false);
                onOpen(questSides(stages));
              }}
              onCancel={() => setWarning(false)}
            />
          ) : null}
        </View>
      ) : null}
      {encounter && encounter.sets.length > 0 ? (
        <View testID="briefing-encounter-sets" className="mt-5">
          <Section title="Encounter sets" />
          {encounter.sets.map((set) => (
            <ListRow key={set.name} testID={`briefing-set-${set.name}`} label={set.name} detail={cardsWord(set.count)} onPress={() => openSet(set.name)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
