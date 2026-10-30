// Standalone play (mec109.campaign-mode: "players can still play the scenarios as standalone adventures"). The box's
// scenarios in book order, each dealt on its own with no campaign card, log, boons or burdens; then the games: resume one
// in progress, play a finished one again, archive a game out of the list and restore it, or delete it after a second
// confirm. Reads the scenario files and user.db only; it does not scan `cards`.
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";

import { isPlayable } from "../../../campaign/playable";
import { droppedIfStale, standaloneStatus, type ListedStandalone } from "../../../campaign/standalone";
import { CATALOG_VERSION } from "../../../catalog/version";
import { BOXES, scenarioName, scenarioOf } from "../../campaign-data";
import { BodyText, Chevron, Chip, Eyebrow, HubHeader, useTitleShadow, Label, Panel, PillButton, PrimaryFace, Screen, ScreenScroll, Section } from "../../chrome";
import { FoldSection, useFolds } from "../../fold-section";
import { SceneArt } from "../../art";
import { usePalette } from "../../palette-hook";
import { ITEM_RADIUS } from "../../../play/radius";
import { dropShadowOf, rowSurface, tileSurface } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { withAlphaHex } from "../../../play/tokens";
import { useDatabases } from "../../databases";
import { KeepOrDelete } from "../../keep-or-delete";
import { gameCaption, statusWord, STANDALONE_DROPPED } from "../../standalone-words";
import { seatWord } from "../../seats";
import { archiveStandalone, deleteStandalone, listArchivedStandalone, listStandalone, restoreStandalone, writeStandaloneActive } from "../../standalone-store";
import { useSizeClass } from "../../../play/use-size-class";
import { useUiScale } from "../../../play/ui-scale";
import { Text } from "../../../play/text";
import { GameIcon } from "../../../play/game-icon";

const DELETE_SENTENCE = "Delete this game? It is gone for good. Your decks stay.";

export default function Scenarios() {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const titleShadow = useTitleShadow();
  const { size } = useSizeClass();
  const router = useRouter();
  const { user } = useDatabases();
  const [games, setGames] = useState<ListedStandalone[]>([]);
  const [archived, setArchived] = useState<ListedStandalone[]>([]);
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
    const open = listStandalone(user).map((game) => {
      const dropped = droppedIfStale(game, CATALOG_VERSION);
      if (!dropped) return game;
      writeStandaloneActive(user, dropped);
      return dropped;
    });
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

  function open(game: ListedStandalone): void {
    if (standaloneStatus(game) === "playing") router.push({ pathname: "/standalone/table/[gameId]", params: { gameId: game.id } });
    else if (game.loadout) brief(game.scenarioId, game.id);
  }

  const label = (game: ListedStandalone) => `${nameOf(game.scenarioId)}, ${gameCaption(game)}`;

  // The button a screen reader was on goes away with each of these, so each says what happened.
  function archive(game: ListedStandalone): void {
    archiveStandalone(user, game.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Archived ${label(game)}`);
  }

  function restore(game: ListedStandalone): void {
    restoreStandalone(user, game.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Restored ${label(game)}`);
  }

  function askDelete(id: string): void {
    setDeleting(id);
    AccessibilityInfo.announceForAccessibility(DELETE_SENTENCE);
  }

  function remove(game: ListedStandalone): void {
    deleteStandalone(user, game.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Deleted ${label(game)}`);
  }

  const actions = (game: ListedStandalone, keep: { label: "Archive" | "Restore"; onPress: () => void }) => (
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

  // A game: Resume or Play again, or under Manage, Archive and Delete. A game in progress is a banner on its scene; a
  // finished one a row with its result.
  function renderGame(game: ListedStandalone, framed = false) {
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
    // The latest game in progress is a banner on its scene with the one primary, Resume; an older one is a row (below).
    if (status === "playing" && framed) {
      const height = (size === "compact" ? 150 : 220) * s;
      // The scene is the button (one control with its spoken label and `resume-<id>`); "Resume" is drawn in the primary's look inside it.
      return (
        <View key={game.id} testID={`game-${game.id}`}>
          <Pressable testID={`resume-${game.id}`} collapsable={false} accessibilityRole="button" accessibilityLabel={spoken} onPress={() => open(game)}>
            {({ pressed }) => (
              <SceneArt scenarioId={game.scenarioId} height={height} radius={ITEM_RADIUS * s} fade={0.2} fadeTo={palette.night}>
                <View className="absolute bottom-0 left-0 right-0 flex-row items-end justify-between gap-3" style={{ padding: (size === "compact" ? 12 : 24) * s }}>
                  <View className="min-w-0 flex-1" importantForAccessibility="no-hide-descendants">
                    <Eyebrow tone="accent">In progress</Eyebrow>
                    <Text className="mt-1 font-display text-bone" style={{ fontSize: (size === "compact" ? 24 : 32) * s, lineHeight: (size === "compact" ? 28 : 38) * s, ...titleShadow }} numberOfLines={2}>
                      {nameOf(game.scenarioId)}
                    </Text>
                    <GameLine game={game} />
                  </View>
                  <View style={{ minWidth: (size === "compact" ? 110 : 200) * s }}>
                    <PrimaryFace label="Resume" pressed={pressed} />
                  </View>
                </View>
              </SceneArt>
            )}
          </Pressable>
        </View>
      );
    }
    const tone = status === "won" ? "accent" : status === "lost" ? "danger" : status === "playing" ? "ok" : "faint";
    return (
      <Pressable key={game.id} testID={`game-${game.id}`} collapsable={false} accessibilityRole="button" accessibilityLabel={spoken} disabled={action == null} onPress={() => open(game)}>
        {({ pressed }) => (
          <View className="rounded-item px-4 py-3" style={tileSurface(pressed, t)}>
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="font-display text-heading text-bone">{nameOf(game.scenarioId)}</Text>
                <GameLine game={game} />
              </View>
              <Chip label={statusWord(game)} tone={tone} />
            </View>
            {status === "dropped" ? (
              <Label tone="muted" className="mt-2">
                {STANDALONE_DROPPED}
              </Label>
            ) : null}
            {action ? <Text className="mt-2 font-display text-label text-accent">{action}</Text> : null}
          </View>
        )}
      </Pressable>
    );
  }
  // Expanded: the boxes on the left, the games on the right (docs/design-system.md, Tablets); otherwise one column, as on a phone.
  const wide = size !== "compact";
  const playingBlock = playing.length > 0 ? (
    <View className="mt-3 gap-3" testID="standalone-playing">
      {playing.map((game, index) => renderGame(game, index === 0))}
    </View>
  ) : null;
  // How a scenario stands, from its latest open game: won with its score, in progress, or its quest stages.
  const standing = (id: string): { line: string; tone: string } => {
    const game = games.find((entry) => entry.scenarioId === id);
    const state = game ? standaloneStatus(game) : null;
    if (game && state === "won") return { line: statusWord(game), tone: palette.ok };
    if (state === "playing") return { line: "In progress", tone: palette.accentHigh };
    const stages = scenarioOf(id)?.stages.length ?? 0;
    return { line: stages > 0 ? `${stages} quest ${stages === 1 ? "stage" : "stages"}` : "", tone: palette.faint };
  };
  // The number in a small diamond on a scenario's art.
  const badge = (number: number, playable: boolean) => (
    <View className="items-center justify-center" style={{ width: 24 * s, height: 24 * s, transform: [{ rotate: "45deg" }], backgroundColor: t.depth === "light" ? palette.raisedTop : withAlphaHex(palette.night, 0.82), boxShadow: dropShadowOf(t, 2, 6, 0.8) }}>
      <Text className="font-display" style={{ fontSize: 12 * s, lineHeight: 15 * s, color: playable ? palette.accentHigh : palette.faint, transform: [{ rotate: "-45deg" }] }}>
        {String(number)}
      </Text>
    </View>
  );
  // A tablet shows each box as poster tiles: six across in landscape, three in portrait. A phone lists them as 64 pt rows.
  const posters = wide ? (size === "expanded" ? 6 : 3) : 0;
  const boxesBlock = (
    <View className="mt-5 gap-6" testID="standalone-scenarios">
      {BOXES.map((box) => (
      <View key={box.id} testID={`box-${box.id}`}>
      <FoldSection id={`box-${box.id}`} title={box.name} count={box.scenarios.length} unit="scenario" {...fold(`box-${box.id}`)}>
      {/* Posters keep one width on every row (a short last row does not stretch): each cell is a column's share, the gutter its padding. */}
      <View className={posters ? "flex-row flex-wrap" : undefined} style={posters ? { rowGap: 12 * s, marginHorizontal: -6 * s } : { gap: 8 * s }}>
        {box.scenarios.map((id, index) => {
          const playable = isPlayable(id);
          const { line, tone } = playable ? standing(id) : { line: "Not playable yet", tone: palette.faint };
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
              style={posters ? { width: `${100 / posters}%`, paddingHorizontal: 6 * s } : undefined}
            >
              {({ pressed }) =>
                posters ? (
                  <View className="overflow-hidden rounded-item" style={{ ...tileSurface(pressed, t), opacity: playable ? 1 : 0.78 }}>
                    <SceneArt scenarioId={id} height={(size === "expanded" ? 270 : 300) * s} fade={0.55} fadeTo={palette.dusk}>
                      {playable ? null : <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: withAlphaHex(palette.night, 0.55) }} />}
                      <View className="absolute" style={{ left: 12 * s, top: 12 * s }}>
                        {badge(index + 1, playable)}
                      </View>
                      <View className="absolute bottom-0 left-0 right-0" style={{ padding: 12 * s }}>
                        <Text className={`font-display text-heading ${playable ? "text-bone" : "text-faint"}`} numberOfLines={3}>
                          {nameOf(id)}
                        </Text>
                        {line ? (
                          <Text className="text-label" style={{ color: tone }} numberOfLines={2}>
                            {line}
                          </Text>
                        ) : null}
                      </View>
                    </SceneArt>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-3.5 overflow-hidden rounded-item pr-3" style={{ ...rowSurface(pressed, t), opacity: playable ? 1 : 0.78 }}>
                    <View style={{ width: 86 * s, height: 64 * s }}>
                      <SceneArt scenarioId={id} width={86 * s} height={64 * s} vivid>
                        {/* A scenario not playable yet keeps its faint words at full strength; only its scene is veiled. */}
                        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: playable ? withAlphaHex(palette.night, 0.15) : withAlphaHex(palette.night, 0.62) }} />
                      </SceneArt>
                      <View className="absolute" style={{ left: 6 * s, bottom: 6 * s }}>
                        {badge(index + 1, playable)}
                      </View>
                    </View>
                    <View className="min-w-0 flex-1 py-2">
                      <Text className={`font-display text-heading ${playable ? "text-bone" : "text-faint"}`} numberOfLines={2}>
                        {nameOf(id)}
                      </Text>
                      {line ? (
                        <Text className="text-label" style={{ color: tone }} numberOfLines={1}>
                          {line}
                        </Text>
                      ) : null}
                    </View>
                    {playable ? <Chevron direction="right" color={palette.faint} size={8} /> : null}
                  </View>
                )
              }
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
    <View className="mt-6 gap-3" testID="standalone-games">
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
        <HubHeader title="Scenarios" subtitle="Standalone adventures. No campaign log, boons or burdens.">
          <PillButton label="History" testID="history-open" accessibilityLabel="History of finished games" onPress={() => router.push({ pathname: "/history", params: { kind: "standalone" } })} />
          {games.length > 0 ? (
            <PillButton
              label={managing ? "Done" : "Manage"}
              testID="manage-games"
              onPress={() => {
                setManaging(!managing);
                setDeleting(null);
              }}
            />
          ) : null}
        </HubHeader>

        {/* One column on every size: a tablet's box rows become poster tiles across the whole width, the games under them. */}
        {playingBlock}
        {boxesBlock}
        {gamesBlock}
    </>
  );

  return (
    <Screen testID="scenarios" scene="moon">
      {/* An expanded window scrolls in a wide column, a medium one in a readable column. */}
      <ScreenScroll max={size === "expanded" ? "wide" : "readable"}>{page}</ScreenScroll>
    </Screen>
  );
}

/** A game's seats and difficulty under its name, the Eye of Sauron before them on Nightmare. */
function GameLine({ game }: { game: ListedStandalone }) {
  const s = useUiScale();
  const nightmare = game.loadout?.difficulty === "Nightmare";
  return (
    <View className="flex-row items-center gap-1.5">
      {nightmare ? <GameIcon name="nightmare" size={14 * s} tint="threat" /> : null}
      <Label>{`${seatWord(game.seatCount)}${game.loadout ? ` · ${game.loadout.difficulty}` : ""}`}</Label>
    </View>
  );
}
