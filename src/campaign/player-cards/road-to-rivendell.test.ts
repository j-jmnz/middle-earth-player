// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.lasting-effects, rr.response, rr.action, rr.forced, rr.ready, rr.cost,
// rr.the-letter-x, rr.staging-area, rr.threat-threat-dial, rr.refresh-phase, rr.enters-play, rr.drawing-cards, rr.triggered-ability
// (data/rules/entries.json).
// The Road to Rivendell player cards, written from their card text (data/cards/RtR.json; data/printed holds no ledger for these cards yet,
// so every intent goes through sendUnledgered): Elladan 04028:A:1 and A:2, Lure of Moria 04030:A:1, Rivendell Blade 04031:A:1 and A:2,
// Hail of Stones 04032:A:1, Song of Eärendil 04034:A:1, A:2 and A:3, Bombur 04035:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, enter, fillers, hosts, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ELROHIR = "04001";
const ELLADAN = "04028";
const LURE = "04030";
const BLADE = "04031";
const HAIL = "04032";
const SONG = "04034";
const BOMBUR = "04035";
// Lórien Guide: a Silvan ally.
const GUIDE = "01044";
// A Dwarf hero and a Dwarf ally with no text, a Spirit hero and a Spirit ally, a Lore hero. The Pal is a Leadership Hobbit hero
// (test/harness/scene.ts); the Ally a Leadership ally with no Trait.
const DWARF_HERO = "dwarf-hero";
const DWARF = "dwarf";
const SPIRIT = "spirit-hero";
const SPIRIT_ALLY = "spirit-ally";
const SAGE = "sage";
const PAL = "pal";
const ALLY = "ally";
// An enemy no attack of these tests damages through its Defense, and one that is easy to wound.
const WALL = "wall";
const TARGET = "target";
// A location of 2 threat, and an Underground location of 2 threat.
const FIELD = "field";
const DEEP = "deep";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ELROHIR, ELLADAN, LURE, BLADE, HAIL, SONG, BOMBUR, GUIDE]))]);
  cards.set(DWARF_HERO, definePrinted({ code: DWARF_HERO, name: "Dwarf Lord", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Dwarf"] }));
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 9, willpower: 2, attack: 1, defense: 2, health: 6 }));
  cards.set(SPIRIT_ALLY, definePrinted({ code: SPIRIT_ALLY, name: "Spirit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 3, health: 9 }));
  cards.set(TARGET, definePrinted({ code: TARGET, name: "Target", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(FIELD, definePrinted({ code: FIELD, name: "Field", type: "location", threat: 2, questPoints: 5 }));
  cards.set(DEEP, definePrinted({ code: DEEP, name: "Deep", type: "location", threat: 2, questPoints: 5, traits: ["Underground"] }));
  base = { ...starter, cards };
});

const exhaust = (state: Table["state"], ids: readonly string[]) => ids.reduce((next, id) => updateCard(next, id, { exhausted: true }), state);

describe("Elladan (04028:A:1, A:2)", () => {
  // "While Elrohir is in play, Elladan gets +2 Attack.": the other player's Elrohir is in play, so Elladan has 1 + 2.
  lineSpec("04028:A:1", "Elladan: +2 Attack while Elrohir is in play", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ELLADAN, seat: 0 }, { code: ELROHIR, seat: 1 }] });
    expect(stat(tab.state, tab, idsOf(tab, ELLADAN), "attack")).toBe(printed(tab, ELLADAN, "attack") + 2);
  });

  it("04028:A:1 Elladan: his printed Attack without Elrohir", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }] });
    expect(stat(tab.state, tab, idsOf(tab, ELLADAN), "attack")).toBe(printed(tab, ELLADAN, "attack"));
  });

  // "Response: After Elladan is declared as an attacker, pay 1 resource from his resource pool to ready him.": he attacks, pays 1 of his
  // 6 resources and is ready.
  lineSpec("04028:A:2", "Elladan: after he is declared as an attacker, pay 1 resource from his pool to ready him", (effects) => {
    const tab = table(effects, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const elladan = idsOf(tab, ELLADAN);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [elladan] }, tab.ctx);
    expect(run.state.cards[elladan]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).toContain("04028:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: elladan, effectId: "04028:response:1", payments: [{ heroId: elladan, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[elladan]?.exhausted).toBe(false);
    expect(run.state.cards[elladan]?.resources).toBe(6 - 1);
    expect(run.state.cards[idsOf(tab, PAL)]?.resources).toBe(6);
  });

  // "After Elladan is declared": the Pal attacks alone.
  it("04028:A:2 Elladan: not offered when another character is declared as an attacker", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, PAL)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, PAL)]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("04028:response:1");
  });

  // "pay 1 resource from his resource pool": with an empty pool the cost cannot be paid.
  it("04028:A:2 Elladan: not offered with no resource in his pool", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const state = updateCard(tab.state, idsOf(tab, ELLADAN), { resources: 0 });
    const run = sendUnledgered(begin(attacking(state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, ELLADAN)] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("04028:response:1");
  });
});

describe("Lure of Moria (04030:A:1)", () => {
  // The Pal pays; the Dwarf hero of each player, a Dwarf ally and the Ally (not a Dwarf) are exhausted.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }, { code: DWARF_HERO, seat: 1 }], allies: [{ code: DWARF, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: LURE, seat: 0 }] });
    return { ...tab, state: exhaust(tab.state, [...(tab.ids[DWARF_HERO] ?? []), idsOf(tab, DWARF), idsOf(tab, ALLY)]) };
  }

  // "Action: Ready all Dwarf characters.": both Dwarf heroes (the other player's too) and the Dwarf ally ready; the Ally stays exhausted.
  lineSpec("04030:A:1", "Lure of Moria: ready all Dwarf characters", (effects) => {
    const tab = scene(effects);
    const run = play(begin(tab.state), tab, idsOf(tab, LURE));
    for (const id of [...(tab.ids[DWARF_HERO] ?? []), idsOf(tab, DWARF)]) expect(run.state.cards[id]?.exhausted).toBe(false);
    expect(tab.ids[DWARF_HERO]).toHaveLength(2);
    expect(run.state.cards[idsOf(tab, ALLY)]?.exhausted).toBe(true);
  });

  // Every Dwarf character is ready: the event can change nothing, so it is not offered (rr.triggered-ability).
  it("04030:A:1 Lure of Moria: not offered when every Dwarf character is ready", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }, { code: DWARF_HERO, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: LURE, seat: 0 }] });
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, LURE))).toBe(false);
  });
});

describe("Rivendell Blade (04031:A:1, A:2)", () => {
  // "Attach to a Noldor or Silvan character. Restricted.": Elladan (Noldor) and the Lórien Guide (Silvan) are offered; the Pal and the Ally are not.
  lineSpec("04031:A:1", "Rivendell Blade: Attach to a Noldor or Silvan character", (effects) => {
    const tab = table(effects, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: BLADE, seat: 0 }] });
    const blade = idsOf(tab, BLADE);
    expect(hosts(tab, blade)).toEqual([idsOf(tab, ELLADAN), idsOf(tab, GUIDE)].sort());
    expect(play(begin(tab.state), tab, blade, idsOf(tab, GUIDE)).state.cards[blade]?.host).toBe(idsOf(tab, GUIDE));
  });

  // Elladan holds the Blade and the Pal is ready to attack; the Wall is engaged.
  function armed(effects: readonly Effect[]): Table {
    const tab = table(effects, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: BLADE, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    return { ...tab, state: play(begin(tab.state), tab, idsOf(tab, BLADE), idsOf(tab, ELLADAN)).state };
  }

  // "When attached character attacks an enemy, that enemy gets -2 Defense until the end of the phase.": Elladan attacks the Wall (Defense 3),
  // which has Defense 1 for the rest of the combat phase and 3 again in the refresh phase.
  lineSpec("04031:A:2", "Rivendell Blade: the enemy the attached character attacks gets -2 Defense until the end of the phase", (effects) => {
    const tab = armed(effects);
    const wall = idsOf(tab, WALL);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, ELLADAN)] }, tab.ctx);
    expect(stat(run.state, tab, wall, "defense")).toBe(printed(tab, WALL, "defense") - 2);
    expect(stat(withMode(run.state, "refresh"), tab, wall, "defense")).toBe(printed(tab, WALL, "defense"));
  });

  it("04031:A:2 Rivendell Blade: no change when another character attacks", () => {
    const tab = armed(EFFECTS);
    const wall = idsOf(tab, WALL);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, PAL)] }, tab.ctx);
    expect(stat(run.state, tab, wall, "defense")).toBe(printed(tab, WALL, "defense"));
  });
});

describe("Hail of Stones (04032:A:1)", () => {
  // Elladan (Tactics) pays; the Pal and the Ally are the other characters of the first seat; the Target is in the staging area, the Wall engaged.
  function scene(effects: readonly Effect[], staging: readonly string[] = [TARGET]): Table {
    return table(effects, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: HAIL, seat: 0 }], staging, engaged: [{ code: WALL, seat: 0 }] });
  }

  // "Action: Exhaust X characters to deal X damage to an enemy in the staging area.": X is 2; the Pal and the Ally exhaust, Elladan does not,
  // the engaged Wall is not a target, and the Target takes 2 damage.
  lineSpec("04032:A:1", "Hail of Stones: exhaust X characters to deal X damage to an enemy in the staging area", (effects) => {
    const tab = scene(effects);
    const [pal, ally, target] = [idsOf(tab, PAL), idsOf(tab, ALLY), idsOf(tab, TARGET)];
    let run = play(begin(tab.state), tab, idsOf(tab, HAIL));
    expect(run.state.window?.kind).toBe("choose");
    // X runs from 1 to the 3 ready characters.
    expect(choices(run.state, tab)).toEqual(["x1", "x2", "x3"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "x2" }, tab.ctx);
    for (const id of [pal, ally]) {
      expect(choices(run.state, tab)).toContain(id);
      run = sendUnledgered(run, { type: "Choose", optionId: id }, tab.ctx);
    }
    // The Target is the only enemy in the staging area: it is taken without a question.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[target]?.damage).toBe(2);
    expect(run.state.cards[idsOf(tab, WALL)]?.damage ?? 0).toBe(0);
    expect([run.state.cards[pal]?.exhausted, run.state.cards[ally]?.exhausted, run.state.cards[idsOf(tab, ELLADAN)]?.exhausted]).toEqual([true, true, false]);
  });

  // With no enemy in the staging area there is no target.
  it("04032:A:1 Hail of Stones: not offered with no enemy in the staging area", () => {
    const tab = scene(EFFECTS, []);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, HAIL))).toBe(false);
  });
});

describe("Song of Eärendil (04034:A:1, A:2, A:3)", () => {
  // "Attach to a Spirit hero.": the Spirit hero is offered; the Pal (Leadership) and the Spirit ally are not.
  lineSpec("04034:A:1", "Song of Eärendil: Attach to a Spirit hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: SPIRIT_ALLY, seat: 0 }], hand: [{ code: SONG, seat: 0 }] });
    const song = idsOf(tab, SONG);
    expect(hosts(tab, song)).toEqual([idsOf(tab, SPIRIT)]);
    expect(play(begin(tab.state), tab, song, idsOf(tab, SPIRIT)).state.cards[song]?.host).toBe(idsOf(tab, SPIRIT));
  });

  // "Response: After Song of Eärendil enters play, draw 1 card.": played on the Spirit hero; the hand gains 1 card and the deck loses 1.
  lineSpec("04034:A:2", "Song of Eärendil: after it enters play, draw 1 card", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], hand: [{ code: SONG, seat: 0 }], playerDeck: fillers("card", 3) });
    const song = idsOf(tab, SONG);
    let run = play(begin(tab.state), tab, song, idsOf(tab, SPIRIT));
    const hand = run.state.seats[0]?.hand.length ?? 0;
    expect(triggers(run.state, tab)).toContain("04034:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: song, effectId: "04034:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(hand + 1);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // An empty deck: drawing changes nothing, so the Response is not offered (rr.triggered-ability).
  it("04034:A:2 Song of Eärendil: not offered with an empty deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SPIRIT, seat: 0 }], hand: [{ code: SONG, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, SONG), idsOf(tab, SPIRIT));
    expect(run.state.seats[0]?.deck).toHaveLength(0);
    expect(triggers(run.state, tab)).not.toContain("04034:response:1");
  });

  // The Song on the first player's Spirit hero; the refresh phase raises each player's threat by 1 (8 to 9, 6 to 7).
  function refreshed(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { seats: 2, heroes: [{ code: SPIRIT, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: SONG, host: SPIRIT }] });
    return { tab, run: enter(tab.state, tab, "refresh") };
  }

  // "Response: After another player raises his threat, raise your threat by 1 to reduce that player's threat by 1.": the second player's
  // threat goes 6, 7, 6 and the first player's 8, 9, 10.
  lineSpec("04034:A:3", "Song of Eärendil: after another player raises his threat, raise yours by 1 to reduce his by 1", (effects) => {
    const { tab, run: raised } = refreshed(effects);
    expect(raised.state.seats.map((seat) => seat.threat)).toEqual([9, 7]);
    expect(triggers(raised.state, tab)).toContain("04034:response:2");
    const run = sendUnledgered(raised, { type: "Trigger", cardId: idsOf(tab, SONG), effectId: "04034:response:2" }, tab.ctx);
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([10, 6]);
  });

  // "another player": in a one-player game the first player's own raise offers nothing.
  it("04034:A:3 Song of Eärendil: not offered after its own player raises his threat", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SPIRIT, seat: 0 }], attached: [{ code: SONG, host: SPIRIT }] });
    const run = enter(tab.state, tab, "refresh");
    expect(run.state.seats[0]?.threat).toBe(9);
    expect(triggers(run.state, tab)).not.toContain("04034:response:2");
  });
});

describe("Bombur (04035:A:1)", () => {
  // The Sage and Bombur, `location` in the staging area and the other location active: Bombur is asked which to choose.
  function scene(effects: readonly Effect[], location: string): Table {
    return table(effects, { heroes: [{ code: SAGE, seat: 0 }], allies: [{ code: BOMBUR, seat: 0 }], staging: [location], active: location === FIELD ? DEEP : FIELD });
  }
  const chosen = (tab: Table, location: string): Run => {
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, BOMBUR), effectId: "04035:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, FIELD), idsOf(tab, DEEP)].sort());
    return sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, location) }, tab.ctx);
  };

  // "Action: Exhaust Bombur to choose a location. That location gets -1 Threat until the end of the phase.": the Field (2 threat) has 1,
  // and the staging area's threat falls by 1; in the next phase it is 2 again.
  lineSpec("04035:A:1", "Bombur: exhaust him to give a location -1 Threat until the end of the phase", (effects) => {
    const tab = scene(effects, FIELD);
    const [bombur, field] = [idsOf(tab, BOMBUR), idsOf(tab, FIELD)];
    const before = stagingThreat(tab.state, tab.ctx.cards);
    const run = chosen(tab, FIELD);
    expect(run.state.cards[bombur]?.exhausted).toBe(true);
    expect(stat(run.state, tab, field, "threat")).toBe(2 - 1);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(before - 1);
    expect(stat(withMode(run.state, "questCommit"), tab, field, "threat")).toBe(2);
  });

  // "(That location does not contribute its Threat instead if it is an Underground location.)": the Deep adds nothing to the staging threat.
  lineSpec("04035:A:1", "Bombur: an Underground location does not contribute its Threat instead", (effects) => {
    const tab = scene(effects, DEEP);
    const before = stagingThreat(tab.state, tab.ctx.cards);
    const run = chosen(tab, DEEP);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(before - 2);
    expect(stagingThreat(withMode(run.state, "questCommit"), tab.ctx.cards)).toBe(before);
  });
});
