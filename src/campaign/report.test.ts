// Rules: ltp.scoring, rr.scoring (data/rules/entries.json). The details under Victory or Defeat: when the scenario ended, the
// quest stage it reached (a branch's two stages share one place), each player's threat and heroes, and a win's score in parts
// that add up to scoreOf.
import { beforeAll, describe, expect, it } from "vitest";

import { moveCard } from "../rules/core/zones.ts";
import { updateCard } from "../rules/core/state.ts";
import { loadMirkwoodWorld, mirkwoodTable, type MirkwoodWorld } from "../../test/scenarios/passage-through-mirkwood/scene.ts";

import { gameReport } from "./report.ts";
import { resolutionView } from "./resolution-view.ts";
import { scoreOf } from "./score.ts";

let world: MirkwoodWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
});

describe("the report of a finished scenario", () => {
  it("a loss names its round and phase, the stage with its progress, and each hero's damage or fall", () => {
    const made = mirkwoodTable(world, { stage: "01120", progress: 1 });
    const second = made.state.seats[0].heroes[1] ?? "";
    let state = updateCard(made.state, made.hero, { damage: 2 });
    state = moveCard(state, second, { zone: "discard", seat: 0 });
    state = { ...state, lost: true, lossReason: "Threat reached 50", round: 5, phase: "Combat" };
    const report = gameReport(state, made.ctx.cards);
    expect(report.ended).toBe("Lost in round 5, in the combat phase.");
    expect(report.stage).toEqual({ title: "Stage 2 of 3 · A Fork in the Road", detail: "1 of 2 progress" });
    expect(report.seats).toHaveLength(1);
    expect(report.seats[0]?.threat).toBe("Threat 28");
    expect(report.seats[0]?.heroes.map((hero) => hero.words)).toEqual([expect.stringMatching(/^2 damage of \d+ hit points$/), "Destroyed"]);
    expect(report.score).toBeNull();
  });

  it("a win's score lines add up to its score, and the branch stage is stage 3 of 3", () => {
    const made = mirkwoodTable(world, { stage: "01122", progress: 10, seats: 2 });
    const state = { ...updateCard(made.state, made.hero, { damage: 1 }), round: 4 };
    const report = gameReport(state, made.ctx.cards);
    expect(report.ended).toBe("Won in round 4.");
    expect(report.stage).toEqual({ title: "Stage 3 of 3 · A Chosen Path", detail: null });
    expect(report.seats.map((seat) => seat.label)).toEqual(["Player 1", "Player 2"]);
    const lines = report.score ?? [];
    const sum = lines.slice(0, -1).reduce((total, line) => total + Number(line.value.replace("−", "-")), 0);
    expect(lines.at(-1)).toEqual({ label: "Score", value: String(scoreOf(state, made.ctx.cards).score) });
    expect(sum).toBe(scoreOf(state, made.ctx.cards).score);
    expect(lines.find((line) => line.label === "3 completed rounds × 10")?.value).toBe("+30");
  });

  it("a hero that left play with its eliminated player is defeated with the player, and only a hero a destroy step named is destroyed", () => {
    const made = mirkwoodTable(world, { stage: "01120" });
    const [first, second] = made.state.seats[0].heroes;
    let state = moveCard(moveCard(made.state, first ?? "", { zone: "discard", seat: 0 }), second ?? "", { zone: "discard", seat: 0 });
    state = { ...state, seats: [{ ...state.seats[0], eliminated: true }, state.seats[1]], lost: true, lossReason: "No seats remain" };
    const words = (destroyed?: ReadonlySet<string>) => gameReport(state, made.ctx.cards, destroyed).seats[0]?.heroes.map((hero) => hero.words);
    // With no destroy steps known the report says what it always said.
    expect(words()).toEqual(["Destroyed", "Destroyed"]);
    // The second hero was destroyed in play; the first left with the player.
    expect(words(new Set([second ?? ""]))).toEqual(["Defeated with the player", "Destroyed"]);
    expect(words(new Set([first ?? "", second ?? ""]))).toEqual(["Destroyed", "Destroyed"]);
  });

  it("the report and the Resolution screen tell the same cause: the last hero was destroyed", () => {
    const made = mirkwoodTable(world, { stage: "01120" });
    const heroes = made.state.seats[0].heroes;
    let state = made.state;
    for (const id of heroes) state = moveCard(state, id, { zone: "discard", seat: 0 });
    state = { ...state, seats: [{ ...state.seats[0], eliminated: true }, state.seats[1]], lost: true, lossReason: "No seats remain" };
    const destroyed = new Set(heroes);
    const words = "Every player is eliminated. Player 1's last hero was destroyed.";
    expect(gameReport(state, made.ctx.cards, destroyed).lossReason).toBe(words);
    expect(resolutionView(state, { cards: made.ctx.cards } as never, [], destroyed)).toEqual({ kind: "lost", reason: words });
    // With no destroy steps known, only the engine's reason is told.
    expect(resolutionView(state, { cards: made.ctx.cards } as never)).toEqual({ kind: "lost", reason: "Every player is eliminated" });
  });
});
