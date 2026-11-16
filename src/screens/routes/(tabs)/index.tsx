import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState, type ComponentRef } from "react";
import { ScrollView, View } from "react-native";

import { PillButton } from "../../kit/chrome";
import { FoldSection, useFolds } from "../../kit/fold-section";
import { heroFace } from "../../art/hero-tile";
import { deckFaces } from "../../deck/store";
import { campaignListQueries, lockedCampaignTiles, scenarioWords, startableRows } from "../../campaign/list";
import { campaignOf } from "../../data/campaign-data";
import { listSaves, type ListedSave } from "../../data/campaign-store";
import { useDatabases } from "../../data/databases";
import { usePalette } from "../../kit/palette-hook";
import { describe, nextSummary, partyCodes, partySeats, saveLine, type SaveLine } from "../../history/save-line";
import { NextStop } from "../../campaign/save-panels";
import { CatalogGrid, CatalogTile, HubPage, LockedTiles, OtherRuns, RunHero, RunRow } from "../../campaign/hub-parts";
import { splitRuns } from "../../campaign/hub-runs";
import { nextStepHref, pathHref } from "../../campaign/scenario-links";
import { useSizeClass } from "../../../ui/use-size-class";

// The Campaigns hub (docs/design-system.md, Campaigns (campaign list)): the unfinished playthrough written last as the hero over its
// next scenario's scene, the other unfinished ones as rows, New playthrough (one tile per startable campaign), then Coming later.
export default function CampaignList() {
  const palette = usePalette();
  const { size } = useSizeClass();
  const router = useRouter();
  // `start=1`: a finished campaign's path sends the player here to start another, so the list scrolls to New playthrough.
  const { start: startParam } = useLocalSearchParams<{ start?: string }>();
  const { catalog, user } = useDatabases();
  const [saves, setSaves] = useState<ListedSave[]>([]);
  const folds = useFolds();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const startAt = useRef(0);
  const scrollPending = useRef(false);
  const campaigns = campaignListQueries(catalog).campaigns.all();
  // A cycle (scenarios that are part of no campaign) waits only on the Scenarios tab.
  const locked = lockedCampaignTiles(campaigns);
  const nameOf = (id: string) => campaigns.find((campaign) => campaign.id === id)?.name ?? id;
  // Each save's progress line reads its own campaign.
  const lineOf = (save: ListedSave): SaveLine => saveLine(save, nameOf(save.campaignId));
  const { hero, others } = splitRuns(saves, (save) => lineOf(save).next.kind !== "finished");
  const faces = deckFaces(catalog, saves.flatMap(partyCodes));
  // The fellowship as the hero words show it, seat by seat: each hero's painting, name and sphere.
  const fellowshipOf = (save: ListedSave) => partySeats(save).map((seat) => seat.map((code) => heroFace(faces, code)));

  // Scrolls New playthrough into view once, then spends the param so coming back to Campaigns does not scroll again.
  const scrollToNew = useCallback(() => {
    scrollPending.current = false;
    scroll.current?.scrollTo({ y: Math.max(0, startAt.current), animated: true });
    router.setParams({ start: undefined });
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setSaves(listSaves(user));
      if (startParam === "1") {
        scrollPending.current = true;
        if (startAt.current > 0) scrollToNew();
      }
      return () => {
        scrollPending.current = false;
      };
    }, [user, startParam, scrollToNew]),
  );

  function openPath(save: { id: string }): void {
    router.push(pathHref(save.id));
  }

  const heroLine = hero ? lineOf(hero) : null;
  const heroBlock = hero && heroLine ? <RunHero title={heroLine.name} seats={fellowshipOf(hero)} testID="continue-campaign" /> : null;
  // Under its words the hero holds the screen's one primary, Resume.
  const heroAction =
    hero && heroLine ? (
      <NextStop
        id={hero.id}
        line={heroLine}
        onNext={() => router.push(nextStepHref(hero.id, heroLine.next))}
        onPath={() => openPath(hero)}
        onLog={() => router.push({ pathname: "/log/[saveId]", params: { saveId: hero.id } })}
      />
    ) : null;

  const othersBlock =
    others.length > 0 ? (
      <OtherRuns testID="other-journeys" title="Other journeys" fold={{ id: "other-journeys", folded: folds.folded("other-journeys", false), onFold: (next) => folds.setFolded("other-journeys", next, false) }}>
        {others.map((save) => {
          const line = lineOf(save);
          return (
            <RunRow
              key={save.id}
              testID={`save-${save.id}`}
              title={line.name}
              line={`${line.seats} · ${nextSummary(line.next)}`}
              heroes={fellowshipOf(save)[0] ?? []}
              accessibilityLabel={describe(line)}
              accessibilityHint="Opens the campaign"
              onPress={() => openPath(save)}
            />
          );
        })}
      </OtherRuns>
    ) : null;

  // Every campaign the catalog marks playable starts from its tile: the setup screen takes the seats and the carry-over. A cycle
  // (Shadows of Mirkwood) has no Campaign Mode and is played from the Scenarios tab, so it never offers a new playthrough.
  const startable = startableRows(campaigns).flatMap((row) => {
    const data = campaignOf(row.id);
    return data ? [{ id: row.id, name: row.name, data }] : [];
  });
  const posters = size === "compact" ? 0 : 3;
  const newBlock =
    startable.length > 0 ? (
      <View testID="new-playthrough-tiles">
        <FoldSection id="new-playthrough" title="New playthrough" count={startable.length} unit="campaign" folded={folds.folded("new-playthrough", false)} onFold={(next) => folds.setFolded("new-playthrough", next, false)}>
          <CatalogGrid posters={posters}>
          {startable.map(({ id, name, data }) => {
            const words = scenarioWords(data.scenarios.length);
            return (
              <CatalogTile
                key={id}
                testID={`new-${id}`}
                sceneId={data.scenarios[0]}
                name={name}
                line={words}
                tone={palette.muted}
                accessibilityLabel={`New playthrough of ${name}, ${words}`}
                posters={posters}
                onPress={() => router.push({ pathname: "/campaign/[campaignId]", params: { campaignId: id } })}
              />
            );
          })}
          </CatalogGrid>
        </FoldSection>
      </View>
    ) : null;

  const coming =
    locked.length > 0 ? (
      <FoldSection id="coming" title="Coming later" count={locked.length} unit="campaign" folded={folds.folded("coming", false)} onFold={(next) => folds.setFolded("coming", next, false)}>
        <LockedTiles tiles={locked} testID="locked-campaigns" />
      </FoldSection>
    ) : null;

  return (
    <HubPage
      testID="campaign-list"
      title="Campaigns"
      actions={<PillButton label="History" testID="history-open" accessibilityLabel="History: playthroughs in progress, finished and archived" onPress={() => router.push({ pathname: "/history", params: { kind: "campaign" } })} />}
      hero={heroBlock}
      heroAction={heroAction}
      heroTestID="current-playthrough"
      sceneId={heroLine?.next.kind === "finished" || !heroLine ? null : heroLine.next.node.id}
      others={othersBlock}
      catalog={newBlock}
      coming={coming}
      scrollRef={scroll}
      onCatalogLayout={(y) => {
        startAt.current = y;
        if (scrollPending.current) scrollToNew();
      }}
    />
  );
}
