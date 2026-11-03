// The dock's More popover (docs/design-system-table.md, Command column; phase 22), and the "i" popover beside it (dock/lines-popover.tsx): when more than two quiet pills would show
// (dock/extras.ts, dockPills), they fold into one More pill, and this popover lists them. It draws in the table menu's frame
// (popover-frame.tsx), left of the command column and level with the pill, so the dock's readout, armed line and buttons stay
// uncovered. A tap outside closes it and does nothing else; a row closes it and then acts; Android Back closes it first (back.ts).
import { useCallback, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import type { DockExtra } from "./buttons.tsx";
import { LinesPopover } from "./lines-popover.tsx";
import type { Unavailable } from "../sheet-types.ts";
import { PopoverFrame, PopoverRow, type PressableRef } from "../../../ui/popover-frame.tsx";
import { useUiScale } from "../../../ui/ui-scale.ts";

const WIDTH = 220;
// The gap between the popover and the command column.
const GAP = 6;

export type MorePopover = {
  // The More popover (the folded quiet pills) is open.
  open: boolean;
  // The "i" popover (the full title and every line of the moment) is open. Only one of the two is ever open.
  lines: boolean;
  // The screen y the open popover is level with (the More pill's foot, the "i" pill's top), kept after it closes so it leaves where
  // it stood; null until one opens.
  foot: number | null;
  show: (foot: number) => void;
  showLines: (top: number) => void;
  close: () => void;
};

/**
 * Whether a popover is open, which, and where. Both close by themselves when the moment or the pick changes (`key`), and the
 * More popover when nothing is folded any more (`count`), so neither opens again onto something else.
 */
export function useMorePopover(count: number, key: string): MorePopover {
  const [at, setAt] = useState<{ foot: number; key: string; kind: "more" | "lines" } | null>(null);
  // Where the last one opened. A closed popover still plays its leave there: dropping the place with `at` made the "i" popover jump to
  // the top of the screen (and the More popover to its foot) while it faded out.
  const [last, setLast] = useState<number | null>(null);
  if (at && at.foot !== last) setLast(at.foot);
  if (at && ((at.kind === "more" && count === 0) || at.key !== key)) setAt(null);
  // `close` is stable, so an effect (Android Back) can depend on it.
  const close = useCallback(() => setAt(null), []);
  const show = useCallback((foot: number) => setAt({ foot, key, kind: "more" }), [key]);
  const showLines = useCallback((top: number) => setAt({ foot: top, key, kind: "lines" }), [key]);
  return { open: at?.kind === "more" && count > 0, lines: at?.kind === "lines", foot: at?.foot ?? last, show, showLines, close };
}

// What the "i" popover holds: the full title, then the guide, the note and the refusals (dock/lines.ts).
export type DockWords = { title: string; guide: string | null; note: string | null; unavailable: readonly Unavailable[] };

export function MorePopoverView({ more, items, words, commandWidth, insetRight, onClose }: { more: MorePopover; items: readonly DockExtra[]; words: DockWords; commandWidth: number; insetRight: number; onClose: () => void }) {
  const screen = useWindowDimensions();
  const s = useUiScale();
  const first = useRef<PressableRef>(null);
  const foot = more.foot ?? screen.height;
  return (
    <>
      <PopoverFrame
        open={more.open}
        place={{ right: insetRight + commandWidth + GAP * s, bottom: Math.max(0, Math.round(screen.height - foot)) }}
        width={WIDTH * s}
        origin="100% 100%"
        ids={{ layer: "dock-more-layer", scrim: "dock-more-scrim", popover: "dock-more-popover" }}
        closeLabel="Close the list"
        focusRef={first}
        onClose={onClose}
      >
        {items.map((item, index) => (
          <PopoverRow
            key={item.testID}
            item={{ testID: item.testID, label: item.label, accessibilityLabel: item.accessibilityLabel }}
            rowRef={index === 0 ? first : undefined}
            onPress={() => {
              onClose();
              item.onPress();
            }}
          />
        ))}
      </PopoverFrame>
      <LinesPopover open={more.lines} top={more.foot} words={words} commandWidth={commandWidth} insetRight={insetRight} onClose={onClose} />
    </>
  );
}
