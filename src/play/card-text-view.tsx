// A card's printed text in React Native: one paragraph per line, the timing words bold, the stat and sphere icons inline in
// place of their bracket words, flavor text italic and muted (card-text.ts parses the catalog's markup).
import { Text, View } from "react-native";

import { cardTextParagraphs, type TextRun } from "./card-text.ts";
import { GameIcon } from "./game-icon.tsx";
import { SPHERE_TINT } from "./icon-map.ts";
import type { TableToken } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";

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

export function CardTextView({ text, tone = "night", testID }: { text: string | null | undefined; tone?: keyof typeof TONES; testID?: string }) {
  const s = useUiScale();
  const paragraphs = cardTextParagraphs(text);
  if (paragraphs.length === 0) return null;
  const colors = TONES[tone];
  return (
    <View testID={testID} className="gap-3">
      {paragraphs.map((paragraph, index) => (
        <Text key={index} className={paragraph.flavor ? `text-center text-body italic ${colors.flavor}` : `text-body ${colors.text}`} style={{ lineHeight: 25 * s }}>
          {paragraph.runs.map((run, at) => (
            <Run key={at} run={run} icon={colors.icon} />
          ))}
        </Text>
      ))}
    </View>
  );
}
