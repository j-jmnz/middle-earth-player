import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { campaignPath } from "../../../campaign/path";
import type { Save } from "../../../campaign/save";
import { FELLOWSHIP_ID } from "../../../campaign/save";
import { BodyText, Eyebrow, Label, Panel, PrimaryButton, RingMark, Screen, ScreenTitle, TextButton } from "../../chrome";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { campaignOf } from "../../campaign-data";
import { archiveSave, createSave, deleteSave, listArchivedSaves, listSaves, restoreSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";

type Seats = 1 | 2;

function SeatTile({ seats, selected, onPress }: { seats: Seats; selected: boolean; onPress: () => void }) {
  const label = seats === 1 ? "True solo" : "Two-handed";
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

// A delete is asked twice, in place: the panel says what is lost and offers Delete for good beside Keep.
function DeleteConfirm({ id, onDelete, onKeep }: { id: string; onDelete: () => void; onKeep: () => void }) {
  return (
    <View className="mt-3 gap-1" testID={`delete-confirm-${id}`}>
      <BodyText tone="danger">Delete this playthrough? Its log, pool and any open scenario are gone for good.</BodyText>
      <View className="-mx-3 flex-row">
        <TextButton label="Delete for good" testID={`delete-yes-${id}`} tone="danger" onPress={onDelete} />
        <TextButton label="Keep" testID={`delete-no-${id}`} onPress={onKeep} />
      </View>
    </View>
  );
}

export default function CampaignList() {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const [saves, setSaves] = useState<Save[]>([]);
  const [archived, setArchived] = useState<Save[]>([]);
  const [starting, setStarting] = useState(false);
  // Manage shows Archive and Delete on each open playthrough instead of opening it.
  const [managing, setManaging] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // The save whose delete is waiting on Delete for good.
  const [deleting, setDeleting] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seats>(1);
  const campaigns = campaignListQueries(catalog, user).campaigns.all();
  const locked = lockedTiles(campaigns);
  const nameOf = (id: string) => campaigns.find((campaign) => campaign.id === id)?.name ?? id;

  const refresh = useCallback(() => {
    const open = listSaves(user);
    const away = listArchivedSaves(user);
    setSaves(open);
    setArchived(away);
    if (open.length === 0) setManaging(false);
    if (away.length === 0) setShowArchived(false);
    setDeleting(null);
  }, [user]);

  useFocusEffect(refresh);

  function openBooklet(id: string): void {
    router.push({ pathname: "/booklet/[id]", params: { id } });
  }

  function start(): void {
    const save = createSave(user, FELLOWSHIP_ID, seats);
    refresh();
    setStarting(false);
    router.push({ pathname: "/path/[saveId]", params: { saveId: save.id } });
  }

  function archive(id: string): void {
    archiveSave(user, id);
    refresh();
  }

  function restore(id: string): void {
    restoreSave(user, id);
    refresh();
  }

  function remove(id: string): void {
    deleteSave(user, id);
    refresh();
  }

  const showStart = saves.length === 0 || starting;
  const fellowship = campaignOf(FELLOWSHIP_ID);
  const doneOf = (save: Save) => (fellowship ? campaignPath(fellowship, {}, save.log).filter((node) => node.status === "completed").length : 0);
  const total = fellowship?.scenarios.length ?? 6;
  const seatWord = (save: Save) => (save.seatCount === 1 ? "True solo" : "Two-handed");

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
            if (managing) {
              return (
                <View key={save.id} testID={`save-${save.id}`}>
                  <Panel current={index === 0}>
                    <Text className="font-display text-title text-bone">{nameOf(save.campaignId)}</Text>
                    <Label>{seatWord(save)}</Label>
                    <ProgressLine done={doneOf(save)} total={total} />
                    {deleting === save.id ? (
                      <DeleteConfirm id={save.id} onDelete={() => remove(save.id)} onKeep={() => setDeleting(null)} />
                    ) : (
                      <View className="-mx-3 mt-2 flex-row">
                        <TextButton label="Archive" testID={`archive-${save.id}`} tone="gold" accessibilityLabel={`Archive ${nameOf(save.campaignId)}, ${seatWord(save)}`} onPress={() => archive(save.id)} />
                        <TextButton label="Delete" testID={`delete-${save.id}`} tone="danger" accessibilityLabel={`Delete ${nameOf(save.campaignId)}, ${seatWord(save)}`} onPress={() => setDeleting(save.id)} />
                      </View>
                    )}
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
                    {saves.length > 1 && index === 0 ? <Eyebrow>Current</Eyebrow> : null}
                    <Text className="mt-1 font-display text-title text-bone">{nameOf(save.campaignId)}</Text>
                    <Label>{seatWord(save)}</Label>
                    <ProgressLine done={doneOf(save)} total={total} />
                  </Panel>
                )}
              </Pressable>
            );
          })}
          {saves.length > 0 ? (
            <View className="-mx-3 flex-row">
              <TextButton label={managing ? "Done" : "Manage"} testID="manage-playthroughs" onPress={() => { setManaging(!managing); setDeleting(null); }} />
            </View>
          ) : null}
          {saves.length === 0 && archived.length === 0 ? <BodyText tone="muted">No playthrough exists</BodyText> : null}
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
          ) : (
            <View className="items-start">
              <TextButton label="New playthrough" testID="new-playthrough" tone="gold" onPress={() => setStarting(true)} />
            </View>
          )}
          {archived.length > 0 ? (
            <View className="gap-3" testID="archived-playthroughs">
              <View className="-mx-3 flex-row">
                <TextButton
                  label={`${showArchived ? "Hide archived" : "Archived"} \u00b7 ${archived.length}`}
                  testID="archived-toggle"
                  accessibilityLabel={`${showArchived ? "Hide" : "Show"} ${archived.length} archived ${archived.length === 1 ? "playthrough" : "playthroughs"}`}
                  onPress={() => { setShowArchived(!showArchived); setDeleting(null); }}
                />
              </View>
              {showArchived
                ? archived.map((save) => (
                    <View key={save.id} testID={`archived-${save.id}`} className="rounded-card border border-hairline p-5">
                      <Text className="font-display text-title text-muted">{nameOf(save.campaignId)}</Text>
                      <Label>{seatWord(save)}</Label>
                      <ProgressLine done={doneOf(save)} total={total} />
                      {deleting === save.id ? (
                        <DeleteConfirm id={save.id} onDelete={() => remove(save.id)} onKeep={() => setDeleting(null)} />
                      ) : (
                        <View className="-mx-3 mt-2 flex-row">
                          <TextButton label="Restore" testID={`restore-${save.id}`} tone="gold" accessibilityLabel={`Restore ${nameOf(save.campaignId)}, ${seatWord(save)}`} onPress={() => restore(save.id)} />
                          <TextButton label="Delete" testID={`delete-${save.id}`} tone="danger" accessibilityLabel={`Delete ${nameOf(save.campaignId)}, ${seatWord(save)}`} onPress={() => setDeleting(save.id)} />
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
