import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams, usePreventRemove, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionBar, Chip, FloatingBarShade, NavBar, PaperSheet, PrimaryButton, Screen, SecondaryButton, TextButton, TwoPane } from "../../kit/chrome";
import { CardPoolBody, type PoolTypeRequest } from "../../pool/card-pool";
import { BANNER_HEIGHT, DeckGlance } from "../../deck/glance";
import { DeckCardCell, DeckSectionHeader, gridRows, JumpChips, refusedCodes, refusedKey, sideRows, TYPE_NOUN, type EditorCard, type EditorRow, type Jump } from "../../deck/grid";
import { announceDraftChange, discardDraftChanges, draftIsDirty, editSavedDeck, getDeckDraft, markDraftSaved, NEW_DECK_ID, removeDraftHero, setDeckName, setDraftTarget, startNewDeck, useDeckDraft, type DraftCard, type DraftPile, type TitleLookup } from "../../deck/draft";
import { deckContentsPhrase, deckCountLine, deckLootRule, deckReadiness, deckSections, notAppliedLine, savedDeckName, sideDeckNote, startingThreat, type DeckFace } from "../../deck/status";
import { deckFaces, isStarterDeck, listDecks, notAppliedIn, readDeck, writeDeck } from "../../deck/store";
import { notAppliedWords } from "../../../play/cards/not-applied";
import { STARTER_NOTE } from "../../deck/starter-decks";
import { useDatabases } from "../../data/databases";
import { enqueueImageDownloads } from "../../images/queue";
import { useListPreview } from "../../pool/list-preview";
import { routeCode } from "../../nav/route-code";
import { EmptyHeroSlot, HeroTile, heroFace, Readiness, type HeroFace } from "../../art/hero-tile";
import { SheetModal } from "../../kit/sheet-modal";
import { showToast } from "../../kit/toast";
import { ToastView } from "../../kit/toast-view";
import { goBack } from "../../nav/go-back";
import { MEDIUM_ACTION_GROUP } from "../../../ui/size-class";
import { useUiScale } from "../../../ui/ui-scale";
import { useSizeClass } from "../../../ui/use-size-class";
import { Text } from "../../../ui/text";
import { useTopInset } from "../../nav/use-top-inset";

const viewabilityConfig = { itemVisiblePercentThreshold: 10 };
// The deck's head in an expanded window, in Medium's points (docs/design-system.md, Deck builder); its cards take the rest.
const DECK_SIDE_RANGE = { min: 360, max: 420 };

// The deck's or the side deck's cards with what the catalog says of each.
function editorCardsOf(cards: readonly DraftCard[], faces: ReadonlyMap<string, DeckFace>, pile: DraftPile): EditorCard[] {
  return cards.map((card) => {
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
      pile,
    };
  });
}

function onViewableItemsChanged({ viewableItems }: { viewableItems: { item: EditorRow | null }[] }): void {
  const jobs = [];
  for (const token of viewableItems) {
    const item = token.item;
    if (item?.kind !== "grid") continue;
    for (const card of item.cards) if (card.imagesrc) jobs.push({ code: card.code, imagesrc: card.imagesrc });
  }
  if (jobs.length > 0) enqueueImageDownloads(jobs);
}

export default function DeckEditor() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeCode(params.id);
  const { size, width: windowWidth } = useSizeClass();
  const expanded = size === "expanded";
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const s = useUiScale();
  const draft = useDeckDraft();
  const list = useRef<FlashListRef<EditorRow>>(null);
  const { catalog, user } = useDatabases();
  const preview = useListPreview();
  // The navigation Back, a swipe or Save as asked to finish while the deck has unsaved changes.
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  // Past the fan, a dark band shows behind Back so it never sits on a card.
  const [past, setPast] = useState(false);
  // Landscape: the cards pane's measured width, and whether it shows the pool (Add cards) instead of the deck's cards.
  const [gridWidth, setGridWidth] = useState(0);
  const [adding, setAdding] = useState(false);
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

  const codeKey = [...draft.heroes, ...draft.cards.map((card) => card.code), ...draft.side.map((card) => card.code)].join("\0");
  const faces = useMemo(() => deckFaces(catalog, codeKey.length === 0 ? [] : codeKey.split("\0")), [catalog, codeKey]);
  const lookup = useCallback<TitleLookup>((code) => faces.get(code), [faces]);

  // The deck's and the side deck's cards with what the catalog says of each, rebuilt only when the cards or the faces change (not for
  // each key of the name).
  const editorCards = useMemo(() => editorCardsOf(draft.cards, faces, "deck"), [draft.cards, faces]);
  const sideCards = useMemo(() => editorCardsOf(draft.side, faces, "side"), [draft.side, faces]);
  const sections = deckSections<EditorCard>(editorCards);
  // Which cards' + is refused, once per change of the heroes or the cards: the grid's cells are not asked one by one on each render.
  const refused = useMemo(
    () => refusedCodes({ heroes: draft.heroes, cards: draft.cards, side: draft.side }, [...editorCards, ...sideCards], lookup),
    [draft.heroes, draft.cards, draft.side, editorCards, sideCards, lookup],
  );
  // The loot deck the deck's contract takes from the side deck (The Burglar's Turn), read once per change of the cards.
  const loot = useMemo(() => deckLootRule(draft.cards), [draft.cards]);
  // A phone holds three cards a row (each wide enough for its stepper), a tablet in portrait six, the deck's pane in landscape five.
  const cols = size === "compact" ? 3 : size === "medium" ? 6 : 5;
  const rows: EditorRow[] = [
    { kind: "type", key: "type-hero", type: "hero", title: "Heroes", count: draft.heroes.length },
    { kind: "heroes", key: "heroes" },
    ...gridRows(sections, cols),
    ...sideRows(sideCards, cols, sideDeckNote(loot, draft.side, faces)),
  ];
  const readiness = deckReadiness(draft, faces);
  // The cards whose printed text the app does not apply: a line under the readiness, and the loss on each row.
  const inactive = useMemo(() => notAppliedIn(faces), [faces]);
  const notApplied = notAppliedLine(draft, inactive);
  const threat = startingThreat(draft.heroes, faces);
  const heroes: HeroFace[] = draft.heroes.map((code) => heroFace(faces, code));
  const emptySlots = Math.max(0, 3 - heroes.length);

  // The pool, adding to this deck, on one type: an empty hero slot opens it on heroes, a subsection's Add on its type. The side deck's
  // Add opens it on every type, adding to the side deck. Expanded, the pool is already on screen beside the deck, so the request
  // sets its type chips (null: all) instead of pushing a route.
  const [typeRequest, setTypeRequest] = useState<PoolTypeRequest | null>(null);
  function addOfType(asked: string | null): void {
    setDraftTarget(asked === "side" ? "side" : "deck");
    const type = asked === "side" ? null : asked;
    if (expanded) {
      setAdding(true);
      setTypeRequest({ type });
    }
    else router.push({ pathname: "/pool", params: type ? { adding: "1", type } : { adding: "1" } });
  }

  // Writes the deck as it stands, ready to play or not, and says so.
  function save(): void {
    const current = getDeckDraft();
    const others = listDecks(user).filter((deck) => deck.id !== current.id).map((deck) => deck.name);
    const name = savedDeckName(current.name, others);
    const savedId = writeDeck(user, { id: current.id === NEW_DECK_ID ? null : current.id, name, heroes: current.heroes, cards: current.cards, side: current.side });
    markDraftSaved(savedId, name);
    showToast(`Saved ${name}`, { carry: true });
  }

  // Save is disabled while there is nothing to save: a saved deck as user.db has it, or a new deck with no hero or card.
  function onSave(): void {
    if (!dirty) return;
    save();
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

  // The grid's cells share the list's width: the screen's on a phone and in portrait, the cards pane's beside the deck in landscape.
  const cellGap = (size === "compact" ? 10 : 14) * s;
  const listWidth = expanded ? gridWidth : windowWidth - (24 * s + insets.left) - (24 * s + insets.right) - 2 * (size === "medium" ? 8 * s : 0);
  const cellWidth = Math.max(60, Math.floor((listWidth - cellGap * (cols - 1)) / cols));

  // The hero cards at the head of the list, each with its remove ×, and an empty slot for each hero still to add.
  const heroStrip = (
    <View className="flex-row flex-wrap" style={{ gap: cellGap }}>
      {heroes.map((hero) => (
        <View key={hero.code} style={{ width: cellWidth, height: Math.round(cellWidth * 1.4), marginBottom: 12 * s }}>
          <HeroTile
            hero={hero}
            height={Math.round(cellWidth * 1.4)}
            card={cellWidth}
            onPress={() => router.push({ pathname: "/card/[code]", params: { code: hero.code } })}
            onLongPress={(source) => preview.open(hero.code, hero.name, source)}
            onRemove={() => announceDraftChange(removeDraftHero(hero.code, hero.name))}
            loss={inactive.has(hero.code) ? notAppliedWords(hero.code, "hero") : null}
          />
        </View>
      ))}
      {Array.from({ length: emptySlots }, (_, index) => (
        <View key={`empty-${index}`} style={{ width: cellWidth, marginBottom: 12 * s }}>
          <EmptyHeroSlot height={Math.round(cellWidth * 1.4)} testID={index === 0 ? "deck-add-hero" : `deck-add-hero-${index}`} onPress={() => addOfType("hero")} />
        </View>
      ))}
    </View>
  );

  // The headings the jump chips lead to, with the row each starts at.
  const jumps: Jump[] = rows.flatMap((row, index) => (row.kind === "type" ? [{ key: row.key, title: row.title, count: row.type === "hero" ? heroes.length : row.count, index }] : []));
  // The page's side padding. Compact is the phone's. Medium keeps the rows (and the glance's words) in a reading column; expanded,
  // the deck is the left pane: it starts at the screen's edge and its rows stop 24 short of the pane's edge, in line with the bar's buttons.
  const base = { paddingLeft: 24 * s + insets.left, paddingRight: 24 * s + insets.right };
  const gutter = size === "medium" ? 8 * s : 0;
  const side = expanded ? { paddingLeft: 24 * s + insets.left, paddingRight: 24 * s } : { paddingLeft: base.paddingLeft + gutter, paddingRight: base.paddingRight + gutter };
  // FlashList v2 adds viewOffset to the row's offset (FlatList subtracts it): a negative one leaves the heading below the top inset
  // and the floating Back.
  const jumpTo = (jump: Jump) => list.current?.scrollToIndex({ index: jump.index, animated: true, viewOffset: -(top + (56 + 8) * s) });

  const header = (
    <DeckGlance
      heroes={heroes}
      cards={draft.cards}
      faces={faces}
      name={draft.name}
      onName={setDeckName}
      ready={readiness.ready}
      threat={threat}
      countLine={deckCountLine(draft)}
      notApplied={notApplied}
      droppedNote={draft.droppedNote ?? null}
      starterNote={isStarterDeck(draft.id) ? STARTER_NOTE : null}
      jumps={expanded ? [] : jumps}
      onJump={jumpTo}
      top={top}
      side={expanded ? { paddingLeft: 0, paddingRight: 0 } : side}
      wide={size !== "compact"}
    />
  );

  function renderRow({ item }: { item: EditorRow }) {
    if (item.kind === "heroes") return heroStrip;
    if (item.kind === "type") return <DeckSectionHeader type={item.type} title={item.title} count={item.count} onAdd={addOfType} />;
    if (item.kind === "note") {
      return (
        <Text testID={`deck-${item.key}`} className="pb-3 text-label text-muted">
          {item.text}
        </Text>
      );
    }
    if (item.kind === "empty") {
      return (
        <Text testID={`deck-empty-${item.type}`} className="pb-3 text-label text-faint">
          {`No ${TYPE_NOUN[item.type] ?? item.title.toLowerCase()} yet.`}
        </Text>
      );
    }
    return (
      <View className="flex-row" style={{ gap: cellGap }}>
        {item.cards.map((card) => (
          <DeckCardCell
            key={card.code}
            card={card}
            width={cellWidth}
            full={refused.has(refusedKey(card))}
            lookup={lookup}
            onPreview={preview.open}
            loss={inactive.has(card.code) ? notAppliedWords(card.code, card.typeCode) : null}
          />
        ))}
      </View>
    );
  }

  // The deck's cards: the head (the fan, the name and the analytics) then the sections, as one list on a phone and in portrait; in
  // landscape the head is the left pane and this list holds only the sections, in the cards pane.
  const deckList = (withHeader: boolean, pad: { paddingLeft: number; paddingRight: number }) => (
    <FlashList
      ref={list}
      key={`deck:${cols}:${cellWidth}`}
      data={rows}
      keyExtractor={(item) => item.key}
      getItemType={(item) => item.kind}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 * s }}
      extraData={{ cards: draft.cards, heroes: draft.heroes, side: draft.side, refused, cellWidth }}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={64}
      onScroll={(event) => {
        const next = event.nativeEvent.contentOffset.y > (BANNER_HEIGHT - 80) * s;
        if (next !== past) setPast(next);
      }}
      ListHeaderComponent={withHeader ? header : null}
      renderItem={(info) => <View style={pad}>{renderRow(info)}</View>}
    />
  );
  // What the deck still lacks, in danger, beside Save: said once, at the foot of the deck on every size; a ready deck says nothing.
  const status = <Readiness testID="deck-error" status={readiness} lines={2} />;
  // The bar: Add cards (opens the pool) on a phone and in portrait, whether the deck is ready, and Save deck, the one primary.
  const actionBar = (align: "auto" | "fill") => (
    <ActionBar align={align}>
      {align === "fill" ? (
        <View className="flex-row items-center gap-2.5" style={{ paddingLeft: insets.left }}>
          <View className="flex-1">{status}</View>
          <View className="flex-1">
            <PrimaryButton testID="deck-save" label="Save deck" onPress={onSave} disabled={!dirty} />
          </View>
        </View>
      ) : (
        // Whether it is ready over both buttons, which stand on one centre line (Add cards 44 pt, Save deck 52 pt).
        <View className="gap-1.5">
          {status}
          <View className="flex-row items-center gap-2.5">
            <View className="flex-1">
              <SecondaryButton testID="deck-add" label="Add cards" onPress={() => addOfType(null)} />
            </View>
            <View className="flex-1">
              <PrimaryButton testID="deck-save" label="Save deck" onPress={onSave} disabled={!dirty} />
            </View>
          </View>
        </View>
      )}
    </ActionBar>
  );
  // Back floats over the fan and stays in reach as the list scrolls; its shade and padding belong to its pane.
  const navBar = (sidePad: { paddingLeft: number; paddingRight: number }) => (
    <>
      <FloatingBarShade shown={past} top={top} />
      <View pointerEvents="box-none" className="absolute left-0 right-0" style={{ top, ...sidePad }}>
        <NavBar backLabel="Decks" backTestID="deck-back" onBack={() => goBack(router, "/decks")} right={dirty ? <Chip testID="deck-unsaved" label="Unsaved changes" onArt /> : null} />
      </View>
    </>
  );

  return (
    <Screen testID="deck-editor" scene="calm" bleed>
      {expanded ? (
        // Two panes (docs/design-system.md, Deck builder): the deck's head and Save at the left; its cards at the right, under the
        // jump chips and + Add cards, which turns the pane into the pool on the same draft until Done.
        <TwoPane
          kind="list-detail"
          range={DECK_SIDE_RANGE}
          start={
            <>
              <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ paddingLeft: 24 * s + insets.left, paddingRight: 8 * s, paddingBottom: 16 * s }} showsVerticalScrollIndicator={false}>
                {header}
              </ScrollView>
              <View style={{ paddingHorizontal: 24 * s }}>
                <View style={{ paddingLeft: insets.left }}>
                  <ToastView />
                </View>
                {actionBar("fill")}
              </View>
              {navBar({ paddingLeft: 16 * s + insets.left, paddingRight: 16 * s })}
            </>
          }
          end={
            <View className="min-h-0 flex-1" style={{ paddingTop: top + 12 * s, paddingRight: 24 * s + insets.right, paddingBottom: insets.bottom, overflow: "hidden" }}>
              <View className="flex-row items-center" style={{ gap: 8 * s }}>
                <View className="min-w-0 flex-1 flex-row flex-wrap" style={{ columnGap: 6 * s }}>
                  {adding ? null : <JumpChips jumps={jumps} onJump={jumpTo} />}
                </View>
                <SecondaryButton testID="deck-add" label={adding ? "Done" : "+ Add cards"} onPress={() => (adding ? setAdding(false) : addOfType(null))} />
              </View>
              <View
                className="mt-2 min-h-0 flex-1"
                onLayout={(event) => {
                  const next = Math.floor(event.nativeEvent.layout.width);
                  setGridWidth((current) => (current === next ? current : next));
                }}
              >
                {adding ? <CardPoolBody adding startType={typeRequest?.type ?? null} typeRequest={typeRequest} onPreview={preview.open} /> : gridWidth > 0 ? deckList(false, { paddingLeft: 0, paddingRight: 0 }) : null}
              </View>
            </View>
          }
        />
      ) : (
        <View className="min-h-0 flex-1">
          <View className="min-h-0 flex-1">{deckList(true, side)}</View>
          <View style={base}>
            {/* Medium: the toast lines up with the bar's 480 group. */}
            <View style={size === "medium" ? { width: "100%", maxWidth: MEDIUM_ACTION_GROUP * s, alignSelf: "center" } : undefined}>
              <ToastView />
            </View>
            {actionBar("auto")}
          </View>
          {navBar({ paddingLeft: 16 * s + insets.left, paddingRight: 16 * s + insets.right })}
        </View>
      )}
      <SheetModal visible={leaving !== null} onRequestClose={() => setLeaving(null)} scrimLabel="Keep editing">
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
      </SheetModal>
      {preview.overlay}
    </Screen>
  );
}

