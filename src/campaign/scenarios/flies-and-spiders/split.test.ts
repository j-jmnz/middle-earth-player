// Rules: hob.staging-area-creating, hob.staging-area-combining, mec109.multiple-staging-areas (data/rules/entries.json); ledger lines 132038:A:1, 132035:A:1, 132035:A:2, 132037:A:1. The area scope of Flies and Spiders' own cards is tested with each card's lines (location-lines, enemy-lines, treachery-lines, stage-actions).
// Once stage 2B has split the players, each staging area resolves as if only its players were in the game: "Encounter card effects are limited to each staging area" (hob.staging-area-creating). The first player is at stage 3 in an area of his own (seat 0); the other player is at stage 4 in the original area (seat 1).
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalTargets } from "../../../rules/engine/reduce.ts";
import { triggerIntents } from "../../../rules/player/actions.ts";
import { placeIn, revealTo, splitTable, withBilbo } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

// Every character awake and ready again, the unconscious bars lifted, and `committed` as given.
const awake = (t: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState, committed: boolean, exhausted = false): ScenarioState => {
  const heroes = (state.seats[0]?.heroes ?? []).concat(state.seats[1]?.heroes ?? []);
  return syncConstants(heroes.reduce((acc, hero) => updateCard(acc, hero, { committed, exhausted, unconscious: undefined as never }), state), t.ctx);
};

describe("area scope of Flies and Spiders' own cards", () => {
  it("132035:A:1 Hidden Path lowers the Threat of the locations in its own staging area only", () => {
    const { t, state: made } = splitTable(undefined);
    const a = placeIn(made, "132035", 1);
    const own = placeIn(a.state, "132026", 1);
    const other = placeIn(own.state, "132026", 0);
    // Hidden Path is the active location of the player at stage 4.
    const withActive = syncConstants({ ...other.state, seats: other.state.seats.map((seat, index) => (index === 1 ? { ...seat, active: a.id } : seat)) as unknown as typeof other.state.seats, cards: { ...other.state.cards, [a.id]: { ...other.state.cards[a.id]!, zone: "activeLocation" } } }, t.ctx);
    const threatOf = (id: string) => modifiedStat(withActive, withActive.cards[id]!, "threat", t.ctx.cards);
    const base = (t.ctx.cards.get("132026")?.threat ?? 0);
    expect(threatOf(own.id), "a location of its own area").toBe(Math.max(0, base - 1));
    expect(threatOf(other.id), "a location of the other area").toBe(base);
  });

  it("132035:A:2 Hidden Path is entered with Baggins resources of the players of its own area only", () => {
    const { t, state: made } = splitTable(undefined);
    // Bilbo Baggins, a Baggins hero, holds the Baggins resources in each area.
    const first = withBilbo(made, 0);
    const second = withBilbo(first.state, 1);
    const path = placeIn(second.state, "132035", 1);
    const travelling = (resources: readonly [number, number]) => {
      const pooled = updateCard(updateCard(path.state, first.id, { resources: resources[0] }), second.id, { resources: resources[1] });
      return legalTargets({ ...pooled, phase: "Travel", mode: "travel", window: { kind: "travel" }, activeSeat: 1 }, { type: "Travel" }, t.ctx).includes(path.id);
    };
    expect(travelling([0, 2]), "the players of the area pay").toBe(true);
    expect(travelling([5, 0]), "resources of a player of the other area do not pay").toBe(false);
  });

  it("132037:A:1 Fighting Among Friends removes only the characters of the area it was revealed to from the quest", () => {
    const { t, state: made } = splitTable(undefined);
    // Both players have awake characters on the quest.
    const out = revealTo(t.ctx, awake(t, made, true), "132037", 1);
    // The first player of the area names a sphere: the first option is Leadership, which no stand-in hero (Tactics) belongs to.
    for (const hero of out.seats[1]?.heroes ?? []) expect(out.cards[hero]?.committed, "area of the card").toBe(false);
    for (const hero of out.seats[0]?.heroes ?? []) expect(out.cards[hero]?.committed, "area of the token holder").toBe(true);
  });

  it("132038:A:1 Weighed Down gives -1 only to the exhausted characters of the area it was revealed to", () => {
    const { t, state: made } = splitTable(undefined);
    const out = revealTo(t.ctx, awake(t, made, false, true), "132038", 1);
    const printed = (hero: string) => t.ctx.cards.get(out.cards[hero]?.code ?? "")?.willpower ?? 0;
    for (const hero of out.seats[1]?.heroes ?? []) expect(modifiedStat(out, out.cards[hero]!, "willpower", t.ctx.cards)).toBe(printed(hero) - 1);
    for (const hero of out.seats[0]?.heroes ?? []) expect(modifiedStat(out, out.cards[hero]!, "willpower", t.ctx.cards)).toBe(printed(hero));
  });
  it("hob.staging-area-creating: a player cannot use the Action of a card in another area (Durin's Helm in the staging area of the other area)", () => {
    const { t, state: made } = splitTable(undefined, {}, ["04120"]);
    const helm = placeIn(made, "04120", 1);
    const offered = (seat: number) => triggerIntents({ ...helm.state, window: { kind: "frameAction" }, activeSeat: seat }, t.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === helm.id);
    expect(offered(1), "a player of the Helm's own area claims it").toBe(true);
    expect(offered(0), "the player of the other area cannot").toBe(false);
  });
});
