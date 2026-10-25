// The dock beside the table, in reach of the right thumb: what the engine is asking (the step, the moment, a sentence), the
// engine's numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and
// the buttons that confirm it (docs/design-system.md, Table). Picking happens on the table; nothing here is sent until a
// button is pressed (dock-buttons.tsx). The outcome banner over the table says what the last intent did.
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOut, ReduceMotion } from "react-native-reanimated";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import type { Moment } from "./outcome.ts";
import type { Readout } from "./readout.ts";
import { Stats } from "./sheet-paper.tsx";
import type { Unavailable } from "./sheet-types.ts";
import type { Dock, DockButton } from "./table-choice.ts";
import { LineMark } from "./table-chrome.tsx";
import { tableTokens as t } from "./tokens.ts";

/** The engine's numbers for the moment, large, and what they come to: raised night in the dock, ink on a paper panel. */
export function ReadoutView({ readout, surface = "night" }: { readout: Readout; surface?: "night" | "paper" }) {
  const paper = surface === "paper";
  return (
    <View testID={`readout-${readout.kind}`} className={`rounded-tile border px-2 py-1.5 ${paper ? "border-inkLine" : "border-hairline bg-raised"}`}>
      <View className="flex-row items-center justify-center gap-2">
        {readout.stats.map((stat, index) => (
          <View key={stat.word} className="flex-row items-center gap-2">
            {index > 0 ? <Text className={`text-label ${paper ? "text-inkMuted" : "text-muted"}`}>against</Text> : null}
            <Stats stats={[stat]} surface={surface} size="title" />
          </View>
        ))}
      </View>
      {readout.result ? (
        <Text testID="readout-result" numberOfLines={2} className={`mt-0.5 text-center text-label ${paper ? "text-ink" : "text-bone"}`}>
          {readout.result}
        </Text>
      ) : null}
    </View>
  );
}

export function TableDock({
  step,
  title,
  note,
  picked,
  unavailable = [],
  readout,
  refusal,
  dock,
  onButton,
  extras = [],
  resetKey,
}: {
  step: string;
  title: string;
  note: string | null;
  // The cards picked so far, in words ("Frodo Baggins, Sam Gamgee"), or an ability's printed line, or null.
  picked: string | null;
  unavailable?: readonly Unavailable[];
  readout: Readout | null;
  refusal: string | null;
  dock: Dock;
  onButton: (button: DockButton) => void;
  extras?: readonly DockExtra[];
  // Changes with the moment and the pick: an armed button goes back to unarmed.
  resetKey: string;
}) {
  return (
    <View testID="dock" className="rounded-card px-3 pb-2 pt-2" style={{ backgroundColor: t.night, borderWidth: 1, borderColor: t.hairline, flexShrink: 1 }}>
      {/* On a short phone only the sentence scrolls; the numbers, the pick and the buttons stay in sight. */}
      <Text testID="sheet-step" numberOfLines={1} className="text-center font-display text-eyebrow uppercase text-gold">
        {step}
      </Text>
      <Text testID="sheet-title" accessibilityRole="header" numberOfLines={2} className="text-center font-display text-body text-bone">
        {title}
      </Text>
      {note || unavailable.length > 0 ? (
        <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: 18 }}>
          {note ? (
            <Text testID="sheet-note" className="text-center text-label text-muted">
              {note}
            </Text>
          ) : null}
          {unavailable.map((item) => (
            <Text key={item.id} testID={`sheet-unavailable-${item.id}`} className="mt-1 text-center text-label text-faint">
              {`${item.label}: ${item.reason}`}
            </Text>
          ))}
        </ScrollView>
      ) : null}
      <View className="mt-1 gap-1">
        {readout ? <ReadoutView readout={readout} /> : null}
        {picked ? (
          <Text testID="dock-picked" numberOfLines={3} className="text-center text-body text-bone">
            {picked}
          </Text>
        ) : null}
        {refusal ? (
          <Text testID="sheet-refusal" numberOfLines={3} className="text-center text-label text-danger">
            {refusal}
          </Text>
        ) : null}
        <DockButtons key={resetKey} dock={dock} extras={extras} surface="night" onButton={onButton} />
      </View>
    </View>
  );
}

const enter = FadeInUp.duration(200).reduceMotion(ReduceMotion.System);
const leave = FadeOut.duration(200).reduceMotion(ReduceMotion.System);

/**
 * What the last intent did, over the top of the table for a few seconds. Taps go through it to the cards under it; the log
 * keeps every step.
 */
export function MomentBanner({ moment }: { moment: Moment }) {
  const edge = moment.tone === "good" ? t.gold : moment.tone === "bad" ? t.threat : t.hairline;
  return (
    <Animated.View entering={enter} exiting={leave} pointerEvents="none" style={{ position: "absolute", top: 6, left: 0, right: 0, alignItems: "center" }}>
      <View
        testID="moment"
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${moment.title}. ${moment.lines.map((line) => line.text).join(". ")}`}
        className="rounded-card px-4 py-2"
        style={{ backgroundColor: t.night, borderWidth: 1.5, borderColor: edge, maxWidth: 380, opacity: 0.94 }}
      >
        <Text testID="moment-title" className="text-center font-display text-body text-bone">
          {moment.title}
        </Text>
        {moment.lines.map((line, index) => (
          <View key={index} className="mt-0.5 flex-row items-center gap-2">
            <LineMark mark={line.mark} tint="bone" size={14} />
            <Text className="shrink text-label text-bone">{line.text}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
