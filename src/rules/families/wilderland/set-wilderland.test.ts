// Rules: rr.active-location, rr.neutral-cards, faq.lasting-effects (data/rules/entries.json); ledger lines 132035:A:1, 132037:A:1, 132038:A:1.
// The Wilderland set's records on a table of The Battle of Five Armies (the set is dealt by Flies and Spiders and The Lonely Mountain too).
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
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
    const raised = (shadow: string) => {
      const fought = fightEnemy(table, shadow, "f3", {}, { tweak: nearDeath });
      return fought.run.state.seats[0]!.threat - fought.start.seats[0]!.threat;
    };
    expect(raised("132038") - raised("f0")).toBe(5);
  });
});
