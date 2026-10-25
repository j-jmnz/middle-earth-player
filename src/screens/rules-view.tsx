import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { TextInput, View } from "react-native";

import { BodyText, Eyebrow, ListRow, Screen } from "./chrome";
import { BOOKLETS } from "./booklets/books";
import { palette } from "./palette.js";
import { GLOSSARY, searchGlossary } from "./rules-glossary";

// The books keep the testIDs they had on the campaign list.
const BOOK_TEST_IDS: Readonly<Record<string, string>> = { "fellowship-of-the-ring": "booklet-open", "learn-to-play": "booklet-open-learn-to-play" };

// The glossary, searched by name, under `header`. The Rules tab shows the two books above it; the table's Rules opens it
// without them (the table has its own Booklet). The books step aside while a query is typed, so the keyboard leaves room
// for results.
export function RulesView({ header, books, testID }: { header: ReactNode; books: boolean; testID: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const visible = useMemo(() => searchGlossary(GLOSSARY, search), [search]);

  return (
    <Screen testID={testID} scene="plain">
      {header}
      {books && search.trim() === "" ? (
        <View className="mt-4">
          <Eyebrow>Books</Eyebrow>
          {BOOKLETS.map((book) => (
            <ListRow
              key={book.id}
              testID={BOOK_TEST_IDS[book.id] ?? `booklet-open-${book.id}`}
              label={book.name}
              onPress={() => router.push({ pathname: "/booklet/[id]", params: { id: book.id } })}
            />
          ))}
        </View>
      ) : null}
      <View className="mt-6 gap-2">
        <Eyebrow>Glossary</Eyebrow>
        <TextInput
          testID="rules-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search the rules"
          placeholderTextColor={palette.faint}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search the rules"
          className="min-h-11 min-w-0 rounded-pill bg-raised px-4 text-body text-bone"
        />
      </View>
      <View className="mt-2 min-h-0 flex-1">
        <FlashList
          data={visible}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
