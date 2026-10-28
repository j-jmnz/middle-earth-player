// Standalone play (mec109.campaign-mode: "players can still play the scenarios as standalone adventures"). The box's
// scenarios in book order, each dealt on its own with no campaign card, log, boons or burdens; then the games: resume one
// in progress, play a finished one again, archive a game out of the list and restore it, or delete it after a second
// confirm. Reads the scenario files and user.db only; it does not scan `cards`.
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { isPlayable } from "../../../campaign/playable";
import { droppedIfStale, standaloneStatus, type StandaloneGame } from "../../../campaign/standalone";
import { CATALOG_VERSION } from "../../../catalog/version";
import { BOXES, scenarioName } from "../../campaign-data";
import { BodyText, Column, Chevron, Chip, Eyebrow, Label, Panel, Screen, ScreenScroll, ScreenTitle, Section, TextButton } from "../../chrome";
import { FoldSection, useFolds } from "../../fold-section";
import { SceneArt, SceneCard } from "../../art";
import { usePalette } from "../../palette-hook";
import { goldPlate, panelSurface, raisedEdgeOf, tileSurface } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { withAlphaHex } from "../../../play/tokens";
import { useDatabases } from "../../databases";
import { KeepOrDelete } from "../../keep-or-delete";
import { gameCaption, statusWord, STANDALONE_DROPPED } from "../../standalone-words";
import { seatWord } from "../../seats";
import { archiveStandalone, deleteStandalone, listArchivedStandalone, listStandalone, restoreStandalone, writeStandalone } from "../../standalone-store";
import { useSplitColumns } from "../../use-split-columns";
import { useUiScale } from "../../../play/ui-scale";

// The right column of the two-column Scenarios (docs/design-system.md, Tablets).
const SIDE_RANGE = { min: 360, max: 440 };

const DELETE_SENTENCE = "Delete this game? It is gone for good. Your decks stay.";

export default function Scenarios() {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const columns = useSplitColumns(SIDE_RANGE);
  const { size } = columns;
  const router = useRouter();
  const { user } = useDatabases();
  const [games, setGames] = useState<StandaloneGame[]>([]);
  const [archived, setArchived] = useState<StandaloneGame[]>([]);
  // Manage shows Archive and Delete on each game instead of opening it. It ends when the list loses focus.
  const [managing, setManaging] = useState(false);
  const folds = useFolds();
  const fold = (id: string, defaultFolded = false) => ({ folded: folds.folded(id, defaultFolded), onFold: (next: boolean) => folds.setFolded(id, next, defaultFolded) });
  // The game whose delete is waiting on Delete for good.
  const [deleting, setDeleting] = useState<string | null>(null);
  const nameOf = scenarioName;

  const refresh = useCallback(() => {
    // A game in progress from another engine version or against other card data is dropped on the read, as a campaign
    // save's open scenario is; the row and its loadout stay.
    for (const game of listStandalone(user)) {
      const dropped = droppedIfStale(game, CATALOG_VERSION);
      if (dropped) writeStandalone(user, dropped);
    }
    const open = listStandalone(user);
    const away = listArchivedStandalone(user);
    setGames(open);
    setArchived(away);
    if (open.length === 0) setManaging(false);
    setDeleting(null);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        setManaging(false);
        setDeleting(null);
      };
    }, [refresh]),
  );

  function brief(scenarioId: string, from?: string): void {
    router.push({ pathname: "/standalone/briefing/[scenarioId]", params: from ? { scenarioId, from } : { scenarioId } });
  }

  function open(game: StandaloneGame): void {
    if (standaloneStatus(game) === "playing") router.push({ pathname: "/standalone/table/[gameId]", params: { gameId: game.id } });
    else if (game.loadout) brief(game.scenarioId, game.id);
  }

  const label = (game: StandaloneGame) => `${nameOf(game.scenarioId)}, ${gameCaption(game)}`;

  // The button a screen reader was on goes away with each of these, so each says what happened.
  function archive(game: StandaloneGame): void {
    archiveStandalone(user, game.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Archived ${label(game)}`);
  }

  function restore(game: StandaloneGame): void {
    restoreStandalone(user, game.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Restored ${label(game)}`);
  }

  function askDelete(id: string): void {
    setDeleting(id);
    AccessibilityInfo.announceForAccessibility(DELETE_SENTENCE);
  }

  function remove(game: StandaloneGame): void {
    deleteStandalone(user, game.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Deleted ${label(game)}`);
  }

  const actions = (game: StandaloneGame, keep: { label: "Archive" | "Restore"; onPress: () => void }) => (
    <KeepOrDelete
      id={game.id}
      described={label(game)}
      sentence={DELETE_SENTENCE}
      keep={keep}
      confirming={deleting === game.id}
      onAskDelete={() => askDelete(game.id)}
      onDelete={() => remove(game)}
      onKeep={() => setDeleting(null)}
    />
  );
  // A game in progress sits above the scenarios, where the campaign list puts its open playthrough; finished games below.
  const playing = games.filter((game) => standaloneStatus(game) === "playing");
  const finished = games.filter((game) => standaloneStatus(game) !== "playing");

  // A game: Resume or Play again, or under Manage, Archive and Delete. A game in progress is a framed card with its scene; a
  // finished one a row with its result.
  function renderGame(game: StandaloneGame, framed = false) {
    const status = standaloneStatus(game);
    if (managing) {
      return (
        <View key={game.id} testID={`game-${game.id}`}>
          <Panel>
            <Text className="font-display text-title text-bone">{nameOf(game.scenarioId)}</Text>
            <Label>{gameCaption(game)}</Label>
            {actions(game, { label: "Archive", onPress: () => archive(game) })}
          </Panel>
        </View>
      );
    }
    const action = status === "playing" ? "Resume" : game.loadout ? "Play again" : null;
    const spoken = action ? `${action} ${label(game)}` : label(game);
    // The latest game in progress is the framed card with the one gold Resume; an older one is a row (below) with Resume in gold text.
    if (status === "playing" && framed) {
      return (
        <Pressable key={game.id} testID={`game-${game.id}`} collapsable={false} accessibilityRole="button" accessibilityLabel={spoken} onPress={() => open(game)}>
          {({ pressed }) => (
            <SceneCard scenarioId={game.scenarioId} sceneHeight={136} pullUp={34} pressed={pressed}>
              <View className="px-4 pb-4">
                <Eyebrow>In progress</Eyebrow>
                <Text className="mt-1 font-display text-title text-bone">{nameOf(game.scenarioId)}</Text>
                <Label>{gameCaption(game)}</Label>
                {/* The look of the primary inside the card; the whole card is the one button. */}
                <View className="mt-3 min-h-14 items-center justify-center rounded-button" style={goldPlate(pressed, t)}>
                  <Text className="font-display-bold uppercase" style={{ fontSize: 15 * s, lineHeight: 20 * s, letterSpacing: 2.4 * s, color: palette.onGold }}>
                    Resume
                  </Text>
                </View>
              </View>
            </SceneCard>
          )}
        </Pressable>
      );
    }
    const tone = status === "won" ? "gold" : status === "lost" ? "danger" : status === "playing" ? "ok" : "faint";
    return (
      <Pressable key={game.id} testID={`game-${game.id}`} collapsable={false} accessibilityRole="button" accessibilityLabel={spoken} disabled={action == null} onPress={() => open(game)}>
        {({ pressed }) => (
          <View className="rounded-card px-4 py-3.5" style={tileSurface(pressed, t)}>
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="font-display text-heading text-bone">{nameOf(game.scenarioId)}</Text>
                <Label>{`${seatWord(game.seatCount)}${game.loadout ? ` · ${game.loadout.difficulty}` : ""}`}</Label>
              </View>
              <Chip label={statusWord(game)} tone={tone} />
            </View>
            {status === "dropped" ? (
              <Label tone="muted" className="mt-2">
                {STANDALONE_DROPPED}
              </Label>
            ) : null}
            {action ? <Text className="mt-2 font-display-bold text-label text-gold">{action}</Text> : null}
          </View>
        )}
      </Pressable>
    );
  }
  // Expanded: the boxes on the left, the games on the right (docs/design-system.md, Tablets); otherwise one column, as on a phone.
  const split = size === "expanded" ? columns.side : null;
  const twoColumns = split != null;
  const playingBlock = playing.length > 0 ? (
    <View className={twoColumns ? "gap-3" : "mt-5 gap-3"} testID="standalone-playing">
      {playing.map((game, index) => renderGame(game, index === 0))}
    </View>
  ) : null;
  const boxesBlock = (
    <View className={twoColumns ? "gap-6" : "mt-5 gap-6"} testID="standalone-scenarios">
      {BOXES.map((box) => (
      <View key={box.id} testID={`box-${box.id}`}>
      <FoldSection id={`box-${box.id}`} title={box.name} count={box.scenarios.length} unit="scenario" {...fold(`box-${box.id}`)}>
      <View className="gap-2.5">
        {box.scenarios.map((id, index) => {
          const playable = isPlayable(id);
          return (
            <Pressable
              key={id}
              testID={`standalone-${id}`}
              collapsable={false}
              accessibilityRole="button"
              accessibilityState={{ disabled: !playable }}
              accessibilityLabel={playable ? `Play ${nameOf(id)}` : `${nameOf(id)}, not playable yet`}
              disabled={!playable}
              onPress={() => brief(id)}
            >
              {({ pressed }) => (
                <View
                  className="flex-row items-center gap-3.5 overflow-hidden rounded-card pr-4"
                  style={{ ...panelSurface(pressed, t), boxShadow: raisedEdgeOf(t) }}
                >
                  <View style={{ width: 92 * s, height: 68 * s }}>
                    <SceneArt scenarioId={id} width={92 * s} height={68 * s}>
                      {/* A scenario not playable yet keeps its faint words at full strength; only its scene is veiled. */}
                      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: playable ? "transparent" : withAlphaHex(palette.night, 0.6) }} />
                    </SceneArt>
                    <View className="absolute bottom-1.5 left-1.5 h-6 w-6 items-center justify-center rounded-pill" style={{ backgroundColor: withAlphaHex(palette.night, 0.8), borderWidth: 1, borderColor: playable ? palette.goldLine : palette.hairline }}>
                      <Text className={`font-display-bold text-micro ${playable ? "text-gold" : "text-faint"}`}>{String(index + 1)}</Text>
                    </View>
                  </View>
                  <View className="flex-1 py-2">
                    <Text className={`font-display text-heading ${playable ? "text-bone" : "text-faint"}`} numberOfLines={2}>
                      {nameOf(id)}
                    </Text>
                    {playable ? null : <Text className="text-label text-faint">Not playable yet</Text>}
                  </View>
                  {playable ? <Chevron direction="right" color={palette.faint} size={8} /> : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      </FoldSection>
      </View>
      ))}
    </View>
  );
  const gamesBlock = (
    <View className={twoColumns ? "gap-3" : "mt-6 gap-3"} testID="standalone-games">
      <Section title="Games" />
      {games.length === 0 ? <BodyText tone="muted">{archived.length === 0 ? "No game yet. Pick a scenario to deal one." : "No open game. Pick a scenario to deal one."}</BodyText> : null}
      {finished.map((game) => renderGame(game))}
      {archived.length > 0 ? (
        <View testID="archived-games">
          <FoldSection
            id="archived-games"
            title="Archived"
            count={archived.length}
            unit="game"
            testID="archived-toggle"
            folded={folds.folded("archived-games", true)}
            onFold={(next) => {
              folds.setFolded("archived-games", next, true);
              // A folded list keeps no pending delete confirm.
              if (next) setDeleting(null);
            }}
          >
            <View className="gap-3 pt-1">
              {archived.map((game) => (
                <View key={game.id} testID={`archived-${game.id}`}>
                  <Panel unfilled>
                    <Text className="font-display text-title text-muted">{nameOf(game.scenarioId)}</Text>
                    <Label>{gameCaption(game)}</Label>
                    {actions(game, { label: "Restore", onPress: () => restore(game) })}
                  </Panel>
                </View>
              ))}
            </View>
          </FoldSection>
        </View>
      ) : null}
    </View>
  );

  const page = (
    <>
        <View className="flex-row items-start justify-between pt-4">
          <View className="flex-1">
            <ScreenTitle>Scenarios</ScreenTitle>
            <Label className="mt-1">Standalone adventures. No campaign log, boons or burdens.</Label>
          </View>
          <View className="-mr-3 flex-row">
            <TextButton label="History" testID="history-open" tone="muted" accessibilityLabel="History of finished games" onPress={() => router.push({ pathname: "/history", params: { kind: "standalone" } })} />
            {games.length > 0 ? (
              <TextButton
                label={managing ? "Done" : "Manage"}
                testID="manage-games"
                tone="muted"
                onPress={() => {
                  setManaging(!managing);
                  setDeleting(null);
                }}
              />
            ) : null}
          </View>
        </View>

        {twoColumns ? (
          <View className="mt-5 flex-row items-start" style={{ gap: split.gap }} testID="scenarios-columns">
            <View className="min-w-0 flex-1">{boxesBlock}</View>
            <View className="gap-6" style={{ width: split.side }}>
              {playingBlock}
              {gamesBlock}
            </View>
          </View>
        ) : (
          <>
            {playingBlock}
            {boxesBlock}
            {gamesBlock}
          </>
        )}
    </>
  );

  return (
    <Screen testID="scenarios" scene="dusk">
      {/* An expanded window scrolls in a wide column; the measurer (outside the columns) decides whether it splits, else one readable column. */}
      <ScreenScroll max={size === "expanded" ? "wide" : "readable"}>
        {size === "expanded" ? <View style={{ height: 0 }} onLayout={columns.measure} /> : null}
        {size === "expanded" && !twoColumns ? <Column>{page}</Column> : page}
      </ScreenScroll>
    </Screen>
  );
}
