// A reading panel's screen reader focus (docs/design-system-table.md, Screen reader, Reading panels): when a panel opens, focus moves to its
// header (the Log: its newest line). A panel mounts when it opens, so the hook returns the ref the header carries and moves focus to it
// once the panel has settled (use-open-focus.ts). Reader mode only; a sighted player and the web build run nothing here.
import { useRef, type ComponentRef, type RefObject } from "react";
import type { View } from "react-native";

import { useOpenFocus } from "../../ui/use-open-focus.ts";

export function usePanelFocus(): RefObject<ComponentRef<typeof View> | null> {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useOpenFocus(ref, "panel");
  return ref;
}
