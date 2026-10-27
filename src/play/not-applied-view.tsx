// The lines of a card the app does not apply, for the card screen and the table's preview: a muted eyebrow, one sentence
// saying what the card still does, and each line as printed, set off by a rule at its left (docs/plans/inactive-text.md).
import { Text, View } from "react-native";

import { lossSentence, type NotApplied } from "./not-applied.ts";
import { tableTokens as t } from "./tokens.ts";

export function NotAppliedView({ notApplied, tone = "night", testID = "card-not-applied" }: { notApplied: NotApplied; tone?: "night" | "paper"; testID?: string }) {
  const paper = tone === "paper";
  return (
    <View testID={testID} accessible accessibilityLabel={`Not applied. ${lossSentence(notApplied.loss)} ${notApplied.lines.map((line) => line.text).join(" ")}`} className="gap-1.5">
      <Text className={`font-display-bold text-eyebrow uppercase ${paper ? "text-inkLabel" : "text-muted"}`}>Not applied</Text>
      <Text className={`text-label ${paper ? "text-inkMuted" : "text-muted"}`}>{lossSentence(notApplied.loss)}</Text>
      {notApplied.lines.map((line, index) => (
        <View key={line.id ?? index} style={{ borderLeftWidth: 2, borderColor: paper ? t.inkLine : t.hairline, paddingLeft: 8 }}>
          <Text className={`text-body ${paper ? "text-inkMuted" : "text-muted"}`}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}
