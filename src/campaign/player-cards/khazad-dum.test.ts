// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.lasting-effects, rr.response, rr.action, rr.ready, rr.cannot, rr.destroy,
// rr.active-location, rr.hit-points, rr.triggered-ability, rr.resource-match (data/rules/entries.json).
// The Khazad-dûm player cards, written from their card text (data/cards/KD.json; data/printed holds no ledger for these cards yet, so every
// intent goes through sendUnledgered): Dwalin 03001:A:1, Narvi's Belt 03003:A:1, Durin's Song 03004:A:1, Dwarrowdelf Axe 03007:A:2, A:3 and
// A:4, Khazâd! Khazâd! 03008:A:1, Untroubled by Darkness 03010:A:1, Erebor Record Keeper 03011:A:1 and A:2, Boots from Erebor 03013:A:1,
// A:2 and A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, hosts, passAll, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const DWALIN = "03001";
const BELT = "03003";
const SONG = "03004";
const AXE = "03007";
const KHAZAD = "03008";
const UNTROUBLED = "03010";
const KEEPER = "03011";
const BOOTS = "03013";
// A Dwarf hero (Leadership) and a Tactics Dwarf hero with no text, a Dwarf ally, a Lore and a Spirit hero that are not Dwarves. The Pal is a Leadership
// Hobbit hero (test/harness/scene.ts); the Ally a Leadership ally with no Trait.
const DWARF_HERO = "dwarf-hero";
const AXEMAN = "axeman";
const DWARF = "dwarf";
const SAGE = "sage";
const SPIRIT = "spirit-hero";
const PAL = "pal";
const ALLY = "ally";
// An Orc enemy and a Goblin (no Orc Trait) of 1 hit point, and an Orc no attack of these tests destroys.
const ORC = "orc";
const GOBLIN = "goblin";
const BIG_ORC = "big-orc";
// Locations: an Underground one, a Dark one, and one with neither Trait.
const DEEP = "deep";
const GLOOM = "gloom";
const FIELD = "field";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([DWALIN, BELT, SONG, AXE, KHAZAD, UNTROUBLED, KEEPER, BOOTS]))]);
  cards.set(DWARF_HERO, definePrinted({ code: DWARF_HERO, name: "Dwarf Lord", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Dwarf"] }));
  cards.set(AXEMAN, definePrinted({ code: AXEMAN, name: "Axeman", type: "hero", sphere: "tactics", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Dwarf"] }));
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1, traits: ["Orc"] }));
  cards.set(GOBLIN, definePrinted({ code: GOBLIN, name: "Goblin", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(BIG_ORC, definePrinted({ code: BIG_ORC, name: "Big Orc", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 3, health: 9, traits: ["Orc"] }));
  cards.set(DEEP, definePrinted({ code: DEEP, name: "Deep", type: "location", threat: 1, questPoints: 5, traits: ["Underground"] }));
  cards.set(GLOOM, definePrinted({ code: GLOOM, name: "Gloom", type: "location", threat: 1, questPoints: 5, traits: ["Dark"] }));
  cards.set(FIELD, definePrinted({ code: FIELD, name: "Field", type: "location", threat: 1, questPoints: 5 }));
  base = { ...starter, cards };
});

// The first seat's characters `ids` attack `enemy` in the player attack window.
const attack = (tab: Table, state: Table["state"], enemy: string, ids: readonly string[]): Run =>
  sendUnledgered(begin(attacking(state)), { type: "DeclareAttackers", enemyId: enemy, attackerIds: ids }, tab.ctx);

describe("Dwalin (03001:A:1)", () => {
  // "Response: After Dwalin attacks and destroys an Orc enemy, lower your threat by 2.": Dwalin (Attack 2) destroys the Orc (1 hit point);
  // the threat goes from 8 to 6.
  lineSpec("03001:A:1", "Dwalin: after he destroys an Orc enemy, lower your threat by 2", (effects) => {
    const tab = table(effects, { heroes: [{ code: DWALIN, seat: 0 }], engaged: [{ code: ORC, seat: 0 }] });
    let run = attack(tab, tab.state, idsOf(tab, ORC), [idsOf(tab, DWALIN)]);
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).toContain("03001:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, DWALIN), effectId: "03001:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8 - 2);
  });

  it("03001:A:1 Dwalin: not offered after he destroys an enemy that is not an Orc", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DWALIN, seat: 0 }], engaged: [{ code: GOBLIN, seat: 0 }] });
    const run = attack(tab, tab.state, idsOf(tab, GOBLIN), [idsOf(tab, DWALIN)]);
    expect(run.state.cards[idsOf(tab, GOBLIN)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("03001:response:1");
  });

  // "attacks and destroys": an Orc he attacks that survives gives nothing.
  it("03001:A:1 Dwalin: not offered when the Orc he attacks is not destroyed", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DWALIN, seat: 0 }], engaged: [{ code: BIG_ORC, seat: 0 }] });
    const run = attack(tab, tab.state, idsOf(tab, BIG_ORC), [idsOf(tab, DWALIN)]);
    expect(run.state.cards[idsOf(tab, BIG_ORC)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("03001:response:1");
  });

  // "After Dwalin attacks": another character destroys the Orc while Dwalin does not attack.
  it("03001:A:1 Dwalin: not offered when another character destroys the Orc", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DWALIN, seat: 0 }, { code: DWARF_HERO, seat: 0 }], engaged: [{ code: ORC, seat: 0 }] });
    const run = attack(tab, tab.state, idsOf(tab, ORC), [idsOf(tab, DWARF_HERO)]);
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("03001:response:1");
  });
});

describe("Narvi's Belt (03003:A:1)", () => {
  // "Attach to a Dwarf hero.": the Dwarf hero is offered; the Dwarf ally and the Pal (a Hobbit hero) are not.
  lineSpec("03003:A:1", "Narvi's Belt: Attach to a Dwarf hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: BELT, seat: 0 }] });
    const belt = idsOf(tab, BELT);
    expect(hosts(tab, belt)).toEqual([idsOf(tab, DWARF_HERO)]);
    expect(play(begin(tab.state), tab, belt, idsOf(tab, DWARF_HERO)).state.cards[belt]?.host).toBe(idsOf(tab, DWARF_HERO));
  });
});

describe("Durin's Song (03004:A:1)", () => {
  // "Action: Choose a Dwarf hero. That hero gets +2 Willpower, +2 Attack, and +2 Defense until the end of the round.": the Dwarf heroes of both
  // players are offered, the Dwarf ally and the Pal are not; the chosen hero keeps the bonus into the next phase and loses it when the round ends.
  lineSpec("03004:A:1", "Durin's Song: a chosen Dwarf hero gets +2 Willpower, Attack and Defense until the end of the round", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }, { code: AXEMAN, seat: 1 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: SONG, seat: 0 }] });
    const [lord, axeman] = [idsOf(tab, DWARF_HERO), idsOf(tab, AXEMAN)];
    let run = play(begin(tab.state), tab, idsOf(tab, SONG));
    expect(choices(run.state, tab).sort()).toEqual([lord, axeman].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: axeman }, tab.ctx);
    const later = withMode(run.state, "combatStart");
    for (const which of ["willpower", "attack", "defense"] as const) {
      expect(stat(later, tab, axeman, which)).toBe(printed(tab, AXEMAN, which) + 2);
      expect(stat(later, tab, lord, which)).toBe(printed(tab, DWARF_HERO, which));
      expect(stat(withMode(later, "beginRound"), tab, axeman, which)).toBe(printed(tab, AXEMAN, which));
    }
  });
});

describe("Dwarrowdelf Axe (03007:A:2, A:3, A:4)", () => {
  // "Attach to a Dwarf character.": the Dwarf heroes and the Dwarf ally are offered; the Pal is not.
  lineSpec("03007:A:2", "Dwarrowdelf Axe: Attach to a Dwarf character", (effects) => {
    const tab = table(effects, { heroes: [{ code: AXEMAN, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: AXE, seat: 0 }] });
    const axe = idsOf(tab, AXE);
    expect(hosts(tab, axe)).toEqual([idsOf(tab, AXEMAN), idsOf(tab, DWARF)].sort());
    expect(play(begin(tab.state), tab, axe, idsOf(tab, DWARF)).state.cards[axe]?.host).toBe(idsOf(tab, DWARF));
  });

  // "Attached character gets +1 Attack": played on the Dwarf ally, in the state that intent returns.
  lineSpec("03007:A:3", "Dwarrowdelf Axe: attached character gets +1 Attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: AXEMAN, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: AXE, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, AXE), idsOf(tab, DWARF));
    expect(stat(run.state, tab, idsOf(tab, DWARF), "attack")).toBe(printed(tab, DWARF, "attack") + 1);
    expect(stat(run.state, tab, idsOf(tab, AXEMAN), "attack")).toBe(printed(tab, AXEMAN, "attack"));
  });

  // The Axeman holds the Axe; `enemy` is engaged with the first seat.
  function armed(effects: readonly Effect[], enemy: string): Table {
    const tab = table(effects, { heroes: [{ code: AXEMAN, seat: 0 }, { code: DWARF_HERO, seat: 0 }], hand: [{ code: AXE, seat: 0 }], engaged: [{ code: enemy, seat: 0 }] });
    return { ...tab, state: play(begin(tab.state), tab, idsOf(tab, AXE), idsOf(tab, AXEMAN)).state };
  }

  // "Response: After attached character attacks, deal 1 damage to the defending enemy.": the Axeman (Attack 1 + 1) attacks the Big Orc
  // (Defense 3), so the attack deals no damage, and the Response deals 1.
  lineSpec("03007:A:4", "Dwarrowdelf Axe: after the attached character attacks, 1 damage to the defending enemy", (effects) => {
    const tab = armed(effects, BIG_ORC);
    const orc = idsOf(tab, BIG_ORC);
    let run = attack(tab, tab.state, orc, [idsOf(tab, AXEMAN)]);
    expect(run.state.cards[orc]?.damage ?? 0).toBe(0);
    expect(triggers(run.state, tab)).toContain("03007:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, AXE), effectId: "03007:response:1" }, tab.ctx);
    expect(run.state.cards[orc]?.damage).toBe(1);
  });

  // Another character attacks: no Response.
  it("03007:A:4 Dwarrowdelf Axe: not offered when another character attacks", () => {
    const tab = armed(EFFECTS, BIG_ORC);
    const run = attack(tab, tab.state, idsOf(tab, BIG_ORC), [idsOf(tab, DWARF_HERO)]);
    expect(triggers(run.state, tab)).not.toContain("03007:response:1");
  });

  it("03007:A:4 Dwarrowdelf Axe: not offered when the attack destroyed the defending enemy", () => {
    const tab = armed(EFFECTS, ORC);
    const run = attack(tab, tab.state, idsOf(tab, ORC), [idsOf(tab, AXEMAN)]);
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("03007:response:1");
  });
});

describe("Khazâd! Khazâd! (03008:A:1)", () => {
  // "Action: Choose a Dwarf character. Until the end of the phase, that character gets +3 Attack.": the Dwarf hero and the Dwarf ally are
  // offered, the Pal is not; the ally has +3 Attack until the phase ends.
  lineSpec("03008:A:1", "Khazâd! Khazâd!: a chosen Dwarf character gets +3 Attack until the end of the phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: AXEMAN, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: KHAZAD, seat: 0 }] });
    const dwarf = idsOf(tab, DWARF);
    let run = play(begin(tab.state), tab, idsOf(tab, KHAZAD));
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, AXEMAN), dwarf].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: dwarf }, tab.ctx);
    expect(stat(run.state, tab, dwarf, "attack")).toBe(printed(tab, DWARF, "attack") + 3);
    expect(stat(run.state, tab, idsOf(tab, AXEMAN), "attack")).toBe(printed(tab, AXEMAN, "attack"));
    expect(stat(withMode(run.state, "questCommit"), tab, dwarf, "attack")).toBe(printed(tab, DWARF, "attack"));
  });
});

describe("Untroubled by Darkness (03010:A:1)", () => {
  // Dwalin (a Spirit Dwarf hero, who pays) and the Pal; a Dwarf ally of each player; `active` the active location.
  function scene(effects: readonly Effect[], active?: string): Table {
    return table(effects, { seats: 2, heroes: [{ code: DWALIN, seat: 0 }, { code: PAL, seat: 0 }, { code: SAGE, seat: 1 }], allies: [{ code: DWARF, seat: 0 }, { code: DWARF, seat: 1 }], hand: [{ code: UNTROUBLED, seat: 0 }], ...(active ? { active } : {}) });
  }

  // "Action: Each Dwarf character gets +1 Willpower until the end of the phase.": with a location of neither Trait active, Dwalin and both
  // Dwarf allies (the other player's too) get +1, the Pal does not; the next phase they have their printed Willpower.
  lineSpec("03010:A:1", "Untroubled by Darkness: each Dwarf character gets +1 Willpower until the end of the phase", (effects) => {
    const tab = scene(effects, FIELD);
    const run = play(begin(tab.state), tab, idsOf(tab, UNTROUBLED));
    const dwarves = [[idsOf(tab, DWALIN), DWALIN], ...(tab.ids[DWARF] ?? []).map((id) => [id, DWARF])] as const;
    expect(dwarves).toHaveLength(3);
    for (const [id, code] of dwarves) {
      expect(stat(run.state, tab, id, "willpower")).toBe(printed(tab, code, "willpower") + 1);
      expect(stat(withMode(run.state, "questCommit"), tab, id, "willpower")).toBe(printed(tab, code, "willpower"));
    }
    expect(stat(run.state, tab, idsOf(tab, PAL), "willpower")).toBe(1);
  });

  // "(+2 Willpower instead if the active location is an Underground or Dark location.)": +2 (not +3) with an Underground or a Dark location active.
  lineSpec("03010:A:1", "Untroubled by Darkness: +2 Willpower instead while an Underground or Dark location is active", (effects) => {
    for (const location of [DEEP, GLOOM]) {
      const tab = scene(effects, location);
      const run = play(begin(tab.state), tab, idsOf(tab, UNTROUBLED));
      expect(stat(run.state, tab, idsOf(tab, DWALIN), "willpower")).toBe(printed(tab, DWALIN, "willpower") + 2);
      expect(stat(run.state, tab, tab.ids[DWARF]?.[1] ?? "", "willpower")).toBe(printed(tab, DWARF, "willpower") + 2);
    }
  });

  // No Dwarf character is in play: the event can change nothing, so it is not offered (rr.triggered-ability).
  it("03010:A:1 Untroubled by Darkness: not offered with no Dwarf character in play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SPIRIT, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: UNTROUBLED, seat: 0 }] });
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, UNTROUBLED))).toBe(false);
  });

  // An Underground location in the staging area is not the active location: +1.
  it("03010:A:1 Untroubled by Darkness: an Underground location in the staging area does not count", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DWALIN, seat: 0 }], hand: [{ code: UNTROUBLED, seat: 0 }], staging: [DEEP] });
    const run = play(begin(tab.state), tab, idsOf(tab, UNTROUBLED));
    expect(stat(run.state, tab, idsOf(tab, DWALIN), "willpower")).toBe(printed(tab, DWALIN, "willpower") + 1);
  });
});

describe("Erebor Record Keeper (03011:A:1, A:2)", () => {
  // "Erebor Record Keeper cannot attack or defend.": an attack with him is refused, and so is declaring him a defender.
  lineSpec("03011:A:1", "Erebor Record Keeper: cannot attack or defend", (effects) => {
    const tab = table(effects, { heroes: [{ code: SAGE, seat: 0 }], allies: [{ code: KEEPER, seat: 0 }], engaged: [{ code: BIG_ORC, seat: 0 }] });
    const keeper = idsOf(tab, KEEPER);
    expect(refusal(attacking(tab.state), { type: "DeclareAttackers", enemyId: idsOf(tab, BIG_ORC), attackerIds: [keeper] }, tab.ctx)).not.toBeNull();
    const run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: keeper }, tab.ctx)).not.toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: idsOf(tab, SAGE) }, tab.ctx)).toBeNull();
  });

  // The Sage (Lore) pays; the exhausted Dwarf hero, the Pal (exhausted, not a Dwarf) and the Keeper.
  function keeperScene(effects: readonly Effect[], resources = 6): Table {
    const tab = table(effects, { heroes: [{ code: SAGE, seat: 0 }, { code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: KEEPER, seat: 0 }] }, resources);
    let state = updateCard(tab.state, idsOf(tab, DWARF_HERO), { exhausted: true });
    state = updateCard(state, idsOf(tab, PAL), { exhausted: true });
    return { ...tab, state };
  }

  // "Action: Exhaust Erebor Record Keeper and pay 1 Lore resource to choose and ready a Dwarf character.": the Keeper exhausts, the Sage
  // pays 1, the Pal is not offered, and the chosen Dwarf hero readies.
  lineSpec("03011:A:2", "Erebor Record Keeper: exhaust him and pay 1 Lore resource to ready a Dwarf character", (effects) => {
    const tab = keeperScene(effects);
    const [keeper, lord, sage] = [idsOf(tab, KEEPER), idsOf(tab, DWARF_HERO), idsOf(tab, SAGE)];
    expect(triggers(tab.state, tab)).toContain("03011:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: keeper, effectId: "03011:action:1", payments: [{ heroId: sage, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[keeper]?.exhausted).toBe(true);
    expect(run.state.cards[sage]?.resources).toBe(6 - 1);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).toContain(lord);
    expect(choices(run.state, tab)).not.toContain(idsOf(tab, PAL));
    run = sendUnledgered(run, { type: "Choose", optionId: lord }, tab.ctx);
    expect(run.state.cards[lord]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, PAL)]?.exhausted).toBe(true);
  });

  // With no Lore resource the cost cannot be paid.
  it("03011:A:2 Erebor Record Keeper: not offered without a Lore resource to pay", () => {
    const tab = keeperScene(EFFECTS, 0);
    expect(triggers(tab.state, tab)).not.toContain("03011:action:1");
  });
});

describe("Boots from Erebor (03013:A:1, A:2, A:3)", () => {
  // "Attach to a Dwarf or Hobbit character.": the Dwarf hero, the Dwarf ally and the Pal (a Hobbit) are offered; the Sage is not.
  lineSpec("03013:A:1", "Boots from Erebor: Attach to a Dwarf or Hobbit character", (effects) => {
    const tab = table(effects, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: DWARF, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: BOOTS, seat: 0 }] });
    const boots = idsOf(tab, BOOTS);
    expect(hosts(tab, boots)).toEqual([idsOf(tab, DWARF_HERO), idsOf(tab, PAL), idsOf(tab, DWARF)].sort());
    expect(play(begin(tab.state), tab, boots, idsOf(tab, PAL)).state.cards[boots]?.host).toBe(idsOf(tab, PAL));
  });

  // "Limit 1 Boots from Erebor per character.": once the Pal wears one pair, the second pair is offered only the Dwarf hero.
  lineSpec("03013:A:2", "Boots from Erebor: limit 1 per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: BOOTS, seat: 0 }, { code: BOOTS, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[BOOTS] ?? [];
    const run = play(begin(tab.state), tab, first, idsOf(tab, PAL));
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, PAL));
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, DWARF_HERO)]);
  });

  // "Attached character gets +1 hit point.": played on the Pal (3 hit points).
  lineSpec("03013:A:3", "Boots from Erebor: attached character gets +1 hit point", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }], hand: [{ code: BOOTS, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, BOOTS), idsOf(tab, PAL));
    expect(stat(run.state, tab, idsOf(tab, PAL), "hitPoints")).toBe(3 + 1);
  });
});
