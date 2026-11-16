import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { View } from "react-native";

import { formatDeckRefusal } from "../../catalog/deck-save";
import { BodyText, ListRow, NavBar, PrimaryButton, Screen, ScreenTitle, SearchField, Section, SphereMark, markedSphere, type MarkedSphere } from "../kit/chrome";
import { startNewDeck } from "../deck/draft";
import { savedDeckName } from "../deck/status";
import { listDecks, readDeck, writeDeck } from "../deck/store";
import { buildDecklist, cardUrl, deckRefusal, droppedSentence, fetchFailureMessage, parseDecklistRef, prebuiltBody, prebuiltList, prebuiltNotApplied, withNotApplied, prebuiltDetail, readDecklistBody, ringsDbUrl, type BuiltDecklist, type FetchFailure, type PrebuiltRow } from "../deck/import";
import { useDatabases } from "../data/databases";
import { poolOf } from "../pool/cache";
import type { PrebuiltDeck } from "../../catalog/prebuilt-deck";
import { useUiScale } from "../../ui/ui-scale";
import { goBack } from "../nav/go-back";
import { useListGutter } from "../nav/list-gutter";
import { showToast } from "../kit/toast";

// A failed request, read by fetchFailureMessage (deck/import.ts).
class RingsDbFailure extends Error {
  readonly failure: FetchFailure;
  constructor(failure: FetchFailure) {
    super("RingsDB request failed");
    this.failure = failure;
  }
}

const PRIVATE_DECK = "That deck is not shared. Its owner turns on Share my decks in their RingsDB account settings.";
const MISSING_DECK = "RingsDB has no deck with that number.";

async function readJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new RingsDbFailure({ kind: "no-answer" });
  }
  if (!response.ok) throw new RingsDbFailure({ kind: "status", status: response.status });
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

// The try/catch and try/finally below live here because the React Compiler cannot compile them inside a component.
// The deck or decklist as fetched, how the request failed, or null when the answer was not JSON.
async function fetchJson(url: string): Promise<{ payload: unknown } | { failure: FetchFailure } | null> {
  try {
    return { payload: await readJson(url) };
  } catch (error) {
    return error instanceof RingsDbFailure ? { failure: error.failure } : null;
  }
}

// Runs `run` with the busy flag up, and down again however it ends.
async function whileBusy(setBusy: (busy: boolean) => void, run: () => Promise<void>): Promise<void> {
  setBusy(true);
  try {
    await run();
  } finally {
    setBusy(false);
  }
}

export default function DeckImportScreen() {
  const router = useRouter();
  const list = useListGutter("readable", 0);
  const scale = useUiScale();
  const pad = list.inset > 0 ? { paddingHorizontal: Math.max(list.inset, 24 * scale) } : undefined;
  const { catalog, user } = useDatabases();
  // The deck-legal pool and the cards with a line the app does not apply: read once per catalog (pool/cache.ts), shared with the Cards tab and the
  // deck editor. A pre-built deck row says how many of its cards the app does not fully apply (docs/brief.md, Three layers), so the
  // player can pick a deck the app plays as printed.
  const { byCode: pool, notApplied: inactive } = poolOf(catalog);
  // The list is built on the first look (deck/import.ts); each group heading stays at the top while its decks scroll under it.
  const { rows: prebuiltRows, sticky } = prebuiltList();
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
    const ref = parseDecklistRef(value);
    if (!ref) {
      setMessage("That is not a RingsDB deck or decklist.");
      return;
    }
    await whileBusy(setBusy, async () => {
      const fetched = await fetchJson(ringsDbUrl(ref));
      if (fetched && "failure" in fetched) {
        setMessage(fetchFailureMessage(ref, fetched.failure));
        return;
      }
      // A deck its owner does not share, or an unknown id, comes back as a refusal with status 200, not an error status.
      const refusal = fetched ? deckRefusal(fetched.payload) : null;
      if (refusal) {
        setMessage(refusal === "private" ? PRIVATE_DECK : MISSING_DECK);
        return;
      }
      const body = fetched ? readDecklistBody(fetched.payload) : null;
      if (!body) {
        setMessage("That decklist could not be read.");
        return;
      }
      const built = buildDecklist(body, pool);
      const names = await Promise.all(built.droppedCodes.map((code) => droppedName(code)));
      save(built, names);
    });
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

  // Saves an imported deck, ready to play or not, and goes back to the deck list. A hero listed twice is refused: the list
  // itself is wrong.
  function save(built: BuiltDecklist, names: readonly string[]): void {
    if (built.heroLimit) {
      setMessage(formatDeckRefusal({ cardName: built.heroLimit.cardName, rule: "Deck limit is 1." }));
      return;
    }
    const name = savedDeckName(built.name, listDecks(user).map((deck) => deck.name));
    const id = writeDeck(user, { id: null, name, heroes: built.heroes, cards: built.cards });
    if (!readDeck(user, id)) return;
    opening.current = true;
    // Back on the deck list, which reads the new deck on focus; the toast names what was dropped.
    const dropped = droppedSentence(names);
    showToast(dropped ? `Imported ${name}. ${dropped}` : `Imported ${name}`, { carry: true });
    goBack(router, "/decks");
  }

  // The heroes' spheres, once each, in hero order.
  function spheres(deck: PrebuiltDeck): MarkedSphere[] {
    return [...new Set(deck.heroes.flatMap((code) => markedSphere(pool.get(code)?.sphereCode ?? null) ?? []))];
  }

  // The screen is not inset, so a pinned group heading spans the width as a bar; every row pads itself.
  const form = (
    <View className="px-6 pb-2" style={pad}>
      <View className="pt-6">
        <ScreenTitle>Import</ScreenTitle>
      </View>
      <Section title="RingsDB" className="mt-4" />
      <View className="flex-row">
        <SearchField testID="deck-import-input" value={value} onChangeText={setValue} placeholder="RingsDB URL or decklist ID" accessibilityLabel="RingsDB deck or decklist link, or decklist number" search={false} />
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
        <View accessibilityRole="header" className="px-6 pb-1 pt-4" style={pad}>
          <Section title={item.title} />
        </View>
      );
    }
    const deck = item.deck;
    return (
      <View className="px-6" style={pad}>
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
    <Screen scene="calm" inset={false}>
      <View className="px-6">
        <NavBar backLabel="Decks" backTestID="deck-import-back" onBack={() => goBack(router, "/decks")} />
      </View>
      <View className="min-h-0 flex-1" onLayout={list.onLayout}>
        <FlashList
          data={prebuiltRows}
          keyExtractor={(item) => (item.kind === "group" ? `group-${item.title}` : item.deck.id)}
          getItemType={(item) => item.kind}
          renderItem={renderRow}
          stickyHeaderIndices={sticky}
          ListHeaderComponent={form}
          ListFooterComponent={<View className="pb-safe" />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
