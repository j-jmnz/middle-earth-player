// The Haptics setting (user request, 2026-10-28): with it off no tick reaches the module.
import { afterEach, describe, expect, it, vi } from "vitest";

import { tickArmed, tickImpact, tickLand, tickRefused, tickSent } from "./haptics.ts";
import { tableSettings } from "./table-settings.ts";

const calls = vi.hoisted(() => ({ n: 0 }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-haptics", () => ({
  selectionAsync: () => {
    calls.n += 1;
    return Promise.resolve();
  },
  impactAsync: () => {
    calls.n += 1;
    return Promise.resolve();
  },
  notificationAsync: () => {
    calls.n += 1;
    return Promise.resolve();
  },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning" },
}));

afterEach(() => {
  tableSettings.getState().update({ haptics: true });
  calls.n = 0;
});

describe("haptics setting", () => {
  it("ticks while Haptics is on", () => {
    for (const tick of [tickArmed, tickSent, tickRefused, tickLand, tickImpact]) tick();
    expect(calls.n).toBe(5);
  });

  it("is silent while Haptics is off", () => {
    tableSettings.getState().update({ haptics: false });
    for (const tick of [tickArmed, tickSent, tickRefused, tickLand, tickImpact]) tick();
    expect(calls.n).toBe(0);
  });
});
