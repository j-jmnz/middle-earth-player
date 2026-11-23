// Rules: rr.resource-match, rr.action, rr.response, rr.limits, rr.triggered-ability, rr.cannot, rr.discard-pile-and-victory-display,
// rr.engaged, rr.optional-engagement, rr.play-restrictions-and-permissions, rr.unique-cards (data/rules/entries.json).
// The Mûmakil heroes, allies, events and side quest, each printed line tested from the words on the card: Kahliel 17001:A:1 and A:2,
// Andrath Guardsman 17002:A:1, Prepare for Battle 17003:A:1, Yazan 17004:A:2, Coney in a Trap 17009:A:1 (the attachments are in
// the-mumakil-attachments.test.ts). The lines are the text of data/cards (data/printed holds no ledger for this pack), so every intent goes
// through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, endRound, enter, passAll, play, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const KAHLIEL = "17001";
const GUARDSMAN = "17002";
const PREPARE = "17003";
const YAZAN = "17004";
const CONEY = "17009";
// Gondorian Spearman: a Tactics ally that is not Harad.
const SPEARMAN = "01029";
// Cards with no text: Harad allies (Tactics and Lore), a Harad hero, and Lore heroes and an ally with the traits Coney in a Trap reads.
const HARAD = "harad";
const SCOUT = "harad-scout";
const HARAD_HERO = "harad-hero";
const RANGER = "ranger";
const WARRIOR = "warrior";
const BOTH = "ranger-warrior";
const COMMON_RANGER = "common-ranger";
const PAL = "pal";
const ALLY = "ally";
// Enemies of Attack 0 and 9 hit points (no attack here damages a hero, none destroys them): two non-unique ones and a unique one.
const WALL = "wall";
const MOAT = "moat";
const BOSS = "boss";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([KAHLIEL, GUARDSMAN, PREPARE, YAZAN, CONEY, SPEARMAN]))]);
  cards.set(HARAD, definePrinted({ code: HARAD, name: "Harad", type: "ally", sphere: "tactics", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Harad"] }));
  cards.set(SCOUT, definePrinted({ code: SCOUT, name: "Harad Scout", type: "ally", sphere: "lore", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Harad"] }));
  cards.set(HARAD_HERO, definePrinted({ code: HARAD_HERO, name: "Harad Hero", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Harad"], isUnique: true }));
  cards.set(RANGER, definePrinted({ code: RANGER, name: "Ranger", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Ranger"], isUnique: true }));
  cards.set(WARRIOR, definePrinted({ code: WARRIOR, name: "Warrior", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Warrior"], isUnique: true }));
  cards.set(BOTH, definePrinted({ code: BOTH, name: "Ranger Warrior", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Ranger", "Warrior"], isUnique: true }));
  cards.set(COMMON_RANGER, definePrinted({ code: COMMON_RANGER, name: "Common Ranger", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Ranger"] }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 0, defense: 3, health: 9 }));
  cards.set(MOAT, definePrinted({ code: MOAT, name: "Moat", type: "enemy", threat: 1, engagementCost: 40, attack: 0, defense: 3, health: 9 }));
  cards.set(BOSS, definePrinted({ code: BOSS, name: "Boss", type: "enemy", threat: 1, engagementCost: 40, attack: 0, defense: 3, health: 9, isUnique: true }));
  base = { ...starter, cards };
});

// The enemies that make an attack against the first seat in the combat phase, every attack left undefended (the seat's first hero takes
// it). The kit has no reader of the attacks a phase makes, so this file keeps this one helper.
function attacks(state: ScenarioState, tab: Table): string[] {
  let run = enter(state, tab, "enemyAttacks");
  const seen: string[] = [];
  const passable = (next: ScenarioState) => legalIntents(next, tab.ctx).some((intent) => intent.type === "Pass");
  for (let guard = 0; guard < 12 && run.state.window != null && run.state.mode === "enemyAttacks"; guard += 1) {
    const window = run.state.window;
    if (window.kind === "chooseEnemy") {
      run = sendUnledgered(run, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, tab.ctx);
    } else if (window.kind === "defense") {
      if (window.seat === 0) seen.push(window.enemyId);
      run = sendUnledgered(run, { type: "Undefended", heroId: run.state.seats[window.seat]?.heroes[0] ?? "" }, tab.ctx);
    } else if (passable(run.state)) {
      run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    } else break;
  }
  return seen;
}

describe("Kahliel (17001:A:1, A:2)", () => {
  // "You may use resources from Kahliel's resource pool to pay for Harad ally cards of any sphere.": Kahliel (Leadership) alone pays for a
  // Tactics Harad ally, not for the Gondorian Spearman (Tactics, not Harad).
  lineSpec("17001:A:1", "Kahliel pays for a Harad ally of any sphere", (effects) => {
    const tab = table(effects, { heroes: [{ code: KAHLIEL, seat: 0 }], hand: [{ code: HARAD, seat: 0 }, { code: SPEARMAN, seat: 0 }] });
    const kahliel = idsOf(tab, KAHLIEL);
    const harad = { type: "PlayCard", cardId: idsOf(tab, HARAD), payments: [{ heroId: kahliel, amount: 2 }] } as const;
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, SPEARMAN), payments: [{ heroId: kahliel, amount: 2 }] }, tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(tab.state), harad, tab.ctx);
    expect(run.state.cards[idsOf(tab, HARAD)]?.zone).toBe("play");
    expect(run.state.cards[kahliel]?.resources).toBe(6 - 2);
  });

  // "Action: Discard a Harad ally card from your hand to ready a Harad character in play. (Limit once per phase.)": two Harad allies in
  // hand (and a plain ally), Kahliel and the other player's Harad hero exhausted. The player picks which Harad ally to discard and which
  // Harad character to ready; the second use in the phase is not offered.
  lineSpec("17001:A:2", "Kahliel: discard a Harad ally from hand to ready a Harad character, once per phase", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: KAHLIEL, seat: 0 }, { code: HARAD_HERO, seat: 1 }], hand: [{ code: HARAD, seat: 0 }, { code: SCOUT, seat: 0 }, { code: ALLY, seat: 0 }] });
    const [kahliel, other, first, second] = [idsOf(scene, KAHLIEL), idsOf(scene, HARAD_HERO), idsOf(scene, HARAD), idsOf(scene, SCOUT)];
    const state = updateCard(updateCard(scene.state, kahliel, { exhausted: true }), other, { exhausted: true });
    let run = sendUnledgered(begin(state), { type: "Trigger", cardId: kahliel, effectId: "17001:action:1" }, scene.ctx);
    expect(choices(run.state, scene).sort()).toEqual([first, second].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: second }, scene.ctx);
    expect(run.state.cards[second]?.zone).toBe("discard");
    expect(choices(run.state, scene).sort()).toEqual([kahliel, other].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: other }, scene.ctx);
    expect(run.state.cards[other]?.exhausted).toBe(false);
    expect(run.state.cards[kahliel]?.exhausted).toBe(true);
    expect(run.state.cards[first]?.zone).toBe("hand");
    // Limit once per phase: Kahliel is still exhausted and a Harad ally is still in hand, but the Action is not offered again.
    expect(triggers(run.state, scene)).not.toContain("17001:action:1");
  });

  // A plain ally in hand is not a Harad ally: nothing to discard, so the Action is not offered.
  it("17001:A:2 Kahliel: not offered without a Harad ally in hand", () => {
    const tab = table(EFFECTS, { heroes: [{ code: KAHLIEL, seat: 0 }], hand: [{ code: ALLY, seat: 0 }] });
    expect(triggers(updateCard(tab.state, idsOf(tab, KAHLIEL), { exhausted: true }), tab)).not.toContain("17001:action:1");
  });

  // An exhausted character that is not Harad cannot be readied by it: with no exhausted Harad character the Action is not offered.
  it("17001:A:2 Kahliel: not offered when no Harad character is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: KAHLIEL, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: HARAD, seat: 0 }] });
    expect(triggers(updateCard(tab.state, idsOf(tab, PAL), { exhausted: true }), tab)).not.toContain("17001:action:1");
  });
});

describe("Andrath Guardsman (17002:A:1)", () => {
  // Kahliel (Leadership) pays; two non-unique enemies and a unique one engaged with the first player, a non-unique one engaged with the
  // other player and one in the staging area.
  const scene = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: KAHLIEL, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: GUARDSMAN, seat: 0 }], engaged: [{ code: WALL, seat: 0 }, { code: MOAT, seat: 0 }, { code: BOSS, seat: 0 }, { code: "f0", seat: 1 }], staging: ["f3"] });

  // "Response: After you play Andrath Guardsman from your hand, choose a non-unique enemy engaged with you. That enemy cannot attack you
  // this round.": only the two non-unique enemies engaged with the first player can be chosen; the chosen one makes no attack this round
  // and attacks again the next round.
  lineSpec("17002:A:1", "Andrath Guardsman: the chosen non-unique enemy engaged with you cannot attack you this round", (effects) => {
    const tab = scene(effects);
    const [guardsman, wall, moat, boss] = [idsOf(tab, GUARDSMAN), idsOf(tab, WALL), idsOf(tab, MOAT), idsOf(tab, BOSS)];
    let run = play(begin(tab.state), tab, guardsman);
    expect(triggers(run.state, tab)).toContain("17002:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: guardsman, effectId: "17002:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([wall, moat].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: wall }, tab.ctx);
    expect(attacks(run.state, tab).sort()).toEqual([moat, boss].sort());
    const next = endRound(run.state, tab);
    expect(attacks(next.state, tab)).toContain(wall);
  });

  // A unique enemy engaged with you and a non-unique one engaged with the other player cannot be chosen: with no other enemy the Response
  // is not offered (rr.triggered-ability).
  it("17002:A:1 Andrath Guardsman: no Response with no non-unique enemy engaged with you", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: KAHLIEL, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: GUARDSMAN, seat: 0 }], engaged: [{ code: BOSS, seat: 0 }, { code: WALL, seat: 1 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, GUARDSMAN));
    expect(triggers(run.state, tab)).not.toContain("17002:response:1");
  });
});

describe("Prepare for Battle (17003:A:1)", () => {
  // "Limit 1 copy of Prepare for Battle in the victory display.": two copies are played from the hand into the staging area. The first,
  // given its quest points in progress, is defeated into the victory display as the second is played; the second, defeated in turn, goes
  // to its owner's discard pile, and the victory display holds the first copy only.
  lineSpec("17003:A:1", "Prepare for Battle: a second copy defeated goes to the discard pile, not the victory display", (effects) => {
    const tab = table(effects, { heroes: [{ code: KAHLIEL, seat: 0 }], hand: [{ code: PREPARE, seat: 0 }, { code: PREPARE, seat: 0 }] });
    const [shown = "", second = ""] = tab.ids[PREPARE] ?? [];
    const points = tab.ctx.cards.get(PREPARE)?.questPoints ?? 0;
    const first = play(begin(tab.state), tab, shown);
    expect(first.state.cards[shown]?.zone).toBe("staging");
    let run = play({ ...first, state: updateCard(first.state, shown, { progress: points }) }, tab, second);
    expect(run.state.victory).toEqual([shown]);
    expect(run.state.cards[second]?.zone).toBe("staging");
    run = sendUnledgered({ ...run, state: updateCard(run.state, second, { progress: points }) }, { type: "Pass" }, tab.ctx);
    expect(run.state.victory).toEqual([shown]);
    expect(run.state.seats[0]?.discard).toContain(second);
  });
});

describe("Yazan (17004:A:2)", () => {
  // Yazan and Kahliel (to ready him) for the first player; Wall and the unique Boss engaged with him, Moat engaged with the other player,
  // f3 in the staging area. A second Harad ally in hand pays Kahliel's Action.
  const scene = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: KAHLIEL, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: YAZAN, seat: 0 }], hand: [{ code: HARAD, seat: 0 }], engaged: [{ code: WALL, seat: 0 }, { code: BOSS, seat: 0 }, { code: MOAT, seat: 1 }], staging: ["f3"] });

  // "Response: After Yazan is declared as an attacker, deal 1 damage to a non-unique enemy in play. (Limit once per phase.)": any
  // non-unique enemy in play can be chosen (engaged with either player or in the staging area), the unique Boss cannot; the chosen one
  // takes 1 damage. Readied by Kahliel, Yazan attacks again in the same phase and the Response is not offered.
  lineSpec("17004:A:2", "Yazan: after he is declared as an attacker, 1 damage to a non-unique enemy in play, once per phase", (effects) => {
    const tab = scene(effects);
    const [yazan, kahliel, wall, boss, moat, staged] = [idsOf(tab, YAZAN), idsOf(tab, KAHLIEL), idsOf(tab, WALL), idsOf(tab, BOSS), idsOf(tab, MOAT), idsOf(tab, "f3")];
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: boss, attackerIds: [yazan] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("17004:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: yazan, effectId: "17004:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([wall, moat, staged].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: staged }, tab.ctx);
    expect(run.state.cards[staged]?.damage).toBe(1);
    expect(run.state.cards[wall]?.damage).toBe(0);
    // Kahliel's Action readies Yazan in the window before the attack strikes.
    expect(run.state.cards[yazan]?.exhausted).toBe(true);
    expect(run.state.window?.kind).toBe("frameAction");
    run = sendUnledgered(run, { type: "Trigger", cardId: kahliel, effectId: "17001:action:1" }, tab.ctx);
    expect(run.state.cards[yazan]?.exhausted).toBe(false);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.window?.kind).toBe("playerAttack");
    run = sendUnledgered(run, { type: "DeclareAttackers", enemyId: moat, attackerIds: [yazan] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("17004:response:1");
  });

  // With only unique enemies in play there is no non-unique enemy to damage: the Response is not offered.
  it("17004:A:2 Yazan: not offered when every enemy in play is unique", () => {
    const tab = table(EFFECTS, { heroes: [{ code: KAHLIEL, seat: 0 }], allies: [{ code: YAZAN, seat: 0 }], engaged: [{ code: BOSS, seat: 0 }] });
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, BOSS), attackerIds: [idsOf(tab, YAZAN)] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("17004:response:1");
  });
});

describe("Coney in a Trap (17009:A:1)", () => {
  // Coney in a Trap in hand and the heroes given; the player engages the enemy in the staging area.
  function engaged(effects: readonly Effect[], heroes: readonly string[], allies: readonly string[] = []): { tab: Table; run: Run } {
    const tab = table(effects, { start: "encounter", heroes: heroes.map((code) => ({ code, seat: 0 })), allies: allies.map((code) => ({ code, seat: 0 })), hand: [{ code: CONEY, seat: 0 }], staging: [WALL] });
    return { tab, run: sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, WALL) }, tab.ctx) };
  }

  // "Play only if you control a unique character with the Ranger trait and another unique character with the Warrior trait.": with a
  // unique Ranger and a unique Warrior it is played in answer to the engagement; with one unique Ranger-Warrior (no other) or with a
  // non-unique Ranger it is not offered.
  lineSpec("17009:A:1", "Coney in a Trap: only with a unique Ranger and another unique Warrior", (effects) => {
    const both = engaged(effects, [BOTH, PAL]);
    expect(triggers(both.run.state, both.tab)).not.toContain("17009:response:1");
    const common = engaged(effects, [WARRIOR, PAL], [COMMON_RANGER]);
    expect(triggers(common.run.state, common.tab)).not.toContain("17009:response:1");
    const { tab, run } = engaged(effects, [RANGER, WARRIOR]);
    expect(triggers(run.state, tab)).toContain("17009:response:1");
    const played = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, CONEY), effectId: "17009:response:1", payments: [{ heroId: idsOf(tab, RANGER), amount: 1 }] }, tab.ctx);
    expect(played.state.cards[idsOf(tab, CONEY)]?.zone).toBe("discard");
  });
});
