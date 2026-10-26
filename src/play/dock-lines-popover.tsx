// The dock's "i" popover (docs/design-system.md, Table, Command column; phase 22): the full title, then the guide, the note and
// what the rules refuse now, in the table menu's frame (popover-frame.tsx) at the left of the command column, level with the "i"
// pill. Opening it changes nothing in the dock. It has an accessible "✕ Close" row, closes on a tap outside and on Android Back
// (back.ts), and scrolls only past the room it has (`maxHeight`), which holds a guide, a note and two refusals.
import { useRef } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";

import { CLOSE_ROW, linesPlace } from "./dock-budget.ts";
import { dockLines } from "./dock-lines.ts";
import type { DockWords } from "./dock-more.tsx";
import { PopoverFrame, PopoverRow, type PressableRef } from "./popover-frame.tsx";
import { tableTokens as t } from "./tokens.ts";

const GAP = 6;
const TONE = { guide: t.bone, note: t.muted, unavailable: t.faint } as const;

export function LinesPopover({ open, top, words, commandWidth, insetRight, onClose }: { open: boolean; top: number | null; words: DockWords; commandWidth: number; insetRight: number; onClose: () => void }) {
  const screen = useWindowDimensions();
  const close = useRef<PressableRef>(null);
  const at = top ?? 0;
  const { width, maxHeight } = linesPlace({ screenWidth: screen.width, screenHeight: screen.height, commandWidth, insetLeft: 0, insetRight, top: at });
  const lines = dockLines({ guide: words.guide, note: words.note, unavailable: words.unavailable });
  const all = lines.first ? [lines.first, ...lines.rest] : [];
  return (
    <PopoverFrame
      open={open}
      place={{ right: insetRight + commandWidth + GAP, top: Math.max(0, at - 4) }}
      width={width}
      origin="100% 0%"
      ids={{ layer: "dock-more-lines-layer", scrim: "dock-more-lines-scrim", popover: "dock-more-lines" }}
      closeLabel="Close the notes"
      focusRef={close}
      onClose={onClose}
    >
      <PopoverRow item={{ testID: "dock-more-lines-close", label: "✕ Close", accessibilityLabel: "Close the notes" }} rowRef={close} onPress={onClose} />
      <ScrollView testID="dock-more-lines-scroll" style={{ maxHeight: maxHeight - CLOSE_ROW - 8 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 14, paddingBottom: 10, gap: 4 }}>
          <Text testID="dock-more-lines-title" accessibilityRole="header" className="font-display text-body" style={{ color: t.bone }}>
            {words.title}
          </Text>
          {all.map((line) => (
            <Text key={line.testID} testID={`${line.testID}-full`} className="text-label" style={{ color: TONE[line.kind] }}>
              {line.text}
            </Text>
          ))}
        </View>
      </ScrollView>
    </PopoverFrame>
  );
}
