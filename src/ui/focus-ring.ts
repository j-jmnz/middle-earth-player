// The focus ring (docs/design-system-table.md, Screen reader): an outline 2 pt wide, 2 pt off the control, in accentHigh (ink on paper), on every control of the
// table that a hardware keyboard can focus (iPad Full Keyboard Access, Android keyboard navigation; WCAG 2.4.7). It draws only while the
// control holds focus. A touch never focuses a Pressable on the phone (focus there comes from the keyboard or the focus engine), so a touch
// player sees nothing new. On the web the browser's own focus ring already answers a keyboard and mouse differently, so the hook draws none.
// A control spreads `props` on its Pressable and `style` on the face inside it, whose corner radius the outline follows.
import { useState } from "react";
import { Platform, type ViewStyle } from "react-native";

import { ringColorOf, ringStyleOf } from "./focus-ring-style.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

const onWeb = () => Platform.OS === "web";

export type FocusRing = { props: { onFocus: () => void; onBlur: () => void }; style: ViewStyle | undefined };

/** `onPaper`: the control stands on paper or parchment, where the ring is ink (ringColorOf, focus-ring-style.ts). */
export function useFocusRing(onPaper?: boolean): FocusRing {
  const t = useTableTokens();
  const s = useUiScale();
  const [focused, setFocused] = useState(false);
  const web = onWeb();
  return {
    props: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    style: focused && !web ? ringStyleOf(ringColorOf(t, onPaper === true), s) : undefined,
  };
}
