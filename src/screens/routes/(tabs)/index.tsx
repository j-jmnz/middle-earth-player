import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState, type ComponentRef } from "react";
import { ScrollView, View } from "react-native";

import { Eyebrow, PillButton } from "../../chrome";
import { FoldSection, useFolds } from "../../fold-section";
import { heroFace } from "../../hero-tile";
import { deckFaces } from "../../deck-store";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { campaignOf } from "../../campaign-data";
import { listSaves, type ListedSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { usePalette } from "../../palette-hook";
import { NextStop, describe, nextSummary, saveLine, type SaveLine } from "../../save-panels";
import { CatalogGrid, CatalogTile, HubPage, LockedTiles, RunHero, RunRow, type PartyHero } from "../../hub-parts";
import { splitRuns } from "../../hub-runs";
import { nextStepHref, pathHref } from "../../scenario-links";
import { SPHERE_TINT } from "../../../play/icon-map";
import { useUiScale } from "../../../play/ui-scale";
import { useSizeClass } from "../../../play/use-size-class";

// The fellowship a playthrough plays: the heroes the campaign log records, else the heroes the last loadout dealt.
function partyCodes(save: ListedSave): string[] {
  const logged = save.log.heroesBySeat.flat();
  if (logged.length > 0) return logged;
  return save.loadout?.seats.flatMap((seat) => seat.heroes) ?? [];
}

// The Campaigns hub (docs/design-system.md, Campaigns (campaign list)): the unfinished playthrough written last as the hero over its
// next scenario's scene, the other unfinished ones as rows, New playthrough (one tile per startable campaign), then Coming later.
export default function CampaignList() {
  const palette = usePalette();
  const s = useUiScale();
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
  const locked = lockedTiles(campaigns);
  const nameOf = (id: string) => campaigns.find((campaign) => campaign.id === id)?.name ?? id;
  // Each save's progress line reads its own campaign.
  const lineOf = (save: ListedSave): SaveLine => saveLine(save, nameOf(save.campaignId));
  const { hero, others } = splitRuns(saves, (save) => lineOf(save).next.kind !== "finished");
  const faces = deckFaces(catalog, saves.flatMap(partyCodes));
  // The fellowship as the hero words show it, seat by seat: each hero's painting, name and sphere.
  const fellowshipOf = (save: ListedSave) => {
    const seats = save.log.heroesBySeat.flat().length > 0 ? save.log.heroesBySeat : (save.loadout?.seats.map((seat) => seat.heroes) ?? []);
    return seats.map((seat) => seat.map((code) => heroFace(faces, code)));
  };
  const leadOf = (save: ListedSave): PartyHero | null => {
    const code = partyCodes(save)[0];
    const face = code ? faces.get(code) : undefined;
    if (!code || !face) return null;
    const tint = SPHERE_TINT[face.sphereCode ?? ""];
    return { card: { code, imagesrc: face.imagesrc }, name: face.name, tint: tint && tint !== "faint" ? palette[tint] : undefined };
  };

  function scrollToNew(): void {
    scroll.current?.scrollTo({ y: Math.max(0, startAt.current - 8), animated: true });
  }

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
    }, [user, startParam]),
  );

  function openPath(save: { id: string }): void {
    router.push(pathHref(save.id));
  }

  const heroLine = hero ? lineOf(hero) : null;
  const heroBlock =
    hero && heroLine ? (
      // Under its words the hero holds the screen's one primary (Begin or Resume).
      <View testID="current-playthrough" style={{ gap: 18 * s }}>
        <RunHero overline={`In progress · ${heroLine.seats}`} title={heroLine.name} seats={fellowshipOf(hero)} testID="continue-campaign" />
        <NextStop
          id={hero.id}
          line={heroLine}
          onNext={() => router.push(nextStepHref(hero.id, heroLine.next))}
          onPath={() => openPath(hero)}
          onLog={() => router.push({ pathname: "/log/[saveId]", params: { saveId: hero.id } })}
        />
      </View>
    ) : null;

  const grid = size === "medium";
  const othersBlock =
    others.length > 0 ? (
      <View testID="other-journeys" style={{ gap: 10 * s }}>
        <Eyebrow>Other journeys</Eyebrow>
        <View className={grid ? "flex-row flex-wrap" : undefined} style={grid ? { rowGap: 8 * s, marginHorizontal: -4 * s } : { gap: 8 * s }}>
          {others.map((save) => {
            const line = lineOf(save);
            return (
              <View key={save.id} style={grid ? { width: "50%", paddingHorizontal: 4 * s } : undefined}>
                <RunRow
                  testID={`save-${save.id}`}
                  title={line.name}
                  line={`${line.seats} · ${nextSummary(line.next)}`}
                  lead={leadOf(save)}
                  accessibilityLabel={`Open ${describe(line)}`}
                  onPress={() => openPath(save)}
                />
              </View>
            );
          })}
        </View>
      </View>
    ) : null;

  // Every campaign the catalog marks playable starts from its tile: the setup screen takes the seats and the carry-over.
  const startable = campaigns.flatMap((row) => {
    const data = row.playable ? campaignOf(row.id) : null;
    return data ? [{ id: row.id, name: row.name, data }] : [];
  });
  const posters = size === "compact" ? 0 : 3;
  const newBlock =
    startable.length > 0 ? (
      <View
        testID="new-playthrough-tiles"
        style={{ gap: 10 * s }}
        onLayout={(event) => {
          startAt.current = event.nativeEvent.layout.y;
          if (scrollPending.current) {
            scrollPending.current = false;
            scrollToNew();
          }
        }}
      >
        <Eyebrow>New playthrough</Eyebrow>
        <CatalogGrid posters={posters}>
          {startable.map(({ id, name, data }) => {
            const count = data.scenarios.length;
            const words = `${count} ${count === 1 ? "scenario" : "scenarios"}`;
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
      actions={<PillButton label="History" testID="history-open" accessibilityLabel="History of finished scenarios" onPress={() => router.push({ pathname: "/history", params: { kind: "campaign" } })} />}
      subtitle="Play a box's scenarios in order, with its log, boons and burdens."
      hero={heroBlock}
      sceneId={heroLine?.next.kind === "finished" || !heroLine ? null : heroLine.next.node.id}
      others={othersBlock}
      catalog={newBlock}
      coming={coming}
      scrollRef={scroll}
    />
  );
}
