import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { View } from "react-native";

import { BodyText, HubHeader, IconButton, PillButton, Screen, TextButton } from "../../kit/chrome";
import { editSavedDeck, startNewDeck } from "../../deck/draft";
import { copyDeckName, deckCountLine, deckReadiness, deckShortLine, newDeckName, notAppliedLine } from "../../deck/status";
import { deckFaces, deleteDeck, duplicateDeck, isStarterDeck, listDecks, notAppliedIn, resetStarterDeck, writeDeckOrder, type SavedDeck } from "../../deck/store";
import { useDatabases } from "../../data/databases";
import { COVER_GAP, deckListFiltered, deckListLayout, deckListSpheres, emptyDeckListFilter, filterDecks, useDeckListView, type DeckListFilter } from "../../deck/list";
import { DeckListBar } from "../../deck/list-bar";
import { moveItem } from "../../deck/order";
import { DeckCell, LiftedRowProvider, ReorderItem, useDeckReorder } from "../../deck/reorder";
import { DeckCover, DeckRow, heroFace, type HeroFace } from "../../art/hero-tile";
import {
  starterSeedReason,
  starterSeedStatus,
  subscribeStarterSeed,
  type StarterSeed,
} from "../../deck/starter-decks";
import { showToast } from "../../kit/toast";
import { ToastView } from "../../kit/toast-view";
import { AskInPlace } from "../../kit/ask-in-place";
import { useUiScale } from "../../../ui/ui-scale";
import { useSizeClass } from "../../../ui/use-size-class";
import { announce } from "../../../ui/announce";

type Row =
  | { kind: "deck"; key: string; deck: SavedDeck; starter: boolean }
  | { kind: "empty"; key: string }
  | { kind: "no-match"; key: string }
  | { kind: "starter-missing"; key: string };

// The heroes' paintings on a cover: 118 pt on a phone, 200 in a tablet's three columns, 220 in its two.
const coverHeight = (size: "compact" | "medium" | "expanded") => (size === "compact" ? 118 : size === "medium" ? 220 : 200);

function useSeedStatus(): StarterSeed {
  return useSyncExternalStore(subscribeStarterSeed, starterSeedStatus, () => "pending");
}

function useSeedReason(): string | null {
  return useSyncExternalStore(subscribeStarterSeed, starterSeedReason, () => null);
}

// One list, the deck saved last first; the starters are ordinary rows and follow the decks the player has saved.
function listRows(shown: readonly SavedDeck[], total: number, seed: StarterSeed): Row[] {
  const rows: Row[] = [];
  if (seed === "missing") rows.push({ kind: "starter-missing", key: "starter-missing" });
  if (total === 0) rows.push({ kind: "empty", key: "empty" });
  else if (shown.length === 0) rows.push({ kind: "no-match", key: "no-match" });
  for (const deck of shown) rows.push({ kind: "deck", key: deck.id, deck, starter: isStarterDeck(deck.id) });
  return rows;
}

// What waits on a second tap in Manage: a delete, or putting a starter back to its printed list.
type Asking = { id: string; action: "delete" | "reset" } | null;

function DeckActions({
  deck,
  starter,
  asking,
  onAsk,
  onCancel,
  onDuplicate,
  onDelete,
  onReset,
}: {
  deck: SavedDeck;
  starter: boolean;
  asking: Asking;
  onAsk: (action: "delete" | "reset") => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReset: () => void;
}) {
  if (asking?.id === deck.id) {
    const reset = asking.action === "reset";
    return (
      <AskInPlace
        testID={`deck-confirm-${deck.id}`}
        className="px-3 py-2"
        sentence={reset ? `Put ${deck.name} back to the printed list? Your changes to it are lost.` : `Delete ${deck.name}? It is gone for good. Playthroughs that used it keep their cards.`}
        confirm={{
          label: reset ? "Reset" : "Delete for good",
          testID: `deck-confirm-yes-${deck.id}`,
          accessibilityLabel: reset ? `Reset ${deck.name} to the printed list` : `Delete ${deck.name}, for good`,
          onPress: reset ? onReset : onDelete,
        }}
        keep={{ testID: `deck-confirm-no-${deck.id}`, accessibilityLabel: `Keep ${deck.name}`, onPress: onCancel }}
      />
    );
  }
  return (
    <View className="flex-row">
      <TextButton label="Duplicate" testID={`deck-duplicate-${deck.id}`} tone="accent" accessibilityLabel={`Duplicate ${deck.name}`} onPress={onDuplicate} />
      {starter ? (
        <TextButton label="Reset" testID={`deck-reset-${deck.id}`} accessibilityLabel={`Reset ${deck.name} to the printed list`} onPress={() => onAsk("reset")} />
      ) : (
        <TextButton label="Delete" testID={`deck-delete-${deck.id}`} tone="danger" accessibilityLabel={`Delete ${deck.name}`} onPress={() => onAsk("delete")} />
      )}
    </View>
  );
}

export default function Decks() {
  const router = useRouter();
  const s = useUiScale();
  const { size } = useSizeClass();
  const seed = useSeedStatus();
  const seedReason = useSeedReason();
  const { catalog, user } = useDatabases();
  const [saved, setSaved] = useState<SavedDeck[]>([]);
  // Manage shows Duplicate and Delete (Reset on a starter) under each deck. It ends when the list loses focus.
  const [managing, setManaging] = useState(false);
  const [asking, setAsking] = useState<Asking>(null);
  const [filter, setFilter] = useState<DeckListFilter>(emptyDeckListFilter);
  const view = useDeckListView();
  // The Cards view is a grid of covers where the list is wide, the List view a reading column (deckListLayout).
  const [listWidth, setListWidth] = useState(0);
  const { columns, inset } = deckListLayout(listWidth, size, view, s);

  const refresh = useCallback(() => {
    setSaved(seed === "pending" ? [] : listDecks(user));
    setAsking(null);
  }, [seed, user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        setManaging(false);
        setAsking(null);
      };
    }, [refresh]),
  );

  const faces = useMemo(() => deckFaces(catalog, saved.flatMap((deck) => [...deck.heroes, ...deck.cards.map((card) => card.code)])), [catalog, saved]);
  const readiness = useMemo(() => new Map(saved.map((deck) => [deck.id, deckReadiness(deck, faces)])), [saved, faces]);
  // The cards whose text the app does not apply: each deck says how many it holds (docs/brief.md, Three layers).
  const inactive = useMemo(() => notAppliedIn(faces), [faces]);
  const spheres = useMemo(() => deckListSpheres(saved, faces), [saved, faces]);
  const shown = useMemo(() => filterDecks(saved, filter, faces, (deck) => readiness.get(deck.id)?.ready ?? false), [saved, filter, faces, readiness]);
  const rows = useMemo(() => listRows(shown, saved.length, seed), [shown, saved.length, seed]);
  // The decks can be dragged into a new order while the whole list shows; a filtered list is only part of it.
  const ids = useMemo(() => shown.map((deck) => deck.id), [shown]);
  const draggable = !deckListFiltered(filter) && shown.length > 1;
  const listRef = useRef<FlashListRef<Row>>(null);
  const reorder = useDeckReorder({
    ids,
    rowOffset: rows.length - shown.length,
    listRef,
    // Not while Manage is open: its Duplicate and Delete rows (and an ask in place) lie under the decks, and a drag would carry them.
    enabled: draggable && !managing,
    onReorder: (order) => {
      writeDeckOrder(user, order);
      refresh();
    },
  });

  // The Move up / Move down actions of a screen reader: the same reorder as the drag, one place at a time.
  function moveDeck(deck: SavedDeck, direction: "up" | "down"): void {
    const at = ids.indexOf(deck.id);
    const to = direction === "up" ? at - 1 : at + 1;
    if (at < 0 || to < 0 || to >= ids.length) return;
    writeDeckOrder(user, moveItem(ids, at, to));
    refresh();
    announce(`Moved ${deck.name} to place ${to + 1} of ${ids.length}`);
  }

  function facesFor(deck: SavedDeck): HeroFace[] {
    return deck.heroes.map((code) => heroFace(faces, code));
  }

  function openDeck(deck: SavedDeck): void {
    if (reorder.recentlyDragged()) return;
    editSavedDeck(deck);
    router.push({ pathname: "/deck/[id]", params: { id: deck.id } });
  }

  function newDeck(): void {
    startNewDeck({ name: newDeckName(saved.map((deck) => deck.name)) });
    router.push({ pathname: "/deck/[id]", params: { id: "new" } });
  }

  function duplicate(deck: SavedDeck): void {
    const copy = duplicateDeck(user, deck.id, copyDeckName(deck.name, saved.map((item) => item.name)));
    refresh();
    if (!copy) return;
    showToast(`Made ${copy.name}`, {
      undo: () => {
        deleteDeck(user, copy.id);
        refresh();
      },
    });
  }

  function remove(deck: SavedDeck): void {
    deleteDeck(user, deck.id);
    refresh();
    showToast(`Deleted ${deck.name}`);
  }

  function reset(deck: SavedDeck): void {
    resetStarterDeck(user, deck.id);
    refresh();
    showToast(`${deck.name} is back to the printed list`);
  }

  function ask(id: string, action: "delete" | "reset"): void {
    setAsking({ id, action });
    announce(action === "delete" ? "Delete this deck? Tap Delete for good to confirm." : "Reset this deck? Tap Reset to confirm.");
  }

  function renderBody(item: Row) {
    if (item.kind === "empty") {
      return (
        <BodyText testID="decks-empty" tone="muted" className="mt-4">
          No decks yet. Tap + to build one, or Import one from RingsDB or a pre-built list.
        </BodyText>
      );
    }
    if (item.kind === "no-match") {
      return (
        <View className="mt-4 items-start">
          <BodyText testID="decks-no-match" tone="muted">
            No decks match.
          </BodyText>
          <View className="-mx-3">
            <TextButton testID="decks-clear-filter" label="Clear filter" tone="accent" onPress={() => setFilter(emptyDeckListFilter)} />
          </View>
        </View>
      );
    }
    if (item.kind === "starter-missing") {
      return (
        <View className="mb-3 gap-2">
          <BodyText tone="danger" testID="starter-missing">
            The starter decks are missing.
          </BodyText>
          {seedReason ? (
            <BodyText tone="danger" testID="starter-missing-reason">
              {seedReason}
            </BodyText>
          ) : null}
        </View>
      );
    }
    const { deck, starter } = item;
    const place = ids.indexOf(deck.id);
    const summary = {
      testID: `deck-${deck.id}`,
      name: deck.name,
      heroes: facesFor(deck),
      detail: deckCountLine(deck),
      short: deckShortLine(deck),
      status: readiness.get(deck.id) ?? { ready: false, text: "" },
      note: notAppliedLine(deck, inactive),
      onPress: () => openDeck(deck),
      // A long press drags the deck while the list can be reordered, and starts Manage when it cannot.
      onLongPress: draggable
        ? undefined
        : () => {
            setManaging(true);
            setAsking(null);
          },
      onMove: draggable ? (direction: "up" | "down") => moveDeck(deck, direction) : undefined,
      canMove: { up: place > 0, down: place < ids.length - 1 },
    };
    const actions = managing ? (
      <DeckActions
        deck={deck}
        starter={starter}
        asking={asking}
        onAsk={(action) => ask(deck.id, action)}
        onCancel={() => setAsking(null)}
        onDuplicate={() => duplicate(deck)}
        onDelete={() => remove(deck)}
        onReset={() => reset(deck)}
      />
    ) : null;
    const tile =
      view === "List" ? (
        <DeckRow {...summary}>{actions}</DeckRow>
      ) : (
        <View className="pb-3" style={columns > 1 ? { paddingHorizontal: (COVER_GAP / 2) * s } : undefined}>
          <DeckCover {...summary} height={coverHeight(size) * s}>
            {actions}
          </DeckCover>
        </View>
      );
    return (
      <ReorderItem reorder={reorder} index={place}>
        {tile}
      </ReorderItem>
    );
  }

  // A full-width line sits level with the covers' outer edges: the grid's negative margin is cancelled by the covers' own padding.
  function renderRow({ item }: { item: Row }) {
    const body = renderBody(item);
    return item.kind !== "deck" && columns > 1 ? <View style={{ paddingHorizontal: (COVER_GAP / 2) * s }}>{body}</View> : body;
  }

  const filters =
    saved.length > 0 ? <DeckListBar filter={filter} onFilter={setFilter} spheres={spheres} shown={shown.length} total={saved.length} /> : null;

  // The title with the list's own actions beside it: Import and Manage (glass capsules) and New deck (+, a round glass button), so the decks start high.
  const header = (
    <View>
      <HubHeader title="Decks">
        {seed !== "pending" ? (
          <>
            <PillButton testID="deck-import" label="Import" accessibilityLabel="Import a deck" onPress={() => router.push("/deck-import")} />
            {saved.length > 0 ? (
              <PillButton
                testID="decks-manage"
                label={managing ? "Done" : "Manage"}
                accessibilityLabel={managing ? "Done managing decks" : "Manage decks"}
                onPress={() => {
                  setManaging(!managing);
                  setAsking(null);
                }}
              />
            ) : null}
            <IconButton testID="deck-new" label="New deck" glyph="+" onPress={newDeck} />
          </>
        ) : null}
      </HubHeader>
      {filters}
    </View>
  );

  return (
    <Screen testID="decks" scene="calm">
      {header}
      {seed === "pending" ? (
        <BodyText tone="muted" className="mt-6">
          Loading
        </BodyText>
      ) : (
        <View
          className="min-h-0 flex-1"
          onLayout={(event) => {
            const next = Math.floor(event.nativeEvent.layout.width);
            setListWidth((current) => (current === next ? current : next));
          }}
        >
          {/* Outside compact it mounts once the width is measured, so the columns are known before the first cover draws; a new column count remounts it. */}
          {listWidth > 0 || size === "compact" ? (
          <LiftedRowProvider row={reorder.liftedRow}>
          <FlashList
            ref={listRef}
            key={`${view}:${columns}`}
            data={rows}
            numColumns={columns}
            // The empty, no-match and missing-starters lines take the whole row, not one cover's share of it.
            overrideItemLayout={(layout, item) => {
              layout.span = item.kind === "deck" ? 1 : columns;
            }}
            keyExtractor={(item) => item.key}
            getItemType={(item) => `${item.kind}:${view}`}
            renderItem={renderRow}
            extraData={{ managing, asking, readiness, view, draggable }}
            CellRendererComponent={DeckCell}
            onScroll={reorder.onScroll}
            scrollEventThrottle={16}
            scrollEnabled={!reorder.dragging}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={<View className="h-3" />}
            ListFooterComponent={<View className="h-6" />}
            style={{ flex: 1, ...(columns > 1 ? { marginHorizontal: -(COVER_GAP / 2) * s } : {}) }}
            contentContainerStyle={inset > 0 ? { paddingHorizontal: inset } : undefined}
          />
          </LiftedRowProvider>
          ) : null}
        </View>
      )}
      <ToastView />
    </Screen>
  );
}
