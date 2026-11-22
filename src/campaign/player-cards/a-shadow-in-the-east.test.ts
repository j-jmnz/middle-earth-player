// Rules: rr.response, rr.attachment-cards, rr.modifiers, rr.lasting-effects, rr.enters-play, rr.travel, rr.optional-engagement,
// rr.engaged, rr.attack-strength, rr.ready, rr.cost, rr.quest-phase, rr.delayed-effects, rr.active-location, rr.limits, rr.unique-cards,
// rr.cannot (data/rules/entries.json).
// The A Shadow in the East player cards, each printed line tested from the words on the card: Frodo Baggins 21002:A:1, Merry 21003:A:1,
// Pippin 21004:A:1 and A:2, Faramir 21005:A:1, Put Off Pursuit 21008:A:1, Sméagol 21072:A:1 and A:3, The Ring of Power 21011:A:1. The lines are the text of
// data/cards (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, endRound, hosts, passAll, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const FRODO_HERO = "21002";
const MERRY_ALLY = "21003";
const PIPPIN = "21004";
const FARAMIR = "21005";
const PURSUIT = "21008";
const SMEAGOL = "21072";
const RING_OF_POWER = "21011";
// The One Ring (a player attachment) and the Ring of Barahir, an Artifact attachment with the Ring trait that is not The One Ring; Core: Aragorn and Éowyn.
const ONE_RING = "21001";
const BARAHIR = "06007";
const ARAGORN = "01001";
const EOWYN = "01007";
// Citadel Plate: "Attach to a hero. Restricted.", a Tactics attachment of cost 4.
const PLATE = "01040";
// Cards with no text: a Tactics hero and a Lore hero (unique, as heroes are), a unique ally and a second one, a location, enemies of 9 hit points (a non-unique
// pair and a unique one), and an attachment.
const TACTICIAN = "tactician";
const SAGE = "sage";
const UNIQUE = "unique-ally";
const OTHER_UNIQUE = "other-unique";
const PLACE = "place";
const ROAD = "road";
const WALL = "wall";
const MOAT = "moat";
const BOSS = "boss";
const PAL = "pal";
const ALLY = "ally";
// Starter enemies: Cheap (engagement cost 2) and Dear (engagement cost 50), and f3 (threat 3).
const CHEAP = "cheap";
const DEAR = "dear";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([FRODO_HERO, MERRY_ALLY, PIPPIN, FARAMIR, PURSUIT, SMEAGOL, PLATE, RING_OF_POWER, ONE_RING, BARAHIR, ARAGORN, EOWYN]))]);
  cards.set(TACTICIAN, definePrinted({ code: TACTICIAN, name: "Tactician", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4, isUnique: true }));
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 4, isUnique: true }));
  cards.set(UNIQUE, definePrinted({ code: UNIQUE, name: "Unique Ally", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, isUnique: true }));
  cards.set(OTHER_UNIQUE, definePrinted({ code: OTHER_UNIQUE, name: "Other Unique", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, isUnique: true }));
  cards.set(PLACE, definePrinted({ code: PLACE, name: "Place", type: "location", threat: 1, questPoints: 3 }));
  cards.set(ROAD, definePrinted({ code: ROAD, name: "Road", type: "location", threat: 1, questPoints: 2 }));
  for (const code of [WALL, MOAT]) cards.set(code, definePrinted({ code, name: code, type: "enemy", threat: 1, engagementCost: 40, attack: 0, defense: 0, health: 9 }));
  cards.set(BOSS, definePrinted({ code: BOSS, name: "Boss", type: "enemy", threat: 1, engagementCost: 40, attack: 0, defense: 0, health: 9, isUnique: true }));
  base = { ...starter, cards };
});

describe("Frodo Baggins (21002:A:1)", () => {
  // Frodo (6 resources), the Sage (a unique hero), the Unique Ally and a plain ally commit to the quest; the staging area holds the
  // threat given, and the encounter deck two enemies of threat 0.
  function committed(effects: readonly Effect[], staging: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: FRODO_HERO, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: UNIQUE, seat: 0 }, { code: ALLY, seat: 0 }], staging, deck: ["f0", "f0"] });
    const ids = [FRODO_HERO, SAGE, UNIQUE, ALLY].map((code) => idsOf(tab, code));
    return { tab, run: sendUnledgered(begin(tab.state), { type: "Commit", cardIds: ids }, tab.ctx) };
  }
  const respond = (tab: Table, run: Run): Run => {
    const frodo = idsOf(tab, FRODO_HERO);
    return sendUnledgered(run, { type: "Trigger", cardId: frodo, effectId: "21002:response:1", payments: [{ heroId: frodo, amount: 1 }] }, tab.ctx);
  };

  // "Response: After Frodo Baggins commits to the quest, spend 1 resource from his resource pool to ready another unique character
  // committed to the quest. If you quest successfully this phase, reduce your threat by 1.": the Sage and the Unique Ally are the
  // choices (not Frodo, not the plain ally); the Unique Ally is ready, Frodo has paid 1, and the quest succeeds: threat 8 goes to 7.
  lineSpec("21002:A:1", "Frodo Baggins: ready another unique questing character, and 1 threat less after a successful quest", (effects) => {
    const { tab, run: start } = committed(effects, []);
    const [frodo, sage, unique] = [idsOf(tab, FRODO_HERO), idsOf(tab, SAGE), idsOf(tab, UNIQUE)];
    expect(triggers(start.state, tab)).toContain("21002:response:1");
    let run = respond(tab, start);
    expect(choices(run.state, tab).sort()).toEqual([sage, unique].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: unique }, tab.ctx);
    expect(run.state.cards[unique]).toMatchObject({ exhausted: false, committed: true });
    expect(run.state.cards[frodo]?.resources).toBe(6 - 1);
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.phase).not.toBe("Quest");
    expect(run.state.seats[0]?.threat).toBe(8 - 1);
  });

  // An unsuccessful quest (6 threat in the staging area against 5 Willpower) raises the threat by 1 and Frodo takes nothing off.
  it("21002:A:1 Frodo Baggins: no threat reduction when the quest fails", () => {
    const { tab, run: start } = committed(EFFECTS, ["f3", "f3"]);
    let run = respond(tab, start);
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, UNIQUE) }, tab.ctx);
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.phase).not.toBe("Quest");
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
  });
});

describe("Merry (21003:A:1)", () => {
  // Merry in hand (the Pal pays), the Unique Ally and a plain ally in play, the other player's unique ally, and a second unique ally in hand.
  const scene = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: SAGE, seat: 1 }], allies: [{ code: UNIQUE, seat: 0 }, { code: ALLY, seat: 0 }, { code: UNIQUE, seat: 1 }], hand: [{ code: MERRY_ALLY, seat: 0 }, { code: OTHER_UNIQUE, seat: 0 }] });

  // "Response: After Merry enters play, each unique ally you control gets +1 Willpower until the end of the round.": Merry and the Unique
  // Ally get +1, the plain ally and the other player's unique ally do not; a unique ally played after it does not either (rr.lasting-effects),
  // and the bonus ends with the round.
  lineSpec("21003:A:1", "Merry: each unique ally you control gets +1 Willpower until the end of the round", (effects) => {
    const tab = scene(effects);
    const [merry, unique = "", theirs = "", plain] = [idsOf(tab, MERRY_ALLY), ...(tab.ids[UNIQUE] ?? []), idsOf(tab, ALLY)];
    let run = play(begin(tab.state), tab, merry);
    expect(triggers(run.state, tab)).toContain("21003:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: merry, effectId: "21003:response:1" }, tab.ctx);
    expect(stat(run.state, tab, merry, "willpower")).toBe(2 + 1);
    expect(stat(run.state, tab, unique, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, plain, "willpower")).toBe(1);
    expect(stat(run.state, tab, theirs, "willpower")).toBe(1);
    run = play(run, tab, idsOf(tab, OTHER_UNIQUE));
    expect(stat(run.state, tab, idsOf(tab, OTHER_UNIQUE), "willpower")).toBe(1);
    const ended = endRound(run.state, tab);
    expect(stat(ended.state, tab, merry, "willpower")).toBe(2);
    expect(stat(ended.state, tab, unique, "willpower")).toBe(1);
  });
});

describe("Pippin (21004:A:1, A:2)", () => {
  // Pippin and the Tactician (Tactics, pays); Dear (engagement cost 50) and Cheap (2) against a threat of 8.
  const scene = (effects: readonly Effect[], where: "engaged" | "staging") => {
    const enemies = [DEAR, CHEAP];
    return table(effects, { start: where === "staging" ? "encounter" : "planning", heroes: [{ code: TACTICIAN, seat: 0 }], allies: [{ code: PIPPIN, seat: 0 }], ...(where === "engaged" ? { engaged: enemies.map((code) => ({ code, seat: 0 })) } : { staging: enemies }) });
  };
  const strikeAttack = (run: Run): number[] => run.steps.flatMap((step) => (step.kind === "strike" && step.side === "player" ? [step.attack] : []));

  // "Pippin gets +2 Attack while attacking an enemy with an engagement cost higher than your threat.": his attack on Dear strikes with 0 + 2;
  // on Cheap with his printed 0.
  lineSpec("21004:A:1", "Pippin: +2 Attack while attacking an enemy with an engagement cost higher than your threat", (effects) => {
    const tab = scene(effects, "engaged");
    const pippin = idsOf(tab, PIPPIN);
    const dear = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, DEAR), attackerIds: [pippin] }, tab.ctx), tab.ctx, { responses: true });
    expect(strikeAttack(dear)).toEqual([0 + 2]);
    expect(stat(dear.state, tab, pippin, "attack")).toBe(0);
    const cheap = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, CHEAP), attackerIds: [pippin] }, tab.ctx), tab.ctx, { responses: true });
    expect(strikeAttack(cheap)).toEqual([0]);
  });

  // "Response: After you engage an enemy with an engagement cost higher than your threat, ready Pippin.": the exhausted Pippin is ready after
  // the player engages Dear; engaging Cheap offers nothing.
  lineSpec("21004:A:2", "Pippin: ready after you engage an enemy with an engagement cost higher than your threat", (effects) => {
    const scene0 = scene(effects, "staging");
    const tab = { ...scene0, state: updateCard(scene0.state, idsOf(scene0, PIPPIN), { exhausted: true }) };
    const pippin = idsOf(tab, PIPPIN);
    const cheap = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, CHEAP) }, tab.ctx);
    expect(triggers(cheap.state, tab)).not.toContain("21004:response:1");
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, DEAR) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("21004:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: pippin, effectId: "21004:response:1" }, tab.ctx);
    expect(run.state.cards[pippin]?.exhausted).toBe(false);
  });
});

describe("Faramir (21005:A:1)", () => {
  // Faramir in hand (the Sage pays); Wall and Moat (non-unique) and the unique Boss in the staging area, the Moat holding an attachment,
  // and the Cheap enemy engaged with the player.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { heroes: [{ code: SAGE, seat: 0 }], hand: [{ code: FARAMIR, seat: 0 }], staging: [WALL, MOAT, BOSS], engaged: [{ code: CHEAP, seat: 0 }], allies: [{ code: "plain", seat: 0 }] });
    return attach(tab, [[idsOf(tab, "plain"), idsOf(tab, MOAT)]]);
  }
  const entered = (tab: Table, choice: string): Run => {
    const faramir = idsOf(tab, FARAMIR);
    let run = play(begin(tab.state), tab, faramir);
    expect(triggers(run.state, tab)).toContain("21005:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: faramir, effectId: "21005:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, WALL), idsOf(tab, MOAT)].sort());
    return sendUnledgered(run, { type: "Choose", optionId: choice }, tab.ctx);
  };

  // "Response: After Faramir enters play, choose a non-unique enemy in the staging area. Engage that enemy and deal 2 damage to it (4 damage
  // instead if it has an attachment on it).": the Wall and the Moat are the choices (not the unique Boss, not the engaged Cheap); the Wall
  // is engaged with the player and takes 2 damage; the Moat, with its attachment, takes 4.
  lineSpec("21005:A:1", "Faramir: engage a non-unique enemy in the staging area and deal it 2 damage, 4 with an attachment", (effects) => {
    const tab = scene(effects);
    const wall = entered(tab, idsOf(tab, WALL));
    expect(wall.state.cards[idsOf(tab, WALL)]).toMatchObject({ zone: "engaged", damage: 2 });
    expect(wall.state.seats[0]?.engaged).toContain(idsOf(tab, WALL));
    const moat = entered(tab, idsOf(tab, MOAT));
    expect(moat.state.cards[idsOf(tab, MOAT)]).toMatchObject({ zone: "engaged", damage: 4 });
  });

  // With only the unique Boss in the staging area there is no enemy to choose: not offered.
  it("21005:A:1 Faramir: not offered with no non-unique enemy in the staging area", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SAGE, seat: 0 }], hand: [{ code: FARAMIR, seat: 0 }], staging: [BOSS], engaged: [{ code: CHEAP, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, FARAMIR));
    expect(triggers(run.state, tab)).not.toContain("21005:response:1");
  });
});

describe("Put Off Pursuit (21008:A:1)", () => {
  // "Attach to the active location. Limit 1 per location. Attached location gets +2 quest points.": the active Place is the one host (not
  // the Road in the staging area, nor a hero); played on it, the Place has 3 + 2 quest points; a second copy finds no host.
  lineSpec("21008:A:1", "Put Off Pursuit: Attach to the active location, limit 1 per location, +2 quest points", (effects) => {
    const tab = table(effects, { heroes: [{ code: SAGE, seat: 0 }], active: PLACE, staging: [ROAD], hand: [{ code: PURSUIT, seat: 0 }, { code: PURSUIT, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[PURSUIT] ?? [];
    const place = idsOf(tab, PLACE);
    expect(hosts(tab, first)).toEqual([place]);
    const run = play(begin(tab.state), tab, first, place);
    expect(run.state.cards[first]?.host).toBe(place);
    expect(stat(run.state, tab, place, "questPoints")).toBe(3 + 2);
    expect(hosts(tab, second, run.state)).toEqual([]);
    expect(refusal(run.state, { type: "PlayCard", cardId: second, hostId: place, payments: [{ heroId: idsOf(tab, SAGE), amount: 1 }] }, tab.ctx)).not.toBeNull();
  });
});

describe("Sméagol (21072:A:1, A:3)", () => {
  // "Cannot have attachments.": Citadel Plate ("Attach to a hero") can go on the Tactician, not on Sméagol.
  lineSpec("21072:A:1", "Sméagol: cannot have attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: SMEAGOL, seat: 0 }, { code: TACTICIAN, seat: 0 }], hand: [{ code: PLATE, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, PLATE))).toEqual([idsOf(tab, TACTICIAN)]);
  });

  // Sméagol, the active location to leave and the Road in the staging area; a card in the deck.
  const scene = (effects: readonly Effect[], deck: number) =>
    table(effects, { start: "travel", heroes: [{ code: SMEAGOL, seat: 0 }], staging: [ROAD], playerDeck: Array.from({ length: deck }, () => ({ code: "card", seat: 0 })) });

  // "Response: After you travel to a location, raise your threat by 1 to draw 1 card.": the player travels to the Road, raises his threat
  // by 1 and draws the card. (The round then runs on to the refresh phase, whose own raise of 1 is a step of rr.step-7-3.)
  lineSpec("21072:A:3", "Sméagol: after you travel, raise your threat by 1 to draw 1 card", (effects) => {
    const tab = scene(effects, 2);
    let run = sendUnledgered(begin(tab.state), { type: "Travel", locationId: idsOf(tab, ROAD) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ROAD)]?.zone).toBe("activeLocation");
    expect(triggers(run.state, tab)).toContain("21072:response:1");
    const before = run.steps.length;
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, SMEAGOL), effectId: "21072:response:1" }, tab.ctx);
    const raised = run.steps.slice(before).flatMap((step) => (step.kind === "threat" && !("rule" in step.cause) ? [step.amount] : []));
    expect(raised).toEqual([1]);
    const drawn = run.steps.slice(before).filter((step) => step.kind === "draw" && "effect" in step.cause && step.cause.effect === "21072:response:1");
    expect(drawn).toHaveLength(1);
  });

  // With an empty deck nothing would be drawn: the Response is not offered, so no threat is raised for nothing.
  it("21072:A:3 Sméagol: not offered with an empty deck", () => {
    const tab = scene(EFFECTS, 0);
    const run = sendUnledgered(begin(tab.state), { type: "Travel", locationId: idsOf(tab, ROAD) }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("21072:response:1");
  });
});

describe("The Ring of Power (21011:A:1)", () => {
  // "Action: Exhaust The One Ring and raise your threat by 1 to ready the hero with The One Ring attached. That hero gets +1 Willpower, +1 Attack and +1 Defense until the
  // end of the phase.": Éowyn holds The One Ring and Aragorn the Ring of Barahir, both exhausted; only Éowyn is the hero with The One Ring, so only she readies and gets the bonus.
  lineSpec("21011:A:1", "The Ring of Power: ready the hero with The One Ring, not one with another Ring attachment", (effects) => {
    const scene = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: ONE_RING, host: EOWYN }, { code: BARAHIR, host: ARAGORN }], hand: [{ code: RING_OF_POWER, seat: 0 }] });
    const [eowyn, aragorn] = [idsOf(scene, EOWYN), idsOf(scene, ARAGORN)];
    const tab = { ...scene, state: updateCard(updateCard(scene.state, eowyn, { exhausted: true }), aragorn, { exhausted: true }) };
    const run = play(begin(tab.state), tab, idsOf(tab, RING_OF_POWER));
    expect(run.state.cards[eowyn]?.exhausted).toBe(false);
    expect(run.state.cards[aragorn]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, ONE_RING)]?.exhausted).toBe(true);
    expect(stat(run.state, tab, eowyn, "willpower")).toBe(printed(tab, EOWYN, "willpower") + 1);
    expect(stat(run.state, tab, aragorn, "willpower")).toBe(printed(tab, ARAGORN, "willpower"));
  });
});
