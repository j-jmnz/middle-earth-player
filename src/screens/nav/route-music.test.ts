// The table's music stays on the table and on the reading screens opened from it, and goes back to the menu's anywhere else.
import { describe, expect, it } from "vitest";

import { keepsTableMusic } from "./route-music.ts";

describe("route music", () => {
  it("keeps the table's loop on the table and the reading screens", () => {
    for (const path of ["/table/save-1", "/standalone/table/game-2", "/rule/some-rule", "/card/01001", "/card-group/set/x", "/booklet/learn-to-play", "/glossary", "/log/save-1", "/settings"]) expect(keepsTableMusic(path), path).toBe(true);
  });

  it("hands the music back on every other screen", () => {
    for (const path of ["/", "/scenarios", "/standalone/outcome/game-2", "/resolution/save-1", "/briefing/save-1/a", "/path/save-1", "/deck/3"]) expect(keepsTableMusic(path), path).toBe(false);
  });
});
