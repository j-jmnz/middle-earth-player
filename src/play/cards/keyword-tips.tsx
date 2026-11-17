// The keyword chips of the table's card preview and the bubble a chip opens (docs/design-system-table.md, Cards): each chip is a
// control of its own, so a tap on one never reaches the preview's scrim and closes it; the bubble quotes the rule span in a PopoverFrame
// of its own, whose scrim closes the bubble only. The screen turns a rule id into text (`rule`), the preview owns which bubble is open.
import { useRef, type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TextButton } from "../../ui/buttons.tsx";
import { useFocusRing } from "../../ui/focus-ring.ts";
import { POPOVER_PAD, PopoverFrame, type PressableRef } from "../../ui/popover-frame.tsx";
import { chipSurface } from "../../ui/surfaces.ts";
import { withAlphaHex } from "../../ui/tokens.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";
import { CardTextView } from "./card-text-view.tsx";
import { bubblePlace, type Anchor } from "./bubble-place.ts";
import type { Bubble, RuleTip } from "./keyword-tip-types.ts";
import type { PreviewKeyword } from "./preview-keywords.ts";

/** A chip's tap: the chip, where it sits in the window, and the control itself (focus goes back to it when the bubble closes). */
export type PickChip = (chip: PreviewKeyword, anchor: Anchor, opener: RefObject<PressableRef | null>) => void;

/** Gives the screen reader's focus back to the chip that opened the bubble. A module-level function: the React Compiler cannot compile a try/catch inside a component. */
export function focusChip(chip: RefObject<PressableRef | null>): void {
  try {
    const node = chip.current ? findNodeHandle(chip.current) : null;
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
  } catch {
    // A platform without accessibility focus has nothing to move.
  }
}

function labelOf(chip: PreviewKeyword): string {
  if (chip.timing) return `${chip.word}, timing word`;
  return chip.lost ? `${chip.word}, keyword, lost for now` : `${chip.word}, keyword`;
}

function Chip({ chip, onPick }: { chip: PreviewKeyword; onPick: PickChip }) {
  const t = useTableTokens();
  const s = useUiScale();
  // The capsule and its "i" follow the text size: the system's font scale grows the label, so they grow with it (a 200% label must fit its capsule).
  const text = useWindowDimensions().fontScale;
  const ring = useFocusRing();
  const ref = useRef<PressableRef>(null);
  const open = () => ref.current?.measureInWindow((x, y, width, height) => onPick(chip, { x, y, width, height }, ref));
  return (
    <Pressable
      {...ring.props}
      ref={ref}
      collapsable={false}
      testID={`card-preview-keyword-${chip.word}`}
      accessibilityRole="button"
      accessibilityLabel={labelOf(chip)}
      accessibilityHint="Shows its rule"
      onPress={open}
      style={{ minHeight: touch(s, 44), justifyContent: "center" }}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: 32 * s,
            paddingVertical: 4 * s,
            flexDirection: "row",
            alignItems: "center",
            gap: 6 * s,
            paddingHorizontal: 12 * s,
            borderRadius: 16 * s,
            // A timing word is an outline only, so the keywords read first.
            ...(chip.timing ? { borderWidth: 1, borderColor: withAlphaHex(t.muted, 0.6), backgroundColor: pressed ? t.pressed : "transparent" } : chipSurface(false, pressed, t)),
            ...ring.style,
          }}
        >
          <Text className="font-display text-label" style={{ color: chip.lost ? t.muted : t.bone, textDecorationLine: chip.lost ? "line-through" : "none" }}>
            {chip.word}
          </Text>
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 14 * s * text, height: 14 * s * text, borderRadius: 7 * s * text, borderWidth: 1, borderColor: t.muted, alignItems: "center", justifyContent: "center" }}>
            <Text className="font-display text-muted" style={{ fontSize: 9 * s, lineHeight: 11 * s }}>
              i
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The chips of a card's keywords. `wrap`: the wide column wraps them onto as many rows as they need; under an upright card they are one
 * row that scrolls sideways, as tall as previewStrip counts it.
 */
export function KeywordChips({ chips, wrap, onPick }: { chips: readonly PreviewKeyword[]; wrap: boolean; onPick: PickChip }) {
  const s = useUiScale();
  if (chips.length === 0) return null;
  const items = chips.map((chip) => <Chip key={`${chip.word}:${chip.timing === true}`} chip={chip} onPick={onPick} />);
  if (wrap) {
    return (
      <View testID="card-preview-keywords" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 6 * s, marginTop: 4 * s }}>
        {items}
      </View>
    );
  }
  return (
    <ScrollView testID="card-preview-keywords" horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ columnGap: 6 * s }}>
      {items}
    </ScrollView>
  );
}

/**
 * The bubble: the word, the rule span's paragraphs, where it is printed and Open in Rules. It hangs under its chip or over it, on the side with more room, clamped
 * inside the safe area (bubble-place.ts); the rule's words scroll in what room is left, so the source and Open in Rules never leave the screen. Always mounted while
 * the preview offers chips, so it grows in and out; `bubble` keeps the last chip's words while it leaves.
 */
export function KeywordBubble({ bubble, open, rule, onOpenRule, onClose }: { bubble: Bubble | null; open: boolean; rule: (id: string) => RuleTip | null; onOpenRule?: (id: string) => void; onClose: () => void }) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = useUiScale();
  const title = useRef<PressableRef>(null);
  const anchor = bubble?.anchor ?? { x: 0, y: 0, width: 0, height: 0 };
  const where = bubblePlace(anchor, screen, insets, s);
  const place = where.below ? { top: where.top, left: where.left } : { bottom: where.bottom, left: where.left };
  const tip = bubble ? rule(bubble.ruleId) : null;
  return (
    <PopoverFrame
      open={open && bubble != null}
      place={place}
      width={where.width}
      origin={where.below ? "top left" : "bottom left"}
      ids={{ layer: "card-preview-keyword-layer", scrim: "card-preview-keyword-scrim", popover: "card-preview-keyword-bubble" }}
      closeLabel="Close the rule"
      focusRef={title}
      onClose={onClose}
    >
      {bubble ? (
        <View style={{ padding: 8 * s, maxHeight: Math.max(0, where.room - 2 * POPOVER_PAD * s) }}>
          <View ref={title} collapsable={false} accessible>
            <Text accessibilityRole="header" className="font-display text-heading text-bone">
              {bubble.word}
            </Text>
          </View>
          <ScrollView style={{ flexShrink: 1, marginTop: 6 * s }}>
            <CardTextView text={(tip?.paragraphs ?? []).join("\n")} tone="night" />
          </ScrollView>
          {tip ? <Text className="mt-2 text-label text-muted">{tip.source}</Text> : null}
          {tip?.openable && onOpenRule ? (
            <View className="mt-1 flex-row">
              <TextButton testID="card-preview-keyword-open" label="Open in Rules" tone="accent" onPress={() => onOpenRule(bubble.ruleId)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </PopoverFrame>
  );
}
