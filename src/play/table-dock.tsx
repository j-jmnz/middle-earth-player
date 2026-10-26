// The dock beside the table, in reach of the right thumb: what the engine is asking (the step, the moment, a sentence), the
// engine's numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and
// the buttons that confirm it (docs/design-system.md, Table). Picking happens on the table; nothing here is sent until a
// button is pressed (dock-buttons.tsx). The outcome banner over the table says what the last intent did.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInUp, FadeOut, ReduceMotion, useReducedMotion } from "react-native-reanimated";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import { lineCount } from "./armed-room.ts";
import { DENSE_BELOW, expandedHeight, foldedTitleLines, STEP_PX, titleLinesOf, TITLE_PX, wordsWindow } from "./dock-budget.ts";
import { dockLines } from "./dock-lines.ts";
import { BEAT_MS, type Moment } from "./outcome.ts";
import type { Readout } from "./readout.ts";
import { Stats } from "./sheet-paper.tsx";
import type { Unavailable } from "./sheet-types.ts";
import type { Dock, DockButton } from "./table-choice.ts";
import { LineMark } from "./table-chrome.tsx";
import { tableTokens as t } from "./tokens.ts";

/** The engine's numbers for the moment, large, and what they come to: raised night in the dock, ink on a paper panel. */
export function ReadoutView({ readout, surface = "night", tight = false }: { readout: Readout; surface?: "night" | "paper"; tight?: boolean }) {
  const paper = surface === "paper";
  return (
    <View testID={`readout-${readout.kind}`} className={`rounded-tile border px-2 ${tight ? "py-0.5" : "py-1"} ${paper ? "border-inkLine" : "border-hairline bg-raised"}`}>
      <View className="flex-row items-center justify-center gap-2">
        {readout.stats.map((stat, index) => (
          <View key={stat.word} className="flex-row items-center gap-2">
            {index > 0 ? <Text className={`text-label ${paper ? "text-inkMuted" : "text-muted"}`}>{readout.join ?? "against"}</Text> : null}
            <Stats stats={[stat]} surface={surface} size="title" />
          </View>
        ))}
      </View>
      {readout.result ? (
        <Text testID="readout-result" numberOfLines={3} className={`${tight ? "" : "mt-0.5"} text-center text-label ${paper ? "text-ink" : "text-bone"}`}>
          {readout.result}
        </Text>
      ) : null}
    </View>
  );
}

// Label type is about this many points a character, so a line of the dock holds its width over this many characters.
const CHAR_PT = 6.6;
// The "i" pill's width and gap beside a line.
const PILL_PT = 30;
// The tone of a line of words under the title: the guide in bone, the note muted, what the rules refuse faint.
const lineTone = (kind: "guide" | "note" | "unavailable") => (kind === "guide" ? "text-bone" : kind === "note" ? "text-muted" : "text-faint");

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
  const [room, setRoom] = useState({ column: 0, block: 0, text: 198 });
  const measure = () => block.current?.measureInWindow((_x, y) => onBlock?.(Math.round(y)));
  // The folded line is one line on a short phone (under 400 pt tall, as the choice tray's dense tiles) and two on a taller one;
  // what a line holds comes from the width the dock gives it (label type is about CHAR_PT a character, the "i" pill takes 30).
  const dense = useWindowDimensions().height < DENSE_BELOW;
  const chars = Math.max(12, Math.floor((room.text - PILL_PT) / CHAR_PT));
  const lines = dockLines({ guide, note, unavailable, chars: dense ? chars : 2 * chars });
  // The folded lines open in place; a new moment folds them again.
  const [opened, setOpened] = useState<string | null>(null);
  const moment = `${step}|${title}`;
  // The words' window (budget in dock-budget.ts): the title keeps the lines that fit under the step and the folded line on a
  // short phone, and the rest of it waits behind the "i"; opened, the lines take the room and the title gets what is left.
  const space = room.column > 0 ? wordsWindow({ room: room.column, block: room.block, dense }) : Infinity;
  const natural = titleLinesOf(title, room.text);
  const folded = dense ? foldedTitleLines({ space, dense, title: natural, folded: lines.first ? 1 : 0 }) : natural;
  const cut = folded < natural;
  const foldable = lines.foldable || cut;
  const expanded = opened === moment && foldable;
  const all = lines.first ? [lines.first, ...lines.rest] : [];
  const inList = expandedHeight(all.map((line) => ({ rows: lineCount(line.text, chars), refusal: line.kind === "unavailable" })));
  const titleLines = !dense ? 2 : expanded ? Math.max(1, Math.min(natural, Math.floor((space - STEP_PX - inList) / TITLE_PX))) : folded;
  const pill = foldable ? (
    // The "i" pill (`dock-more`) opens the folded lines and the rest of the title; the More pill (`dock-more-actions`) folds the
    // quiet buttons. 24 pt with a 44 pt target that stays clear of the line's words (6 pt gap) and inside the dock's padding.
    <Pressable
      testID="dock-more"
      accessibilityRole="button"
      accessibilityLabel={expanded ? "Fewer notes" : "More about this moment"}
      accessibilityState={{ expanded }}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 12 }}
      onPress={() => setOpened(expanded ? null : moment)}
    >
      <View className="h-6 w-6 items-center justify-center rounded-pill" style={{ borderWidth: 1, borderColor: t.muted, backgroundColor: t.raised }}>
        <Text className="text-label font-medium text-bone">{expanded ? "−" : "i"}</Text>
      </View>
    </Pressable>
  ) : null;
  return (
    <View style={{ flex: 1, minHeight: 0, justifyContent: "flex-end" }} onLayout={(event) => setRoom((now) => ({ ...now, column: Math.round(event.nativeEvent.layout.height) }))}>
      <View testID="dock" className={`rounded-card px-3 ${dense ? "pb-0.5 pt-0.5" : "pb-1 pt-1.5"}`} style={{ backgroundColor: t.night, borderWidth: 1, borderColor: t.hairline, flexShrink: 1 }}>
        {/* Only the words above the numbers scroll, where a short phone or a long title leaves them too little room: the readout, the
            armed line and every button are pinned to the dock's foot and never scroll away. */}
        <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <View onLayout={(event) => setRoom((now) => ({ ...now, text: Math.round(event.nativeEvent.layout.width) }))}>
            <Text testID="sheet-step" numberOfLines={1} className="text-center font-display text-eyebrow uppercase text-gold" style={{ flexShrink: 0 }}>
              {step}
            </Text>
            <View className="flex-row items-start gap-1.5">
              <Text testID="sheet-title" accessibilityRole="header" accessibilityLabel={title} numberOfLines={titleLines} className="flex-1 text-center font-display text-body text-bone" style={{ flexShrink: 0 }}>
                {title}
              </Text>
              {!lines.first ? pill : null}
            </View>
            {lines.first ? (
              <View className="flex-row items-start gap-1.5">
                <View className="flex-1">
                  {expanded ? (
                    all.map((line) => (
                      <Text key={line.testID} testID={line.testID} className={`text-center text-label ${lineTone(line.kind)} ${line.kind === "unavailable" ? "mt-1" : ""}`}>
                        {line.text}
                      </Text>
                    ))
                  ) : (
                    // One line shows. A screen reader hears every line from it, folded or not.
                    <Text testID={lines.first.testID} numberOfLines={dense ? 1 : 2} accessibilityLabel={lines.spoken} className={`text-center text-label ${lineTone(lines.first.kind)}`}>
                      {lines.first.text}
                    </Text>
                  )}
                </View>
                {pill}
              </View>
            ) : null}
          </View>
        </ScrollView>
      <View ref={block} collapsable={false} onLayout={(event) => {
        setRoom((now) => ({ ...now, block: Math.round(event.nativeEvent.layout.height) }));
        measure();
      }} className={dense ? "gap-0.5" : "gap-1"} style={{ flexShrink: 0 }}>
        {/* Opened on a short phone, the lines take the numbers' room too (the buttons stay where they are); the "−" brings them back. */}
        {readout && !(dense && expanded) ? <ReadoutView readout={readout} tight={dense} /> : null}
        {refusal ? (
          <Text testID="sheet-refusal" numberOfLines={3} className="text-center text-label text-danger">
            {refusal}
          </Text>
        ) : null}
        <DockButtons key={resetKey} dock={dock} extras={extras} more={more} onMore={onMore} picked={picked} dense={dense} onButton={onButton} />
      </View>
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
