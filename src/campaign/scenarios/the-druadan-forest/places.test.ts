// Rules: rr.travel, rr.cost, rr.resource-match, rr.step-1-2, hon.archery, rr.keywords, rr.staging (data/rules/entries.json).
// The location lines and the archery lines of The Drúadan Forest that a card-spec row cannot show: the cost Ancestral Clearing adds, the travel costs of it and of the Garden of Poisons, the resources the Garden withholds from effects, the archery of the Hunter and of the Glades, and the allies that take archery damage.
// Each test builds its moment with the scene kit; its title starts with the line id. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; the stand-in ally costs 1.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { archeryRecipients, archeryTotal, assignArchery } from "../../../rules/combat/combat.ts";
import { playCost } from "../../../rules/player/attach.ts";
import { legalIntents, legalTargets, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { resolveAmount } from "../../../rules/interpret/amounts.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { idOf, resolveRecords, send, start, statOf, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, run, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { clearing: CLEARING, garden: GARDEN, glade: GLADE, hunter: HUNTER, elite: ELITE, drummer: DRUMMER, untimelyEnd: STAGE_2 } = CODES;

const pools = (state: ScenarioState, ids: readonly string[]): number[] => ids.map((id) => state.cards[id]?.resources ?? 0);
const heroIds = (state: ScenarioState, seat: number): string[] => [...(state.seats[seat]?.heroes ?? [])];
const holding = (made: LayoutTable, held: Readonly<Record<string, number>>): LayoutTable => ({ ...made, state: syncConstants({ ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, card.zone === "heroes" ? { ...card, resources: held[card.code] ?? 0 } : card])) }, made.ctx) });
const travels = (made: LayoutTable, code: string): boolean => legalTargets(made.state, { type: "Travel" }, made.ctx).includes(idOf(made.state, code));

describe("06050:A:1 Ancestral Clearing raises the cost of player cards", () => {
  const hand = { phase: "Planning", hand: [{ code: "ally", seat: 0 }, { code: "attachment", seat: 0 }, { code: "c2", seat: 0 }] } as const;
  const costs = (made: LayoutTable): number[] => ["ally", "attachment", "c2"].map((code) => playCost(made.state, idOf(made.state, code), 0, made.ctx) ?? -1);

  it("06050:A:1 every player card costs 1 more to play while it is in play: an ally of cost 1, an attachment of cost 0, an event of cost 2", () => {
    expect(costs(table({ ...hand }))).toEqual([1, 0, 2]);
    expect(costs(table({ ...hand, staging: [CLEARING] }))).toEqual([2, 1, 3]);
  });

  it("06050:A:1 two copies add up", () => {
    expect(costs(table({ ...hand, staging: [CLEARING, CLEARING] }))).toEqual([3, 2, 4]);
  });
});

describe("06050:A:2 travel to Ancestral Clearing", () => {
  const exhaustedHeroes = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.zone === "heroes" && card.exhausted).length;

  it("06050:A:2 one ready hero of any player is exhausted to travel here", () => {
    const made = table({ seats: 2, phase: "Travel", staging: [CLEARING] });
    expect(travels(made, CLEARING)).toBe(true);
    // The travel cost is resolved with the round stopped there, as the refresh phase would ready the hero again.
    const paid = resolveRecords(made.state, made.ctx, CLEARING, "travel", idOf(made.state, CLEARING));
    expect(exhaustedHeroes(paid.state)).toBe(1);
  });

  it("06050:A:2 a hero of the other player may pay it, and with no ready hero the players cannot travel here", () => {
    const made = table({ seats: 2, phase: "Travel", staging: [CLEARING] });
    const exhaust = (ids: string[]): ScenarioState => ({ ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, ids.includes(id) ? { ...card, exhausted: true } : card])) });
    const otherOnly = { ...made, state: exhaust(heroIds(made.state, 0)) };
    expect(travels(otherOnly, CLEARING)).toBe(true);
    expect(travels({ ...made, state: exhaust([...heroIds(made.state, 0), ...heroIds(made.state, 1)]) }, CLEARING)).toBe(false);
  });
});

describe("06051:A:1 Garden of Poisons withholds resources from effects", () => {
  const gain = (made: LayoutTable): number[] => {
    const state = run(made, made.state, { verb: "HeroesGainResources", amount: 1 }, idOf(made.state, "dh1"));
    return pools(state, heroIds(state, 0));
  };

  it("06051:A:1 no hero gains a resource from a card effect while it is in play", () => {
    expect(gain(table({}))).toEqual([1, 1]);
    expect(gain(table({ staging: [GARDEN] }))).toEqual([0, 0]);
  });

  it("06051:A:1 the resource phase still gives each hero 1 resource", () => {
    const made = table({ staging: [GARDEN], phase: "Refresh" });
    const settled = settle({ ...made.state, window: null, mode: "resourceGrant" }, made.ctx, []);
    expect(pools(settled, heroIds(settled, 0)).every((amount) => amount >= 1)).toBe(true);
  });
});

describe("06051:A:2 travel to Garden of Poisons", () => {
  const garden = (first: number, second: number): LayoutTable => holding(table({ seats: 2, phase: "Travel", staging: [GARDEN] }), { dh1: first, dh2: 0, dh3: second });

  it("06051:A:2 each player pays 1 resource from his own heroes' pools to travel here", () => {
    const made = garden(1, 1);
    expect(travels(made, GARDEN)).toBe(true);
    const paid = resolveRecords(made.state, made.ctx, GARDEN, "travel", idOf(made.state, GARDEN));
    expect([pools(paid.state, heroIds(paid.state, 0)).reduce((sum, amount) => sum + amount, 0), pools(paid.state, heroIds(paid.state, 1)).reduce((sum, amount) => sum + amount, 0)]).toEqual([0, 0]);
  });

  it("06051:A:2 the players cannot travel here when any one player has none: another player's resources do not pay for him", () => {
    expect(travels(garden(3, 0), GARDEN)).toBe(false);
    expect(travels(garden(0, 3), GARDEN)).toBe(false);
  });

  it("06051:A:2 with one player the player pays 1 resource", () => {
    const made = holding(table({ phase: "Travel", staging: [GARDEN] }), { dh1: 1 });
    expect(travels(made, GARDEN)).toBe(true);
    expect(travels(holding(table({ phase: "Travel", staging: [GARDEN] }), { dh1: 0 }), GARDEN)).toBe(false);
  });
});

describe("06048:A:2 Archery X of the Hunter", () => {
  it("06048:A:2 X is the number of heroes of every player with no resources, counted when the archery is dealt", () => {
    const four = table({ seats: 2, staging: [HUNTER] });
    const heroes = heroIds(four.state, 0).length + heroIds(four.state, 1).length;
    expect(archeryTotal(four.state, four.ctx.cards)).toBe(heroes);
    const held = holding(four, { dh1: 1, dh3: 2 });
    expect(archeryTotal(held.state, held.ctx.cards)).toBe(heroes - 2);
    expect(archeryTotal(holding(four, { dh1: 1, dh2: 1, dh3: 1 }).state, four.ctx.cards)).toBe(0);
  });

  it("06048:A:2 an engaged Hunter shoots too", () => {
    const made = table({ engaged: [HUNTER] });
    expect(archeryTotal(made.state, made.ctx.cards)).toBeGreaterThan(0);
  });
});

describe("06052:A:1 and 06052:A:2 Glade of Cleansing", () => {
  it("06052:A:1 each Wose in play gains archery 1, in the staging area or engaged, and two Glades give 2", () => {
    const one = table({ staging: [GLADE, DRUMMER], engaged: [ELITE] });
    // The stat is what the Glade gives: the Elite's own Archery 2 is its keyword.
    expect([statOf(one.state, one.ctx.cards, DRUMMER, "archery"), statOf(one.state, one.ctx.cards, ELITE, "archery")]).toEqual([1, 1]);
    const two = table({ staging: [GLADE, GLADE, DRUMMER] });
    expect(statOf(two.state, two.ctx.cards, DRUMMER, "archery")).toBe(2);
  });

  it("06052:A:1 the gain does not go to an enemy that is no Wose", () => {
    const made = table({ staging: [GLADE, "f3"] });
    expect(statOf(made.state, made.ctx.cards, "f3", "archery")).toBe(0);
  });

  it("06052:A:2 its Threat X is the total archery of the Wose with the most: 0 with none, and the Glades' gains count", () => {
    const threat = (made: LayoutTable): number => resolveAmount(made.state, { archeryOf: { type: "enemy", control: "any", trait: "Wose", staging: true }, max: true }, { actor: 0, sourceId: null }, made.ctx);
    expect(threat(table({ staging: [GLADE] }))).toBe(0);
    expect(threat(table({ staging: [GLADE, ELITE] }))).toBe(3);
    expect(threat(table({ staging: [GLADE, GLADE, ELITE] }))).toBe(4);
    const made = table({ staging: [GLADE, ELITE] });
    expect(statOf(made.state, made.ctx.cards, GLADE, "threat")).toBe(3);
  });
});

describe("06043:B:1 An Untimely End", () => {
  it("06043:B:1 archery damage must be assigned to allies while any ally is in play, and to the heroes otherwise", () => {
    const heroes = table({ stage: STAGE_2, staging: [ELITE] });
    expect(archeryRecipients(heroes.state, heroes.ctx.cards).map((id) => heroes.state.cards[id]?.zone)).toEqual(["heroes", "heroes"]);
    const allies = table({ stage: STAGE_2, staging: [ELITE], play: ["ally", "ally"] });
    const recipients = archeryRecipients(allies.state, allies.ctx.cards);
    expect(recipients).toHaveLength(2);
    expect(recipients.every((id) => allies.state.cards[id]?.code === "ally")).toBe(true);
    const other = table({ staging: [ELITE], play: ["ally"] });
    expect(archeryRecipients(other.state, other.ctx.cards).some((id) => other.state.cards[id]?.zone === "heroes")).toBe(true);
  });
});

describe("06043:B:1 archery damage after an ally dies", () => {
  // The points an ally's death leaves are the players' to assign again (docs/scenarios/against-the-shadow/the-druadan-forest.md, 06043:B:1).
  it("06043:B:1 the points left after an ally is destroyed are assigned again, to the other ally, and to a hero when none is left", () => {
    const made = table({ stage: STAGE_2, staging: [ELITE], play: ["ally", "ally"] });
    const [first, second] = archeryRecipients(made.state, made.ctx.cards);
    const health = modifiedStat(made.state, made.state.cards[first!]!, "hitPoints", made.ctx.cards);
    const weak = updateCard(made.state, first!, { damage: health - 1 });
    const open = { ...weak, window: { kind: "archery" as const, total: 4 } };
    const dealt = assignArchery(open, [{ cardId: first!, amount: 3 }, { cardId: second!, amount: 1 }], made.ctx, []);
    expect(dealt.cards[first!]?.zone).toBe("discard");
    expect(dealt.cards[second!]?.damage).toBe(0);
    expect(dealt.window).toEqual({ kind: "archery", total: 3 });
    expect(archeryRecipients(dealt, made.ctx.cards)).toEqual([second]);
    // The second ally has 2 hit points: it takes 2 of the 3, and the last point goes to a hero, the only characters left.
    const killed = assignArchery(dealt, [{ cardId: second!, amount: 3 }], made.ctx, []);
    expect(killed.cards[second!]?.zone).toBe("discard");
    expect(killed.window).toEqual({ kind: "archery", total: 1 });
    const hero = archeryRecipients(killed, made.ctx.cards)[0]!;
    expect(killed.cards[hero]?.zone).toBe("heroes");
    const done = assignArchery(killed, [{ cardId: hero, amount: 1 }], made.ctx, []);
    expect(done.cards[hero]?.damage).toBe(1);
    expect(done.window).toBeNull();
  });
});

describe("06046:A:1 the case a row cannot show", () => {
  it("06046:A:1 a Wose that is engaged keeps its printed Threat: the Drummer's bonus is for the staging area", () => {
    const made = table({ staging: [DRUMMER], engaged: [CODES.thief] });
    expect(statOf(made.state, made.ctx.cards, CODES.thief, "threat")).toBe(2);
  });
});

describe("06045:A:1 allies cannot defend against Drû-buri-Drû", () => {
  // The first seat's engaged enemy attacks in the combat phase: the passes and the choice of the enemy are answered until the defense window opens, and the characters that may defend are the legal targets.
  const defenders = (enemy: string): string[] => {
    const made = table({ phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], play: ["ally"] });
    let run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
      const intent = run.state.window?.kind === "chooseEnemy" ? { type: "ChooseEnemy" as const, enemyId: run.state.window.options[0] ?? "" } : legalIntents(run.state, made.ctx).find((candidate) => candidate.type === "Pass" || candidate.type === "DeclineAttack");
      if (!intent) break;
      run = send(run, intent as PlayerIntent, made.ctx);
    }
    return legalTargets(run.state, { type: "DeclareDefender" }, made.ctx).map((id) => run.state.cards[id]?.code ?? "");
  };

  it("06045:A:1 the ally is not a legal defender against him, and the heroes are", () => {
    expect(defenders(CODES.druBuriDru)).toEqual(["dh1", "dh2"]);
  });

  it("06045:A:1 the ally may defend against another enemy", () => {
    expect(defenders(DRUMMER)).toContain("ally");
  });
});
