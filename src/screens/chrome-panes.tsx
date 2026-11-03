// The wide-screen layouts (docs/design-system.md, Tablets). A Column is a centred reading or list column; a TwoPane is a list and its
// detail, or a page and its supporting pane. In compact both are the plain phone tree: a Column adds no cap and a TwoPane is not used
// (a screen branches on the size class and renders its phone layout). Re-exported by chrome.tsx.
import { useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";

import { capWidth, paneWidths, type PaneKind } from "../ui/size-class";
import { useSizeClass } from "../ui/use-size-class";

/** A column centred in the screen, no wider than a reading column (640) or a wide one (1040) at the scale; the full width in compact. */
export function Column({ children, max = "readable", testID }: { children: ReactNode; max?: "readable" | "wide"; testID?: string }) {
  const { size, s } = useSizeClass();
  const cap = capWidth(size, max, s);
  return (
    <View testID={testID} style={cap == null ? undefined : { width: "100%", maxWidth: cap, alignSelf: "center" }}>
      {children}
    </View>
  );
}

/**
 * Two panes side by side, measured: `side` names the fixed one ("start" for a list or a briefing's scene, "end" for a path's
 * supporting column) and its width comes from `paneWidths` (the kind's range, or `range` in Medium's points); the other takes the rest after a 24 pt gap. Each pane is `position:
 * relative`, so a NavBar, a shade or an ActionBar can be scoped to its pane. Nothing draws until the width is measured.
 */
export function TwoPane({ kind, start, end, side = "start", range, testID }: { kind: PaneKind; start: ReactNode; end: ReactNode; side?: "start" | "end"; range?: { min: number; max: number }; testID?: string }) {
  const { s } = useSizeClass();
  const [width, setWidth] = useState(0);
  const panes = width > 0 ? paneWidths(kind, width, s, range) : null;
  const fixed = { width: panes?.side, position: "relative" as const, minHeight: 0 };
  const rest = { flex: 1, position: "relative" as const, minHeight: 0 };
  return (
    <View testID={testID} className="min-h-0 flex-1 flex-row" style={{ gap: panes?.gap }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      {panes ? (
        <>
          <View style={side === "start" ? fixed : rest}>{start}</View>
          <View style={side === "end" ? fixed : rest}>{end}</View>
        </>
      ) : null}
    </View>
  );
}
