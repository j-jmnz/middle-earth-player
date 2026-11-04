// The details under Victory or Defeat (src/campaign/report.ts): when the scenario ended, the quest stage it reached, each
// player's threat and heroes, the victory display, and for a win the parts of its score. Each section is a heading over plain content; it sends nothing.
import { View } from "react-native";

import type { GameReport } from "../../campaign/report";
import { BodyText, Label, Section } from "../kit/chrome";
import { Text } from "../../ui/text";

function Row({ label, value, tone = "bone", testID }: { label: string; value: string; tone?: "bone" | "muted" | "danger"; testID?: string }) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}, ${value}`} className="min-h-7 flex-row items-center justify-between gap-3">
      <Text className="shrink text-body text-bone">{label}</Text>
      <Text className={`text-body ${tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : "text-bone"}`}>{value}</Text>
    </View>
  );
}

// `tiles`: the screen already shows the score, rounds and victory points as tiles, so the section lists only what the score adds up.
export function GameReportView({ report, tiles = false, testID = "game-report" }: { report: GameReport; tiles?: boolean; testID?: string }) {
  const score = tiles ? report.score?.slice(0, -1) : report.score;
  return (
    <View testID={testID} className="gap-4">
      <View className="items-center gap-1">
        <BodyText tone="muted" className="text-center" testID={`${testID}-ended`}>
          {report.ended}
        </BodyText>
        {report.stage ? (
          <BodyText className="text-center" testID={`${testID}-stage`}>
            {report.stage.detail ? `${report.stage.title} · ${report.stage.detail}` : report.stage.title}
          </BodyText>
        ) : null}
      </View>
      {score ? (
        <View>
          <Section title={tiles ? "How the score adds up" : "Score"} />
          <View>
            {score.map((line, index) => (
              <Row key={line.label} label={line.label} value={line.value} tone={!tiles && index === score.length - 1 ? "bone" : "muted"} testID={`${testID}-score-${index}`} />
            ))}
          </View>
        </View>
      ) : null}
      {report.seats.map((seat, at) => (
        <View key={seat.label}>
          <Section title={seat.label} right={<Label>{seat.threat}</Label>} />
          <View>
            {seat.heroes.map((hero) => (
              <Row key={`${at}:${hero.name}`} label={hero.name} value={hero.words} tone={hero.destroyed ? "danger" : "muted"} testID={`${testID}-hero-${at}-${hero.name}`} />
            ))}
          </View>
        </View>
      ))}
      {report.victory.length > 0 ? (
        <View>
          <Section title="Victory display" />
          <View>
            <BodyText tone="muted" testID={`${testID}-victory`}>
              {report.victory.join(" · ")}
            </BodyText>
          </View>
        </View>
      ) : null}
    </View>
  );
}
