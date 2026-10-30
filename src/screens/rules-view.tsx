import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";

import { BodyText, ListRow, Screen, SearchField, Section, TwoPane } from "./chrome";
import { BOOKLETS } from "./booklets/books";
import { GameIcon } from "../play/game-icon";
import { tileSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { withAlphaHex } from "../play/tokens";
import { SceneArt } from "./art";
import { usePalette } from "./palette-hook";
import { RuleBody } from "./rule-detail";
import { glossary, glossaryEntry, searchGlossary } from "./rules-glossary";
import { capWidth } from "../play/size-class";
import { useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";
import { Text } from "../play/text";

// The books keep the testIDs they had on the campaign list; the others are `booklet-open-<id>`.
const BOOK_TEST_IDS: Readonly<Record<string, string>> = { "fellowship-of-the-ring": "booklet-open", "learn-to-play": "booklet-open-learn-to-play" };

// The scene each book's tile opens on: the first scenario it prints. The Rules Reference has none and shows the fog.
const BOOK_SCENE: Readonly<Record<string, string>> = {
  "fellowship-of-the-ring": "a-shadow-of-the-past",
  "learn-to-play": "passage-through-mirkwood",
  "the-dark-of-mirkwood": "the-oath",
};

// The books as tiles 150 pt tall: the scene of the book dimmed under its name, the Lore book glowing in the corner. Two to a row at
// phone width (and in the expanded right pane), four to a row in a medium window.
function BookCovers({ cover }: { cover: string }) {
  const palette = usePalette();
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
            <View className="overflow-hidden rounded-item" style={{ height: 150 * s, ...tileSurface(pressed, t) }}>
              {BOOK_SCENE[book.id] ? <SceneArt scenarioId={BOOK_SCENE[book.id]} height={150 * s} fade={0.25} fadeTo={palette.dusk} /> : null}
              <View className="absolute bottom-0 left-0 right-0 top-0 justify-between p-3">
                <View style={{ filter: `drop-shadow(0 0 6px ${withAlphaHex(palette.glow, 0.7)})` }}>
                  <GameIcon name="lore" size={22 * s} tint="accent" />
                </View>
                <Text className="font-display text-heading text-bone" numberOfLines={3}>
                  {book.name}
                </Text>
              </View>
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
  // The field shows each keystroke at once; the results catch up when React has time, so typing never waits on the search.
  const query = useDeferredValue(search);
  const visible = useMemo(() => searchGlossary(glossary(), query), [query]);
  const expanded = size === "expanded";
  const cover = size === "medium" ? "min-w-[22%] flex-1" : "min-w-[45%] flex-1";
  const entry = picked ? glossaryEntry(picked) : null;
  const listRef = useRef<FlashListRef<(typeof visible)[number]>>(null);
  // A pick made in the pane (See also) brings its row into view in the list, when the search leaves it there, and is announced.
  // Only a new pick moves the list; typing in the search does not.
  const reveal = useEffectEvent((id: string) => {
    const at = visible.findIndex((item) => item.id === id);
    if (at >= 0) void listRef.current?.scrollToIndex({ index: at, animated: true });
    const title = glossaryEntry(id)?.title;
    if (title) AccessibilityInfo.announceForAccessibility(title);
  });
  useEffect(() => {
    if (!expanded || !picked) return;
    reveal(picked);
  }, [picked, expanded]);

  const searchRow = (
    <View className="mt-1 flex-row">
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
            <Section title="Glossary" className="mt-4" right={<Text className="text-label text-faint">{`${visible.length}`}</Text>} />
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
      <Screen testID={testID} scene="calm">
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
              {/* The text keeps a reading column's width, at the pane's start edge beside the list, on a floating panel. */}
              <View style={{ width: "100%", maxWidth: capWidth(size, "readable", s) ?? undefined }}>
                {entry ? (
                  <RuleBody entry={entry} onSeeAlso={setPicked} reading />
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
    <Screen testID={testID} scene="calm">
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
