// The dock's More popover (docs/design-system.md, Table, Command column; phase 22): when more than two quiet pills would show
// (dock-extras.ts, dockPills), they fold into one More pill, and this popover lists them. It draws in the table menu's frame
// (popover-frame.tsx), left of the command column and level with the pill, so the dock's readout, armed line and buttons stay
// uncovered. A tap outside closes it and does nothing else; a row closes it and then acts; Android Back closes it first (back.ts).
import { useCallback, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import type { DockExtra } from "./dock-buttons.tsx";
import { PopoverFrame, PopoverRow, type PressableRef } from "./popover-frame.tsx";

const WIDTH = 220;
// The gap between the popover and the command column.
const GAP = 6;

export type MorePopover = {
  open: boolean;
  // The screen y of the More pill's foot, which the popover is level with; null while closed.
  foot: number | null;
  show: (foot: number) => void;
  close: () => void;
};

/**
 * Whether the popover is open, and where. It closes by itself when nothing is folded any more or the moment or the pick changes
 * (`key`), so it never opens again onto something else.
 */
export function useMorePopover(count: number, key: string): MorePopover {
  const [at, setAt] = useState<{ foot: number; key: string } | null>(null);
  if (at && (count === 0 || at.key !== key)) setAt(null);
  // `close` is stable, so an effect (Android Back) can depend on it.
  const close = useCallback(() => setAt(null), []);
  const show = useCallback((foot: number) => setAt({ foot, key }), [key]);
  return { open: at != null && count > 0, foot: at?.foot ?? null, show, close };
}

export function MorePopoverView({ more, items, commandWidth, insetRight, onClose }: { more: MorePopover; items: readonly DockExtra[]; commandWidth: number; insetRight: number; onClose: () => void }) {
  const screen = useWindowDimensions();
  const first = useRef<PressableRef>(null);
  const foot = more.foot ?? screen.height;
  return (
    <PopoverFrame
      open={more.open}
      place={{ right: insetRight + commandWidth + GAP, bottom: Math.max(0, Math.round(screen.height - foot)) }}
      width={WIDTH}
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
  );
}
