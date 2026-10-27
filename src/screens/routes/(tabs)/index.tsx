import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from "react-native";

import { campaignPath, nextStep } from "../../../campaign/path";
import type { Save } from "../../../campaign/save";
import { FELLOWSHIP_ID } from "../../../campaign/save";
import { Label, Panel, PrimaryButton, RingMark, Screen, ScreenScroll, ScreenTitle, Section, SecondaryButton, TextButton } from "../../chrome";
import { SceneArt, type ArtCard } from "../../art";
import { deckFaces } from "../../deck-store";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { campaignOf, scenarioNames } from "../../campaign-data";
import { archiveSave, createSave, deleteSave, listArchivedSaves, listSaves, restoreSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";
import { KeepOrDelete } from "../../keep-or-delete";
import { ContinuePanel, DELETE_SENTENCE, SaveRow, SaveSummary, describe, type SaveLine } from "../../save-panels";
import { nextStepHref, pathHref } from "../../scenario-links";
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
      className="min-h-14 flex-1 items-center justify-center gap-2 rounded-tile px-3 py-3"
      style={{ backgroundColor: selected ? palette.pressed : palette.raised, borderWidth: selected ? 1.5 : 1, borderColor: selected ? palette.gold : palette.hairline }}
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

// The fellowship a playthrough plays: the heroes the campaign log records, else the heroes the last loadout dealt.
function partyCodes(save: Save): string[] {
  const logged = save.log.heroesBySeat.flat();
  if (logged.length > 0) return logged;
  return save.loadout?.seats.flatMap((seat) => seat.heroes) ?? [];
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
  // New playthrough opens the Start block under the saves: the list scrolls to it, so its primary is on screen.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const startAt = useRef(0);
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

  const faces = useMemo(() => deckFaces(catalog, saves.flatMap(partyCodes)), [catalog, saves]);
  const partyOf = (save: Save): ArtCard[] => partyCodes(save).flatMap((code) => {
    const face = faces.get(code);
    return face ? [{ code, imagesrc: face.imagesrc }] : [];
  });
  const partyWords = (save: Save): string | null => {
    const names = partyCodes(save).map((code) => faces.get(code)?.name ?? code);
    return names.length > 0 ? names.join(", ") : null;
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
      <ScreenScroll scrollRef={scroll}>
        <View className="flex-row items-center justify-between pb-3 pt-4">
          <ScreenTitle>Campaigns</ScreenTitle>
          {saves.length > 0 ? (
            <View className="-mr-3">
              <TextButton
                label={managing ? "Done" : "Manage"}
                testID="manage-playthroughs"
                tone="muted"
                accessibilityLabel={managing ? "Done managing playthroughs" : "Manage playthroughs"}
                onPress={toggleManage}
              />
            </View>
          ) : null}
        </View>
        <View className="gap-3">
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
                  heroes={partyOf(save)}
                  party={partyWords(save)}
                  onNext={() => router.push(nextStepHref(save.id, line.next))}
                  onPath={() => openPath(save)}
                  onLog={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })}
                />
              );
            }
            return (
              <View key={save.id} className={index === 1 ? "mt-2" : undefined}>
                {index === 1 ? <Section title="Other journeys" /> : null}
                <SaveRow id={save.id} line={lineOf(save)} lead={partyOf(save)[0] ?? null} onPress={() => openPath(save)} />
              </View>
            );
          })}
          {showStart ? (
            <View
              className={saves.length > 0 ? "mt-2" : undefined}
              onLayout={(event) => {
                startAt.current = event.nativeEvent.layout.y;
                if (starting) scroll.current?.scrollTo({ y: Math.max(0, startAt.current - 8), animated: true });
              }}
            >
              {saves.length > 0 ? (
                <Section title="New playthrough" right={<TextButton label="Cancel" testID="start-cancel" tone="muted" accessibilityLabel="Cancel the new playthrough" onPress={() => setStarting(false)} />} />
              ) : null}
              <Panel current={saves.length === 0} padded={false}>
                <View className="overflow-hidden rounded-t-card">
                  <SceneArt scenarioId={fellowship?.scenarios[0]} height={132} fade={0.3} fadeTo={palette.raised} />
                </View>
                <View className="px-5 pb-5" style={{ marginTop: -36 }}>
                  <Text className="font-display text-title text-bone">{nameOf(FELLOWSHIP_ID)}</Text>
                  <Label>{`${total} scenarios`}</Label>
                  <View className="mt-4 flex-row gap-3">
                    <SeatTile seats={1} selected={seats === 1} onPress={() => setSeats(1)} />
                    <SeatTile seats={2} selected={seats === 2} onPress={() => setSeats(2)} />
                  </View>
                  <View className="mt-4 gap-3">
                    <Label>Chosen once for this campaign</Label>
                    <PrimaryButton label="Start Fellowship" testID="start-fellowship" onPress={start} />
                  </View>
                </View>
              </Panel>
            </View>
          ) : null}
          {!showStart && !managing ? (
            <SecondaryButton label="New playthrough" testID="new-playthrough" tone="gold" compact onPress={() => setStarting(true)} />
          ) : null}
          {archived.length > 0 ? (
            <View className="gap-3" testID="archived-playthroughs">
              <View className="-mx-3 flex-row">
                <TextButton
                  label={`Archived · ${archived.length}`}
                  testID="archived-toggle"
                  tone="muted"
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
            <View className="mt-2">
              <Section title="Coming later" />
              <View className="flex-row gap-3" testID="locked-campaigns">
                {locked.map((tile) => (
                  <View
                    key={tile.id}
                    testID={`locked-${tile.id}`}
                    accessible
                    accessibilityLabel={`${tile.name}, ${tile.caption}`}
                    className="min-h-32 flex-1 justify-end gap-1 rounded-card px-4 py-4"
                    style={{ borderWidth: 1, borderStyle: "dashed", borderColor: palette.hairline }}
                  >
                    <RingMark size={14} state="locked" />
                    <Text className="mt-2 font-display text-heading text-faint">{tile.name}</Text>
                    <Text className="text-label text-faint">{tile.caption}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
