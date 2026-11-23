// Rules: rr.attachment-cards, rr.modifiers, rr.staging-area, rr.traits, rr.gains, rr.the-letter-x, rr.discard-pile-and-victory-display,
// rr.response, rr.enters-play, rr.printed, rr.engaged, rr.cost, rr.action, rr.limits, rr.lasting-effects, rr.resources,
// rr.play-restrictions-and-permissions, rr.then, rr.player-deck, rr.restricted, rr.exhausted, rr.damage, rr.triggered-ability
// (data/rules/entries.json).
// The Assault on Osgiliath player cards, written from their card text (data/cards/AoO.json; data/printed holds no ledger for this pack, so
// every intent goes through sendUnledgered): Faramir 06081:A:2, Sword of Morthond 06082:A:1 and A:2, Men of the West 06083:A:1, Knight of
// Minas Tirith 06084:A:1, Gondorian Fire 06085:A:1 and A:2, Pelargir Shipwright 06086:A:1, Map of Earnil 06087:A:1 to A:3, Ranger Bow
// 06088:A:2 and A:3, Forest Patrol 06089:A:1 and A:2, Palantir 06090:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode, withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, discarded, hosts, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const FARAMIR = "06081";
const SWORD = "06082";
const MEN = "06083";
const KNIGHT = "06084";
const FIRE = "06085";
const SHIPWRIGHT = "06086";
const MAP = "06087";
const BOW = "06088";
const PATROL = "06089";
const PALANTIR = "06090";
// Core heroes: Aragorn (Leadership, Dúnedain, Noble, Ranger), Gimli and Legolas (Tactics), Éowyn (Spirit), Denethor (Lore, Gondor),
// Beravor (Lore, Dúnedain, Ranger). Gondorian Spearman: a Gondor ally. The Galadhrim's Greeting: a Spirit event, cost 3, "Action: Reduce
// one player's threat by 6, or reduce each player's threat by 2."
const ARAGORN = "01001";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
const BERAVOR = "01012";
const SPEARMAN = "01029";
const GREETING = "01046";
// Outlands allies: Warrior of Lossarnach ("Each Outlands character you control gets +1 Defense."), Knights of the Swan, Ethir Swordsman.
const LOSSARNACH = "06002";
const SWAN = "06004";
const ETHIR = "06006";
const ALLY = "ally";
const CARD = "card";
// A Spirit hero and a Lore hero with no traits, a Ranger ally, a Trap attachment.
const SPIRIT = "spirit";
const SAGE = "sage";
const RANGER = "ranger";
const SNARE = "snare";
// Wall: an enemy no damage of these tests destroys. Target: Defense 1 and 9 hit points.
const WALL = "wall";
const TARGET = "target";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);
const playable = (tab: Table, cardId: string, state = tab.state) => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [FARAMIR, SWORD, MEN, KNIGHT, FIRE, SHIPWRIGHT, MAP, BOW, PATROL, PALANTIR, ARAGORN, GIMLI, LEGOLAS, EOWYN, DENETHOR, BERAVOR, SPEARMAN, GREETING, LOSSARNACH, SWAN, ETHIR];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(RANGER, definePrinted({ code: RANGER, name: "Ranger", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Ranger"] }));
  cards.set(SNARE, definePrinted({ code: SNARE, name: "Snare", type: "attachment", cost: 0, traits: ["Trap"] }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 2, engagementCost: 40, attack: 1, defense: 3, health: 9 }));
  cards.set(TARGET, definePrinted({ code: TARGET, name: "Target", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

describe("Faramir (06081:A:2)", () => {
  // "Faramir gets +1 Attack for each enemy in the staging area.": two Walls in the staging area and one engaged give +2; once the player
  // engages one of them in the optional engagement, +1.
  lineSpec("06081:A:2", "Faramir: +1 Attack for each enemy in the staging area", (effects) => {
    const tab = table(effects, { start: "encounter", heroes: [{ code: FARAMIR, seat: 0 }], staging: [WALL, WALL], engaged: [{ code: WALL, seat: 0 }] });
    const faramir = idsOf(tab, FARAMIR);
    const attack = tab.ctx.cards.get(FARAMIR)?.attack ?? 0;
    expect(stat(tab.state, tab, faramir, "attack")).toBe(attack + 2);
    const run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, WALL) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WALL)]?.zone).toBe("engaged");
    expect(stat(run.state, tab, faramir, "attack")).toBe(attack + 1);
  });
});

describe("Sword of Morthond (06082:A:1, A:2)", () => {
  // Aragorn (Leadership) pays; Denethor (a Gondor hero), the Gondorian Spearman (a Gondor ally), Warrior of Lossarnach (Outlands, not
  // Gondor) and a plain ally.
  const sword = (effects: readonly Effect[]) =>
    table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }, { code: LOSSARNACH, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: SWORD, seat: 0 }] });

  // "Attach to a Gondor ally.": only the Spearman is offered.
  lineSpec("06082:A:1", "Sword of Morthond: Attach to a Gondor ally", (effects) => {
    const tab = sword(effects);
    const card = idsOf(tab, SWORD);
    expect(hosts(tab, card)).toEqual([idsOf(tab, SPEARMAN)]);
    expect(play(begin(tab.state), tab, card, idsOf(tab, SPEARMAN)).state.cards[card]?.host).toBe(idsOf(tab, SPEARMAN));
  });

  // "Attached ally gains the Outlands trait.": the Spearman with the Sword is an Outlands character, so Warrior of Lossarnach gives him +1
  // Defense.
  lineSpec("06082:A:2", "Sword of Morthond: the attached ally gains the Outlands trait", (effects) => {
    const tab = sword(effects);
    const spearman = idsOf(tab, SPEARMAN);
    const defense = tab.ctx.cards.get(SPEARMAN)?.defense ?? 0;
    expect(hasTrait(tab.state, spearman, "Outlands", tab.ctx)).toBe(false);
    expect(stat(tab.state, tab, spearman, "defense")).toBe(defense);
    const run = play(begin(tab.state), tab, idsOf(tab, SWORD), spearman);
    expect(hasTrait(run.state, spearman, "Outlands", tab.ctx)).toBe(true);
    expect(stat(run.state, tab, spearman, "defense")).toBe(defense + 1);
  });
});

describe("Men of the West (06083:A:1)", () => {
  // "Action: Return X Outlands allies from your discard pile to your hand.": X is 2 (Aragorn pays 2); the three Outlands allies in the
  // discard pile are offered, the Spearman is not; two are returned and the third stays.
  it("06083:A:1 Men of the West: returns X Outlands allies from the discard pile to the hand", () => {
    const scene = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: MEN, seat: 0 }] });
    const { tab, ids: [lossarnach = "", swan = "", ethir = "", spearman = ""] } = discarded(scene, [[LOSSARNACH, 0], [SWAN, 0], [ETHIR, 0], [SPEARMAN, 0]]);
    const aragorn = idsOf(tab, ARAGORN);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, MEN), payments: [{ heroId: aragorn, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 2);
    expect(choices(run.state, tab).sort()).toEqual([lossarnach, swan, ethir].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: swan }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([lossarnach, ethir].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ethir }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect([swan, ethir, lossarnach, spearman].map((id) => run.state.cards[id]?.zone)).toEqual(["hand", "hand", "discard", "discard"]);
  });
});

describe("Knight of Minas Tirith (06084:A:1)", () => {
  // The Knight in hand; the heroes given; the Wall and the Target in the staging area.
  function knight(effects: readonly Effect[], heroes: readonly string[], seats: 1 | 2 = 1) {
    const tab = table(effects, { seats, heroes: [...heroes.map((code) => ({ code, seat: 0 })), ...(seats === 2 ? [{ code: ARAGORN, seat: 1 }] : [])], hand: [{ code: KNIGHT, seat: 0 }], staging: [WALL, TARGET] });
    const card = idsOf(tab, KNIGHT);
    return { tab, card, run: play(begin(tab.state), tab, card) };
  }

  // "If each of your heroes has a printed Tactics hero resource icon, Knight of Minas Tirith gains: "Response: After Knight of Minas
  // Tirith enters play, choose an enemy in the staging area. Engage that enemy and exhaust Knight of Minas Tirith to declare it as
  // attacker (and resolve its attack) against that enemy."": with Gimli and Legolas (the other player's Aragorn is not one of your
  // heroes), both enemies in the staging area are offered; the Target is engaged with the player, the Knight is exhausted and his attack
  // (3) against its Defense 1 deals 2 damage.
  lineSpec("06084:A:1", "Knight of Minas Tirith: with only Tactics heroes, after he enters play engage an enemy and attack it", (effects) => {
    const { tab, card, run: played } = knight(effects, [GIMLI, LEGOLAS], 2);
    const target = idsOf(tab, TARGET);
    expect(triggers(played.state, tab)).toContain("06084:response:1");
    let run = sendUnledgered(played, { type: "Trigger", cardId: card, effectId: "06084:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, WALL), target].sort());
    const before = run.steps.length;
    run = sendUnledgered(run, { type: "Choose", optionId: target }, tab.ctx);
    expect(run.state.cards[target]).toMatchObject({ zone: "engaged", controller: 0, damage: 2 });
    expect(run.state.cards[card]?.exhausted).toBe(true);
    expect(run.steps.slice(before).some((step) => step.kind === "strike" && step.side === "player" && step.enemyId === target)).toBe(true);
    expect(run.state.cards[idsOf(tab, WALL)]?.zone).toBe("staging");
  });

  // Aragorn (Leadership) beside Legolas: not each hero has the Tactics icon, so no Response.
  it("06084:A:1 Knight of Minas Tirith: no Response while one of your heroes is not Tactics", () => {
    const { tab, run } = knight(EFFECTS, [ARAGORN, LEGOLAS]);
    expect(triggers(run.state, tab)).not.toContain("06084:response:1");
  });
});

describe("Gondorian Fire (06085:A:1, A:2)", () => {
  // "Attach to a Gondor or Dúnedain hero.": Aragorn (Dúnedain) and Denethor (Gondor) are offered; Legolas (who pays) and the Spearman (a
  // Gondor ally) are not.
  lineSpec("06085:A:1", "Gondorian Fire: Attach to a Gondor or Dúnedain hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: FIRE, seat: 0 }] });
    const card = idsOf(tab, FIRE);
    expect(hosts(tab, card)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, DENETHOR)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, DENETHOR)).state.cards[card]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // Aragorn with the Fire and `resources` in his pool, Legolas beside him.
  function fire(effects: readonly Effect[], resources: number) {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: FIRE, host: ARAGORN }] }, resources);
    return { tab, aragorn: idsOf(tab, ARAGORN), card: idsOf(tab, FIRE) };
  }

  // "Action: Spend 1 resource from attached hero's resource pool to give attached hero +1 Attack for each resource in its resource pool
  // until the end of the phase. (Limit once per phase.)": Aragorn spends 1 of his 6 resources (Legolas spends none) and gets +5 Attack;
  // the Action is not offered again in the phase, and the bonus is gone when the phase ends.
  lineSpec("06085:A:2", "Gondorian Fire: spend 1 resource of the hero for +1 Attack per resource in his pool until the end of the phase", (effects) => {
    const { tab, aragorn, card } = fire(effects, 6);
    const attack = tab.ctx.cards.get(ARAGORN)?.attack ?? 0;
    expect(triggers(tab.state, tab)).toContain("06085:action:1");
    // The resource comes from the attached hero's pool: Legolas cannot pay it.
    const byLegolas = { type: "Trigger", cardId: card, effectId: "06085:action:1", payments: [{ heroId: idsOf(tab, LEGOLAS), amount: 1 }] } as const;
    expect(refusal(tab.state, byLegolas, tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: card, effectId: "06085:action:1", payments: [{ heroId: aragorn, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[aragorn]?.resources).toBe(5);
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.resources).toBe(6);
    expect(stat(run.state, tab, aragorn, "attack")).toBe(attack + 5);
    expect(triggers(run.state, tab)).not.toContain("06085:action:1");
    expect(stat(withMode(run.state, "questCommit"), tab, aragorn, "attack")).toBe(attack);
  });

  // "+1 Attack for each resource in its resource pool until the end of the phase": the resources are counted once, when the effect resolves (rr.lasting-effects), so the
  // bonus does not fall when the hero spends another resource afterwards.
  lineSpec("06085:A:2", "Gondorian Fire: the bonus is counted once, and does not change when the hero spends a resource afterwards", (effects) => {
    const { tab, aragorn, card } = fire(effects, 6);
    const attack = tab.ctx.cards.get(ARAGORN)?.attack ?? 0;
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: card, effectId: "06085:action:1", payments: [{ heroId: aragorn, amount: 1 }] }, tab.ctx);
    expect(stat(run.state, tab, aragorn, "attack")).toBe(attack + 5);
    const spent = updateCard(run.state, aragorn, { resources: 1 });
    expect(stat(spent, tab, aragorn, "attack")).toBe(attack + 5);
  });

  // An empty pool: the resource cannot be spent, so the Action is not offered.
  it("06085:A:2 Gondorian Fire: not offered when the hero's pool is empty", () => {
    const { tab } = fire(EFFECTS, 0);
    expect(triggers(tab.state, tab)).not.toContain("06085:action:1");
  });
});

describe("Pelargir Shipwright (06086:A:1)", () => {
  // "Pelargir Shipwright gets +1 Willpower for each hero you control with a printed Spirit hero resource icon.": Éowyn and the Spirit hero
  // (Spirit) and Aragorn (not) make +2 once he is played; the other player's Spirit hero is not counted.
  lineSpec("06086:A:1", "Pelargir Shipwright: +1 Willpower for each Spirit hero you control", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: SPIRIT, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: SPIRIT, seat: 1 }], hand: [{ code: SHIPWRIGHT, seat: 0 }] });
    const card = idsOf(tab, SHIPWRIGHT);
    const run = play(begin(tab.state), tab, card);
    expect(run.state.cards[card]?.zone).toBe("play");
    expect(stat(run.state, tab, card, "willpower")).toBe((tab.ctx.cards.get(SHIPWRIGHT)?.willpower ?? 0) + 2);
  });
});

describe("Map of Earnil (06087:A:1, A:2, A:3)", () => {
  // "Attach to a Spirit hero.": Éowyn is offered; Aragorn and a plain ally are not.
  lineSpec("06087:A:1", "Map of Earnil: Attach to a Spirit hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: MAP, seat: 0 }] });
    const card = idsOf(tab, MAP);
    expect(hosts(tab, card)).toEqual([idsOf(tab, EOWYN)]);
    expect(play(begin(tab.state), tab, card, idsOf(tab, EOWYN)).state.cards[card]?.host).toBe(idsOf(tab, EOWYN));
  });

  // "Reduce the cost to play Map of Earnil by 1 for each hero you control with a printed Spirit resource icon.": Éowyn and the Spirit hero
  // make the cost 2 (printed 4), and the other player's Spirit hero does not count; with Éowyn and Aragorn it is 3.
  lineSpec("06087:A:2", "Map of Earnil: 1 less for each Spirit hero you control", (effects) => {
    const two = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: SPIRIT, seat: 0 }, { code: SPIRIT, seat: 1 }], hand: [{ code: MAP, seat: 0 }] });
    expect(playCost(two.state, idsOf(two, MAP), 0, two.ctx)).toBe(2);
    const one = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: MAP, seat: 0 }] });
    expect(playCost(one.state, idsOf(one, MAP), 0, one.ctx)).toBe(3);
    const run = sendUnledgered(begin(two.state), { type: "PlayCard", cardId: idsOf(two, MAP), hostId: idsOf(two, EOWYN), payments: [{ heroId: idsOf(two, EOWYN), amount: 2 }] }, two.ctx);
    expect(run.state.cards[idsOf(two, MAP)]?.host).toBe(idsOf(two, EOWYN));
  });

  // Éowyn with the Map; the threat at 30; the discard pile given; a deck of two cards.
  function map(effects: readonly Effect[], pile: readonly string[]) {
    const scene = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], attached: [{ code: MAP, host: EOWYN }], playerDeck: [{ code: CARD, seat: 0 }, { code: CARD, seat: 0 }] });
    const { tab, ids } = discarded({ ...scene, state: withThreat(scene.state, 0, 30) }, pile.map((code) => [code, 0] as const));
    return { tab, ids, card: idsOf(tab, MAP) };
  }

  // "Action: Discard Map of Earnil to play any Spirit event card in your discard pile as if it were in your hand. Then, place that event on
  // the bottom of your deck.": the Map is discarded, The Galadhrim's Greeting is played from the discard pile (Éowyn pays its 3) and
  // reduces the threat by 6, and it ends at the bottom of the deck, not in the discard pile.
  it("06087:A:3 Map of Earnil: discard it to play a Spirit event from the discard pile, then put the event at the bottom of the deck", () => {
    const { tab, ids: [greeting = ""], card } = map(EFFECTS, [GREETING]);
    expect(triggers(tab.state, tab)).toContain("06087:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: card, effectId: "06087:action:1" }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("discard");
    // The Greeting's own choice: reduce one player's threat by 6 (the only player, so the engine takes him).
    expect(choices(run.state, tab).sort()).toEqual(["each", "one"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "one" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[0]?.threat).toBe(30 - 6);
    expect(run.state.cards[idsOf(tab, EOWYN)]?.resources).toBe(6 - 3);
    expect(run.state.cards[greeting]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck.at(-1)).toBe(greeting);
  });

  // Only a neutral event (not Spirit) in the discard pile: nothing to play, so the Action is not offered and the Map stays.
  it("06087:A:3 Map of Earnil: not offered with no Spirit event in the discard pile", () => {
    const { tab } = map(EFFECTS, [CARD]);
    expect(triggers(tab.state, tab)).not.toContain("06087:action:1");
  });
});

describe("Ranger Bow (06088:A:2, A:3)", () => {
  // "Attach to a Ranger character.": Beravor and Faramir (Ranger heroes) and the Ranger ally are offered; Éowyn and a plain ally are not.
  lineSpec("06088:A:2", "Ranger Bow: Attach to a Ranger character", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: FARAMIR, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: RANGER, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: BOW, seat: 0 }] });
    const card = idsOf(tab, BOW);
    expect(hosts(tab, card)).toEqual([idsOf(tab, BERAVOR), idsOf(tab, FARAMIR), idsOf(tab, RANGER)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, RANGER)).state.cards[card]?.host).toBe(idsOf(tab, RANGER));
  });

  // Beravor with the Bow; the staging area and the engaged enemies given.
  const bow = (effects: readonly Effect[], staging: readonly string[]) =>
    table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], attached: [{ code: BOW, host: BERAVOR }], staging, engaged: [{ code: TARGET, seat: 0 }] });

  // "Action: Exhaust Ranger Bow and attached character to deal 1 damage to an enemy in the staging area.": the two Walls in the staging
  // area are offered, the engaged Target is not; the chosen Wall takes 1 damage, the Bow and Beravor are exhausted.
  lineSpec("06088:A:3", "Ranger Bow: exhaust it and the character to deal 1 damage to an enemy in the staging area", (effects) => {
    const tab = bow(effects, [WALL, WALL]);
    const [first = "", second = ""] = tab.ids[WALL] ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, BOW), effectId: "06088:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: second }, tab.ctx);
    expect([second, first, idsOf(tab, TARGET)].map((id) => run.state.cards[id]?.damage)).toEqual([1, 0, 0]);
    expect(run.state.cards[idsOf(tab, BOW)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.exhausted).toBe(true);
  });

  // No enemy in the staging area, or Beravor exhausted: not offered.
  it("06088:A:3 Ranger Bow: not offered with no enemy in the staging area or with the character exhausted", () => {
    expect(triggers(bow(EFFECTS, []).state, bow(EFFECTS, []))).not.toContain("06088:action:1");
    const tab = bow(EFFECTS, [WALL]);
    expect(triggers(updateCard(tab.state, idsOf(tab, BERAVOR), { exhausted: true }), tab)).not.toContain("06088:action:1");
  });
});

describe("Forest Patrol (06089:A:1, A:2)", () => {
  // The Sage (Lore) pays; the Ranger ally for the player or the other player as given; a Wall with a Snare in the staging area and another
  // engaged with the player, and an enemy with no Trap.
  function patrol(effects: readonly Effect[], ranger: number | null, seats: 1 | 2 = 1, traps = true) {
    const scene = table(effects, { seats, heroes: [{ code: SAGE, seat: 0 }, ...(seats === 2 ? [{ code: SAGE, seat: 1 }] : [])], allies: [...(ranger == null ? [] : [{ code: RANGER, seat: ranger }]), ...(traps ? [{ code: SNARE, seat: 0 }, { code: SNARE, seat: 0 }] : [])], hand: [{ code: PATROL, seat: 0 }], staging: [WALL, "f0"], engaged: [{ code: WALL, seat: 0 }] });
    const [staged = "", engaged = ""] = scene.ids[WALL] ?? [];
    const [first = "", second = ""] = scene.ids[SNARE] ?? [];
    const tab = traps ? attach(scene, [[first, staged], [second, engaged]]) : scene;
    return { tab, staged, engaged, card: idsOf(tab, PATROL) };
  }

  // "Play only if you control at least 1 Ranger character.": without a Ranger, or with the Ranger ally controlled by the other player, it
  // is not played; with the player's own Ranger ally it is.
  lineSpec("06089:A:1", "Forest Patrol: played only while you control a Ranger character", (effects) => {
    const none = patrol(effects, null);
    expect(playable(none.tab, none.card)).toBe(false);
    const theirs = patrol(effects, 1, 2);
    expect(playable(theirs.tab, theirs.card)).toBe(false);
    const mine = patrol(effects, 0);
    expect(playable(mine.tab, mine.card)).toBe(true);
  });

  // "Action: Deal 3 damage to an enemy with at least 1 Trap card attached to it.": both Walls with a Snare are offered, the enemy with no
  // Trap is not; the engaged one takes 3.
  it("06089:A:2 Forest Patrol: 3 damage to an enemy with a Trap card attached", () => {
    const { tab, staged, engaged, card } = patrol(EFFECTS, 0);
    let run = play(begin(tab.state), tab, card);
    expect(choices(run.state, tab).sort()).toEqual([engaged, staged].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: engaged }, tab.ctx);
    expect(run.state.cards[engaged]?.damage).toBe(3);
    expect(run.state.cards[staged]?.damage).toBe(0);
  });

  // No enemy with a Trap card: the event is not played.
  it("06089:A:2 Forest Patrol: not played with no enemy with a Trap card attached", () => {
    const { tab, card } = patrol(EFFECTS, 0, 1, false);
    expect(playable(tab, card)).toBe(false);
  });
});

describe("Palantir (06090:A:1)", () => {
  // "Attach to a Noble hero.": Aragorn and Faramir (Noble) are offered; Beravor and the plain ally are not.
  lineSpec("06090:A:1", "Palantir: Attach to a Noble hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: FARAMIR, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: PALANTIR, seat: 0 }] });
    const card = idsOf(tab, PALANTIR);
    expect(hosts(tab, card)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, FARAMIR)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, FARAMIR)).state.cards[card]?.host).toBe(idsOf(tab, FARAMIR));
  });
});
