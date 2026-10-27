import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, usePreventRemove, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ActionBar,
  BodyText,
  Chip,
  Eyebrow,
  Label,
  ListRow,
  NavBar,
  PaperSheet,
  PrimaryButton,
  ProgressBar,
  Screen,
  SecondaryButton,
  SphereMark,
  StatTile,
  TextButton,
  ToggleChip,
  markedSphere,
  sphereWord,
} from "../../chrome";
import { CroppedArt } from "../../art";
import { PAINTING } from "../../art-crop";
import { nightFade, panelSurface, raisedEdge, topShade } from "../../../play/surfaces";
import {
  announceDraftChange,
  changeDraftCount,
  discardDraftChanges,
  draftAddRefused,
  draftIsDirty,
  editSavedDeck,
  getDeckDraft,
  markDraftSaved,
  NEW_DECK_ID,
  removeDraftHero,
  setDeckName,
  startNewDeck,
  useDeckDraft,
  type TitleLookup,
} from "../../deck-draft";
import { costCurve, CURVE_LABELS, deckCardCount, deckContentsPhrase, deckCountLine, deckReadiness, deckSections, DECK_MINIMUM, notAppliedLine, savedDeckName, sphereSplit, startingThreat, type DeckSectionRow } from "../../deck-status";
import { deckFaces, isStarterDeck, listDecks, notAppliedIn, readDeck, writeDeck } from "../../deck-store";
import { notAppliedWords } from "../../../play/not-applied";
import { STARTER_NOTE } from "../../starter-decks";
import { CountStepper } from "../../count-stepper";
import { useDatabases } from "../../databases";
import { enqueueImageDownloads } from "../../images/queue";
import { CardThumb, useCardPreview } from "../../images/picture";
import { useListPreview } from "../../list-preview";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { EmptyHeroSlot, HeroTile, heroFace, type HeroFace } from "../../hero-tile";
import { showToast } from "../../toast";
import { ToastView } from "../../toast-view";
import { goBack } from "../../go-back";
import type { PictureSource } from "../../../play/table-canvas-types";

type EditorCard = {
  code: string;
  count: number;
  cost: string | null;
  name: string;
  typeCode: string | null;
  imagesrc: string | null;
  deckLimit: number | null;
  sphereCode: string | null;
  sphereName: string | null;
};

// The editor's list: Heroes first (its heading, then the hero pictures and empty slots), then the card subsections.
type EditorRow = DeckSectionRow<EditorCard> | { kind: "heroes"; key: string };

const TYPE_NOUN: Readonly<Record<string, string>> = { hero: "heroes", ally: "allies", attachment: "attachments", event: "events" };

const viewabilityConfig = { itemVisiblePercentThreshold: 10 };
const thumb = { width: 30, height: 42 };
const BANNER_HEIGHT = 196;

function onViewableItemsChanged({ viewableItems }: { viewableItems: { item: EditorRow | null }[] }): void {
  const jobs = [];
  for (const token of viewableItems) {
    const item = token.item;
    if (item?.kind !== "card" || !item.card.imagesrc) continue;
    jobs.push({ code: item.card.code, imagesrc: item.card.imagesrc });
  }
  if (jobs.length > 0) enqueueImageDownloads(jobs);
}

function EditorCardRow({
  card,
  full,
  lookup,
  onPreview,
  loss = null,
}: {
  card: EditorCard;
  // What the app does not apply of this card ("Ability not applied"), or null.
  loss?: string | null;
  // Whether + would be refused: the title (any printing) is at its copy limit.
  full: boolean;
  lookup: TitleLookup;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const router = useRouter();
  const picture = useCardPreview(card.code, card.imagesrc);
  const mark = markedSphere(card.sphereCode);
  return (
    <ListRow
      testID={`deck-card-${card.code}`}
      label={card.name}
      detail={loss ? `${sphereWord(card.sphereName)} · ${loss}` : sphereWord(card.sphereName)}
      detailIcons={mark ? <SphereMark sphere={mark} size={12} /> : null}
      leading={
        <View className="flex-row items-center gap-2.5">
          {/* The printed cost on a dark coin, so the eye runs down the costs as it does on a played deck list. */}
          <View accessible={false} importantForAccessibility="no" className="h-7 w-7 items-center justify-center rounded-pill" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.hairline }}>
            <Text className="font-display-bold text-label text-bone">{card.cost ?? "–"}</Text>
          </View>
          <CardThumb code={card.code} imagesrc={card.imagesrc} width={thumb.width} height={thumb.height} />
        </View>
      }
      onPress={() => router.push({ pathname: "/card/[code]", params: { code: card.code } })}
      onLongPress={() => onPreview(card.code, card.name, picture)}
      trailing={
        <CountStepper
          code={card.code}
          name={card.name}
          count={card.count}
          full={full}
          onChange={(delta) => announceDraftChange(changeDraftCount(card.code, card.name, card.deckLimit, delta, lookup))}
        />
      }
    />
  );
}

export default function DeckEditor() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeCode(params.id);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const draft = useDeckDraft();
  const list = useRef<{ scrollToIndex: (params: { index: number; animated?: boolean; viewOffset?: number }) => void } | null>(null);
  const { catalog, user } = useDatabases();
  const preview = useListPreview();
  // The navigation Back, a swipe or Save as asked to finish while the deck has unsaved changes.
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const dirty = draftIsDirty(draft);
  const release = usePreventRemove(dirty, ({ repeat }) => setLeaving(() => repeat));

  // A deck opened from a link, or a relaunch on this route: read it from user.db. The list and the import screen fill the
  // draft before they open this screen.
  useEffect(() => {
    if (!id || getDeckDraft().id === id) return;
    const row = id === NEW_DECK_ID ? null : readDeck(user, id);
    if (row) editSavedDeck(row);
    else startNewDeck();
  }, [id, user]);

  const codeKey = [...draft.heroes, ...draft.cards.map((card) => card.code)].join("\0");
  const faces = useMemo(() => deckFaces(catalog, codeKey.length === 0 ? [] : codeKey.split("\0")), [catalog, codeKey]);
  const lookup = useCallback<TitleLookup>((code) => faces.get(code), [faces]);

  const sections = deckSections<EditorCard>(
    draft.cards.map((card) => {
      const face = faces.get(card.code);
      return {
        code: card.code,
        count: card.count,
        cost: face?.cost ?? null,
        name: face?.name ?? card.code,
        typeCode: face?.typeCode ?? null,
        imagesrc: face?.imagesrc ?? null,
        deckLimit: face?.deckLimit ?? null,
        sphereCode: face?.sphereCode ?? null,
        sphereName: face?.sphereName ?? null,
      };
    }),
  );
  const rows: EditorRow[] = [
    { kind: "type", key: "type-hero", type: "hero", title: "Heroes", count: draft.heroes.length },
    { kind: "heroes", key: "heroes" },
    ...sections,
  ];
  const readiness = deckReadiness(draft, faces);
  // The cards whose printed text the app does not apply: a line under the readiness, and the loss on each row.
  const inactive = useMemo(() => notAppliedIn(faces), [faces]);
  const notApplied = notAppliedLine(draft, inactive);
  const threat = startingThreat(draft.heroes, faces);
  const heroes: HeroFace[] = draft.heroes.map((code) => heroFace(faces, code));
  const emptySlots = Math.max(0, 3 - heroes.length);
  const baseTile = Math.max(120, Math.min(Math.round(height / 4), 200));
  const tileHeight = heroes.length > 3 ? Math.max(96, Math.round(baseTile * 0.6)) : baseTile;

  // The pool, adding to this deck, on one type: an empty hero slot opens it on heroes, a subsection's Add on its type.
  function addOfType(type: string): void {
    router.push({ pathname: "/pool", params: { adding: "1", type } });
  }

  // Writes the deck as it stands, ready to play or not, and says so.
  function save(): void {
    const current = getDeckDraft();
    const others = listDecks(user).filter((deck) => deck.id !== current.id).map((deck) => deck.name);
    const name = savedDeckName(current.name, others);
    const savedId = writeDeck(user, { id: current.id === NEW_DECK_ID ? null : current.id, name, heroes: current.heroes, cards: current.cards });
    markDraftSaved(savedId, name);
    showToast(`Saved ${name}`, { carry: true });
  }

  function onSave(): void {
    if (dirty || !draft.saved) save();
    release();
    goBack(router, "/decks");
  }

  function finishLeaving(keep: "save" | "discard"): void {
    const go = leaving;
    if (keep === "save") save();
    else discardDraftChanges();
    setLeaving(null);
    go?.();
  }

  if (!id) throw new Error("Missing route code");

  const heroStrip = (
      <View className={heroes.length > 3 ? "mt-1 flex-row flex-wrap justify-between" : "mt-1 flex-row gap-2"}>
        {heroes.map((hero) => (
          <View key={hero.code} style={heroes.length > 3 ? { width: "48%", height: tileHeight, marginBottom: 8 } : { flex: 1 }}>
            <HeroTile
              hero={hero}
              height={tileHeight}
              onPress={() => router.push({ pathname: "/card/[code]", params: { code: hero.code } })}
              onLongPress={(source) => preview.open(hero.code, hero.name, source)}
              onRemove={() => announceDraftChange(removeDraftHero(hero.code, hero.name))}
              loss={inactive.has(hero.code) ? notAppliedWords(hero.code, "hero") : null}
            />
          </View>
        ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <View key={`empty-${index}`} className="flex-1">
            <EmptyHeroSlot height={tileHeight} testID={index === 0 ? "deck-add-hero" : `deck-add-hero-${index}`} onPress={() => addOfType("hero")} />
          </View>
        ))}
      </View>
  );

  const cardCount = deckCardCount(draft.cards);
  const curve = costCurve(draft.cards, faces);
  const curveTop = Math.max(1, ...curve.counts);
  const split = sphereSplit(draft.cards, faces);
  const splitTotal = split.reduce((sum, entry) => sum + entry.count, 0);
  const heroSpheres = [...new Set(heroes.map((hero) => markedSphere(hero.sphereCode)).filter((mark) => mark != null))];
  // The headings the jump chips lead to, with the row each starts at.
  const jumps = rows.flatMap((row, index) => (row.kind === "type" ? [{ key: row.key, title: row.title, count: row.type === "hero" ? heroes.length : row.count, index }] : []));
  const side = { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right };

  const header = (
    <View>
      {/* The heroes' paintings side by side, the deck's name over them: the deck at a glance. */}
      <View style={{ height: BANNER_HEIGHT + insets.top, flexDirection: "row", gap: 1, backgroundColor: palette.night }}>
        {heroes.length > 0 ? (
          heroes.slice(0, 4).map((hero) => (
            <View key={hero.code} className="flex-1">
              <CroppedArt card={hero} region={PAINTING} height={BANNER_HEIGHT + insets.top} />
            </View>
          ))
        ) : (
          <View className="flex-1" style={panelSurface()} />
        )}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...topShade(0.35) }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(0.3, 1) }} />
      </View>
      <View style={{ ...side, marginTop: -64 }}>
        <Eyebrow testID={readiness.ready ? "deck-ready" : "deck-error"} tone={readiness.ready ? "gold" : "muted"}>
          {readiness.ready ? readiness.text : `Not ready to play: ${readiness.text}`}
        </Eyebrow>
        <TextInput
          testID="deck-name"
          value={draft.name}
          onChangeText={setDeckName}
          placeholder="Name this deck"
          placeholderTextColor={palette.faint}
          accessibilityLabel="Deck name"
          selectTextOnFocus
          returnKeyType="done"
          className="mt-1 border-b border-hairline pb-1 font-display text-title text-bone"
          style={{ minHeight: 44 }}
        />
        <View className="mt-3 flex-row gap-2">
          <StatTile label="Threat" value={threat == null ? "–" : String(threat)} icon="threat" iconTint="danger" />
          <StatTile label="Cards" value={String(cardCount)} detail={`/ ${DECK_MINIMUM}`}>
            <View className="mt-1.5">
              <ProgressBar value={cardCount} max={DECK_MINIMUM} />
            </View>
          </StatTile>
          <View className="flex-1 rounded-tile px-3 py-2.5" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.hairline, boxShadow: raisedEdge }} accessible accessibilityLabel={`Spheres: ${split.map((entry) => `${sphereWord(entry.name)} ${entry.count}`).join(", ") || "none yet"}`}>
            <Text className="text-label text-muted">Spheres</Text>
            <View className="mt-1 h-5 flex-row items-center gap-1.5">
              {heroSpheres.map((mark) => (
                <SphereMark key={mark} sphere={mark} size={14} />
              ))}
            </View>
            <View className="mt-1.5 h-1 flex-row gap-0.5 overflow-hidden rounded-pill" style={{ backgroundColor: palette.hairline }}>
              {split.map((entry) => (
                <View key={entry.code} style={{ flex: entry.count / Math.max(1, splitTotal), backgroundColor: (palette as Record<string, string>)[entry.code] ?? palette.faint }} />
              ))}
            </View>
          </View>
        </View>
        {/* The cost curve: the copies at each cost, so the deck's shape reads before its rows. */}
        <View className="mt-2 rounded-tile px-3.5 py-2.5" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.hairline, boxShadow: raisedEdge }} accessible accessibilityLabel={`Cost curve: ${CURVE_LABELS.map((label, at) => `${curve.counts[at]} at cost ${label}`).join(", ")}${curve.average != null ? `, average ${curve.average}` : ""}`}>
          <View className="flex-row justify-between">
            <Text className="text-label text-muted">Cost curve</Text>
            {curve.average != null ? <Text className="text-label text-muted">{`average ${curve.average}`}</Text> : null}
          </View>
          <View className="mt-2 h-14 flex-row items-end gap-1.5">
            {CURVE_LABELS.map((label, at) => (
              <View key={label} className="flex-1 items-center justify-end gap-1" style={{ height: "100%" }}>
                <View className="w-full rounded-t" style={{ height: Math.max(2, Math.round((curve.counts[at] / curveTop) * 34)), backgroundColor: curve.counts[at] > 0 ? palette.goldDeep : palette.hairline }} />
                <Text className="text-micro text-faint">{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Label testID="deck-count" className="mt-3">
          {threat == null ? deckCountLine(draft) : `${deckCountLine(draft)} · Starting threat ${threat}`}
        </Label>
        {notApplied ? (
          <Label testID="deck-not-applied" tone="muted" className="mt-1">
            {`${notApplied}. Each row says what the app leaves out.`}
          </Label>
        ) : null}
        {draft.droppedNote ? (
          <BodyText testID="deck-import-dropped" tone="muted" className="mt-2">
            {draft.droppedNote}
          </BodyText>
        ) : null}
        {isStarterDeck(draft.id) ? (
          <Label testID="starter-note" className="mt-2">
            {STARTER_NOTE}
          </Label>
        ) : null}
        {/* Jump to a heading: the deck stays one list (every row reachable by scrolling), and these shorten the trip. */}
        <View className="mt-2 flex-row flex-wrap gap-x-1.5">
          {jumps.map((jump) => (
            <ToggleChip key={jump.key} testID={`deck-jump-${jump.key}`} label={`${jump.title} ${jump.count}`} selected={false} accessibilityLabel={`Go to ${jump.title}, ${jump.count}`} onPress={() => list.current?.scrollToIndex({ index: jump.index, animated: true, viewOffset: 8 })} />
          ))}
        </View>
      </View>
    </View>
  );

  function renderRow({ item }: { item: EditorRow }) {
    if (item.kind === "heroes") return heroStrip;
    if (item.kind === "type") {
      // Heroes add through their empty slots, so only the card subsections carry Add.
      const heroSection = item.type === "hero";
      return (
        <View accessibilityRole="header" className="min-h-11 flex-row items-center justify-between pt-5">
          <View className="flex-row items-center gap-2.5">
            <Eyebrow tone="moon">{item.title}</Eyebrow>
            <Chip testID={`deck-section-count-${item.type}`} label={heroSection ? `${item.count} of 3` : String(item.count)} />
          </View>
          {!heroSection && TYPE_NOUN[item.type] ? (
            <View className="-mr-3">
              <TextButton
                testID={`deck-add-${item.type}`}
                label="Add"
                tone="gold"
                accessibilityLabel={`Add ${TYPE_NOUN[item.type]}`}
                onPress={() => addOfType(item.type)}
              />
            </View>
          ) : null}
        </View>
      );
    }
    if (item.kind === "empty") {
      return (
        <Text testID={`deck-empty-${item.type}`} className="border-b border-hairline pb-3 text-label text-faint">
          {`No ${TYPE_NOUN[item.type] ?? item.title.toLowerCase()} yet.`}
        </Text>
      );
    }
    return (
      <EditorCardRow
        card={item.card}
        full={draftAddRefused(draft, { code: item.card.code, name: item.card.name, typeCode: item.card.typeCode ?? "", deckLimit: item.card.deckLimit }, lookup)}
        lookup={lookup}
        onPreview={preview.open}
        loss={inactive.has(item.card.code) ? notAppliedWords(item.card.code, item.card.typeCode) : null}
      />
    );
  }

  return (
    <Screen testID="deck-editor" scene="plain" bleed>
      <View className="min-h-0 flex-1">
        <View className="min-h-0 flex-1">
          <FlashList
            ref={list as never}
            data={rows}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.kind}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            extraData={draft}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={header}
            renderItem={(info) => <View style={side}>{renderRow(info)}</View>}
          />
        </View>
        <View style={side}>
          <ToastView />
          <ActionBar>
            <View className="flex-row items-center gap-2.5">
              <View className="flex-1">
                <SecondaryButton testID="deck-add" label="Add cards" tone="gold" onPress={() => router.push({ pathname: "/pool", params: { adding: "1" } })} />
              </View>
              <View className="flex-1">
                <PrimaryButton testID="deck-save" label="Save" onPress={onSave} />
              </View>
            </View>
          </ActionBar>
        </View>
        {/* Back floats over the heroes' paintings and stays in reach as the list scrolls. */}
        <View className="absolute left-0 right-0" style={{ top: insets.top, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }}>
          <NavBar overlay backLabel="Decks" backTestID="deck-back" onBack={() => goBack(router, "/decks")} right={dirty ? <Chip testID="deck-unsaved" label="Unsaved changes" onArt /> : null} />
        </View>
      </View>
      <Modal visible={leaving !== null} transparent animationType="fade" onRequestClose={() => setLeaving(null)}>
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityLabel="Keep editing"
            onPress={() => setLeaving(null)}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.night, opacity: 0.72 }}
          />
          <PaperSheet step={draft.saved ? "Unsaved changes" : "Not saved yet"} title={draft.name.trim() || "New deck"}>
            <Text className="text-body text-ink">
              {[
                draft.saved
                  ? "Save your changes before you leave?"
                  : `This deck has not been saved. Discard throws away its ${deckContentsPhrase(draft)}.`,
                readiness.ready ? null : `It is not ready to play yet (${readiness.text.replace(/\.$/, "")}); you can save it and finish it later.`,
              ]
                .filter((line) => line)
                .join(" ")}
            </Text>
            <View className="mt-5">
              <PrimaryButton testID="leave-save" label="Save" surface="paper" onPress={() => finishLeaving("save")} />
              <View className="mt-2 flex-row justify-center">
                <TextButton testID="leave-discard" label={draft.saved ? "Discard changes" : "Discard deck"} tone="ink" onPress={() => finishLeaving("discard")} />
                <TextButton testID="leave-keep" label="Keep editing" tone="ink" onPress={() => setLeaving(null)} />
              </View>
            </View>
          </PaperSheet>
        </View>
      </Modal>
      {preview.overlay}
    </Screen>
  );
}

