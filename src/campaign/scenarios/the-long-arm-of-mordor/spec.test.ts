// Rules: hrd.objective-heroes, hrd.objective-hero-elimination, hrd.stage-number, hrd.side-quests-in-play, rr.forced, rr.response, rr.travel, rr.shadow-effects, rr.player-elimination, rr.modifiers, rr.immune, rr.engaged, rr.cannot, rr.lasting-effects (data/rules/entries.json); ledger lines of The Long Arm of Mordor (data/printed/haradrim.json).
import { describe, expect, it } from "vitest";

import { stagingThreat as stagingThreatOf } from "../../../rules/quest/quest.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { destroyCard } from "../../../rules/core/destroy.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { spawn, moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { validatePayments } from "../../../rules/player/payments.ts";
import { limitSpent } from "../../../rules/player/usage.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { captivesOf } from "../../../rules/families/captives/values.ts";
import { stagedHeroes } from "../../../rules/families/haradrim/staged.ts";
import { heroGuardedBy } from "../../../rules/families/wilderland/carried.ts";
import { idOf, idsOf, opened, resolveRecords, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { announce, answer, attack, cardSpecs, count, damageOn, defend, endPhase, endRound, exhausted, flag, handCount, resolve, resourcesOn, stagingThreat, stat, offers, travel, window, zone, notWon, quest, won, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Long Arm of Mordor (haradrim part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; the enemy f0 has Attack 1 and no Threat. Stage 1 is the default stage (16071), stage 3 is 16073 (the stage number X reads). The objective-heroes sit among the heroes of their seat.
const STAGE_2 = "16072";
const STAGE_3 = "16073";
const STAGE_4 = "16074";
const KAHLIEL = "16031";
const FIRYAL = "16032";
const YAZAN = "16033";
const JUBAYR = "16034";

// A layout with objective-heroes among the heroes of their seats, as TakeObjectiveHero leaves them: the modifier heroType keeps each one among the heroes (it is no hero by printed type).
type Hero = { code: string; seat: number; resources?: number };
const objective = (layout: Layout, ...heroes: readonly Hero[]): Layout => ({ ...layout, heroes, modified: heroes.map((hero) => ({ code: hero.code, from: hero.code, stats: [["heroType", 1]] as const })) });

const ROWS: readonly Row[] = [
  // 16031:A:1 "Response: At the beginning of the planning phase, add 1 resource to a hero's pool." Any hero, the other player's too.
  { line: "16031:A:1", name: "Response: at the beginning of the planning phase 1 resource goes to the pool of a hero of any player", layout: objective({ seats: 2, phase: "Planning" }, { code: KAHLIEL, seat: 0 }), act: [resolve(KAHLIEL, "response"), answer("dh3")], expect: resourcesOn("dh3", 1) },

  // 16032:A:1 "Response: After Firyal commits to a quest, look at the top card of the encounter deck. Then, you may discard that card."
  { line: "16032:A:1", name: "Response: after she commits the top card of the encounter deck is looked at and may be discarded", layout: objective({ deck: ["f0", "f3"] }, { code: FIRYAL, seat: 0 }), act: [resolve(FIRYAL, "response"), answer("discard")], expect: [zone("f0", "encounterDiscard"), zone("f3", "encounterDeck")] },

  // 16033:A:2 "Response: After Yazan is declared as an attacker, deal 1 damage to a non-unique enemy in play."
  { line: "16033:A:2", name: "Response: after he is declared as an attacker 1 damage is dealt to a non-unique enemy in play", layout: objective({ staging: ["f0"] }, { code: YAZAN, seat: 0 }), act: resolve(YAZAN, "response"), expect: damageOn("f0", 1) },

  // 16035:A:1 "X is the stage number on the main quest." Stage 3: the Threat, Attack and Defense it prints as X are 3.
  { line: "16035:A:1", name: "X, its Threat, Attack and Defense, is the stage number of the main quest", layout: { stage: STAGE_3, staging: ["16035"] }, act: [], expect: [stat("16035", "threat", 3), stat("16035", "attack", 3), stat("16035", "defense", 3)] },

  // 16036:A:1 "X is the stage number of the main quest." Stage 2.
  { line: "16036:A:1", name: "X, its Threat, is the stage number of the main quest", layout: { stage: STAGE_2, staging: ["16036"] }, act: [], expect: stat("16036", "threat", 2) },
  // 16036:A:2 "Travel: Each player spends 1 resource to travel here." The round runs on to the next resource phase, where each hero gains 1 resource: 2 held, 1 spent and 1 gained is 2 (3 without the cost). Each player's only resources are on the objective-hero, which has no sphere: a resource of any hero pays, with no match.
  { line: "16036:A:2", name: "Travel: each player spends 1 resource from any hero he controls, an objective-hero with no sphere included", layout: objective({ seats: 2, phase: "Travel", staging: ["16036"] }, { code: KAHLIEL, seat: 0, resources: 2 }, { code: FIRYAL, seat: 1, resources: 2 }), act: travel("16036"), expect: [resourcesOn(KAHLIEL, 2), resourcesOn(FIRYAL, 2), zone("16036", "activeLocation")] },
  { line: "16036:A:2", name: "Travel: with a player who has no resource to spend the players cannot travel here", layout: objective({ seats: 2, phase: "Travel", staging: ["16036"] }, { code: KAHLIEL, seat: 0, resources: 1 }), act: [], expect: offers("Travel", undefined, false) },
  // 16036:A:3 "Shadow: If the defending character is an objective-hero, ready it and cancel all damage from this attack." The enemy f3 has Attack 1 against Defense 2 and the hero takes none, so its Defense 1 drives the damage through: a stronger enemy is dealt.
  { line: "16036:A:3", name: "Shadow: the objective-hero that defends is readied and the attack deals it no damage", layout: objective({ stage: STAGE_3 }, { code: KAHLIEL, seat: 0 }), act: [attack("16035", { shadow: "16036" }), defend(KAHLIEL)], expect: [exhausted(KAHLIEL, false), damageOn(KAHLIEL, 0)] },

  // 16037:A:1 "Response: After the players travel to Village Hut, the first player discards the top card of his deck. If that card is an ally, he puts it into play under his control, exhausted." The first player is the second seat, whose deck holds an ally on top.
  { line: "16037:A:1", name: "Response: after the players travel the first player discards the top card of his deck and an ally goes into play exhausted", layout: { seats: 2, firstPlayer: 1, phase: "Travel", staging: ["16037"], deckOf: [{ code: "ally", seat: 1 }, { code: "filler", seat: 0 }] }, act: [travel("16037"), resolve("16037", "response")], expect: [count("ally", "play", 1), exhausted("ally")] },
  // 16037:A:2 "Travel: Discard the top card of the encounter deck. If that card is an enemy, add it to the staging area."
  { line: "16037:A:2", name: "Travel: the top card of the encounter deck is discarded and an enemy is added to the staging area", layout: { phase: "Travel", staging: ["16037"], deck: ["f0", "f3"] }, act: travel("16037"), expect: [zone("f0", "staging"), zone("f3", "encounterDeck")] },

  // 16038:A:1 "When Revealed: Each player must choose: either discard the highest cost ally you control, or reveal the top card of the encounter deck." The first seat discards, the second reveals.
  { line: "16038:A:1", name: "When Revealed: each player chooses to discard the highest cost ally he controls or to reveal the top card", layout: { seats: 2, play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }], deck: ["f0"] }, act: [resolve("16038", "whenRevealed"), answer("ally"), answer("reveal")], expect: [count("ally", "discard", 1), count("ally", "play", 1), zone("f0", "staging")] },
  // 16038:A:2 "Shadow: Attacking enemy gets +1 Attack. If this attack destroys a character, reveal the top card of the encounter deck."
  { line: "16038:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { stage: STAGE_3 }, act: attack("f0", { shadow: "16038", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "16038:A:2", name: "Shadow: when the attack destroys a character the top card of the encounter deck is revealed", layout: { stage: STAGE_3, play: ["ally"], deck: ["f3"] }, act: [attack("16035", { shadow: "16038" }), defend("ally")], expect: [count("ally", "discard", 1), zone("f3", "staging")] },

  // 16039:A:1 "When Revealed: Until the end of the phase, increase the total Threat in the staging area by X, where X is twice the stage number of the main quest." Stage 3: 6.
  { line: "16039:A:1", name: "When Revealed: the total Threat in the staging area is twice the stage number higher", layout: { stage: STAGE_3 }, act: resolve("16039", "whenRevealed"), expect: stagingThreat(6) },
  // 16039:A:2 "Shadow: Assign X damage among characters you control, where X is the stage number of the main quest." Stage 2, the undefended attack deals 1.
  { line: "16039:A:2", name: "Shadow: the defending player assigns the stage number of damage among characters he controls", layout: { stage: STAGE_2 }, act: attack("f0", { shadow: "16039", undefended: true }), expect: damageOn("dh1", 3) },

  // 16056:A:1 "While Jungle Trail is the active location, each location in the staging area gets -1 Threat." Place has Threat 2.
  { line: "16056:A:1", name: "While it is the active location each location in the staging area gets -1 Threat", layout: { active: "16056", staging: ["place"] }, act: [], expect: stat("place", "threat", 1) },

  // 16057:A:1 "Forced: When Forest Clearing is explored, discard the top card of the encounter deck. If that card is an enemy, add that enemy to the staging area."
  { line: "16057:A:1", name: "Forced: when it is explored the top card of the encounter deck is discarded and an enemy is added to the staging area", layout: { staging: ["16057"], deck: ["f0", "f3"] }, act: announce("locationExplored", "16057"), expect: [zone("f0", "staging"), zone("f3", "encounterDeck")] },
  // 16057:A:2 "Shadow: Discard an attachment you control."
  { line: "16057:A:2", name: "Shadow: the defending player discards an attachment he controls", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: "16057", undefended: true }), expect: count("attachment", "discard", 1) },

  // 16058:A:1 "Forced: When Dense Jungle is explored, discard the top card of the encounter deck. If that card is a location, add that location to the staging area."
  { line: "16058:A:1", name: "Forced: when it is explored the top card of the encounter deck is discarded and a location is added to the staging area", layout: { staging: ["16058"], deck: ["place", "f3"] }, act: announce("locationExplored", "16058"), expect: [zone("place", "staging"), zone("f3", "encounterDeck")] },
  // 16058:A:2 "Shadow: Discard a random card from your hand."
  { line: "16058:A:2", name: "Shadow: the defending player discards a random card from his hand", layout: { hand: ["filler"] }, act: attack("f0", { shadow: "16058", undefended: true }), expect: handCount(0) },

  // 16059:A:2 "When Revealed: Attach to the highest Threat location in the staging area without a copy of Overgrown attached." Place (Threat 2) against Dense Jungle (Threat 2 as well is avoided: Forest Clearing, Threat 3).
  { line: "16059:A:2", name: "When Revealed: it attaches to the highest Threat location in the staging area, which gets +1 Threat and is immune to player card effects", layout: { staging: ["place", "16057"] }, act: resolve("16059", "whenRevealed"), expect: [stat("16057", "threat", 4), flag("16057", "immuneToPlayerCards"), stat("place", "threat", 2)] },

  // 16060:A:2 "Each Orc enemy in the staging area gets -5 engagement cost." Uruk of Mordor costs 35; the filler enemy is no Orc.
  { line: "16060:A:2", name: "Each Orc enemy in the staging area gets -5 engagement cost", layout: { staging: ["16060", "16062", "f3"] }, act: [], expect: stat("16062", "engagementCost", 30) },
  // 16060:A:3 "Each Orc enemy engaged with a player gets +1 Threat." Uruk Warg-rider has Threat 3; the one in the staging area stays at 2.
  { line: "16060:A:3", name: "Each Orc enemy engaged with a player gets +1 Threat", layout: { staging: ["16060", "16062"], engaged: ["16063"] }, act: [], expect: [stat("16063", "threat", 4), stat("16062", "threat", 2)] },

  // 16061:A:1 "Cannot have player card attachments or be optionally engaged."
  { line: "16061:A:1", name: "Cannot have player card attachments or be optionally engaged", layout: { staging: ["16061"] }, act: [], expect: [flag("16061", "noPlayerAttachments"), flag("16061", "cannotBeOptionallyEngaged")] },
  // 16061:A:2 "While the engaged player is engaged with another Orc enemy, Uruk Chieftain cannot take damage."
  { line: "16061:A:2", name: "While the engaged player is engaged with another Orc enemy it cannot take damage", layout: { engaged: ["16061", "16062"] }, act: [], expect: flag("16061", "cannotTakeDamage") },

  // 16074:A:1 "When Revealed: Add Uruk Chieftain to the staging area. Shuffle the encounter discard pile into the encounter deck and reveal 1 encounter card per player."
  { line: "16074:A:1", name: "When Revealed: the Chieftain joins the staging area, the discard pile is shuffled in and each player reveals a card", layout: { stage: STAGE_4, side: "A", seats: 2, setAside: ["16061"], deck: ["f0"], discard: ["f3"] }, act: resolve("16074", "whenRevealed"), expect: [zone("16061", "staging"), zone("f0", "staging"), zone("f3", "staging")] },
  // 16074:B:1 "Uruk Chieftain cannot take non-combat damage."
  { line: "16074:B:1", name: "Uruk Chieftain cannot take non-combat damage", layout: { stage: STAGE_4, staging: ["16061", "16062"] }, act: [], expect: [flag("16061", "cannotTakeNonCombatDamage"), flag("16062", "cannotTakeNonCombatDamage", false)] },
  // 16074:B:2 "Each non-unique Orc enemy gets -10 engagement cost." The unique Chieftain costs 50 still.
  { line: "16074:B:2", name: "Each non-unique Orc enemy gets -10 engagement cost", layout: { stage: STAGE_4, staging: ["16061", "16062"] }, act: [], expect: [stat("16062", "engagementCost", 25), stat("16061", "engagementCost", 50)] },
  // 16074:B:3 "Forced: After Uruk Chieftain engages a player, it makes an immediate attack." The second seat is engaged.
  { line: "16074:B:3", name: "Forced: after the Chieftain engages a player it makes an immediate attack on that player", layout: { stage: STAGE_4, seats: 2, engaged: [{ code: "16061", seat: 1 }] }, act: announce("engaged", "16061", { seat: 1 }), expect: window("defense") },
  // 16074:B:4 "The players cannot defeat this stage while Uruk Chieftain is in play. If the players defeat this stage, they win the game."
  { line: "16074:B:4", name: "the players cannot defeat this stage while the Chieftain is in play", layout: { stage: STAGE_4, progress: 20, engaged: ["16061"] }, act: quest("success"), expect: notWon },
  { line: "16074:B:4", name: "if the players defeat this stage they win the game", layout: { stage: STAGE_4 }, act: resolve("16074", "questResolution"), expect: won },
];

cardSpecs("the-long-arm-of-mordor", ROWS);

const table = (layout: Layout = {}, extra: readonly string[] = []) => tableFromLayout("the-long-arm-of-mordor", { stage: "16071", ...layout }, { extra });
const record = (id: string) => EFFECTS.find((effect) => effect.id === id)!;
// The state of a layout at its opening, with the objective-heroes among the heroes of their seats.
const openedWith = (layout: Layout, ...heroes: readonly Hero[]) => {
  const made = table(objective(layout, ...heroes));
  return { made, state: opened(made).state };
};

describe("16032:A:2 16033:A:3 16034:A:3 If the objective-hero leaves play, you are eliminated from the game", () => {
  // Each of the three twins of 16031:A:2 (that line is in src/rules/families/haradrim/long-arm.test.ts): the hero of the second seat is destroyed, and only that seat is out.
  for (const [line, code] of [["16032:A:2", FIRYAL], ["16033:A:3", YAZAN], ["16034:A:3", JUBAYR]] as const) {
    it(`${line} the player who controls it is eliminated, and no other player`, () => {
      const { made, state } = openedWith({ seats: 2 }, { code, seat: 1 });
      const steps: EngineStep[] = [];
      const gone = settle(destroyCard(state, idOf(state, code), made.ctx.cards, steps), made.ctx, steps);
      expect(gone.seats[1]?.eliminated).toBe(true);
      expect(gone.seats[0]?.eliminated).toBeFalsy();
    });
  }

  it("16032:A:2 a player who is out of the game already is not eliminated a second time: no step, no change to the other seat", () => {
    const { made, state } = openedWith({ seats: 2 }, { code: FIRYAL, seat: 1 });
    const out: ScenarioState = { ...state, seats: state.seats.map((seat, index) => (index === 1 ? { ...seat, eliminated: true } : seat)) as unknown as ScenarioState["seats"] };
    const steps: EngineStep[] = [];
    const gone = settle(destroyCard(out, idOf(out, FIRYAL), made.ctx.cards, steps), made.ctx, steps);
    expect(steps.filter((step) => step.kind === "eliminate")).toEqual([]);
    expect(gone.seats[0]?.eliminated).toBeFalsy();
    expect(gone.lost).toBeFalsy();
  });
});

describe("16034:A:2 Response: discard a facedown shadow card from a non-unique enemy", () => {
  // The first-seat hero Jubayr defends; the engaged enemy f3 holds a facedown shadow card.
  function shadowed() {
    const { made, state } = openedWith({ phase: "Combat", engaged: ["f3"] }, { code: JUBAYR, seat: 0 });
    const dealt = spawn(state, "treachery", { zone: "shadow", enemyId: idOf(state, "f3") }, "down");
    return { made, state: dealt.state, shadow: dealt.id };
  }

  it("16034:A:2 the shadow card of the non-unique enemy goes to the encounter discard pile", () => {
    const { made, state, shadow } = shadowed();
    const done = resolveRecords(state, made.ctx, JUBAYR, "response", idOf(state, JUBAYR));
    expect(done.state.cards[shadow]?.zone).toBe("encounterDiscard");
  });

  it("16034:A:2 limit once per phase: a use this phase leaves no second use in the phase, and the next phase has its own", () => {
    const { state } = shadowed();
    const effect = record("16034:response:1");
    const jubayr = idOf(state, JUBAYR);
    const used: ScenarioState = { ...state, uses: [{ effectId: effect.id, sourceId: jubayr, seat: 0, round: state.round, phase: state.phase }] as ScenarioState["uses"] };
    expect(limitSpent(state, effect, jubayr, 0)).toBe(false);
    expect(limitSpent(used, effect, jubayr, 0)).toBe(true);
    expect(limitSpent({ ...used, phase: "Planning" }, effect, jubayr, 0)).toBe(false);
  });
});

describe("16033:A:2 Limit once per phase", () => {
  it("16033:A:2 limit once per phase: a use this phase leaves no second use in the phase, and the next phase has its own", () => {
    const { state } = openedWith({ staging: ["f0"] }, { code: YAZAN, seat: 0 });
    const effect = record("16033:response:1");
    const yazan = idOf(state, YAZAN);
    const used: ScenarioState = { ...state, uses: [{ effectId: effect.id, sourceId: yazan, seat: 0, round: state.round, phase: state.phase }] as ScenarioState["uses"] };
    expect(limitSpent(state, effect, yazan, 0)).toBe(false);
    expect(limitSpent(used, effect, yazan, 0)).toBe(true);
    expect(limitSpent({ ...used, phase: state.phase === "Combat" ? "Quest" : "Combat" }, effect, yazan, 0)).toBe(false);
  });

  it("16033:A:2 a guarded Orc is immune to player card effects, so Yazan cannot damage it", () => {
    const { made, state } = openedWith({ staging: ["16062", "f0"], stage: STAGE_3, side: "A" }, { code: YAZAN, seat: 0 });
    const staged = runInstruction(made, state, { verb: "MoveHeroesToStaging" });
    const guarded = settle(resolveRecords(staged, made.ctx, "16073", "whenRevealed", idOf(staged, "16073")).state, made.ctx, [] as EngineStep[]);
    const guard = captivesOf(guarded).find((card) => card.guardedHero === true)?.host ?? "";
    expect(heroGuardedBy(opened(made, guarded).state, guard)).not.toBeNull();
    expect(flagged(opened(made, guarded).state, guard, "immuneToPlayerCards")).toBe(true);
  });
});

describe("16039:A:1 When Revealed: until the end of the phase the total Threat is higher", () => {
  it("16039:A:1 the extra Threat stays through the phase and lapses at the end of the phase", () => {
    const layout: Layout = { stage: STAGE_3, phase: "Quest" };
    const during = playedLayout("the-long-arm-of-mordor", layout, resolve("16039", "whenRevealed"));
    expect(stagingThreatOf(during.run.state, during.table.cards)).toBe(6);
    const after = playedLayout("the-long-arm-of-mordor", layout, [resolve("16039", "whenRevealed"), endPhase]);
    expect(after.run.state.phase).not.toBe("Quest");
    expect(stagingThreatOf(after.run.state, after.table.cards)).toBe(0);
  });
});

describe("16065:A:1 Fear of Mordor: each ally in play gets -1 Willpower, -1 Attack and -1 Defense until the end of the round", () => {
  // An encounter card's lasting effect is recalculated when the game state changes (faq.lasting-effects): an ally that enters play later in the round gets it too.
  function feared() {
    const made = table({ play: ["ally"], hand: ["ally"] });
    const state = resolveRecords(opened(made).state, made.ctx, "16065", "whenRevealed").state;
    return { made, state };
  }
  const statsOf = (made: ReturnType<typeof table>, state: ScenarioState, id: string) => (["willpower", "attack", "defense"] as const).map((stat) => modifiedStat(state, state.cards[id]!, stat, made.ctx.cards));

  it("16065:A:1 the ally in play has each stat lowered by 1", () => {
    const { made, state } = feared();
    const inPlay = idsOf(state, "ally").find((id) => state.cards[id]?.zone === "play") ?? "";
    expect(statsOf(made, state, inPlay)).toEqual([0, 0, 0]);
  });

  it("16065:A:1 the -1 lapses when the round ends: the ally has its printed stats again in the next round", () => {
    const done = playedLayout("the-long-arm-of-mordor", { play: ["ally"] }, [resolve("16065", "whenRevealed"), endPhase, endRound]);
    const ally = idsOf(done.run.state, "ally")[0] ?? "";
    expect((["willpower", "attack", "defense"] as const).map((stat) => modifiedStat(done.run.state, done.run.state.cards[ally]!, stat, done.table.ctx.cards))).toEqual([1, 1, 1]);
  });

  it("16065:A:1 an ally put into play after the effect gets the same -1 until the end of the round, and the effect is gone when the round ends", () => {
    const { made, state } = feared();
    const later = idsOf(state, "ally").find((id) => state.cards[id]?.zone === "hand") ?? "";
    const entered = moveCard(state, later, { zone: "play", seat: 0 });
    expect(statsOf(made, entered, later)).toEqual([0, 0, 0]);
    expect(entered.modifiers.some((modifier) => modifier.until === "endOfRound")).toBe(true);
  });
});

describe("16073:A:1 Free the Captives: each player searches for an Orc enemy", () => {
  it("16073:A:1 two copies of one Orc title are both found, one for each of two players, and each hero goes under a different copy", () => {
    const made = table({ stage: STAGE_3, side: "A", seats: 2, deck: ["16062", "16062"] });
    const staged = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const done = resolveRecords(staged, made.ctx, "16073", "whenRevealed", idOf(staged, "16073"));
    const state = settle(done.state, made.ctx, [] as EngineStep[]);
    const copies = idsOf(state, "16062");
    expect(copies).toHaveLength(2);
    expect(copies.every((id) => state.cards[id]?.zone === "staging")).toBe(true);
    expect(copies.map((id) => heroGuardedBy(state, id)).filter((hero) => hero != null)).toHaveLength(2);
    expect(stagedHeroes(state)).toHaveLength(1);
  });
});

describe("141085 The One Ring on a hero in the staging area", () => {
  // "The first player gains control of attached hero" (141085:A:2, Forced when the first player token passes): a hero in the staging area is controlled by no one and stays where it is.
  const ringed = (stage: boolean) => {
    const made = table({ seats: 2, firstPlayer: 1, attached: [{ code: "141085", to: "dh1" }] }, ["141085"]);
    const opening = opened(made).state;
    return { made, state: stage ? runInstruction(made, opening, { verb: "MoveHeroesToStaging" }) : opening };
  };
  const pass = (made: ReturnType<typeof table>, state: ScenarioState) => {
    const steps: EngineStep[] = [];
    return settle(fireForced({ ...state, window: null }, { trigger: "firstPlayerTokenPassed", seat: 1, cardId: idOf(state, "141085") }, made.ctx, steps), made.ctx, steps);
  };

  it("141085:A:2 a Ring-bearer in the staging area stays there, owned by its seat, and goes to no player", () => {
    const { made, state } = ringed(true);
    const hero = idOf(state, "dh1");
    const after = pass(made, state);
    expect(after.cards[hero]).toMatchObject({ zone: "captive", host: null, controller: null, owner: 0 });
    expect(after.seats[1]?.heroes).not.toContain(hero);
  });

  it("141085:A:2 a Ring-bearer in play goes to the first player", () => {
    const { made, state } = ringed(false);
    const hero = idOf(state, "dh1");
    const after = pass(made, state);
    expect(after.cards[hero]).toMatchObject({ zone: "heroes", controller: 1 });
    expect(after.seats[1]?.heroes).toContain(hero);
  });
});

describe("16061:A:3 Forced: at the end of the encounter phase the Chieftain engages the player engaged with the most non-unique Orc enemies", () => {
  const layout: Layout = { phase: "Encounter", seats: 2, staging: ["16061"] };
  const chieftain = (done: ReturnType<typeof playedLayout>) => done.run.state.cards[idOf(done.run.state, "16061")];

  it("16061:A:3 the player with the most non-unique Orcs is engaged by it", () => {
    const done = playedLayout("the-long-arm-of-mordor", { ...layout, engaged: [{ code: "16062", seat: 1 }, { code: "16063", seat: 1 }, { code: "16062", seat: 0 }] }, resolve("16061", "forced"));
    expect(chieftain(done)).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("16061:A:3 with every player at 0 the first player chooses, and the choice is the player engaged", () => {
    const done = playedLayout("the-long-arm-of-mordor", { ...layout, firstPlayer: 1 }, [resolve("16061", "forced"), answer("seat:0")]);
    expect(chieftain(done)).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("16061:A:3 the record does nothing outside the encounter phase", () => {
    const done = playedLayout("the-long-arm-of-mordor", { ...layout, phase: "Combat", engaged: [{ code: "16062", seat: 1 }] }, resolve("16061", "forced"));
    expect(chieftain(done)?.zone).toBe("staging");
  });
});

describe("16073:B:3 the players cannot defeat this stage while an enemy is guarding a hero", () => {
  function guarded(progress: number) {
    const made = table({ stage: STAGE_3, side: "A", staging: ["16062"] });
    const staged = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const dealt = resolveRecords(staged, made.ctx, "16073", "whenRevealed", idOf(staged, "16073"));
    const stage = idOf(dealt.state, "16073");
    // The progress is placed once the guards hold their heroes, as the quest phase places it.
    const full = updateCard({ ...dealt.state, cards: { ...dealt.state.cards, [stage]: { ...dealt.state.cards[stage]!, face: "B" } } }, stage, { progress });
    return { made, state: opened(made, full).state, stage };
  }

  it("16073:B:3 a full stage stays while a guard holds a hero, and is defeated once the guard has left play", () => {
    const { made, state, stage } = guarded(20);
    expect(captivesOf(state).some((card) => card.guardedHero === true)).toBe(true);
    expect(settle(state, made.ctx, [] as EngineStep[]).cards[stage]?.zone).toBe("questStage");
    const guard = captivesOf(state).find((card) => card.guardedHero === true)?.host ?? "";
    const steps: EngineStep[] = [];
    const freed = settle(destroyCard(state, guard, made.ctx.cards, steps), made.ctx, steps);
    expect(freed.cards[stage]?.zone).not.toBe("questStage");
  });
});

describe("16071:B:2 the first card each player plays each phase does not require a resource match", () => {
  it("16071:B:2 a neutral card played first uses the slot: the next card of a sphere the hero lacks needs its match", () => {
    const made = table({ seats: 2, phase: "Planning", heroResources: 2, hand: [{ code: "01073", seat: 0 }, { code: "01048", seat: 0 }] }, ["01073", "01048"]);
    const state = opened(made).state;
    const neutral = idOf(state, "01073");
    const spirit = idOf(state, "01048");
    const hero = state.seats[0]?.heroes[0] ?? "";
    const pay = (from: ScenarioState, card: string, sphere: "neutral" | "spirit") => validatePayments(from, [{ heroId: hero, amount: 1 }], { seat: 0, sphere, amount: 1, forCard: card }, made.ctx);
    expect(pay(state, spirit, "spirit")).toBeNull();
    const played: ScenarioState = { ...state, played: [{ id: neutral, code: "01073", seat: 0, round: state.round, phase: state.phase }] };
    expect(pay(played, spirit, "spirit")).toBe("Wrong sphere");
  });
});
