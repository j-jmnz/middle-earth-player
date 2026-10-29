import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, ScrollView, View } from "react-native";

import { carryOffers } from "../../../campaign/carry-over";
import { campaignPath, nextStep } from "../../../campaign/path";
import type { Save } from "../../../campaign/save";
import { Column, Eyebrow, HubHeader, Panel, PillButton, RingMark, Screen, ScreenScroll, TextButton } from "../../chrome";
import { FoldSection, useFolds } from "../../fold-section";
import { HeroArt } from "../../art";
import { heroFace } from "../../hero-tile";
import { deckFaces } from "../../deck-store";
import { campaignListQueries, lockedTiles } from "../../campaign-list";
import { campaignOf, scenarioNames } from "../../campaign-data";
import { carrySource, carryWords } from "../../carry-words";
import { StartPanel, type CarryChoice, type StartOption } from "../../start-panel";
import { archiveSave, createSave, deleteSave, listArchivedSaves, listSaves, restoreSave, savedAt } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { recordUnclosedRun } from "../../table-session";
import { usePalette } from "../../palette-hook";
import { KeepOrDelete } from "../../keep-or-delete";
import { ContinuePanel, DELETE_SENTENCE, SaveHero, SaveRow, SaveSummary, describe, type PartyHero, type SaveLine } from "../../save-panels";
import { nextStepHref, pathHref } from "../../scenario-links";
import { seatWord } from "../../seats";
import { useSplitColumns } from "../../use-split-columns";
import { SPHERE_TINT } from "../../../play/icon-map";
import { rowSurface } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { useUiScale } from "../../../play/ui-scale";
import { useSizeClass } from "../../../play/use-size-class";
import { Text } from "../../../play/text";

type Seats = 1 | 2;

// The right column of the two-column Campaigns (docs/design-system.md, Tablets).
const SIDE_RANGE = { min: 360, max: 440 };

// The fellowship a playthrough plays: the heroes the campaign log records, else the heroes the last loadout dealt.
function partyCodes(save: Save): string[] {
  const logged = save.log.heroesBySeat.flat();
  if (logged.length > 0) return logged;
  return save.loadout?.seats.flatMap((seat) => seat.heroes) ?? [];
}

export default function CampaignList() {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const { width } = useSizeClass();
  const columns = useSplitColumns(SIDE_RANGE);
  const { size } = columns;
  const router = useRouter();
  // `start=1`: a finished campaign's path sends the player here with the start panel open, to take its carry-over in.
  const { start: startParam } = useLocalSearchParams<{ start?: string }>();
  const { catalog, user } = useDatabases();
  const [saves, setSaves] = useState<Save[]>([]);
  const [pageWidth, setPageWidth] = useState(0);
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
      path,
      score: save.log.score,
    };
  };

  // The carry-over a new playthrough may take in: every finished playthrough, open or archived, that holds cards for the next campaign.
  const offers = useMemo(() => carryOffers([...saves, ...archived], (id) => campaignOf(id)?.scenarios ?? null), [saves, archived]);
  const faces = useMemo(() => deckFaces(catalog, [...saves.flatMap(partyCodes), ...offers.flatMap((offer) => offer.cards.map((card) => card.code))]), [catalog, saves, offers]);
  // The fellowship as the hero words show it: each hero's painting, name and sphere.
  const fellowshipOf = (save: Save) => partyCodes(save).map((code) => heroFace(faces, code));
  const partyOf = (save: Save): PartyHero[] => partyCodes(save).flatMap((code) => {
    const face = faces.get(code);
    if (!face) return [];
    const tint = SPHERE_TINT[face.sphereCode ?? ""];
    return [{ card: { code, imagesrc: face.imagesrc }, name: face.name, tint: tint && tint !== "faint" ? palette[tint] : undefined }];
  });

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
  const startPanel = <StartPanel options={startable} carry={carryChoices} onStart={start} />;
  // Manage shows Archive and Delete on a playthrough instead of opening it.
  const managed = (save: Save, index: number) => (
    <View key={save.id} testID={`save-${save.id}`}>
      <Panel>
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
        primary={!showStart}
        onNext={() => router.push(nextStepHref(save.id, line.next))}
        onPath={() => openPath(save)}
        onLog={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })}
      />
    );
  };

  // The current playthrough opens the page: its campaign and fellowship over the next scenario's scene (HeroArt), and the Continue
  // panel (the road) under them.
  // Managing, it is a summary with Archive and Delete instead.
  const currentBlock = (wide: boolean) =>
    current ? (
      managing ? (
        managed(current, 0)
      ) : (
        <View testID="current-playthrough" style={{ gap: 18 * s }}>
          <SaveHero line={lineOf(current)} heroes={fellowshipOf(current)} />
          <View style={wide ? { maxWidth: 620 * s } : undefined}>{continuing(current)}</View>
        </View>
      )
    ) : null;
  const othersBlock = (grid: boolean) =>
    others.length > 0 ? (
      <View testID="other-journeys" style={{ gap: 10 * s }}>
        <Eyebrow>Other journeys</Eyebrow>
        <View className={grid ? "flex-row flex-wrap" : undefined} style={grid ? { rowGap: 8 * s, marginHorizontal: -4 * s } : { gap: 8 * s }}>
          {others.map((save, index) =>
            managing ? (
              managed(save, index + 1)
            ) : (
              <View key={save.id} style={grid ? { width: "50%", paddingHorizontal: 4 * s } : undefined}>
                <SaveRow id={save.id} line={lineOf(save)} lead={partyOf(save)[0] ?? null} onPress={() => openPath(save)} />
              </View>
            ),
          )}
        </View>
      </View>
    ) : null;
  // Two columns when the window is expanded and there is something to continue (the start panel alone takes a readable column).
  // With Manage on, nothing to start and nothing archived or locked, the right column would be empty: one readable column then.
  const rightColumn = !(managing && archived.length === 0 && locked.length === 0);
  const split = size === "expanded" && saves.length > 0 && rightColumn ? columns.side : null;
  const twoColumns = split != null;
  const startBlock = showStart ? (
    <View
      className={saves.length > 0 && !twoColumns ? "mt-2" : undefined}
      onLayout={(event) => {
        startAt.current = event.nativeEvent.layout.y;
        // In two columns the start panel already heads the right column: nothing to scroll to.
        if (starting && !twoColumns) scroll.current?.scrollTo({ y: Math.max(0, startAt.current - 8), animated: true });
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
  ) : null;
  const newButton =
    !showStart && !managing ? (
      // A quiet word, not a plate: the road's primary is the one filled thing on the page.
      <View className="items-start">
        <TextButton
          label="+ New playthrough"
          testID="new-playthrough"
          tone="accent"
          accessibilityLabel="New playthrough"
          onPress={() => {
            folds.setFolded("start", false);
            setStarting(true);
          }}
        />
      </View>
    ) : null;
  const archivedBlock =
    archived.length > 0 ? (
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
    ) : null;
  const lockedBlock =
    locked.length > 0 ? (
      <View className={twoColumns ? undefined : "mt-2"}>
        <FoldSection id="coming" title="Coming later" count={locked.length} unit="campaign" {...fold("coming")}>
          <View className="flex-row flex-wrap gap-3 pt-1" testID="locked-campaigns">
            {locked.map((tile) => (
              <View
                key={tile.id}
                testID={`locked-${tile.id}`}
                accessible
                accessibilityLabel={`${tile.name}, ${tile.caption}`}
                className="min-h-32 min-w-[45%] flex-1 justify-end gap-1 rounded-card px-4 py-4"
                style={{ ...rowSurface(false, t), opacity: 0.78 }}
              >
                <RingMark size={14} state="locked" />
                <Text className="mt-2 font-display text-heading text-faint">{tile.name}</Text>
                <Text className="text-label text-faint">{tile.caption}</Text>
              </View>
            ))}
          </View>
        </FoldSection>
      </View>
    ) : null;
  // The hero words sit low over the scene: the scene's art fills the top of the page and they start where it begins to fade.
  const heroDrop = current && !managing ? (size === "compact" ? 170 : 330) * s : 0;
  const header = (
    <HubHeader title="Campaigns">
      <PillButton label="History" testID="history-open" accessibilityLabel="History of finished scenarios" onPress={() => router.push({ pathname: "/history", params: { kind: "campaign" } })} />
      {saves.length > 0 ? (
        <PillButton label={managing ? "Done" : "Manage"} testID="manage-playthroughs" accessibilityLabel={managing ? "Done managing playthroughs" : "Manage playthroughs"} onPress={toggleManage} />
      ) : null}
    </HubHeader>
  );
  const page = (
    <>
      {header}
      {twoColumns ? (
        // The journey on the left over its scene, what else there is on the right (docs/design-system.md, Campaigns, tablet landscape).
        <View className="flex-row items-start" style={{ gap: split.gap }} testID="campaign-columns">
          <View className="min-w-0 flex-1" style={{ paddingTop: heroDrop }}>
            {currentBlock(true)}
          </View>
          <View style={{ width: split.side, gap: 16 * s, paddingTop: 24 * s }}>
            {othersBlock(false)}
            {startBlock}
            {newButton}
            {archivedBlock}
            {lockedBlock}
          </View>
        </View>
      ) : (
        <View style={{ gap: 18 * s, paddingTop: heroDrop }}>
          {currentBlock(false)}
          {othersBlock(size === "medium")}
          {startBlock}
          {newButton}
          {archivedBlock}
          {lockedBlock}
        </View>
      )}
    </>
  );

  // The scene of the next scenario: wider than a phone and centred on it; on a tablet in landscape, behind the journey's column.
  const sceneId = current && !managing && lineOf(current).next.kind !== "finished" ? (lineOf(current).next as { node: { id: string } }).node.id : null;
  // In two columns the scene stops at the journey column's right edge, so it never runs under the right column. The scroll's content
  // is centred in the page, so that edge is the page's middle less half the content's width, plus the journey column's width.
  const art = current && !managing ? (
    size === "expanded" && twoColumns ? (
      <>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 0 }} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)} />
        {pageWidth > 0 ? <HeroArt scenarioId={sceneId} width={900 * s} height={760 * s} left={-90 * s} right={pageWidth / 2 - columns.width / 2 + split.main} /> : null}
      </>
    ) : (
      <HeroArt scenarioId={sceneId} width={Math.max(520 * s, width + 120 * s)} height={(size === "compact" ? 540 : 820) * s} />
    )
  ) : null;

  return (
    // Over its scene the page takes the hero backdrop, whose fog stays below the picture (HeroArt draws its own over it).
    <Screen testID="campaign-list" scene={art ? "hero" : "moon"} art={art}>
      {/* An expanded window scrolls in a wide column; the measurer (outside the columns) decides whether it splits, else one readable column. */}
      <ScreenScroll scrollRef={scroll} max={size === "expanded" ? "wide" : "readable"}>
        {size === "expanded" ? <View style={{ height: 0 }} onLayout={columns.measure} /> : null}
        {size === "expanded" && !twoColumns ? <Column>{page}</Column> : page}
      </ScreenScroll>
    </Screen>
  );
}
