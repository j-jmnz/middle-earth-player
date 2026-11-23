import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useDeferredValue, useState } from "react";
import { View } from "react-native";

import { isPlayable } from "../../../campaign/playable";
import { isOpenStatus, standaloneStatus, type ListedStandalone } from "../../../campaign/standalone";
import { BOXES, boxOf, scenarioName, scenarioOf } from "../../data/campaign-data";
import { campaignListQueries } from "../../campaign/list";
import { BodyText, PillButton, PrimaryButton, SearchField, TextButton } from "../../kit/chrome";
import { deckFaces } from "../../deck/store";
import { useDatabases } from "../../data/databases";
import { keepSame } from "../../data/keep-same";
import { FoldHeader, useFolds } from "../../kit/fold-section";
import { foldAllOffer } from "../../kit/fold-state";
import { heroFace } from "../../art/hero-tile";
import { CatalogTile, LockedTiles, OtherRuns, PrimaryPlate, RunHero, RunRow } from "../../campaign/hub-parts";
import { boxFoldId, hubItems, searchHub, type HubEntry, type HubItem } from "../../campaign/hub-items";
import { HubListPage } from "../../campaign/hub-page";
import { comingLater, splitRuns } from "../../campaign/hub-runs";
import { usePalette } from "../../kit/palette-hook";
import { seatWord } from "../../data/seats";
import { gameCaption, statusWord } from "../../history/standalone-words";
import { listStandalone } from "../../data/standalone-store";
import { STALE_STEP } from "../../session/stale-words";
import { useUiScale } from "../../../ui/ui-scale";
import { useSizeClass } from "../../../ui/use-size-class";

// Standalone play (mec109.campaign-mode: "players can still play the scenarios as standalone adventures"). The Scenarios hub
// (docs/design-system.md, Scenarios): the game in progress dealt last as the hero over its scenario's scene, the
// other games in progress as rows, the search of the catalog, one fold per box holding the scenarios it can deal, then Coming later; the boxes and Coming later
// are the items of one FlashList under the head (HubListPage). Finished and archived games
// are in History. Reads the scenario files, user.db and the campaigns and heroes the catalog names.
export default function Scenarios() {
  const palette = usePalette();
  const s = useUiScale();
  const { size } = useSizeClass();
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const [games, setGames] = useState<ListedStandalone[]>([]);
  const folds = useFolds();
  const fold = (id: string, defaultFolded = false) => ({ folded: folds.folded(id, defaultFolded), onFold: (next: boolean) => folds.setFolded(id, next, defaultFolded) });
  // The field shows each keystroke at once; the list catches up when React has time.
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);

  useFocusEffect(
    useCallback(() => {
      const listed = listStandalone(user);
      setGames((held) => keepSame(held, listed));
    }, [user]),
  );

  function brief(scenarioId: string): void {
    router.push({ pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId } });
  }

  function resume(game: ListedStandalone): void {
    router.push({ pathname: "/standalone/table/[gameId]", params: { gameId: game.id } });
  }

  const { hero, others } = splitRuns(games, (game) => isOpenStatus(standaloneStatus(game)));
  const seatsOf = (game: ListedStandalone) => game.loadout?.seats.map((seat) => seat.heroes) ?? [];
  const faces = deckFaces(catalog, [hero, ...others].flatMap((game) => (game ? seatsOf(game).flat() : [])));
  const spoken = (game: ListedStandalone) => `${scenarioName(game.scenarioId)}, ${gameCaption(game)}`;

  const heroBlock = hero ? (
    <RunHero
      title={scenarioName(hero.scenarioId)}
      detail={detailOf(hero)}
      seats={seatsOf(hero).map((seat) => seat.map((code) => heroFace(faces, code)))}
      testID="continue-game"
    />
  ) : null;
  // Under its words the hero holds the screen's one primary, Resume.
  const heroAction = hero ? (
    <PrimaryPlate>
      <PrimaryButton label="Resume" testID={`resume-${hero.id}`} accessibilityLabel={`Resume ${spoken(hero)}`} onPress={() => resume(hero)} />
    </PrimaryPlate>
  ) : null;

  const othersBlock =
    others.length > 0 ? (
      <OtherRuns testID="other-games" title="Other games" fold={{ id: "other-games", ...fold("other-games") }}>
        {others.map((game) => (
          <RunRow
            key={game.id}
            testID={`other-game-${game.id}`}
            title={scenarioName(game.scenarioId)}
            line={[seatWord(game.seatCount), game.loadout?.difficulty, standaloneStatus(game) === "needsChoice" ? STALE_STEP : "On the table"].filter((part) => part != null).join(" · ")}
            heroes={(seatsOf(game)[0] ?? []).map((code) => heroFace(faces, code))}
            accessibilityLabel={`Resume ${spoken(game)}`}
            onPress={() => resume(game)}
          />
        ))}
      </OtherRuns>
    ) : null;

  // How a scenario stands, from its latest game: won with its score, in progress, or its quest stages.
  const standing = (id: string): { line: string; tone: string } => {
    const game = games.find((entry) => entry.scenarioId === id);
    const state = game ? standaloneStatus(game) : null;
    if (game && state === "won") return { line: statusWord(game), tone: palette.ok };
    if (state === "playing") return { line: "In progress", tone: palette.accentHigh };
    if (state === "needsChoice") return { line: "Needs a choice", tone: palette.accentHigh };
    const stages = scenarioOf(id)?.stages.length ?? 0;
    return { line: stages > 0 ? `${stages} quest ${stages === 1 ? "stage" : "stages"}` : "", tone: palette.faint };
  };
  // A tablet shows each box as poster tiles: six across in landscape, four in portrait. A phone lists them as 64 pt rows.
  const posters = size === "expanded" ? 6 : size === "medium" ? 4 : 0;
  const boxes = BOXES.flatMap((box) => {
    const playable = box.scenarios.flatMap((id, index) => (isPlayable(id) ? [{ id, number: index + 1 }] : []));
    return playable.length > 0 ? [{ box, playable }] : [];
  });
  // Coming later: the scenarios no box can deal yet and the locked campaigns and cycles, in the campaigns table's order (no card is read for them).
  const waiting = comingLater(BOXES, campaignListQueries(catalog).campaigns.all(), isPlayable, scenarioName);
  // What the search keeps of them. While it narrows the list every fold is open, and a tap on a fold header changes no stored fold.
  const found = searchHub(boxes, waiting, query, scenarioName);
  const listFold = (id: string) => (found.searching ? { folded: false, onFold: () => undefined } : fold(id));
  // The catalog is the list's items (hub-items.ts): a folded box mounts its header alone.
  const items = hubItems({ boxes: found.boxes, waiting: found.waiting.length, posters, folded: (id) => folds.folded(id, false), searching: found.searching });
  // The scenarios list's folds, each box and Coming later: Collapse all folds every one while any is open, else Expand all opens them.
  const listFolds = [...boxes.map(({ box }) => ({ id: boxFoldId(box.id), defaultFolded: false })), ...(waiting.length > 0 ? [{ id: "scenarios-coming", defaultFolded: false }] : [])];
  const offer = foldAllOffer(listFolds.map(({ id, defaultFolded }) => folds.folded(id, defaultFolded)));

  const tile = ({ id, number }: HubEntry) => {
    const { line, tone } = standing(id);
    return (
      <CatalogTile key={id} testID={`standalone-${id}`} sceneId={id} number={number} name={scenarioName(id)} line={line} tone={tone} accessibilityLabel={[`Scenario ${number}`, scenarioName(id), line].filter(Boolean).join(", ")} accessibilityHint="Opens its briefing" posters={posters} listed onPress={() => brief(id)} />
    );
  };
  // Each item's space above it: 18 between sections, 8 between a phone's rows and 12 between posters. The search is the list's first
  // item (`lead`), which HubListPage sets under the hero or the other runs.
  const section = { paddingTop: 18 * s };
  const renderItem = (item: HubItem, lead: boolean) => {
    switch (item.type) {
      case "search":
        return (
          <View className="flex-row" style={lead ? undefined : section}>
            <SearchField testID="scenarios-search" value={search} onChangeText={setSearch} placeholder="Search scenario or box" accessibilityLabel="Search scenarios" accessibilityHint="Searches scenario and box names" />
          </View>
        );
      case "empty":
        return (
          <BodyText testID="scenarios-empty" tone="muted" className="mt-6">
            No scenario matches.
          </BodyText>
        );
      case "fold-all":
        return (
          <View className="-mx-3 flex-row justify-end" style={section}>
            <TextButton
              label={offer.label}
              tone="accent"
              small
              testID="scenarios-fold-all"
              accessibilityHint={offer.folds ? "Folds every box and Coming later" : "Opens every box and Coming later"}
              onPress={() => folds.setAll(listFolds, offer.folds)}
            />
          </View>
        );
      case "box":
        return (
          <View testID={item.id} style={section}>
            <FoldHeader id={item.id} title={item.name} count={item.count} unit="scenario" {...listFold(item.id)} />
          </View>
        );
      case "tiles": {
        const gap = item.first ? undefined : { paddingTop: (posters ? 12 : 8) * s };
        return posters ? (
          <View className="flex-row" style={{ ...gap, marginHorizontal: -6 * s }}>
            {item.entries.map(tile)}
          </View>
        ) : (
          <View style={gap}>{item.entries.map(tile)}</View>
        );
      }
      case "coming":
        return (
          <View style={section}>
            <FoldHeader id="scenarios-coming" title="Coming later" count={item.count} {...listFold("scenarios-coming")} />
          </View>
        );
      case "locked":
        return <LockedTiles tiles={found.waiting} testID="locked-scenarios" />;
    }
  };

  return (
    <HubListPage
      testID="scenarios"
      listTestID="standalone-scenarios"
      title="Scenarios"
      actions={<PillButton label="History" testID="history-open" accessibilityLabel="History: games in progress, finished and archived" onPress={() => router.push({ pathname: "/history", params: { kind: "standalone" } })} />}
      hero={heroBlock}
      heroAction={heroAction}
      heroTestID="current-game"
      sceneId={hero?.scenarioId}
      others={othersBlock}
      items={items}
      renderItem={renderItem}
    />
  );
}

// "Revised Core Set · Scenario 2 · Normal": the hero's box, the scenario's place in its book and the difficulty it was dealt on.
function detailOf(game: ListedStandalone): string {
  const box = boxOf(game.scenarioId);
  const parts = [standaloneStatus(game) === "needsChoice" ? STALE_STEP : undefined, box?.name, box ? `Scenario ${box.scenarios.indexOf(game.scenarioId) + 1}` : undefined, game.loadout?.difficulty];
  return parts.filter((part): part is string => part != null).join(" · ");
}
