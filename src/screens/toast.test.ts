import { describe, expect, it } from "vitest";

import { dismissToast, getToast, leaveToastScreen, showToast, toastDuration } from "./toast.ts";

describe("toast", () => {
  it("shows the newest sentence, and a stale dismiss leaves it", () => {
    const first = showToast("Added Gandalf · 1 of 3", { undo: () => undefined });
    const second = showToast("Gandalf: At most three copies.", { tone: "danger" });
    expect(getToast()).toMatchObject({ id: second.id, tone: "danger", undo: null });
    dismissToast(first.id);
    expect(getToast()?.id).toBe(second.id);
    dismissToast(second.id);
    expect(getToast()).toBeNull();
  });

  it("goes with its screen unless it carries, and carries once", () => {
    showToast("Made Hobbits copy", { undo: () => undefined });
    leaveToastScreen();
    expect(getToast()).toBeNull();
    showToast("Saved Hobbits", { carry: true });
    leaveToastScreen();
    expect(getToast()).toMatchObject({ text: "Saved Hobbits", carry: false });
    leaveToastScreen();
    expect(getToast()).toBeNull();
  });

  it("stays longer for Undo, for a refusal and with a screen reader", () => {
    expect(toastDuration({ tone: "bone", undo: null }, false)).toBe(3000);
    expect(toastDuration({ tone: "danger", undo: null }, false)).toBe(4500);
    expect(toastDuration({ tone: "bone", undo: () => undefined }, false)).toBe(5000);
    expect(toastDuration({ tone: "bone", undo: null }, true)).toBe(10000);
  });
});
