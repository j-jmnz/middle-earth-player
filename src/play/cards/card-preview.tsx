// A long press on a card: the card large over the dimmed screen, so its text reads at a glance without leaving the table
// or the list. It grows in on a spring and shrinks back on close; reduced motion snaps both. A tap anywhere but Details and the
// rows of what is with the card, Android Back or the VoiceOver escape gesture closes it (there is no Close button); Details
// opens the card screen.
//
// On a wide screen (the table, in landscape) the card stands at the left and a column at its right names it, says what
// effects are on it now (+1 Attack from Dagger of Westernesse) and lists the cards attached to it and its shadow cards: a
// tap on one shows that card in its place. A horizontal swipe on the card steps through the same cards (preview-swipe.ts), and so
// does the screen reader's adjust gesture; the rows stay the plain path.
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { CardImage } from "../../ui/card-image.tsx";
import { CardTextView } from "./card-text-view.tsx";
import { drawnKeywords, type PreviewKeyword } from "./preview-keywords.ts";
import { focusChip, KeywordBubble, KeywordChips, type PickChip } from "./keyword-tips.tsx";
import type { Bubble, RuleTip } from "./keyword-tip-types.ts";
import type { PressableRef } from "../../ui/popover-frame.tsx";
import type { NotApplied } from "./not-applied.ts";
import { NotAppliedView } from "./not-applied-view.tsx";
import { springConfig, timing, useMotionScale } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { previewSideSize, previewSize, previewStrip, tokenLines } from "./preview-size.ts";
import { clampStep, swipeStep } from "./preview-swipe.ts";
import { listHeading, previewValue } from "./preview-words.ts";
import { SecondaryButton } from "../../ui/buttons.tsx";
import { RelatedChip, RelatedRow } from "./related-rows.tsx";
import type { PictureSource } from "../canvas/table-canvas-types.ts";
import { cardCorner } from "../../ui/card-corner.ts";
import { capLines, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";
import { tableSettings } from "../../ui/table-settings.ts";

const SCRIM = 0.82;

export type PreviewCard = {
  code: string;
  name: string;
  // The line over the card's name when it has more to say than its name (the quest stage: its name and its progress), and a
  // muted line under it (how a stage with no quest points is won).
  title?: string;
  detail?: string;
  // The scan, or null while it is not on the phone: the name and text are shown on paper instead.
  source: PictureSource | null;
  // Quest cards are printed sideways.
  landscape?: boolean;
  text?: string | null;
  // The effects on the card now, in words, when it is on the table.
  effects?: readonly string[];
  // The tokens on it now (table-preview.ts, tokenLines): "2 damage", "1 progress", "3 resources", "Exhausted".
  tokens?: readonly string[];
  // How it sits with the first card: "Attachment", "Shadow card".
  role?: string;
  // Why a hand card cannot be played now (why.ts), when the tap that opened it found nothing to do.
  note?: string | null;
  // What the note's heading says when it is not about playing: "Cannot be chosen now" for a character the open pick veils (why.ts, whyNotChosen).
  noteTitle?: string;
  // The lines of it the app does not apply, and what that costs (not-applied.ts).
  notApplied?: NotApplied | null;
  // The Heading card's four steps with where each stands, the current one marked (heading.ts): their own heading in the preview, not effects on the card.
  steps?: readonly { text: string; current: boolean }[];
  // How far the card is drawn turned, in degrees counterclockwise, a multiple of 90: the Heading card, turned a quarter turn per step as the rule turns it (heading.ts).
  turn?: number;
  // The card lies on its Lost Island side: the preview shows that side only, and Details (which opens the real card) is not offered.
  lostIsland?: boolean;
  // The card is a facedown Reanimated Dead: the preview says what it is on paper and Details (which would open the card behind it) is not offered.
  faceless?: boolean;
  // The keyword chips under the name (preview-keywords.ts): keywords now, then timing words (`timing`); `lost` is a printed keyword an effect took away.
  keywords?: readonly PreviewKeyword[];
};

// The card's picture, or (while it is not on the phone) its name and text on paper. The quest advance screen draws its stage with it.
// `imageKey`: the picture's own key when two cards of one code are shown in turn (a quest card's sides A and B); its code otherwise.
export function PreviewPicture({ card, width, height, imageKey }: { card: PreviewCard; width: number; height: number; imageKey?: string }) {
  const key = imageKey ?? card.code;
  const turn = ((card.turn ?? 0) % 360 + 360) % 360;
  if (card.source && turn !== 0) {
    // A quarter or half turn: the picture is drawn at its own size about the frame's centre, so a sideways card fills a sideways frame.
    const across = turn % 180 === 90;
    const w = across ? height : width;
    const h = across ? width : height;
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: w, height: h, transform: [{ rotate: `${-turn}deg` }] }}>
          <CardImage source={card.source} recyclingKey={key} accessibilityLabel={card.name} width={w} height={h} />
        </View>
      </View>
    );
  }
  return card.source ? (
    <CardImage source={card.source} recyclingKey={key} accessibilityLabel={card.name} width={width} height={height} />
  ) : (
    <ScrollView className="flex-1 px-5 py-6">
      <Text accessibilityRole="header" className="mb-4 text-center font-display text-title text-ink">
        {card.name}
      </Text>
      <CardTextView text={card.text} tone="paper" />
    </ScrollView>
  );
}

export function CardPreview({
  card,
  related = [],
  onClose,
  onDetails = null,
  ownsBack = true,
  closeRef,
  rule,
  onOpenRule,
}: {
  card: PreviewCard;
  // The cards attached to it and its face-up shadow cards (and, for the quest stage, the stages before it), each shown in its place on a
  // tap or a swipe.
  related?: readonly PreviewCard[];
  onClose: () => void;
  // The hardware Back closes the preview here (a list's preview) unless the screen routes Back itself (the table's layers,
  // back.ts) and calls the animated close through `closeRef`.
  ownsBack?: boolean;
  closeRef?: { current: (() => void) | null };
  onDetails?: ((code: string) => void) | null;
  // What the keyword chips quote: the span's words for a rule id. With none, no chips are drawn (the pool and deck lists' previews).
  rule?: (id: string) => RuleTip | null;
  onOpenRule?: (id: string) => void;
}) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const progress = useSharedValue(scale === 0 ? 1 : 0);
  const all = [card, ...related];
  const [at, setAt] = useState(0);
  const timingTips = useStore(tableSettings, (state) => state.settings.timingTips);
  // The keyword bubble: the chip tapped last, and whether it is open. It is shut for another card of the preview (a swipe, a related row).
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  // The chip that opened the bubble: the screen reader's focus goes back to it once the bubble is shut, however it was shut.
  const opener = useRef<PressableRef | null>(null);
  const returning = useRef(false);
  const show = (index: number) => {
    setBubbleOpen(false);
    setAt(index);
  };
  const shown = all[at] ?? card;
  const wide = screen.width > screen.height;
  const roomW = screen.width - insets.left - insets.right;
  const roomH = screen.height - insets.top - insets.bottom;
  // A card turned a quarter turn (the Heading card) is drawn in a sideways frame, and its picture turned in it.
  const sideways = (shown.landscape ?? false) !== (((shown.turn ?? 0) % 180 + 180) % 180 === 90);
  // Upright, the cards with it are a strip under the card (user request, 2026-11-02: a quest card's side B was out of reach on a phone);
  // the card gives up the strip's height.
  // The tokens line is two lines at the phone's default text size and as many as its words take at a larger one (preview-size.ts, previewStrip).
  const tokenRows = Math.max(0, ...all.map((item) => ((item.tokens ?? []).length > 0 ? tokenLines((item.tokens ?? []).join(" · "), roomW - 32 * s, s, screen.fontScale) : 0)));
  const keywordRow = rule != null && all.some((item) => drawnKeywords(item.keywords, timingTips).length > 0);
  const strip = !wide ? previewStrip({ chips: all.length > 1, tokenRows, keywords: keywordRow }, s, screen.fontScale) : 0;
  const size = wide ? previewSideSize(roomW, roomH, sideways, s) : previewSize(screen.width, roomH - strip, sideways, s);

  useEffect(() => {
    if (scale > 0) progress.set(withSpring(1, springConfig(MOTION.previewIn, scale)));
  }, [progress, scale]);

  const close = useCallback(() => {
    if (scale === 0) {
      onClose();
      return;
    }
    progress.set(
      withTiming(0, timing(MOTION.previewOut, scale), (finished) => {
        if (finished) scheduleOnRN(onClose);
      }),
    );
  }, [progress, scale, onClose]);

  // Back and Escape shut the bubble while it is open, and the preview after it.
  const back = useCallback(() => {
    if (bubbleOpen) setBubbleOpen(false);
    else close();
  }, [bubbleOpen, close, setBubbleOpen]);
  const pick: PickChip = (chip, anchor, from) => {
    opener.current = from.current;
    returning.current = true;
    setBubble({ word: chip.word, ruleId: chip.ruleId, anchor });
    setBubbleOpen(true);
  };
  useEffect(() => {
    if (bubbleOpen || !returning.current) return;
    returning.current = false;
    focusChip(opener);
  }, [bubbleOpen]);

  useEffect(() => {
    if (!ownsBack) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back, ownsBack]);
  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = back;
    return () => {
      closeRef.current = null;
    };
  }, [back, closeRef]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) * SCRIM }));
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: Math.min(1, Math.max(0, p * 1.4)), transform: [{ translateY: (1 - p) * 28 * s }, { scale: 0.82 + 0.18 * p }] };
  });
  const buttonsStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) }));

  // A sideways swipe on the card steps one card along, never past either end. It waits for a clear sideways move and gives way to an
  // upright one, and a tap still reaches the scrim and closes the preview. Its callbacks run on the JS thread: they only set `at`.
  const count = all.length;
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .enabled(count > 1)
    .activeOffsetX([-12 * s, 12 * s])
    .failOffsetY([-12 * s, 12 * s])
    .onEnd((event) => {
      setBubbleOpen(false);
      setAt((now) => swipeStep(now, count, event.translationX, event.velocityX, s));
    });
  const step = (by: number) => {
    setBubbleOpen(false);
    setAt((now) => clampStep(now, count, by));
  };
  const frame = (
    <GestureDetector gesture={swipe}>
      <Animated.View
        testID="card-preview-card"
        accessible={count > 1}
        accessibilityRole={count > 1 ? "adjustable" : undefined}
        accessibilityLabel={count > 1 ? "Card shown large" : undefined}
        accessibilityValue={count > 1 ? { text: previewValue(shown, at, count) } : undefined}
        accessibilityHint={count > 1 ? "Adjust to show the other cards with it" : undefined}
        accessibilityActions={count > 1 ? [{ name: "increment" }, { name: "decrement" }] : undefined}
        onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
        style={[{ width: size.width, height: size.height, borderRadius: shown.source ? 0 : cardCorner(size.width, size.height), overflow: "hidden", backgroundColor: shown.source ? "transparent" : t.paper }, cardStyle]}
      >
        <PreviewPicture card={shown} width={size.width} height={size.height} imageKey={`${shown.code}:${at}`} />
      </Animated.View>
    </GestureDetector>
  );
  const buttons = onDetails && shown.lostIsland !== true && shown.faceless !== true ? (
    <SecondaryButton
      label="Details"
      testID="card-preview-details"
      accessibilityLabel={`Open ${shown.name}`}
      onPress={() => {
        onClose();
        onDetails(shown.code);
      }}
    />
  ) : null;

  const scrolls = screen.fontScale > 1;
  const heading = (
    <>
      <Text testID="card-preview-name" accessibilityRole="header" className="font-display text-title text-bone">
        {shown.title ?? shown.name}
      </Text>
      {shown.detail ? <Text testID="card-preview-detail" className="text-label text-muted">{shown.detail}</Text> : null}
      {shown.role ? <Text className="text-label text-muted">{shown.role}</Text> : null}
      {(shown.tokens ?? []).length > 0 ? (
        <Text testID="card-preview-tokens" className="mt-1 text-body text-accent">
          {(shown.tokens ?? []).join(" · ")}
        </Text>
      ) : null}
      {rule ? <KeywordChips chips={drawnKeywords(shown.keywords, timingTips)} wrap onPick={pick} /> : null}
    </>
  );
  const body = (
    <>
        {shown.note ? (
          <View testID="card-preview-why" className="mb-2">
            <Text className="font-display text-eyebrow uppercase text-accent">{shown.noteTitle ?? "Not playable now"}</Text>
            <Text className="mt-1 text-body text-bone">{shown.note}</Text>
          </View>
        ) : null}
        {shown.notApplied ? (
          <View className="mb-2">
            <NotAppliedView notApplied={shown.notApplied} testID="card-preview-not-applied" />
          </View>
        ) : null}
        {(shown.steps ?? []).length > 0 ? (
          <View testID="card-preview-steps" className="mb-2">
            <Text className="font-display text-eyebrow uppercase text-accent">The four steps</Text>
            {(shown.steps ?? []).map((row) => (
              <Text key={row.text} accessibilityState={{ selected: row.current }} className={`mt-1 text-label ${row.current ? "text-accent" : "text-bone"}`}>
                {row.current ? `Now · ${row.text}` : row.text}
              </Text>
            ))}
          </View>
        ) : null}
        {(shown.effects ?? []).length > 0 ? (
          <View testID="card-preview-effects" className="mb-2">
            <Text className="font-display text-eyebrow uppercase text-accent">Effects on it</Text>
            {(shown.effects ?? []).map((line) => (
              <Text key={line} className="mt-1 text-label text-bone">
                {line}
              </Text>
            ))}
          </View>
        ) : null}
        {all.length > 1 ? (
          <View testID="card-preview-attached">
            <Text className="font-display text-eyebrow uppercase text-accent">{listHeading(all, at)}</Text>
            {all.map((item, index) => (
              <RelatedRow key={`${item.code}:${index}`} item={item} index={index} selected={index === at} onPress={() => show(index)} />
            ))}
          </View>
        ) : null}
    </>
  );

  return (
    <View testID="card-preview" accessibilityViewIsModal onAccessibilityEscape={back} style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.night }, scrimStyle]} />
      {/* The scrim is a button of its own under the content, so no control sits inside another (the web nests them as buttons in a button). The wrapper over it is not a
          control (no role, no tab stop): it takes the tap that lands on no control of the preview, and the preview closes, as before (user request, 2026-10-29). */}
      <Pressable testID="card-preview-scrim" accessibilityRole="button" accessibilityLabel="Close the preview" onPress={close} style={StyleSheet.absoluteFill} />
      <Pressable
        accessible={false}
        tabIndex={-1}
        onPress={close}
        style={[StyleSheet.absoluteFill, wide ? styles.row : styles.column, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left + 16 * s, paddingRight: insets.right + 16 * s }]}
      >
        {frame}
        {wide ? (
          <Animated.View style={[{ flex: 1, maxWidth: 360 * s, marginLeft: 20 * s, maxHeight: size.height }, buttonsStyle]}>
            {/* Not a control of its own: a tap here reaches the scrim and closes the preview too; only Details and the rows of what is
                with the card do something else (user request, 2026-10-29). */}
            <View style={{ flexShrink: 1 }}>
              {/* The column's words and rows sit above one ScrollView at the phone's default text size, as they always did; at a larger size
                  the whole column is the scroll, since its name, line, tokens and rows are as tall as their words and must reach the card's height. */}
              {scrolls ? (
                <ScrollView style={{ flexShrink: 1 }}>
                  {heading}
                  <View className="mt-2">{body}</View>
                </ScrollView>
              ) : (
                <>
                  {heading}
                  <ScrollView style={{ flexShrink: 1 }} className="mt-2">
                    {body}
                  </ScrollView>
                </>
              )}
              {buttons ? <View className="mt-2 flex-row gap-3">{buttons}</View> : null}
            </View>
          </Animated.View>
        ) : (
          <>
            {(shown.tokens ?? []).length > 0 ? (
              <Animated.View style={[{ marginTop: 12 * s, maxWidth: roomW - 32 * s }, buttonsStyle]}>
                <Text testID="card-preview-tokens" numberOfLines={capLines(2, screen.fontScale)} className="text-center text-body text-accent">
                  {(shown.tokens ?? []).join(" · ")}
                </Text>
              </Animated.View>
            ) : null}
            {keywordRow ? (
              <Animated.View style={[{ marginTop: 8 * s, maxWidth: roomW - 32 * s }, buttonsStyle]}>
                <KeywordChips chips={drawnKeywords(shown.keywords, timingTips)} wrap={false} onPick={pick} />
              </Animated.View>
            ) : null}
            {all.length > 1 ? (
              <Animated.View testID="card-preview-attached" style={[{ marginTop: 16 * s, maxWidth: roomW - 32 * s }, buttonsStyle]}>
                {/* No grow: a horizontal ScrollView grows by default, and on a phone it stretched the column past the screen's height, so the
                    centred card went off the top and Details off the foot. The strip is one chip tall, as previewStrip counts it. */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 * s }}>
                  {all.map((item, index) => (
                    <RelatedChip key={`${item.code}:${index}`} item={item} index={index} selected={index === at} onPress={() => show(index)} />
                  ))}
                </ScrollView>
              </Animated.View>
            ) : null}
            {buttons ? <Animated.View style={[{ flexDirection: "row", gap: 12 * s, marginTop: 16 * s }, buttonsStyle]}>{buttons}</Animated.View> : null}
          </>
        )}
      </Pressable>
      {rule ? <KeywordBubble bubble={bubble} open={bubbleOpen} rule={rule} onOpenRule={onOpenRule} onClose={() => setBubbleOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  column: { alignItems: "center", justifyContent: "center" },
});
