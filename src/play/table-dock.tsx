// The dock beside the table, in reach of the right thumb: what the engine is asking (the step, the moment, a sentence), the
// engine's numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and
// the buttons that confirm it (docs/design-system.md, Table). Picking happens on the table; nothing here is sent until a
// button is pressed (dock-buttons.tsx). The outcome banner over the table says what the last intent did.
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInUp, FadeOut, useReducedMotion } from "react-native-reanimated";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import { DENSE_BELOW, labelChars, PILL_PT, planWords, wordsWindow } from "./dock-budget.ts";
import { dockLines } from "./dock-lines.ts";
import { layoutAnim, useMotionScale } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import { BEAT_MS, type Moment } from "./outcome.ts";
import type { Readout } from "./readout.ts";
import { Stats } from "./sheet-paper.tsx";
import type { Unavailable } from "./sheet-types.ts";
import type { Dock, DockButton } from "./table-choice.ts";
import { LineMark } from "./table-chrome.tsx";
import { panelSurface, raisedEdgeOf } from "./surfaces.ts";
import { withAlphaHex, type TableTokens } from "./tokens.ts";
import { useTableTokens } from "./use-table-tokens.ts";

/** The engine's numbers for the moment, large, and what they come to: on a sunk band in the dock (no drawn edge), ink on a paper panel. */
// `oneLine`: the result is one line (the choice tray is open over the dock on a short phone); its words stay in the label.
export function ReadoutView({ readout, surface = "night", tight = false, oneLine = false }: { readout: Readout; surface?: "night" | "paper"; tight?: boolean; oneLine?: boolean }) {
  const t = useTableTokens();
  const paper = surface === "paper";
  return (
    <View
      testID={`readout-${readout.kind}`}
      className={`rounded-tile px-2 ${tight ? "py-0.5" : "py-1.5"} ${paper ? "border border-inkLine" : ""}`}
      style={paper ? undefined : { backgroundColor: withAlphaHex(t.night, 0.5) }}
    >
      <View className="flex-row items-center justify-center gap-2">
        {readout.stats.map((stat, index) => (
          <View key={stat.word} className="flex-row items-center gap-2">
            {index > 0 ? <Text className={`text-label ${paper ? "text-inkMuted" : "text-faint"}`}>{readout.join ?? "against"}</Text> : null}
            <Stats stats={[stat]} surface={surface} size="title" />
          </View>
        ))}
      </View>
      {readout.result ? (
        <Text testID="readout-result" numberOfLines={oneLine ? 1 : 3} accessibilityLabel={readout.result} className={`${tight ? "" : "mt-0.5"} text-center text-label ${paper ? "text-ink" : "text-muted"}`}>
          {readout.result}
        </Text>
      ) : null}
    </View>
  );
}

// The dock's padding (dock-budget.ts counts it): above the words, under the buttons, and both on a short phone.
const TOP_PAD = 10;
const FOOT_PAD = 8;
const DENSE_PAD = 4;
// The shadow that lifts the dock (and the tray standing on it) off the felt.
const dockShadowOf = (t: TableTokens) => `0 8px 24px ${withAlphaHex(t.night, 0.55)}`;

// The tone of a line of words under the title: the guide and the note muted, under the bone title; what the rules refuse faint.
export const lineTone = (kind: "guide" | "note" | "unavailable") => (kind === "unavailable" ? "text-faint" : "text-muted");

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
  onLines,
  resetKey,
  guide = null,
  trayOpen = false,
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
  // The "i" pill opens the full title and every line in a popover (dock-more.tsx); it reports the screen y of the pill's top.
  onLines?: (top: number) => void;
  // Changes with the moment and the pick: an armed button goes back to unarmed.
  resetKey: string;
  // The first-game guide's line for the moment (reference.ts); it is turned off in the table settings.
  guide?: string | null;
  // The choice tray is open over the words: they are not drawn (a half glyph would show in the gap above the block) and, on a
  // short phone, the readout is one line (its words stay in the accessibility label), so the tray gets the room.
  trayOpen?: boolean;
  // The screen y of the top of the block under the sentence (the readout, the armed line and the buttons): the choice tray's
  // foot stays above it.
  onBlock?: (top: number) => void;
}) {
  const t = useTableTokens();
  const dockShadow = dockShadowOf(t);
  const block = useRef<ComponentRef<typeof View>>(null);
  const pillRef = useRef<ComponentRef<typeof View>>(null);
  const [room, setRoom] = useState({ column: 0, block: 0, text: 198 });
  const measure = () => block.current?.measureInWindow((_x, y) => onBlock?.(Math.round(y)));
  // The folded line is one line on a short phone (under DENSE_BELOW tall, as the choice tray's dense tiles) and two on a taller one.
  const dense = useWindowDimensions().height < DENSE_BELOW;
  const lines = dockLines({ guide, note, unavailable, chars: (dense ? 1 : 2) * labelChars(room.text - PILL_PT) });
  // The words' window (budget in dock-budget.ts): the title keeps the lines that fit under the step and the folded line, and the
  // rest of it waits behind the "i", which sits on the title row when the room cannot hold a folded line.
  const space = room.column > 0 ? wordsWindow({ room: room.column, block: room.block, dense }) : Infinity;
  const plan = planWords({ space, dense, title, textWidth: room.text, hasLine: lines.first != null, foldable: lines.foldable });
  const pill = plan.pill ? (
    // The "i" pill (`dock-more`) opens the full title and every line; the More pill (`dock-more-actions`) folds the quiet
    // buttons. 24 pt with a 44 pt target that stays clear of the line's words (6 pt gap) and inside the dock's padding.
    <Pressable
      ref={pillRef}
      testID="dock-more"
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="More about this moment"
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 12 }}
      onPress={() => pillRef.current?.measureInWindow((_x, y) => onLines?.(Math.round(y)))}
    >
      <View className="h-6 w-6 items-center justify-center rounded-pill" style={{ backgroundColor: withAlphaHex(t.bone, 0.1) }}>
        <Text className="text-label font-semibold" style={{ color: t.bone }}>
          i
        </Text>
      </View>
    </Pressable>
  ) : null;
  const readoutLine = dense && trayOpen;
  return (
    <View style={{ flex: 1, minHeight: 0, justifyContent: "flex-end" }} onLayout={(event) => setRoom((now) => ({ ...now, column: Math.round(event.nativeEvent.layout.height) }))}>
      {/* One flat panel with no drawn edge, lifted off the felt by its shadow. While the choice tray is open the tray stands on it
          as its upper part (tray-frame.tsx): the words are not drawn and the dock's top corners are square, so the two read as one. */}
      <View
        testID="dock"
        className="rounded-card px-3"
        style={{
          backgroundColor: t.raised,
          boxShadow: trayOpen ? dockShadow : `${raisedEdgeOf(t)}, ${dockShadow}`,
          paddingTop: trayOpen ? 0 : dense ? DENSE_PAD : TOP_PAD,
          paddingBottom: dense ? DENSE_PAD : FOOT_PAD,
          ...(trayOpen ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}),
          flexShrink: 1,
        }}
      >
        {/* The words above the numbers are budgeted to fit (planWords); the guard scrolls only on a taller screen's long lines. The
            readout, the armed line and every button are pinned to the dock's foot and never scroll away. */}
        {trayOpen ? null : (
          <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <View onLayout={(event) => setRoom((now) => ({ ...now, text: Math.round(event.nativeEvent.layout.width) }))} style={{ paddingBottom: dense ? 2 : 8 }}>
              <Text testID="sheet-step" numberOfLines={1} className="font-display-bold text-eyebrow uppercase text-gold" style={{ flexShrink: 0 }}>
                {step}
              </Text>
              <View className="flex-row items-start gap-1.5">
                <Text testID="sheet-title" accessibilityRole="header" accessibilityLabel={title} numberOfLines={plan.titleLines} className="flex-1 font-display text-heading text-bone" style={{ flexShrink: 0 }}>
                  {title}
                </Text>
                {plan.pillOnTitle ? pill : null}
              </View>
              {plan.showLine && lines.first ? (
                <View className="mt-0.5 flex-row items-start gap-1.5">
                  {/* One line shows. A screen reader hears every line from it. */}
                  <Text testID={lines.first.testID} numberOfLines={dense ? 1 : 2} accessibilityLabel={lines.spoken} className={`flex-1 text-label ${lineTone(lines.first.kind)}`}>
                    {lines.first.text}
                  </Text>
                  {plan.pillOnTitle ? null : pill}
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}
        <View
          ref={block}
          collapsable={false}
          onLayout={(event) => {
            setRoom((now) => ({ ...now, block: Math.round(event.nativeEvent.layout.height) }));
            measure();
          }}
          className={dense ? "gap-0.5" : "gap-1"}
          style={{ flexShrink: 0, paddingTop: trayOpen ? (dense ? DENSE_PAD : TOP_PAD) : 0 }}
        >
          {readout ? <ReadoutView readout={readout} tight={dense} oneLine={readoutLine} /> : null}
          {refusal ? (
            <Text testID="sheet-refusal" numberOfLines={3} className="text-center text-label text-danger">
              {refusal}
            </Text>
          ) : null}
          <DockButtons key={resetKey} dock={dock} extras={extras} more={more} onMore={onMore} picked={picked} dense={dense} chars={labelChars(room.text)} onButton={onButton} />
        </View>
      </View>
    </View>
  );
}

const BANNER_WIDTH = 440;

/**
 * What the last intent did, centered at the top of the screen for a few seconds, over the table and any open panel. `top` is
 * where it hangs (under the top bar); `width` is the screen's, so it never runs off a narrow phone. Taps go through it to
 * the cards under it; the log keeps every step. The caller keys it on the moment, so each one enters and is announced.
 */
export function MomentBanner({ moment, top, width, onBeat }: { moment: Moment; top: number; width: number; onBeat?: (cards: readonly string[]) => void }) {
  const t = useTableTokens();
  const edge = moment.tone === "good" ? t.gold : moment.tone === "bad" ? t.threat : t.faint;
  const label = `${moment.title}. ${moment.lines.map((line) => line.text).join(". ")}`;
  // A live region is Android's only and is not read reliably on a view that has just mounted: announce on both platforms.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
  }, [label]);
  // The fades: the banner and each line come in and the banner goes out over MOTION.bannerIn and bannerOut.
  const scale = useMotionScale();
  const fade = useMemo(() => ({ enter: layoutAnim(FadeInUp, MOTION.bannerIn, scale), leave: layoutAnim(FadeOut, MOTION.bannerOut, scale) }), [scale]);
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
    <Animated.View entering={fade.enter} exiting={fade.leave} pointerEvents="none" style={{ position: "absolute", top, left: 0, right: 0, alignItems: "center" }}>
      {/* The shadow sits on an outer view: iOS clips a shadow on the view that clips its own corners. */}
      <View
        className="rounded-card"
        style={{ ...box, ...panelSurface(false, t), opacity: 0.97, shadowColor: t.night, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 10 }}
      >
        <View testID="moment" accessible accessibilityLabel={label} className="overflow-hidden rounded-card" style={{ borderWidth: 1, borderColor: edge }}>
          {/* The tone, as a band along the top: gold for a success, threat red for a failure or an engagement. */}
          <View style={{ height: 3, backgroundColor: edge }} />
          <View className="items-center px-4 pb-2 pt-1.5">
            <Text testID="moment-title" className="text-center font-display text-heading text-bone" style={{ lineHeight: 24 }}>
              {moment.title}
            </Text>
            {moment.lines.slice(0, shownLines).map((line, index) => (
              <Animated.View key={index} entering={fade.enter} className="mt-0.5 flex-row items-center gap-2">
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
