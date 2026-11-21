// Measures a wide scroll's content and says how a two-column screen splits it (split-columns.ts). Render `measure` as the onLayout of a
// zero-height View at the top of a `wide` ScreenScroll, outside the columns, so the width does not depend on the answer.
import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";

import { useSizeClass } from "../../ui/use-size-class";
import { sideSplit } from "./split-columns";

export function useSplitColumns(range: { min: number; max: number } | null): {
  size: ReturnType<typeof useSizeClass>["size"];
  s: number;
  // The measured width of the scroll's content (0 until measured).
  width: number;
  measure: (event: LayoutChangeEvent) => void;
  side: ReturnType<typeof sideSplit>;
} {
  const { size, s } = useSizeClass();
  const [width, setWidth] = useState(0);
  const expanded = size === "expanded";
  return {
    size,
    s,
    width,
    measure: (event) => setWidth(event.nativeEvent.layout.width),
    side: expanded && range ? sideSplit(width, s, range) : null,
  };
}
