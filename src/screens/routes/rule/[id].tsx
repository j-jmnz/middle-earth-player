import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { CardTextView } from "../../../play/card-text-view";
import { BodyText, Eyebrow, Label, NavBar, Screen, ScreenTitle, TextButton } from "../../chrome";
import { goBack } from "../../go-back";
import { routeCode } from "../../route-code";
import { GLOSSARY, glossaryEntry, paragraphs, seeAlso } from "../../rules-glossary";

// One rule span as its book prints it, with the rules it sends the reader on to.
export default function Rule() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeCode(params.id);
  const entry = id ? glossaryEntry(id) : null;
  const back = <NavBar backLabel="Rules" backTestID="rule-back" onBack={() => goBack(router, "/rules")} />;

  if (!entry) {
    return (
      <Screen scene="plain" testID="rule">
        {back}
        <View className="pt-2">
          <ScreenTitle size="title">Rule</ScreenTitle>
        </View>
        <BodyText tone="muted" className="mt-4">{id ? `Rule ${id} is not in the glossary.` : "That rule is not in the glossary."}</BodyText>
      </Screen>
    );
  }

  const body = paragraphs(entry).filter((paragraph) => !paragraph.startsWith("See also:"));
  const links = seeAlso(entry, GLOSSARY);

  return (
    <Screen scene="plain" testID="rule">
      {back}
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="gap-4 pb-safe pt-2">
        <View className="gap-1">
          <Eyebrow>{entry.source}</Eyebrow>
          <ScreenTitle size="title">{entry.title}</ScreenTitle>
        </View>
        <CardTextView text={body.join("\n")} testID="rule-text" />
        {links.length > 0 ? (
          <View testID="rule-see-also">
            <Label>See also</Label>
            <View className="-mx-3 flex-row flex-wrap items-center">
              {links.map(({ name, entry: target }) =>
                target ? (
                  <TextButton key={name} label={name} testID={`see-${target.id}`} tone="gold" onPress={() => router.push({ pathname: "/rule/[id]", params: { id: target.id } })} />
                ) : (
                  <View key={name} className="min-h-11 justify-center px-3">
                    <Label tone="faint">{name}</Label>
                  </View>
                ),
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
