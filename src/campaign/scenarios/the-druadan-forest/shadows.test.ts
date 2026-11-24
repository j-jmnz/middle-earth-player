// Rules: rr.shadow-effects, rr.lasting-effects, rr.first-player, rr.cost, rr.defending-player, faq.enemy-attacks-outside-combat (data/rules/entries.json).
// The shadow lines of The Drúadan Forest (06046:A:2, 06047:A:3, 06049:A:2, 06053:A:2, 06054:A:3, 06055:A:3): the shadow card is dealt to an enemy engaged with the first seat, which attacks with the first hero defending. Each test builds its moment with the scene kit, and its title starts with the line id.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and a Tactics icon; Éowyn (01007) is a Spirit hero. `f3` is an enemy with Attack 1 and Defense 1 (`f0`, the card in the deck the shadow is dealt from is `f0`).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { fightEnemy, idOf, statOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { CODES, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { drummer: DRUMMER, elite: ELITE, thief: THIEF, hunter: HUNTER, menInDark: MEN, stars: STARS, leaves: LEAVES } = CODES;
const EOWYN = "01007";

const scene = (layout: Layout) => table(layout, undefined, [EOWYN]);
const fight = (shadow: string, enemy: string, layout: Layout = {}, options: Parameters<typeof fightEnemy>[4] = {}) => fightEnemy(scene, shadow, enemy, layout, options);
const zone = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;
const choose = (option: string) => (state: ScenarioState): string => (state.window?.kind === "choose" && state.window.options.includes(option) ? option : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));

describe("06046:A:2 the Drummer's shadow", () => {
  const both = { engaged: [{ code: THIEF, seat: 0 }, { code: HUNTER, seat: 0 }] } as const;

  it("06046:A:2 each Wose engaged with the defending player gets +1 Attack until the attack ends, the attacker and the others", () => {
    const { during, run } = fight(DRUMMER, THIEF, both);
    expect(statOf(during, scene({}).ctx.cards, THIEF, "attack")).toBe(3);
    expect(statOf(during, scene({}).ctx.cards, HUNTER, "attack")).toBe(5);
    // The attack is over: both are back to their printed Attack.
    expect(statOf(run.state, scene({}).ctx.cards, HUNTER, "attack")).toBe(4);
  });

  it("06046:A:2 a Wose engaged with another player gets nothing, nor an enemy that is no Wose", () => {
    const layout = { seats: 2, engaged: [{ code: THIEF, seat: 0 }, { code: HUNTER, seat: 1 }, { code: "f3", seat: 0 }] } as const;
    const { during } = fight(DRUMMER, THIEF, layout);
    expect(statOf(during, scene({}).ctx.cards, HUNTER, "attack")).toBe(4);
    expect(statOf(during, scene({}).ctx.cards, "f3", "attack")).toBe(1);
  });
});

// "Shadow: Return attacking enemy to the staging area after it attacks unless any player pays 1 resource" (the Elite 06047:A:3 and the Thief 06049:A:2 print it alike).
for (const [line, code] of [["06047:A:3", ELITE], ["06049:A:2", THIEF]] as const) {
  describe(`${line} the shadow of ${code}`, () => {
    const resources = (hero: string, amount: number, seat = 0) => ({ code: hero, seat, resources: amount });

    it(`${line} the attacker returns to the staging area after its attack when nobody pays`, () => {
      const { run } = fight(code, "f3", { heroes: [resources(EOWYN, 1)] }, { pick: choose("return") });
      expect(zone(run.state, "f3")).toBe("staging");
      expect(run.state.cards[idOf(run.state, EOWYN)]?.resources).toBe(1);
    });

    it(`${line} it stays engaged when any player pays 1 resource: a Spirit hero pays for a card with no sphere`, () => {
      const { run } = fight(code, "f3", { heroes: [resources(EOWYN, 1)] }, { pick: choose("pay") });
      expect(zone(run.state, "f3")).toBe("engaged");
      expect(run.state.cards[idOf(run.state, EOWYN)]?.resources).toBe(0);
    });

    it(`${line} the resource may come from the other player's hero, and with none anywhere the attacker returns without a question`, () => {
      const second = { seats: 2, heroes: [resources(EOWYN, 1, 1)] } as const;
      const { run } = fight(code, "f3", second, { pick: choose("pay") });
      expect(zone(run.state, "f3")).toBe("engaged");
      expect(run.state.cards[idOf(run.state, EOWYN)]?.resources).toBe(0);
      const none = fight(code, "f3", {}, { pick: () => { throw new Error("a choice was asked"); } });
      expect(zone(none.run.state, "f3")).toBe("staging");
    });
  });
}

describe("06053:A:2 the shadow of Men in the Dark", () => {
  it("06053:A:2 the attacker gets +1 Attack for each hero the defending player controls with no resources: 3 against the Defense 2 of the defender", () => {
    const { run } = fight(MEN, "f3", {});
    expect(run.state.cards[idOf(run.state, "dh1")]?.damage).toBe(1);
  });

  it("06053:A:2 a hero with a resource is not counted, and neither is a hero of another player", () => {
    const held = fight(MEN, "f3", { heroResources: 1 });
    expect(held.run.state.cards[idOf(held.run.state, "dh1")]?.damage).toBe(0);
    // Two players: the second player's hero has none, the first player's heroes each hold 1: no bonus.
    const two = fight(MEN, "f3", { seats: 2 }, { tweak: (state) => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, state.seats[0]?.heroes.includes(id) ? { ...card, resources: 1 } : card])) }) });
    expect(two.run.state.cards[idOf(two.run.state, "dh1")]?.damage).toBe(0);
  });
});

describe("06054:A:3 the shadow of Stars in Sky", () => {
  it("06054:A:3 all resources of the defending character's pool are discarded, not those of the other heroes", () => {
    const { run } = fight(STARS, "f3", { heroResources: 3 });
    expect(run.state.cards[idOf(run.state, "dh1")]?.resources).toBe(0);
    expect(run.state.cards[idOf(run.state, "dh2")]?.resources).toBe(3);
  });

  it("06054:A:3 an undefended attack has no defending character: nothing is discarded", () => {
    const { run } = fight(STARS, "f3", { heroResources: 3 }, { undefended: true });
    expect(run.state.cards[idOf(run.state, "dh1")]?.resources).toBe(3);
    expect(run.state.cards[idOf(run.state, "dh2")]?.resources).toBe(3);
  });
});

describe("06055:A:3 the shadow of Leaves on Tree", () => {
  it("06055:A:3 an attachment of the defending character is discarded, and one on another hero is kept", () => {
    const { run } = fight(LEAVES, "f3", { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh2" }] });
    const zones = Object.values(run.state.cards).filter((card) => card.code === "attachment").map((card) => card.zone).sort();
    expect(zones).toEqual(["discard", "play"]);
      });

  it("06055:A:3 with no attachment on the defender nothing happens", () => {
    const { run } = fight(LEAVES, "f3", { attached: [{ code: "attachment", to: "dh2" }] });
    expect(zone(run.state, "attachment")).toBe("play");
  });
});
