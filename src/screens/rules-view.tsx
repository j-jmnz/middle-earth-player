import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from "react-native";

import { BodyText, Chip, ListRow, Screen, SearchField, Section, TwoPane } from "./chrome";
import { BOOKLETS } from "./booklets/books";
import { GameIcon } from "../play/game-icon";
import { tileSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { RuleBody } from "./rule-detail";
import { GLOSSARY, glossaryEntry, searchGlossary } from "./rules-glossary";
import { capWidth } from "../play/size-class";
import { useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";

// The books keep the testIDs they had on the campaign list; the others are `booklet-open-<id>`.
const BOOK_TEST_IDS: Readonly<Record<string, string>> = { "fellowship-of-the-ring": "booklet-open", "learn-to-play": "booklet-open-learn-to-play" };

// The books as lit covers: two to a row at phone width (and in the expanded right pane), four to a row in a medium window.
function BookCovers({ cover }: { cover: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  const router = useRouter();
  return (
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
  );
}

// The glossary, searched by name, under `header`: the search first, since a player reaches for a rule mid-game. The Rules tab
// shows the books as covers at the head of the list, so they scroll away with the glossary (in landscape nothing else would
// scroll); the table's Rules opens it without them (the table has its own Booklet). The books step aside while a query is typed,
// so the keyboard leaves room for results. Four covers share one row from a tablet's width, two a row below it. Expanded, it is a
// list-detail (docs/design-system.md, Rules): the search and the glossary at the left, the picked rule at the right, and in the empty
// right pane the books (the Rules tab) or a line saying what to do (the glossary); medium sits the phone's list in a readable column.
export function RulesView({ header, books, testID }: { header: ReactNode; books: boolean; testID: string }) {
  const { size, s } = useSizeClass();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const visible = useMemo(() => searchGlossary(GLOSSARY, search), [search]);
  const expanded = size === "expanded";
  const cover = size === "medium" ? "min-w-[22%] flex-1" : "min-w-[45%] flex-1";
  const entry = picked ? glossaryEntry(picked) : null;
  const listRef = useRef<FlashListRef<(typeof visible)[number]>>(null);
  // A pick made in the pane (See also) brings its row into view in the list, when the search leaves it there, and is announced.
  // Only a new pick moves the list; typing in the search does not.
  useEffect(() => {
    if (!expanded || !picked) return;
    const at = visible.findIndex((item) => item.id === picked);
    if (at >= 0) void listRef.current?.scrollToIndex({ index: at, animated: true });
    const title = glossaryEntry(picked)?.title;
    if (title) AccessibilityInfo.announceForAccessibility(title);
  }, [picked, expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchRow = (
    <View className="mt-3 flex-row">
      <SearchField testID="rules-search" value={search} onChangeText={setSearch} placeholder="Search the rules" accessibilityLabel="Search the rules" />
    </View>
  );
  const list = (
    <View className="min-h-0 flex-1">
      <FlashList
        ref={listRef}
        data={visible}
        extraData={picked}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View testID="rules-list-head">
            {books && expanded ? <ListRow testID="rules-books-row" label="Books" detail="The rule books and the campaign books" selected={picked === null} onPress={() => setPicked(null)} /> : null}
            {books && !expanded && search.trim() === "" ? (
              <View className="mt-4">
                <Section title="Books" />
                <BookCovers cover={cover} />
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
          <ListRow
            testID={`rule-${item.id}`}
            label={item.title}
            detail={item.source}
            selected={expanded ? item.id === picked : undefined}
            onPress={expanded ? () => setPicked(item.id) : () => router.push({ pathname: "/rule/[id]", params: { id: item.id } })}
          />
        )}
      />
    </View>
  );

  if (expanded) {
    return (
      <Screen testID={testID} scene="plain">
        {header}
        <TwoPane
          kind="list-detail"
          start={
            <>
              {searchRow}
              {list}
            </>
          }
          end={
            <ScrollView key={picked ?? "none"} testID="rules-detail" className="min-h-0 flex-1" contentContainerStyle={{ paddingTop: 16 * s }} showsVerticalScrollIndicator={false}>
              {/* The text keeps a reading column's width, at the pane's start edge beside the list. */}
              <View style={{ width: "100%", maxWidth: capWidth(size, "readable", s) ?? undefined }}>
                {entry ? (
                  <RuleBody entry={entry} onSeeAlso={setPicked} />
                ) : books ? (
                  <View testID="rules-books">
                    <Section title="Books" />
                    <BookCovers cover={cover} />
                  </View>
                ) : (
                  <BodyText testID="rules-pick" tone="muted">
                    Choose a rule to read it here.
                  </BodyText>
                )}
              </View>
            </ScrollView>
          }
        />
      </Screen>
    );
  }

  // Medium sits the search and the list in a reading column under a full-width header; compact is the phone's list, unwrapped.
  const cap = capWidth(size, "readable", s);
  return (
    <Screen testID={testID} scene="plain">
      {header}
      {cap == null ? (
        <>
          {searchRow}
          {list}
        </>
      ) : (
        <View className="min-h-0 flex-1" style={{ width: "100%", maxWidth: cap, alignSelf: "center" }}>
          {searchRow}
          {list}
        </View>
      )}
    </Screen>
  );
}
