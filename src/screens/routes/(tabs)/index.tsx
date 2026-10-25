import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from "react-native";

import { campaignPath } from "../../../campaign/path";
import type { Save } from "../../../campaign/save";
import { FELLOWSHIP_ID } from "../../../campaign/save";
import { BodyText, Eyebrow, Label, Panel, PrimaryButton, RingMark, Screen, ScreenTitle, TextButton } from "../../chrome";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { campaignOf } from "../../campaign-data";
import { archiveSave, createSave, deleteSave, listArchivedSaves, listSaves, restoreSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";
import { KeepOrDelete } from "../../keep-or-delete";
import { seatWord } from "../../seats";

type Seats = 1 | 2;


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

function ProgressLine({ done, total }: { done: number; total: number }) {
  return (
    <View className="mt-3 flex-row items-center gap-2">
      {Array.from({ length: total }, (_, index) => (
        <RingMark key={index} size={12} state={index < done ? "done" : index === done ? "current" : "locked"} />
      ))}
    </View>
  );
}

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
type SaveLine = { name: string; seats: string; done: number; total: number };

function describe(line: SaveLine): string {
  return `${line.name}, ${line.seats}, ${line.done} of ${line.total} completed`;
}

function SaveSummary({ line, eyebrow, archived = false }: { line: SaveLine; eyebrow: boolean; archived?: boolean }) {
  return (
    <>
      {eyebrow ? <Eyebrow>Current</Eyebrow> : null}
      <Text className={`mt-1 font-display text-title ${archived ? "text-muted" : "text-bone"}`}>{line.name}</Text>
      <Label>{`${line.seats} · ${line.done} of ${line.total} completed`}</Label>
      <ProgressLine done={line.done} total={line.total} />
    </>
  );
}

const DELETE_SENTENCE = "Delete this playthrough? Its log, pool and any open scenario are gone for good. Your decks stay.";

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
  const lineOf = (save: Save): SaveLine => ({
    name: nameOf(save.campaignId),
    seats: seatWord(save.seatCount),
    done: fellowship ? campaignPath(fellowship, {}, save.log).filter((node) => node.status === "completed").length : 0,
    total,
  });

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

  function openBooklet(id: string): void {
    router.push({ pathname: "/booklet/[id]", params: { id } });
  }

  function start(): void {
    const save = createSave(user, FELLOWSHIP_ID, seats);
    refresh();
    setStarting(false);
    router.push({ pathname: "/path/[saveId]", params: { saveId: save.id } });
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
    <KeepOrDelete
      id={save.id}
      described={describe(lineOf(save))}
      sentence={DELETE_SENTENCE}
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
        <View className="-mx-2 flex-row items-center justify-end">
          <TextButton label="Learn to Play" testID="booklet-open-learn-to-play" tone="gold" onPress={() => openBooklet("learn-to-play")} />
          <TextButton label="Fellowship booklet" testID="booklet-open" tone="gold" onPress={() => openBooklet(FELLOWSHIP_ID)} />
        </View>
        <ScreenTitle>Campaigns</ScreenTitle>
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
            return (
              <Pressable
                key={save.id}
                testID={`save-${save.id}`}
                collapsable={false}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/path/[saveId]", params: { saveId: save.id } })}
              >
                {({ pressed }) => (
                  <Panel current={index === 0} pressed={pressed}>
                    <SaveSummary line={lineOf(save)} eyebrow={eyebrow} />
                  </Panel>
                )}
              </Pressable>
            );
          })}
          {saves.length === 0 && archived.length === 0 ? <BodyText tone="muted">No playthrough exists</BodyText> : null}
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
