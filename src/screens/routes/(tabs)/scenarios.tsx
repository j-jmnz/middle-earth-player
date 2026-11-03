import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { isPlayable } from "../../../campaign/playable";
import { standaloneStatus, type ListedStandalone } from "../../../campaign/standalone";
import { BOXES, boxOf, scenarioName, scenarioOf } from "../../campaign-data";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { PillButton, PrimaryButton } from "../../chrome";
import { deckFaces } from "../../deck-store";
import { useDatabases } from "../../databases";
import { FoldSection, useFolds } from "../../fold-section";
import { heroFace } from "../../hero-tile";
import { CatalogGrid, CatalogTile, HubPage, LockedTiles, OtherRuns, PrimaryPlate, RunHero, RunRow } from "../../hub-parts";
import { comingScenarios, splitRuns } from "../../hub-runs";
import { usePalette } from "../../palette-hook";
import { seatWord } from "../../seats";
import { gameCaption, statusWord } from "../../standalone-words";
import { listStandaloneFresh } from "../../standalone-store";
import { useUiScale } from "../../../ui/ui-scale";
import { useSizeClass } from "../../../ui/use-size-class";

// Standalone play (mec109.campaign-mode: "players can still play the scenarios as standalone adventures"). The Scenarios hub
// (docs/design-system.md, Scenarios): the game in progress dealt last as the hero over its scenario's scene, the
// other games in progress as rows, one fold per box holding the scenarios it can deal, then Coming later. Finished and archived games
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

  useFocusEffect(
    useCallback(() => {
      setGames(listStandaloneFresh(user));
    }, [user]),
  );

  function brief(scenarioId: string): void {
    router.push({ pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId } });
  }

  function resume(game: ListedStandalone): void {
    router.push({ pathname: "/standalone/table/[gameId]", params: { gameId: game.id } });
  }

  const { hero, others } = splitRuns(games, (game) => standaloneStatus(game) === "playing");
  const seatsOf = (game: ListedStandalone) => game.loadout?.seats.map((seat) => seat.heroes) ?? [];
  const faces = deckFaces(catalog, [hero, ...others].flatMap((game) => (game ? seatsOf(game).flat() : [])));
  const spoken = (game: ListedStandalone) => `${scenarioName(game.scenarioId)}, ${gameCaption(game)}`;

  const heroBlock = hero ? (
    <RunHero
      overline={`In progress · ${seatWord(hero.seatCount)}`}
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
            line={[seatWord(game.seatCount), game.loadout?.difficulty, "On the table"].filter((part) => part != null).join(" · ")}
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
    const stages = scenarioOf(id)?.stages.length ?? 0;
    return { line: stages > 0 ? `${stages} quest ${stages === 1 ? "stage" : "stages"}` : "", tone: palette.faint };
  };
  // A tablet shows each box as poster tiles: six across in landscape, four in portrait. A phone lists them as 64 pt rows.
  const posters = size === "expanded" ? 6 : size === "medium" ? 4 : 0;
  const boxes = BOXES.flatMap((box) => {
    const playable = box.scenarios.flatMap((id, index) => (isPlayable(id) ? [{ id, number: index + 1 }] : []));
    return playable.length > 0 ? [{ box, playable }] : [];
  });
  const catalogBlock = (
    <View testID="standalone-scenarios" style={{ gap: 18 * s }}>
      {boxes.map(({ box, playable }) => (
        <View key={box.id} testID={`box-${box.id}`}>
          <FoldSection id={`box-${box.id}`} title={box.name} count={playable.length} unit="scenario" {...fold(`box-${box.id}`)}>
            <CatalogGrid posters={posters}>
              {playable.map(({ id, number }) => {
                const { line, tone } = standing(id);
                return (
                  <CatalogTile key={id} testID={`standalone-${id}`} sceneId={id} number={number} name={scenarioName(id)} line={line} tone={tone} accessibilityLabel={`Play ${scenarioName(id)}`} posters={posters} onPress={() => brief(id)} />
                );
              })}
            </CatalogGrid>
          </FoldSection>
        </View>
      ))}
    </View>
  );

  // The scenarios no box can deal yet, then the boxes that are locked (the campaigns table only; no card is read for them).
  const waiting = [...comingScenarios(BOXES, isPlayable, scenarioName), ...lockedTiles(campaignListQueries(catalog).campaigns.all())];
  const coming =
    waiting.length > 0 ? (
      <FoldSection id="scenarios-coming" title="Coming later" count={waiting.length} {...fold("scenarios-coming")}>
        <LockedTiles tiles={waiting} testID="locked-scenarios" />
      </FoldSection>
    ) : null;

  return (
    <HubPage
      testID="scenarios"
      title="Scenarios"
      actions={<PillButton label="History" testID="history-open" accessibilityLabel="History: games in progress, finished and archived" onPress={() => router.push({ pathname: "/history", params: { kind: "standalone" } })} />}
      subtitle="Standalone adventures. No campaign log, boons or burdens."
      hero={heroBlock}
      heroAction={heroAction}
      heroTestID="current-game"
      sceneId={hero?.scenarioId}
      others={othersBlock}
      catalog={catalogBlock}
      coming={coming}
    />
  );
}

// "Revised Core Set · Scenario 2 · Normal": the hero's box, the scenario's place in its book and the difficulty it was dealt on.
function detailOf(game: ListedStandalone): string {
  const box = boxOf(game.scenarioId);
  const parts = [box?.name, box ? `Scenario ${box.scenarios.indexOf(game.scenarioId) + 1}` : undefined, game.loadout?.difficulty];
  return parts.filter((part): part is string => part != null).join(" · ");
}
