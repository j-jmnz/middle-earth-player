// Rules: dcce.scalable-upgradable, dcce.grotto-deck, dcce.encounter-cards, dcce.gaining-xp, rr.cannot, rr.engaged, rr.victory, rr.active-location, rr.then (data/rules/entries.json).
// The Drowned Ruins' own cards, each read straight from its record (ledger lines 11205:A:2 to 11208:A:3, 11200:B:7, 11200:B:8, 12092:B:3, 12096:A:1, 12097:A:1, 12097:A:2, 12100:A:1, 12104:A:1, 12104:A:2,
// 12107:A:1) on the Drowned Ruins' table (test/scenarios/the-drowned-ruins/scene.ts). The Command events are in families/deck/command.test.ts, the Grotto cards in grotto.test.ts and underwater.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { CODES, idOf, legalIntents, loadRuinsWorld, resolveRecords, ruinsTable, send, type RuinsLayout, type RuinsWorld } from "../../../../test/scenarios/the-drowned-ruins/scene.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, updateCard } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { openResolution } from "../../setup/resolution.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { offerResponses } from "../../windows/responses.ts";
import { queueEvent } from "../../windows/queue.ts";

let world: RuinsWorld;
beforeAll(async () => {
  world = await loadRuinsWorld();
  addStandIns(world.cards, ["undead"]);
});
const make = (layout: RuinsLayout = {}) => ruinsTable(world, { phase: "Quest", ...layout });

describe("Círdan's Blessing (11205 to 11208)", () => {
  // A Blessing attached to the first hero with `resources` on it, the campaign log's level of the card being `level`.
  function blessed(code: string, resources: number, layout: RuinsLayout = {}, level = 1) {
    const made = make(layout);
    const spawned = spawn({ ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels: { [code]: level } } }, code, { zone: "play", seat: 0 });
    const attached = updateCard(attachTo(spawned.state, spawned.id, made.hero), spawned.id, { resources });
    return { made, id: spawned.id, state: syncConstants(attached, made.ctx) };
  }
  const respond = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"], event: Parameters<typeof offerResponses>[1]) => settle(offerResponses({ ...state, window: null }, event, ctx, []), ctx, []);
  // Uses the effect when it is offered (null when it is not), paying its cost from the Blessing's own resources when it has one.
  const take = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"], effectId: string, pays = false) => {
    const intent = legalIntents(state, ctx).find((item) => item.type === "Trigger" && item.effectId === effectId);
    return intent?.type === "Trigger" ? send({ state, steps: [] }, pays ? { ...intent, payments: [{ heroId: intent.cardId, amount: 1 }] } : intent, ctx).state : null;
  };

  it.each(["11205", "11206", "11207", "11208"])("%s enters play with 1 more resource than its level in the Campaign Log (A:2)", (code) => {
    for (const level of [0, 2]) {
      const made = make();
      const withLevel = { ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels: { [code]: level } } };
      const spawned = spawn(withLevel, code, { zone: "play", seat: 0 });
      const done = resolveRecords(spawned.state, made.ctx, code, "triggered", spawned.id);
      expect(done.state.cards[spawned.id]?.resources, `${code} at level ${level}`).toBe(level + 1);
    }
  });

  it("11205 pays 1 resource from itself for +3 Defense to the attached hero as it is declared a defender, and is not offered with none left", () => {
    const { made, id, state } = blessed("11205", 1, { engaged: [{ code: "f0", seat: 0 }] });
    const enemy = idOf(state, "f0");
    const before = modifiedStat(state, state.cards[made.hero]!, "defense", made.ctx.cards);
    const asked = respond({ ...state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: made.hero } }, made.ctx, { trigger: "declaredDefender", seat: 0, cardId: made.hero, other: enemy });
    const done = take(asked, made.ctx, "11205:response:1", true);
    expect(done).not.toBeNull();
    expect(done!.cards[id]?.resources).toBe(0);
    expect(modifiedStat(done!, done!.cards[made.hero]!, "defense", made.ctx.cards)).toBe(before + 3);
    // Another hero declared as defender is not the attached hero; with no resource the card is not offered.
    const empty = blessed("11205", 0, { engaged: [{ code: "f0", seat: 0 }] });
    expect(take(respond(empty.state, empty.made.ctx, { trigger: "declaredDefender", seat: 0, cardId: empty.made.hero, other: idOf(empty.state, "f0") }), empty.made.ctx, "11205:response:1", true)).toBeNull();
    const other = respond(state, made.ctx, { trigger: "declaredDefender", seat: 0, cardId: made.hero2, other: enemy });
    expect(take(other, made.ctx, "11205:response:1", true)).toBeNull();
  });

  it("11206 pays 1 resource from itself for +3 Attack to the attached hero as it is declared an attacker", () => {
    const { made, id, state } = blessed("11206", 2, { staging: ["f0"] });
    const enemy = idOf(state, "f0");
    const before = modifiedStat(state, state.cards[made.hero]!, "attack", made.ctx.cards);
    const asked = respond(state, made.ctx, { trigger: "declaredAttacker", seat: 0, cardId: made.hero, other: enemy });
    const done = take(asked, made.ctx, "11206:response:1", true);
    expect(done).not.toBeNull();
    expect(done!.cards[id]?.resources).toBe(1);
    expect(modifiedStat(done!, done!.cards[made.hero]!, "attack", made.ctx.cards)).toBe(before + 3);
  });

  it("11207 exhausts and pays 1 resource for +3 Willpower to the attached hero until the end of the phase", () => {
    const { made, id, state } = blessed("11207", 1);
    const before = modifiedStat(state, state.cards[made.hero]!, "willpower", made.ctx.cards);
    const done = take(state, made.ctx, "11207:action:1", true)!;
    expect(done).not.toBeNull();
    expect(done.cards[id]).toMatchObject({ exhausted: true, resources: 0 });
    expect(modifiedStat(done, done.cards[made.hero]!, "willpower", made.ctx.cards)).toBe(before + 3);
    // Spent: no resource, no action.
    expect(take(done, made.ctx, "11207:action:1", true)).toBeNull();
  });

  it("11208 moves 1 resource to the attached hero's pool and heals 1 damage from it after the active location is explored, and only with a resource to move (rr.then)", () => {
    const { made, id, state } = blessed("11208", 2);
    const hurt = updateCard(state, made.hero, { damage: 3 });
    const done = take(respond(hurt, made.ctx, { trigger: "activeExplored", seat: null, subject: "gone", amount: 0 }), made.ctx, "11208:response:1");
    expect(done).not.toBeNull();
    expect(done!.cards[id]?.resources).toBe(1);
    expect(done!.cards[made.hero]).toMatchObject({ resources: 1, damage: 2 });
    // With no resource on the Blessing there is nothing to move, so the heal does not happen either: the Response is not offered.
    const bare = blessed("11208", 0);
    const hurtBare = updateCard(bare.state, bare.made.hero, { damage: 3 });
    expect(take(respond(hurtBare, bare.made.ctx, { trigger: "activeExplored", seat: null, subject: "gone", amount: 0 }), bare.made.ctx, "11208:response:1")).toBeNull();
    expect(hurtBare.cards[bare.made.hero]?.damage).toBe(3);
  });
});

describe("The Drowned Ruins, Resolution (11200:B:7, 11200:B:8)", () => {
  // The Resolution's XP line `effectId` read on a table whose victory display holds `victory`.
  function xp(effectId: string, victory: readonly string[], layout: RuinsLayout = {}): number {
    const made = make({ victory, ...layout });
    const record = EFFECTS.find((effect) => effect.id === effectId)!;
    const resolving: ScenarioState = { ...made.state, phase: "Quest", window: null, stageCleared: true, resolution: record.instructions };
    return openResolution(resolving, made.ctx).resolutionLog.xp ?? 0;
  }

  it("11200:B:7 gives 1 XP at 5 or more Underwater locations in the victory display, the Shrine's Underwater side and Drowned Cave counting", () => {
    expect(EFFECTS.find((effect) => effect.id === "11200:resolution:7")?.lines).toEqual(["11200:B:7"]);
    const four = ["12101", "12102", "12103", "12101"];
    expect(xp("11200:resolution:7", four)).toBe(0);
    expect(xp("11200:resolution:7", [...four, "12101"])).toBe(1);
    expect(xp("11200:resolution:7", [...four, "12095"])).toBe(1);
    expect(xp("11200:resolution:7", [...four, "12104"])).toBe(1);
    // A Grotto side, even the Shrine's, is not Underwater.
    expect(xp("11200:resolution:7", [...four, "12098"])).toBe(0);
    expect(xp("11200:resolution:7", [...four, "12094"])).toBe(0);
  });

  it("11200:B:8 gives 2 XP when Shrine to Morgoth (Grotto side) is in the victory display, and not its Underwater side", () => {
    expect(EFFECTS.find((effect) => effect.id === "11200:resolution:10")?.lines).toEqual(["11200:B:8"]);
    expect(xp("11200:resolution:10", ["12094"])).toBe(2);
    expect(xp("11200:resolution:10", ["12095"])).toBe(0);
    expect(xp("11200:resolution:10", [])).toBe(0);
    // The Resolution reads the same records the campaign card lists.
    expect(recordInstructions(EFFECTS, "11200", "resolution").length).toBeGreaterThan(0);
  });
});

describe("The Grotto, side B (12092:B:3)", () => {
  it("bars the players from advancing unless 3 Underwater locations are in the victory display", () => {
    const blocked = (victory: readonly string[]) => {
      const made = make({ victory });
      return restricted(syncConstants(made.state, made.ctx), made.ctx, "advance").length > 0;
    };
    expect(EFFECTS.find((effect) => effect.id === "12092:constant:2")?.lines).toEqual(["12092:B:3"]);
    expect(blocked([])).toBe(true);
    expect(blocked(["12101", "12102"])).toBe(true);
    expect(blocked(["12101", "12102", "12103"])).toBe(false);
    // Drowned Cave and the Shrine's Underwater side are Underwater locations too; a Grotto side is not.
    expect(blocked(["12101", "12104", "12095"])).toBe(false);
    expect(blocked(["12101", "12102", "12098"])).toBe(true);
  });
});

describe("Sea-scorpion (12096:A:1)", () => {
  it("gets +2 Attack while the active location is Underwater, and not otherwise", () => {
    const attack = (sided: RuinsLayout["sided"]) => {
      const made = make({ staging: [CODES.seaScorpion], ...(sided ? { sided } : {}) });
      return modifiedStat(made.state, made.state.cards[idOf(made.state, CODES.seaScorpion)]!, "attack", made.ctx.cards);
    };
    const printed = attack(undefined);
    expect(attack([{ code: "12101", back: "12098", zone: "activeLocation" }])).toBe(printed + 2);
    expect(attack([{ code: "12098", back: "12101", zone: "activeLocation" }])).toBe(printed);
    // An Underwater location in the staging area is not the active location.
    expect(attack([{ code: "12101", back: "12098", zone: "staging" }])).toBe(printed);
  });
});

describe("Water-logged Halls (12100:A:1)", () => {
  it("gives each Undead enemy in play -1 Threat while it is the active location, and a non-Undead enemy nothing", () => {
    const threat = (code: string, active: boolean) => {
      const made = make({ staging: [code, "f3"], ...(active ? { sided: [{ code: "12100", back: "12103", zone: "activeLocation" as const }] } : {}) });
      const stat = (target: string) => modifiedStat(made.state, made.state.cards[idOf(made.state, target)]!, "threat", made.ctx.cards);
      return { target: stat(code), other: stat("f3") };
    };
    const idle = threat("undead", false);
    const active = threat("undead", true);
    expect(active.target).toBe(idle.target - 1);
    expect(active.other).toBe(idle.other);
  });
});

describe("Cave Eel (12097:A:1, 12097:A:2)", () => {
  it("cannot be engaged unless the active location is Underwater", () => {
    const barred = (sided: RuinsLayout["sided"]) => {
      const made = make({ staging: [CODES.caveEel], ...(sided ? { sided } : {}) });
      return flagged(made.state, idOf(made.state, CODES.caveEel), "cannotBeEngaged");
    };
    expect(barred(undefined)).toBe(true);
    expect(barred([{ code: "12098", back: "12101", zone: "activeLocation" }])).toBe(true);
    expect(barred([{ code: "12101", back: "12098", zone: "activeLocation" }])).toBe(false);
  });

  it("goes back to the staging area at the beginning of the encounter phase when engaged and the active location is not Underwater", () => {
    const begins = (sided: RuinsLayout["sided"]) => {
      const made = make({ phase: "Planning", engaged: [{ code: CODES.caveEel, seat: 0 }], ...(sided ? { sided } : {}) });
      const eel = idOf(made.state, CODES.caveEel);
      const heard = settle(queueEvent({ ...made.state, window: null, phase: "Encounter" }, { trigger: "beginningOfPhase", seat: null, phase: "Encounter" }), made.ctx, []);
      return heard.cards[eel]?.zone;
    };
    expect(begins(undefined)).toBe("staging");
    expect(begins([{ code: "12101", back: "12098", zone: "activeLocation" }])).toBe("engaged");
  });
});

describe("Drowned Cave (12104:A:1, 12104:A:2)", () => {
  it("keeps Undead enemies from being engaged while it is the active location", () => {
    const barred = (active: boolean) => {
      const made = make({ staging: ["undead", "f0"], ...(active ? { active: CODES.drownedCave } : {}) });
      return [flagged(made.state, idOf(made.state, "undead"), "cannotBeEngaged"), flagged(made.state, idOf(made.state, "f0"), "cannotBeEngaged")];
    };
    expect(barred(true)).toEqual([true, false]);
    expect(barred(false)).toEqual([false, false]);
  });

  it("returns the Undead enemies engaged to the staging area when it becomes the active location", () => {
    const made = make({ phase: "Travel", staging: [CODES.drownedCave], engaged: [{ code: "undead", seat: 0 }, { code: "f0", seat: 0 }] });
    const cave = idOf(made.state, CODES.drownedCave);
    const done = resolveRecords(made.state, made.ctx, CODES.drownedCave, "triggered", cave);
    expect(done.state.cards[idOf(done.state, "undead")]?.zone).toBe("staging");
    expect(done.state.cards[idOf(done.state, "f0")]?.zone).toBe("engaged");
  });

  it("makes each player discard the top 10 cards of their deck at the end of the quest phase, then lets the first player return it to the staging area", () => {
    const cards = Array.from({ length: 12 }, (_, at) => `c${at % 4}`);
    const pick = (option: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? option : "");
    const run = (option: string) => {
      const made = make({ seats: 2, active: CODES.drownedCave, deckOf: cards });
      const cave = idOf(made.state, CODES.drownedCave);
      return resolveRecords(made.state, made.ctx, CODES.drownedCave, "forced", cave, pick(option));
    };
    const returned = run("return");
    expect(returned.state.seats.map((seat) => seat.deck.length)).toEqual([2, 2]);
    expect(returned.state.seats.map((seat) => seat.discard.length)).toEqual([10, 10]);
    expect(returned.state.cards[returned.id]?.zone).toBe("staging");
    const stayed = run("stay");
    expect(stayed.state.cards[stayed.id]?.zone).toBe("activeLocation");
    expect(stayed.state.seats.map((seat) => seat.deck.length)).toEqual([2, 2]);
  });
});

describe("Then after a discard that came up short (12104:A:2, 12103:A:2, rr.then)", () => {
  const pick = (option: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? option : "");

  it("12104:A:2 Drowned Cave is not returned to the staging area when a deck held fewer than 10 cards to discard", () => {
    const run = (cards: number) => {
      const made = make({ active: CODES.drownedCave, deckOf: Array.from({ length: cards }, (_, at) => `c${at % 4}`) });
      return resolveRecords(made.state, made.ctx, CODES.drownedCave, "forced", idOf(made.state, CODES.drownedCave), pick("return"));
    };
    expect(run(10).state.cards[run(10).id]?.zone, "10 cards: discarded in full").toBe("staging");
    const short = run(9);
    expect(short.state.seats[0]?.discard).toHaveLength(9);
    expect(short.state.cards[short.id]?.zone, "9 cards: the discard stopped short").toBe("activeLocation");
  });

  it("12103:A:2 Sunken Temple is not flipped when a hero had no resource to discard", () => {
    const run = (resources: number) => {
      const made = make({ sided: [{ code: "12103", back: "12100", zone: "activeLocation" }] });
      const state = Object.keys(made.state.cards).filter((id) => made.state.cards[id]?.zone === "heroes").reduce((current, hero) => updateCard(current, hero, { resources }), made.state);
      const done = resolveRecords(state, made.ctx, "12103", "forced", idOf(state, "12103"), pick("flip"));
      return done.state.cards[done.id]?.code;
    };
    expect(run(1), "each hero had a resource: discarded in full, flipped").toBe("12100");
    expect(run(0), "a hero had none: not in full, not flipped").toBe("12103");
  });
});

describe("Tangling and Grasping (12107:A:1)", () => {
  const reveal = (sided: RuinsLayout["sided"]) => {
    const made = make({ seats: 2, ...(sided ? { sided } : {}) });
    // Each player has a character committed to the quest.
    let state = updateCard(made.state, made.hero, { committed: true });
    state = updateCard(state, made.seat1Hero!, { committed: true });
    const done = resolveRecords(state, made.ctx, "12107", "whenRevealed");
    return { made, state: done.state };
  };

  it("removes a character each player controls from the quest, and deals it 2 damage when the active location is Underwater", () => {
    const grotto = reveal([{ code: "12098", back: "12101", zone: "activeLocation" }]);
    expect(grotto.state.cards[grotto.made.hero]).toMatchObject({ committed: false, damage: 0 });
    expect(grotto.state.cards[grotto.made.seat1Hero!]).toMatchObject({ committed: false, damage: 0 });
    const underwater = reveal([{ code: "12101", back: "12098", zone: "activeLocation" }]);
    expect(underwater.state.cards[underwater.made.hero]).toMatchObject({ committed: false, damage: 2 });
    expect(underwater.state.cards[underwater.made.seat1Hero!]).toMatchObject({ committed: false, damage: 2 });
  });
});

