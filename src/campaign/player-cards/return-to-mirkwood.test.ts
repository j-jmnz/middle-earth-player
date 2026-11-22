// Rules: rr.modifiers, rr.ready, rr.attachment-cards, rr.sentinel, rr.action, rr.response, rr.cost, rr.lasting-effects,
// rr.triggered-ability, rr.step-6-2, rr.step-6-3, rr.play-restrictions-and-permissions, rr.active-location (data/rules/entries.json).
// The Return to Mirkwood hero, allies, attachments and events, written from their card text (data/cards/RtM.json; data/printed holds no
// ledger for this pack, so every intent goes through sendUnledgered): Dáin Ironfoot 02116:A:1, Dúnedain Signal 02117:A:1, A:2 and A:3,
// Dawn Take You All 02118:A:1 and A:2, Support of the Eagles 02120:A:1 and A:2, West Road Traveller 02121:A:1, Astonishing Speed 02122:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, hosts, passAll, play, playCode, playerTable, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const DAIN = "02116";
const SIGNAL = "02117";
const DAWN = "02118";
const SUPPORT = "02120";
const TRAVELLER = "02121";
const SPEED = "02122";
// Core: Aragorn (Leadership, Dúnedain), Théodred (Leadership, no sentinel), Glóin (Leadership Dwarf hero), Legolas (Tactics Silvan hero),
// Thalin (Tactics Dwarf hero), Éowyn (Spirit, Rohan), Eleanor (Spirit, Gondor), Snowbourn Scout (a Rohan ally), Longbeard Orc Slayer (a Leadership Dwarf ally), Gondorian Spearman (a Tactics ally).
const ARAGORN = "01001";
const THEODRED = "01002";
const GLOIN = "01003";
const LEGOLAS = "01005";
const THALIN = "01006";
const EOWYN = "01007";
const ELEANOR = "01008";
const SNOWBOURN = "01016";
const SLAYER = "01018";
const SPEARMAN = "01029";
// Two Eagle allies with no text, and two locations.
const EAGLE = "eagle";
const ROC = "roc";
const ROAD = "road";
const FORD = "ford";
const HILL = "hill";
const WEAK = "weak";
const ALLY = "ally";
const PAL = "pal";
// A neutral event with an Action that changes the threat: another legal Action keeps the combat action window open.
const PAD = "pad";
const padAction: Effect = { id: "pad:action:1", cardCode: PAD, lines: ["fixture:A:1"], timing: "action", instructions: [{ verb: "SetThreat", value: 40 }] };

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([DAIN, SIGNAL, DAWN, SUPPORT, TRAVELLER, SPEED, ARAGORN, THEODRED, GLOIN, LEGOLAS, THALIN, EOWYN, ELEANOR, SNOWBOURN, SLAYER, SPEARMAN]))]);
  cards.set(PAD, definePrinted({ code: PAD, name: "Pad", type: "event", sphere: "neutral", cost: 0 }));
  cards.set(EAGLE, definePrinted({ code: EAGLE, name: "Eagle", type: "ally", sphere: "tactics", cost: 2, willpower: 0, attack: 3, defense: 2, health: 2, traits: ["Creature", "Eagle"] }));
  cards.set(ROC, definePrinted({ code: ROC, name: "Roc", type: "ally", sphere: "tactics", cost: 2, willpower: 0, attack: 1, defense: 4, health: 2, traits: ["Creature", "Eagle"] }));
  for (const code of [ROAD, FORD, HILL]) cards.set(code, definePrinted({ code, name: code, type: "location", threat: 1, questPoints: 3 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Dáin Ironfoot (02116:A:1)", () => {
  // Dáin and Aragorn for the first player, the Orc Slayer (a Dwarf ally) in hand; Glóin (a Dwarf hero) for the second player.
  const dain = (effects: readonly Effect[]): Table =>
    table(effects, { seats: 2, start: "planning", heroes: [{ code: DAIN, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: GLOIN, seat: 1 }], hand: [{ code: SLAYER, seat: 0 }], deck: ["f0", "f0"] });

  // "While Dáin Ironfoot is ready, Dwarf characters get +1 Attack and +1 Willpower.": the Orc Slayer, played from the hand, has Attack 2 + 1
  // and Willpower 0 + 1; Dáin himself and the other player's Glóin get it too, Aragorn does not. Once Dáin exhausts to quest, it ends.
  lineSpec("02116:A:1", "Dáin Ironfoot: while he is ready, Dwarf characters get +1 Attack and +1 Willpower", (effects) => {
    const tab = dain(effects);
    const [dainId, aragorn, gloin, slayer] = [idsOf(tab, DAIN), idsOf(tab, ARAGORN), idsOf(tab, GLOIN), idsOf(tab, SLAYER)];
    const run = playCode(tab, SLAYER);
    expect(run.state.cards[slayer]?.zone).toBe("play");
    expect([stat(run.state, tab, slayer, "attack"), stat(run.state, tab, slayer, "willpower")]).toEqual([2 + 1, 0 + 1]);
    expect([stat(run.state, tab, dainId, "attack"), stat(run.state, tab, dainId, "willpower")]).toEqual([2 + 1, 1 + 1]);
    expect([stat(run.state, tab, gloin, "attack"), stat(run.state, tab, gloin, "willpower")]).toEqual([2 + 1, 2 + 1]);
    expect([stat(run.state, tab, aragorn, "attack"), stat(run.state, tab, aragorn, "willpower")]).toEqual([3, 2]);
    const quested = sendUnledgered(begin(questing(run.state)), { type: "Commit", cardIds: [dainId] }, tab.ctx);
    expect(quested.state.cards[dainId]?.exhausted).toBe(true);
    expect([stat(quested.state, tab, slayer, "attack"), stat(quested.state, tab, slayer, "willpower")]).toEqual([2, 0]);
    expect(stat(quested.state, tab, gloin, "attack")).toBe(2);
  });
});

describe("Dúnedain Signal (02117:A:1, A:2, A:3)", () => {
  // Théodred and Glóin (Leadership, no sentinel) for the first player with an ally, the Pal for the second; the Weak is engaged with the second player.
  const signal = (effects: readonly Effect[]): Table =>
    table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: GLOIN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SIGNAL, seat: 0 }], engaged: [{ code: WEAK, seat: 1 }] });

  // "Attach to a hero.": the three heroes, the other player's too, are offered; the ally is not.
  lineSpec("02117:A:1", "Dúnedain Signal: Attach to a hero", (effects) => {
    const tab = signal(effects);
    const card = idsOf(tab, SIGNAL);
    expect(hosts(tab, card)).toEqual([idsOf(tab, THEODRED), idsOf(tab, GLOIN), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, THEODRED)).state.cards[card]?.host).toBe(idsOf(tab, THEODRED));
  });

  // "Attached hero gains sentinel.": Théodred, with the Signal played on him, may defend the attack of the second player's enemy; Glóin
  // (no sentinel) may not.
  lineSpec("02117:A:2", "Dúnedain Signal: the attached hero gains sentinel", (effects) => {
    const tab = signal(effects);
    const theodred = idsOf(tab, THEODRED);
    const played = play(begin(tab.state), tab, idsOf(tab, SIGNAL), theodred);
    expect(hasKeyword(played.state, theodred, "sentinel", tab.ctx.cards)).toBe(true);
    const run = passAll(combat(played.state, tab), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 1 });
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: theodred }, tab.ctx)).toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: idsOf(tab, GLOIN) }, tab.ctx)).not.toBeNull();
  });

  // "Action: Pay 1 resource from attached hero's pool to attach Dúnedain Signal to another hero.": Théodred pays 1 of his 6; Glóin and the
  // Pal are offered (not Théodred); the Signal moves to Glóin, who gains sentinel, and Théodred loses it.
  lineSpec("02117:A:3", "Dúnedain Signal: pay 1 from the attached hero's pool to move it to another hero", (effects) => {
    const tab = signal(effects);
    const [card, theodred, gloin] = [idsOf(tab, SIGNAL), idsOf(tab, THEODRED), idsOf(tab, GLOIN)];
    const played = play(begin(tab.state), tab, card, theodred);
    const before = played.state.cards[theodred]?.resources ?? 0;
    expect(triggers(played.state, tab)).toContain("02117:action:1");
    let run = sendUnledgered(played, { type: "Trigger", cardId: card, effectId: "02117:action:1", payments: [{ heroId: theodred, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[theodred]?.resources).toBe(before - 1);
    expect(choices(run.state, tab).sort()).toEqual([gloin, idsOf(tab, PAL)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gloin }, tab.ctx);
    expect(run.state.cards[card]?.host).toBe(gloin);
    expect(hasKeyword(run.state, gloin, "sentinel", tab.ctx.cards)).toBe(true);
    expect(hasKeyword(run.state, theodred, "sentinel", tab.ctx.cards)).toBe(false);
  });

  // "from attached hero's pool": with Théodred's pool empty it is not offered, and Glóin cannot pay for him.
  it("02117:A:3 Dúnedain Signal: only the attached hero's pool pays", () => {
    const tab = signal(EFFECTS);
    const [card, theodred] = [idsOf(tab, SIGNAL), idsOf(tab, THEODRED)];
    const played = play(begin(tab.state), tab, card, theodred);
    const empty = updateCard(played.state, theodred, { resources: 0 });
    expect(triggers(empty, tab)).not.toContain("02117:action:1");
    expect(refusal(empty, { type: "Trigger", cardId: card, effectId: "02117:action:1", payments: [{ heroId: idsOf(tab, GLOIN), amount: 1 }] }, tab.ctx)).not.toBeNull();
  });
});

describe("Dawn Take You All (02118:A:1, A:2)", () => {
  // Aragorn (Leadership) pays 2. A Weak is engaged with each player; the combat phase deals each a shadow card.
  const dawn = (effects: readonly Effect[]): Table =>
    table([...effects, padAction], { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }], deck: ["f0", "f0", "f0"], hand: [{ code: DAWN, seat: 0 }, { code: PAD, seat: 0 }] });
  const playable = (run: Run, tab: Table): boolean => legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, DAWN));

  // "Play after shadow cards have been dealt, before any attacks have resolved.": it can be played once the shadow cards are dealt; once
  // the first player's enemy has attacked (Aragorn defends, the damage is dealt), it cannot be played in the next action window, which the Pad (another legal
  // Action in the hand) keeps open between the first attack and the second.
  lineSpec("02118:A:1", "Dawn Take You All: played after the shadow cards are dealt, and not once an attack has resolved", (effects) => {
    const tab = dawn(effects);
    const dealt = combat(tab.state, tab);
    expect((tab.ids[WEAK] ?? []).every((id) => dealt.state.cards[id]?.shadowId != null)).toBe(true);
    expect(playable(dealt, tab)).toBe(true);
    let run = passAll(dealt, tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 0 });
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, ARAGORN) }, tab.ctx);
    const struck = (next: Run): boolean => next.steps.some((step) => step.kind === "strike" && step.side === "enemy");
    for (let guard = 0; guard < 8 && !struck(run) && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    // The first attack has struck, the second has not: the combat action window is open (the Pad is legal in it) and Dawn is not offered in it.
    expect(struck(run)).toBe(true);
    expect(run.state.phase).toBe("Combat");
    expect(["pass", "frameAction"]).toContain(run.state.window?.kind);
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, PAD))).toBe(true);
    expect(playable(run, tab)).toBe(false);
  });

  // "Combat Action": not played in the planning phase.
  it("02118:A:2 Dawn Take You All: not played in the planning phase", () => {
    const tab = dawn(EFFECTS);
    expect(playable(begin(tab.state), tab)).toBe(false);
  });

  // "Combat Action: Each player may choose and discard 1 facedown shadow card from an enemy with which he is engaged.": the first player
  // discards the shadow card of the enemy engaged with him; the second player is asked too and keeps his.
  lineSpec("02118:A:2", "Dawn Take You All: each player may discard a shadow card from an enemy engaged with him", (effects) => {
    const tab = dawn(effects);
    const [mine = "", theirs = ""] = tab.ids[WEAK] ?? [];
    const dealt = combat(tab.state, tab);
    const [shadow = "", kept = ""] = [dealt.state.cards[mine]?.shadowId ?? "", dealt.state.cards[theirs]?.shadowId ?? ""];
    let run = play(dealt, tab, idsOf(tab, DAWN));
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(choices(run.state, tab)).toEqual(["discard", "pass"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 1 });
    run = sendUnledgered(run, { type: "Choose", optionId: "pass" }, tab.ctx);
    expect(run.state.cards[mine]?.shadowId).toBeNull();
    expect(run.state.cards[shadow]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[theirs]?.shadowId).toBe(kept);
  });
});

describe("Support of the Eagles (02120:A:1, A:2)", () => {
  // Legolas (Tactics) pays 3; Thalin is a Tactics hero, Aragorn is not, the Gondorian Spearman is a Tactics ally. Two Eagle allies (Attack
  // 3 Defense 2, Attack 1 Defense 4) and an ally that is not an Eagle are in play when `eagles`.
  const support = (effects: readonly Effect[], eagles: boolean): Table =>
    table(effects, {
      heroes: [{ code: LEGOLAS, seat: 0 }, { code: THALIN, seat: 0 }, { code: ARAGORN, seat: 0 }],
      allies: [{ code: SPEARMAN, seat: 0 }, ...(eagles ? [{ code: EAGLE, seat: 0 }, { code: ROC, seat: 0 }] : [])],
      hand: [{ code: SUPPORT, seat: 0 }],
    });

  // "Attach to a Tactics hero.": Legolas and Thalin are offered; Aragorn and the Tactics ally are not.
  lineSpec("02120:A:1", "Support of the Eagles: Attach to a Tactics hero", (effects) => {
    const tab = support(effects, false);
    const card = idsOf(tab, SUPPORT);
    expect(hosts(tab, card)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, THALIN)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, THALIN)).state.cards[card]?.host).toBe(idsOf(tab, THALIN));
  });

  // "Action: Exhaust Support of the Eagles to choose an Eagle ally. Until the end of the phase, attached hero adds that ally's Attack or
  // Defense (choose 1) to its own.": the two Eagles are offered (not the Spearman); Legolas adds the Eagle's Attack 3 to his 3, his Defense
  // stays 1, the Support is exhausted, and once the phase ends his Attack is 3 again.
  lineSpec("02120:A:2", "Support of the Eagles: exhaust it to add an Eagle ally's Attack or Defense to the hero's until the end of the phase", (effects) => {
    const tab = support(effects, true);
    const [card, legolas, eagle] = [idsOf(tab, SUPPORT), idsOf(tab, LEGOLAS), idsOf(tab, EAGLE)];
    const played = play(begin(tab.state), tab, card, legolas);
    expect(triggers(played.state, tab)).toContain("02120:action:1");
    let run = sendUnledgered(played, { type: "Trigger", cardId: card, effectId: "02120:action:1" }, tab.ctx);
    expect(run.state.cards[card]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual([eagle, idsOf(tab, ROC)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: eagle }, tab.ctx);
    expect(choices(run.state, tab)).toEqual(["attack", "defense"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "attack" }, tab.ctx);
    expect(stat(run.state, tab, legolas, "attack")).toBe(3 + 3);
    expect(stat(run.state, tab, legolas, "defense")).toBe(1);
    expect(stat(withMode(run.state, "questCommit"), tab, legolas, "attack")).toBe(3);
  });

  // "or Defense": the Roc's Defense 4 is added to Legolas's Defense 1.
  it("02120:A:2 Support of the Eagles: the Defense option adds the ally's Defense", () => {
    const tab = support(EFFECTS, true);
    const [card, legolas] = [idsOf(tab, SUPPORT), idsOf(tab, LEGOLAS)];
    let run = sendUnledgered(play(begin(tab.state), tab, card, legolas), { type: "Trigger", cardId: card, effectId: "02120:action:1" }, tab.ctx);
    run = sendUnledgered(sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, ROC) }, tab.ctx), { type: "Choose", optionId: "defense" }, tab.ctx);
    expect(stat(run.state, tab, legolas, "defense")).toBe(1 + 4);
    expect(stat(run.state, tab, legolas, "attack")).toBe(3);
  });

  // No Eagle ally in play: nothing to choose, so the Action is not offered.
  it("02120:A:2 Support of the Eagles: not offered with no Eagle ally", () => {
    const tab = support(EFFECTS, false);
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, SUPPORT), idsOf(tab, LEGOLAS)).state, tab)).not.toContain("02120:action:1");
  });
});

describe("West Road Traveller (02121:A:1)", () => {
  // Éowyn (Spirit) pays 2. The Road is the active location when `active`; the Ford, the Hill and a Weak are in the staging area.
  const traveller = (effects: readonly Effect[], active: boolean): Table =>
    table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: TRAVELLER, seat: 0 }], staging: [FORD, HILL, WEAK], ...(active ? { active: ROAD } : {}) });

  // "Response: After you play West Road Traveller from your hand, switch the active location with any other location in the staging
  // area.": the Ford and the Hill are offered (not the enemy); the Ford becomes the active location and the Road goes to the staging area.
  lineSpec("02121:A:1", "West Road Traveller: after it is played, switch the active location with a location in the staging area", (effects) => {
    const tab = traveller(effects, true);
    const [road, ford, hill] = [idsOf(tab, ROAD), idsOf(tab, FORD), idsOf(tab, HILL)];
    let run = playCode(tab, TRAVELLER);
    expect(triggers(run.state, tab)).toContain("02121:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, TRAVELLER), effectId: "02121:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([ford, hill].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ford }, tab.ctx);
    expect(run.state.cards[ford]?.zone).toBe("activeLocation");
    expect(run.state.cards[road]?.zone).toBe("staging");
    expect(run.state.cards[hill]?.zone).toBe("staging");
  });

  // With no active location there is nothing to switch: not offered.
  it("02121:A:1 West Road Traveller: not offered with no active location", () => {
    const tab = traveller(EFFECTS, false);
    expect(triggers(playCode(tab, TRAVELLER).state, tab)).not.toContain("02121:response:1");
  });
});

describe("Astonishing Speed (02122:A:1)", () => {
  // "Action: Until the end of the phase, all Rohan characters get +2 Willpower": Éowyn (Spirit, Rohan) pays 3; she and the other player's
  // Snowbourn Scout (Rohan) get +2, Aragorn does not, and once the phase ends the Willpower is printed again.
  lineSpec("02122:A:1", "Astonishing Speed: all Rohan characters get +2 Willpower until the end of the phase", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: SNOWBOURN, seat: 1 }], hand: [{ code: SPEED, seat: 0 }] });
    const [eowyn, aragorn, scout] = [idsOf(tab, EOWYN), idsOf(tab, ARAGORN), idsOf(tab, SNOWBOURN)];
    const run = playCode(tab, SPEED);
    expect(run.state.cards[eowyn]?.resources).toBe(6 - 3);
    expect([stat(run.state, tab, eowyn, "willpower"), stat(run.state, tab, scout, "willpower"), stat(run.state, tab, aragorn, "willpower")]).toEqual([4 + 2, 0 + 2, 2]);
    const later = withMode(run.state, "questCommit");
    expect([stat(later, tab, eowyn, "willpower"), stat(later, tab, scout, "willpower")]).toEqual([4, 0]);
  });

  // No Rohan character in play (Eleanor, Spirit, pays): the lasting effect reaches only the cards in play now (rr.lasting-effects), so the
  // Action can change nothing and the event is not offered (rr.triggered-ability).
  it("02122:A:1 Astonishing Speed: not offered with no Rohan character in play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ELEANOR, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SPEED, seat: 0 }] });
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, SPEED))).toBe(false);
  });
});
