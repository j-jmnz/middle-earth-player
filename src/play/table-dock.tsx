// The dock beside the table, in reach of the right thumb: what the engine is asking (the step, the moment, a sentence), the
// engine's numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and
// the buttons that confirm it (docs/design-system.md, Table). Picking happens on the table; nothing here is sent until a
// button is pressed, and a button that sends with nothing picked asks for a second tap. The outcome banner over the table
// says what the last intent did.
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOut, ReduceMotion } from "react-native-reanimated";

import type { Moment } from "./outcome.ts";
import { ChromeButton, ConfirmButton, Stats, Why } from "./sheet-paper.tsx";
import type { Unavailable } from "./sheet-types.ts";
import type { Dock, DockButton, Readout } from "./table-choice.ts";
import { LineMark } from "./table-chrome.tsx";
import { tableTokens as t } from "./tokens.ts";

export type DockExtra = { label: string; testID: string; onPress: () => void };

/** The engine's numbers for the moment, large, and what they come to. */
export function ReadoutView({ readout }: { readout: Readout }) {
  return (
    <View testID={`readout-${readout.kind}`} className="mt-2 rounded-tile px-3 py-2" style={{ backgroundColor: t.raised, borderWidth: 1, borderColor: t.hairline }}>
      <View className="flex-row items-center justify-center gap-2">
        {readout.stats.map((stat, index) => (
          <View key={stat.word} className="flex-row items-center gap-2">
            {index > 0 ? <Text className="text-label text-muted">against</Text> : null}
            <Stats stats={[stat]} surface="night" size="title" />
          </View>
        ))}
      </View>
      {readout.result ? (
        <Text testID="readout-result" className="mt-1 text-center text-label text-bone">
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
}: {
  step: string;
  title: string;
  note: string | null;
  // The cards picked so far, in words ("Frodo Baggins, Sam Gamgee"), or null.
  picked: string | null;
  unavailable?: readonly Unavailable[];
  readout: Readout | null;
  refusal: string | null;
  dock: Dock;
  onButton: (button: DockButton) => void;
  extras?: readonly DockExtra[];
}) {
  const ready = dock.primary != null && dock.why == null && dock.primary.action.kind !== "clear";
  return (
    <View testID="dock" className="rounded-card px-3 pb-2 pt-3" style={{ backgroundColor: t.night, borderWidth: 1, borderColor: t.goldLine, flexShrink: 1 }}>
      {/* On a short phone the words scroll; the buttons stay pinned at the bottom, in thumb reach. */}
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }}>
        <Text testID="sheet-step" numberOfLines={1} className="text-center font-display text-eyebrow uppercase text-gold">
          {step}
        </Text>
        <Text testID="sheet-title" accessibilityRole="header" numberOfLines={2} className="mt-0.5 text-center font-display text-body text-bone">
          {title}
        </Text>
        {note ? (
          <Text testID="sheet-note" numberOfLines={3} className="mt-1 text-center text-label text-muted">
            {note}
          </Text>
        ) : null}
        {unavailable.map((item) => (
          <Text key={item.id} testID={`sheet-unavailable-${item.id}`} numberOfLines={3} className="mt-1 text-center text-label text-faint">
            {`${item.label}: ${item.reason}`}
          </Text>
        ))}
        {readout ? <ReadoutView readout={readout} /> : null}
        {picked ? (
          <Text testID="dock-picked" numberOfLines={2} className="mt-1 text-center text-label text-gold">
            {picked}
          </Text>
        ) : null}
      </ScrollView>
      {refusal ? (
        <Text testID="sheet-refusal" className="mt-1 text-center text-label text-danger">
          {refusal}
        </Text>
      ) : null}
      <View className="mt-2 gap-1">
        {dock.primary ? (
          <>
            <ConfirmButton label={dock.primary.label} testID={dock.primary.testID} arm={dock.primary.arm} primary disabled={!ready} onConfirm={() => dock.primary && onButton(dock.primary)} />
            {dock.why ? <Why surface="night">{dock.why}</Why> : null}
          </>
        ) : null}
        <View className="flex-row flex-wrap items-center justify-center">
          {dock.secondary.map((button) => (
            <ConfirmButton key={button.testID} label={button.label} testID={button.testID} arm={button.arm} onConfirm={() => onButton(button)} />
          ))}
          {extras.map((extra) => (
            <ChromeButton key={extra.testID} label={extra.label} testID={extra.testID} tone="gold" onPress={extra.onPress} />
          ))}
        </View>
      </View>
    </View>
  );
}

const enter = FadeInUp.duration(200).reduceMotion(ReduceMotion.System);
const leave = FadeOut.duration(200).reduceMotion(ReduceMotion.System);

/** What the last intent did, over the top of the table. A tap closes it; the log keeps it. */
export function MomentBanner({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  const edge = moment.tone === "good" ? t.gold : moment.tone === "bad" ? t.threat : t.hairline;
  return (
    <Animated.View entering={enter} exiting={leave} pointerEvents="box-none" style={{ position: "absolute", top: 8, left: 0, right: 0, alignItems: "center" }}>
      <Pressable
        testID="moment"
        accessibilityRole="button"
        accessibilityLabel={`${moment.title}. ${moment.lines.map((line) => line.text).join(". ")}. Tap to close.`}
        onPress={onClose}
        className="rounded-card px-4 py-2"
        style={{ backgroundColor: t.night, borderWidth: 1.5, borderColor: edge, maxWidth: 360, opacity: 0.96 }}
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
      </Pressable>
    </Animated.View>
  );
}
