import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { TextInput, View } from "react-native";

import { deckSaveRefusal, type DeckSaveCard } from "../../catalog/deck-save";
import { cards } from "../../catalog/schema";
import { BodyText, Eyebrow, ListRow, NavBar, PrimaryButton, Screen } from "../chrome";
import { replaceDeckDraft } from "../deck-draft";
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
  readDecklistBody,
  type BuiltDecklist,
} from "../deck-import";
import { useDatabases } from "../databases";
import { palette } from "../palette.js";
import type { PrebuiltDeck } from "../../catalog/prebuilt-deck";
import { decks } from "../user-schema";
import { goBack } from "../go-back";

const FETCH_FAILURE = "RingsDB did not respond.";

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
    if (busy) return;
    const built = buildDecklist(prebuiltBody(deck), pool);
    replaceDeckDraft({
      id: "new",
      name: built.name,
      heroes: built.heroes,
      cards: built.cards,
      heldRefusal: null,
      // The editor's note line also carries a condition the decklist prints with the list (Valor and Vigilance).
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
      id: crypto.randomUUID(),
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

  return (
    <Screen scene="plain">
      <NavBar backLabel="Decks" backTestID="deck-import-back" onBack={() => goBack(router, "/decks")} />
      <View className="mt-6">
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
      <View className="mt-8">
        <Eyebrow tone="muted">Pre-built</Eyebrow>
      </View>
      <View className="mt-2 min-h-0 flex-1">
        <FlashList
          data={prebuiltDecks}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          ListFooterComponent={<View className="pb-safe" />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ListRow
              testID={`deck-prebuilt-${item.id}`}
              label={item.name}
              detail={prebuiltDetail(item, (code) => pool.get(code)?.name ?? code)}
              onPress={() => onPrebuilt(item)}
            />
          )}
        />
      </View>
    </Screen>
  );
}
