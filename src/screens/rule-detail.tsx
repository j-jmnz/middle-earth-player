// One rule as its book prints it, with the rules it sends the reader on to (docs/design-system.md, Rule). The Rule route scrolls it
// alone; the Rules and Glossary list-detail (rules-view.tsx) shows it in the right pane, where See also picks another rule in place.
import { useRouter } from "expo-router";
import { View } from "react-native";

import { CardTextView } from "../play/card-text-view";
import { Eyebrow, Label, Panel, ScreenTitle, SecondaryButton, TextButton } from "./chrome";
import { GLOSSARY, bookPage, paragraphs, seeAlso, type GlossaryEntry } from "./rules-glossary";

export function RuleBody({ entry, onSeeAlso }: { entry: GlossaryEntry; onSeeAlso: (id: string) => void }) {
  const router = useRouter();
  const body = paragraphs(entry).filter((paragraph) => !paragraph.startsWith("See also:"));
  const links = seeAlso(entry, GLOSSARY);
  const book = bookPage(entry);

  return (
    <View className="gap-4 pb-safe">
      <View className="gap-1">
        <Eyebrow>{entry.source}</Eyebrow>
        <ScreenTitle size="title">{entry.title}</ScreenTitle>
        {/* A rule from a book the app carries opens the reader on its page; Close comes back here. */}
        {book ? (
          <View className="mt-2 flex-row">
            <SecondaryButton
              label={`Open in book · page ${book.page}`}
              icon="lore"
              testID="rule-open-book"
              tone="accent"
              compact
              accessibilityLabel={`Open ${book.name} at page ${book.page}`}
              onPress={() => router.push({ pathname: "/booklet/[id]", params: { id: book.id, page: String(book.page) } })}
            />
          </View>
        ) : null}
      </View>
      <Panel>
        <CardTextView text={body.join("\n")} testID="rule-text" />
      </Panel>
      {links.length > 0 ? (
        <View testID="rule-see-also">
          <Eyebrow tone="moon">See also</Eyebrow>
          <View className="-mx-3 flex-row flex-wrap items-center">
            {links.map(({ name, entry: target }) =>
              target ? (
                <TextButton key={name} label={name} testID={`see-${target.id}`} tone="accent" onPress={() => onSeeAlso(target.id)} />
              ) : (
                <View key={name} className="min-h-touch justify-center px-3">
                  <Label tone="faint">{name}</Label>
                </View>
              ),
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
