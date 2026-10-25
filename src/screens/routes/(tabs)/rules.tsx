import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";

import { BodyText, Eyebrow, ListRow, Screen, ScreenTitle } from "../../chrome";
import { BOOKLETS } from "../../booklets/books";
import { palette } from "../../palette.js";
import { GLOSSARY, searchGlossary } from "../../rules-glossary";

// The books keep the testIDs they had on the campaign list.
const BOOK_TEST_IDS: Readonly<Record<string, string>> = { "fellowship-of-the-ring": "booklet-open", "learn-to-play": "booklet-open-learn-to-play" };

// The rules a player reaches for mid-game: the two books in the reader, and every rule span searchable by name.
export default function Rules() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const visible = useMemo(() => searchGlossary(GLOSSARY, search), [search]);

  return (
    <Screen testID="rules" scene="plain">
      <View className="pt-6">
        <ScreenTitle>Rules</ScreenTitle>
      </View>
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
          className="min-h-11 rounded-pill bg-raised px-4 text-body text-bone"
        />
      </View>
      <View className="mt-2 min-h-0 flex-1">
        <FlashList
          data={visible}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
