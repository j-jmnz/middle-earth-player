// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.cancel, rr.cost, rr.shadow-effects, rr.guarded, wor.guarded-x,
// rr.triggered-ability (data/rules/entries.json).
// The Wrath and Ruin attachments, each line tested from the words on the card: Durin's Axe 22006:A:1, A:2 and A:3, Silver Circlet 22008:A:1 and A:3,
// Inner Strength 22009:A:1, A:2 and A:3. The lines are the text of data/cards/WaR.json (data/printed holds no entry for this pack), so every
// intent goes through sendUnledgered. The shadow effect Inner Strength cancels is a fixture record (line fixture:A:1).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { atDefense, attacking, choices, combat, hosts, passAll, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const AXE = "22006";
const CIRCLET = "22008";
const INNER = "22009";
// The One Ring (21001), the player attachment Inner Strength names; Ring of Barahir (06007), an attachment with the Ring trait.
const ONE_RING = "21001";
const BARAHIR = "06007";
// Core: Legolas (Tactics), Éowyn (Spirit), Beravor (Lore, Attack 2).
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
// Tragic Discovery: a treachery the Guarded (enemy) keyword discards.
const TRAGIC = "09058";
const ALLY = "ally";
// A Spirit hero (Defense 2, 9 hit points); a Spirit ally; an enemy an attack of 4 destroys; one it does not; one that attacks for 2; a
// treachery whose shadow effect gives the attacker +3 Attack.
const BEARER = "bearer";
const SPIRIT_ALLY = "spirit-ally";
const WEAK = "weak";
const WALL = "wall";
const BRUTE = "brute";
const BOOST = "boost";

let base: Awaited<ReturnType<typeof starterBase>>;

const boostShadow: Effect = { id: "boost:shadow:1", cardCode: BOOST, lines: ["fixture:A:1"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker" }] };

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, [...effects, boostShadow], scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([AXE, CIRCLET, INNER, ONE_RING, BARAHIR, LEGOLAS, EOWYN, BERAVOR, TRAGIC]))]);
  cards.set(BEARER, definePrinted({ code: BEARER, name: "Bearer", type: "hero", sphere: "spirit", threat: 8, willpower: 2, attack: 1, defense: 2, health: 9 }));
  cards.set(SPIRIT_ALLY, definePrinted({ code: SPIRIT_ALLY, name: "Spirit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 3 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 20 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  cards.set(BOOST, definePrinted({ code: BOOST, name: "Boost", type: "treachery" }));
  base = { ...starter, cards };
});

describe("Durin's Axe (22006:A:1, A:2, A:3)", () => {
  // Legolas plays the Axe; the encounter deck holds Tragic Discovery over the enemy `guard`.
  function guarded(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: AXE, seat: 0 }], deck: [TRAGIC, "f3"] });
    const axe = idsOf(tab, AXE);
    const [hostId] = hosts(tab, axe);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: axe, hostId, payments: payFor(tab.state, tab.ctx, axe) }, tab.ctx);
    return { tab, run };
  }

  // "Guarded (enemy).": the treachery on top of the encounter deck is discarded, and the enemy under it guards the Axe in the staging area
  // (wor.guarded-x).
  lineSpec("22006:A:1", "Durin's Axe: guarded by the first enemy of the encounter deck", (effects) => {
    const { tab, run } = guarded(effects);
    const enemy = idsOf(tab, "f3");
    expect(run.state.cards[idsOf(tab, TRAGIC)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[enemy]?.zone).toBe("staging");
    expect(run.state.cards[enemy]?.attachments).toEqual([idsOf(tab, AXE)]);
  });

  // "Attach to a hero.": once its guarding enemy is destroyed, the Axe is free of encounters and goes on the hero the player picks
  // (wor.guarded-x); the ally is not offered.
  lineSpec("22006:A:2", "Durin's Axe: once free of encounters, goes on a hero of the player's choice", (effects) => {
    const { tab, run: played } = guarded(effects);
    const axe = idsOf(tab, AXE);
    let run = sendUnledgered(begin(placeDamage(played.state, idsOf(tab, "f3"), 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, BERAVOR)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, BERAVOR) }, tab.ctx);
    expect(run.state.cards[axe]).toMatchObject({ host: idsOf(tab, BERAVOR), zone: "play", controller: 0 });
  });

  // "Attached hero gets +2 Attack.": Beravor with the Axe; Legolas does not get it.
  lineSpec("22006:A:2", "Durin's Axe: the attached hero gets +2 Attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: AXE, host: BERAVOR }] });
    expect(stat(tab.state, tab, idsOf(tab, BERAVOR), "attack")).toBe(printed(tab, BERAVOR, "attack") + 2);
    expect(stat(tab.state, tab, idsOf(tab, LEGOLAS), "attack")).toBe(printed(tab, LEGOLAS, "attack"));
  });

  // Beravor (Attack 2 + 2) holds the Axe; the Weak and the Wall are engaged with the player and, in two seats, the Dear with the other one.
  const axed = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: "pal", seat: 1 }], attached: [{ code: AXE, host: BERAVOR }], engaged: [{ code: WEAK, seat: 0 }, { code: WALL, seat: 0 }, { code: "dear", seat: 1 }] });

  // "Response: After attach hero attacks and destroys an enemy, deal 1 damage to an enemy engaged with you.": Beravor destroys the Weak;
  // the Wall (the only other enemy engaged with the player) takes 1 damage, the Dear (engaged with the other player) none.
  lineSpec("22006:A:3", "Durin's Axe: after the hero attacks and destroys an enemy, 1 damage to an enemy engaged with you", (effects) => {
    const tab = axed(effects);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, BERAVOR)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).toContain("22006:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, AXE), effectId: "22006:response:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, WALL)]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, "dear")]?.damage).toBe(0);
  });

  // The Wall survives Beravor's attack, and Legolas (not the attached hero) destroys the Weak: no Response either time.
  it("22006:A:3 Durin's Axe: not offered when the enemy survives or another hero destroys it", () => {
    const tab = axed(EFFECTS);
    const survived = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, BERAVOR)] }, tab.ctx);
    expect(survived.state.cards[idsOf(tab, WALL)]).toMatchObject({ zone: "engaged", damage: printed(tab, BERAVOR, "attack") + 2 });
    expect(triggers(survived.state, tab)).not.toContain("22006:response:1");
    // An action window opens before the attack resolves (the other player may act); it is passed.
    const other = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, LEGOLAS)] }, tab.ctx), tab.ctx);
    expect(other.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    expect(triggers(other.state, tab)).not.toContain("22006:response:1");
  });

  // The Weak was the only enemy engaged with the player: no enemy engaged with you is left, so no Response.
  it("22006:A:3 Durin's Axe: not offered when no other enemy is engaged with you", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: "pal", seat: 1 }], attached: [{ code: AXE, host: BERAVOR }], engaged: [{ code: WEAK, seat: 0 }, { code: "dear", seat: 1 }] });
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, BERAVOR)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("22006:response:1");
  });
});

describe("Silver Circlet (22008:A:1, A:3)", () => {
  // Éowyn (who pays) and the Bearer (Spirit heroes), Legolas (Tactics) and a Spirit ally; two Circlets in hand.
  const circlets = (effects: readonly Effect[]) =>
    table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: BEARER, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: SPIRIT_ALLY, seat: 0 }], hand: [{ code: CIRCLET, seat: 0 }, { code: CIRCLET, seat: 0 }] });

  // "Attach to a Spirit hero. Limit 1 per hero.": Éowyn and the Bearer are offered, Legolas and the Spirit ally are not; with a Circlet on
  // Éowyn the second is offered only for the Bearer.
  lineSpec("22008:A:1", "Silver Circlet: Attach to a Spirit hero, limit 1 per hero", (effects) => {
    const tab = circlets(effects);
    const [first = "", second = ""] = tab.ids[CIRCLET] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, EOWYN), idsOf(tab, BEARER)].sort());
    const run = play(begin(tab.state), tab, first, idsOf(tab, EOWYN));
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, BEARER)]);
  });

  // "Attached hero gets +2 Willpower.": on Éowyn, +2; the Bearer's stays.
  lineSpec("22008:A:3", "Silver Circlet: the attached hero gets +2 Willpower", (effects) => {
    const tab = circlets(effects);
    const run = play(begin(tab.state), tab, tab.ids[CIRCLET]?.[0] ?? "", idsOf(tab, EOWYN));
    expect(stat(run.state, tab, idsOf(tab, EOWYN), "willpower")).toBe(printed(tab, EOWYN, "willpower") + 2);
    expect(stat(run.state, tab, idsOf(tab, BEARER), "willpower")).toBe(printed(tab, BEARER, "willpower"));
  });
});

describe("Inner Strength (22009:A:1 to A:3)", () => {
  // The Bearer holds The One Ring; Éowyn pays (Spirit); two Inner Strength in hand.
  const ringed = (effects: readonly Effect[], extra: Scene["attached"] = []) =>
    table(effects, { heroes: [{ code: BEARER, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: ONE_RING, host: BEARER }, ...extra], hand: [{ code: INNER, seat: 0 }, { code: INNER, seat: 0 }] });

  // "Attach to the hero with The One Ring. Limit 1 per hero.": only the Bearer is offered; once he holds one, the second Inner Strength
  // has no host.
  lineSpec("22009:A:1", "Inner Strength: Attach to the hero with The One Ring, limit 1 per hero", (effects) => {
    const tab = ringed(effects);
    const [first = "", second = ""] = tab.ids[INNER] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, BEARER)]);
    const run = play(begin(tab.state), tab, first, idsOf(tab, BEARER));
    expect(hosts(tab, second, run.state)).toEqual([]);
  });

  // "Attached hero gets +1 Defense.": the Bearer's Defense is 2 + 1.
  lineSpec("22009:A:2", "Inner Strength: the attached hero gets +1 Defense", (effects) => {
    const tab = ringed(effects);
    const run = play(begin(tab.state), tab, tab.ids[INNER]?.[0] ?? "", idsOf(tab, BEARER));
    expect(stat(run.state, tab, idsOf(tab, BEARER), "defense")).toBe(printed(tab, BEARER, "defense") + 1);
  });

  // "Attach to the hero with The One Ring": Éowyn holds the Ring of Barahir (an Artifact Ring that is not The One Ring) and is not a host.
  lineSpec("22009:A:1", "Inner Strength: a hero with another Ring attachment is not offered", (effects) => {
    const tab = ringed(effects, [{ code: BARAHIR, host: EOWYN }]);
    expect(tab.state.cards[idsOf(tab, BARAHIR)]?.host).toBe(idsOf(tab, EOWYN));
    expect(hosts(tab, tab.ids[INNER]?.[0] ?? "")).toEqual([idsOf(tab, BEARER)]);
  });

  // The Bearer holds The One Ring and Inner Strength (Defense 3) and Éowyn is the other hero; the Brute (Attack 2) is engaged and gets the
  // Boost as its shadow card. `defender` is declared.
  function defended(effects: readonly Effect[], defender: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: BEARER, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: ONE_RING, host: BEARER }, { code: INNER, host: BEARER }], engaged: [{ code: BRUTE, seat: 0 }], deck: [BOOST] });
    let run = atDefense(tab);
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx);
    return { tab, run };
  }

  // "Response: Exhaust The One Ring and raise your threat by 1 to cancel a shadow effect just triggered during an attack that attached hero
  // is defending.": The One Ring is exhausted, the threat goes from 8 to 9, and the attack (2) does no damage against Defense 3.
  lineSpec("22009:A:3", "Inner Strength: exhaust The One Ring and raise the threat by 1 to cancel a shadow effect", (effects) => {
    const { tab, run: asked } = defended(effects, BEARER);
    const bearer = idsOf(tab, BEARER);
    expect(triggers(asked.state, tab)).toContain("22009:response:1");
    const run = passAll(sendUnledgered(asked, { type: "Trigger", cardId: idsOf(tab, INNER), effectId: "22009:response:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, ONE_RING)]?.exhausted).toBe(true);
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
    expect(run.state.cards[bearer]?.damage).toBe(0);
  });

  // The shadow effect not canceled: the attack is 2 + 3 against Defense 3, and the Bearer takes 2.
  it("22009:A:3 Inner Strength: the shadow effect resolves when it is not used", () => {
    const { tab, run: asked } = defended(EFFECTS, BEARER);
    const run = passAll(sendUnledgered(asked, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, BEARER)]?.damage).toBe(2);
  });

  // "Exhaust The One Ring": with The One Ring already exhausted the cost cannot be paid, so no Response.
  it("22009:A:3 Inner Strength: not offered when The One Ring is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BEARER, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: ONE_RING, host: BEARER }, { code: INNER, host: BEARER }], engaged: [{ code: BRUTE, seat: 0 }], deck: [BOOST] });
    const ring = idsOf(tab, ONE_RING);
    let run = passAll(combat(updateCard(tab.state, ring, { exhausted: true }), tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, BEARER) }, tab.ctx), tab.ctx);
    expect(run.state.cards[ring]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("22009:response:1");
  });

  // "an attack that attached hero is defending": Éowyn defends, so no Response.
  it("22009:A:3 Inner Strength: not offered when another character defends", () => {
    const { tab, run } = defended(EFFECTS, EOWYN);
    expect(triggers(run.state, tab)).not.toContain("22009:response:1");
  });
});
