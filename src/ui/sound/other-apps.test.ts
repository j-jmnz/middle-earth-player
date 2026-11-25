// The Stop other audio rule (other-apps.ts): the audio of other apps is claimed as the rule starts, as the app comes back to the
// front and as the setting changes, and at no other moment.
import { afterEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ claims: 0, appState: null as ((state: string) => void) | null }));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      calls.appState = listener;
      return { remove: () => (calls.appState = null) };
    },
  },
}));
vi.mock("./session.ts", () => ({ claimAudio: () => void (calls.claims += 1) }));

vi.resetModules();
const { watchOtherAudio } = await import("./other-apps.ts");
const { tableSettings } = await import("../table-settings.ts");

afterEach(() => {
  tableSettings.getState().update({ stopOtherAudio: true, music: true });
  calls.claims = 0;
});

describe("watchOtherAudio", () => {
  it("claims the audio as it starts and each time the app comes back to the front", () => {
    const stop = watchOtherAudio();
    expect(calls.claims).toBe(1);
    calls.appState?.("background");
    expect(calls.claims).toBe(1);
    calls.appState?.("active");
    expect(calls.claims).toBe(2);
    stop();
  });

  it("claims again when the setting changes, and not for another setting", () => {
    const stop = watchOtherAudio();
    tableSettings.getState().update({ music: false });
    expect(calls.claims).toBe(1);
    tableSettings.getState().update({ stopOtherAudio: false });
    expect(calls.claims).toBe(2);
    stop();
  });

  it("listens to nothing once stopped", () => {
    watchOtherAudio()();
    calls.claims = 0;
    tableSettings.getState().update({ stopOtherAudio: false });
    expect(calls.appState).toBeNull();
    expect(calls.claims).toBe(0);
  });
});
