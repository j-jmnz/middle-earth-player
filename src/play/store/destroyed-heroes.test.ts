// Rules: rr.player-elimination, rr.destroy (data/rules/entries.json). The heroes a destroy step named stay current in the table store with each accepted intent and go with an Undo, so a live game and its replay tell the outcome the same way (campaign/report.ts).
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { raceTable, URUK } from "../../rules/families/haradrim/race-kit.ts";
import { fight, opened } from "../../../test/harness/scene-kit.ts";

import { createTableStore } from "./store.ts";

describe("the heroes a live game destroys after it opened", () => {
  const live = () => {
    const made = raceTable({ seats: 2, phase: "Combat", engaged: [URUK] });
    const start = opened(made).state;
    const defense = fight(made, opened(made, start), (state) => state.window?.kind === "defense").state;
    const hero = defense.seats[0]?.heroes[0] ?? "";
    const hurt = updateCard(defense, hero, { damage: 99 });
    return { made, hero, store: createTableStore({ ctx: made.ctx, game: hurt }) };
  };

  it("rr.destroy holds a hero destroyed by an accepted intent, and Undo drops it", () => {
    const { hero, store } = live();
    expect(store.getState().destroyedHeroes.size).toBe(0);
    const sent = store.getState().dispatch({ type: "Undefended", heroId: hero });
    expect(store.getState().refusal).toBeNull();
    expect(sent).toBe(true);
    expect(store.getState().game.cards[hero]?.zone).not.toBe("heroes");
    expect([...store.getState().destroyedHeroes]).toContain(hero);
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().destroyedHeroes.has(hero)).toBe(false);
  });
});
