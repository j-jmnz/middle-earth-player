// Standalone play (mec109.campaign-mode: "players can still play the scenarios as standalone adventures"). The box's
// scenarios in book order, each dealt on its own with no campaign card, log, boons or burdens; then the games: resume one
// in progress, play a finished one again, archive a game out of the list and restore it, or delete it after a second
// confirm. Reads the scenario files and user.db only; it does not scan `cards`.
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { FELLOWSHIP_ID } from "../../../campaign/save";
import { isPlayable } from "../../../campaign/playable";
import { staleReason } from "../../../campaign/session";
import { dropStandalone, standaloneStatus, type StandaloneGame } from "../../../campaign/standalone";
import { CATALOG_VERSION } from "../../../catalog/version";
import { campaignOf, scenarioNames } from "../../campaign-data";
import { BodyText, Eyebrow, Label, Panel, RingMark, Screen, ScreenTitle, TextButton, pressedNight } from "../../chrome";
import { useDatabases } from "../../databases";
import { DeleteConfirm } from "../../delete-confirm";
import { gameCaption, STANDALONE_DROPPED } from "../../standalone-words";
import { archiveStandalone, deleteStandalone, listArchivedStandalone, listStandalone, restoreStandalone, writeStandalone } from "../../standalone-store";

const DELETE_SENTENCE = "Delete this game? It is gone for good. Your decks are kept.";

export default function Scenarios() {
  const router = useRouter();
  const { user } = useDatabases();
  const [games, setGames] = useState<StandaloneGame[]>([]);
  const [archived, setArchived] = useState<StandaloneGame[]>([]);
  // Manage shows Archive and Delete on each game instead of opening it.
  const [managing, setManaging] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // The game whose delete is waiting on Delete for good.
  const [deleting, setDeleting] = useState<string | null>(null);
  const campaign = campaignOf(FELLOWSHIP_ID);
  const names = campaign ? scenarioNames(campaign) : {};
  const nameOf = (id: string) => names[id] ?? id;

  const refresh = useCallback(() => {
    // A game in progress from another engine version or against other card data is dropped on the read, as a campaign
    // save's open scenario is; the row and its loadout stay.
    for (const game of listStandalone(user)) {
      if (game.active && staleReason(game.active, CATALOG_VERSION)) writeStandalone(user, dropStandalone(game));
    }
    const open = listStandalone(user);
    const away = listArchivedStandalone(user);
    setGames(open);
    setArchived(away);
    if (open.length === 0) setManaging(false);
    if (away.length === 0) setShowArchived(false);
    setDeleting(null);
  }, [user]);

  useFocusEffect(refresh);

  function brief(scenarioId: string, from?: string): void {
    router.push({ pathname: "/standalone/briefing/[scenarioId]", params: from ? { scenarioId, from } : { scenarioId } });
  }

  function open(game: StandaloneGame): void {
    if (standaloneStatus(game) === "playing") router.push({ pathname: "/standalone/table/[gameId]", params: { gameId: game.id } });
    else if (game.loadout) brief(game.scenarioId, game.id);
  }

  function archive(id: string): void {
    archiveStandalone(user, id);
    refresh();
  }

  function restore(id: string): void {
    restoreStandalone(user, id);
    refresh();
  }

  function remove(id: string): void {
    deleteStandalone(user, id);
    refresh();
  }

  const label = (game: StandaloneGame) => `${nameOf(game.scenarioId)}, ${gameCaption(game)}`;
  // A game in progress sits above the scenarios, where the campaign list puts its open playthrough; finished games below.
  const playing = games.filter((game) => standaloneStatus(game) === "playing");
  const finished = games.filter((game) => standaloneStatus(game) !== "playing");

  // A game panel: Resume or Play again, or under Manage, Archive and Delete.
  function renderGame(game: StandaloneGame) {
    const status = standaloneStatus(game);
    if (managing) {
      return (
        <View key={game.id} testID={`game-${game.id}`}>
          <Panel>
            <Text className="font-display text-title text-bone">{nameOf(game.scenarioId)}</Text>
            <Label>{gameCaption(game)}</Label>
            {deleting === game.id ? (
              <DeleteConfirm id={game.id} sentence={DELETE_SENTENCE} onDelete={() => remove(game.id)} onKeep={() => setDeleting(null)} />
            ) : (
              <View className="-mx-3 mt-2 flex-row">
                <TextButton label="Archive" testID={`archive-${game.id}`} tone="gold" accessibilityLabel={`Archive ${label(game)}`} onPress={() => archive(game.id)} />
                <TextButton label="Delete" testID={`delete-${game.id}`} tone="danger" accessibilityLabel={`Delete ${label(game)}`} onPress={() => setDeleting(game.id)} />
              </View>
            )}
          </Panel>
        </View>
      );
    }
    const action = status === "playing" ? "Resume" : game.loadout ? "Play again" : null;
    return (
      <Pressable
        key={game.id}
        testID={`game-${game.id}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={action ? `${action} ${label(game)}` : label(game)}
        disabled={action == null}
        onPress={() => open(game)}
      >
        {({ pressed }) => (
          <Panel current={status === "playing"} pressed={pressed}>
            <Text className="font-display text-title text-bone">{nameOf(game.scenarioId)}</Text>
            <Label>{gameCaption(game)}</Label>
            {status === "dropped" ? (
              <Label tone="muted" className="mt-2">
                {STANDALONE_DROPPED}
              </Label>
            ) : null}
            {action ? <Text className="mt-2 text-body font-medium text-gold">{action}</Text> : null}
          </Panel>
        )}
      </Pressable>
    );
  }

  return (
    <Screen testID="scenarios" scene="dusk">
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6">
        <View className="pt-6">
          <ScreenTitle>Scenarios</ScreenTitle>
          <Label className="mt-1">Standalone adventures. No campaign log, boons or burdens.</Label>
        </View>

        {playing.length > 0 ? (
          <View className="mt-6 gap-3" testID="standalone-playing">
            <Eyebrow>In progress</Eyebrow>
            {playing.map(renderGame)}
          </View>
        ) : null}

        <View className="mt-6" testID="standalone-scenarios">
          <Eyebrow>{campaign?.name ?? "Fellowship of the Ring"}</Eyebrow>
          {(campaign?.scenarios ?? []).map((id, index) => {
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
                className="min-h-14 flex-row items-center gap-3 border-b border-hairline py-2"
                style={({ pressed }) => (pressed ? pressedNight : undefined)}
              >
                <RingMark size={14} state={playable ? "current" : "locked"} />
                <View className="flex-1">
                  <Text className={playable ? "font-display text-body text-bone" : "font-display text-body text-faint"}>{`${index + 1}. ${nameOf(id)}`}</Text>
                  {playable ? null : <Text className="text-label text-faint">Not playable yet</Text>}
                </View>
                {playable ? <Text className="text-body text-faint">›</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View className="mt-8 gap-3" testID="standalone-games">
          <Eyebrow tone="muted">Games</Eyebrow>
          {games.length === 0 ? <BodyText tone="muted">{archived.length === 0 ? "No game yet. Pick a scenario to deal one." : "No open game. Pick a scenario to deal one."}</BodyText> : null}
          {finished.map(renderGame)}
          {games.length > 0 ? (
            <View className="-mx-3 flex-row">
              <TextButton
                label={managing ? "Done" : "Manage"}
                testID="manage-games"
                onPress={() => {
                  setManaging(!managing);
                  setDeleting(null);
                }}
              />
            </View>
          ) : null}
          {archived.length > 0 ? (
            <View className="gap-3" testID="archived-games">
              <View className="-mx-3 flex-row">
                <TextButton
                  label={`${showArchived ? "Hide archived" : "Archived"} · ${archived.length}`}
                  testID="archived-toggle"
                  accessibilityLabel={`${showArchived ? "Hide" : "Show"} ${archived.length} archived ${archived.length === 1 ? "game" : "games"}`}
                  onPress={() => {
                    setShowArchived(!showArchived);
                    setDeleting(null);
                  }}
                />
              </View>
              {showArchived
                ? archived.map((game) => (
                    <View key={game.id} testID={`archived-${game.id}`} className="rounded-card border border-hairline p-5">
                      <Text className="font-display text-title text-muted">{nameOf(game.scenarioId)}</Text>
                      <Label>{gameCaption(game)}</Label>
                      {deleting === game.id ? (
                        <DeleteConfirm id={game.id} sentence={DELETE_SENTENCE} onDelete={() => remove(game.id)} onKeep={() => setDeleting(null)} />
                      ) : (
                        <View className="-mx-3 mt-2 flex-row">
                          <TextButton label="Restore" testID={`restore-${game.id}`} tone="gold" accessibilityLabel={`Restore ${label(game)}`} onPress={() => restore(game.id)} />
                          <TextButton label="Delete" testID={`delete-${game.id}`} tone="danger" accessibilityLabel={`Delete ${label(game)}`} onPress={() => setDeleting(game.id)} />
                        </View>
                      )}
                    </View>
                  ))
                : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
