// Rules: rr.cost, rr.first-player, rr.surge, rr.cancel, rr.attachment-cards (data/rules/entries.json).
// The When Revealed lines that ask a player to pay or suffer (06053:A:1, 06054:A:2, 06055:A:2): the heroes pay from their own pools, a player with nothing to pay is not asked, damage that is canceled is no damage taken for the surge, and an attachment is paid for in whole or not at all.
// The stand-in heroes of the first seat are dh1 and dh2, the second seat's is dh3, all with 6 hit points and a Tactics icon; Éowyn (01007) is a Spirit hero.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { idOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { CODES, revealPlay as play, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { menInDark: MEN, stars: STARS, leaves: LEAVES } = CODES;
const EOWYN = "01007";
const first = (options: readonly string[]): string => options[0] ?? "";

const scene = (layout: Layout, effects?: readonly Effect[]) => table({ phase: "Quest", ...layout }, effects, [EOWYN]);
const damageOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;
const resourcesOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

describe("06053:A:1 Men in the Dark", () => {
  const deck = ["f0", "f0", "f0"];

  it("06053:A:1 a hero with no resource takes 1 damage without a question, and the card gains no surge because heroes took damage", () => {
    const made = scene({ deck });
    const { run, asked } = play(made, MEN, []);
    expect(asked).toEqual([]);
    expect([damageOf(run.state, "dh1"), damageOf(run.state, "dh2")]).toEqual([1, 1]);
    // Only Men in the Dark was revealed: the three cards of the deck are still there.
    expect(run.state.encounterDeck.length).toBe(3);
  });

  it("06053:A:1 each hero is asked on its own: it pays 1 resource from its own pool or takes 1 damage; when every hero pays nobody takes damage and the card gains surge", () => {
    const made = scene({ deck, heroResources: 1 });
    const { run, asked } = play(made, MEN, ["pay", "pay"]);
    expect(asked).toEqual([["pay", "consequence"], ["pay", "consequence"]]);
    expect([resourcesOf(run.state, "dh1"), resourcesOf(run.state, "dh2"), damageOf(run.state, "dh1"), damageOf(run.state, "dh2")]).toEqual([0, 0, 0, 0]);
    expect(run.state.encounterDeck.length).toBe(2);
  });

  it("06053:A:1 a hero may take the damage and keep its resource, and then the card gains no surge", () => {
    const made = scene({ deck, heroResources: 1 });
    const { run } = play(made, MEN, ["consequence", "pay"]);
    expect([resourcesOf(run.state, "dh1"), damageOf(run.state, "dh1"), resourcesOf(run.state, "dh2"), damageOf(run.state, "dh2")]).toEqual([1, 1, 0, 0]);
    expect(run.state.encounterDeck.length).toBe(3);
  });

  it("06053:A:1 damage that a Response cancels is not damage taken: with every hero's damage canceled the card gains surge", () => {
    const cancel: Effect = { id: "attachment:response:2", cardCode: "attachment", lines: ["attachment:A:2"], timing: "response", trigger: "damageDealt", subject: { type: "character", control: "any" }, instructions: [{ verb: "CancelDamage", amount: 1 }] };
    const made = scene({ deck, play: ["attachment"] }, [...EFFECTS, cancel]);
    const { run } = play(made, MEN, [], cancel.id);
    expect([damageOf(run.state, "dh1"), damageOf(run.state, "dh2")]).toEqual([0, 0]);
    expect(run.state.encounterDeck.length).toBe(2);
  });

  it("06053:A:1 with two players the first player's heroes are asked first, each from its own pool: a hero of the other player does not pay for them", () => {
    const made = scene({ deck, seats: 2, heroes: [{ code: EOWYN, seat: 1, resources: 1 }] });
    const { run, asked } = play(made, MEN, ["pay"]);
    // Only Éowyn holds a resource: her player is asked about her alone; the three stand-ins take the damage.
    expect(asked).toEqual([["pay", "consequence"]]);
    expect([damageOf(run.state, "dh1"), damageOf(run.state, "dh2"), damageOf(run.state, "dh3")]).toEqual([1, 1, 1]);
    expect([damageOf(run.state, EOWYN), resourcesOf(run.state, EOWYN)]).toEqual([0, 0]);
  });
});

describe("06054:A:2 Stars in Sky", () => {
  const layout = { deck: ["f0", "f0"], committed: ["dh1", "dh2"] } as const;

  it("06054:A:2 each questing hero pays 1 resource from its own pool or is removed from the quest: a hero with none is removed without a question", () => {
    const made = scene({ ...layout, heroResources: 0, heroes: [{ code: EOWYN, seat: 0, resources: 1 }] });
    const state = { ...made.state, cards: { ...made.state.cards, [idOf(made.state, EOWYN)]: { ...made.state.cards[idOf(made.state, EOWYN)]!, committed: true } } };
    const { run, asked } = play({ ...made, state }, STARS, ["pay"]);
    expect(asked[0]).toEqual(["pay", "consequence"]);
    expect([run.state.cards[idOf(run.state, "dh1")]?.committed, run.state.cards[idOf(run.state, "dh2")]?.committed, run.state.cards[idOf(run.state, EOWYN)]?.committed]).toEqual([false, false, true]);
  });

  it("06054:A:2 a hero that is not committed to the quest is not asked and keeps its resource", () => {
    const made = scene({ ...layout, committed: ["dh1"], heroResources: 1 });
    const { run } = play(made, STARS, ["consequence", first, first]);
    expect(run.state.cards[idOf(run.state, "dh1")]?.committed).toBe(false);
    expect(run.state.cards[idOf(run.state, "dh2")]?.committed).toBe(false);
  });

  it("06054:A:2 with two players each player decides for his own questing heroes", () => {
    const made = scene({ ...layout, seats: 2, heroResources: 1, committed: ["dh1", "dh3"] });
    const { run, asked } = play(made, STARS, ["pay", "consequence"]);
    expect(asked.slice(0, 2)).toEqual([["pay", "consequence"], ["pay", "consequence"]]);
    expect([run.state.cards[idOf(run.state, "dh1")]?.committed, run.state.cards[idOf(run.state, "dh3")]?.committed]).toEqual([true, false]);
  });
});

describe("06055:A:2 Leaves on Tree", () => {
  const attached = (count: number, to = "dh1") => Array.from({ length: count }, () => ({ code: "attachment", to }));
  const attachments = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.code === "attachment").map((card) => card.zone);

  it("06055:A:2 a player pays 1 resource for each attachment he controls, from any of his heroes, or discards all of them", () => {
    const made = scene({ deck: ["f0"], attached: attached(2), heroes: [{ code: EOWYN, seat: 0, resources: 1 }], heroResources: 1 });
    const { run, asked } = play(made, LEAVES, ["pay", first, first]);
    expect(asked[0]).toEqual(["pay", "discard"]);
    expect(attachments(run.state)).toEqual(["play", "play"]);
    // Two resources went from the heroes, a Spirit hero's among them is allowed: the three heroes held 1 each and now hold 1 in all.
    const left = ["dh1", "dh2", EOWYN].map((code) => resourcesOf(run.state, code)).reduce((sum, amount) => sum + amount, 0);
    expect(left).toBe(1);
  });

  it("06055:A:2 with fewer resources than attachments the player cannot pay, and discards all of them, none partly", () => {
    const made = scene({ deck: ["f0"], attached: attached(2), heroResources: 0, heroes: [{ code: EOWYN, seat: 0, resources: 1 }] });
    const { run, asked } = play(made, LEAVES, []);
    expect(asked).toEqual([]);
    expect(attachments(run.state)).toEqual(["discard", "discard"]);
    expect(resourcesOf(run.state, EOWYN)).toBe(1);
  });

  it("06055:A:2 each player decides on his own attachments, and a player with none is not asked", () => {
    const made = scene({ deck: ["f0"], seats: 2, attached: attached(1, "dh1"), heroResources: 1 });
    const { run, asked } = play(made, LEAVES, ["discard"]);
    expect(asked).toEqual([["pay", "discard"]]);
    expect(attachments(run.state)).toEqual(["discard"]);
    expect(resourcesOf(run.state, "dh3")).toBe(1);
  });
});
