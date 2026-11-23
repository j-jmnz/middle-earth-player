// Rules: rr.response, rr.action, rr.limits, rr.engaged, rr.optional-engagement, rr.engagement-check, rr.refresh-phase, rr.ranged, rr.modifiers,
// rr.attachment-cards, rr.restricted, rr.unique-cards, rr.doomed-x, rr.lasting-effects, rr.staging-area, rr.ownership-and-control,
// ltp.undefended-attack, rr.triggered-ability, rr.printed (data/rules/entries.json).
// The Nîn-in-Eilph player cards, each line tested from the words on the card: Mablung 08084:A:1, Tighten Our Belts 08086:A:1, Galadhon
// Archer 08087:A:2, Bow of the Galadhrim 08088:A:2 and A:3, Island Amid Perils 08090:A:1, Mirkwood Pioneer 08091:A:1, Wingfoot 08092:A:1,
// Defender of the West 08093:A:1 and A:3. The lines are the text of data/cards/NiE.json (data/printed holds no entry for this pack), so every
// intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";
import { DEAR, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, IntentRefused, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, endRound, enter, hosts, passAll, play, playCode, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const MABLUNG = "08084";
const BELTS = "08086";
const ARCHER = "08087";
const BOW = "08088";
const ISLAND = "08090";
const PIONEER = "08091";
const WINGFOOT = "08092";
const DEFENDER = "08093";
// Core: Aragorn (Leadership Dúnedain Ranger), Legolas (Tactics Silvan hero, Ranged), Éowyn (Spirit), Denethor (Lore Gondor), Beravor
// (Lore Ranger), Guard of the Citadel (a Leadership ally, not unique). Hirluin the Fair: an Outlands hero with Ranged, not Silvan.
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
const BERAVOR = "01012";
const GUARD = "01013";
const HIRLUIN = "06001";
// Guardian of Arnor (a Ranger ally), Beechbone and Lindir (unique allies).
const GUARDIAN = "10116";
const BEECHBONE = "10118";
const LINDIR = "10120";
// Mendor: a unique objective ally with printed stats.
const MENDOR = "01135";
const PAL = "pal";
// A Silvan ally without Ranged; an enemy of threat 2 and a location of threat 1 that
// do not engage; an enemy that the engagement check engages (cost 2); an enemy that attacks for 2 and dies to nothing.
const SILVAN = "silvan";
const FAR = "far";
const SPOT = "spot";
const NEAR = "near";
const BRUTE = "brute";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [MABLUNG, BELTS, ARCHER, BOW, ISLAND, PIONEER, WINGFOOT, DEFENDER, ARAGORN, LEGOLAS, EOWYN, DENETHOR, BERAVOR, GUARD, HIRLUIN, GUARDIAN, BEECHBONE, LINDIR, MENDOR];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(SILVAN, definePrinted({ code: SILVAN, name: "Silvan", type: "ally", sphere: "spirit", cost: 3, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Silvan"] }));
  cards.set(FAR, definePrinted({ code: FAR, name: "Far", type: "enemy", threat: 2, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  cards.set(SPOT, definePrinted({ code: SPOT, name: "Spot", type: "location", threat: 1, questPoints: 3 }));
  cards.set(NEAR, definePrinted({ code: NEAR, name: "Near", type: "enemy", threat: 1, engagementCost: 2, attack: 1, defense: 0, health: 9 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// Whether the engine offers to play the card `cardId` from hand.
const playable = (state: ScenarioState, tab: Table, cardId: string): boolean => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);

describe("Mablung (08084:A:1)", () => {
  // "Response: After you engage an enemy, add 1 resource to Mablung's resource pool. (Limit once per phase.)": the player engages the Dear
  // in the optional engagement step and Mablung gets 1 resource. The engagement check then engages the Near (cost 2, threat 8), which
  // is an engagement too (rr.engaged), but the limit is used: no second Response.
  lineSpec("08084:A:1", "Mablung: after you engage an enemy, 1 resource, once per phase", (effects) => {
    const tab = table(effects, { start: "encounter", heroes: [{ code: MABLUNG, seat: 0 }], staging: [DEAR, NEAR] });
    const mablung = idsOf(tab, MABLUNG);
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, DEAR) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("08084:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: mablung, effectId: "08084:response:1" }, tab.ctx);
    expect(run.state.cards[mablung]?.resources).toBe(6 + 1);
    run = passAll(run, tab.ctx);
    expect(run.state.cards[idsOf(tab, NEAR)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("08084:response:1");
  });

  // An enemy that the engagement check engages is an enemy you engage (rr.engaged): with the Response not yet used, it is offered.
  it("08084:A:1 Mablung: offered when the engagement check engages an enemy", () => {
    const tab = table(EFFECTS, { start: "encounter", heroes: [{ code: MABLUNG, seat: 0 }], staging: [NEAR] });
    const run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, NEAR)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).toContain("08084:response:1");
  });

  // "you": the other player engages an enemy, and Mablung has no Response.
  it("08084:A:1 Mablung: not offered when another player engages an enemy", () => {
    const tab = table(EFFECTS, { seats: 2, start: "encounter", heroes: [{ code: MABLUNG, seat: 0 }, { code: PAL, seat: 1 }], staging: [DEAR] });
    let run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = sendUnledgered(run, { type: "Engage", enemyId: idsOf(tab, DEAR) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, DEAR)]?.controller).toBe(1);
    expect(triggers(run.state, tab)).not.toContain("08084:response:1");
  });
});

describe("Tighten Our Belts (08086:A:1)", () => {
  // Two seats in the planning phase. Aragorn (the only Leadership hero) pays for the Guard of the Citadel, so he spent resources this round;
  // Beravor did not. Then the refresh phase: the second player, first player now, passes its action window so the first player may act.
  function refreshed(effects: readonly Effect[], belts = 1) {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: GUARD, seat: 0 }, ...Array.from({ length: belts }, () => ({ code: BELTS, seat: 0 }))] });
    const spent = playCode(tab, GUARD);
    expect(spent.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 - 2);
    const run = sendUnledgered(enter(spent.state, tab, "refresh"), { type: "Pass" }, tab.ctx);
    expect([run.state.window?.kind, run.state.activeSeat]).toEqual(["frameAction", 0]);
    return { tab, run };
  }

  // "Refresh Action: Choose a player. Each hero that player controls that did not spend any resources this round gains 1 resource.": the
  // first player chooses himself; Beravor gains 1, Aragorn (who spent) gains nothing, and the other player's hero gains nothing.
  lineSpec("08086:A:1", "Tighten Our Belts: each hero of the chosen player that spent nothing this round gains 1", (effects) => {
    const { tab, run: start } = refreshed(effects);
    const [aragorn, beravor, pal] = [idsOf(tab, ARAGORN), idsOf(tab, BERAVOR), idsOf(tab, PAL)];
    const before = [start.state.cards[aragorn]?.resources, start.state.cards[beravor]?.resources, start.state.cards[pal]?.resources];
    let run = play(start, tab, idsOf(tab, BELTS));
    expect(choices(run.state, tab).sort()).toEqual(["seat:0", "seat:1"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:0" }, tab.ctx);
    const after = [run.state.cards[aragorn]?.resources, run.state.cards[beravor]?.resources, run.state.cards[pal]?.resources];
    expect(after).toEqual([before[0], (before[1] ?? 0) + 1, before[2]]);
  });

  // "Only 1 copy of Tighten Our Belts can be played by the players each round.": the second copy is not offered once the first is played.
  it("08086:A:1 Tighten Our Belts: a second copy cannot be played the same round", () => {
    const { tab, run: start } = refreshed(EFFECTS, 2);
    const [first = "", second = ""] = tab.ids[BELTS] ?? [];
    expect(playable(start.state, tab, second)).toBe(true);
    const run = chooseFirst(play(start, tab, first), tab);
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(playable(run.state, tab, second)).toBe(false);
  });

  // Every hero of every player spent resources this round: no hero can gain a resource, so the event can change nothing and is not offered
  // (rr.triggered-ability).
  it("08086:A:1 Tighten Our Belts: not offered when every hero spent resources this round", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: GUARD, seat: 0 }, { code: BELTS, seat: 0 }] });
    const run = enter(playCode(tab, GUARD).state, tab, "refresh");
    // The only card that could be played there can change nothing, so the refresh action window does not open as one for it.
    expect([run.state.window?.kind, run.state.activeSeat]).toEqual(["pass", 0]);
    expect(playable(run.state, tab, idsOf(tab, BELTS))).toBe(false);
  });

  // "Refresh Action": in the planning phase it is not offered.
  it("08086:A:1 Tighten Our Belts: not offered in the planning phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: BELTS, seat: 0 }] });
    expect(playable(tab.state, tab, idsOf(tab, BELTS))).toBe(false);
  });
});

// Answers one question with its first option.
const chooseFirst = (run: ReturnType<typeof begin>, tab: Table) => sendUnledgered(run, { type: "Choose", optionId: choices(run.state, tab)[0] ?? "" }, tab.ctx);

describe("Galadhon Archer (08087:A:2)", () => {
  // Legolas pays for the Archer. The Far is in the staging area, the Brute engaged with the player, the Dear engaged with the other player.
  const scene = (effects: readonly Effect[], seat1 = true) =>
    table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: ARCHER, seat: 0 }], staging: seat1 ? [FAR] : [], engaged: [{ code: BRUTE, seat: 0 }, ...(seat1 ? [{ code: DEAR, seat: 1 }] : [])] });

  // "Response: After Galadhon Archer enters play, deal 1 damage to an enemy not engaged with you.": the enemy in the staging area and the
  // one engaged with the other player may be chosen; the one engaged with you may not. The Dear takes 1 damage.
  lineSpec("08087:A:2", "Galadhon Archer: after it enters play, 1 damage to an enemy not engaged with you", (effects) => {
    const tab = scene(effects);
    const [archer, far, brute, dear] = [idsOf(tab, ARCHER), idsOf(tab, FAR), idsOf(tab, BRUTE), idsOf(tab, DEAR)];
    let run = play(begin(tab.state), tab, archer);
    expect(triggers(run.state, tab)).toContain("08087:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: archer, effectId: "08087:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["engagedOther", "staging"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "engagedOther" }, tab.ctx);
    expect(run.state.cards[dear]?.damage).toBe(1);
    expect(run.state.cards[far]?.damage).toBe(0);
    expect(run.state.cards[brute]?.damage).toBe(0);
  });

  // Only an enemy engaged with you: no enemy can be chosen, so the Response is not offered.
  it("08087:A:2 Galadhon Archer: not offered when every enemy is engaged with you", () => {
    const tab = scene(EFFECTS, false);
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, ARCHER)).state, tab)).not.toContain("08087:response:1");
  });
});

describe("Bow of the Galadhrim (08088:A:2, A:3)", () => {
  // "Attach to a Silvan character with the ranged keyword.": the Galadhon Archer and Legolas (Silvan, Ranged) are offered; the Silvan ally
  // without Ranged and Hirluin (Ranged, not Silvan) are not.
  lineSpec("08088:A:2", "Bow of the Galadhrim: Attach to a Silvan character with the ranged keyword", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: HIRLUIN, seat: 0 }], allies: [{ code: ARCHER, seat: 0 }, { code: SILVAN, seat: 0 }], hand: [{ code: BOW, seat: 0 }] });
    const bow = idsOf(tab, BOW);
    expect(hosts(tab, bow)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, ARCHER)].sort());
    expect(play(begin(tab.state), tab, bow, idsOf(tab, ARCHER)).state.cards[bow]?.host).toBe(idsOf(tab, ARCHER));
  });

  // The Archer with the Bow; the Brute is engaged with the player and the Dear with the other player.
  const bowScene = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ARCHER, seat: 0 }], hand: [{ code: BOW, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }, { code: DEAR, seat: 1 }] });
  const strikes = (run: ReturnType<typeof begin>) => run.steps.flatMap((step) => (step.kind === "strike" && step.side === "player" ? [[step.enemyId, step.attack]] : []));

  // "Attached character gets +1 Attack (+2 Attack instead if attacking an enemy not engaged with you.)": played on the Archer (Attack 2),
  // it gives 3; the Archer's ranged attack on the Dear, engaged with the other player, strikes with 4.
  lineSpec("08088:A:3", "Bow of the Galadhrim: +1 Attack, +2 instead attacking an enemy not engaged with you", (effects) => {
    const tab = bowScene(effects);
    const archer = idsOf(tab, ARCHER);
    const played = play(begin(tab.state), tab, idsOf(tab, BOW), archer);
    expect(stat(played.state, tab, archer, "attack")).toBe(printed(tab, ARCHER, "attack") + 1);
    const run = sendUnledgered(begin(attacking(played.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, DEAR), attackerIds: [archer] }, tab.ctx);
    expect(strikes(run)).toEqual([[idsOf(tab, DEAR), printed(tab, ARCHER, "attack") + 2]]);
  });

  // The Archer attacks the Brute, engaged with its own player: +1 only.
  it("08088:A:3 Bow of the Galadhrim: +1 only attacking an enemy engaged with you", () => {
    const tab = bowScene(EFFECTS);
    const archer = idsOf(tab, ARCHER);
    const played = play(begin(tab.state), tab, idsOf(tab, BOW), archer);
    const run = sendUnledgered(begin(attacking(played.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, BRUTE), attackerIds: [archer] }, tab.ctx);
    expect(strikes(run)).toEqual([[idsOf(tab, BRUTE), printed(tab, ARCHER, "attack") + 1]]);
  });
});

describe("Island Amid Perils (08090:A:1)", () => {
  // "Action: Return a Silvan ally you control to your hand to reduce your threat by X where X is the printed cost of the ally returned to
  // your hand.": the Archer (cost 2) and the Silvan ally (cost 3) are offered; the Guard (not Silvan), Legolas (a Silvan hero) and the
  // other player's Archer are not. The Silvan ally goes back to the hand and the threat drops from 8 to 5.
  lineSpec("08090:A:1", "Island Amid Perils: returns a Silvan ally to the hand to lower the threat by its printed cost", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ARCHER, seat: 0 }, { code: SILVAN, seat: 0 }, { code: GUARD, seat: 0 }, { code: ARCHER, seat: 1 }], hand: [{ code: ISLAND, seat: 0 }] });
    const silvan = idsOf(tab, SILVAN);
    let run = play(begin(tab.state), tab, idsOf(tab, ISLAND));
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, ARCHER), silvan].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: silvan }, tab.ctx);
    expect(run.state.cards[silvan]?.zone).toBe("hand");
    expect(run.state.seats[0]?.threat).toBe(8 - 3);
    expect(run.state.seats[1]?.threat).toBe(6);
  });

  // No Silvan ally you control (the other player's Archer is not yours): not offered.
  it("08090:A:1 Island Amid Perils: not offered without a Silvan ally you control", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: GUARD, seat: 0 }, { code: ARCHER, seat: 1 }], hand: [{ code: ISLAND, seat: 0 }] });
    expect(playable(tab.state, tab, idsOf(tab, ISLAND))).toBe(false);
  });
});

describe("Mirkwood Pioneer (08091:A:1)", () => {
  // Beravor pays for the Pioneer. The Far (threat 2) and the Spot (threat 1) are in the staging area; two seats at threat 8 and 6.
  const scene = (effects: readonly Effect[], staging: readonly string[] = [FAR, SPOT]) =>
    table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: PIONEER, seat: 0 }], staging });

  // "You may give Mirkwood Pioneer doomed 1 when you play it from your hand. If you do, it gains: "Response: After you play Mirkwood
  // Pioneer, choose a card in the staging area. Until the end of the round, the chosen card does not contribute its Threat."": doomed 1
  // raises each player's threat by 1 (rr.doomed-x); both cards of the staging area may be chosen; the Far's 2 threat is not counted until
  // the round ends.
  lineSpec("08091:A:1", "Mirkwood Pioneer: doomed 1, and the chosen staging card adds no threat until the end of the round", (effects) => {
    const tab = scene(effects);
    const [pioneer, far] = [idsOf(tab, PIONEER), idsOf(tab, FAR)];
    expect(stagingThreat(tab.state, tab.ctx.cards)).toBe(2 + 1);
    let run = play(begin(tab.state), tab, pioneer);
    expect(triggers(run.state, tab)).toContain("08091:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: pioneer, effectId: "08091:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([far, idsOf(tab, SPOT)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: far }, tab.ctx);
    expect([run.state.seats[0]?.threat, run.state.seats[1]?.threat]).toEqual([8 + 1, 6 + 1]);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(1);
    expect(stagingThreat(endRound(run.state, tab).state, tab.ctx.cards)).toBe(2 + 1);
  });

  // "You may": played without the Response, no threat is raised.
  it("08091:A:1 Mirkwood Pioneer: no doomed when the player does not use it", () => {
    const tab = scene(EFFECTS);
    const run = sendUnledgered(play(begin(tab.state), tab, idsOf(tab, PIONEER)), { type: "Pass" }, tab.ctx);
    expect([run.state.seats[0]?.threat, run.state.seats[1]?.threat]).toEqual([8, 6]);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(2 + 1);
  });

  // An empty staging area: no card can be chosen, so the Response is not offered.
  it("08091:A:1 Mirkwood Pioneer: not offered with an empty staging area", () => {
    const tab = scene(EFFECTS, []);
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, PIONEER)).state, tab)).not.toContain("08091:response:1");
  });
});

describe("Wingfoot (08092:A:1)", () => {
  // "Attach to a Ranger hero.": Mablung and Aragorn (Ranger heroes) are offered; Denethor (who pays) and the Guardian of Arnor (a Ranger
  // ally) are not.
  lineSpec("08092:A:1", "Wingfoot: Attach to a Ranger hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: MABLUNG, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: GUARDIAN, seat: 0 }], hand: [{ code: WINGFOOT, seat: 0 }] });
    const wingfoot = idsOf(tab, WINGFOOT);
    expect(hosts(tab, wingfoot)).toEqual([idsOf(tab, MABLUNG), idsOf(tab, ARAGORN)].sort());
    expect(play(begin(tab.state), tab, wingfoot, idsOf(tab, MABLUNG)).state.cards[wingfoot]?.host).toBe(idsOf(tab, MABLUNG));
  });
});

describe("Defender of the West (08093:A:1, A:3)", () => {
  // "Attach to a non-objective unique ally in play.": Beechbone and the other player's Lindir (unique allies) are offered; the Guard (not
  // unique) and Éowyn (a hero) are not.
  lineSpec("08093:A:1", "Defender of the West: Attach to a unique ally in play", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: BEECHBONE, seat: 0 }, { code: GUARD, seat: 0 }, { code: LINDIR, seat: 1 }], hand: [{ code: DEFENDER, seat: 0 }] });
    const defender = idsOf(tab, DEFENDER);
    expect(hosts(tab, defender)).toEqual([idsOf(tab, BEECHBONE), idsOf(tab, LINDIR)].sort());
    expect(play(begin(tab.state), tab, defender, idsOf(tab, BEECHBONE)).state.cards[defender]?.host).toBe(idsOf(tab, BEECHBONE));
  });

  // "Attach to a non-objective unique ally": Mendor, a unique objective ally the player controls (an ally for picks, src/rules/interpret/pick.ts), is not offered.
  lineSpec("08093:A:1", "Defender of the West: a unique objective ally is not offered", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: BEECHBONE, seat: 0 }, { code: MENDOR, seat: 0 }], hand: [{ code: DEFENDER, seat: 0 }] });
    expect(tab.state.cards[idsOf(tab, MENDOR)]?.zone).toBe("play");
    expect(hosts(tab, idsOf(tab, DEFENDER))).toEqual([idsOf(tab, BEECHBONE)]);
  });

  // Beechbone holds the Defender; the Brute (Attack 2) is engaged with `seat`.
  const defended = (effects: readonly Effect[], seat: 0 | 1) =>
    table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: BEECHBONE, seat: 0 }], hand: [{ code: DEFENDER, seat: 0 }], engaged: [{ code: BRUTE, seat }] });

  // "Damage from undefended attacks against you may be assigned to attached ally.": the Defender is played on Beechbone; the Brute's
  // attack on the player is left undefended and its 2 damage go on Beechbone, none on Éowyn.
  lineSpec("08093:A:3", "Defender of the West: damage from an undefended attack against you may go on the attached ally", (effects) => {
    const tab = defended(effects, 0);
    const beechbone = idsOf(tab, BEECHBONE);
    const played = play(begin(tab.state), tab, idsOf(tab, DEFENDER), beechbone);
    let run = passAll(combat(played.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "Undefended", heroId: beechbone }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[beechbone]?.damage).toBe(2);
    expect(run.state.cards[idsOf(tab, EOWYN)]?.damage).toBe(0);
  });

  // "against you": the Brute attacks the other player, whose undefended damage cannot go on Beechbone.
  it("08093:A:3 Defender of the West: damage from an undefended attack against another player cannot go on the attached ally", () => {
    const tab = defended(EFFECTS, 1);
    const beechbone = idsOf(tab, BEECHBONE);
    const played = play(begin(tab.state), tab, idsOf(tab, DEFENDER), beechbone);
    const run = passAll(combat(played.state, tab), tab.ctx);
    expect([run.state.window?.kind, run.state.activeSeat]).toEqual(["defense", 1]);
    expect(() => sendUnledgered(run, { type: "Undefended", heroId: beechbone }, tab.ctx)).toThrow(IntentRefused);
  });
});
