// The web's flush on leaving (flush-runs-on-leave.ts): a hidden page and a closed one write the queued runs, once each.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("flushRunsOnLeave", () => {
  it("does nothing without a page", async () => {
    const { flushRunsOnLeave } = await import("./flush-runs-on-leave");
    expect(() => flushRunsOnLeave()).not.toThrow();
  });

  it("writes the queue when the page is hidden and when it is closed, and binds once", async () => {
    const listeners = new Map<string, () => void>();
    const document = { visibilityState: "visible", addEventListener: vi.fn((type: string, listener: () => void) => listeners.set(`document:${type}`, listener)) };
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", { addEventListener: vi.fn((type: string, listener: () => void) => listeners.set(`window:${type}`, listener)) });
    const { flushRunsOnLeave } = await import("./flush-runs-on-leave");
    const { pendingRuns, queueRun } = await import("../data/pending-runs");
    flushRunsOnLeave();
    flushRunsOnLeave();
    expect(document.addEventListener).toHaveBeenCalledTimes(1);

    const ran = vi.fn();
    queueRun(ran);
    listeners.get("document:visibilitychange")?.();
    expect(ran).not.toHaveBeenCalled();
    document.visibilityState = "hidden";
    listeners.get("document:visibilitychange")?.();
    expect(ran).toHaveBeenCalledTimes(1);
    expect(pendingRuns()).toBe(0);

    queueRun(ran);
    listeners.get("window:pagehide")?.();
    expect(ran).toHaveBeenCalledTimes(2);
  });
});
