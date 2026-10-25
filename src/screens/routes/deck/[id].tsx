import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, usePreventRemove, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";

import {
  BodyText,
  Eyebrow,
  Label,
  ListRow,
  NavBar,
  PaperSheet,
  PrimaryButton,
  RingMark,
  Screen,
  SphereMark,
  TextButton,
  markedSphere,
  sphereWord,
} from "../../chrome";
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
import { deckContentsPhrase, deckCountLine, deckReadiness, deckSections, savedDeckName, startingThreat, type DeckSectionRow } from "../../deck-status";
import { deckFaces, listDecks, readDeck, writeDeck } from "../../deck-store";
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
  name: string;
  typeCode: string | null;
  imagesrc: string | null;
  deckLimit: number | null;
  sphereCode: string | null;
  sphereName: string | null;
};

type EditorRow = DeckSectionRow<EditorCard>;

const viewabilityConfig = { itemVisiblePercentThreshold: 10 };
const thumb = { width: 28, height: 38 };

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
}: {
  card: EditorCard;
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
      detail={sphereWord(card.sphereName)}
      detailIcons={mark ? <SphereMark sphere={mark} size={12} /> : null}
      leading={<CardThumb code={card.code} imagesrc={card.imagesrc} width={thumb.width} height={thumb.height} />}
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
  const draft = useDeckDraft();
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

  const rows = deckSections<EditorCard>(
    draft.cards.map((card) => {
      const face = faces.get(card.code);
      return {
        code: card.code,
        count: card.count,
        name: face?.name ?? card.code,
        typeCode: face?.typeCode ?? null,
        imagesrc: face?.imagesrc ?? null,
        deckLimit: face?.deckLimit ?? null,
        sphereCode: face?.sphereCode ?? null,
        sphereName: face?.sphereName ?? null,
      };
    }),
  );
  const readiness = deckReadiness(draft, faces);
  const threat = startingThreat(draft.heroes, faces);
  const heroes: HeroFace[] = draft.heroes.map((code) => heroFace(faces, code));
  const emptySlots = Math.max(0, 3 - heroes.length);
  const baseTile = Math.max(120, Math.min(Math.round(height / 4), 200));
  const tileHeight = heroes.length > 3 ? Math.max(96, Math.round(baseTile * 0.6)) : baseTile;

  function addHero(): void {
    router.push({ pathname: "/pool", params: { adding: "1", type: "hero" } });
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

  const header = (
    <View>
      <View className={heroes.length > 3 ? "mt-2 flex-row flex-wrap justify-between" : "mt-2 flex-row gap-2"}>
        {heroes.map((hero) => (
          <View key={hero.code} style={heroes.length > 3 ? { width: "48%", height: tileHeight, marginBottom: 8 } : { flex: 1 }}>
            <HeroTile
              hero={hero}
              height={tileHeight}
              onPress={() => router.push({ pathname: "/card/[code]", params: { code: hero.code } })}
              onLongPress={(source) => preview.open(hero.code, hero.name, source)}
              onRemove={() => announceDraftChange(removeDraftHero(hero.code, hero.name))}
            />
          </View>
        ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <View key={`empty-${index}`} className="flex-1">
            <EmptyHeroSlot height={tileHeight} testID={index === 0 ? "deck-add-hero" : `deck-add-hero-${index}`} onPress={addHero} />
          </View>
        ))}
      </View>
      <TextInput
        testID="deck-name"
        value={draft.name}
        onChangeText={setDeckName}
        placeholder="Name this deck"
        placeholderTextColor={palette.faint}
        accessibilityLabel="Deck name"
        selectTextOnFocus
        returnKeyType="done"
        className="mt-4 border-b border-hairline pb-1 font-display text-title text-bone"
        style={{ minHeight: 44 }}
      />
      <Label testID="deck-count" className="mt-2">
        {threat == null ? deckCountLine(draft) : `${deckCountLine(draft)} · Starting threat ${threat}`}
      </Label>
      <View className="mt-1 flex-row items-center gap-1.5">
        <RingMark size={10} state={readiness.ready ? "done" : "locked"} />
        <Text testID={readiness.ready ? "deck-ready" : "deck-error"} className={`text-label ${readiness.ready ? "text-gold" : "text-danger"}`}>
          {readiness.ready ? readiness.text : `Not ready to play: ${readiness.text}`}
        </Text>
      </View>
      {draft.droppedNote ? (
        <BodyText testID="deck-import-dropped" tone="muted" className="mt-2">
          {draft.droppedNote}
        </BodyText>
      ) : null}
    </View>
  );

  return (
    <Screen testID="deck-editor" scene="plain">
      <View className="min-h-0 flex-1">
        <NavBar
          backLabel="Decks"
          backTestID="deck-back"
          onBack={() => goBack(router, "/decks")}
          right={dirty ? <Label testID="deck-unsaved">Unsaved changes</Label> : null}
        />
        <View className="min-h-0 flex-1">
          <FlashList
            data={rows}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.kind}
            style={{ flex: 1 }}
            extraData={draft}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={header}
            ListEmptyComponent={
              <BodyText testID="deck-empty" tone="muted" className="mt-6">
                No cards yet. Tap Add cards to pick allies, attachments and events from the full player pool.
              </BodyText>
            }
            ListFooterComponent={<View className="h-6" />}
            renderItem={({ item }) =>
              item.kind === "type" ? (
                <View accessibilityRole="header" className="pb-1 pt-5">
                  <Eyebrow tone="muted">{`${item.title} · ${item.count}`}</Eyebrow>
                </View>
              ) : (
                <EditorCardRow
                  card={item.card}
                  full={draftAddRefused(draft, { code: item.card.code, name: item.card.name, typeCode: item.card.typeCode ?? "", deckLimit: item.card.deckLimit }, lookup)}
                  lookup={lookup}
                  onPreview={preview.open}
                />
              )
            }
          />
        </View>
        <ToastView />
        <View className="flex-row items-center gap-2 pb-safe pt-2">
          <TextButton testID="deck-add" label="Add cards" tone="gold" onPress={() => router.push({ pathname: "/pool", params: { adding: "1" } })} />
          <View className="flex-1">
            <PrimaryButton testID="deck-save" label="Save" onPress={onSave} />
          </View>
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
