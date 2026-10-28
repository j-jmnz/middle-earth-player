import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { BodyText, Chip, ListRow, Screen, SearchField, Section } from "./chrome";
import { BOOKLETS } from "./booklets/books";
import { GameIcon } from "../play/game-icon";
import { tileSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { GLOSSARY, searchGlossary } from "./rules-glossary";
import { useUiScale } from "../play/ui-scale";

// The books keep the testIDs they had on the campaign list; the others are `booklet-open-<id>`.
const BOOK_TEST_IDS: Readonly<Record<string, string>> = { "fellowship-of-the-ring": "booklet-open", "learn-to-play": "booklet-open-learn-to-play" };

// The glossary, searched by name, under `header`: the search first, since a player reaches for a rule mid-game. The Rules tab
// shows the books as covers at the head of the list, so they scroll away with the glossary (in landscape nothing else would
// scroll); the table's Rules opens it without them (the table has its own Booklet). The books step aside while a query is typed,
// so the keyboard leaves room for results. Four covers share one row from a tablet's width, two a row below it.
export function RulesView({ header, books, testID }: { header: ReactNode; books: boolean; testID: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const visible = useMemo(() => searchGlossary(GLOSSARY, search), [search]);
  const { width } = useWindowDimensions();
  const cover = width / s >= 600 ? "min-w-[22%] flex-1" : "min-w-[45%] flex-1";

  return (
    <Screen testID={testID} scene="plain">
      {header}
      <View className="mt-3 flex-row">
        <SearchField testID="rules-search" value={search} onChangeText={setSearch} placeholder="Search the rules" accessibilityLabel="Search the rules" />
      </View>
      <View className="min-h-0 flex-1">
        <FlashList
          data={visible}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <View testID="rules-list-head">
              {books && search.trim() === "" ? (
                <View className="mt-4">
                  <Section title="Books" />
                  <View className="flex-row flex-wrap gap-2.5">
                    {BOOKLETS.map((book) => (
                      <Pressable
                        key={book.id}
                        testID={BOOK_TEST_IDS[book.id] ?? `booklet-open-${book.id}`}
                        collapsable={false}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${book.name}`}
                        onPress={() => router.push({ pathname: "/booklet/[id]", params: { id: book.id } })}
                        className={cover}
                      >
                        {({ pressed }) => (
                          <View className="min-h-28 justify-between rounded-card p-4" style={tileSurface(pressed, t)}>
                            <GameIcon name="lore" size={22 * s} tint="gold" />
                            <Text className="mt-3 font-display text-heading text-bone" numberOfLines={3}>
                              {book.name}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <Section title="Glossary" className="mt-4" right={<Chip tone="faint" label={`${visible.length}`} />} />
            </View>
          }
          ListFooterComponent={<View className="pb-safe" />}
          ListEmptyComponent={
            <BodyText testID="rules-empty" tone="muted" className="mt-6">
              No rule matches.
            </BodyText>
          }
          renderItem={({ item }) => (
            <ListRow testID={`rule-${item.id}`} label={item.title} detail={item.source} onPress={() => router.push({ pathname: "/rule/[id]", params: { id: item.id } })} />
          )}
        />
      </View>
    </Screen>
  );
}
