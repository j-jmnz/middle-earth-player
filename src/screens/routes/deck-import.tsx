import { eq } from "drizzle-orm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { TextInput, View } from "react-native";

import { formatDeckRefusal } from "../../catalog/deck-save";
import { cards } from "../../catalog/schema";
import { BodyText, Eyebrow, ListRow, NavBar, PrimaryButton, Screen, ScreenTitle, SphereMark, markedSphere, type MarkedSphere } from "../chrome";
import { editSavedDeck, startNewDeck } from "../deck-draft";
import { savedDeckName } from "../deck-status";
import { listDecks, readDeck, writeDeck } from "../deck-store";
import {
  buildDecklist,
  cardUrl,
  decklistUrl,
  droppedSentence,
  parseDecklistRef,
  prebuiltBody,
  prebuiltDecks,
  prebuiltNotApplied,
  withNotApplied,
  prebuiltDetail,
  prebuiltRows,
  readDecklistBody,
  type BuiltDecklist,
  type PrebuiltRow,
} from "../deck-import";
import { useDatabases } from "../databases";
import { palette } from "../palette.js";
import type { PrebuiltDeck } from "../../catalog/prebuilt-deck";
import { notAppliedCodes } from "../../play/not-applied";
import { goBack } from "../go-back";
import { showToast } from "../toast";

const FETCH_FAILURE = "RingsDB did not respond.";

const PREBUILT_ROWS = prebuiltRows(prebuiltDecks);
// Each group heading stays at the top while its decks scroll under it.
const STICKY = PREBUILT_ROWS.flatMap((row, at) => (row.kind === "group" ? [at] : []));

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(FETCH_FAILURE);
  return response.json() as Promise<unknown>;
}

async function droppedName(code: string): Promise<string> {
  try {
    const payload = await readJson(cardUrl(code));
    if (typeof payload === "object" && payload !== null && "name" in payload && typeof payload.name === "string") {
      const name = payload.name.trim();
      if (name.length > 0) return name;
    }
  } catch {
    return code;
  }
  return code;
}

export default function DeckImportScreen() {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const pool = useMemo(() => {
    const rows = catalog
      .select({
        code: cards.code,
        name: cards.name,
        typeCode: cards.typeCode,
        sphereCode: cards.sphereCode,
        deckLimit: cards.deckLimit,
        deckLegal: cards.deckLegal,
        traits: cards.traits,
        text: cards.text,
        errata: cards.errata,
      })
      .from(cards)
      .where(eq(cards.deckLegal, true))
      .all();
    return new Map(rows.map((row) => [row.code, row]));
  }, [catalog]);
  // How many cards of each pre-built deck the app does not fully apply (docs/plans/inactive-text.md): the row says so, so
  // the player can pick a deck the app plays as printed.
  const inactive = useMemo(() => notAppliedCodes([...pool.values()].map((row) => [row.code, row.errata ?? row.text] as const)), [pool]);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One editor per tap: a second tap before the editor is on screen does nothing. Coming back here clears it.
  const opening = useRef(false);
  useFocusEffect(
    useCallback(() => {
      opening.current = false;
    }, []),
  );

  async function onImport(): Promise<void> {
    if (busy || opening.current) return;
    setMessage(null);
    const id = parseDecklistRef(value);
    if (!id) {
      setMessage("That is not a RingsDB decklist.");
      return;
    }
    setBusy(true);
    try {
      let payload: unknown;
      try {
        payload = await readJson(decklistUrl(id));
      } catch {
        setMessage(FETCH_FAILURE);
        return;
      }
      const body = readDecklistBody(payload);
      if (!body) {
        setMessage("That decklist could not be read.");
        return;
      }
      const built = buildDecklist(body, pool);
      const names = await Promise.all(built.droppedCodes.map((code) => droppedName(code)));
      save(built, names);
    } finally {
      setBusy(false);
    }
  }

  // A pre-built deck is local data. It opens in the editor, where Save is the one action: nothing is saved by the tap,
  // and the 47-card core decks show what they lack. A code the bundled catalog lacks is named by its code.
  function onPrebuilt(deck: PrebuiltDeck): void {
    if (busy || opening.current) return;
    opening.current = true;
    const built = buildDecklist(prebuiltBody(deck), pool);
    startNewDeck({
      name: built.name,
      heroes: built.heroes,
      cards: built.cards,
      // The editor's note line also carries the deck's note: a printed condition, or why a core deck is short of 50.
      droppedNote: [droppedSentence(built.droppedCodes), deck.note].filter((text) => text).join(" ") || null,
    });
    router.push({ pathname: "/deck/[id]", params: { id: "new" } });
  }

  // Saves an imported deck, ready to play or not, and opens it in the editor, which names what was dropped and what the
  // deck still lacks. A hero listed twice is refused: the list itself is wrong.
  function save(built: BuiltDecklist, names: readonly string[]): void {
    if (built.heroLimit) {
      setMessage(formatDeckRefusal({ cardName: built.heroLimit.cardName, rule: "Deck limit is 1." }));
      return;
    }
    const name = savedDeckName(built.name, listDecks(user).map((deck) => deck.name));
    const id = writeDeck(user, { id: null, name, heroes: built.heroes, cards: built.cards });
    const row = readDeck(user, id);
    if (!row) return;
    opening.current = true;
    editSavedDeck(row, droppedSentence(names));
    showToast(`Imported ${name}`, { carry: true });
    router.replace({ pathname: "/deck/[id]", params: { id } });
  }

  // The heroes' spheres, once each, in hero order.
  function spheres(deck: PrebuiltDeck): MarkedSphere[] {
    return [...new Set(deck.heroes.flatMap((code) => markedSphere(pool.get(code)?.sphereCode ?? null) ?? []))];
  }

  // The screen is not inset, so a pinned group heading spans the width as a bar; every row pads itself.
  const form = (
    <View className="px-6 pb-2">
      <View className="pt-6">
        <ScreenTitle>Import</ScreenTitle>
      </View>
      <View className="mt-6">
        <Eyebrow tone="muted">RingsDB</Eyebrow>
      </View>
      <View className="mt-2">
        <TextInput
          testID="deck-import-input"
          value={value}
          onChangeText={setValue}
          placeholder="RingsDB decklist"
          placeholderTextColor={palette.faint}
          autoCorrect={false}
          autoCapitalize="none"
          className="min-h-14 rounded-pill bg-raised px-4 text-body text-bone"
        />
      </View>
      {message ? (
        <BodyText tone="danger" className="mt-4">
          {message}
        </BodyText>
      ) : null}
      <View className="mt-6">
        <PrimaryButton testID="deck-import-submit" label="Import" disabled={busy} onPress={() => void onImport()} />
      </View>
      {busy ? (
        <BodyText testID="deck-import-busy" tone="muted" className="mt-4">
          Importing from RingsDB…
        </BodyText>
      ) : null}
    </View>
  );

  function renderRow({ item }: { item: PrebuiltRow }) {
    if (item.kind === "group") {
      return (
        <View accessibilityRole="header" className="border-b border-hairline bg-night px-6 pb-2 pt-6">
          <Eyebrow tone="muted">{item.title}</Eyebrow>
        </View>
      );
    }
    const deck = item.deck;
    return (
      <View className="px-6">
        <ListRow
          testID={`deck-prebuilt-${deck.id}`}
          label={deck.name}
          detail={withNotApplied(prebuiltDetail(deck, (code) => pool.get(code)?.name ?? code), prebuiltNotApplied(deck, inactive))}
          detailIcons={spheres(deck).map((sphere) => <SphereMark key={sphere} sphere={sphere} size={12} />)}
          onPress={() => onPrebuilt(deck)}
        />
      </View>
    );
  }

  return (
    <Screen scene="plain" inset={false}>
      <View className="px-6">
        <NavBar backLabel="Decks" backTestID="deck-import-back" onBack={() => goBack(router, "/decks")} />
      </View>
      <FlashList
        data={PREBUILT_ROWS}
        keyExtractor={(item) => (item.kind === "group" ? `group-${item.title}` : item.deck.id)}
        getItemType={(item) => item.kind}
        renderItem={renderRow}
        stickyHeaderIndices={STICKY}
        ListHeaderComponent={form}
        ListFooterComponent={<View className="pb-safe" />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1 }}
      />
    </Screen>
  );
}
