// Rules: hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, rr.when-revealed, rr.surge, rr.shadow-effects (data/rules/entries.json). The treacheries of Flies and Spiders (132033, 132034), each test from the printed line (data/printed/the-hobbit.json) on a table built from data/ by the layout kit,
// and run again without the records of its line (`lineSpec`). Surge is read as the next encounter card revealed: a revealed card with surge leaves the deck one card shorter.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { givePoison, makeUnconscious } from "../../../rules/families/poison/poison.ts";
import { fightEnemy, revealedTop } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { revealTo, spiderTable, splitTable } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

const on = (effects: readonly Effect[], layout: Parameters<typeof spiderTable>[0] = {}) => spiderTable(layout, { effects });

lineSpec("132033:A:1", "Caught in Webs removes a committed hero from the quest and makes it unconscious, and gains no surge", (effects) => {
  const t = on(effects, { seats: 1, committed: ["dh1"], deck: ["f0", "f0"] });
  const out = revealedTop(t, "132033");
  expect(out.cards[t.hero]).toMatchObject({ unconscious: true, committed: false });
  expect(out.cards[t.hero2]?.unconscious, "a hero that was not committed").toBeUndefined();
  expect(out.encounterDeck.length, "no surge: no second card is revealed").toBe(t.state.encounterDeck.length);
});
lineSpec("132033:A:1", "with no hero committed to the quest Caught in Webs gains surge and makes nobody unconscious", (effects) => {
  const t = on(effects, { seats: 1, deck: ["f0", "f0"] });
  const out = revealedTop(t, "132033");
  expect(out.cards[t.hero]?.unconscious).toBeUndefined();
  expect(out.cards[t.hero2]?.unconscious).toBeUndefined();
  expect(out.encounterDeck.length, "surge: the next card is revealed").toBe(t.state.encounterDeck.length - 1);
  const two = on(effects, { seats: 2, deck: ["f0", "f0"] });
  expect(revealedTop(two, "132033").encounterDeck.length, "the same with 2 players").toBe(two.state.encounterDeck.length - 1);
});
lineSpec("132033:A:1", "with heroes of 2 players committed exactly one hero is made unconscious, and once split only a hero of the area it is revealed to", (effects) => {
  const t = on(effects, { seats: 2, committed: ["dh1", "dh3"], deck: ["f0", "f0"] });
  const out = revealedTop(t, "132033");
  expect([t.hero, t.seat1Hero ?? ""].filter((id) => out.cards[id]?.unconscious === true).length, "one hero").toBe(1);
  const { t: s, state: made } = splitTable(effects);
  const committed = [...(made.seats[0]?.heroes ?? []), ...(made.seats[1]?.heroes ?? [])].reduce((acc, id) => updateCard(acc, id, { committed: true, unconscious: undefined as never, exhausted: false }), made);
  const split = revealTo(s.ctx, committed, "132033", 1);
  expect(split.cards[s.seat1Hero ?? ""]?.unconscious, "the hero of the area").toBe(true);
  expect(split.seats[0]?.heroes.map((id) => split.cards[id]?.unconscious), "the first player's heroes").toEqual([undefined, undefined]);
});

lineSpec("132034:A:1", "Poisoned by Spiders deals each character damage equal to its poison, together, and gains no surge", (effects) => {
  const t = on(effects, { seats: 2, deck: ["f0", "f0"], play: [{ code: "ally", seat: 0 }] });
  const state = givePoison(givePoison(t.state, t.hero, 2, t.ctx, []), t.seat1Hero, 1, t.ctx, []);
  const out = revealedTop({ state, ctx: t.ctx }, "132034");
  expect(out.cards[t.hero]?.damage).toBe(2);
  expect(out.cards[t.seat1Hero ?? ""]?.damage, "the other player's character").toBe(1);
  expect(out.cards[t.hero2]?.damage, "no poison, no damage").toBe(0);
  expect(out.encounterDeck.length, "damage was dealt, so no surge").toBe(state.encounterDeck.length);
});
lineSpec("132034:A:1", "when no character is poisoned no damage is dealt and the card gains surge", (effects) => {
  const t = on(effects, { seats: 1, deck: ["f0", "f0"] });
  const out = revealedTop(t, "132034");
  expect(out.cards[t.hero]?.damage).toBe(0);
  expect(out.encounterDeck.length).toBe(t.state.encounterDeck.length - 1);
});
lineSpec("132034:A:1", "once the players are split only the characters of the area the card is revealed to take damage", (effects) => {
  const { t, state } = splitTable(effects);
  const sick = givePoison(givePoison(state, state.seats[0]?.heroes[0] ?? "", 1, t.ctx, []), t.seat1Hero, 1, t.ctx, []);
  const out = revealTo(t.ctx, sick, "132034", 1);
  expect(out.cards[t.seat1Hero ?? ""]?.damage, "the area of the card").toBe(1);
  expect(out.cards[state.seats[0]?.heroes[0] ?? ""]?.damage, "the first player's area").toBe(0);
});
lineSpec("132034:A:2", "Shadow: the defending player discards an unconscious character he controls, and nothing is discarded when none is unconscious", (effects) => {
  const down = fightEnemy((layout) => on(effects, layout), "132034", "f0", { seats: 1 as const }, { tweak: (state, made) => makeUnconscious(state, made.hero2, made.ctx) });
  expect(down.run.state.cards[down.made.hero2]?.zone, "the unconscious character is discarded").toBe("discard");
  expect(down.run.state.cards[down.made.hero]?.zone, "the defender stays").toBe("heroes");
  const clean = fightEnemy((layout) => on(effects, layout), "132034", "f0", { seats: 1 as const });
  expect(clean.run.state.cards[clean.made.hero2]?.zone, "nothing unconscious").toBe("heroes");
  expect(clean.run.state.cards[clean.made.hero]?.zone).toBe("heroes");
});
