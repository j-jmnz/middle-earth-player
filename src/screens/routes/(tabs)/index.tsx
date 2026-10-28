import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, ScrollView, Text, View } from "react-native";

import { carryOffers } from "../../../campaign/carry-over";
import { campaignPath, nextStep } from "../../../campaign/path";
import type { Save } from "../../../campaign/save";
import { Panel, RingMark, Screen, ScreenScroll, ScreenTitle, SecondaryButton, TextButton } from "../../chrome";
import { FoldSection, useFolds } from "../../fold-section";
import type { ArtCard } from "../../art";
import { deckFaces } from "../../deck-store";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { campaignOf, scenarioNames } from "../../campaign-data";
import { carrySource, carryWords } from "../../carry-words";
import { StartPanel, type CarryChoice, type StartOption } from "../../start-panel";
import { archiveSave, createSave, deleteSave, listArchivedSaves, listSaves, restoreSave, savedAt } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { recordUnclosedRun } from "../../table-session";
import { palette } from "../../palette.js";
import { KeepOrDelete } from "../../keep-or-delete";
import { ContinuePanel, DELETE_SENTENCE, SaveRow, SaveSummary, describe, nextSummary, type SaveLine } from "../../save-panels";
import { nextStepHref, pathHref } from "../../scenario-links";
import { seatWord } from "../../seats";

type Seats = 1 | 2;

// The fellowship a playthrough plays: the heroes the campaign log records, else the heroes the last loadout dealt.
function partyCodes(save: Save): string[] {
  const logged = save.log.heroesBySeat.flat();
  if (logged.length > 0) return logged;
  return save.loadout?.seats.flatMap((seat) => seat.heroes) ?? [];
}

export default function CampaignList() {
  const router = useRouter();
  // `start=1`: a finished campaign's path sends the player here with the start panel open, to take its carry-over in.
  const { start: startParam } = useLocalSearchParams<{ start?: string }>();
  const { catalog, user } = useDatabases();
  const [saves, setSaves] = useState<Save[]>([]);
  const [archived, setArchived] = useState<Save[]>([]);
  // When each playthrough was last written: a finished one's date in the carry-over offers.
  const [saved, setSaved] = useState<ReadonlyMap<string, number>>(new Map());
  const [starting, setStarting] = useState(false);
  const folds = useFolds();
  // Manage shows Archive and Delete on each open playthrough instead of opening it. It ends when the list loses focus.
  const [managing, setManaging] = useState(false);
  // The save whose delete is waiting on Delete for good.
  const [deleting, setDeleting] = useState<string | null>(null);
  // New playthrough opens the Start block under the saves: the list scrolls to it, so its primary is on screen.
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const startAt = useRef(0);
  const campaigns = campaignListQueries(catalog).campaigns.all();
  const locked = lockedTiles(campaigns);
  const nameOf = (id: string) => campaigns.find((campaign) => campaign.id === id)?.name ?? id;
  // The campaigns the one start panel offers: each built campaign the catalog marks playable.
  const startable: StartOption[] = campaigns.flatMap((row) => {
    const data = row.playable ? campaignOf(row.id) : null;
    return data ? [{ data, name: row.name }] : [];
  });
  // Each save's progress line reads its own campaign.
  const lineOf = (save: Save): SaveLine => {
    const campaign = campaignOf(save.campaignId);
    const path = campaign ? campaignPath(campaign, scenarioNames(campaign), save.log) : [];
    return {
      name: nameOf(save.campaignId),
      seats: seatWord(save.seatCount),
      done: path.filter((node) => node.status === "completed").length,
      total: campaign?.scenarios.length ?? 0,
      next: nextStep(path, save.loadout?.scenarioId),
    };
  };

  // The carry-over a new playthrough may take in: every finished playthrough, open or archived, that holds cards for the next campaign.
  const offers = useMemo(() => carryOffers([...saves, ...archived], (id) => campaignOf(id)?.scenarios ?? null), [saves, archived]);
  const faces = useMemo(() => deckFaces(catalog, [...saves.flatMap(partyCodes), ...offers.flatMap((offer) => offer.cards.map((card) => card.code))]), [catalog, saves, offers]);
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
    setSaved(savedAt(user));
    if (open.length === 0) setManaging(false);
    setDeleting(null);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (startParam === "1") {
        folds.setFolded("start", false);
        setStarting(true);
      }
      return () => {
        setManaging(false);
        setDeleting(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the folds hook returns a new object each render: only the param and the refresh matter
    }, [refresh, startParam]),
  );

  function openPath(save: Save): void {
    router.push(pathHref(save.id));
  }

  const carryChoices: CarryChoice[] = offers.map((offer) => ({
    saveId: offer.saveId,
    label: nameOf(offer.campaignId),
    source: carrySource(seatWord(offer.seatCount), saved.get(offer.saveId) ?? null, offer.score),
    words: carryWords(offer.cards, (code) => faces.get(code)?.name ?? code),
    cards: offer.cards,
  }));

  function start(campaignId: string, seats: Seats, taken: CarryChoice | null): void {
    const save = createSave(user, campaignId, seats, undefined, taken?.cards ?? [], taken?.saveId ?? null);
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
    if (save.active) recordUnclosedRun(catalog, user, save.id);
    deleteSave(user, save.id);
    refresh();
    AccessibilityInfo.announceForAccessibility(`Deleted ${describe(lineOf(save))}`);
  }

  function toggleManage(): void {
    setManaging(!managing);
    setStarting(false);
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

  const current = saves[0] ?? null;
  const others = saves.slice(1);
  const fold = (id: string, defaultFolded = false) => ({ folded: folds.folded(id, defaultFolded), onFold: (next: boolean) => folds.setFolded(id, next, defaultFolded) });
  // Folding the archived list closes a delete confirm inside it: a folded list must not keep a pending delete.
  const foldArchived = (id: string) => {
    const base = fold(id, true);
    return {
      ...base,
      onFold: (next: boolean) => {
        base.onFold(next);
        if (next) setDeleting(null);
      },
    };
  };
  const startPanel = <StartPanel options={startable} current={saves.length === 0} carry={carryChoices} onStart={start} />;
  // Manage shows Archive and Delete on a playthrough instead of opening it.
  const managed = (save: Save, index: number) => (
    <View key={save.id} testID={`save-${save.id}`}>
      <Panel current={index === 0}>
        <SaveSummary line={lineOf(save)} eyebrow={saves.length > 1 && index === 0} />
        {actions(save, { label: "Archive", onPress: () => archive(save) })}
      </Panel>
    </View>
  );
  const continuing = (save: Save) => {
    const line = lineOf(save);
    return (
      <ContinuePanel
        key={save.id}
        id={save.id}
        line={line}
        eyebrow={saves.length > 1}
        primary={!showStart}
        heroes={partyOf(save)}
        party={partyWords(save)}
        onNext={() => router.push(nextStepHref(save.id, line.next))}
        onPath={() => openPath(save)}
        onLog={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })}
      />
    );
  };

  return (
    <Screen testID="campaign-list" scene="dusk">
      <ScreenScroll scrollRef={scroll}>
        <View className="flex-row items-center justify-between pb-3 pt-4">
          <ScreenTitle>Campaigns</ScreenTitle>
          <View className="-mr-3 flex-row">
            <TextButton label="History" testID="history-open" tone="muted" accessibilityLabel="History of finished scenarios" onPress={() => router.push({ pathname: "/history", params: { kind: "campaign" } })} />
            {saves.length > 0 ? (
              <TextButton
                label={managing ? "Done" : "Manage"}
                testID="manage-playthroughs"
                tone="muted"
                accessibilityLabel={managing ? "Done managing playthroughs" : "Manage playthroughs"}
                onPress={toggleManage}
              />
            ) : null}
          </View>
        </View>
        <View className="gap-3">
          {current ? (
            // Folded, the header says the next step: the Continue card's primary button is hidden with it.
            <FoldSection id="current" title="Current playthrough" count={1} unit="playthrough" summary={nextSummary(lineOf(current).next)} {...fold("current")}>
              <View className="pt-1">{managing ? managed(current, 0) : continuing(current)}</View>
            </FoldSection>
          ) : null}
          {others.length > 0 ? (
            <FoldSection id="others" title="Other journeys" count={others.length} unit="journey" {...fold("others")}>
              <View className="gap-3 pt-1">
                {others.map((save, index) =>
                  managing ? (
                    managed(save, index + 1)
                  ) : (
                    <View key={save.id}>
                      <SaveRow id={save.id} line={lineOf(save)} lead={partyOf(save)[0] ?? null} onPress={() => openPath(save)} />
                    </View>
                  ),
                )}
              </View>
            </FoldSection>
          ) : null}
          {showStart ? (
            <View
              className={saves.length > 0 ? "mt-2" : undefined}
              onLayout={(event) => {
                startAt.current = event.nativeEvent.layout.y;
                if (starting) scroll.current?.scrollTo({ y: Math.max(0, startAt.current - 8), animated: true });
              }}
            >
              {saves.length > 0 ? (
                <FoldSection
                  id="start"
                  title="New playthrough"
                  {...fold("start")}
                  right={<TextButton label="Cancel" testID="start-cancel" tone="muted" accessibilityLabel="Cancel the new playthrough" onPress={() => setStarting(false)} />}
                >
                  {startPanel}
                </FoldSection>
              ) : (
                startPanel
              )}
            </View>
          ) : null}
          {!showStart && !managing ? (
            <SecondaryButton
              label="New playthrough"
              testID="new-playthrough"
              tone="gold"
              compact
              onPress={() => {
                folds.setFolded("start", false);
                setStarting(true);
              }}
            />
          ) : null}
          {archived.length > 0 ? (
            <View testID="archived-playthroughs">
              <FoldSection id="archived" title="Archived" count={archived.length} unit="playthrough" testID="archived-toggle" {...foldArchived("archived")}>
                <View className="gap-3 pt-1">
                  {archived.map((save) => (
                    <View key={save.id} testID={`archived-${save.id}`}>
                      <Panel unfilled>
                        <SaveSummary line={lineOf(save)} eyebrow={false} archived />
                        {actions(save, { label: "Restore", onPress: () => restore(save) })}
                      </Panel>
                    </View>
                  ))}
                </View>
              </FoldSection>
            </View>
          ) : null}
          {locked.length > 0 ? (
            <View className="mt-2">
              <FoldSection id="coming" title="Coming later" count={locked.length} unit="campaign" {...fold("coming")}>
                <View className="flex-row flex-wrap gap-3 pt-1" testID="locked-campaigns">
                  {locked.map((tile) => (
                    <View
                      key={tile.id}
                      testID={`locked-${tile.id}`}
                      accessible
                      accessibilityLabel={`${tile.name}, ${tile.caption}`}
                      className="min-h-32 min-w-[45%] flex-1 justify-end gap-1 rounded-card px-4 py-4"
                      style={{ borderWidth: 1, borderStyle: "dashed", borderColor: palette.hairline }}
                    >
                      <RingMark size={14} state="locked" />
                      <Text className="mt-2 font-display text-heading text-faint">{tile.name}</Text>
                      <Text className="text-label text-faint">{tile.caption}</Text>
                    </View>
                  ))}
                </View>
              </FoldSection>
            </View>
          ) : null}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
