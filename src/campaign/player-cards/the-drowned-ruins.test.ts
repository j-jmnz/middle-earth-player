// Rules: rr.attachment-cards, rr.modifiers, rr.lasting-effects, rr.response, rr.action, rr.triggered-ability, rr.then, rr.cost,
// rr.enters-play, rr.play-restrictions-and-permissions, rr.quest-phase, rr.step-3-2, rr.step-3-3, rr.travel, rr.engagement-check,
// rr.location-cards, rr.encounter-deck, rr.may (data/rules/entries.json).
// The Drowned Ruins player cards, written from their card text (data/cards/DR.json; data/printed holds no ledger for this pack, so every
// intent goes through sendUnledgered): Dúnedain Remedy 12084:A:1 to A:3, Marksman of Lórien 12085:A:2, Battle-fury 12086:A:1 and A:2,
// Woodland Courier 12087:A:1, Hithlain 12088:A:1 and A:2, Robin Smallburrow 12089:A:1, Interrogation 12090:A:1, Strider 12091:A:1 to A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, endRound, fillers, hosts, passWhile, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const REMEDY = "12084";
const MARKSMAN = "12085";
const FURY = "12086";
const COURIER = "12087";
const HITHLAIN = "12088";
const ROBIN = "12089";
const INTERROGATION = "12090";
const STRIDER = "12091";
// Core heroes: Théodred (Leadership), Legolas (Tactics), Éowyn (Spirit), Denethor (Lore). Lórien Guide: a Spirit Silvan ally;
// Wandering Took: a Spirit ally that is not Silvan. Forest Snare: a Lore Trap attachment.
const THEODRED = "01002";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
const GUIDE = "01044";
const TOOK = "01043";
const SNARE = "01069";
// Green Hill Country (Forest, 3 quest points) and Stock Road (Road, 3 quest points) of scenario 1's encounter deck.
const GREEN_HILL = "141036";
const STOCK_ROAD = "141037";
const WALL = "wall";
const SPY = "spy";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [REMEDY, MARKSMAN, FURY, COURIER, HITHLAIN, ROBIN, INTERROGATION, STRIDER, THEODRED, LEGOLAS, EOWYN, DENETHOR, GUIDE, TOOK, SNARE, GREEN_HILL, STOCK_ROAD];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 3, health: 9 }));
  cards.set(SPY, definePrinted({ code: SPY, name: "Spy", type: "enemy", threat: 3, engagementCost: 30, attack: 1, defense: 1, health: 4 }));
  base = { ...starter, cards };
});

describe("Dúnedain Remedy (12084:A:1 to A:3)", () => {
  // "Attach to a hero.": Théodred, Denethor and the other player's hero; not an ally.
  lineSpec("12084:A:1", "Dúnedain Remedy: Attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: REMEDY, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, REMEDY))).toEqual([idsOf(tab, THEODRED), idsOf(tab, DENETHOR), idsOf(tab, PAL)].sort());
  });

  // Théodred and Denethor with 2 damage each; the Remedy in hand, or on Théodred (`on`).
  function scene(effects: readonly Effect[], on: boolean, resources = 2): Table {
    const start = table(effects, { heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }], ...(on ? { allies: [{ code: REMEDY, seat: 0 }] } : { hand: [{ code: REMEDY, seat: 0 }] }) }, resources);
    const hurt = updateCard(updateCard(start.state, idsOf(start, THEODRED), { damage: 2 }), idsOf(start, DENETHOR), { damage: 2 });
    const tab = { ...start, state: hurt };
    return on ? attach(tab, [[idsOf(tab, REMEDY), idsOf(tab, THEODRED)]]) : tab;
  }

  // "Response: After Dúnedain Remedy is attached to a hero, heal 1 damage on that hero.": played on Denethor, it heals him 1; Théodred
  // keeps his 2.
  lineSpec("12084:A:2", "Dúnedain Remedy: heals 1 damage on the hero it is attached to", (effects) => {
    const tab = scene(effects, false);
    const [remedy, denethor] = [idsOf(tab, REMEDY), idsOf(tab, DENETHOR)];
    let run = play(begin(tab.state), tab, remedy, denethor);
    expect(triggers(run.state, tab)).toContain("12084:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: remedy, effectId: "12084:response:1" }, tab.ctx);
    expect(run.state.cards[denethor]?.damage).toBe(1);
    expect(run.state.cards[idsOf(tab, THEODRED)]?.damage).toBe(2);
  });

  // An undamaged hero has nothing to heal: no Response (rr.triggered-ability).
  it("12084:A:2 Dúnedain Remedy: no Response when attached to an undamaged hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: REMEDY, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, REMEDY), idsOf(tab, DENETHOR));
    expect(run.state.cards[idsOf(tab, REMEDY)]?.host).toBe(idsOf(tab, DENETHOR));
    expect(triggers(run.state, tab)).not.toContain("12084:response:1");
  });

  // "Action: Pay 1 resource from attached hero's resource pool to attach Dúnedain Remedy to another hero.": on Théodred, it moves to
  // Denethor and Théodred pays 1; attached again, it may heal Denethor 1 (12084:A:2).
  lineSpec("12084:A:3", "Dúnedain Remedy: 1 resource from the hero's pool moves it to another hero", (effects) => {
    const tab = scene(effects, true);
    const [remedy, theodred, denethor] = [idsOf(tab, REMEDY), idsOf(tab, THEODRED), idsOf(tab, DENETHOR)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: remedy, effectId: "12084:action:1", payments: [{ heroId: theodred, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[remedy]?.host).toBe(denethor);
    expect(run.state.cards[theodred]?.resources).toBe(1);
    expect(triggers(run.state, tab)).toContain("12084:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: remedy, effectId: "12084:response:1" }, tab.ctx);
    expect(run.state.cards[denethor]?.damage).toBe(1);
  });

  it("12084:A:3 Dúnedain Remedy: not offered with an empty pool", () => {
    const tab = scene(EFFECTS, true, 0);
    expect(triggers(tab.state, tab)).not.toContain("12084:action:1");
  });
});

describe("Marksman of Lórien (12085:A:2)", () => {
  // "Response: After Marksman of Lórien enters play, choose an enemy. That enemy gets -2 Defense until the end of the round.": the
  // choices are the Wall engaged with the player, the one engaged with the other player and the one in the staging area; the chosen one
  // has 3 - 2 Defense until the round ends.
  lineSpec("12085:A:2", "Marksman of Lórien: an enemy gets -2 Defense until the end of the round", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: MARKSMAN, seat: 0 }], staging: [WALL], engaged: [{ code: WALL, seat: 0 }, { code: WALL, seat: 1 }] });
    const walls = tab.ids[WALL] ?? [];
    const [, mine = "", theirs = ""] = walls;
    let run = play(begin(tab.state), tab, idsOf(tab, MARKSMAN));
    expect(triggers(run.state, tab)).toContain("12085:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, MARKSMAN), effectId: "12085:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([...walls].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: theirs }, tab.ctx);
    expect(stat(run.state, tab, theirs, "defense")).toBe(3 - 2);
    expect(stat(run.state, tab, mine, "defense")).toBe(3);
    expect(stat(withMode(run.state, "refresh"), tab, theirs, "defense")).toBe(3 - 2);
    expect(stat(endRound(run.state, tab).state, tab, theirs, "defense")).toBe(3);
  });
});

describe("Battle-fury (12086:A:1, A:2)", () => {
  // The quest phase's commit step: Legolas (Tactics, Attack 3) and Éowyn (Spirit) ready, the Wall engaged and a Spy in the staging area.
  function scene(effects: readonly Effect[]): Table {
    return table(effects, { start: "quest", heroes: [{ code: LEGOLAS, seat: 0 }, { code: EOWYN, seat: 0 }], hand: [{ code: FURY, seat: 0 }], engaged: [{ code: WALL, seat: 0 }], staging: [SPY], deck: ["f0", "f0"] });
  }

  // "Play only before the staging step.": once the commit is made, the staging step runs, and in the action window after it Battle-fury
  // is no longer played.
  lineSpec("12086:A:1", "Battle-fury: not played after the staging step", (effects) => {
    const tab = scene(effects);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, FURY))).toBe(true);
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, EOWYN)] }, tab.ctx);
    run = passWhile(run, tab, (run) => run.state.mode === "questCommit", 5);
    expect(run.state.phase).toBe("Quest");
    expect(run.state.mode).not.toBe("questCommit");
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass")).toBe(true);
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, FURY))).toBe(false);
  });

  // "Quest Action: Exhaust a hero you control to immediately declare it as an attacker (and resolve its attack) against any eligible
  // enemy target. Then, the players as a group may spend 1 Spirit resource to commit that hero to the quest.": Legolas exhausts and attacks
  // the engaged Wall (3 - 3 = 0 damage... the Spy in the staging area is not an eligible target); then Éowyn's Spirit resource commits
  // him to the quest.
  lineSpec("12086:A:2", "Battle-fury: a hero exhausts to attack, then 1 Spirit resource commits it", (effects) => {
    const tab = scene(effects);
    const [legolas, eowyn, wall] = [idsOf(tab, LEGOLAS), idsOf(tab, EOWYN), idsOf(tab, WALL)];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, FURY), payments: [{ heroId: legolas, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([legolas, eowyn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: legolas }, tab.ctx);
    expect(run.state.cards[legolas]?.exhausted).toBe(true);
    const strikes = run.steps.flatMap((step) => (step.kind === "strike" && step.side === "player" ? [[step.enemyId, step.attack]] : []));
    expect(strikes).toEqual([[wall, 3]]);
    expect(run.state.cards[idsOf(tab, SPY)]?.damage).toBe(0);
    expect(choices(run.state, tab).sort()).toEqual(["commit", "decline"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "commit" }, tab.ctx);
    expect(run.state.cards[legolas]?.committed).toBe(true);
    expect(run.state.cards[eowyn]?.resources).toBe(6 - 1);
  });
});

describe("Woodland Courier (12087:A:1)", () => {
  // "Response: After Woodland Courier enters play, place 1 progress on a location (2 progress instead if that location has the Forest
  // trait).": the choices are the staged Stock Road and the active Green Hill Country; on the Forest it places 2, on the Road 1.
  lineSpec("12087:A:1", "Woodland Courier: 1 progress on a location, 2 on a Forest", (effects) => {
    for (const [target, progress] of [[GREEN_HILL, 2], [STOCK_ROAD, 1]] as const) {
      const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: COURIER, seat: 0 }], staging: [STOCK_ROAD], active: GREEN_HILL });
      let run = play(begin(tab.state), tab, idsOf(tab, COURIER));
      expect(triggers(run.state, tab)).toContain("12087:response:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, COURIER), effectId: "12087:response:1" }, tab.ctx);
      expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, GREEN_HILL), idsOf(tab, STOCK_ROAD)].sort());
      run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, target) }, tab.ctx);
      expect(run.state.cards[idsOf(tab, target)]?.progress).toBe(progress);
    }
  });
});

describe("Hithlain (12088:A:1, A:2)", () => {
  // "Attach to a location. Limit 1 per location": the staged Stock Road; not Green Hill Country, which holds a Hithlain, nor a hero.
  lineSpec("12088:A:1", "Hithlain: Attach to a location, one per location", (effects) => {
    const scene = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: HITHLAIN, seat: 0 }], staging: [STOCK_ROAD, GREEN_HILL], hand: [{ code: HITHLAIN, seat: 0 }] });
    const [worn = "", held = ""] = scene.ids[HITHLAIN] ?? [];
    const tab = attach(scene, [[worn, idsOf(scene, GREEN_HILL)]]);
    expect(hosts(tab, held)).toEqual([idsOf(tab, STOCK_ROAD)]);
  });

  // Hithlain on the staged Stock Road; Éowyn pays for the allies in hand.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: HITHLAIN, seat: 0 }], staging: [STOCK_ROAD], hand: [{ code: GUIDE, seat: 0 }, { code: TOOK, seat: 0 }] });
    return attach(tab, [[idsOf(tab, HITHLAIN), idsOf(tab, STOCK_ROAD)]]);
  }

  // "Response: After a player plays a Silvan ally from his hand, place 1 progress on attached location.": the Lórien Guide is played; 1
  // progress on the Stock Road.
  lineSpec("12088:A:2", "Hithlain: 1 progress on its location after a Silvan ally is played from hand", (effects) => {
    const tab = scene(effects);
    let run = play(begin(tab.state), tab, idsOf(tab, GUIDE));
    expect(triggers(run.state, tab)).toContain("12088:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, HITHLAIN), effectId: "12088:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, STOCK_ROAD)]?.progress).toBe(1);
  });

  // The Wandering Took is not Silvan: no Response.
  it("12088:A:2 Hithlain: no Response for an ally that is not Silvan", () => {
    const tab = scene(EFFECTS);
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, TOOK)).state, tab)).not.toContain("12088:response:1");
  });
});

describe("Robin Smallburrow (12089:A:1)", () => {
  // The travel phase: Robin in play, Éowyn (Spirit) and Denethor (Lore), Green Hill Country (3 quest points) in the staging area, a Wall
  // there too and another engaged with the player.
  function scene(effects: readonly Effect[], resources = 2): Table {
    return table(effects, { start: "travel", heroes: [{ code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: ROBIN, seat: 0 }], staging: [GREEN_HILL, WALL], engaged: [{ code: WALL, seat: 0 }] }, resources);
  }

  // "Response: After you travel to a location, spend 1 Spirit resource to raise the engagement cost of each enemy in play by X until the
  // end of the round, where X is that location's quest points.": after the travel, Éowyn's Spirit resource raises both Walls' engagement
  // cost by 3, until the round ends.
  lineSpec("12089:A:1", "Robin Smallburrow: 1 Spirit resource raises each enemy's engagement cost by the location's quest points", (effects) => {
    const tab = scene(effects);
    const walls = tab.ids[WALL] ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "Travel", locationId: idsOf(tab, GREEN_HILL) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("12089:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, ROBIN), effectId: "12089:response:1", payments: [{ heroId: idsOf(tab, EOWYN), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, EOWYN)]?.resources).toBe(1);
    for (const id of walls) expect(stat(run.state, tab, id, "engagementCost")).toBe(30 + 3);
    for (const id of walls) expect(stat(endRound(run.state, tab).state, tab, id, "engagementCost")).toBe(30);
  });

  // With no Spirit resource (Denethor's Lore resources do not count), the cost cannot be paid: no Response.
  it("12089:A:1 Robin Smallburrow: no Response without a Spirit resource", () => {
    const start = scene(EFFECTS);
    const tab = { ...start, state: updateCard(start.state, idsOf(start, EOWYN), { resources: 0 }) };
    const run = sendUnledgered(begin(tab.state), { type: "Travel", locationId: idsOf(tab, GREEN_HILL) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GREEN_HILL)]?.zone).toBe("activeLocation");
    expect(triggers(run.state, tab)).not.toContain("12089:response:1");
  });
});

// With no enemy in play there is no engagement cost to raise (rr.triggered-ability).
it("12089:A:1 Robin Smallburrow: no Response with no enemy in play", () => {
  const tab = table(EFFECTS, { start: "travel", heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: ROBIN, seat: 0 }], staging: [GREEN_HILL] }, 2);
  const run = sendUnledgered(begin(tab.state), { type: "Travel", locationId: idsOf(tab, GREEN_HILL) }, tab.ctx);
  expect(run.state.cards[idsOf(tab, GREEN_HILL)]?.zone).toBe("activeLocation");
  expect(triggers(run.state, tab)).not.toContain("12089:response:1");
});

describe("Interrogation (12090:A:1)", () => {
  // Denethor pays; the Spy (printed Threat 3) engaged with a Forest Snare on it, a Wall engaged without one; an encounter deck of 5.
  function scene(effects: readonly Effect[], snared = true): { tab: Table; deck: readonly string[] } {
    const start = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: SNARE, seat: 0 }], engaged: [{ code: SPY, seat: 0 }, { code: WALL, seat: 0 }], hand: [{ code: INTERROGATION, seat: 0 }], deck: ["f0", "f3", WALL, STOCK_ROAD, GREEN_HILL] });
    const tab = snared ? attach(start, [[idsOf(start, SNARE), idsOf(start, SPY)]]) : start;
    return { tab, deck: tab.state.encounterDeck };
  }

  // "Action: Choose an enemy with an attached Trap card. Look at the top X cards of the encounter deck, where X is that enemy's printed
  // Threat. You may discard 1 of those cards. Return the rest to the top of the deck, in the same order.": the Spy is the only choice;
  // the top 3 are looked at, the second is discarded, and the deck is the other 4 in their order.
  lineSpec("12090:A:1", "Interrogation: looks at the top X cards for a trapped enemy and discards 1 of them", (effects) => {
    const { tab, deck } = scene(effects);
    const [first = "", second = "", third = "", fourth = "", fifth = ""] = deck;
    let run = play(begin(tab.state), tab, idsOf(tab, INTERROGATION));
    run = passWhile(run, tab, (run) => run.state.window?.kind === "look", 4);
    expect(choices(run.state, tab).sort()).toEqual(["discard", "keep"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([first, second, third].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: second }, tab.ctx);
    expect(run.state.cards[second]?.zone).toBe("encounterDiscard");
    expect(run.state.encounterDeck).toEqual([first, third, fourth, fifth]);
  });

  // No enemy has a Trap attached: it is not played.
  it("12090:A:1 Interrogation: not played without a trapped enemy", () => {
    const { tab } = scene(EFFECTS, false);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, INTERROGATION))).toBe(false);
  });
});

describe("Strider (12091:A:1 to A:3)", () => {
  // "Attach to a hero.": Théodred and the other player's hero; not an ally.
  lineSpec("12091:A:1", "Strider: Attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: STRIDER, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, STRIDER))).toEqual([idsOf(tab, THEODRED), idsOf(tab, PAL)].sort());
  });

  // Strider on Éowyn, with `heroes` heroes in all and `allies` allies.
  function scene(effects: readonly Effect[], heroes: number, allies: number, extra: Scene = {}): Table {
    const others = [{ code: DENETHOR, seat: 0 }, { code: THEODRED, seat: 0 }].slice(0, heroes - 1);
    const tab = table(effects, { start: "quest", heroes: [{ code: EOWYN, seat: 0 }, ...others], allies: [...fillers(ALLY, allies), { code: STRIDER, seat: 0 }], deck: ["f0", "f0"], ...extra });
    return attach(tab, [[idsOf(tab, STRIDER), idsOf(tab, EOWYN)]]);
  }

  // "While you control 2 or fewer heroes, attached hero does not exhaust to commit to the quest.": with 2 heroes Éowyn commits and stays
  // ready; with 3 she exhausts.
  lineSpec("12091:A:2", "Strider: with 2 or fewer heroes the hero does not exhaust to quest", (effects) => {
    const two = scene(effects, 2, 0);
    const committed = sendUnledgered(begin(two.state), { type: "Commit", cardIds: [idsOf(two, EOWYN)] }, two.ctx);
    expect(committed.state.cards[idsOf(two, EOWYN)]).toMatchObject({ committed: true, exhausted: false });
    const three = scene(effects, 3, 0);
    const tired = sendUnledgered(begin(three.state), { type: "Commit", cardIds: [idsOf(three, EOWYN)] }, three.ctx);
    expect(tired.state.cards[idsOf(three, EOWYN)]).toMatchObject({ committed: true, exhausted: true });
  });

  // "While you control 5 or fewer characters, attached hero gets +2 Willpower.": 2 heroes and 3 allies are 5, so Éowyn has 4 + 2; a sixth
  // character played from the hand takes the bonus away in the state that play returns.
  lineSpec("12091:A:3", "Strider: +2 Willpower while you control 5 or fewer characters", (effects) => {
    const tab = scene(effects, 2, 3, { hand: [{ code: TOOK, seat: 0 }] });
    const planning = { ...tab, state: { ...tab.state, phase: "Planning" as const, boundaryPhase: "Planning" as const, mode: "planning" as const, window: { kind: "pass" as const } } };
    const eowyn = idsOf(planning, EOWYN);
    expect(stat(planning.state, planning, eowyn, "willpower")).toBe(printed(planning, EOWYN, "willpower") + 2);
    const sixth = idsOf(planning, TOOK);
    const run: Run = play(begin(planning.state), planning, sixth);
    expect(run.state.cards[sixth]?.zone).toBe("play");
    expect(stat(run.state, planning, eowyn, "willpower")).toBe(printed(planning, EOWYN, "willpower"));
  });

  // The other player's characters do not count toward "you control".
  it("12091:A:3 Strider: another player's characters do not count", () => {
    const tab = scene(EFFECTS, 2, 3, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [...fillers(ALLY, 3), { code: STRIDER, seat: 0 }, ...fillers(ALLY, 3, 1)] });
    expect(stat(tab.state, tab, idsOf(tab, EOWYN), "willpower")).toBe(printed(tab, EOWYN, "willpower") + 2);
  });
});
