// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.lasting-effects, rr.limits, rr.action, rr.response, rr.then, rr.cost,
// rr.search, rr.play-and-put-into-play, rr.enters-play, rr.traits, rr.resource-phase, rr.triggered-ability (data/rules/entries.json).
// The City of Corsairs player cards, written from their card text (data/cards/CoC.json; data/printed holds no ledger for this pack, so
// the lines are the text of data/cards and every intent goes through sendUnledgered): Prince Imrahil 12138:A:1, Knight of the White Tower
// 12139:A:1, Soldier of Dol Amroth 12141:A:1, Súlien 12142:A:1, Inspiring Presence 12143:A:1, Guardian of Ithilien 12144:A:1, Ranger
// Spear 12145:A:1 and A:2, Prince of Dol Amroth 12146:A:1, A:2 and A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, combat, enter, fillers, hosts, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const IMRAHIL = "12138";
const KNIGHT = "12139";
const SOLDIER = "12141";
const SULIEN = "12142";
const PRESENCE = "12143";
const GUARDIAN = "12144";
const SPEAR = "12145";
const PRINCE_OF_DOL_AMROTH = "12146";
// The other Prince Imrahil cards: a hero and an ally. Gondorian Spearman: a Tactics ally of cost 2. Warrior of Lossarnach: "Each Outlands
// character you control gets +1 Defense."
const IMRAHIL_HERO = "02050";
const IMRAHIL_ALLY = "145005";
const SPEARMAN = "01029";
const LOSSARNACH = "06002";
// Cards with no text: heroes of each sphere (threat cost 8 unless named), allies with one Trait each, Outlands allies of each sphere, a
// Gondor attachment, a player attachment to put on an enemy, locations and enemies.
const LEAD = "lead";
const TAC = "tac";
const SPI = "spi";
const LORE = "lore";
const RANGER_HERO = "ranger-hero";
const RANGER_ALLY = "ranger-ally";
const GONDOR_ALLY = "gondor-ally";
const WARRIOR_ALLY = "warrior-ally";
const NOBLE_ALLY = "noble-ally";
const ROHAN_ALLY = "rohan-ally";
const GONDOR_GEAR = "gondor-gear";
const SNARE = "snare";
const OUTLANDS = { leadership: "out-lead", tactics: "out-tac", spirit: "out-spi", lore: "out-lore" } as const;
const MARSH = "marsh";
const HILL = "hill";
const WALL = "wall";
const WALL_TWO = "wall-two";
const WALL_THREE = "wall-three";
const ALLY = "ally";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);
type Sphere = "leadership" | "tactics" | "lore" | "spirit";
const hero = (code: string, sphere: Sphere, threat = 8, traits: string[] = []) => definePrinted({ code, name: code, type: "hero", sphere, threat, willpower: 1, attack: 1, defense: 1, health: 5, traits });
const ally = (code: string, sphere: Sphere, traits: string[]) => definePrinted({ code, name: code, type: "ally", sphere, cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits });

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([IMRAHIL, KNIGHT, SOLDIER, SULIEN, PRESENCE, GUARDIAN, SPEAR, PRINCE_OF_DOL_AMROTH, IMRAHIL_HERO, IMRAHIL_ALLY, SPEARMAN, LOSSARNACH]))]);
  const made = [
    hero(LEAD, "leadership"), hero(TAC, "tactics"), hero(SPI, "spirit"), hero(LORE, "lore"), hero(RANGER_HERO, "lore", 8, ["Ranger"]),
    hero("spi-12", "spirit", 12), hero("lead-7", "leadership", 7), hero("tac-12", "tactics", 12),
    ally(RANGER_ALLY, "lore", ["Ranger"]), ally(GONDOR_ALLY, "tactics", ["Gondor"]), ally(WARRIOR_ALLY, "tactics", ["Warrior"]), ally(NOBLE_ALLY, "tactics", ["Noble"]), ally(ROHAN_ALLY, "tactics", ["Rohan"]),
    ...Object.entries(OUTLANDS).map(([sphere, code]) => ally(code, sphere as Sphere, ["Outlands"])),
  ];
  for (const card of made) cards.set(card.code, card);
  cards.set(GONDOR_GEAR, definePrinted({ code: GONDOR_GEAR, name: "Gondor Gear", type: "attachment", sphere: "tactics", cost: 1, traits: ["Gondor"] }));
  cards.set(SNARE, definePrinted({ code: SNARE, name: "Snare", type: "attachment", sphere: "lore", cost: 0 }));
  cards.set(MARSH, definePrinted({ code: MARSH, name: "Marsh", type: "location", threat: 2, questPoints: 4 }));
  cards.set(HILL, definePrinted({ code: HILL, name: "Hill", type: "location", threat: 3, questPoints: 4 }));
  for (const code of [WALL, WALL_TWO, WALL_THREE]) cards.set(code, definePrinted({ code, name: code, type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 20 }));
  base = { ...starter, cards };
});

describe("Prince Imrahil (12138:A:1)", () => {
  // Imrahil and the Leadership hero, an enemy engaged; the deck's top 5: a Gondor ally, a Rohan ally, a Warrior ally, a Gondor attachment
  // and a filler; the sixth card a Noble ally.
  function imrahil(effects: readonly Effect[]): Table {
    const deck = [GONDOR_ALLY, ROHAN_ALLY, WARRIOR_ALLY, GONDOR_GEAR, CARD, NOBLE_ALLY].map((code) => ({ code, seat: 0 }));
    return table(effects, { heroes: [{ code: IMRAHIL, seat: 0 }, { code: LEAD, seat: 0 }], engaged: [{ code: WALL, seat: 0 }], playerDeck: deck });
  }

  // "Combat Action: Spend 1 resource from Prince Imrahil's resource pool to search the top 5 cards of your deck for an ally who shares at
  // least 1 Trait with him, and put that ally into play. Shuffle your deck. At the end of the phase, if that ally is still in play, shuffle
  // it into your deck. (Limit once per round.)": in the combat phase the Gondor and Warrior allies of the top 5 are offered (not the Rohan
  // ally, the Gondor attachment or the sixth card); the Gondor ally comes into play, Imrahil pays 1, the deck is shuffled, the Action is
  // not offered again this round, and at the end of the combat phase the ally is back in the deck.
  it("12138:A:1 Prince Imrahil: puts an ally of the top 5 that shares a Trait with him into play until the end of the phase, once a round", () => {
    const tab = imrahil(EFFECTS);
    const [prince, gondor] = [idsOf(tab, IMRAHIL), idsOf(tab, GONDOR_ALLY)];
    const rest = (tab.state.seats[0]?.deck ?? []).filter((id) => id !== gondor);
    expect(triggers(tab.state, tab)).not.toContain("12138:action:1");
    let run = combat(tab.state, tab);
    expect(triggers(run.state, tab)).toContain("12138:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: prince, effectId: "12138:action:1", payments: [{ heroId: prince, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([gondor, idsOf(tab, WARRIOR_ALLY)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gondor }, tab.ctx);
    expect(run.state.cards[gondor]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[prince]?.resources).toBe(6 - 1);
    expect(run.state.seats[0]?.deck).not.toEqual(rest);
    expect(triggers(run.state, tab)).not.toContain("12138:action:1");
    const ended = enter(run.state, tab, "refresh");
    // The round runs on to the next resource phase, whose draw takes the top card.
    expect(ended.state.cards[gondor]?.zone).toBe("deck");
    expect(ended.state.seats[0]?.deck).toContain(gondor);
    expect((ended.state.seats[0]?.deck.length ?? 0) + (ended.state.seats[0]?.hand.length ?? 0)).toBe(6);
  });

  // The cost is paid from Imrahil's own pool: a payment from the other hero is refused.
  it("12138:A:1 Prince Imrahil: the resource comes from his own pool", () => {
    const tab = imrahil(EFFECTS);
    const run = combat(tab.state, tab);
    expect(refusal(run.state, { type: "Trigger", cardId: idsOf(tab, IMRAHIL), effectId: "12138:action:1", payments: [{ heroId: idsOf(tab, LEAD), amount: 1 }] }, tab.ctx)).not.toBeNull();
  });
});

describe("Knight of the White Tower (12139:A:1)", () => {
  // "Knight of the White Tower's resource cost must be paid from a single hero's resource pool.": two Leadership heroes with 2 each cannot
  // pay its 4 together; one Leadership hero with 4 pays it alone.
  lineSpec("12139:A:1", "Knight of the White Tower: its cost is paid from a single hero's pool", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEAD, seat: 0 }, { code: LEAD, seat: 0 }], hand: [{ code: KNIGHT, seat: 0 }] }, 2);
    const [first = "", second = ""] = tab.ids[LEAD] ?? [];
    const knight = idsOf(tab, KNIGHT);
    expect(refusal(tab.state, { type: "PlayCard", cardId: knight, payments: [{ heroId: first, amount: 2 }, { heroId: second, amount: 2 }] }, tab.ctx)).not.toBeNull();
    const rich = updateCard(tab.state, first, { resources: 4 });
    const run = sendUnledgered(begin(rich), { type: "PlayCard", cardId: knight, payments: [{ heroId: first, amount: 4 }] }, tab.ctx);
    expect(run.state.cards[knight]?.zone).toBe("play");
    expect(run.state.cards[first]?.resources).toBe(0);
    expect(run.state.cards[second]?.resources).toBe(2);
  });
});

describe("Soldier of Dol Amroth (12141:A:1)", () => {
  // The Soldier played from the hand by the Tactics hero, its Response taken; two Gondorian Spearmen (Tactics, cost 2) and a Leadership
  // ally (cost 1) in hand.
  function soldiered(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: TAC, seat: 0 }, { code: LEAD, seat: 0 }], hand: [{ code: SOLDIER, seat: 0 }, { code: SPEARMAN, seat: 0 }, { code: SPEARMAN, seat: 0 }, { code: ALLY, seat: 0 }] });
    let run = play(begin(tab.state), tab, idsOf(tab, SOLDIER));
    expect(triggers(run.state, tab)).toContain("12141:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, SOLDIER), effectId: "12141:response:1" }, tab.ctx);
    return { tab, run };
  }

  // "Response: After Soldier of Dol Amroth enters play, reduce the cost of the next Tactics card you play this phase by 1.": a Spearman
  // costs 1, the Leadership ally keeps its 1; once one Spearman is played, the other costs 2 again.
  lineSpec("12141:A:1", "Soldier of Dol Amroth: after it enters play, the next Tactics card you play this phase costs 1 less", (effects) => {
    const { tab, run } = soldiered(effects);
    const [first = "", second = ""] = tab.ids[SPEARMAN] ?? [];
    expect(playCost(run.state, first, 0, tab.ctx)).toBe(1);
    expect(playCost(run.state, idsOf(tab, ALLY), 0, tab.ctx)).toBe(1);
    const next = play(run, tab, first);
    expect(next.state.cards[first]?.zone).toBe("play");
    expect(playCost(next.state, second, 0, tab.ctx)).toBe(2);
  });

  // "this phase": the reduction is gone in the quest phase.
  it("12141:A:1 Soldier of Dol Amroth: the reduction ends with the phase", () => {
    const { tab, run } = soldiered(EFFECTS);
    expect(playCost(enter(run.state, tab, "questCommit").state, idsOf(tab, SPEARMAN), 0, tab.ctx)).toBe(2);
  });
});

describe("Súlien (12142:A:1)", () => {
  // Súlien in play for the first player; the first player's Spirit hero and the second player's Lore hero; two locations in the
  // staging area and one active.
  function scene(effects: readonly Effect[]): Table {
    return table(effects, { seats: 2, heroes: [{ code: SPI, seat: 0 }, { code: LORE, seat: 1 }], allies: [{ code: SULIEN, seat: 0 }], staging: [MARSH, HILL], active: MARSH });
  }

  // "Action: Spend 1 Lore resource to exhaust Súlien. Then, each location in the staging area gets –1 Threat until the end of the phase.
  // Any player may trigger this action.": the first player passes, the second player triggers it with his Lore hero's resource; Súlien
  // exhausts, both staging locations get -1 Threat, the active location does not, and in the quest phase they are back to printed.
  lineSpec("12142:A:1", "Súlien: any player spends a Lore resource to exhaust her, then the staging locations get -1 Threat this phase", (effects) => {
    const tab = scene(effects);
    const [sulien, lore] = [idsOf(tab, SULIEN), idsOf(tab, LORE)];
    const [marsh = "", active = ""] = tab.ids[MARSH] ?? [];
    const hill = idsOf(tab, HILL);
    let run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    expect(triggers(run.state, tab)).toContain("12142:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: sulien, effectId: "12142:action:1", payments: [{ heroId: lore, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[sulien]?.exhausted).toBe(true);
    expect(run.state.cards[lore]?.resources).toBe(6 - 1);
    expect(stat(run.state, tab, marsh, "threat")).toBe(2 - 1);
    expect(stat(run.state, tab, hill, "threat")).toBe(3 - 1);
    expect(stat(run.state, tab, active, "threat")).toBe(2);
    const quest = enter(run.state, tab, "questCommit").state;
    expect(stat(quest, tab, marsh, "threat")).toBe(2);
  });

  // "Spend 1 Lore resource": the Spirit hero's resource cannot pay it.
  it("12142:A:1 Súlien: a resource that is not Lore cannot pay", () => {
    const tab = scene(EFFECTS);
    expect(refusal(tab.state, { type: "Trigger", cardId: idsOf(tab, SULIEN), effectId: "12142:action:1", payments: [{ heroId: idsOf(tab, SPI), amount: 1 }] }, tab.ctx)).not.toBeNull();
  });

  // "Then" (rr.then): an exhausted Súlien cannot be exhausted, so the Threat reduction cannot follow; the Action is not offered.
  it("12142:A:1 Súlien: not offered while she is exhausted", () => {
    const tab = scene(EFFECTS);
    const state = updateCard(tab.state, idsOf(tab, SULIEN), { exhausted: true });
    const run = sendUnledgered(begin(state), { type: "Pass" }, tab.ctx);
    expect(triggers(state, tab)).not.toContain("12142:action:1");
    expect(triggers(run.state, tab)).not.toContain("12142:action:1");
  });
});

describe("Inspiring Presence (12143:A:1)", () => {
  // The first player's Spirit hero (threat cost 12) and Leadership hero (threat cost 8), the second player's Leadership hero (threat cost 7)
  // and Tactics hero (threat cost 12); Inspiring Presence in the first player's hand.
  function presence(effects: readonly Effect[]) {
    const tab = table(effects, { seats: 2, heroes: [{ code: "spi-12", seat: 0 }, { code: LEAD, seat: 0 }, { code: "lead-7", seat: 1 }, { code: "tac-12", seat: 1 }], hand: [{ code: PRESENCE, seat: 0 }] });
    return { tab, high: idsOf(tab, "spi-12"), mid: idsOf(tab, LEAD), low: idsOf(tab, "lead-7"), equal: idsOf(tab, "tac-12") };
  }

  // "Action: Choose a hero you control. Each hero with lower threat cost than the chosen hero gets +2 Defense until the end of the phase.
  // Then, the players as a group may spend 2 Leadership resources to give +2 Attack to each hero with lower threat cost than the chosen
  // hero until the end of the phase.": the Spirit hero (12) is chosen from the first player's two; the two heroes of lower threat cost,
  // of either player, get +2 Defense; the other 12 does not. The 2 Leadership resources are spent, one from each player's Leadership
  // hero, and the same two get +2 Attack. In the quest phase every bonus is gone.
  it("12143:A:1 Inspiring Presence: +2 Defense, and +2 Attack for 2 Leadership resources, to each hero of lower threat cost", () => {
    const { tab, high, mid, low, equal } = presence(EFFECTS);
    let run = play(begin(tab.state), tab, idsOf(tab, PRESENCE));
    expect(choices(run.state, tab).sort()).toEqual([high, mid].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: high }, tab.ctx);
    expect([high, mid, low, equal].map((id) => stat(run.state, tab, id, "defense"))).toEqual([1, 3, 3, 1]);
    expect(choices(run.state, tab)).toEqual(expect.arrayContaining(["spend", "decline"]));
    run = sendUnledgered(run, { type: "Choose", optionId: "spend" }, tab.ctx);
    // One resource at a time, from either player's Leadership hero.
    for (const payer of [mid, low]) {
      expect(choices(run.state, tab).sort()).toEqual([mid, low].sort());
      run = sendUnledgered(run, { type: "Choose", optionId: payer }, tab.ctx);
    }
    expect(run.state.window?.kind).not.toBe("choose");
    expect([mid, low].map((id) => run.state.cards[id]?.resources)).toEqual([5, 5]);
    expect([high, mid, low, equal].map((id) => stat(run.state, tab, id, "attack"))).toEqual([1, 3, 3, 1]);
    const quest = enter(run.state, tab, "questCommit").state;
    expect([mid, low].map((id) => [stat(quest, tab, id, "defense"), stat(quest, tab, id, "attack")])).toEqual([[1, 1], [1, 1]]);
  });

  // "may": declined, nothing is spent and no hero gets the Attack.
  it("12143:A:1 Inspiring Presence: the players may decline the Attack", () => {
    const { tab, high, mid, low } = presence(EFFECTS);
    let run = play(begin(tab.state), tab, idsOf(tab, PRESENCE));
    run = sendUnledgered(run, { type: "Choose", optionId: high }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "decline" }, tab.ctx);
    expect([mid, low].map((id) => [run.state.cards[id]?.resources, stat(run.state, tab, id, "attack")])).toEqual([[6, 1], [6, 1]]);
  });
});

describe("Guardian of Ithilien (12144:A:1)", () => {
  // "Response: After Guardian of Ithilien enters play, return an enemy engaged with you to the staging area.": two enemies are engaged with
  // the first player and one with the second; the first player's two are offered, the chosen one goes to the staging area.
  it("12144:A:1 Guardian of Ithilien: after it enters play, an enemy engaged with you returns to the staging area", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: LORE, seat: 0 }, { code: LEAD, seat: 1 }], hand: [{ code: GUARDIAN, seat: 0 }], engaged: [{ code: WALL, seat: 0 }, { code: WALL_TWO, seat: 0 }, { code: WALL_THREE, seat: 1 }] });
    const [wall, two, three, guardian] = [idsOf(tab, WALL), idsOf(tab, WALL_TWO), idsOf(tab, WALL_THREE), idsOf(tab, GUARDIAN)];
    let run = play(begin(tab.state), tab, guardian);
    expect(triggers(run.state, tab)).toContain("12144:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: guardian, effectId: "12144:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([wall, two].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: two }, tab.ctx);
    expect(run.state.cards[two]?.zone).toBe("staging");
    expect(run.state.cards[wall]?.zone).toBe("engaged");
    expect(run.state.cards[three]?.zone).toBe("engaged");
  });

  // No enemy is engaged with the first player (one is with the second): the Response is not offered.
  it("12144:A:1 Guardian of Ithilien: no Response when no enemy is engaged with you", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: LORE, seat: 0 }, { code: LEAD, seat: 1 }], hand: [{ code: GUARDIAN, seat: 0 }], engaged: [{ code: WALL_THREE, seat: 1 }] });
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, GUARDIAN)).state, tab)).not.toContain("12144:response:1");
  });
});

describe("Ranger Spear (12145:A:1, A:2)", () => {
  // "Attach to a Ranger character. Restricted.": the Ranger hero and the Ranger ally are offered, the Lore hero is not.
  lineSpec("12145:A:1", "Ranger Spear: Attach to a Ranger character", (effects) => {
    const tab = table(effects, { heroes: [{ code: RANGER_HERO, seat: 0 }, { code: LORE, seat: 0 }], allies: [{ code: RANGER_ALLY, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }] });
    const spear = idsOf(tab, SPEAR);
    expect(hosts(tab, spear)).toEqual([idsOf(tab, RANGER_HERO), idsOf(tab, RANGER_ALLY)].sort());
    expect(play(begin(tab.state), tab, spear, idsOf(tab, RANGER_ALLY)).state.cards[spear]?.host).toBe(idsOf(tab, RANGER_ALLY));
  });

  // The Ranger hero holds the Spear; two enemies are engaged, the second with a player attachment on it. The Attack of the strike when
  // the hero attacks `target` alone.
  function strike(effects: readonly Effect[], target: "plain" | "snared"): number[] {
    const start = table(effects, { heroes: [{ code: RANGER_HERO, seat: 0 }], attached: [{ code: SPEAR, host: RANGER_HERO }], engaged: [{ code: WALL, seat: 0 }, { code: WALL_TWO, seat: 0 }], allies: [{ code: SNARE, seat: 0 }] });
    const tab = attach(start, [[idsOf(start, SNARE), idsOf(start, WALL_TWO)]]);
    const enemyId = idsOf(tab, target === "plain" ? WALL : WALL_TWO);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId, attackerIds: [idsOf(tab, RANGER_HERO)] }, tab.ctx);
    return run.steps.flatMap((step) => (step.kind === "strike" && step.side === "player" ? [step.attack] : []));
  }

  // "Attached character gets +1 Attack (+2 Attack instead when attacking an enemy with an attachment on it).": Attack 2 outside an attack
  // and against the plain enemy, 3 against the enemy with an attachment.
  lineSpec("12145:A:2", "Ranger Spear: +1 Attack, +2 instead when attacking an enemy with an attachment", (effects) => {
    const tab = table(effects, { heroes: [{ code: RANGER_HERO, seat: 0 }], attached: [{ code: SPEAR, host: RANGER_HERO }] });
    expect(stat(tab.state, tab, idsOf(tab, RANGER_HERO), "attack")).toBe(1 + 1);
    expect(strike(effects, "plain")).toEqual([1 + 1]);
    expect(strike(effects, "snared")).toEqual([1 + 2]);
  });
});

describe("Prince of Dol Amroth (12146:A:1, A:2, A:3)", () => {
  // "Attach to Prince Imrahil.": the three Prince Imrahil cards (two heroes, one ally) are offered, the Tactics hero is not.
  lineSpec("12146:A:1", "Prince of Dol Amroth: Attach to Prince Imrahil", (effects) => {
    const tab = table(effects, { heroes: [{ code: IMRAHIL, seat: 0 }, { code: IMRAHIL_HERO, seat: 0 }, { code: TAC, seat: 0 }], allies: [{ code: IMRAHIL_ALLY, seat: 0 }], hand: [{ code: PRINCE_OF_DOL_AMROTH, seat: 0 }] });
    const title = idsOf(tab, PRINCE_OF_DOL_AMROTH);
    expect(hosts(tab, title)).toEqual([idsOf(tab, IMRAHIL), idsOf(tab, IMRAHIL_HERO), idsOf(tab, IMRAHIL_ALLY)].sort());
    expect(play(begin(tab.state), tab, title, idsOf(tab, IMRAHIL)).state.cards[title]?.host).toBe(idsOf(tab, IMRAHIL));
  });

  // "Price Imrahil gains the Outlands trait.": played on Imrahil, he is Outlands in the state that play returns, and the Warrior of
  // Lossarnach ("Each Outlands character you control gets +1 Defense") raises his Defense.
  lineSpec("12146:A:2", "Prince of Dol Amroth: Imrahil gains the Outlands trait", (effects) => {
    const tab = table(effects, { heroes: [{ code: IMRAHIL, seat: 0 }], allies: [{ code: LOSSARNACH, seat: 0 }], hand: [{ code: PRINCE_OF_DOL_AMROTH, seat: 0 }] });
    const prince = idsOf(tab, IMRAHIL);
    const defense = stat(tab.state, tab, prince, "defense");
    const run = play(begin(tab.state), tab, idsOf(tab, PRINCE_OF_DOL_AMROTH), prince);
    expect(hasTrait(run.state, prince, "Outlands", tab.ctx)).toBe(true);
    expect(stat(run.state, tab, prince, "defense")).toBe(defense + 1);
  });

  // The resource phase with Imrahil (Prince of Dol Amroth attached) and the Leadership hero, each with no resource, and Outlands allies of
  // `spheres` for the first seat (and of the rest for the second seat): the resources each hero holds after the gain step.
  function collected(effects: readonly Effect[], spheres: readonly (keyof typeof OUTLANDS)[], others: readonly (keyof typeof OUTLANDS)[] = []): number[] {
    const allies = [...spheres.map((sphere) => ({ code: OUTLANDS[sphere], seat: 0 })), ...others.map((sphere) => ({ code: OUTLANDS[sphere], seat: 1 }))];
    const tab = table(effects, { seats: 2, heroes: [{ code: IMRAHIL, seat: 0 }, { code: LEAD, seat: 0 }, { code: TAC, seat: 1 }], attached: [{ code: PRINCE_OF_DOL_AMROTH, host: IMRAHIL }], allies, playerDeck: [...fillers(CARD, 2, 0), ...fillers(CARD, 2, 1)] }, 0);
    const run = enter(tab.state, tab, "resourceGrant");
    return [IMRAHIL, LEAD].map((code) => run.state.cards[idsOf(tab, code)]?.resources ?? 0);
  }

  // "While you control Outlands allies that belong to 4 different spheres, add 1 additional resource to Prince Imrahil's resource pool when
  // you collect resources during the resource phase (if Prince Imrahil is a hero).": with Outlands allies of the four spheres Imrahil
  // collects 2 and the other hero 1; with three spheres he collects 1.
  lineSpec("12146:A:3", "Prince of Dol Amroth: Imrahil collects 1 more resource with Outlands allies of 4 spheres", (effects) => {
    expect(collected(effects, ["leadership", "tactics", "spirit", "lore"])).toEqual([2, 1]);
    expect(collected(effects, ["leadership", "tactics", "spirit"])).toEqual([1, 1]);
  });

  // "you control": the other player's Lore Outlands ally does not make the fourth sphere.
  it("12146:A:3 Prince of Dol Amroth: another player's Outlands ally is not counted", () => {
    expect(collected(EFFECTS, ["leadership", "tactics", "spirit"], ["lore"])).toEqual([1, 1]);
  });
});
