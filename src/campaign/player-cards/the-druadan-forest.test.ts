// Rules: rr.modifiers, rr.initial-threat-level, rr.printed, rr.resource-match, rr.attachment-cards, rr.response, rr.forced, rr.lasting-effects,
// rr.ready, rr.traits, rr.triggered-ability, ltp.undefended-attack, rr.step-6-4-3 (data/rules/entries.json).
// The Drúadan Forest heroes, allies and attachment, written from their card text (data/cards/TDF.json; the lines are the ledger lines in data/printed, read from the scans): Mirlonde 06032:A:1, Forlong 06033:A:1,
// Mighty Prowess 06035:A:1 and A:2, Silvan Refugee 06037:A:1, Harbor Master 06039:A:1, White Tower Watchman 06041:A:1. The events are in
// the-druadan-forest-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { threatCostCut, threatCostOf } from "../../rules/families/costs/stats.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Run, type Scene, type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { atDefense, attacking, choices, endRound, enter, hosts, passAll, passWhile, play, playerTableFor, printed, stat, triggers } from "../../../test/harness/player-table.ts";

const MIRLONDE = "06032";
const FORLONG = "06033";
const PROWESS = "06035";
const REFUGEE = "06037";
const HARBOR = "06039";
const WATCHMAN = "06041";
// Core Aragorn (Leadership), Legolas and Gimli (Tactics), Éowyn (Spirit), Beravor (Lore); Steward of Gondor ("Action: Exhaust Steward of
// Gondor to add 2 resources to attached hero's resource pool.") and Song of Wisdom ("Attached hero gains a Lore resource icon.").
const ARAGORN = "01001";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const STEWARD = "01026";
const SONG = "02034";
const PAL = "pal";
const ALLY = "ally";
// Outlands allies with no text, one of each sphere but Leadership (Forlong is the Leadership one).
const TACTICS_OUTLANDS = "tactics-outlands";
const SPIRIT_OUTLANDS = "spirit-outlands";
const LORE_OUTLANDS = "lore-outlands";
const LEADERSHIP_OUTLANDS = "leadership-outlands";
// A Tactics hero with no text, Attack 6, to destroy the Orcs.
const SLAYER = "slayer";
// Enemies that engage nobody: two Orcs (Orc, Goblin), a Troll (Orc, Troll) of 6 hit points, a Wolf (Creature), all of Defense 0; the Orcs
// have 1 hit point. A Brute (Attack 4, no trait).
const ORC = "orc";
const TROLL = "troll";
const WOLF = "wolf";
const BRUTE = "brute";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([MIRLONDE, FORLONG, PROWESS, REFUGEE, HARBOR, WATCHMAN, ARAGORN, GIMLI, LEGOLAS, EOWYN, BERAVOR, STEWARD, SONG]))]);
  const outlands = (code: string, sphere: "leadership" | "tactics" | "spirit" | "lore") => definePrinted({ code, name: code, type: "ally", sphere, cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Outlands"] });
  cards.set(TACTICS_OUTLANDS, outlands(TACTICS_OUTLANDS, "tactics"));
  cards.set(SPIRIT_OUTLANDS, outlands(SPIRIT_OUTLANDS, "spirit"));
  cards.set(LORE_OUTLANDS, outlands(LORE_OUTLANDS, "lore"));
  cards.set(LEADERSHIP_OUTLANDS, outlands(LEADERSHIP_OUTLANDS, "leadership"));
  cards.set(SLAYER, definePrinted({ code: SLAYER, name: "Slayer", type: "hero", sphere: "tactics", threat: 9, willpower: 1, attack: 6, defense: 1, health: 5 }));
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 1, traits: ["Orc", "Goblin"] }));
  cards.set(TROLL, definePrinted({ code: TROLL, name: "Troll", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 6, traits: ["Orc", "Troll"] }));
  cards.set(WOLF, definePrinted({ code: WOLF, name: "Wolf", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 6, traits: ["Creature"] }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 4, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

describe("Mirlonde (06032:A:1)", () => {
  // "Each hero you control with a printed Lore resource icon gets -1 threat cost.": Mirlonde and Beravor (Lore) cost 1 less; Aragorn
  // (Leadership), Aragorn with Song of Wisdom (a Lore icon that is not printed) and the other player's Lore hero do not. The starting
  // threat (rr.initial-threat-level) of the first player drops by 2, the other player's by none.
  lineSpec("06032:A:1", "Mirlonde: each hero you control with a printed Lore icon gets -1 threat cost", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: MIRLONDE, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 1 }], attached: [{ code: SONG, host: ARAGORN }] });
    const [mine = "", theirs = ""] = tab.ids[BERAVOR] ?? [];
    const cost = (code: string) => tab.ctx.cards.get(code)?.threat ?? 0;
    expect(threatCostOf(tab.state, idsOf(tab, MIRLONDE), tab.ctx)).toBe(cost(MIRLONDE) - 1);
    expect(threatCostOf(tab.state, mine, tab.ctx)).toBe(cost(BERAVOR) - 1);
    expect(threatCostOf(tab.state, idsOf(tab, ARAGORN), tab.ctx)).toBe(cost(ARAGORN));
    expect(threatCostOf(tab.state, theirs, tab.ctx)).toBe(cost(BERAVOR));
    expect(threatCostCut(tab.state, 0, tab.ctx)).toBe(2);
    expect(threatCostCut(tab.state, 1, tab.ctx)).toBe(0);
  });
});

describe("Forlong (06033:A:1)", () => {
  // Forlong exhausted, with Outlands allies of the spheres `spheres` under the first player and those of `theirs` under the other.
  function exhausted(effects: readonly Effect[], spheres: readonly string[], theirs: readonly string[] = []): Table {
    const allies = [{ code: FORLONG, seat: 0 }, ...spheres.map((code) => ({ code, seat: 0 })), ...theirs.map((code) => ({ code, seat: 1 }))];
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies, deck: ["f0", "f0", "f0"] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, FORLONG), { exhausted: true }) };
  }

  // "While you control Outlands allies that belong to 4 different spheres, ready Forlong at the beginning of each phase.": with Forlong
  // (Leadership) and Tactics, Spirit and Lore Outlands allies, he is ready once the quest phase begins.
  lineSpec("06033:A:1", "Forlong: with Outlands allies of 4 spheres, he readies at the beginning of a phase", (effects) => {
    const tab = exhausted(effects, [TACTICS_OUTLANDS, SPIRIT_OUTLANDS, LORE_OUTLANDS]);
    const run = enter(tab.state, tab, "questCommit");
    expect(run.state.phase).toBe("Quest");
    expect(run.state.cards[idsOf(tab, FORLONG)]?.exhausted).toBe(false);
  });

  // Three spheres (two Leadership allies, Tactics, Spirit) are not 4, and the other player's Lore Outlands ally is not one you control:
  // Forlong stays exhausted.
  it("06033:A:1 Forlong: no ready with 3 spheres, another player's ally not counted", () => {
    const tab = exhausted(EFFECTS, [LEADERSHIP_OUTLANDS, TACTICS_OUTLANDS, SPIRIT_OUTLANDS], [LORE_OUTLANDS]);
    const run = enter(tab.state, tab, "questCommit");
    expect(run.state.phase).toBe("Quest");
    expect(run.state.cards[idsOf(tab, FORLONG)]?.exhausted).toBe(true);
  });
});

describe("Mighty Prowess (06035:A:1, A:2)", () => {
  // "Attach to a Tactics hero. Limit 1 per hero.": Legolas and Gimli are offered; Aragorn (Leadership) and the ally are not. Once Prowess is
  // on Legolas, a second one is offered only Gimli.
  lineSpec("06035:A:1", "Mighty Prowess: attach to a Tactics hero, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: PROWESS, seat: 0 }, { code: PROWESS, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[PROWESS] ?? [];
    const [legolas, gimli] = [idsOf(tab, LEGOLAS), idsOf(tab, GIMLI)];
    expect(hosts(tab, first)).toEqual([legolas, gimli].sort());
    const run = play(begin(tab.state), tab, first, legolas);
    expect(run.state.cards[first]?.host).toBe(legolas);
    expect(hosts(tab, second, run.state)).toEqual([gimli]);
  });

  // The Slayer holds Prowess; Legolas is beside him. The Orc is engaged, with the Troll (Orc, Troll) and the Wolf (Creature).
  const prowess = (effects: readonly Effect[], scene: Partial<Scene> = {}) =>
    table(effects, { heroes: [{ code: SLAYER, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: PROWESS, host: SLAYER }], engaged: [{ code: ORC, seat: 0 }, { code: WOLF, seat: 0 }], staging: [TROLL], ...scene });
  const attack = (tab: Table, attacker: string): Run => send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, ORC), attackerIds: [idsOf(tab, attacker)] }, tab.ctx);

  // "Response: After attached hero attacks and destroys an enemy, deal 1 damage to another enemy that shares a Trait with the enemy just
  // destroyed.": the Slayer destroys the Orc; the Troll in the staging area (an Orc) takes 1 damage; the Wolf (Creature) cannot be picked.
  lineSpec("06035:A:2", "Mighty Prowess: after the hero destroys an enemy, 1 damage to another enemy that shares a Trait", (effects) => {
    const tab = prowess(effects);
    let run = attack(tab, SLAYER);
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).toContain("06035:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, PROWESS), effectId: "06035:response:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, TROLL)]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, WOLF)]?.damage).toBe(0);
  });

  // Two enemies share a Trait with the Orc: the Troll and a second Orc; the player picks one.
  it("06035:A:2 Mighty Prowess: the player picks among the enemies that share a Trait", () => {
    const tab = prowess(EFFECTS, { engaged: [{ code: ORC, seat: 0 }, { code: ORC, seat: 0 }, { code: WOLF, seat: 0 }] });
    const [, other = ""] = tab.ids[ORC] ?? [];
    let run = attack(tab, SLAYER);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, PROWESS), effectId: "06035:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([other, idsOf(tab, TROLL)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, TROLL) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, TROLL)]?.damage).toBe(1);
    expect(run.state.cards[other]?.damage).toBe(0);
  });

  // "attached hero attacks": Legolas (Attack 3) destroys the Orc, and Prowess offers no Response. With no other enemy that shares a Trait
  // (the Wolf only), the Slayer's kill offers none either.
  it("06035:A:2 Mighty Prowess: no Response for another hero's kill, nor with no enemy sharing a Trait", () => {
    const other = prowess(EFFECTS);
    const run = attack(other, LEGOLAS);
    expect(run.state.cards[idsOf(other, ORC)]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, other)).not.toContain("06035:response:1");
    const alone = prowess(EFFECTS, { staging: [] });
    const kill = attack(alone, SLAYER);
    expect(kill.state.cards[idsOf(alone, ORC)]?.zone).toBe("encounterDiscard");
    expect(triggers(kill.state, alone)).not.toContain("06035:response:1");
  });
});

describe("Silvan Refugee (06037:A:1)", () => {
  // "Forced: After a character leaves play, discard Silvan Refugee from play.": the ally defends the Brute (4) and is destroyed; the Refugee
  // is discarded.
  lineSpec("06037:A:1", "Silvan Refugee: discarded after a character leaves play", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }, { code: REFUGEE, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
    let run = atDefense(tab);
    run = passAll(send(run, { type: "DeclareDefender", defenderId: idsOf(tab, ALLY) }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, ALLY)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, REFUGEE)]?.zone).toBe("discard");
  });

  // An enemy is not a character: the Slayer destroys the Orc and the Refugee stays.
  it("06037:A:1 Silvan Refugee: stays when an enemy leaves play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SLAYER, seat: 0 }], allies: [{ code: REFUGEE, seat: 0 }], engaged: [{ code: ORC, seat: 0 }] });
    const run = passAll(send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, ORC), attackerIds: [idsOf(tab, SLAYER)] }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idsOf(tab, REFUGEE)]?.zone).toBe("play");
  });
});

describe("Harbor Master (06039:A:1)", () => {
  // "Response: After a card effect adds any number of resources to the resource pool of a hero you control, Harbor Master gains +1 Defense
  // until the end of the round.": Steward of Gondor adds 2 resources to Aragorn; the Harbor Master has Defense 0 + 1, still in the combat
  // phase, and 0 once the round ends.
  lineSpec("06039:A:1", "Harbor Master: +1 Defense until the end of the round after a card effect adds resources to your hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: HARBOR, seat: 0 }], attached: [{ code: STEWARD, host: ARAGORN }], playerDeck: [{ code: "card", seat: 0 }] });
    const harbor = idsOf(tab, HARBOR);
    let run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STEWARD), effectId: "01026:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 + 2);
    expect(triggers(run.state, tab)).toContain("06039:response:1");
    run = send(run, { type: "Trigger", cardId: harbor, effectId: "06039:response:1" }, tab.ctx);
    expect(stat(run.state, tab, harbor, "defense")).toBe(printed(tab, HARBOR, "defense") + 1);
    expect(stat(enter(run.state, tab, "combatStart").state, tab, harbor, "defense")).toBe(printed(tab, HARBOR, "defense") + 1);
    expect(stat(endRound(run.state, tab).state, tab, harbor, "defense")).toBe(printed(tab, HARBOR, "defense"));
  });

  // "a hero you control": the other player plays Steward of Gondor on his hero in his planning turn and adds 2 resources to it; the Harbor
  // Master offers no Response.
  it("06039:A:1 Harbor Master: no Response for resources added to another player's hero", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: HARBOR, seat: 0 }], hand: [{ code: STEWARD, seat: 1 }] });
    // The first player passes his planning turn: the other player plays in his.
    let run = begin(tab.state);
    run = passWhile(run, tab, (run) => !legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard"), 3);
    expect(run.state.activeSeat).toBe(1);
    run = send(run, { type: "PlayCard", cardId: idsOf(tab, STEWARD), hostId: idsOf(tab, PAL), payments: [{ heroId: idsOf(tab, PAL), amount: 2 }] }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, STEWARD), effectId: "01026:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, PAL)]?.resources).toBe(6 - 2 + 2);
    expect(triggers(run.state, tab)).not.toContain("06039:response:1");
  });

  // "a card effect": the resource phase's resource is not added by a card, and no Response is offered.
  it("06039:A:1 Harbor Master: no Response for the resource phase's resource", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: HARBOR, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }] });
    const run = enter(tab.state, tab, "resourceGrant");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 + 1);
    expect(triggers(run.state, tab)).not.toContain("06039:response:1");
  });
});

describe("White Tower Watchman (06041:A:1)", () => {
  // The Brute (Attack 4) attacks the player, undefended.
  function undefended(effects: readonly Effect[], heroes: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: heroes.map((code) => ({ code, seat: 0 })), allies: [{ code: WATCHMAN, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
    const run = atDefense(tab);
    return { tab, run };
  }

  // "If each hero you control belongs to the same sphere of influence, you may assign damage from undefended enemy attacks to White Tower
  // Watchman instead of a hero you control.": with Legolas and Gimli (Tactics), the 4 damage goes to the Watchman.
  lineSpec("06041:A:1", "White Tower Watchman: takes an undefended attack's damage while your heroes share a sphere", (effects) => {
    const { tab, run } = undefended(effects, [LEGOLAS, GIMLI]);
    const watchman = idsOf(tab, WATCHMAN);
    const after = send(run, { type: "Undefended", heroId: watchman }, tab.ctx);
    expect(after.state.cards[watchman]?.zone).toBe("discard");
    expect(after.state.cards[idsOf(tab, LEGOLAS)]?.damage).toBe(0);
    expect(after.state.cards[idsOf(tab, GIMLI)]?.damage).toBe(0);
  });

  // Legolas (Tactics) and Aragorn (Leadership) do not share a sphere: the damage cannot go to the Watchman.
  it("06041:A:1 White Tower Watchman: not while your heroes belong to different spheres", () => {
    const { tab, run } = undefended(EFFECTS, [LEGOLAS, ARAGORN]);
    expect(refusal(run.state, { type: "Undefended", heroId: idsOf(tab, WATCHMAN) }, tab.ctx)).not.toBeNull();
    expect(refusal(run.state, { type: "Undefended", heroId: idsOf(tab, LEGOLAS) }, tab.ctx)).toBeNull();
  });
});
