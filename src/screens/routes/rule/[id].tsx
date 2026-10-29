import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { BodyText, NavBar, Screen, ScreenScroll, ScreenTitle } from "../../chrome";
import { goBack } from "../../go-back";
import { RuleBody } from "../../rule-detail";
import { routeCode } from "../../route-code";
import { glossaryEntry } from "../../rules-glossary";

// One rule span as its book prints it, with the rules it sends the reader on to (RuleBody); a readable column outside compact.
export default function Rule() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeCode(params.id);
  const entry = id ? glossaryEntry(id) : null;
  const back = <NavBar backLabel="Rules" backTestID="rule-back" onBack={() => goBack(router, "/rules")} />;

  if (!entry) {
    return (
      <Screen scene="calm" testID="rule">
        {back}
        <View className="pt-2">
          <ScreenTitle size="title">Rule</ScreenTitle>
        </View>
        <BodyText tone="muted" className="mt-4">{id ? `Rule ${id} is not in the glossary.` : "That rule is not in the glossary."}</BodyText>
      </Screen>
    );
  }

  return (
    <Screen scene="calm" testID="rule">
      {back}
      <ScreenScroll top={8} max="readable">
        <RuleBody entry={entry} onSeeAlso={(target) => router.push({ pathname: "/rule/[id]", params: { id: target } })} />
      </ScreenScroll>
    </Screen>
  );
}
