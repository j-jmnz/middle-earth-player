import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { syncConstants } from "../rules/constants.ts";
import { addModifier, modifiedStat } from "../rules/keywords.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { updateCard } from "../rules/state.ts";
import { starterStart, starterWorld } from "../../scripts/starter-game.ts";
import { starterBase } from "../../scripts/starter-scene.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { buildTable, idsOf } from "../../scripts/test-scene.ts";
import { CODES, fateTable, idOf, loadFateWorld } from "../../scripts/fate-scene.ts";

import { badgeSplit, BADGE_CAP, cardEffects, effectLines } from "./card-effects.ts";

// Rules: rr.modifiers (data/rules/entries.json). The table shows on the card each printed number an effect changed, by how
// much, and each "cannot"; the preview words them with the card they come from.
let ctx: ReduceContext;
let kept: ScenarioState;

beforeAll(async () => {
  ctx = (await starterWorld("stealth-and-steadfastness")).ctx;
  kept = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
});

describe("effects on a card", () => {
  it("show nothing for a card no effect touches, and a constant effect of the card's own text", () => {
    const [, sam = "", merry = ""] = kept.seats[0].heroes;
    expect(cardEffects(kept, ctx, sam)).toEqual({ stats: [], flags: [] });
    // Merry (141003) gets +1 attack for each Hobbit hero his controller has: three, with Frodo and Sam.
    const hero = kept.cards[merry];
    expect(cardEffects(kept, ctx, merry).stats).toEqual([{ stat: "attack", icon: "attack", word: "Attack", value: hero ? modifiedStat(kept, hero, "attack", ctx.cards) : -1, delta: 3, lasting: false }]);
    expect(effectLines(kept, ctx, merry, () => "Merry")).toEqual(["+3 Attack from its own text, while it is in play"]);
  });

  it("say a bonus for each damage token as the total it comes to now (Gimli, 01004:A:1)", async () => {
    const starter = await starterBase();
    const tab = buildTable({ ...starter, cards: new Map([...starter.cards, ...(await loadPrinted(["01004"]))]) }, { ring: "none", heroes: [{ code: "01004", seat: 0 }] });
    const gimli = idsOf(tab, "01004");
    const state = syncConstants(tab.state, tab.ctx);
    expect(effectLines(state, tab.ctx, gimli, () => "Gimli")).toEqual([]);
    // The constant is counted each time the constants are rebuilt (after each intent).
    const hurt = syncConstants(updateCard(state, gimli, { damage: 3 }), tab.ctx);
    expect(effectLines(hurt, tab.ctx, gimli, () => "Gimli")).toEqual(["+3 Attack from its own text, while it is in play"]);
  });

  it("show each changed number with the engine's value and the change, and each cannot", () => {
    const [frodo = "", sam = ""] = kept.seats[0].heroes;
    let state = addModifier(kept, sam, frodo, "attack", 2, "endOfPhase");
    state = addModifier(state, sam, frodo, "willpower", -1, "endOfRound");
    state = addModifier(state, sam, frodo, "cannotAttack", 1, "endOfPhase");
    const hero = state.cards[sam];
    const effects = cardEffects(state, ctx, sam);
    expect(effects.stats.map((badge) => [badge.stat, badge.delta])).toEqual([
      ["willpower", -1],
      ["attack", 2],
    ]);
    expect(effects.stats.find((badge) => badge.stat === "attack")?.value).toBe(hero ? modifiedStat(state, hero, "attack", ctx.cards) : -1);
    expect(effects.flags.map((flag) => flag.word)).toEqual(["Cannot attack"]);
    expect(effectLines(state, ctx, sam, () => "Frodo Baggins")).toEqual([
      "+2 Attack from Frodo Baggins, until the end of the phase",
      "-1 Willpower from Frodo Baggins, until the end of the round",
      "Cannot attack: Frodo Baggins, until the end of the phase",
    ]);
  });
});

describe("a defender's defense", () => {
  it("counts a bonus that holds only while defending, before the defender is declared (Hobbit Cloak 141013)", async () => {
    const { defenseAsDefender } = await import("../rules/keywords.ts");
    const { moveCard } = await import("../rules/zones.ts");
    const { readoutFor } = await import("./readout.ts");
    const [, sam = ""] = kept.seats[0].heroes;
    // An engaged enemy whose engagement cost is above the seat's threat attacks, and Sam holds Hobbit Cloak's +2.
    const enemyId = kept.encounterDeck.find((id) => {
      const card = kept.cards[id];
      const printed = card ? ctx.cards.get(card.code) : undefined;
      return printed?.type === "enemy" && (printed.engagementCost ?? 0) > kept.seats[0].threat;
    });
    expect(enemyId).toBeDefined();
    if (!enemyId) return;
    let state = moveCard(kept, enemyId, { zone: "engaged", seat: 0 });
    state = { ...state, pendingAttack: { enemyId, seat: 0 }, modifiers: [...state.modifiers, { instanceId: sam, sourceId: sam, stat: "defense", amount: 2, until: "endOfRound", when: { kind: "versusHighEngagement", role: "defending" } }] };
    const hero = state.cards[sam];
    const base = hero ? modifiedStat(state, hero, "defense", ctx.cards) : -1;
    expect(defenseAsDefender(state, sam, ctx.cards)).toBe(base + 2);
    const sheet = { kind: "pick" as const, key: "defense", step: "Combat", title: "", note: null, verb: "Defend with", options: [{ id: sam, label: "Sam", code: null, intent: { type: "DeclareDefender" as const, defenderId: sam } }], primary: null, alternative: null };
    const readout = readoutFor(state, ctx, sheet, { key: "defense", ids: [sam], shares: [] }, (id) => id);
    expect(readout?.stats.find((stat) => stat.word === "Defense")?.value).toBe(base + 2);
    // Leave undefended, then a hero: all of the attack on that hero, no defense taken off.
    const hit = { ...sheet, key: "undefended", options: [{ id: sam, label: "Sam", code: null, intent: { type: "Undefended" as const, heroId: sam } }] };
    const undefended = readoutFor(state, ctx, hit, { key: "undefended", ids: [sam], shares: [] }, (id) => id);
    expect(undefended?.stats.map((stat) => stat.word)).toEqual(["Attack"]);
    expect(undefended?.result).toContain(`damage on ${sam}`);
  });
});

describe("the pills down a card's edge", () => {
  it("draws two pills and +n for the rest, and every pill when there are two or fewer", () => {
    expect(BADGE_CAP).toBe(2);
    expect(badgeSplit(0, 5)).toEqual({ shown: 0, hidden: 0 });
    expect(badgeSplit(1, 5)).toEqual({ shown: 1, hidden: 0 });
    expect(badgeSplit(2, 5)).toEqual({ shown: 2, hidden: 0 });
    expect(badgeSplit(3, 5)).toEqual({ shown: 2, hidden: 1 });
    expect(badgeSplit(6, 5)).toEqual({ shown: 2, hidden: 4 });
  });

  it("leaves a row for +n where the card's edge has little room", () => {
    expect(badgeSplit(3, 2)).toEqual({ shown: 1, hidden: 2 });
    expect(badgeSplit(2, 1)).toEqual({ shown: 0, hidden: 2 });
    expect(badgeSplit(1, 1)).toEqual({ shown: 1, hidden: 0 });
    expect(badgeSplit(4, 0)).toEqual({ shown: 0, hidden: 4 });
  });
});

describe("a Lost Island and Revenant", () => {
  it("a Lost Island shows no delta against the real side's numbers, and the real side shows its own", async () => {
    const world = await loadFateWorld();
    const hidden = fateTable(world, { staging: [{ code: CODES.lushJungle, face: "B" }, { code: CODES.forbiddenCoast, face: "up" }] });
    const state = syncConstants(hidden.state, hidden.ctx);
    expect(cardEffects(state, hidden.ctx, idOf(state, CODES.lushJungle)).stats).toEqual([]);
    expect(cardEffects(state, hidden.ctx, idOf(state, CODES.forbiddenCoast)).stats).toEqual([]);
  });

  it("says Revenant takes at most 2 damage at a time", async () => {
    const world = await loadFateWorld();
    const made = fateTable(world, { staging: [CODES.revenant] });
    // Its Forced effect sets the limit as it joins the staging area (11181:A:3).
    const id = idOf(made.state, CODES.revenant);
    const state = addModifier(syncConstants(made.state, made.ctx), id, id, "damageLimit", 2, "whileSourceInPlay");
    expect(cardEffects(state, made.ctx, id).flags.map((flag) => flag.word)).toEqual(["Takes at most 2 damage at a time"]);
    expect(effectLines(state, made.ctx, id, () => "Revenant")).toEqual(["Takes at most 2 damage at a time: its own text, while it is in play"]);
  });
});
