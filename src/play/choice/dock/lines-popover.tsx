// The dock's "i" popover (docs/design-system-table.md, Command column; phase 22): the full title, then the guide, the note and
// what the rules refuse now, in the table menu's frame (popover-frame.tsx) at the left of the command column, level with the "i"
// pill. Opening it changes nothing in the dock. It has the round ✕ "Close" button at its top right, closes on a tap outside and on Android Back
// (back.ts), and scrolls only past the room it has (`maxHeight`), which holds a guide, a note and two refusals.
import { useRef } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { CloseButton } from "../../../ui/buttons.tsx";
import { linesPlace } from "./budget.ts";
import { dockLines } from "./lines.ts";
import type { DockWords } from "./more.tsx";
import { PopoverFrame, type PressableRef } from "../../../ui/popover-frame.tsx";
import type { TableTokens } from "../../../ui/tokens.ts";
import { touch, useUiScale } from "../../../ui/ui-scale.ts";
import { useTableTokens } from "../../../ui/use-table-tokens.ts";
import { Text } from "../../../ui/text.tsx";

const GAP = 6;
// The popover frame's padding on both sides of its content (popover-frame.tsx).
const FRAME_PAD = 12;
const toneOf = (t: TableTokens) => ({ guide: t.bone, note: t.muted, unavailable: t.faint }) as const;

export function LinesPopover({ open, top, words, commandWidth, insetRight, onClose }: { open: boolean; top: number | null; words: DockWords; commandWidth: number; insetRight: number; onClose: () => void }) {
  const screen = useWindowDimensions();
  const t = useTableTokens();
  const s = useUiScale();
  const close = useRef<PressableRef>(null);
  const at = top ?? 0;
  const { width, maxHeight } = linesPlace({ screenWidth: screen.width, screenHeight: screen.height, commandWidth, insetLeft: 0, insetRight, top: at }, s);
  const lines = dockLines({ guide: words.guide, note: words.note, unavailable: words.unavailable });
  const tones = toneOf(t);
  const all = lines.first ? [lines.first, ...lines.rest] : [];
  return (
    <PopoverFrame
      open={open}
      place={{ right: insetRight + commandWidth + GAP * s, top: Math.max(0, at - 4 * s) }}
      width={width}
      origin="100% 0%"
      ids={{ layer: "dock-more-lines-layer", scrim: "dock-more-lines-scrim", popover: "dock-more-lines" }}
      closeLabel="Close the notes"
      focusRef={close}
      onClose={onClose}
    >
      <View>
        <ScrollView testID="dock-more-lines-scroll" style={{ maxHeight: maxHeight - FRAME_PAD * s }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 14 * s, paddingBottom: 10 * s, paddingTop: 4 * s, gap: 4 * s }}>
            <Text testID="dock-more-lines-title" accessibilityRole="header" className="font-display text-heading" style={{ color: t.bone, lineHeight: 24 * s, paddingRight: touch(s, 44) - 8 * s }}>
              {words.title}
            </Text>
            {all.map((line) => (
              <Text key={line.testID} testID={`${line.testID}-full`} className="text-label" style={{ color: tones[line.kind] }}>
                {line.text}
              </Text>
            ))}
          </View>
        </ScrollView>
        {/* The round ✕ at the top right, over the title's end, which keeps its room clear of it. */}
        <View style={{ position: "absolute", top: -2 * s, right: -2 * s }}>
          <CloseButton testID="dock-more-lines-close" onPress={onClose} pressRef={close} />
        </View>
      </View>
    </PopoverFrame>
  );
}
