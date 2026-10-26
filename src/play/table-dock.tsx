// The dock beside the table, in reach of the right thumb: what the engine is asking (the step, the moment, a sentence), the
// engine's numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and
// the buttons that confirm it (docs/design-system.md, Table). Picking happens on the table; nothing here is sent until a
// button is pressed (dock-buttons.tsx). The outcome banner over the table says what the last intent did.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInUp, FadeOut, ReduceMotion, useReducedMotion } from "react-native-reanimated";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import { dockLines } from "./dock-lines.ts";
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
    <View testID={`readout-${readout.kind}`} className={`rounded-tile border px-2 py-1 ${paper ? "border-inkLine" : "border-hairline bg-raised"}`}>
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

// About how many characters one line of the dock holds in label type (the narrowest command column, 210 pt).
const FOLDED_CHARS = 28;

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
  more = [],
  onMore,
  resetKey,
  guide = null,
  onBlock,
}: {
  step: string;
  title: string;
  note: string | null;
  // The cards picked so far, in words ("Frodo Baggins, Sam Gamgee"), or an ability's printed line, or null: heard in the
  // primary's hint; no line shows it.
  picked: string | null;
  unavailable?: readonly Unavailable[];
  readout: Readout | null;
  refusal: string | null;
  dock: Dock;
  onButton: (button: DockButton) => void;
  extras?: readonly DockExtra[];
  // The quiet pills folded behind the More pill, and what it does (dock-extras.ts, dockPills; dock-more.tsx).
  more?: readonly DockExtra[];
  onMore?: (foot: number) => void;
  // Changes with the moment and the pick: an armed button goes back to unarmed.
  resetKey: string;
  // The first-game guide's line for the moment (reference.ts); it is turned off in the table settings.
  guide?: string | null;
  // The screen y of the top of the block under the sentence (the readout, the armed line and the buttons): the choice tray's
  // foot stays above it.
  onBlock?: (top: number) => void;
}) {
  const block = useRef<ComponentRef<typeof View>>(null);
  const measure = () => block.current?.measureInWindow((_x, y) => onBlock?.(Math.round(y)));
  // The folded line is one line on a short phone (under 400 pt tall, as the choice tray's dense tiles) and two on a taller one.
  const dense = useWindowDimensions().height < 400;
  const lines = dockLines({ guide, note, unavailable, chars: dense ? FOLDED_CHARS : 2 * FOLDED_CHARS });
  // The folded lines open in place; a new moment folds them again.
  const [opened, setOpened] = useState<string | null>(null);
  const moment = `${step}|${title}`;
  const expanded = opened === moment && lines.foldable;
  return (
    <View testID="dock" className="rounded-card px-3 pb-2 pt-1.5" style={{ backgroundColor: t.night, borderWidth: 1, borderColor: t.hairline, flexShrink: 1 }}>
      {/* A guard: where the dock is taller than the column (a short phone, a long title) it scrolls, so its foot is never cut. */}
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled onScrollEndDrag={measure} onMomentumScrollEnd={measure}>
      {/* On a short phone only the sentence scrolls; the numbers, the pick and the buttons stay in sight. */}
      <Text testID="sheet-step" numberOfLines={1} className="text-center font-display text-eyebrow uppercase text-gold" style={{ flexShrink: 0 }}>
        {step}
      </Text>
      <Text testID="sheet-title" accessibilityRole="header" numberOfLines={2} className="text-center font-display text-body text-bone" style={{ flexShrink: 0 }}>
        {title}
      </Text>
      {lines.first ? (
        <View className="flex-row items-start gap-1.5">
          <View className="flex-1" style={{ flexShrink: 1 }}>
            {expanded ? (
              <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: 18, maxHeight: dense ? 76 : 120 }} nestedScrollEnabled>
                {[lines.first, ...lines.rest].map((line) => (
                  <Text key={line.testID} testID={line.testID} className={`text-center text-label ${line.kind === "guide" ? "text-bone" : line.kind === "note" ? "text-muted" : "mt-1 text-faint"}`}>
                    {line.text}
                  </Text>
                ))}
              </ScrollView>
            ) : (
              // One line shows. A screen reader hears every line from it, folded or not.
              <Text
                testID={lines.first.testID}
                numberOfLines={dense ? 1 : 2}
                accessibilityLabel={lines.spoken}
                className={`text-center text-label ${lines.first.kind === "guide" ? "text-bone" : lines.first.kind === "note" ? "text-muted" : "text-faint"}`}
              >
                {lines.first.text}
              </Text>
            )}
          </View>
          {lines.foldable ? (
            <Pressable
              testID="dock-more"
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Fewer notes" : "More about this moment"}
              accessibilityState={{ expanded }}
              hitSlop={12}
              onPress={() => setOpened(expanded ? null : moment)}
            >
              <View className="h-5 w-5 items-center justify-center rounded-pill" style={{ borderWidth: 1, borderColor: t.hairline, backgroundColor: t.raised }}>
                <Text className="text-label font-medium text-bone">{expanded ? "−" : "i"}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View ref={block} collapsable={false} onLayout={measure} className="mt-1 gap-1">
        {readout ? <ReadoutView readout={readout} /> : null}
        {refusal ? (
          <Text testID="sheet-refusal" numberOfLines={3} className="text-center text-label text-danger">
            {refusal}
          </Text>
        ) : null}
        <DockButtons key={resetKey} dock={dock} extras={extras} more={more} onMore={onMore} picked={picked} onButton={onButton} />
      </View>
      </ScrollView>
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
