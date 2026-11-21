// The audio session's mode on each phone (docs/design-system-table.md, Sound): iOS follows the silent switch, Android the media volume.
import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "ios" }));
const setAudioModeAsync = vi.hoisted(() => vi.fn((_mode: unknown) => Promise.resolve()));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("./audio-player", () => ({ setAudioModeAsync }));

async function startOn(os: string): Promise<unknown> {
  platform.OS = os;
  vi.resetModules();
  setAudioModeAsync.mockClear();
  const { startAudioSession } = await import("./session.ts");
  startAudioSession();
  return setAudioModeAsync.mock.calls[0]?.[0];
}

describe("startAudioSession", () => {
  beforeEach(() => {
    platform.OS = "ios";
  });

  it("plays on Android while the ringer is silent or vibrate", async () => {
    expect(await startOn("android")).toMatchObject({ playsInSilentMode: true, interruptionMode: "mixWithOthers" });
  });

  it("follows the silent switch on iOS", async () => {
    expect(await startOn("ios")).toMatchObject({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
  });
});
