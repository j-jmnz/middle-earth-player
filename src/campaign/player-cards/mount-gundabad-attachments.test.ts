// Rules: rr.attachment-cards, rr.restricted, rr.guarded, wor.guarded-x, rr.modifiers, rr.response, rr.sentinel, rr.damage,
// rr.combat-phase (data/rules/entries.json).
// The Mount Gundabad attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Sting
// 19117:A:1, A:2, A:3 and A:4, Round Shield 19118:A:1, Armor of Erebor 19120:A:1 and A:2. The lines are the text of data/cards/MG.json
// (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered. The allies and events are in
// mount-gundabad.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { hasKeyword, placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table, SAM } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, hosts, passAll, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const STING = "19117";
const SHIELD = "19118";
const TOYMAKER = "19119";
const ARMOR = "19120";
// Core Aragorn (Leadership), Gimli (Tactics, Dwarf hero), Éowyn (Spirit); the Wandering Took (a Hobbit ally). Sam Gamgee (a Leadership
// Hobbit hero) is a scene card. Crawling Towards Him: a treachery of scenario 1's encounter deck.
const ARAGORN = "01001";
const GIMLI = "01004";
const EOWYN = "01007";
const TOOK = "01043";
const CRAWLING = "141041";
// The Pal (a Leadership Hobbit hero) and a plain ally, from the scene kit; the f3 enemy of the scene kit guards Sting.
const PAL = "pal";
const ALLY = "ally";
// A restricted attachment with no text; a Dale ally; a location with no text; an enemy of Attack 2, Defense 0 and 9 hit points.
const GEAR = "gear";
const DALE = "dale";
const GLADE = "glade";
const BRUTE = "brute";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([STING, SHIELD, TOYMAKER, ARMOR, ARAGORN, GIMLI, EOWYN, TOOK, CRAWLING]))]);
  cards.set(GEAR, definePrinted({ code: GEAR, name: "Gear", type: "attachment", sphere: "neutral", cost: 0, keywords: { restricted: true } }));
  cards.set(DALE, definePrinted({ code: DALE, name: "Dale", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dale"] }));
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 1, questPoints: 5 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Sting (19117:A:1, A:2)", () => {
  // Sting is played from the hand by Gimli (Tactics); a treachery and a location lie over the f3 enemy in the encounter deck. Sam and the
  // Pal are Hobbit heroes, the Wandering Took a Hobbit ally.
  function guarded(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: SAM, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: TOOK, seat: 0 }], hand: [{ code: STING, seat: 0 }], deck: [CRAWLING, GLADE, "f3"] });
    const sting = idsOf(tab, STING);
    const [hostId] = hosts(tab, sting);
    return { tab, run: play(begin(tab.state), tab, sting, hostId) };
  }
  // The guarding enemy is destroyed, and the next intent lets the game resolve what that set off.
  const freed = (tab: Table, run: Run): Run => sendUnledgered(begin(placeDamage(run.state, idsOf(tab, "f3"), 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);

  // "Guarded (enemy).": cards are discarded from the encounter deck until an enemy (the treachery and the location go), which is added to
  // the staging area with Sting attached to it (wor.guarded-x).
  lineSpec("19117:A:1", "Guarded (enemy): the encounter deck is discarded down to an enemy, which guards it in the staging area", (effects) => {
    const { tab, run } = guarded(effects);
    const [sting, enemy] = [idsOf(tab, STING), idsOf(tab, "f3")];
    expect(run.state.cards[idsOf(tab, CRAWLING)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idsOf(tab, GLADE)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[enemy]?.zone).toBe("staging");
    expect(run.state.cards[enemy]?.attachments).toEqual([sting]);
    expect(run.state.cards[sting]?.host).toBe(enemy);
  });

  // "Attach to a Hobbit hero.": once its guard is destroyed its owner attaches it (wor.guarded-x): Sam and the Pal are the choices,
  // Gimli (no Hobbit) and the Wandering Took (an ally) are not.
  lineSpec("19117:A:2", "once free of its guard, attached to a Hobbit hero", (effects) => {
    const { tab, run: played } = guarded(effects);
    const [sting, sam] = [idsOf(tab, STING), idsOf(tab, SAM)];
    let run = freed(tab, played);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([sam, idsOf(tab, PAL)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: sam }, tab.ctx);
    expect(run.state.cards[sting]).toMatchObject({ zone: "play", host: sam });
  });
});

describe("Sting (19117:A:3, A:4)", () => {
  // Sam (Willpower 3, Attack 1, Defense 1) holds Sting; Aragorn is the other hero; the Brute is engaged.
  const stung = (effects: readonly Effect[]): Table =>
    table(effects, { heroes: [{ code: SAM, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: STING, host: SAM }], engaged: [{ code: BRUTE, seat: 0 }] });

  // "Attached hero gets +1 Willpower, +1 Attack, and +1 Defense.": Sam has each of his printed stats + 1; Aragorn keeps his.
  lineSpec("19117:A:3", "attached hero gets +1 Willpower, +1 Attack and +1 Defense", (effects) => {
    const tab = stung(effects);
    const [sam, aragorn] = [idsOf(tab, SAM), idsOf(tab, ARAGORN)];
    expect([stat(tab.state, tab, sam, "willpower"), stat(tab.state, tab, sam, "attack"), stat(tab.state, tab, sam, "defense")]).toEqual([3 + 1, 1 + 1, 1 + 1]);
    expect(stat(tab.state, tab, aragorn, "attack")).toBe(printed(tab, ARAGORN, "attack"));
  });

  // "Response: After attached hero is declared as an attacker or defender against an enemy, deal 1 damage to that enemy.": Sam is
  // declared as an attacker against the Brute; before the attack resolves, the Brute takes 1 damage.
  lineSpec("19117:A:4", "after the attached hero is declared as an attacker, 1 damage to that enemy", (effects) => {
    const tab = stung(effects);
    const [sting, brute] = [idsOf(tab, STING), idsOf(tab, BRUTE)];
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: brute, attackerIds: [idsOf(tab, SAM)] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("19117:response:1");
    const next = sendUnledgered(run, { type: "Trigger", cardId: sting, effectId: "19117:response:1" }, tab.ctx);
    // The 1 damage comes first; then the attack resolves (Sam's Attack 1 + 1 against Defense 0).
    const dealt = next.steps.flatMap((step) => (step.kind === "damage" && step.targetId === brute && step.amount > 0 ? [step.amount] : []));
    expect(dealt).toEqual([1, 2]);
    expect(next.state.cards[brute]?.damage).toBe(1 + 2);
  });

  // Sam is declared as the defender against the Brute's attack: the Brute takes 1 damage.
  lineSpec("19117:A:4", "after the attached hero is declared as a defender, 1 damage to that enemy", (effects) => {
    const tab = stung(effects);
    const [sting, brute] = [idsOf(tab, STING), idsOf(tab, BRUTE)];
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", enemyId: brute });
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, SAM) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("19117:response:2");
    run = sendUnledgered(run, { type: "Trigger", cardId: sting, effectId: "19117:response:2" }, tab.ctx);
    expect(run.state.cards[brute]?.damage).toBe(1);
  });

  // Aragorn attacks and defends: Sting has no Response.
  it("19117:A:4 is not offered when another hero attacks or defends", () => {
    const tab = stung(EFFECTS);
    const [brute, aragorn] = [idsOf(tab, BRUTE), idsOf(tab, ARAGORN)];
    const attack = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: brute, attackerIds: [aragorn] }, tab.ctx);
    expect(triggers(attack.state, tab)).not.toContain("19117:response:1");
    const defend = sendUnledgered(passAll(combat(tab.state, tab), tab.ctx), { type: "DeclareDefender", defenderId: aragorn }, tab.ctx);
    expect(triggers(defend.state, tab)).not.toContain("19117:response:2");
  });
});

describe("Round Shield (19118:A:1)", () => {
  // "Attach to a character. Restricted.": Gimli (Tactics, who pays) and the plain ally are offered, the engaged enemy is not. The engine's
  // own attach rule (a character) gives the same hosts, so the line is checked with a plain test.
  it("19118:A:1 Attach to a character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    expect(hosts(tab, shield)).toEqual([idsOf(tab, GIMLI), idsOf(tab, ALLY)].sort());
    expect(play(begin(tab.state), tab, shield, idsOf(tab, ALLY)).state.cards[shield]?.host).toBe(idsOf(tab, ALLY));
  });

  // "Restricted.": played on Gimli, who holds two restricted Gears, one of the three restricted attachments is discarded (rr.restricted).
  it("19118:A:1 played as a third restricted attachment, one of the three is discarded", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: GEAR, host: GIMLI }, { code: GEAR, host: GIMLI }], hand: [{ code: SHIELD, seat: 0 }] });
    const [shield, gimli, [first = "", second = ""]] = [idsOf(tab, SHIELD), idsOf(tab, GIMLI), tab.ids[GEAR] ?? []];
    let run = play(begin(tab.state), tab, shield, gimli);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([shield, first, second].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: first }, tab.ctx);
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(run.state.cards[gimli]?.attachments.slice().sort()).toEqual([shield, second].sort());
  });
});

describe("Armor of Erebor (19120:A:1, A:2)", () => {
  // "Attach to a Dale or Dwarf character. Restricted.": Gimli (a Dwarf hero), the Erebor Toymaker (a Dwarf ally) and the Dale ally are
  // offered; Éowyn (Spirit, who pays) and the plain ally are not.
  lineSpec("19120:A:1", "Attach to a Dale or Dwarf character", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GIMLI, seat: 0 }], allies: [{ code: TOYMAKER, seat: 0 }, { code: DALE, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: ARMOR, seat: 0 }] });
    const armor = idsOf(tab, ARMOR);
    expect(hosts(tab, armor)).toEqual([idsOf(tab, GIMLI), idsOf(tab, TOYMAKER), idsOf(tab, DALE)].sort());
    expect(play(begin(tab.state), tab, armor, idsOf(tab, DALE)).state.cards[armor]?.host).toBe(idsOf(tab, DALE));
  });

  // "Attached character gets +1 Defense and gains sentinel.": played on Gimli, he has Defense 2 + 1 and may defend the attack of the
  // enemy engaged with the second player; Éowyn (no sentinel) may not.
  lineSpec("19120:A:2", "attached character gets +1 Defense and gains sentinel", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: ARMOR, seat: 0 }], engaged: [{ code: BRUTE, seat: 1 }] });
    const gimli = idsOf(tab, GIMLI);
    const played = play(begin(tab.state), tab, idsOf(tab, ARMOR), gimli);
    expect(stat(played.state, tab, gimli, "defense")).toBe(printed(tab, GIMLI, "defense") + 1);
    expect(hasKeyword(played.state, gimli, "sentinel", tab.ctx.cards)).toBe(true);
    const run = passAll(combat(played.state, tab), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 1 });
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: idsOf(tab, EOWYN) }, tab.ctx)).not.toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: gimli }, tab.ctx)).toBeNull();
  });
});
