// "Rules on this page", for a screen reader only (user instruction, 2026-11-05): the PDF's words are an image to TalkBack and
// VoiceOver, so this lists the rule entries printed on the page being read, which open in the rules reader. It draws nothing for a
// sighted user (docs/design-system.md, Booklet).
import { useRouter } from "expo-router";
import { useState, useSyncExternalStore } from "react";
import { ScrollView, View } from "react-native";

import { useReaderMode } from "../../ui/screen-reader";
import { useUiScale } from "../../ui/ui-scale";
import { ListRow, SecondaryButton } from "../kit/chrome";
import { glossary } from "../rules/glossary";
import type { BookletId } from "./books";
import { bookletPageOf, subscribeBookletPage } from "./page-store";
import { pageRulesLabel, rulesOnPage } from "./page-rules";

function PageRules({ id, first }: { id: BookletId; first: number }) {
  const router = useRouter();
  const s = useUiScale();
  const [open, setOpen] = useState(false);
  const reported = useSyncExternalStore(
    subscribeBookletPage,
    () => bookletPageOf(id),
    () => null,
  );
  const page = reported ?? first;
  const rows = rulesOnPage(glossary(), id, page);
  return (
    <View testID="booklet-page-rules" className="items-center pb-1">
      <SecondaryButton
        label="Rules on this page"
        testID="booklet-page-rules-open"
        accessibilityLabel={pageRulesLabel(page, rows.length)}
        expanded={open && rows.length > 0}
        disabled={rows.length === 0}
        onPress={() => setOpen(!open)}
      />
      {open && rows.length > 0 ? (
        <ScrollView style={{ maxHeight: 240 * s, alignSelf: "stretch" }} className="px-4">
          {rows.map((entry) => (
            <ListRow key={entry.id} label={entry.title} testID={`booklet-rule-${entry.id}`} onPress={() => router.push({ pathname: "/rule/[id]", params: { id: entry.id } })} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function PageRulesButton({ id, first }: { id: BookletId; first: number }) {
  const reader = useReaderMode();
  return reader ? <PageRules id={id} first={first} /> : null;
}
