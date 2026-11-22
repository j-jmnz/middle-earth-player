import { describe, expect, it } from "vitest";

import type { PlayerIntent } from "../../../src/rules/core/intents.ts";
import { send, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { STYLES, movesOf, type Style } from "./moves.ts";
import { bestFirst, hurts } from "./probe.ts";
import { scoreOf } from "./score.ts";

const built = (layout: Layout) => tableFromLayout("the-uruk-hai", layout);
const style = STYLES[0] as Style;

describe("the search's look ahead", () => {
  const table = built({ phase: "Planning", hand: ["ally"], heroResources: 3 });
  const play = movesOf(table.state, table.ctx, new Set(), style).find((intent) => intent.type === "PlayCard") as PlayerIntent;

  it("lets a card through that the score likes and holds back one that a scenario's hook dislikes", () => {
    expect(play).toBeDefined();
    expect(hurts(table.state, play, table.ctx, style)).toBe(false);
    const dislikes = (state: typeof table.state) => -50 * (state.seats[0]?.play.length ?? 0);
    expect(hurts(table.state, play, table.ctx, style, dislikes)).toBe(true);
  });

  it("puts the option with the best score first and keeps every option", () => {
    const opened = built({ phase: "Planning", hand: ["ally"], heroResources: 3 });
    const sent = send(start(opened.state), play, opened.ctx);
    expect(scoreOf(sent.state, opened.ctx)).toBeGreaterThan(scoreOf(opened.state, opened.ctx));
    const options: PlayerIntent[] = [{ type: "Pass" }, play];
    const ranked = bestFirst(table.state, options, table.ctx, style);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toEqual(play);
  });
});
