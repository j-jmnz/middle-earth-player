// The keyword chips of the table's card preview and the bubble a chip opens (docs/design-system-table.md, Cards): each chip is a
// control of its own, so a tap on one never reaches the preview's scrim and closes it; the bubble quotes the rule span in a PopoverFrame
// of its own, whose scrim closes the bubble only. The screen turns a rule id into text (`rule`), the preview owns which bubble is open.
import { useRef } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { TextButton } from "../../ui/buttons.tsx";
import { useFocusRing } from "../../ui/focus-ring.ts";
import { PopoverFrame, type PressableRef } from "../../ui/popover-frame.tsx";
import { chipSurface } from "../../ui/surfaces.ts";
import { withAlphaHex } from "../../ui/tokens.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";
import { CardTextView } from "./card-text-view.tsx";
import type { PreviewKeyword } from "./preview-keywords.ts";

/** What the screen answers for a rule id: the span's paragraphs, where it is printed, and whether the Rules tab can open it. */
export type RuleTip = { paragraphs: readonly string[]; source: string; openable: boolean };

/** A chip's place in the window, as `measureInWindow` gives it. */
export type Anchor = { x: number; y: number; width: number; height: number };

/** The bubble that is (or was last) open: its chip's word and rule, where the chip sits, and which of the cards with it was shown. */
export type Bubble = { word: string; ruleId: string; anchor: Anchor; at: number };

function labelOf(chip: PreviewKeyword): string {
  if (chip.timing) return `${chip.word}, timing word`;
  return chip.lost ? `${chip.word}, keyword, lost for now` : `${chip.word}, keyword`;
}

function Chip({ chip, onPick }: { chip: PreviewKeyword; onPick: (chip: PreviewKeyword, anchor: Anchor) => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const ring = useFocusRing();
  const ref = useRef<PressableRef>(null);
  const open = () => ref.current?.measureInWindow((x, y, width, height) => onPick(chip, { x, y, width, height }));
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
            height: 32 * s,
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
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 14 * s, height: 14 * s, borderRadius: 7 * s, borderWidth: 1, borderColor: t.muted, alignItems: "center", justifyContent: "center" }}>
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
export function KeywordChips({ chips, wrap, onPick }: { chips: readonly PreviewKeyword[]; wrap: boolean; onPick: (chip: PreviewKeyword, anchor: Anchor) => void }) {
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

const WIDTH = 320;
const EDGE = 8;

/**
 * The bubble: the word, the rule span's paragraphs, where it is printed and Open in Rules. It hangs under its chip (over it when the chip is in the
 * lower half), clamped to the screen. Always mounted while the preview offers chips, so it grows in and out; `bubble` keeps the last chip's words while it leaves.
 */
export function KeywordBubble({ bubble, open, rule, onOpenRule, onClose }: { bubble: Bubble | null; open: boolean; rule: (id: string) => RuleTip | null; onOpenRule?: (id: string) => void; onClose: () => void }) {
  const screen = useWindowDimensions();
  const s = useUiScale();
  const title = useRef<PressableRef>(null);
  const width = Math.min(WIDTH * s, screen.width - 2 * EDGE);
  const anchor = bubble?.anchor ?? { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(Math.max(EDGE, anchor.x), screen.width - width - EDGE);
  const below = anchor.y + anchor.height / 2 < screen.height / 2;
  const place = below ? { top: anchor.y + anchor.height + 6 * s, left } : { bottom: screen.height - anchor.y + 6 * s, left };
  const tip = bubble ? rule(bubble.ruleId) : null;
  return (
    <PopoverFrame
      open={open && bubble != null}
      place={place}
      width={width}
      origin={below ? "top left" : "bottom left"}
      ids={{ layer: "card-preview-keyword-layer", scrim: "card-preview-keyword-scrim", popover: "card-preview-keyword-bubble" }}
      closeLabel="Close the rule"
      focusRef={title}
      onClose={onClose}
    >
      {bubble ? (
        <View style={{ padding: 8 * s }}>
          <View ref={title} collapsable={false} accessible>
            <Text accessibilityRole="header" className="font-display text-heading text-bone">
              {bubble.word}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: screen.height * 0.45, marginTop: 6 * s }}>
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
