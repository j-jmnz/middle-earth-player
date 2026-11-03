// A FlashList on a wide screen: its rows sit in a centred column (docs/design-system.md, Tablets). The list measures its own width and
// insets its content by `gutter`, so a header or footer inside it keeps the column and the scrollbar stays at the list's edge.
// Compact returns no style at all, so a phone's list is the tree it was. Outside compact the width starts at the window's less the
// page inset (`pageInset`, 24 for a Screen, 0 for one that is not inset), so the first frame is already in the column.
import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";

import { gutter } from "../../ui/size-class";
import { useSizeClass } from "../../ui/use-size-class";
import { seedWidth } from "./split-columns";

export function useListGutter(max: "readable" | "wide" = "readable", pageInset = 24): {
  onLayout: (event: LayoutChangeEvent) => void;
  contentContainerStyle: { paddingHorizontal: number } | undefined;
  /** The inset itself, 0 in compact: for a list whose full-width bands pad their own text (a sticky header). */
  inset: number;
} {
  const { size, s, width: windowWidth } = useSizeClass();
  const [width, setWidth] = useState(() => seedWidth(size, windowWidth, s, pageInset));
  const inset = gutter(width, size, max, s);
  return {
    inset,
    onLayout: (event) => setWidth(event.nativeEvent.layout.width),
    contentContainerStyle: inset > 0 ? { paddingHorizontal: inset } : undefined,
  };
}
