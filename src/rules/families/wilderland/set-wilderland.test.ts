// Rules: rr.active-location, rr.neutral-cards, faq.lasting-effects (data/rules/entries.json); ledger lines 132035:A:1, 132037:A:1, 132038:A:1.
// The Wilderland set's records on a table of The Battle of Five Armies (the set is dealt by Flies and Spiders and The Lonely Mountain too).
import { describe, expect, it } from "vitest";

import { answer, attack, cardSpecs, committed, defend, reveal, threat, type Row } from "../../../../test/harness/card-spec.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { expireModifiers } from "../../core/state.ts";
import { fightEnemy, first, idOf, legalIntents, revealedTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const table = (layout = {}) => tableFromLayout("the-battle-of-five-armies", layout);

describe("Wilderland (132035 to 132038)", () => {
  it("132038:A:1 a hero that exhausts after the card was revealed gets -1 Willpower, and gets it back when it readies", () => {
    const made = table({ phase: "Quest", deck: ["132038", "f0"] });
    const hero = made.hero;
    const base = modifiedStat(made.state, made.state.cards[hero]!, "willpower", made.ctx.cards);
    let state = revealedTop(made, "132038");
    expect(modifiedStat(state, state.cards[hero]!, "willpower", made.ctx.cards)).toBe(base);
    state = { ...state, cards: { ...state.cards, [hero]: { ...state.cards[hero]!, exhausted: true } } };
    expect(modifiedStat(state, state.cards[hero]!, "willpower", made.ctx.cards)).toBe(base - 1);
    state = { ...state, cards: { ...state.cards, [hero]: { ...state.cards[hero]!, exhausted: false } } };
    expect(modifiedStat(state, state.cards[hero]!, "willpower", made.ctx.cards)).toBe(base);
  });

  it("132038:A:1 a character that enters play after the card was revealed, exhausted, gets -1 Willpower until the end of the round", () => {
    const made = table({ phase: "Quest", deck: ["132038", "f0"], hand: ["ally"] });
    const ally = first(made.state, "ally");
    const base = modifiedStat(made.state, { ...made.state.cards[ally]!, zone: "play", controller: 0, exhausted: true }, "willpower", made.ctx.cards);
    let state = revealedTop(made, "132038");
    const entered = (exhausted: boolean) => ({ ...state, cards: { ...state.cards, [ally]: { ...state.cards[ally]!, zone: "play" as const, controller: 0, exhausted } } });
    state = entered(true);
    expect(modifiedStat(state, state.cards[ally]!, "willpower", made.ctx.cards)).toBe(Math.max(0, base - 1));
    state = entered(false);
    expect(modifiedStat(state, state.cards[ally]!, "willpower", made.ctx.cards)).toBe(base);
  });

  it("132038:A:1 an exhausted character gets -1 Willpower, -1 Attack and -1 Defense, of both players, and a ready one gets none", () => {
    const made = tableFromLayout("the-battle-of-five-armies", { phase: "Quest", deck: ["132038", "f0"], seats: 2 });
    const heroes = [made.hero, made.seat1Hero!];
    const stats = ["willpower", "attack", "defense"] as const;
    const read = (state: typeof made.state, id: string) => stats.map((stat) => modifiedStat(state, state.cards[id]!, stat, made.ctx.cards));
    const base = heroes.map((id) => read(made.state, id));
    expect(base.every((values) => values.every((value) => value >= 1))).toBe(true);
    const revealed = revealedTop(made, "132038");
    const exhaust = (state: typeof made.state, id: string) => ({ ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, exhausted: true } } });
    const both = exhaust(exhaust(revealed, heroes[0]!), heroes[1]!);
    expect(read(both, heroes[0]!)).toEqual(base[0]!.map((value) => value - 1));
    expect(read(both, heroes[1]!)).toEqual(base[1]!.map((value) => value - 1));
    const one = exhaust(revealed, heroes[0]!);
    expect(read(one, heroes[1]!)).toEqual(base[1]);
    // The penalty is read each time: a character exhausted before it is revealed gets it too, and it ends with the round.
    const early = revealedTop({ ...made, state: exhaust(made.state, heroes[0]!) }, "132038");
    expect(read(early, heroes[0]!)).toEqual(base[0]!.map((value) => value - 1));
    expect(read(expireModifiers(early, ["endOfRound"]), heroes[0]!)).toEqual(base[0]);
  });

  it("132035:A:1 while it is the active location, a location in the staging area gets -1 Threat", () => {
    const made = table({ active: "132035", staging: ["132060"] });
    const threat = (state = made.state) => modifiedStat(state, state.cards[first(state, "132060")]!, "threat", made.ctx.cards);
    const off = table({ staging: ["132035", "132060"] });
    expect(threat(off.state)).toBe(threat() + 1);
  });
});

// Bilbo (132001) as the first seat's hero holding `resources`, the stand-in heroes holding none.
function withBilbo(resources: number, layout = {}) {
  const made = table({ phase: "Travel", staging: ["132035"], play: ["132001"], ...layout });
  const bilbo = first(made.state, "132001");
  const seat = made.state.seats[0]!;
  const cards = { ...made.state.cards, [bilbo]: { ...made.state.cards[bilbo]!, zone: "heroes" as const, controller: 0, resources } };
  return { ...made, state: { ...made.state, cards, seats: [{ ...seat, heroes: [...seat.heroes, bilbo] }, made.state.seats[1]!] as const } };
}
const canTravel = (made: ReturnType<typeof withBilbo>) => legalIntents(made.state, made.ctx).some((intent) => intent.type === "Travel");

describe("Hidden Path travel (132035:A:2)", () => {
  it("132035:A:2 the players can travel here with 2 Baggins resources, and not with 1", () => {
    expect(canTravel(withBilbo(2))).toBe(true);
    expect(canTravel(withBilbo(1))).toBe(false);
  });

  it("132035:A:2 resources of a hero outside the Baggins sphere do not pay it", () => {
    expect(canTravel(withBilbo(0, { heroResources: 3 }))).toBe(false);
  });
});

describe("Shadow cards of the set (132037:A:2, 132038:A:2)", () => {
  const attackDuring = (shadow: string, undefended: boolean) => {
    const fought = fightEnemy(table, shadow, "f3", {}, { undefended });
    return modifiedStat(fought.during, fought.during.cards[idOf(fought.during, "f3")]!, "attack", fought.ctx.cards);
  };
  it("132037:A:2 the attacking enemy gets +1 Attack, +2 when the attack is undefended", () => {
    expect(attackDuring("132037", false) - attackDuring("f0", false)).toBe(1);
    expect(attackDuring("132037", true) - attackDuring("f0", true)).toBe(2);
  });

  it("132038:A:2 a defender this attack destroys makes its controller raise his threat by 5", () => {
    const nearDeath = (state: Parameters<NonNullable<Parameters<typeof fightEnemy>[4]>["tweak"] & {}>[0], made: { hero: string; ctx: { cards: Parameters<typeof modifiedStat>[3] } }) => ({
      ...state,
      modifiers: [...state.modifiers, { instanceId: made.hero, sourceId: made.hero, stat: "defense" as const, amount: -9, until: "endOfRound" as const }],
      cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: modifiedStat(state, state.cards[made.hero]!, "hitPoints", made.ctx.cards) - 1 } },
    });
    const raised = (shadow: string, undefended = false) => {
      const fought = fightEnemy(table, shadow, "f3", {}, { tweak: nearDeath, undefended });
      return fought.run.state.seats[0]!.threat - fought.start.seats[0]!.threat;
    };
    expect(raised("132038") - raised("f0")).toBe(5);
  });

  it("132038:A:2 an undefended attack that destroys a hero raises no threat: no defending character is destroyed", () => {
    const nearDeath = (state: Parameters<NonNullable<Parameters<typeof fightEnemy>[4]>["tweak"] & {}>[0], made: { hero: string; ctx: { cards: Parameters<typeof modifiedStat>[3] } }) => ({
      ...state,
      cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: modifiedStat(state, state.cards[made.hero]!, "hitPoints", made.ctx.cards) - 1 } },
    });
    const raised = (shadow: string) => {
      const fought = fightEnemy(table, shadow, "f3", {}, { tweak: nearDeath, undefended: true });
      expect(fought.run.state.cards[fought.made.hero]?.zone).not.toBe("heroes");
      return fought.run.state.seats[0]!.threat - fought.start.seats[0]!.threat;
    };
    expect(raised("132038") - raised("f0")).toBe(0);
  });
});

// The set's spec rows. Gundabad Wolf Rider (Attack 3) against the stand-in ally (Defense 1, 2 hit points) destroys it.
const ROWS: readonly Row[] = [
  { line: "132037:A:1", name: "naming Leadership removes the committed characters of other spheres from the quest", layout: { phase: "Quest", committed: ["dh1"] }, act: [reveal("132037"), answer("leadership")], expect: committed("dh1", false) },
  { line: "132038:A:2", name: "a defender the attack destroys makes the defending player raise his threat by 5", layout: { play: ["ally"] }, act: [attack("132055", { shadow: "132038" }), defend("ally")], expect: threat(33) },
];
cardSpecs("the-battle-of-five-armies", ROWS);
