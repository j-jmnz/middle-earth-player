// A long press is also an action (docs/design-system.md, Screen reader): a screen reader cannot hold a finger down, so a control with an
// `onLongPress` offers the same thing in its actions menu, named for what it does ("Show card large"). Only accessibility props come out of
// here, so a touch is exactly what it was (user instruction, 2026-11-05: the reader path is separate from ordinary play).
import type { AccessibilityActionEvent, AccessibilityActionInfo } from "react-native";

export const LONG_PRESS_ACTION = "longPressAction";

type ActionHandler = (event: AccessibilityActionEvent) => void;

export type A11yActions = {
  accessibilityActions: AccessibilityActionInfo[];
  onAccessibilityAction: ActionHandler;
  accessibilityHint?: string;
};

/** The hint that names a long press: "Hold to show card large". */
export function longPressHint(label: string): string {
  return `Hold to ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** The actions, the handler and the hint for a control whose long press does `label`. */
export function longPressA11y(label: string, onLongPress: () => void): A11yActions {
  return {
    accessibilityActions: [{ name: LONG_PRESS_ACTION, label }],
    onAccessibilityAction: (event) => {
      if (event.nativeEvent.actionName === LONG_PRESS_ACTION) onLongPress();
    },
    accessibilityHint: longPressHint(label),
  };
}

/**
 * Several sets of actions on one control (a deck tile's Move up and Move down beside its long press). The actions are listed in order, a
 * chosen action goes to every handler (each answers only its own names), and the hints join in order. A part with no actions adds nothing.
 */
export function mergeA11yActions(...parts: (Partial<A11yActions> | null | undefined)[]): A11yActions {
  const used = parts.filter((part): part is Partial<A11yActions> => part != null);
  const hints = used.map((part) => part.accessibilityHint).filter((hint): hint is string => !!hint);
  return {
    accessibilityActions: used.flatMap((part) => part.accessibilityActions ?? []),
    onAccessibilityAction: (event) => {
      for (const part of used) part.onAccessibilityAction?.(event);
    },
    accessibilityHint: hints.length > 0 ? hints.join(". ") : undefined,
  };
}
