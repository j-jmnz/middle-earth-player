import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from "react-native";

import { campaignPath, nextStep } from "../../../campaign/path";
import type { Save } from "../../../campaign/save";
import { FELLOWSHIP_ID } from "../../../campaign/save";
import { Label, Panel, PrimaryButton, RingMark, Screen, ScreenTitle, TextButton } from "../../chrome";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { campaignOf, scenarioNames } from "../../campaign-data";
import { archiveSave, createSave, deleteSave, listArchivedSaves, listSaves, restoreSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";
import { ContinuePanel, DELETE_SENTENCE, SaveActions, SaveSummary, describe, type SaveLine } from "../../save-panels";
import { nextStepHref, pathHref } from "../../scenario-links";

type Seats = 1 | 2;

function seatWord(seats: Seats): string {
  return seats === 1 ? "True solo" : "Two-handed";
}

function SeatTile({ seats, selected, onPress }: { seats: Seats; selected: boolean; onPress: () => void }) {
  const label = seatWord(seats);
  return (
    <Pressable
      testID={`seats-${seats}`}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-14 flex-1 items-center justify-center gap-2 rounded-tile bg-raised px-3 py-3"
      style={{ borderWidth: selected ? 1.5 : 1, borderColor: selected ? palette.gold : palette.hairline }}
    >
      <View className="flex-row">
        <RingMark size={18} state={selected ? "current" : "locked"} />
        {seats === 2 ? (
          <View style={{ marginLeft: -6 }}>
            <RingMark size={18} state={selected ? "current" : "locked"} />
          </View>
        ) : null}
      </View>
      <Text className={selected ? "text-body font-semibold text-bone" : "text-body text-muted"}>{label}</Text>
    </Pressable>
  );
}

export default function CampaignList() {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const [saves, setSaves] = useState<Save[]>([]);
  const [archived, setArchived] = useState<Save[]>([]);
  const [starting, setStarting] = useState(false);
  // Manage shows Archive and Delete on each open playthrough instead of opening it. It ends when the list loses focus.
  const [managing, setManaging] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // The save whose delete is waiting on Delete for good.
  const [deleting, setDeleting] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seats>(1);
  const campaigns = campaignListQueries(catalog).campaigns.all();
  const locked = lockedTiles(campaigns);
  const nameOf = (id: string) => campaigns.find((campaign) => campaign.id === id)?.name ?? id;
  const fellowship = campaignOf(FELLOWSHIP_ID);
  const total = fellowship?.scenarios.length ?? 6;
  const names = fellowship ? scenarioNames(fellowship) : {};
  const lineOf = (save: Save): SaveLine => {
    const path = fellowship ? campaignPath(fellowship, names, save.log) : [];
    return {
      name: nameOf(save.campaignId),
      seats: seatWord(save.seatCount),
      done: path.filter((node) => node.status === "completed").length,
      total,
      next: nextStep(path, save.loadout?.scenarioId),
    };
  };

  const refresh = useCallback(() => {
    const open = listSaves(user);
    const away = listArchivedSaves(user);
    setSaves(open);
    setArchived(away);
    if (open.length === 0) setManaging(false);
    if (away.length === 0) setShowArchived(false);
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

  function openPath(save: Save): void {
    router.push(pathHref(save.id));
  }

  function start(): void {
    const save = createSave(user, FELLOWSHIP_ID, seats);
    refresh();
    setStarting(false);
    openPath(save);
  }

  // The button a screen reader was on goes away with each of these, so each says what happened.
  function archive(save: Save): void {
    archiveSave(user, save.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Archived ${describe(lineOf(save))}`);
  }

  function restore(save: Save): void {
    restoreSave(user, save.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Restored ${describe(lineOf(save))}`);
  }

  function askDelete(id: string): void {
    setDeleting(id);
    AccessibilityInfo.announceForAccessibility(DELETE_SENTENCE);
  }

  function remove(save: Save): void {
    deleteSave(user, save.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Deleted ${describe(lineOf(save))}`);
  }

  function toggleManage(): void {
    setManaging(!managing);
    setStarting(false);
    setDeleting(null);
  }

  function toggleArchived(): void {
    setShowArchived(!showArchived);
    setDeleting(null);
  }

  const showStart = !managing && (saves.length === 0 || starting);
  const actions = (save: Save, keep: { label: "Archive" | "Restore"; onPress: () => void }) => (
    <SaveActions
      id={save.id}
      line={lineOf(save)}
      keep={keep}
      confirming={deleting === save.id}
      onAskDelete={() => askDelete(save.id)}
      onDelete={() => remove(save)}
      onKeep={() => setDeleting(null)}
    />
  );

  return (
    <Screen testID="campaign-list" scene="dusk">
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6">
        <View className="pt-6">
          <ScreenTitle>Campaigns</ScreenTitle>
        </View>
        {/* The scene's light sits above the cards. */}
        <View className="mt-40 gap-3">
          {saves.map((save, index) => {
            const eyebrow = saves.length > 1 && index === 0;
            if (managing) {
              return (
                <View key={save.id} testID={`save-${save.id}`}>
                  <Panel current={index === 0}>
                    <SaveSummary line={lineOf(save)} eyebrow={eyebrow} />
                    {actions(save, { label: "Archive", onPress: () => archive(save) })}
                  </Panel>
                </View>
              );
            }
            if (index === 0) {
              const line = lineOf(save);
              return (
                <ContinuePanel
                  key={save.id}
                  id={save.id}
                  line={line}
                  eyebrow={eyebrow}
                  primary={!showStart}
                  onNext={() => router.push(nextStepHref(save.id, line.next))}
                  onPath={() => openPath(save)}
                  onLog={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })}
                />
              );
            }
            return (
              <Pressable
                key={save.id}
                testID={`save-${save.id}`}
                collapsable={false}
                accessibilityRole="button"
                accessibilityLabel={`Open ${describe(lineOf(save))}`}
                onPress={() => openPath(save)}
              >
                {({ pressed }) => (
                  <Panel pressed={pressed}>
                    <SaveSummary line={lineOf(save)} eyebrow={false} />
                  </Panel>
                )}
              </Pressable>
            );
          })}
          {showStart ? (
            <Panel>
              <Text className="font-display text-title text-bone">{nameOf(FELLOWSHIP_ID)}</Text>
              <View className="mt-4 flex-row gap-3">
                <SeatTile seats={1} selected={seats === 1} onPress={() => setSeats(1)} />
                <SeatTile seats={2} selected={seats === 2} onPress={() => setSeats(2)} />
              </View>
              <View className="mt-4 gap-3">
                <Label>Chosen once for this campaign</Label>
                <PrimaryButton label="Start Fellowship" testID="start-fellowship" onPress={start} />
              </View>
            </Panel>
          ) : null}
          {/* The list's own actions, one row under the saves: New playthrough, then Manage. */}
          {(!showStart && !managing) || saves.length > 0 ? (
            <View className="-mx-3 flex-row justify-between">
              {!showStart && !managing ? <TextButton label="New playthrough" testID="new-playthrough" tone="gold" onPress={() => setStarting(true)} /> : <View />}
              {saves.length > 0 ? (
                <TextButton
                  label={managing ? "Done" : "Manage"}
                  testID="manage-playthroughs"
                  accessibilityLabel={managing ? "Done managing playthroughs" : "Manage playthroughs"}
                  onPress={toggleManage}
                />
              ) : null}
            </View>
          ) : null}
          {archived.length > 0 ? (
            <View className="gap-3" testID="archived-playthroughs">
              <View className="-mx-3 flex-row">
                <TextButton
                  label={`Archived · ${archived.length}`}
                  testID="archived-toggle"
                  accessibilityLabel={`${archived.length} archived ${archived.length === 1 ? "playthrough" : "playthroughs"}`}
                  expanded={showArchived}
                  onPress={toggleArchived}
                />
              </View>
              {showArchived
                ? archived.map((save) => (
                    <View key={save.id} testID={`archived-${save.id}`}>
                      <Panel unfilled>
                        <SaveSummary line={lineOf(save)} eyebrow={false} archived />
                        {actions(save, { label: "Restore", onPress: () => restore(save) })}
                      </Panel>
                    </View>
                  ))
                : null}
            </View>
          ) : null}
          {locked.length > 0 ? (
            <View className="flex-row gap-3" testID="locked-campaigns">
              {locked.map((tile) => (
                <View
                  key={tile.id}
                  testID={`locked-${tile.id}`}
                  accessible
                  accessibilityLabel={`${tile.name}, ${tile.caption}`}
                  className="flex-1 gap-2 rounded-tile border border-hairline px-3 py-3"
                >
                  <RingMark size={12} state="locked" />
                  <Text className="font-display text-body text-faint">{tile.name}</Text>
                  <Text className="text-label text-faint">{tile.caption}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
