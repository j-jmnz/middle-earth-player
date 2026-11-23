// Rules: ats.ally-objectives, hon.battle, hon.siege (data/rules/entries.json); ledger lines 05025:A:1, 05026:A:1, 05071:B:1.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { cardKeywords } from "./card-keywords.ts";
import { dungeonDetail } from "./dungeon-preview.ts";

const detail = (stage: string, code: string, threat?: readonly [number, number]) => {
  const made = tableFromLayout("into-ithilien", { staging: ["05025", "05026"], committed: ["dh1"], stage, ...(threat ? { threat } : {}) });
  return { made, say: dungeonDetail(made.state, made.ctx, idOf(made.state, code), (id) => id) };
};

describe("Into Ithilien previews", () => {
  it("05025:A:1 a staged Celador says he is committed and which stat he adds under Battle and Siege", () => {
    expect(detail("05068", "05025").say).toContain("adding 2 Attack");
    expect(detail("05069", "05025").say).toContain("adding 2 Defense");
    expect(detail("05069", "05026").say).toContain("adding 1 Defense");
  });

  it("05071:B:1 the last stage shows Siege only while a threat is 37 or more", () => {
    const keywords = (threat: readonly [number, number]) => {
      const { made } = detail("05071", "05025", threat);
      return cardKeywords(made.state, made.ctx, made.state.questStage!).map((chip) => chip.key);
    };
    expect(keywords([36, 0])).toEqual([]);
    expect(keywords([37, 0])).toEqual(["siege"]);
  });
});
