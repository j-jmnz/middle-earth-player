import { eq } from "drizzle-orm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { TextInput, View } from "react-native";

import { deckSaveRefusal, type DeckSaveCard } from "../../catalog/deck-save";
import { cards } from "../../catalog/schema";
import { BodyText, Eyebrow, ListRow, NavBar, PrimaryButton, Screen, ScreenTitle, SphereMark, markedSphere, type MarkedSphere } from "../chrome";
import { newDeckId, replaceDeckDraft } from "../deck-draft";
import {
  buildDecklist,
  cardUrl,
  decklistUrl,
  droppedSentence,
  importSavedSentence,
  parseDecklistRef,
  prebuiltBody,
  prebuiltDecks,
  prebuiltDetail,
  prebuiltRows,
  readDecklistBody,
  type BuiltDecklist,
  type PrebuiltRow,
} from "../deck-import";
import { useDatabases } from "../databases";
import { palette } from "../palette.js";
import type { PrebuiltDeck } from "../../catalog/prebuilt-deck";
import { decks } from "../user-schema";
import { goBack } from "../go-back";

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
      })
      .from(cards)
      .where(eq(cards.deckLegal, true))
      .all();
    return new Map(rows.map((row) => [row.code, row]));
  }, [catalog]);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  // One editor per tap: a second tap before the editor is on screen does nothing. Coming back here clears it.
  const opening = useRef(false);
  useFocusEffect(
    useCallback(() => {
      opening.current = false;
    }, []),
  );

  async function onImport(): Promise<void> {
    if (busy || saved) return;
    setMessage(null);
    setDropped(null);
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
    replaceDeckDraft({
      id: "new",
      name: built.name,
      heroes: built.heroes,
      cards: built.cards,
      heldRefusal: null,
      // The editor's note line also carries the deck's note: a printed condition, or why a core deck is short of 50.
      droppedNote: [droppedSentence(built.droppedCodes), deck.note].filter((text) => text).join(" ") || null,
    });
    router.push({ pathname: "/deck/[id]", params: { id: "new" } });
  }

  // Saves an imported deck when the deckbuilding rules allow it; otherwise opens it in the editor.
  function save(built: BuiltDecklist, names: readonly string[]): void {
    const sentence = droppedSentence(names);
    if (sentence) setDropped(sentence);
    if (built.heroLimit) {
      setMessage(`${built.heroLimit.cardName} Deck limit is 1.`);
      return;
    }
    const facts = new Map<string, DeckSaveCard>();
    for (const code of [...built.heroes, ...built.cards.map((card) => card.code)]) {
      const row = pool.get(code);
      if (row) facts.set(code, row);
    }
    const draft = {
      id: "new",
      name: built.name,
      heroes: built.heroes,
      cards: built.cards,
      heldRefusal: null,
      droppedNote: sentence,
    };
    const refusal = built.name.trim().length === 0
      ? { cardCode: null, cardName: null, rule: "Name the deck." }
      : deckSaveRefusal(built.heroes, built.cards, facts, []);
    if (refusal) {
      replaceDeckDraft(draft);
      router.push({ pathname: "/deck/[id]", params: { id: "new" } });
      return;
    }
    user.insert(decks).values({
      id: newDeckId(),
      name: built.name.trim(),
      heroes: [...built.heroes],
      cards: built.cards.map((card) => ({ code: card.code, count: card.count })),
    }).run();
    if (sentence) {
      setSaved(true);
      setDropped(null);
      setSavedNote(importSavedSentence(names));
      return;
    }
    goBack(router, "/decks");
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
      {savedNote ? (
        <BodyText tone="muted" className="mt-4">
          {savedNote}
        </BodyText>
      ) : null}
      {dropped ? (
        <BodyText testID="deck-import-dropped" tone="muted" className="mt-4">
          {dropped}
        </BodyText>
      ) : null}
      <View className="mt-6">
        <PrimaryButton testID="deck-import-submit" label="Import" disabled={busy || saved} onPress={() => void onImport()} />
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
          detail={prebuiltDetail(deck, (code) => pool.get(code)?.name ?? code)}
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
