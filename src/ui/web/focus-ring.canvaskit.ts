// The focus ring on the web and the desktop (src/ui/focus-ring.ts is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only,
// so the phone's bundle never sees it). The ring is the one the phone draws (docs/design-system-table.md, Screen reader): an outline 2 pt wide, 2 pt off the
// control, in accentHigh (ink on paper), for a keyboard's focus. A click focuses a control on the web too and does not draw it: the browser says which it was
// (`:focus-visible`). The browser's own ring, on the Pressable the face sits in, is put out while ours shows, so a focused control wears one ring.
// A control spreads `props` on its Pressable and `style` on the face inside it, whose corner radius the outline follows.
import { useRef, useState } from "react";
import type { ViewStyle } from "react-native";

import { ringColorOf, ringStyleOf } from "../focus-ring-style.ts";
import { keyboardFocus } from "./keyboard-focus.ts";
import { useUiScale } from "../ui-scale.ts";
import { useTableTokens } from "../use-table-tokens.ts";

export type FocusRing = { props: { onFocus: () => void; onBlur: () => void }; style: ViewStyle | undefined };

// The focused element, with the browser's outline off (a keyboard's focus only), and then back to the browser's.
function focusedElement(): HTMLElement | null {
  if (typeof document === "undefined" || !keyboardFocus(document)) return null;
  const element = document.activeElement;
  return element instanceof HTMLElement ? element : null;
}

/** `onPaper`: the control stands on paper or parchment, where the ring is ink (ringColorOf, focus-ring-style.ts). */
export function useFocusRing(onPaper?: boolean): FocusRing {
  const t = useTableTokens();
  const s = useUiScale();
  const [focused, setFocused] = useState(false);
  const plain = useRef<HTMLElement | null>(null);
  return {
    props: {
      onFocus: () => {
        const element = focusedElement();
        if (element) element.style.outlineStyle = "none";
        plain.current = element;
        setFocused(typeof document === "undefined" || keyboardFocus(document));
      },
      onBlur: () => {
        if (plain.current) plain.current.style.outlineStyle = "";
        plain.current = null;
        setFocused(false);
      },
    },
    style: focused ? ringStyleOf(ringColorOf(t, onPaper === true), s) : undefined,
  };
}
