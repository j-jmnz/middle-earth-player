// Rules: docs/scenarios/standalone-scenarios/the-battle-of-lake-town.md (The Battle of Lake-town), rr.first-player, rr.damage (data/rules/entries.json); ledger lines 50201:A:1, 50202:B:2, 50205:A:2, 50210:A:1.
// The Lake-town engine's own choices on the live sheet (words/scenarios/standalone-scenarios/smaug.ts): where the first player reveals Smaug, the Burn question of each player (exhaust a character, its share, done) and stage 2B's discard of progress. Each opens as the engine opens it; the sheet says the number, the player,
// and arms the row that destroys a character or would put Lake-town at its limit.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { pushCardEffects, pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { askSmaug } from "../../rules/families/smaug/deck.ts";
import { first, tableFromLayout, type Layout, type LayoutTable } from "../../../test/harness/scene-kit.ts";

import { sheetFor } from "./sheets.ts";

const ID = "the-battle-of-lake-town";
const LAKE = "50207";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);

const sheetOf = (made: LayoutTable, state: ScenarioState) => {
  const names = { card: (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (!sheet || sheet.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
};
// The record's frame is pushed and settled until the engine opens its window.
function opened(made: LayoutTable, code: string, timing: Effect["timing"], state: ScenarioState = made.state): ScenarioState {
  const spawned = spawn(state, code, { zone: "staging" });
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, spawned.state.firstPlayer, false, effects, made.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, []);
}
const take = (made: LayoutTable, state: ScenarioState, optionId: string): ScenarioState => {
  const done = reduce(state, { type: "Choose", optionId }, made.ctx);
  if (!done.ok) throw new Error(done.reason);
  return done.state;
};

describe("50201:A:1 the first player's question about the next Smaug", () => {
  it("names the player, the blind choice and the cards left in the Smaug deck, and each row where Smaug comes", () => {
    const made = table({ seats: 2, staging: [LAKE], piles: { smaugDeck: ["50204", "50205", "50206"] } });
    const asked = askSmaug({ ...made.state, round: 1 }, made.ctx, []);
    const state = settle({ ...asked!, window: null, mode: "stopped" }, made.ctx, []);
    const sheet = sheetOf(made, state);
    expect(sheet.note).toContain("Player 1: choose where the next Smaug is revealed, before you see it.");
    expect(sheet.note).toContain("The Smaug deck holds 3 cards.");
    expect(sheet.options.map((option) => option.label)).toEqual(["Reveal Smaug in the play area: he engages the first player", "Reveal Smaug in the staging area"]);
  });
});

describe("50205:A:2 Burn: each player exhausts characters to take the damage", () => {
  const burning = (layout: Layout) => {
    const made = table({ seats: 2, staging: [LAKE, "50221"], ...layout });
    return { made, state: opened(made, "50205", "whenRevealed") };
  };

  it("50205:A:2 the question names the player and the pool, and every row names the player", () => {
    const { made, state } = burning({});
    const sheet = sheetOf(made, state);
    expect(sheet.note).toContain("Player 1: resolve burn damage: 3 left.");
    expect(sheet.note).toContain("(0 of 50)");
    expect(sheet.options.map((option) => option.label)).toEqual(["Player 1 exhausts dh1: it must take at least 1, up to 3 of the 3", "Player 1 exhausts dh2: it must take at least 1, up to 3 of the 3", "Player 1 is done: Player 2 chooses for the 3 left"]);
  });

  it("50205:A:2 Done skips a player with no ready character, as the engine does, and says the rest goes on Lake-town", () => {
    const { made, state } = burning({});
    const tired = updateCard(state, made.seat1Hero ?? "", { exhausted: true });
    const done = sheetOf(made, tired).options.find((option) => option.id === "done");
    expect(done?.label).toBe("Player 1 is done: the 3 left goes on Lake-town (3 of 50)");
  });

  it("50205:A:2 alone, Done says the rest goes on Lake-town and is armed when that puts it at 50", () => {
    const made = table({ staging: [{ code: LAKE, damage: 47 }, "50221"] });
    const done = sheetOf(made, opened(made, "50205", "whenRevealed")).options.find((option) => option.id === "done");
    expect(done?.label).toBe("Done: the 3 left goes on Lake-town (50 of 50)");
    expect(done?.caution).toBe("Tap again: Lake-town would hold 50 damage and the game is lost");
  });

  it("50205:A:2 Done is not armed while Lake-town stays under its limit", () => {
    const made = table({ staging: [{ code: LAKE, damage: 40 }, "50221"] });
    expect(sheetOf(made, opened(made, "50205", "whenRevealed")).options.find((option) => option.id === "done")?.caution).toBeUndefined();
  });

  it("50205:A:2 the share question names the character and the room it has, and the shares that destroy it are armed", () => {
    const { made, state } = burning({});
    const hero = first(state, "dh1");
    const wounded = updateCard(take(made, state, `exhaust:${hero}`), hero, { damage: 4 });
    const sheet = sheetOf(made, wounded);
    expect(sheet.note).toContain("dh1 is exhausted. It must take at least 1 of the 3 burn damage, up to the 2 it can still take (dh1 can take 1 without being destroyed; 2 destroys it).");
    expect(sheet.options.map((option) => option.label)).toEqual(["Player 1: dh1 takes 1 of the 3", "Player 1: dh1 takes 2 of the 3, enough to destroy it", "Player 1: dh1 takes 3 of the 3, enough to destroy it"]);
    expect(sheet.options.map((option) => option.caution)).toEqual([undefined, "Tap again: dh1 is destroyed", "Tap again: dh1 is destroyed"]);
  });
});

describe("50202:B:2 the first player discards progress tokens to heal Lake-town", () => {
  it("50202:B:2 the question says the tokens and Lake-town's damage, and each row what Lake-town drops to", () => {
    const made = table({ stage: "50202", seats: 2, staging: [{ code: LAKE, damage: 5 }] });
    const framed = pushEffectFrame(made.state, { frame: "whenRevealed", sourceId: made.state.questStage ?? "none", actor: made.state.firstPlayer, peril: false, effectId: "50202:triggered:1", instructions: [{ verb: "HealLakeTownByProgress", progress: 4 }], cancel: null, blockCancel: null }, []);
    const sheet = sheetOf(made, settle({ ...framed, window: null, mode: "stopped" }, made.ctx, []));
    expect(sheet.note).toContain("Player 1: 4 progress tokens would go on the quest. Discard some to remove as much damage from Lake-town (5 of 50).");
    expect(sheet.options.map((option) => option.label)).toEqual([
      "Discard none: all the progress goes on the quest",
      "Discard 1 progress token: Lake-town drops to 4 of 50",
      "Discard 2 progress tokens: Lake-town drops to 3 of 50",
      "Discard 3 progress tokens: Lake-town drops to 2 of 50",
      "Discard 4 progress tokens: Lake-town drops to 1 of 50",
    ]);
  });
});

describe("50209:A:2 the keep row of the cancel offer", () => {
  const offered = (seats: 1 | 2) => {
    const made = table({ seats, staging: [LAKE] });
    return { made, state: opened(made, "50209", "shadow") };
  };

  it("50209:A:2 says another player is asked next, and only the last player's row says the effect resolves", () => {
    const { made, state } = offered(2);
    const keep = (at: ScenarioState) => sheetOf(made, at).options.find((option) => option.id === "keep")?.label;
    expect(keep(state)).toBe("Keep your heroes: Player 2 is asked next");
    expect(keep({ ...state, window: { ...state.window!, seat: 1 } as ScenarioState["window"] })).toBe("Keep your heroes: the Shadow effect resolves: 1 damage to each character in play");
  });
});

describe("50223:A:2 the split of progress between two active locations", () => {
  it("50223:A:2 says the tokens and each row how many go on each location", () => {
    const made = table({ staging: [LAKE, "50219", "50223"] });
    const ids = (code: string) => first(made.state, code);
    const two = { ...made.state, activeLocation: ids("50219"), secondActiveLocation: ids("50223") };
    const placed = spawn(two, "50223", { zone: "secondActiveLocation" });
    const state = { ...placed.state, secondActiveLocation: placed.id };
    const framed = pushEffectFrame(state, { frame: "whenRevealed", sourceId: placed.id, actor: state.firstPlayer, peril: false, effectId: "50223:triggered:1", instructions: [{ verb: "SplitProgress", amount: 2 }], cancel: null, blockCancel: null }, []);
    const sheet = sheetOf(made, settle({ ...framed, window: null, mode: "stopped" }, made.ctx, []));
    expect(sheet.note).toContain("Divide the 2 progress tokens between them");
    expect(sheet.options.map((option) => option.label)).toHaveLength(3);
    expect(sheet.options[0]?.label).toMatch(/^0 on .*, 2 on Fisherman's Dock/);
  });
});
