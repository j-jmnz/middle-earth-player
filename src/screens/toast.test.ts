import { describe, expect, it } from "vitest";

import { dismissToast, getToast, showToast, toastDuration } from "./toast.ts";

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

  it("stays longer for a refusal and with a screen reader", () => {
    expect(toastDuration("bone", false)).toBe(3000);
    expect(toastDuration("danger", false)).toBe(4500);
    expect(toastDuration("bone", true)).toBe(10000);
  });
});
