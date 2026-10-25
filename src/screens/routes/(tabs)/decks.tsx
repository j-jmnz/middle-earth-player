import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, View } from "react-native";

import { BodyText, Eyebrow, Screen, ScreenTitle, TextButton } from "../../chrome";
import { editSavedDeck, startNewDeck } from "../../deck-draft";
import { copyDeckName, deckCountLine, deckReadiness, newDeckName } from "../../deck-status";
import { deckFaces, deleteDeck, duplicateDeck, isStarterDeck, listDecks, resetStarterDeck, type SavedDeck } from "../../deck-store";
import { useDatabases } from "../../databases";
import { DeckCover, type HeroFace } from "../../hero-tile";
import {
  STARTER_NOTE,
  starterSeedReason,
  starterSeedStatus,
  subscribeStarterSeed,
  type StarterSeed,
} from "../../starter-decks";
import { showToast } from "../../toast";
import { ToastView } from "../../toast-view";

type Row =
  | { kind: "section"; key: string; title: string }
  | { kind: "deck"; key: string; deck: SavedDeck; starter: boolean }
  | { kind: "empty"; key: string }
  | { kind: "starter-note"; key: string }
  | { kind: "starter-missing"; key: string };

const COVER_HEIGHT = 144;

function useSeedStatus(): StarterSeed {
  return useSyncExternalStore(subscribeStarterSeed, starterSeedStatus, () => "pending");
}

function useSeedReason(): string | null {
  return useSyncExternalStore(subscribeStarterSeed, starterSeedReason, () => null);
}

// The list in reading order: the player's own decks, the one saved last first, then the two starter decks and their note.
function listRows(saved: readonly SavedDeck[], seed: StarterSeed): Row[] {
  const own = saved.filter((deck) => !isStarterDeck(deck.id));
  const starters = saved.filter((deck) => isStarterDeck(deck.id));
  const rows: Row[] = [{ kind: "section", key: "section-own", title: own.length > 0 ? `Your decks · ${own.length}` : "Your decks" }];
  if (own.length === 0) rows.push({ kind: "empty", key: "empty" });
  for (const deck of own) rows.push({ kind: "deck", key: deck.id, deck, starter: false });
  rows.push({ kind: "section", key: "section-starter", title: "Starter decks" });
  if (seed === "missing") rows.push({ kind: "starter-missing", key: "starter-missing" });
  for (const deck of starters) rows.push({ kind: "deck", key: deck.id, deck, starter: true });
  if (seed === "ready") rows.push({ kind: "starter-note", key: "starter-note" });
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
  const rows = useMemo(() => listRows(saved, seed), [saved, seed]);

  function facesFor(deck: SavedDeck): HeroFace[] {
    return deck.heroes.map((code) => faces.get(code) ?? { code, name: code, sphereCode: null, sphereName: null, imagesrc: null });
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
    if (item.kind === "section") {
      return (
        <View accessibilityRole="header" className="pb-2 pt-6">
          <Eyebrow tone="muted">{item.title}</Eyebrow>
        </View>
      );
    }
    if (item.kind === "empty") {
      return (
        <BodyText testID="decks-empty" tone="muted">
          No decks of your own yet. Tap New deck to build one, or Import one from RingsDB or a pre-built list.
        </BodyText>
      );
    }
    if (item.kind === "starter-note") {
      return (
        <BodyText testID="starter-note" tone="muted" className="mt-1">
          {STARTER_NOTE}
        </BodyText>
      );
    }
    if (item.kind === "starter-missing") {
      return (
        <View className="gap-2">
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
    return (
      <View className="pb-3">
        <DeckCover
          testID={`deck-${deck.id}`}
          name={deck.name}
          heroes={facesFor(deck)}
          detail={deckCountLine(deck)}
          status={deckReadiness(deck, faces)}
          height={COVER_HEIGHT}
          onPress={() => openDeck(deck)}
          onLongPress={() => {
            setManaging(true);
            setAsking(null);
          }}
        >
          {managing ? (
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
          ) : null}
        </DeckCover>
      </View>
    );
  }

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
            extraData={{ managing, asking, faces }}
            ListFooterComponent={<View className="h-20" />}
            style={{ flex: 1 }}
          />
        </View>
      )}
      <ToastView />
    </Screen>
  );
}
