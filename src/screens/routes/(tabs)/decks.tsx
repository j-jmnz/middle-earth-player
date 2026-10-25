import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BodyText, Screen, ScreenTitle, Segmented, SphereMark, TextButton, markedSphere, sphereWord } from "../../chrome";
import { editSavedDeck, startNewDeck } from "../../deck-draft";
import { copyDeckName, deckCountLine, deckReadiness, newDeckName } from "../../deck-status";
import { deckFaces, deleteDeck, duplicateDeck, isStarterDeck, listDecks, resetStarterDeck, type SavedDeck } from "../../deck-store";
import { useDatabases } from "../../databases";
import {
  deckListFiltered,
  deckListSpheres,
  emptyDeckListFilter,
  filterDecks,
  setDeckListView,
  useDeckListView,
  type DeckListFilter,
  type DeckListStatus,
} from "../../deck-list";
import { DeckCover, DeckRow, heroFace, type HeroFace } from "../../hero-tile";
import { palette } from "../../palette.js";
import {
  starterSeedReason,
  starterSeedStatus,
  subscribeStarterSeed,
  type StarterSeed,
} from "../../starter-decks";
import { showToast } from "../../toast";
import { ToastView } from "../../toast-view";

type Row =
  | { kind: "deck"; key: string; deck: SavedDeck; starter: boolean }
  | { kind: "empty"; key: string }
  | { kind: "no-match"; key: string }
  | { kind: "starter-missing"; key: string };

const COVER_HEIGHT = 144;
const VIEWS = ["Cards", "List"] as const;
const STATUSES: { key: DeckListStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "unready", label: "Not ready" },
];

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

// A filter chip on night: raised pill, gold when on. A sphere chip carries the sphere's icon.
function FilterChip({ label, selected, onPress, sphere, testID }: { label: string; selected: boolean; onPress: () => void; sphere?: string; testID: string }) {
  const mark = sphere ? markedSphere(sphere) : null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 flex-row items-center gap-1.5 rounded-pill px-4 ${selected ? "bg-gold" : "bg-raised"}`}
    >
      {mark ? <SphereMark sphere={mark} size={12} /> : null}
      <Text className={selected ? "text-body font-semibold text-onGold" : "text-body text-muted"}>{label}</Text>
    </Pressable>
  );
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
      <View className="gap-1 px-3 py-2" testID={`deck-confirm-${deck.id}`}>
        <BodyText tone="danger">
          {reset
            ? `Put ${deck.name} back to the printed list? Your changes to it are lost.`
            : `Delete ${deck.name}? It is gone for good. Playthroughs that used it keep their cards.`}
        </BodyText>
        <View className="-mx-3 flex-row">
          <TextButton
            label={reset ? "Reset" : "Delete for good"}
            testID={`deck-confirm-yes-${deck.id}`}
            tone="danger"
            accessibilityLabel={reset ? `Reset ${deck.name} to the printed list` : `Delete ${deck.name}, for good`}
            onPress={reset ? onReset : onDelete}
          />
          <TextButton label="Keep" testID={`deck-confirm-no-${deck.id}`} accessibilityLabel={`Keep ${deck.name}`} onPress={onCancel} />
        </View>
      </View>
    );
  }
  return (
    <View className="flex-row">
      <TextButton label="Duplicate" testID={`deck-duplicate-${deck.id}`} tone="gold" accessibilityLabel={`Duplicate ${deck.name}`} onPress={onDuplicate} />
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
  const seed = useSeedStatus();
  const seedReason = useSeedReason();
  const { catalog, user } = useDatabases();
  const [saved, setSaved] = useState<SavedDeck[]>([]);
  // Manage shows Duplicate and Delete (Reset on a starter) under each deck. It ends when the list loses focus.
  const [managing, setManaging] = useState(false);
  const [asking, setAsking] = useState<Asking>(null);
  const [filter, setFilter] = useState<DeckListFilter>(emptyDeckListFilter);
  const view = useDeckListView();

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
  const spheres = useMemo(() => deckListSpheres(saved, faces), [saved, faces]);
  const shown = useMemo(() => filterDecks(saved, filter, faces, (deck) => readiness.get(deck.id)?.ready ?? false), [saved, filter, faces, readiness]);
  const rows = useMemo(() => listRows(shown, saved.length, seed), [shown, saved.length, seed]);

  function facesFor(deck: SavedDeck): HeroFace[] {
    return deck.heroes.map((code) => heroFace(faces, code));
  }

  function openDeck(deck: SavedDeck): void {
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
    AccessibilityInfo.announceForAccessibility(action === "delete" ? "Delete this deck? Tap Delete for good to confirm." : "Reset this deck? Tap Reset to confirm.");
  }

  function renderRow({ item }: { item: Row }) {
    if (item.kind === "empty") {
      return (
        <BodyText testID="decks-empty" tone="muted" className="mt-4">
          No decks yet. Tap New deck to build one, or Import one from RingsDB or a pre-built list.
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
            <TextButton testID="decks-clear-filter" label="Clear filter" tone="gold" onPress={() => setFilter(emptyDeckListFilter)} />
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
    const summary = {
      testID: `deck-${deck.id}`,
      name: deck.name,
      heroes: facesFor(deck),
      detail: deckCountLine(deck),
      status: readiness.get(deck.id) ?? { ready: false, text: "" },
      onPress: () => openDeck(deck),
      onLongPress: () => {
        setManaging(true);
        setAsking(null);
      },
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
    if (view === "List") return <DeckRow {...summary}>{actions}</DeckRow>;
    return (
      <View className="pb-3">
        <DeckCover {...summary} height={COVER_HEIGHT}>
          {actions}
        </DeckCover>
      </View>
    );
  }

  const filters =
    saved.length > 0 ? (
      <View className="mt-2">
        <View className="flex-row items-center gap-2">
          <TextInput
            testID="decks-search"
            value={filter.query}
            onChangeText={(query) => setFilter({ ...filter, query })}
            placeholder="Search"
            placeholderTextColor={palette.faint}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search decks or heroes"
            className="min-h-11 min-w-0 flex-1 rounded-pill bg-raised px-4 text-body text-bone"
          />
          <Segmented options={VIEWS} value={view} onChange={setDeckListView} testIDPrefix="decks-view" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="-mx-6 mt-2 grow-0" contentContainerClassName="gap-2 px-6">
          {STATUSES.map((status) => (
            <FilterChip
              key={status.key}
              testID={`decks-status-${status.key}`}
              label={status.label}
              selected={filter.status === status.key}
              onPress={() => setFilter({ ...filter, status: status.key })}
            />
          ))}
          {spheres.map((sphere) => (
            <FilterChip
              key={sphere.code}
              testID={`decks-sphere-${sphere.code}`}
              label={sphereWord(sphere.name)}
              sphere={sphere.code}
              selected={filter.sphere === sphere.code}
              onPress={() => setFilter({ ...filter, sphere: filter.sphere === sphere.code ? null : sphere.code })}
            />
          ))}
        </ScrollView>
        {deckListFiltered(filter) ? (
          <Text testID="decks-count" className="mt-2 text-label text-muted">{`${shown.length} of ${saved.length} decks`}</Text>
        ) : null}
      </View>
    ) : null;

  const header = (
    <View className="pt-6">
      <View className="flex-row items-center justify-between">
        <ScreenTitle>Decks</ScreenTitle>
        {seed !== "pending" && saved.length > 0 ? (
          <View className="-mr-3">
            <TextButton
              testID="decks-manage"
              label={managing ? "Done" : "Manage"}
              accessibilityLabel={managing ? "Done managing decks" : "Manage decks"}
              onPress={() => {
                setManaging(!managing);
                setAsking(null);
              }}
            />
          </View>
        ) : null}
      </View>
      {seed !== "pending" ? (
        <View className="-mx-3 mt-2 flex-row flex-wrap items-center">
          <TextButton testID="deck-new" label="New deck" tone="gold" onPress={newDeck} />
          <TextButton testID="deck-import" label="Import" onPress={() => router.push("/deck-import")} />
          <TextButton testID="card-pool" label="Card pool" onPress={() => router.push("/pool")} />
        </View>
      ) : null}
      {filters}
    </View>
  );

  return (
    <Screen testID="decks" scene="plain">
      {header}
      {seed === "pending" ? (
        <BodyText tone="muted" className="mt-6">
          Loading
        </BodyText>
      ) : (
        <View className="min-h-0 flex-1">
          <FlashList
            data={rows}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.kind}
            renderItem={renderRow}
            extraData={{ managing, asking, readiness, view }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={<View className="h-3" />}
            ListFooterComponent={<View className="h-6" />}
            style={{ flex: 1 }}
          />
        </View>
      )}
      <ToastView />
    </Screen>
  );
}
