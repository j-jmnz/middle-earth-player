// Rules: rr.shadow-effects, rr.step-6-4-1, rr.step-6-4-3, rr.undefended-attacks, ats.villager-tokens-discarded (data/rules/entries.json).
// The Shadow lines (06072:A:2, 06073:A:2, 06078:A:3, 06079:A:3, 06080:A:2) and the Ravaging Orcs of The Siege of Cair Andros (05062:A:2, 05063:A:2, 05064:A:2) that act differently here: while stage 2B is current an undefended attack is aimed at Rescued Villagers, so the Attack they add becomes discarded villager tokens. Each attack is a real one: an enemy engaged with the first seat attacks with the Shadow card dealt to it.
import { describe, expect, it } from "vitest";

import { fightEnemy, idOf } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, table, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { protect, rescued, dead, marauding, ravager, homestead, trapped, panicked } = CODES;
const RABBLE = "05062";
const ARSONIST = "05063";
const SCOURGE = "05064";

// The attacker `f0` (Attack 1) attacks undefended: the attack lands on Rescued Villagers (6 tokens), Dead Villagers holds `damage` damage tokens. `deck` is the encounter deck the Shadow cards are dealt from, first card first.
const scene = (deck: readonly string[], damage = 0, layout: Parameters<typeof table>[0] = {}) => (more: Parameters<typeof table>[0]) => table({ stage: protect, staging: [{ code: rescued, resources: 6 }, { code: dead, damage }], ...layout, ...more, deck });
const attack = (deck: readonly string[], damage = 0, defended = false) => fightEnemy(scene(deck, damage), deck[0] ?? "f0", "f0", {}, { undefended: !defended, lands: { f0: rescued } });
const heroDamage = (fight: ReturnType<typeof attack>) => [fight.made.hero, fight.made.hero2].map((id) => fight.run.state.cards[id]?.damage ?? 0);

describe("undefended attacks on stage 2B with a Shadow card", () => {
  it("06073:A:2 Orc Ravager's Shadow gives +2 Attack to an undefended attack: 1 and 2 are 3 villager tokens discarded, 3 damage tokens on Dead Villagers and no hero damaged", () => {
    const fight = attack([ravager, "f0", "f0"]);
    expect(villagers(fight.run.state, rescued)).toBe(3);
    expect(damageOn(fight.run.state, dead)).toBe(3);
    expect(heroDamage(fight)).toEqual([0, 0]);
  });

  it("06080:A:2 Panicked!'s Shadow gives +1 Attack for each damage token on Dead Villagers: with 2 there the attack of 1 is 3 tokens and Dead Villagers ends with 5", () => {
    const fight = attack([panicked, "f0", "f0"], 2);
    expect(villagers(fight.run.state, rescued)).toBe(3);
    expect(damageOn(fight.run.state, dead)).toBe(5);
  });

  it("06078:A:3 Burnt Homestead's Shadow raises the defending player's threat by 1 for each damage token on Dead Villagers (3), before the tokens of the attack are added", () => {
    const fight = attack([homestead, "f0", "f0"], 3);
    expect(fight.run.state.seats[0]?.threat).toBe(fight.start.seats[0]!.threat + 3);
    expect(villagers(fight.run.state, rescued)).toBe(5);
  });

  it("06072:A:2 the attack destroys no character (it only discards tokens), so Marauding Orc's Shadow discards no further villager token: the attack's 1 token only", () => {
    const fight = attack([marauding, "f0", "f0"]);
    expect(villagers(fight.run.state, rescued)).toBe(5);
    expect(damageOn(fight.run.state, dead)).toBe(1);
  });

  it("06079:A:3 Trapped Inside's Shadow discards no villager token when the attack destroys no character: only the attack's 1 token", () => {
    const fight = attack([trapped, "f0", "f0"]);
    expect(villagers(fight.run.state, rescued)).toBe(5);
    expect(damageOn(fight.run.state, dead)).toBe(1);
  });

  it("06072:A:2 a defended attack that destroys nothing discards no villager token and places no damage token", () => {
    const fight = attack([marauding, "f0", "f0"], 0, true);
    expect(villagers(fight.run.state, rescued)).toBe(6);
    expect(damageOn(fight.run.state, dead)).toBe(0);
  });

  it("06072:A:1 Marauding Orc places no damage token on Dead Villagers when its attack destroys nothing (a hero with Defense 2 defends the Attack of 4)", () => {
    const fight = fightEnemy(scene(["f0", "f0"]), "f0", marauding, {});
    expect(fight.run.state.cards[idOf(fight.run.state, marauding)]?.zone).toBe("engaged");
    expect(damageOn(fight.run.state, dead)).toBe(0);
  });
});

describe("the Ravaging Orcs against Rescued Villagers (05062:A:2, 05063:A:2, 05064:A:2)", () => {
  it("05062:A:2 Orc Rabble's Shadow deals 1 more Shadow card for the 1 player: Panicked! after it adds its +2 (2 damage tokens) to the attack of 1, so 3 tokens are discarded", () => {
    const fight = attack([RABBLE, panicked, "f0"], 2);
    expect(villagers(fight.run.state, rescued)).toBe(3);
    expect(damageOn(fight.run.state, dead)).toBe(5);
    expect(heroDamage(fight)).toEqual([0, 0]);
  });

  it("05063:A:2 Orc Arsonist's Shadow gives +1 Attack and deals another Shadow card: with Orc Ravager's +2 for the undefended attack, the attack of 1 becomes 4 tokens", () => {
    const fight = attack([ARSONIST, ravager, "f0"]);
    expect(villagers(fight.run.state, rescued)).toBe(2);
    expect(damageOn(fight.run.state, dead)).toBe(4);
  });

  it("05064:A:2 Scourge of Mordor's Shadow is Orc Arsonist's: +1 Attack and another Shadow card (Panicked! with 2 damage tokens on Dead Villagers: 1, 1 and 2 are 4 tokens)", () => {
    const fight = attack([SCOURGE, panicked, "f0"], 2);
    expect(villagers(fight.run.state, rescued)).toBe(2);
    expect(damageOn(fight.run.state, dead)).toBe(6);
  });
});
