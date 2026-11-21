// The web's and the desktop's settings lines (settings-platform.canvaskit.ts): a computer drops the battery clauses and the Music line's
// promise to wait for other audio, which it cannot hear, and keeps each line a whole sentence.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../ui/sound/sound.ts", () => ({ SOUNDS_BUNDLED: true }));
vi.mock("../../ui/sound/music.ts", () => ({ MUSIC_BUNDLED: true }));

// The lines as settings-words.ts holds them; that file reads react-native when it loads, which a test here does not load (vitest.config.mts, isolate).
const MUSIC_LINE = "The film score: one piece for the menus, and a calm piece and a fight piece for each scenario. It waits while other audio plays.";
const AWAKE_LINE = "Keeps the screen on during a game. Uses more battery.";

const { platformLine, SETTINGS_PLATFORM } = await import("./settings-platform.canvaskit.ts");

describe("the web's settings lines", () => {
  it("drops the Music line's wait for other audio", () => {
    expect(platformLine(MUSIC_LINE)).toBe("The film score: one piece for the menus, and a calm piece and a fight piece for each scenario.");
  });

  it("drops a battery clause and leaves other lines as they are", () => {
    expect(platformLine(AWAKE_LINE)).not.toMatch(/battery/);
    expect(platformLine("How loud the music plays.")).toBe("How loud the music plays.");
  });

  it("shows Sound when the export carries the sounds and the music", () => {
    expect(SETTINGS_PLATFORM).toMatchObject({ sounds: true, music: true, haptics: false });
  });
});
