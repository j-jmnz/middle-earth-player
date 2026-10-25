import { FlashList } from "@shopify/flash-list";
import { inArray } from "drizzle-orm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useWindowDimensions, View } from "react-native";

import { cards } from "../../../catalog/schema";
import { BodyText, Screen, ScreenTitle, TextButton } from "../../chrome";
import { replaceDeckDraft, startNewDeck } from "../../deck-draft";
import { useDatabases } from "../../databases";
import { DeckCover, type HeroFace } from "../../hero-tile";
import {
  STARTER_NOTE,
  STEALTH_ID,
  WISDOM_ID,
  starterSeedReason,
  starterSeedStatus,
  subscribeStarterSeed,
  type StarterSeed,
} from "../../starter-decks";
import { decks, type DeckCard } from "../../user-schema";

type SavedDeck = {
  id: string;
  name: string;
  heroes: string[];
  cards: DeckCard[];
};

const STARTER_IDS = new Set([STEALTH_ID, WISDOM_ID]);

function useSeedStatus(): StarterSeed {
  return useSyncExternalStore(subscribeStarterSeed, starterSeedStatus, () => "pending");
}

function useSeedReason(): string | null {
  return useSyncExternalStore(subscribeStarterSeed, starterSeedReason, () => null);
}

export default function Decks() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const seed = useSeedStatus();
  const seedReason = useSeedReason();
  const { catalog, user } = useDatabases();
  const [seen, setSeen] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setSeen((current) => current + 1);
    }, []),
  );
  const saved = useMemo(() => {
    if (seed === "pending" || seen < 0) return [];
    return user
      .select({ id: decks.id, name: decks.name, heroes: decks.heroes, cards: decks.cards })
      .from(decks)
      .all();
  }, [seed, seen, user]);
  const faces = useMemo(() => {
    const codes = [...new Set(saved.flatMap((deck) => deck.heroes))];
    if (codes.length === 0) return new Map<string, HeroFace>();
    const rows = catalog
      .select({
        code: cards.code,
        name: cards.name,
        sphereCode: cards.sphereCode,
        sphereName: cards.sphereName,
        imagesrc: cards.imagesrc,
      })
      .from(cards)
      .where(inArray(cards.code, codes))
      .all();
    return new Map(rows.map((row) => [row.code, row]));
  }, [catalog, saved]);

  const starters = saved.filter((deck) => STARTER_IDS.has(deck.id));
  const others = saved.filter((deck) => !STARTER_IDS.has(deck.id));
  const starterHeight = 168;
  const otherHeight = 220;
  const coverWidth = Math.max(0, width - 48);

  function openDeck(deck: SavedDeck): void {
    replaceDeckDraft({
      id: deck.id,
      name: deck.name,
      heroes: [...deck.heroes],
      cards: deck.cards.map((card) => ({ code: card.code, count: card.count })),
      heldRefusal: null,
      droppedNote: null,
    });
    router.push({ pathname: "/deck/[id]", params: { id: deck.id } });
  }

  function facesFor(deck: SavedDeck): HeroFace[] {
    return deck.heroes.map((code) => faces.get(code) ?? { code, name: code, sphereCode: null, sphereName: null, imagesrc: null });
  }

  return (
    <Screen testID="decks" scene="plain">
      <View className="flex-1">
        <View className="pt-6">
          <ScreenTitle>Decks</ScreenTitle>
          {seed !== "pending" ? (
            <View className="mt-2 flex-row">
              <TextButton
                testID="deck-import"
                label="Import"
                onPress={() => {
                  router.push("/deck-import");
                }}
              />
              <TextButton
                testID="deck-new"
                label="New"
                onPress={() => {
                  startNewDeck();
                  router.push({ pathname: "/deck/[id]", params: { id: "new" } });
                }}
              />
            </View>
          ) : null}
        </View>
        {seed === "pending" ? (
          <BodyText tone="muted" className="mt-6">
            Loading
          </BodyText>
        ) : (
          <>
            {seed === "missing" ? (
              <View className="mt-6 gap-2">
                <BodyText tone="danger" testID="starter-missing">
                  The starter decks are missing.
                </BodyText>
                {seedReason ? (
                  <BodyText tone="danger" testID="starter-missing-reason">
                    {seedReason}
                  </BodyText>
                ) : null}
              </View>
            ) : (
              <View className="mt-4">
                <View className="flex-row gap-3">
                  {starters.map((deck) => (
                    <View key={deck.id} className="flex-1">
                      <DeckCover
                        testID={`deck-${deck.id}`}
                        name={deck.name}
                        heroes={facesFor(deck)}
                        height={starterHeight}
                        onPress={() => openDeck(deck)}
                      />
                    </View>
                  ))}
                </View>
                <BodyText testID="starter-note" tone="muted" className="mt-4">
                  {STARTER_NOTE}
                </BodyText>
              </View>
            )}
            {others.length > 0 ? (
              <View className="mt-4 min-h-0 flex-1">
                <FlashList
                  data={others}
                  keyExtractor={(item) => item.id}
                  style={{ flex: 1 }}
                  renderItem={({ item }) => (
                    <View className="pb-4" style={{ width: coverWidth }}>
                      <DeckCover
                        testID={`deck-${item.id}`}
                        name={item.name}
                        heroes={facesFor(item)}
                        height={otherHeight}
                        onPress={() => openDeck(item)}
                      />
                    </View>
                  )}
                />
              </View>
            ) : (
              <View className="flex-1" />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
