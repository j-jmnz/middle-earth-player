// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.action, rr.cancel, rr.cost, rr.triggered-ability, rr.optional-engagement,
// rr.enters-play, rr.resource-match, rr.lasting-effects, rr.shadow-effects (data/rules/entries.json).
// The Antlered Crown heroes, allies and attachments, written from their card text (data/cards/TAC.json; the lines are the ledger lines in data/printed, read from the scans): Erkenbrand 08137:A:2, The Day's Rising
// 08139:A:1, Captain of Gondor 08140:A:1 and A:2, Booming Ent 08141:A:1 and A:2, Treebeard 08146:A:1 and A:2. The events are in
// the-antlered-crown-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Run, type Scene, type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { atDefense, choices, endRound, enter, hosts, passAll, play, playCode, playerTable, printed, stat, triggers } from "../../../test/harness/player-table.ts";

const ERKENBRAND = "08137";
const DAYS = "08139";
const CAPTAIN = "08140";
const BOOMING = "08141";
const TREEBEARD = "08146";
// Core: Aragorn (Leadership, sentinel), Legolas (Tactics, Warrior), Beravor (Lore, neither Warrior nor sentinel), the Gondorian Spearman (a Tactics Warrior ally with sentinel). Warrior Sword: a restricted Tactics attachment for a Tactics
// or Warrior character.
const ARAGORN = "01001";
const LEGOLAS = "01005";
const BERAVOR = "01012";
const SPEARMAN = "01029";
const SWORD = "19089";
const PAL = "pal";
// An Ent ally with no text and no sphere; a neutral ally that is not an Ent; a restricted Lore attachment with no text.
const ENT = "ent";
const STONE = "stone";
const GEAR = "gear";
// An enemy of attack 2 and one of attack 1, neither engaging by the engagement check.
const BRUTE = "brute";
const RAM = "ram";
// A treachery whose shadow effect gives the attacker +3 Attack (a fixture record, line fixture:A:1).
const BOOST = "boost";

let base: Awaited<ReturnType<typeof starterBase>>;

const boostShadow: Effect = { id: "boost:shadow:1", cardCode: BOOST, lines: ["fixture:A:1"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker" }] };

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, [...effects, boostShadow], scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ERKENBRAND, DAYS, CAPTAIN, BOOMING, TREEBEARD, ARAGORN, LEGOLAS, BERAVOR, SPEARMAN, SWORD];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(ENT, definePrinted({ code: ENT, name: "Ent", type: "ally", sphere: "neutral", cost: 2, willpower: 1, attack: 1, defense: 1, health: 5, traits: ["Ent"] }));
  cards.set(STONE, definePrinted({ code: STONE, name: "Stone", type: "ally", sphere: "neutral", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(GEAR, definePrinted({ code: GEAR, name: "Gear", type: "attachment", sphere: "lore", cost: 0, keywords: { restricted: true } }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  cards.set(RAM, definePrinted({ code: RAM, name: "Ram", type: "enemy", threat: 0, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  cards.set(BOOST, definePrinted({ code: BOOST, name: "Boost", type: "treachery" }));
  base = { ...starter, cards };
});

describe("Erkenbrand (08137:A:2)", () => {
  // Erkenbrand and Beravor; the Brute (attack 2) is engaged and gets the Boost as its shadow card when the combat phase deals them.
  function defended(effects: readonly Effect[], defender: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: ERKENBRAND, seat: 0 }, { code: BERAVOR, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }], deck: [BOOST] });
    let run = atDefense(tab);
    // An action window opens after the defender is declared, before the shadow card is turned.
    run = passAll(send(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx);
    return { tab, run };
  }

  // "While Erkenbrand is defending, he gains: "Response: Deal 1 damage to Erkenbrand to cancel a shadow effect just triggered."": he
  // defends (Defense 3) the Brute's attack; its shadow effect (+3 Attack) is canceled for 1 damage on him, so the attack (2) deals none.
  lineSpec("08137:A:2", "while defending, deals 1 damage to himself to cancel a shadow effect", (effects) => {
    const { tab, run: asked } = defended(effects, ERKENBRAND);
    const erkenbrand = idsOf(tab, ERKENBRAND);
    expect(triggers(asked.state, tab)).toContain("08137:response:1");
    const run = passAll(send(asked, { type: "Trigger", cardId: erkenbrand, effectId: "08137:response:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[erkenbrand]?.damage).toBe(1);
    expect(run.steps.filter((step) => step.kind === "damage" && step.targetId === erkenbrand && step.amount > 0).map((step) => (step.kind === "damage" ? step.amount : 0))).toEqual([1]);
  });

  // The shadow effect not canceled: the attack is 2 + 3 against Defense 3, and he takes 2.
  it("08137:A:2 the shadow effect resolves when he does not cancel it", () => {
    const { tab, run: asked } = defended(EFFECTS, ERKENBRAND);
    const run = passAll(send(asked, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, ERKENBRAND)]?.damage).toBe(2);
  });

  // "While Erkenbrand is defending": Beravor defends, so Erkenbrand has no Response.
  it("08137:A:2 is not offered while another character defends", () => {
    const { tab, run } = defended(EFFECTS, BERAVOR);
    expect(triggers(run.state, tab)).not.toContain("08137:response:1");
  });
});

describe("The Day's Rising (08139:A:1)", () => {
  // "Attach to a hero with sentinel.": Erkenbrand and Aragorn (heroes with sentinel) are offered; Beravor (no sentinel) and the Gondorian
  // Spearman (an ally with sentinel) are not.
  lineSpec("08139:A:1", "The Day's Rising: Attach to a hero with sentinel", (effects) => {
    const tab = table(effects, { heroes: [{ code: ERKENBRAND, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: DAYS, seat: 0 }] });
    const days = idsOf(tab, DAYS);
    expect(hosts(tab, days)).toEqual([idsOf(tab, ERKENBRAND), idsOf(tab, ARAGORN)].sort());
    expect(play(begin(tab.state), tab, days, idsOf(tab, ERKENBRAND)).state.cards[days]?.host).toBe(idsOf(tab, ERKENBRAND));
  });
});

describe("Captain of Gondor (08140:A:1, A:2)", () => {
  // "Attach to a Warrior hero.": Legolas and Erkenbrand (Warrior heroes) are offered; Beravor and the Gondorian Spearman (a Warrior ally) are not.
  lineSpec("08140:A:1", "Captain of Gondor: Attach to a Warrior hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: ERKENBRAND, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: CAPTAIN, seat: 0 }] });
    const captain = idsOf(tab, CAPTAIN);
    expect(hosts(tab, captain)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, ERKENBRAND)].sort());
    expect(play(begin(tab.state), tab, captain, idsOf(tab, LEGOLAS)).state.cards[captain]?.host).toBe(idsOf(tab, LEGOLAS));
  });

  // Legolas holds the Captain in the optional engagement step; the Ram is in the staging area, and the Cheap enemy (engagement cost 2) too
  // when `cheap`.
  const engaging = (effects: readonly Effect[], cheap = false) =>
    table(effects, { start: "encounter", heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: CAPTAIN, host: LEGOLAS }], staging: cheap ? ["cheap"] : [RAM] });

  // "Response: After you optionally engage an enemy, exhaust Captain of Gondor to give attached hero +1 Attack and +1 Defense until the end
  // of the round.": Legolas engages the Ram; the Captain exhausts, he has +1 Attack and +1 Defense, and they are gone once the round ends.
  lineSpec("08140:A:2", "Captain of Gondor: after you optionally engage, exhaust it for +1 Attack and +1 Defense until the end of the round", (effects) => {
    const tab = engaging(effects);
    const [legolas, captain] = [idsOf(tab, LEGOLAS), idsOf(tab, CAPTAIN)];
    let run = send(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, RAM) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, RAM)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).toContain("08140:response:1");
    run = send(run, { type: "Trigger", cardId: captain, effectId: "08140:response:1" }, tab.ctx);
    expect(run.state.cards[captain]?.exhausted).toBe(true);
    expect(stat(run.state, tab, legolas, "attack")).toBe(printed(tab, LEGOLAS, "attack") + 1);
    expect(stat(run.state, tab, legolas, "defense")).toBe(printed(tab, LEGOLAS, "defense") + 1);
    // The encounter phase is over (the Ram attacks in the combat phase) and the bonus stays; it is gone once the round ends.
    expect(run.state.phase).toBe("Combat");
    const ended = endRound(run.state, tab);
    expect(stat(ended.state, tab, legolas, "attack")).toBe(printed(tab, LEGOLAS, "attack"));
    expect(stat(ended.state, tab, legolas, "defense")).toBe(printed(tab, LEGOLAS, "defense"));
  });

  // An enemy that engages through the engagement check is not optionally engaged: no Response.
  it("08140:A:2 Captain of Gondor: not offered when an enemy engages by the engagement check", () => {
    const tab = engaging(EFFECTS, true);
    const run = send(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, "cheap")]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("08140:response:1");
    expect(run.state.cards[idsOf(tab, CAPTAIN)]?.exhausted).toBe(false);
  });
});

describe("Booming Ent (08141:A:1, A:2)", () => {
  // "Cannot have restricted attachments. Enters play exhausted.": played from the hand (Legolas pays 2), it enters play exhausted; then the
  // Warrior Sword (restricted, for a Tactics or Warrior character) may go on Legolas and not on the Booming Ent, a Tactics ally.
  lineSpec("08141:A:1", "Booming Ent: enters play exhausted and cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: BOOMING, seat: 0 }, { code: SWORD, seat: 0 }] });
    const ent = idsOf(tab, BOOMING);
    const run = playCode(tab, BOOMING);
    expect(run.state.cards[ent]).toMatchObject({ zone: "play", exhausted: true });
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.resources).toBe(6 - 2);
    const sword = hosts(tab, idsOf(tab, SWORD), run.state);
    expect(sword).toContain(idsOf(tab, LEGOLAS));
    expect(sword).not.toContain(ent);
  });

  // "Booming Ent gets +1 Attack for each damaged Ent character you control.": with the Ent ally damaged, the Booming Ent played from the hand
  // has Attack 2 + 1; once it is damaged itself, 2 + 2. The other player's damaged Ent does not count.
  lineSpec("08141:A:2", "Booming Ent: +1 Attack for each damaged Ent character you control", (effects) => {
    const start = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ENT, seat: 0 }, { code: ENT, seat: 1 }], hand: [{ code: BOOMING, seat: 0 }] });
    const [mine = "", theirs = ""] = start.ids[ENT] ?? [];
    const tab = { ...start, state: updateCard(updateCard(start.state, mine, { damage: 1 }), theirs, { damage: 1 }) };
    const ent = idsOf(tab, BOOMING);
    const run = playCode(tab, BOOMING);
    expect(stat(run.state, tab, ent, "attack")).toBe(printed(tab, BOOMING, "attack") + 1);
    const hurt = syncConstants(updateCard(run.state, ent, { damage: 1 }), tab.ctx);
    expect(stat(hurt, tab, ent, "attack")).toBe(printed(tab, BOOMING, "attack") + 2);
    const healed = syncConstants(updateCard(hurt, mine, { damage: 0 }), tab.ctx);
    expect(stat(healed, tab, ent, "attack")).toBe(printed(tab, BOOMING, "attack") + 1);
  });

  // No Ent character damaged: its printed Attack.
  it("08141:A:2 Booming Ent: no bonus while no Ent character you control is damaged", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: BOOMING, seat: 0 }, { code: ENT, seat: 0 }] });
    expect(stat(tab.state, tab, idsOf(tab, BOOMING), "attack")).toBe(printed(tab, BOOMING, "attack"));
  });
});

describe("Treebeard (08146:A:1, A:2)", () => {
  // "Cannot have restricted attachments. Treebeard enters play exhausted": played from the hand (Beravor pays 4), he enters play exhausted,
  // and the Gear (restricted) may go on Beravor and not on him.
  lineSpec("08146:A:1", "Treebeard: enters play exhausted and cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: TREEBEARD, seat: 0 }, { code: GEAR, seat: 0 }] });
    const treebeard = idsOf(tab, TREEBEARD);
    const run = playCode(tab, TREEBEARD);
    expect(run.state.cards[treebeard]).toMatchObject({ zone: "play", exhausted: true });
    const gear = hosts(tab, idsOf(tab, GEAR), run.state);
    expect(gear).toContain(idsOf(tab, BERAVOR));
    expect(gear).not.toContain(treebeard);
  });

  // "... and collects 1 resource each resource phase.": the resource phase gives him 1.
  lineSpec("08146:A:1", "Treebeard: collects 1 resource each resource phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: TREEBEARD, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }] });
    const run = enter(tab.state, tab, "resourceGrant");
    expect(run.state.cards[idsOf(tab, TREEBEARD)]?.resources).toBe(1);
  });

  // "These resources can be used to pay for Ent cards played from your hand.": his 2 resources pay for the Ent ally; they do not pay for the
  // Stone, a neutral ally that is not an Ent.
  lineSpec("08146:A:1", "Treebeard: his resources pay for Ent cards and not for other cards", (effects) => {
    const start = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: TREEBEARD, seat: 0 }], hand: [{ code: ENT, seat: 0 }, { code: STONE, seat: 0 }] });
    const treebeard = idsOf(start, TREEBEARD);
    const tab = { ...start, state: updateCard(start.state, treebeard, { resources: 2 }) };
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, STONE), payments: [{ heroId: treebeard, amount: 2 }] }, tab.ctx)).not.toBeNull();
    const run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, ENT), payments: [{ heroId: treebeard, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ENT)]?.zone).toBe("play");
    expect(run.state.cards[treebeard]?.resources).toBe(0);
  });

  // Treebeard (exhausted) with `resources`, the Ent ally exhausted with the first player (or with the second when `theirs`), Beravor exhausted.
  function grove(effects: readonly Effect[], resources: number, theirs = false): Table {
    const start = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: TREEBEARD, seat: 0 }, { code: ENT, seat: theirs ? 1 : 0 }] });
    let state = updateCard(start.state, idsOf(start, TREEBEARD), { resources, exhausted: true });
    state = updateCard(updateCard(state, idsOf(start, ENT), { exhausted: true }), idsOf(start, BERAVOR), { exhausted: true });
    return { ...start, state };
  }

  // "Action: Pay 2 resources from Treebeard's pool to ready an Ent character.": the exhausted Ent of the other player is offered (any Ent
  // character) and so is Treebeard himself, Beravor is not; the Ent readies and Treebeard's pool falls by 2.
  lineSpec("08146:A:2", "Treebeard: pay 2 from his pool to ready an Ent character", (effects) => {
    const tab = grove(effects, 3, true);
    const treebeard = idsOf(tab, TREEBEARD);
    let run = send(begin(tab.state), { type: "Trigger", cardId: treebeard, effectId: "08146:action:1", payments: [{ heroId: treebeard, amount: 2 }] }, tab.ctx);
    expect(run.state.cards[treebeard]?.resources).toBe(1);
    expect(choices(run.state, tab).sort()).toEqual([treebeard, idsOf(tab, ENT)].sort());
    run = send(run, { type: "Choose", optionId: idsOf(tab, ENT) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ENT)]?.exhausted).toBe(false);
    expect(run.state.cards[treebeard]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.exhausted).toBe(true);
  });

  // With 1 resource he cannot pay; with no exhausted Ent character the Action can change nothing: neither is offered.
  it("08146:A:2 Treebeard: not offered with fewer than 2 resources or with no exhausted Ent character", () => {
    expect(triggers(grove(EFFECTS, 1).state, grove(EFFECTS, 1))).not.toContain("08146:action:1");
    const ready = grove(EFFECTS, 2);
    const state = updateCard(updateCard(ready.state, idsOf(ready, ENT), { exhausted: false }), idsOf(ready, TREEBEARD), { exhausted: false });
    expect(triggers(state, ready)).not.toContain("08146:action:1");
  });
});
