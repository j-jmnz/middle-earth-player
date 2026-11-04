// A card's printed text in React Native: one paragraph per line, the timing words bold, the stat and sphere icons inline in
// place of their bracket words, flavor text italic and muted (card-text.ts parses the catalog's markup).
import { View } from "react-native";

import { cardTextParagraphs, type TextRun } from "./card-text.ts";
import { GameIcon } from "../../ui/game-icon.tsx";
import { SPHERE_TINT } from "../../ui/icon-map.ts";
import type { TableToken } from "../../ui/tokens.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { Text } from "../../ui/text.tsx";

const TONES = {
  night: { text: "text-bone", flavor: "text-muted", icon: "bone" },
  paper: { text: "text-ink", flavor: "text-inkMuted", icon: "ink" },
} as const satisfies Record<string, { text: string; flavor: string; icon: TableToken }>;


function Run({ run, icon }: { run: TextRun; icon: TableToken }) {
  const s = useUiScale();
  // An image inline in the line's Text, on the baseline like a capital (the web dev build hangs it lower); the source
  // already puts spaces around the bracket word.
  if (run.kind === "icon") return <GameIcon name={run.name} size={15 * s} tint={SPHERE_TINT[run.name] ?? icon} label={run.word} />;
  const weight = run.bold ? "font-semibold" : "";
  const style = run.italic ? "italic" : "";
  return <Text className={`${weight} ${style}`.trim() || undefined}>{run.text}</Text>;
}

// `reading` sets the text larger, 18 on 28, for a rule read in a tablet's reading pane.
export function CardTextView({ text, tone = "night", testID, reading = false }: { text: string | null | undefined; tone?: keyof typeof TONES; testID?: string; reading?: boolean }) {
  const s = useUiScale();
  const paragraphs = cardTextParagraphs(text);
  if (paragraphs.length === 0) return null;
  const colors = TONES[tone];
  return (
    <View testID={testID} className="gap-3">
      {paragraphs.map((paragraph, index) => (
        <Text
          key={index}
          className={paragraph.flavor ? `text-center text-body italic ${colors.flavor}` : `text-body ${colors.text}`}
          style={reading ? { fontSize: 18 * s, lineHeight: 28 * s } : { lineHeight: 23 * s }}
        >
          {paragraph.runs.map((run, at) => (
            <Run key={at} run={run} icon={colors.icon} />
          ))}
        </Text>
      ))}
    </View>
  );
}
