// Rules: emce.treasure, rr.action, rr.response, rr.cost, rr.triggered-ability, rr.cancel, rr.then, rr.shadow-effects, rr.lasting-effects,
// rr.resources, rr.drawing-cards, rr.staging-area (data/rules/entries.json). The Actions and Responses of the Ered Mithrin treasures in
// play, each tested from the line read from its scan (data/printed/ered-mithrin.json; lineSpec, test/harness/line-spec.ts): Anvil of
// Gundabad 12196:A:3, Dwarf-Lord's Crown 12199:A:2, Gondolin Shield 12201:A:3, Helm of Heroes 12202:A:3, Jewels of Wilderland 12203:A:3,
// Masterwork Bow 12204:A:3. Each treasure is on its character as the claim leaves it (emce.treasure: "the players claim it and may use it").
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { shadowCards } from "../../rules/core/zones.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, combat, passAll, playerTable, stat, triggers, type PlayerBase } from "../../../test/harness/player-table.ts";

const ANVIL = "12196";
const CROWN = "12199";
const SHIELD = "12201";
const HELM = "12202";
const JEWELS = "12203";
const BOW = "12204";
// Core heroes: Gimli (Dwarf Noble Warrior, Tactics, Attack 2, Defense 2, 5 hit points) and Legolas (Tactics).
const GIMLI = "01004";
const LEGOLAS = "01005";
// Core allies: Veteran Axehand (Dwarf Warrior), Snowbourn Scout (Rohan Scout), Longbeard Orc Slayer (Dwarf Warrior).
const AXEHAND = "01028";
const SCOUT = "01016";
const SLAYER = "01018";
// Core attachments: Blade of Gondolin (Tactics Item, cost 1, "Attach to a hero."), Citadel Plate (Tactics Item, cost 4), Steward of Gondor
// (Leadership Title).
const BLADE = "01039";
const PLATE = "01040";
const STEWARD = "01026";
// A Shadow of the Past cards: Eaten Alive! ("Shadow: Deal 1 damage to defending character."), Lure of the Ring ("Shadow: Attacking enemy
// gets +1 Attack (+2 Attack instead if The One Ring is exhausted).", no Ring here), Bag End, Woody End and Stock-Brook (locations).
const EATEN = "141082";
const LURE = "141076";
const BAG_END = "141031";
const WOODY_END = "141032";
const STOCK_BROOK = "141033";
const PAL = "pal";
const CARD = "card";
// Stand-in enemies: Weak (Attack 1, Defense 0, 9 hit points), Strong (Attack 6), Frail (Defense 0, 3 hit points).
const WEAK = "weak";
const STRONG = "strong";
const FRAIL = "frail";

let base: PlayerBase;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);
const trigger = (run: Run, tab: Table, code: string, effectId: string): Run => send(run, { type: "Trigger", cardId: idsOf(tab, code), effectId }, tab.ctx);
const resourcesOf = (run: Run, tab: Table, codes: readonly string[]) => codes.map((code) => run.state.cards[idsOf(tab, code)]?.resources ?? 0);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ANVIL, CROWN, SHIELD, HELM, JEWELS, BOW, GIMLI, LEGOLAS, AXEHAND, SCOUT, SLAYER, BLADE, PLATE, STEWARD, EATEN, LURE, BAG_END, WOODY_END, STOCK_BROOK];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  cards.set(STRONG, definePrinted({ code: STRONG, name: "Strong", type: "enemy", threat: 1, engagementCost: 30, attack: 6, defense: 0, health: 9 }));
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 3 }));
  base = { ...starter, cards };
});

describe("Anvil of Gundabad (12196:A:3)", () => {
  // Gimli holds the Anvil; Legolas beside him; `hand` in the hand.
  const anvil = (effects: readonly Effect[], hand: readonly string[]) => table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: ANVIL, host: GIMLI }], hand: hand.map((code) => ({ code, seat: 0 })) });

  // "Action: Exhaust Anvil of Gundabad and attached character to play an Item attachment from your hand, reducing its cost by 1.": Citadel
  // Plate (cost 4) is played onto Legolas for 3, paid from his pool; the Anvil and Gimli are exhausted. Steward of Gondor (a Title) stays in the hand.
  lineSpec("12196:A:3", "Anvil of Gundabad: exhaust it and its character to play an Item attachment for 1 less", (effects) => {
    const tab = anvil(effects, [PLATE, STEWARD]);
    expect(triggers(tab.state, tab)).toContain("12196:action:1");
    let run = trigger(begin(tab.state), tab, ANVIL, "12196:action:1");
    // The Plate is the only Item attachment in the hand: the player is asked for its hero, then for the pool each resource is paid from.
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, GIMLI), idsOf(tab, LEGOLAS)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, LEGOLAS) }, tab.ctx);
    for (let paid = 0; paid < 4 && run.state.window?.kind === "choose"; paid += 1) run = send(run, { type: "Choose", optionId: idsOf(tab, LEGOLAS) }, tab.ctx);
    run = passAll(run, tab.ctx);
    expect(run.state.cards[idsOf(tab, PLATE)]?.host).toBe(idsOf(tab, LEGOLAS));
    expect(run.state.cards[idsOf(tab, STEWARD)]?.zone).toBe("hand");
    expect(resourcesOf(run, tab, [GIMLI, LEGOLAS])).toEqual([6, 6 - (4 - 1)]);
    expect(run.state.cards[idsOf(tab, ANVIL)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, GIMLI)]?.exhausted).toBe(true);
  });

  it("12196:A:3 Anvil of Gundabad: not offered with no Item attachment in the hand", () => {
    const tab = anvil(EFFECTS, [STEWARD]);
    expect(triggers(tab.state, tab)).not.toContain("12196:action:1");
  });

  // The cost exhausts the attached character: with Gimli exhausted it cannot be paid.
  it("12196:A:3 Anvil of Gundabad: not offered while the attached character is exhausted", () => {
    const tab = anvil(EFFECTS, [BLADE]);
    const state = updateCard(tab.state, idsOf(tab, GIMLI), { exhausted: true });
    expect(triggers(state, tab)).not.toContain("12196:action:1");
  });
});

describe("Dwarf-Lord's Crown (12199:A:2)", () => {
  // "Action: Exhaust Dwarf-Lord's Crown to give each ally that shares a Trait with attached hero +1 Willpower, +1 Attack, and +1 Defense
  // until the end of the phase.": Gimli (Dwarf, Noble, Warrior) holds it. The Veteran Axehand (Dwarf Warrior) and the other player's
  // Longbeard Orc Slayer (Dwarf Warrior) get +1 to each; the Snowbourn Scout (Rohan Scout) and Gimli, a hero, do not. When the planning
  // phase ends the bonus is gone.
  lineSpec("12199:A:2", "Dwarf-Lord's Crown: each ally that shares a Trait with the hero gets +1 Willpower, Attack and Defense this phase", (effects) => {
    const made = table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: CROWN, host: GIMLI }], allies: [{ code: AXEHAND, seat: 0 }, { code: SCOUT, seat: 0 }, { code: SLAYER, seat: 1 }] });
    const keys = ["willpower", "attack", "defense"] as const;
    const read = (run: Run, code: string) => keys.map((key) => stat(run.state, made, idsOf(made, code), key));
    const before = begin(made.state);
    const run = trigger(before, made, CROWN, "12199:action:1");
    expect(run.state.cards[idsOf(made, CROWN)]?.exhausted).toBe(true);
    for (const code of [AXEHAND, SLAYER]) expect(read(run, code)).toEqual(read(before, code).map((value) => value + 1));
    for (const code of [SCOUT, GIMLI]) expect(read(run, code)).toEqual(read(before, code));
    const later = combat(run.state, made);
    for (const code of [AXEHAND, SLAYER]) expect(read(later, code)).toEqual(read(before, code));
  });

  // With no ally that shares a Trait with Gimli (only the Scout) the Action can change nothing: it is not offered (rr.triggered-ability).
  it("12199:A:2 Dwarf-Lord's Crown: not offered when no ally shares a Trait with the attached hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: CROWN, host: GIMLI }], allies: [{ code: SCOUT, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("12199:action:1");
  });
});

describe("Gondolin Shield (12201:A:3)", () => {
  // The Weak attacks with Eaten Alive! as its shadow card and Lure of the Ring next in the encounter deck; the Shield is on `holder` (put in
  // play by the scene's allies row, then attached); `defender` is declared and the shadow card is about to resolve.
  function defended(effects: readonly Effect[], defender: string, holder: string = GIMLI): { tab: Table; run: Run } {
    const made = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: AXEHAND, seat: 0 }, { code: SHIELD, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], deck: [EATEN, LURE] });
    const tab = attach(made, [[idsOf(made, SHIELD), idsOf(made, holder)]]);
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(send(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx);
    return { tab, run };
  }

  // "Response: Exhaust Gondolin Shield and spend 1 resource to cancel a shadow effect just triggered during an attack that attached character
  // is defending. Then, deal the attacking enemy another shadow card.": Gimli defends; the Shield is exhausted, 1 resource is spent, Eaten
  // Alive! deals Gimli no damage (the Weak's Attack 1 against his Defense 3 deals none either), and Lure of the Ring is dealt to the Weak.
  lineSpec("12201:A:3", "Gondolin Shield: exhaust it and spend 1 resource to cancel a shadow effect, then deal another shadow card", (effects) => {
    const { tab, run: pending } = defended(effects, GIMLI);
    expect(triggers(pending.state, tab)).toContain("12201:response:1");
    const paid = send(pending, { type: "Trigger", cardId: idsOf(tab, SHIELD), effectId: "12201:response:1", payments: [{ heroId: idsOf(tab, GIMLI), amount: 1 }] }, tab.ctx);
    const run = passAll(paid, tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, SHIELD)]?.exhausted).toBe(true);
    expect(resourcesOf(run, tab, [GIMLI, LEGOLAS])).toEqual([6 - 1, 6]);
    expect(run.state.cards[idsOf(tab, GIMLI)]?.damage ?? 0).toBe(0);
    expect(shadowCards(run.state.cards[idsOf(tab, WEAK)])).toEqual([idsOf(tab, EATEN), idsOf(tab, LURE)]);
  });

  // "an attack that attached character is defending": Legolas defends; the Shield offers no Response and Eaten Alive! deals him 1 damage.
  it("12201:A:3 Gondolin Shield: no Response while another character defends", () => {
    const { tab, run: pending } = defended(EFFECTS, LEGOLAS);
    expect(triggers(pending.state, tab)).not.toContain("12201:response:1");
    const run = passAll(pending, tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.damage).toBeGreaterThanOrEqual(1);
  });

  // The cost "spend 1 resource" names no pool: with no resource on any hero it cannot be paid, so no Response.
  it("12201:A:3 Gondolin Shield: not offered with no resource to spend", () => {
    const made = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: SHIELD, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], deck: [EATEN, LURE] }, 0);
    const tab = attach(made, [[idsOf(made, SHIELD), idsOf(made, GIMLI)]]);
    let run = passAll(combat(tab.state, tab), tab.ctx);
    run = passAll(send(run, { type: "DeclareDefender", defenderId: idsOf(tab, GIMLI) }, tab.ctx), tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("12201:response:1");
  });

  it("12201:A:3 Gondolin Shield: on an ally that defends, the resource is spent from a hero's pool", () => {
    const { tab, run: pending } = defended(EFFECTS, AXEHAND, AXEHAND);
    expect(triggers(pending.state, tab)).toContain("12201:response:1");
    const paid = send(pending, { type: "Trigger", cardId: idsOf(tab, SHIELD), effectId: "12201:response:1", payments: [{ heroId: idsOf(tab, GIMLI), amount: 1 }] }, tab.ctx);
    expect(resourcesOf(passAll(paid, tab.ctx, { responses: true }), tab, [GIMLI, LEGOLAS])).toEqual([6 - 1, 6]);
  });
});

describe("Helm of Heroes (12202:A:3)", () => {
  // Gimli holds the Helm (Defense 2 + 2) and defends `enemy`; two players, the other with the Pal.
  function defended(effects: readonly Effect[], enemy: string): { tab: Table; run: Run } {
    const tab = table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: HELM, host: GIMLI }], engaged: [{ code: enemy, seat: 0 }] });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 0 });
    run = passAll(send(run, { type: "DeclareDefender", defenderId: idsOf(tab, GIMLI) }, tab.ctx), tab.ctx);
    return { tab, run };
  }

  // "Response: After attached character takes 1 or more damage from an enemy's attack, add 1 resource to any hero's resource pool.": the
  // Strong (Attack 6) deals Gimli (Defense 4) 2 damage; the Response adds 1 resource to the other player's hero ("any hero").
  lineSpec("12202:A:3", "Helm of Heroes: after the attached character takes damage from an attack, 1 resource to any hero", (effects) => {
    const { tab, run: hit } = defended(effects, STRONG);
    expect(hit.state.cards[idsOf(tab, GIMLI)]?.damage).toBe(6 - 4);
    expect(triggers(hit.state, tab)).toContain("12202:response:1");
    let run = trigger(hit, tab, HELM, "12202:response:1");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, GIMLI), idsOf(tab, LEGOLAS), idsOf(tab, PAL)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, PAL) }, tab.ctx);
    expect(resourcesOf(run, tab, [GIMLI, LEGOLAS, PAL])).toEqual([6, 6, 6 + 1]);
  });

  // The Weak (Attack 1) deals Gimli no damage: no Response.
  it("12202:A:3 Helm of Heroes: not offered after an attack that deals no damage", () => {
    const { tab, run } = defended(EFFECTS, WEAK);
    expect(run.state.cards[idsOf(tab, GIMLI)]?.damage ?? 0).toBe(0);
    expect(triggers(run.state, tab)).not.toContain("12202:response:1");
  });
});

describe("Jewels of Wilderland (12203:A:3)", () => {
  // "Action: Exhaust Jewels of Wilderland and discard a card from your hand to draw a card.": with the Card and the Snowbourn Scout in hand
  // the player discards the Card and draws Blade of Gondolin; the Jewels are exhausted.
  lineSpec("12203:A:3", "Jewels of Wilderland: exhaust them and discard a card to draw a card", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: JEWELS, host: GIMLI }], hand: [{ code: CARD, seat: 0 }, { code: SCOUT, seat: 0 }], playerDeck: [{ code: BLADE, seat: 0 }] });
    let run = trigger(begin(tab.state), tab, JEWELS, "12203:action:1");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, CARD), idsOf(tab, SCOUT)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, CARD) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, CARD)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, BLADE)]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, SCOUT)]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, JEWELS)]?.exhausted).toBe(true);
  });

  // With an empty hand there is no card to discard: no Action.
  it("12203:A:3 Jewels of Wilderland: not offered with an empty hand", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: JEWELS, host: GIMLI }], playerDeck: [{ code: BLADE, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("12203:action:1");
  });
});

describe("Masterwork Bow (12204:A:3)", () => {
  // Gimli holds the Bow (Attack 2 + 1) and attacks `enemy`; `staging` in the staging area, Stock-Brook the active location.
  function attacked(effects: readonly Effect[], enemy: string, staging: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: BOW, host: GIMLI }], engaged: [{ code: enemy, seat: 0 }], staging, active: STOCK_BROOK });
    return { tab, run: passAll(send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, enemy), attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx), tab.ctx) };
  }

  // "Response: After attached character attacks and defeats an enemy, place 1 progress on a location in the staging area.": Gimli's 3 Attack
  // destroys the Frail (3 hit points); Bag End and Woody End in the staging area are offered, the active Stock-Brook is not; Woody End gets 1.
  lineSpec("12204:A:3", "Masterwork Bow: after the attached character defeats an enemy, 1 progress on a location in the staging area", (effects) => {
    const { tab, run: won } = attacked(effects, FRAIL, [BAG_END, WOODY_END]);
    expect(won.state.cards[idsOf(tab, FRAIL)]?.zone).toBe("encounterDiscard");
    expect(triggers(won.state, tab)).toContain("12204:response:1");
    let run = trigger(won, tab, BOW, "12204:response:1");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, BAG_END), idsOf(tab, WOODY_END)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, WOODY_END) }, tab.ctx);
    expect([BAG_END, WOODY_END, STOCK_BROOK].map((code) => run.state.cards[idsOf(tab, code)]?.progress ?? 0)).toEqual([0, 1, 0]);
  });

  // The Weak (9 hit points) survives the attack: no Response.
  it("12204:A:3 Masterwork Bow: not offered after an attack that defeats no enemy", () => {
    const { tab, run } = attacked(EFFECTS, WEAK, [BAG_END]);
    expect(run.state.cards[idsOf(tab, WEAK)]?.damage).toBe(3);
    expect(triggers(run.state, tab)).not.toContain("12204:response:1");
  });

  // With no location in the staging area (only the active one) the Response can change nothing: it is not offered.
  it("12204:A:3 Masterwork Bow: not offered with no location in the staging area", () => {
    const { tab, run } = attacked(EFFECTS, FRAIL, []);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).not.toContain("12204:response:1");
  });
});
