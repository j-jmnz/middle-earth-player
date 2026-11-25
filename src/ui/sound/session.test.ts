// The audio session's mode on each phone (docs/design-system-table.md, Sound): iOS follows the silent switch, Android the media
// volume; with Stop other audio on, the app stops the audio of other apps, and with it off it mixes with it.
import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "ios" }));
const setAudioModeAsync = vi.hoisted(() => vi.fn((_mode: unknown) => Promise.resolve()));
const other = vi.hoisted(() => ({ stopped: 0, allowed: 0 }));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("./audio-player", () => ({ setAudioModeAsync }));
vi.mock("./other-audio", () => ({ stopOtherAudio: () => void (other.stopped += 1), allowOtherAudio: () => void (other.allowed += 1) }));

type Session = typeof import("./session.ts");
type Settings = typeof import("../table-settings.ts");

// A fresh session.ts on a platform, with the Stop other audio setting as given. The settings come from the same fresh load.
async function load(os: string, stopOtherAudio: boolean): Promise<Session & Pick<Settings, "tableSettings">> {
  platform.OS = os;
  vi.resetModules();
  setAudioModeAsync.mockClear();
  other.stopped = 0;
  other.allowed = 0;
  const { tableSettings } = await import("../table-settings.ts");
  tableSettings.getState().update({ stopOtherAudio });
  return { ...(await import("./session.ts")), tableSettings };
}

const modes = () => setAudioModeAsync.mock.calls.map(([mode]) => mode);
const settled = () => new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(resolve)));

describe("startAudioSession", () => {
  beforeEach(() => {
    platform.OS = "ios";
  });

  it("plays on Android while the ringer is silent or vibrate, and leaves expo-audio mixing there", async () => {
    const { startAudioSession } = await load("android", true);
    startAudioSession();
    expect(modes()).toMatchObject([{ playsInSilentMode: true, interruptionMode: "mixWithOthers" }]);
  });

  it("follows the silent switch on iOS, with a session that does not mix while Stop other audio is on", async () => {
    const { startAudioSession } = await load("ios", true);
    startAudioSession();
    expect(modes()).toMatchObject([{ playsInSilentMode: false, interruptionMode: "doNotMix" }]);
  });

  it("mixes with other audio on iOS while Stop other audio is off", async () => {
    const { startAudioSession } = await load("ios", false);
    startAudioSession();
    expect(modes()).toMatchObject([{ playsInSilentMode: false, interruptionMode: "mixWithOthers" }]);
  });

  it("sets the mode once for a value of the setting, and stops other audio once the mode is set", async () => {
    const { startAudioSession } = await load("android", true);
    startAudioSession();
    startAudioSession();
    expect(other.stopped).toBe(0);
    await settled();
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(other).toEqual({ stopped: 1, allowed: 0 });
  });
});

describe("claimAudio", () => {
  it("stops other audio again each time it is asked, with no new mode", async () => {
    const { claimAudio } = await load("ios", true);
    claimAudio();
    await settled();
    claimAudio();
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(other).toEqual({ stopped: 2, allowed: 0 });
  });

  it("stops nothing while the setting is off", async () => {
    const { claimAudio } = await load("android", false);
    claimAudio();
    await settled();
    claimAudio();
    expect(other).toEqual({ stopped: 0, allowed: 1 });
  });

  it("gives other audio back when the setting is turned off, and takes it again when it is turned on", async () => {
    const { claimAudio, tableSettings } = await load("ios", true);
    claimAudio();
    await settled();
    tableSettings.getState().update({ stopOtherAudio: false });
    claimAudio();
    await settled();
    expect(modes()).toMatchObject([{ interruptionMode: "doNotMix" }, { interruptionMode: "mixWithOthers" }]);
    expect(other).toEqual({ stopped: 1, allowed: 1 });
    tableSettings.getState().update({ stopOtherAudio: true });
    claimAudio();
    await settled();
    expect(other).toEqual({ stopped: 2, allowed: 1 });
  });
});
