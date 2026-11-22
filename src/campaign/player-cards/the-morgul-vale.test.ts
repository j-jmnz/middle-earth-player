// Rules: rr.attachment-cards, rr.modifiers, rr.printed, rr.response, rr.action, rr.triggered-ability, rr.then, rr.cost, rr.lasting-effects,
// rr.enters-play, rr.staging-area, rr.combat-phase, rr.quest-phase, rr.ready, rr.move (data/rules/entries.json).
// The Morgul Vale player cards, written from their card text (data/cards/TMV.json; data/printed holds no ledger for this pack, so every
// intent goes through sendUnledgered): Théoden 06134:A:2, Pelargir Ship Captain 06135:A:1, Visionary Leadership 06136:A:1 and A:2,
// Spear of the Mark 06137:A:2 and A:3, Forth Eorlingas! 06138:A:1, Steed of the Mark 06139:A:1 and A:2, Lay of Nimrodel 06140:A:1, Ered
// Nimrais Prospector 06141:A:1, Scroll of Isildur 06142:A:1 to A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, combat, discarded, fillers, hosts, passAll, play, playerTable, printed, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const THEODEN = "06134";
const CAPTAIN = "06135";
const VISIONARY = "06136";
const SPEAR = "06137";
const EORLINGAS = "06138";
const STEED = "06139";
const LAY = "06140";
const PROSPECTOR = "06141";
const SCROLL = "06142";
// The Fellowship Aragorn and Roheryn, which gives him a Tactics icon that is not printed.
const ARAGORN = "145001";
const ROHERYN = "145012";
// Core heroes: Théodred (Leadership, Rohan), Gimli and Legolas (Tactics), Éowyn (Spirit, Rohan), Eleanor (Spirit, Gondor), Denethor (Lore,
// Gondor), Beravor (Lore, Dúnedain).
const THEODRED = "01002";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const ELEANOR = "01008";
const DENETHOR = "01010";
const BERAVOR = "01012";
// Guard of the Citadel (Gondor ally), Snowbourn Scout (Rohan ally), Gondorian Spearman (Tactics Gondor ally).
const GUARD = "01013";
const SNOWBOURN = "01016";
const SPEARMAN = "01029";
// Lore of Imladris (Lore event: heal all damage from a character), Ever Vigilant (Leadership event).
const IMLADRIS = "01063";
const VIGILANT = "01020";
// Radagast's Cunning (Lore event, which here has no target); Lórien's Wealth (Lore event: a player draws 3); Will of the West (Spirit
// event: shuffle the discard pile into the deck).
const CUNNING = "01065";
const WEALTH = "01064";
const WILL = "01049";
const WEAK = "weak";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [THEODEN, CAPTAIN, VISIONARY, SPEAR, EORLINGAS, STEED, LAY, PROSPECTOR, SCROLL, ARAGORN, ROHERYN, THEODRED, GIMLI, LEGOLAS, EOWYN, ELEANOR, DENETHOR, BERAVOR, GUARD, SNOWBOURN, SPEARMAN, IMLADRIS, VIGILANT, CUNNING, WEALTH, WILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Théoden (06134:A:2)", () => {
  // "Each Tactics hero with a printed Tactics resource icon gets +1 Willpower.": Théoden, Legolas and the other player's Gimli get +1;
  // Théodred (Leadership), the Gondorian Spearman (a Tactics ally) and Aragorn, whose Tactics icon Roheryn gives, do not.
  lineSpec("06134:A:2", "Théoden: each hero with a printed Tactics icon gets +1 Willpower", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: THEODEN, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: THEODRED, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 1 }], allies: [{ code: SPEARMAN, seat: 0 }, { code: ROHERYN, seat: 0 }] });
    const tab = attach(scene, [[idsOf(scene, ROHERYN), idsOf(scene, ARAGORN)]]);
    for (const code of [THEODEN, LEGOLAS, GIMLI]) expect(stat(tab.state, tab, idsOf(tab, code), "willpower")).toBe(printed(tab, code, "willpower") + 1);
    for (const code of [THEODRED, ARAGORN, SPEARMAN]) expect(stat(tab.state, tab, idsOf(tab, code), "willpower")).toBe(printed(tab, code, "willpower"));
  });
});

describe("Pelargir Ship Captain (06135:A:1)", () => {
  // "Response: After Pelargir Ship Captain enters play, move 1 resource from the resource pool of a hero you control to another hero's
  // resource pool.": the source is one of the player's heroes (not the other player's Gimli); the destination is any other hero, here the
  // other player's Gimli.
  lineSpec("06135:A:1", "Pelargir Ship Captain: moves 1 resource from a hero you control to another hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: GIMLI, seat: 1 }], hand: [{ code: CAPTAIN, seat: 0 }] }, 3);
    const [theodred, denethor, gimli, captain] = [idsOf(tab, THEODRED), idsOf(tab, DENETHOR), idsOf(tab, GIMLI), idsOf(tab, CAPTAIN)];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: captain, payments: [{ heroId: theodred, amount: 2 }] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("06135:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: captain, effectId: "06135:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([theodred, denethor].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: denethor }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([theodred, gimli].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gimli }, tab.ctx);
    expect(run.state.cards[denethor]?.resources).toBe(2);
    expect(run.state.cards[gimli]?.resources).toBe(4);
    expect(run.state.cards[theodred]?.resources).toBe(1);
  });

  // With no resource on any hero the player controls (the other player's Gimli holds some), there is nothing to move: no Response.
  it("06135:A:1 Pelargir Ship Captain: no Response when no hero you control has a resource", () => {
    const scene = table(EFFECTS, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: GIMLI, seat: 1 }], hand: [{ code: CAPTAIN, seat: 0 }] }, 2);
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, GIMLI), { resources: 3 }) };
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, CAPTAIN), payments: [{ heroId: idsOf(tab, THEODRED), amount: 2 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, THEODRED)]?.resources).toBe(0);
    expect(triggers(run.state, tab)).not.toContain("06135:response:1");
  });
});

// "to another hero's resource pool": with a single hero in play there is no other hero to move it to (rr.move), so no Response.
// FAULT: a move with no valid destination cannot initiate (rr.move); the engine offers the Response with no other hero in play.
it.fails("06135:A:1 Pelargir Ship Captain: no Response with no other hero", () => {
  const tab = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }], hand: [{ code: CAPTAIN, seat: 0 }] }, 3);
  const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, CAPTAIN), payments: [{ heroId: idsOf(tab, THEODRED), amount: 2 }] }, tab.ctx);
  expect(run.state.cards[idsOf(tab, THEODRED)]?.resources).toBe(1);
  expect(triggers(run.state, tab)).not.toContain("06135:response:1");
});

describe("Visionary Leadership (06136:A:1, A:2)", () => {
  // "Attach to a Gondor hero.": Denethor and Eleanor; not Théodred (Rohan) nor the Guard of the Citadel (a Gondor ally).
  lineSpec("06136:A:1", "Visionary Leadership: Attach to a Gondor hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: THEODRED, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: VISIONARY, seat: 0 }] });
    const card = idsOf(tab, VISIONARY);
    expect(hosts(tab, card)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, ELEANOR)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, DENETHOR)).state.cards[card]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "While attached hero has at least 1 resource in its resource pool, Gondor characters get +1 Willpower.": played on Denethor (who keeps
  // his resources: Théodred pays), Denethor, Eleanor, the Guard of the Citadel and the other player's Gondorian Spearman get +1; Théodred
  // does not.
  lineSpec("06136:A:2", "Visionary Leadership: Gondor characters get +1 Willpower while the hero has a resource", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: THEODRED, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: GUARD, seat: 0 }, { code: SPEARMAN, seat: 1 }], hand: [{ code: VISIONARY, seat: 0 }] }, 2);
    const card = idsOf(tab, VISIONARY);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: card, hostId: idsOf(tab, DENETHOR), payments: [{ heroId: idsOf(tab, THEODRED), amount: 2 }] }, tab.ctx);
    for (const code of [DENETHOR, ELEANOR, GUARD, SPEARMAN]) expect(stat(run.state, tab, idsOf(tab, code), "willpower")).toBe(printed(tab, code, "willpower") + 1);
    expect(stat(run.state, tab, idsOf(tab, THEODRED), "willpower")).toBe(printed(tab, THEODRED, "willpower"));
  });

  // With no resource on Denethor, no Gondor character gets the bonus.
  it("06136:A:2 Visionary Leadership: no bonus while the attached hero has no resource", () => {
    const scene = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }], allies: [{ code: VISIONARY, seat: 0 }] }, 0);
    const tab = attach(scene, [[idsOf(scene, VISIONARY), idsOf(scene, DENETHOR)]]);
    for (const code of [DENETHOR, ELEANOR]) expect(stat(tab.state, tab, idsOf(tab, code), "willpower")).toBe(printed(tab, code, "willpower"));
  });
});

describe("Spear of the Mark and Forth Eorlingas! (06137:A:2, A:3, 06138:A:1)", () => {
  // "Attach to a Rohan character.": Théodred, Éowyn and the Snowbourn Scout (a Rohan ally); not Legolas nor the Guard of the Citadel.
  lineSpec("06137:A:2", "Spear of the Mark: Attach to a Rohan character", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }, { code: GUARD, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }] });
    const spear = idsOf(tab, SPEAR);
    expect(hosts(tab, spear)).toEqual([idsOf(tab, THEODRED), idsOf(tab, EOWYN), idsOf(tab, SNOWBOURN)].sort());
    expect(play(begin(tab.state), tab, spear, idsOf(tab, SNOWBOURN)).state.cards[spear]?.host).toBe(idsOf(tab, SNOWBOURN));
  });

  // Théodred (Rohan) holds the Spear, Legolas pays for the event; a Weak enemy is engaged and another is in the staging area.
  function scene(effects: readonly Effect[]): { tab: Table; engaged: string; staged: string } {
    const tab = table(effects, { heroes: [{ code: THEODRED, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }], attached: [{ code: SPEAR, host: THEODRED }], hand: [{ code: EORLINGAS, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], staging: [WEAK] });
    // buildTable puts the staging area before the engaged enemies.
    const [staged = "", engaged = ""] = tab.ids[WEAK] ?? [];
    return { tab, engaged, staged };
  }
  const strikeOf = (steps: readonly { kind: string }[]) => steps.flatMap((step) => (step.kind === "strike" && "side" in step && step.side === "player" && "attack" in step ? [step.attack] : []));

  // "Attached character gets +1 Attack (+2 Attack instead if attacking an enemy in the staging area).": Théodred attacks the engaged enemy
  // with 2 + 1.
  lineSpec("06137:A:3", "Spear of the Mark: +1 Attack against an engaged enemy", (effects) => {
    const { tab, engaged } = scene(effects);
    expect(stat(tab.state, tab, idsOf(tab, THEODRED), "attack")).toBe(printed(tab, THEODRED, "attack") + 1);
    const run = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: engaged, attackerIds: [idsOf(tab, THEODRED)] }, tab.ctx), tab.ctx);
    expect(strikeOf(run.steps)).toEqual([printed(tab, THEODRED, "attack") + 1]);
  });

  // "Combat Action: Each Rohan hero can be declared as an attacker against enemies in the staging area this phase.": played in the combat
  // phase's action window, Théodred and Éowyn may attack the staged enemy; Legolas (not Rohan) and the Snowbourn Scout (a Rohan ally) may
  // not. Théodred's Spear makes his attack 2 + 2 (06137:A:3). In the next phase the permission is gone.
  lineSpec("06138:A:1", "Forth Eorlingas!: each Rohan hero may attack the staging area this phase", (effects) => {
    const { tab, staged: enemyId } = scene(effects);
    expect(refusal(attacking(tab.state), { type: "DeclareAttackers", enemyId, attackerIds: [idsOf(tab, EOWYN)] }, tab.ctx)).not.toBeNull();
    const run = sendUnledgered(combat(tab.state, tab), { type: "PlayCard", cardId: idsOf(tab, EORLINGAS), payments: [{ heroId: idsOf(tab, LEGOLAS), amount: 2 }] }, tab.ctx);
    const open = attacking(run.state);
    expect(refusal(open, { type: "DeclareAttackers", enemyId, attackerIds: [idsOf(tab, LEGOLAS)] }, tab.ctx)).not.toBeNull();
    expect(refusal(open, { type: "DeclareAttackers", enemyId, attackerIds: [idsOf(tab, SNOWBOURN)] }, tab.ctx)).not.toBeNull();
    expect(refusal(open, { type: "DeclareAttackers", enemyId, attackerIds: [idsOf(tab, EOWYN)] }, tab.ctx)).toBeNull();
    const attacked = passAll(sendUnledgered(begin(open), { type: "DeclareAttackers", enemyId, attackerIds: [idsOf(tab, THEODRED)] }, tab.ctx), tab.ctx);
    expect(strikeOf(attacked.steps)).toEqual([printed(tab, THEODRED, "attack") + 2]);
    expect(refusal(attacking(withMode(run.state, "refresh")), { type: "DeclareAttackers", enemyId, attackerIds: [idsOf(tab, EOWYN)] }, tab.ctx)).not.toBeNull();
  });

  // "Combat Action": it cannot be played in the planning phase.
  it("06138:A:1 Forth Eorlingas!: not played outside the combat phase", () => {
    const { tab } = scene(EFFECTS);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, EORLINGAS))).toBe(false);
  });
});

describe("Steed of the Mark (06139:A:1, A:2)", () => {
  // "Attach to a Gondor or Rohan hero.": Denethor (Gondor) and Théodred (Rohan); not Legolas nor the Guard of the Citadel (a Gondor ally).
  lineSpec("06139:A:1", "Steed of the Mark: Attach to a Gondor or Rohan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: THEODRED, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: STEED, seat: 0 }] });
    const steed = idsOf(tab, STEED);
    expect(hosts(tab, steed)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, THEODRED), idsOf(tab, EOWYN)].sort());
    expect(play(begin(tab.state), tab, steed, idsOf(tab, DENETHOR)).state.cards[steed]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "Response: after attached hero commits to a quest, spend 1 resource from attached hero's resource pool to ready attached hero.":
  // Théodred commits (and exhausts), pays 1 of his 2 resources and is ready again, still committed.
  lineSpec("06139:A:2", "Steed of the Mark: after the hero commits, 1 of its resources readies it", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: STEED, host: THEODRED }], deck: ["f0", "f0"] }, 2);
    const theodred = idsOf(tab, THEODRED);
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [theodred] }, tab.ctx);
    expect(run.state.cards[theodred]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).toContain("06139:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, STEED), effectId: "06139:response:1", payments: [{ heroId: theodred, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[theodred]).toMatchObject({ exhausted: false, committed: true, resources: 1 });
  });

  // With no resource on the attached hero, the cost cannot be paid: no Response. Éowyn, who does not ride the Steed, is offered none.
  it("06139:A:2 Steed of the Mark: no Response with an empty pool, nor for another hero", () => {
    const empty = table(EFFECTS, { start: "quest", heroes: [{ code: THEODRED, seat: 0 }], attached: [{ code: STEED, host: THEODRED }], deck: ["f0", "f0"] }, 0);
    expect(triggers(sendUnledgered(begin(empty.state), { type: "Commit", cardIds: [idsOf(empty, THEODRED)] }, empty.ctx).state, empty)).not.toContain("06139:response:1");
    const other = table(EFFECTS, { start: "quest", heroes: [{ code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: STEED, host: THEODRED }], deck: ["f0", "f0"] }, 2);
    expect(triggers(sendUnledgered(begin(other.state), { type: "Commit", cardIds: [idsOf(other, EOWYN)] }, other.ctx).state, other)).not.toContain("06139:response:1");
  });
});

describe("Lay of Nimrodel (06140:A:1)", () => {
  // "Action: Choose a Spirit hero. Until the end of the phase, that hero gets +1 Willpower for each resource in its resource pool.":
  // Éowyn and Eleanor (Spirit) are the choices, not Denethor; Eleanor pays, Éowyn with 3 resources gets +3 until the phase ends.
  lineSpec("06140:A:1", "Lay of Nimrodel: a Spirit hero gets +1 Willpower per resource until the end of the phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: LAY, seat: 0 }] }, 3);
    const [eowyn, eleanor] = [idsOf(tab, EOWYN), idsOf(tab, ELEANOR)];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, LAY), payments: [{ heroId: eleanor, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([eowyn, eleanor].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: eowyn }, tab.ctx);
    expect(stat(run.state, tab, eowyn, "willpower")).toBe(printed(tab, EOWYN, "willpower") + 3);
    expect(stat(run.state, tab, eleanor, "willpower")).toBe(printed(tab, ELEANOR, "willpower"));
    expect(stat(questing(withMode(run.state, "questCommit")), tab, eowyn, "willpower")).toBe(printed(tab, EOWYN, "willpower"));
  });
});

describe("Ered Nimrais Prospector (06141:A:1)", () => {
  // The Prospector in hand (Denethor pays), a deck of `deck` different cards, and Ever Vigilant in the discard pile.
  function scene(effects: readonly Effect[], deck: number): { tab: Table; vigilant: string } {
    const codes = [IMLADRIS, CUNNING, GUARD, SNOWBOURN, SPEARMAN].slice(0, deck);
    const start = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: PROSPECTOR, seat: 0 }], playerDeck: codes.map((code) => ({ code, seat: 0 })) });
    const { tab, ids: [vigilant = ""] } = discarded(start, [[VIGILANT, 0]]);
    return { tab, vigilant };
  }

  // "Response: After Ered Nimrais Prospector enters play, discard the top 3 cards of your deck. Then, choose and shuffle 1 card from your
  // discard pile back into your deck.": a deck of 5 loses its top 3; the choice is among the 4 cards of the discard pile, and Ever Vigilant
  // goes back into the deck of 3, which then holds 3.
  lineSpec("06141:A:1", "Ered Nimrais Prospector: discards the top 3, then shuffles a card of the discard pile into the deck", (effects) => {
    const { tab, vigilant } = scene(effects, 5);
    const top = tab.state.seats[0]?.deck.slice(0, 3) ?? [];
    let run = play(begin(tab.state), tab, idsOf(tab, PROSPECTOR));
    expect(triggers(run.state, tab)).toContain("06141:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, PROSPECTOR), effectId: "06141:response:1" }, tab.ctx);
    for (const id of top) expect(run.state.cards[id]?.zone).toBe("discard");
    expect(choices(run.state, tab).sort()).toEqual([vigilant, ...top].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: vigilant }, tab.ctx);
    expect(run.state.cards[vigilant]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.seats[0]?.discard).toHaveLength(3);
  });

  // "Then" (rr.then): with 2 cards in the deck the top 3 cannot be discarded in full, so no card of the discard pile goes back.
  // FAULT: the card shuffles a card back only after the top 3 are discarded in full; the engine discards 2 and still asks for a card.
  it.fails("06141:A:1 Ered Nimrais Prospector: with fewer than 3 cards in the deck, nothing is shuffled back", () => {
    const { tab, vigilant } = scene(EFFECTS, 2);
    let run = play(begin(tab.state), tab, idsOf(tab, PROSPECTOR));
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, PROSPECTOR), effectId: "06141:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.deck).toHaveLength(0);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[vigilant]?.zone).toBe("discard");
  });
});

describe("Scroll of Isildur (06142:A:1 to A:3)", () => {
  // "Attach to a Lore hero.": Denethor and Beravor; not Legolas.
  lineSpec("06142:A:1", "Scroll of Isildur: Attach to a Lore hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: SCROLL, seat: 0 }] });
    const scroll = idsOf(tab, SCROLL);
    expect(hosts(tab, scroll)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, BERAVOR)].sort());
    expect(play(begin(tab.state), tab, scroll, idsOf(tab, BERAVOR)).state.cards[scroll]?.host).toBe(idsOf(tab, BERAVOR));
  });

  // "Reduce the cost to play Scroll of Isildur by 1 for each hero you control with a printed Lore resource icon.": Denethor and Beravor
  // make it 4 - 2; the other player's Lore hero (a second Denethor seat) does not count, nor does Legolas.
  lineSpec("06142:A:2", "Scroll of Isildur: 1 less for each hero you control with a printed Lore icon", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 1 }], hand: [{ code: SCROLL, seat: 0 }] });
    expect(playCost(tab.state, idsOf(tab, SCROLL), 0, tab.ctx)).toBe(4 - 2);
  });

  // "Action: Discard Scroll of Isildur to play any Lore event card in your discard pile as if it were in your hand. Then, place that event
  // on the bottom of your deck.": the Lore events Lore of Imladris and Lórien's Wealth are the choices; Will of the West (Spirit, and
  // Eleanor could pay for it) is not. Lore of Imladris is played, its cost of 2 paid by the Lore heroes, and heals Denethor; the Scroll is
  // discarded and the event is at the bottom of the deck.
  lineSpec("06142:A:3", "Scroll of Isildur: discards itself to play a Lore event from the discard pile, then puts it on the bottom of the deck", (effects) => {
    const scene = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: ELEANOR, seat: 0 }], attached: [{ code: SCROLL, host: BERAVOR }], playerDeck: fillers(CARD, 4) });
    const { tab: listed, ids: [imladris = "", will = "", wealth = ""] } = discarded(scene, [[IMLADRIS, 0], [WILL, 0], [WEALTH, 0]]);
    const denethor = idsOf(listed, DENETHOR);
    const tab = { ...listed, state: updateCard(listed.state, denethor, { damage: 2 }) };
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, SCROLL), effectId: "06142:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, SCROLL)]?.zone).toBe("discard");
    expect(choices(run.state, tab).sort()).toEqual([imladris, wealth].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: imladris }, tab.ctx);
    // Its cost is paid one resource at a time, by a Lore hero (Eleanor is no choice).
    const beravor = idsOf(tab, BERAVOR);
    expect(choices(run.state, tab).sort()).toEqual([denethor, beravor].sort());
    run = sendUnledgered(sendUnledgered(run, { type: "Choose", optionId: beravor }, tab.ctx), { type: "Choose", optionId: beravor }, tab.ctx);
    expect(run.state.cards[beravor]?.resources).toBe(6 - 2);
    // Denethor is the only damaged character, so Lore of Imladris heals him without a question.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[denethor]?.damage).toBe(0);
    expect(run.state.seats[0]?.deck.at(-1)).toBe(imladris);
    expect(run.state.cards[will]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, ELEANOR)]?.resources).toBe(6);
  });

  // No Lore event in the discard pile (Will of the West is Spirit, and Eleanor could pay for it): the Action is not offered.
  it("06142:A:3 Scroll of Isildur: not offered without a Lore event in the discard pile", () => {
    const scene = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }], attached: [{ code: SCROLL, host: DENETHOR }], playerDeck: fillers(CARD, 2) });
    const { tab } = discarded(scene, [[WILL, 0]]);
    expect(triggers(tab.state, tab)).not.toContain("06142:action:1");
  });
});
