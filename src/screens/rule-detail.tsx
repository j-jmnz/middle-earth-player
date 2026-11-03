// One rule as its book prints it, with the rules it sends the reader on to (docs/design-system.md, Rule). The Rule route scrolls it
// alone; the Rules and Glossary list-detail (rules-view.tsx) shows it in the right pane, where See also picks another rule in place.
import { useRouter } from "expo-router";
import { View } from "react-native";

import { CardTextView } from "../play/cards/card-text-view";
import { Text } from "../ui/text";
import { useUiScale } from "../ui/ui-scale";
import { Eyebrow, Label, ScreenTitle, SecondaryButton, ToggleChip } from "./chrome";
import { bookPage, glossary, paragraphs, seeAlso, type GlossaryEntry } from "./rules-glossary";

/**
 * One rule: where it is printed, its title, Open in book when the app carries the book, its text, and See also as chips. `reading`
 * sets it as the reading pane beside the list on a tablet: on the ground, the title at 38, the text at 18/28 in a 560 column.
 */
export function RuleBody({ entry, onSeeAlso, reading = false }: { entry: GlossaryEntry; onSeeAlso: (id: string) => void; reading?: boolean }) {
  const router = useRouter();
  const s = useUiScale();
  const body = paragraphs(entry).filter((paragraph) => !paragraph.startsWith("See also:"));
  const links = seeAlso(entry, glossary());
  const book = bookPage(entry);

  const title = reading ? (
    <Text accessibilityRole="header" className="font-display text-bone" style={{ fontSize: 38 * s, lineHeight: 44 * s }}>
      {entry.title}
    </Text>
  ) : (
    <ScreenTitle size="title">{entry.title}</ScreenTitle>
  );
  // A rule from a book the app carries opens the reader on its page; Close comes back here.
  const openBook = book ? (
    <View className="mt-2 flex-row">
      <SecondaryButton
        label={`Open in book · page ${book.page}`}
        icon="lore"
        testID="rule-open-book"
        accessibilityLabel={`Open ${book.name} at page ${book.page}`}
        onPress={() => router.push({ pathname: "/booklet/[id]", params: { id: book.id, page: String(book.page) } })}
      />
    </View>
  ) : null;
  const text = <CardTextView text={body.join("\n")} testID="rule-text" reading={reading} />;
  const seeAlsoRow =
    links.length > 0 ? (
      <View testID="rule-see-also">
        <Eyebrow>See also</Eyebrow>
        <View className="mt-1 flex-row flex-wrap items-center gap-x-1.5">
          {links.map(({ name, entry: target }) =>
            target ? (
              <ToggleChip key={name} label={name} testID={`see-${target.id}`} onPress={() => onSeeAlso(target.id)} />
            ) : (
              <View key={name} className="min-h-touch justify-center px-3">
                <Label tone="faint">{name}</Label>
              </View>
            ),
          )}
        </View>
      </View>
    ) : null;

  if (reading) {
    return (
      <View className="pb-safe">
        <View className="gap-5">
          <View className="gap-1">
            <Eyebrow>{entry.source}</Eyebrow>
            {title}
            {openBook}
          </View>
          <View style={{ maxWidth: 560 * s }}>{text}</View>
          {seeAlsoRow}
        </View>
      </View>
    );
  }
  return (
    <View className="gap-4 pb-safe">
      <View className="gap-1">
        <Eyebrow>{entry.source}</Eyebrow>
        {title}
        {openBook}
      </View>
      {text}
      {seeAlsoRow}
    </View>
  );
}
