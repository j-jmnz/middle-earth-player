import { FlashList } from "@shopify/flash-list";
import { eq, inArray } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, Text, TextInput, useWindowDimensions, View } from "react-native";

import {
  deckSaveRefusal,
  formatDeckRefusal,
  type DeckSaveCard,
  type DeckSaveRefusal,
} from "../../../catalog/deck-save";
import { cards } from "../../../catalog/schema";
import { BodyText, Label, ListRow, NavBar, PrimaryButton, Screen, TextButton, pressedNight } from "../../chrome";
import {
  changeDraftCount,
  getDeckDraft,
  removeDraftHero,
  replaceDeckDraft,
  setDeckName,
  useDeckDraft,
  type DeckDraft,
} from "../../deck-draft";
import { useDatabases } from "../../databases";
import { enqueueImageDownloads } from "../../images/queue";
import { CardThumb } from "../../images/picture";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { EmptyHeroSlot, HeroTile, type HeroFace } from "../../hero-tile";
import { decks } from "../../user-schema";

type Face = HeroFace & {
  typeCode: string;
  deckLimit: number | null;
  deckLegal: boolean;
  traits: string | null;
};

type EditorRow = {
  code: string;
  count: number;
  name: string;
  imagesrc: string | null;
  deckLimit: number | null;
};

const viewabilityConfig = { itemVisiblePercentThreshold: 10 };
const thumb = { width: 28, height: 38 };

function onViewableItemsChanged({ viewableItems }: { viewableItems: { item: EditorRow | null }[] }): void {
  const jobs = [];
  for (const token of viewableItems) {
    const item = token.item;
    if (!item?.imagesrc) continue;
    jobs.push({ code: item.code, imagesrc: item.imagesrc });
  }
  if (jobs.length > 0) enqueueImageDownloads(jobs);
}

function draftRefusal(draft: DeckDraft, faces: ReadonlyMap<string, Face>): DeckSaveRefusal | null {
  if (draft.name.trim().length === 0) {
    return { cardCode: null, cardName: null, rule: "Name the deck." };
  }
  if (draft.heldRefusal) return draft.heldRefusal;
  const facts = new Map<string, DeckSaveCard>();
  for (const [code, face] of faces) {
    facts.set(code, {
      name: face.name,
      typeCode: face.typeCode,
      sphereCode: face.sphereCode,
      deckLimit: face.deckLimit,
      deckLegal: face.deckLegal,
      traits: face.traits,
    });
  }
  return deckSaveRefusal(draft.heroes, draft.cards, facts, []);
}

function EditorRowView({ item }: { item: EditorRow }) {
  const router = useRouter();
  return (
    <ListRow
      testID={`deck-card-${item.code}`}
      label={item.name}
      leading={<CardThumb code={item.code} imagesrc={item.imagesrc} width={thumb.width} height={thumb.height} />}
      onPress={() => {
        router.push({ pathname: "/card/[code]", params: { code: item.code } });
      }}
      trailing={
        <View className="flex-row items-center">
          <Pressable
            testID={`count-dec-${item.code}`}
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={`Remove a copy of ${item.name}`}
            onPress={() => changeDraftCount(item.code, item.name, item.deckLimit, -1)}
            className="min-h-11 min-w-11 items-center justify-center rounded-tile"
            style={({ pressed }) => (pressed ? pressedNight : undefined)}
          >
            <Text className="text-body text-bone">−</Text>
          </Pressable>
          <Text testID={`count-${item.code}`} className="min-w-6 text-center text-body text-bone">
            {String(item.count)}
          </Text>
          <Pressable
            testID={`count-inc-${item.code}`}
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={`Add a copy of ${item.name}`}
            onPress={() => changeDraftCount(item.code, item.name, item.deckLimit, 1)}
            className="min-h-11 min-w-11 items-center justify-center rounded-tile"
            style={({ pressed }) => (pressed ? pressedNight : undefined)}
          >
            <Text className="text-body text-bone">+</Text>
          </Pressable>
        </View>
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
  const baseTile = Math.max(120, Math.min(Math.round(height / 3), height - 340));
  const tileHeight = draft.heroes.length > 3 ? Math.max(96, Math.round(baseTile * 0.55)) : baseTile;

  useEffect(() => {
    if (!id || getDeckDraft().id === id) return;
    if (id === "new") {
      replaceDeckDraft({ id: "new", name: "", heroes: [], cards: [], heldRefusal: null, droppedNote: null });
      return;
    }
    const row = user
      .select({ id: decks.id, name: decks.name, heroes: decks.heroes, cards: decks.cards })
      .from(decks)
      .where(eq(decks.id, id))
      .get();
    if (!row) {
      replaceDeckDraft({ id: "new", name: "", heroes: [], cards: [], heldRefusal: null, droppedNote: null });
      return;
    }
    replaceDeckDraft({
      id: row.id,
      name: row.name,
      heroes: [...row.heroes],
      cards: row.cards.map((card) => ({ code: card.code, count: card.count })),
      heldRefusal: null,
      droppedNote: null,
    });
  }, [id, user]);

  const codeKey = [...draft.heroes, ...draft.cards.map((card) => card.code)].join("\0");
  const faces = useMemo(() => {
    const codes = codeKey.length === 0 ? [] : codeKey.split("\0");
    if (codes.length === 0) return new Map<string, Face>();
    const rows = catalog
      .select({
        code: cards.code,
        name: cards.name,
        typeCode: cards.typeCode,
        sphereCode: cards.sphereCode,
        sphereName: cards.sphereName,
        deckLimit: cards.deckLimit,
        deckLegal: cards.deckLegal,
        traits: cards.traits,
        imagesrc: cards.imagesrc,
      })
      .from(cards)
      .where(inArray(cards.code, codes))
      .all();
    return new Map(rows.map((row) => [row.code, row]));
  }, [catalog, codeKey]);

  const rows: EditorRow[] = draft.cards.map((card) => {
    const face = faces.get(card.code);
    return {
      code: card.code,
      count: card.count,
      name: face?.name ?? card.code,
      imagesrc: face?.imagesrc ?? null,
      deckLimit: face?.deckLimit ?? null,
    };
  });
  const total = draft.cards.reduce((sum, card) => sum + card.count, 0);
  const refusal = draftRefusal(draft, faces);
  const heroes = draft.heroes.map(
    (code) => faces.get(code) ?? { code, name: code, sphereCode: null, sphereName: null, imagesrc: null },
  );
  const emptySlots = Math.max(0, 3 - heroes.length);

  function onSave(): void {
    const current = getDeckDraft();
    if (draftRefusal(current, faces)) return;
    const name = current.name.trim();
    const heroes = [...current.heroes];
    const nextCards = current.cards.map((card) => ({ code: card.code, count: card.count }));
    if (current.id === "new") {
      user.insert(decks).values({ id: crypto.randomUUID(), name, heroes, cards: nextCards }).run();
    } else {
      user.update(decks).set({ name, heroes, cards: nextCards }).where(eq(decks.id, current.id)).run();
    }
    router.back();
  }

  if (!id) throw new Error("Missing route code");

  return (
    <Screen testID="deck-editor" scene="plain">
      <View className="min-h-0 flex-1">
        <NavBar backLabel="Decks" backTestID="deck-back" onBack={() => router.back()} />
        <View className={heroes.length > 3 ? "mt-2 flex-row flex-wrap justify-between" : "mt-2 flex-row gap-2"}>
          {heroes.map((hero) => (
            <View
              key={hero.code}
              style={heroes.length > 3 ? { width: "48%", height: tileHeight, marginBottom: 8 } : { flex: 1 }}
            >
              <HeroTile hero={hero} height={tileHeight} onRemove={() => removeDraftHero(hero.code)} />
            </View>
          ))}
          {Array.from({ length: emptySlots }, (_, index) => (
            <View key={`empty-${index}`} className="flex-1">
              <EmptyHeroSlot height={tileHeight} />
            </View>
          ))}
        </View>
        <TextInput
          testID="deck-name"
          value={draft.name}
          onChangeText={setDeckName}
          placeholder="Deck name"
          placeholderTextColor={palette.faint}
          className="mt-4 font-display text-title text-bone"
          style={{ minHeight: 44 }}
        />
        <Label tone={total < 50 ? "danger" : "muted"} className="mt-2">
          {`${total} of 50`}
        </Label>
        {draft.droppedNote ? (
          <BodyText testID="deck-import-dropped" tone="muted" className="mt-2">
            {draft.droppedNote}
          </BodyText>
        ) : null}
        {refusal ? (
          <BodyText testID="deck-error" tone="danger" className="mt-2">
            {formatDeckRefusal(refusal)}
          </BodyText>
        ) : null}
        <View className="mt-2 min-h-0 flex-1">
          <FlashList
            data={rows}
            keyExtractor={(item) => item.code}
            style={{ flex: 1 }}
            extraData={total}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <EditorRowView item={item} />}
          />
        </View>
        <View className="pb-safe">
          <TextButton
            testID="deck-add"
            label="Add cards"
            onPress={() => {
              router.push({ pathname: "/pool", params: { adding: "1" } });
            }}
          />
          <View className="mt-2">
            <PrimaryButton testID="deck-save" label="Save" disabled={refusal !== null} onPress={onSave} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
