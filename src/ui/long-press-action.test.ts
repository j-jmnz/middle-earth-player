import { describe, expect, it, vi } from "vitest";

import { LONG_PRESS_ACTION, longPressA11y, longPressHint, mergeA11yActions } from "./long-press-action.ts";

const event = (actionName: string) => ({ nativeEvent: { actionName } }) as never;

describe("longPressA11y", () => {
  it("offers the long press as a named action that runs it", () => {
    const run = vi.fn();
    const props = longPressA11y("Show card large", run);
    expect(props.accessibilityActions).toEqual([{ name: LONG_PRESS_ACTION, label: "Show card large" }]);
    props.onAccessibilityAction(event("somethingElse"));
    expect(run).not.toHaveBeenCalled();
    props.onAccessibilityAction(event(LONG_PRESS_ACTION));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("hints at what holding does", () => {
    expect(longPressHint("Show card large")).toBe("Hold to show card large");
    expect(longPressA11y("Start managing", () => {}).accessibilityHint).toBe("Hold to start managing");
  });
});

describe("mergeA11yActions", () => {
  it("lists the actions in order and sends a chosen action to the part that owns it", () => {
    const up = vi.fn();
    const hold = vi.fn();
    const moves = { accessibilityActions: [{ name: "moveUp", label: "Move up" }], onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => e.nativeEvent.actionName === "moveUp" && up() };
    const merged = mergeA11yActions(moves as never, longPressA11y("Manage decks", hold));
    expect(merged.accessibilityActions.map((action) => action.label)).toEqual(["Move up", "Manage decks"]);
    merged.onAccessibilityAction(event("moveUp"));
    expect(up).toHaveBeenCalledTimes(1);
    expect(hold).not.toHaveBeenCalled();
    merged.onAccessibilityAction(event(LONG_PRESS_ACTION));
    expect(hold).toHaveBeenCalledTimes(1);
  });

  it("skips an absent part and joins the hints", () => {
    const merged = mergeA11yActions(null, undefined, longPressA11y("Show card large", () => {}), { accessibilityHint: "Opens the deck" });
    expect(merged.accessibilityActions).toHaveLength(1);
    expect(merged.accessibilityHint).toBe("Hold to show card large. Opens the deck");
    expect(mergeA11yActions().accessibilityHint).toBeUndefined();
  });
});
