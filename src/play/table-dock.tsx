// The dock beside the table, in reach of the right thumb: what the engine is asking (the step, the moment, a sentence), the
// engine's numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and
// the buttons that confirm it (docs/design-system.md, Table). Picking happens on the table; nothing here is sent until a
// button is pressed (dock-buttons.tsx). The outcome banner over the table says what the last intent did.
import { useEffect, useState } from "react";
import { AccessibilityInfo, ScrollView, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOut, ReduceMotion, useReducedMotion } from "react-native-reanimated";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import { BEAT_MS, type Moment } from "./outcome.ts";
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
            {index > 0 ? <Text className={`text-label ${paper ? "text-inkMuted" : "text-muted"}`}>{readout.join ?? "against"}</Text> : null}
            <Stats stats={[stat]} surface={surface} size="title" />
          </View>
        ))}
      </View>
      {readout.result ? (
        <Text testID="readout-result" numberOfLines={3} className={`mt-0.5 text-center text-label ${paper ? "text-ink" : "text-bone"}`}>
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
  guide = null,
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
  // The first-game guide's line for the moment (reference.ts); it is turned off in the turn reference.
  guide?: string | null;
}) {
  return (
    <View testID="dock" className="rounded-card px-3 pb-2 pt-2" style={{ backgroundColor: t.night, borderWidth: 1, borderColor: t.hairline, flexShrink: 1 }}>
      {/* On a short phone only the sentence scrolls; the numbers, the pick and the buttons stay in sight. */}
      <Text testID="sheet-step" numberOfLines={1} className="text-center font-display text-eyebrow uppercase text-gold" style={{ flexShrink: 0 }}>
        {step}
      </Text>
      <Text testID="sheet-title" accessibilityRole="header" numberOfLines={2} className="text-center font-display text-body text-bone" style={{ flexShrink: 0 }}>
        {title}
      </Text>
      {note || guide || unavailable.length > 0 ? (
        <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: 18 }}>
          {/* The first-game guide scrolls with the note: on a short phone it must not push the buttons off the screen. */}
          {guide ? (
            <Text testID="dock-guide" className="text-center text-label text-bone">
              {`Guide: ${guide}`}
            </Text>
          ) : null}
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

const BANNER_WIDTH = 440;

/**
 * What the last intent did, centered at the top of the screen for a few seconds, over the table and any open panel. `top` is
 * where it hangs (under the top bar); `width` is the screen's, so it never runs off a narrow phone. Taps go through it to
 * the cards under it; the log keeps every step. The caller keys it on the moment, so each one enters and is announced.
 */
export function MomentBanner({ moment, top, width, onBeat }: { moment: Moment; top: number; width: number; onBeat?: (cards: readonly string[]) => void }) {
  const edge = moment.tone === "good" ? t.gold : moment.tone === "bad" ? t.threat : t.faint;
  const label = `${moment.title}. ${moment.lines.map((line) => line.text).join(". ")}`;
  // A live region is Android's only and is not read reliably on a view that has just mounted: announce on both platforms.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
  }, [label]);
  // Resolve in beats: one line more every BEAT_MS, each ringing on the table the cards it names; reduced motion shows all.
  const reduceMotion = useReducedMotion();
  const [shownLines, setShownLines] = useState(reduceMotion ? moment.lines.length : 1);
  useEffect(() => {
    if (shownLines >= moment.lines.length) return;
    const timer = setTimeout(() => setShownLines((count) => count + 1), BEAT_MS);
    return () => clearTimeout(timer);
  }, [shownLines, moment.lines.length]);
  const beatCards = moment.lines[Math.max(0, shownLines - 1)]?.cards ?? [];
  const beatKey = beatCards.join(",");
  useEffect(() => {
    onBeat?.(beatKey === "" ? [] : beatKey.split(","));
    return () => onBeat?.([]);
  }, [beatKey, onBeat]);
  const box = { minWidth: Math.min(260, width - 32), maxWidth: Math.min(BANNER_WIDTH, width - 32) };
  return (
    <Animated.View entering={enter} exiting={leave} pointerEvents="none" style={{ position: "absolute", top, left: 0, right: 0, alignItems: "center" }}>
      {/* The shadow sits on an outer view: iOS clips a shadow on the view that clips its own corners. */}
      <View
        className="rounded-card"
        style={{ ...box, backgroundColor: t.night, opacity: 0.96, shadowColor: t.night, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 10 }}
      >
        <View testID="moment" accessible accessibilityLabel={label} className="overflow-hidden rounded-card" style={{ borderWidth: 1, borderColor: edge }}>
          {/* The tone, as a band along the top: gold for a success, threat red for a failure or an engagement. */}
          <View style={{ height: 3, backgroundColor: edge }} />
          <View className="items-center px-4 pb-2 pt-1.5">
            <Text testID="moment-title" className="text-center font-display text-body text-bone">
              {moment.title}
            </Text>
            {moment.lines.slice(0, shownLines).map((line, index) => (
              <Animated.View key={index} entering={enter} className="mt-0.5 flex-row items-center gap-2">
                <LineMark mark={line.mark} tint="bone" size={14} />
                <Text className="shrink text-label text-bone">{line.text}</Text>
              </Animated.View>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
