// Rules: mec112.pursuit, rr.reveal, rr.staging, rr.step-3-3, rr.travel, rr.explored, rr.active-location, rr.damage, rr.destroy, rr.engaged, rr.modifiers, rr.cancel, rr.step-6-4-1, rr.shadow-effects (data/rules/entries.json); ledger lines
// 143025:A:2 to 143067:A:2. The encounter cards of The Uruk-hai on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted } from "../../../rules/core/printed.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { placeProgress } from "../../../rules/interpret/effect-verbs.ts";
import { questRoom } from "../../../rules/families/caves/progress.ts";
import { engageWith, stagingThreat } from "../../../rules/quest/quest.ts";
import { CODES, haiFight, haiTable, idOf, legalIntents, loadHaiWorld, resolveRecords, send, start, type HaiWorld, type PlayerIntent } from "../../../../test/scenarios/the-uruk-hai/scene.ts";

let world: HaiWorld;
beforeAll(async () => {
  world = await loadHaiWorld();
  world.cards.set("att", definePrinted({ code: "att", name: "att", type: "attachment", sphere: "neutral", cost: 0 }));
}, 120_000);

// A choice answered by the option with this id, or the first.
const taking = (id: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes(id) ? id : (state.window.options[0] ?? "")) : "");
const codes = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");
// The zone of the enemy that attacked: the f0 that was in play (the encounter deck holds others).
const attackerZone = (state: ScenarioState): string | undefined => Object.values(state.cards).find((card) => card.code === "f0" && (card.zone === "staging" || card.zone === "engaged"))?.zone;
const reveal = (t: ReturnType<typeof haiTable>, code: string, pick?: (state: ScenarioState) => string) => resolveRecords(t.state, t.ctx, code, "whenRevealed", undefined, pick);

describe("143025 Uglúk's Uruk-hai", () => {
  it("143025:A:2 When Revealed: either the pursuit value rises by 3 or one more encounter card is revealed", () => {
    const t = haiTable(world, { pursuit: 10, deck: ["f3", "f0"] });
    expect(reveal(t, CODES.uglukSUrukHai, taking("pursuit")).state.pursuit).toBe(13);
    const more = reveal(t, CODES.uglukSUrukHai, taking("reveal"));
    expect(more.state.pursuit).toBe(10);
    expect(codes(more.state, more.state.staging)).toContain("f3");
  });
});

describe("143026 The Wold and 143027 Eastemnet", () => {
  it("143026:A:2 and 143027:A:2 Travel: the pursuit value rises by 1", () => {
    for (const code of [CODES.theWold, CODES.eastemnet]) {
      const t = haiTable(world, { phase: "Travel", pursuit: 10, staging: [code] });
      const run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx);
      expect(run.state.activeLocation).toBe(idOf(t.state, code));
      expect(run.state.pursuit).toBe(11);
    }
  });

  it("143026:A:1 after The Wold is explored each player may draw 1 card", () => {
    const t = haiTable(world, { seats: 2, deckOf: ["f0", "f0"], staging: [CODES.theWold] });
    const run = resolveRecords(t.state, t.ctx, CODES.theWold, "response", idOf(t.state, CODES.theWold));
    expect(run.state.seats[0].hand).toHaveLength(1);
    expect(run.state.seats[1].hand).toHaveLength(1);
  });

  it("143027:A:1 the active Eastemnet, once explored, offers its Response: 1 resource to each hero's pool, Captives included", () => {
    const t = haiTable(world, { seats: 2, captives: ["hero2"], phase: "Travel", staging: [CODES.eastemnet], stage: CODES.stage1 });
    const eastemnet = idOf(t.state, CODES.eastemnet);
    const traveled = send(start(t.state), { type: "Travel", locationId: eastemnet }, t.ctx).state;
    const points = modifiedStat(traveled, traveled.cards[eastemnet]!, "questPoints", world.cards);
    const steps: Parameters<typeof placeProgress>[4] = [];
    const explored = settle({ ...placeProgress(traveled, eastemnet, points, t.ctx, steps), window: null, mode: "stopped" }, t.ctx, steps);
    const offered = legalIntents(explored, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "143027:response:1");
    expect(offered).toBeDefined();
    const run = send({ state: explored, steps }, offered as PlayerIntent, t.ctx);
    // The round has moved on (the resource phase gave each hero it controls 1 resource; a Captive collects none): each hero's pool is 1 higher than before the Response.
    for (const id of [t.hero, t.hero2, t.seat1Hero ?? ""]) expect(run.state.cards[id]?.resources).toBeGreaterThanOrEqual((explored.cards[id]?.resources ?? 0) + 1);
    expect(run.state.cards[t.hero2]?.resources).toBe(1);
  });
});

describe("143028 Plains of Rohan and 143032 Unseen Barrier shadow", () => {
  it("143028:A:1 its Threat is the number of locations in the staging area", () => {
    const one = haiTable(world, { staging: [CODES.plainsOfRohan] });
    expect(modifiedStat(one.state, one.state.cards[idOf(one.state, CODES.plainsOfRohan)]!, "threat", world.cards)).toBe(1);
    const three = haiTable(world, { staging: [CODES.plainsOfRohan, CODES.theWold, CODES.banksOfEntwash] });
    expect(modifiedStat(three.state, three.state.cards[idOf(three.state, CODES.plainsOfRohan)]!, "threat", world.cards)).toBe(3);
  });

  for (const shadow of [CODES.plainsOfRohan, CODES.unseenBarrier] as const) {
    it(`${shadow}:A:2 Shadow: the attacker gets +1 Attack, and if the attack destroys a character the pursuit value rises by 1`, () => {
      const hurt = haiFight(world, shadow, "f0", { pursuit: 10 }, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
      expect(hurt.run.state.cards[hurt.made.hero]?.zone).toBe("discard");
      expect(hurt.run.state.pursuit).toBe(11);
      // Not destroyed: no rise; the attacker's 1 Attack is 2 here (the hero took 2).
      const fine = haiFight(world, shadow, "f0", { pursuit: 10 }, { undefended: true });
      expect(fine.run.state.cards[fine.made.hero]?.damage).toBe(2);
      expect(fine.run.state.pursuit).toBe(10);
    });
  }
});

describe("143029 Banks of Entwash", () => {
  it("143029:A:1 after progress is placed on it the pursuit value rises by 1", () => {
    const t = haiTable(world, { pursuit: 10, staging: [CODES.banksOfEntwash] });
    const banks = idOf(t.state, CODES.banksOfEntwash);
    const steps: Parameters<typeof placeProgress>[4] = [];
    const settled = settle({ ...placeProgress(t.state, banks, 1, t.ctx, steps), window: null }, t.ctx, steps);
    expect(settled.pursuit).toBe(11);
  });

  it("143029:A:2 Shadow: either the pursuit value rises by 1 or the attack is considered undefended", () => {
    const rise = haiFight(world, CODES.banksOfEntwash, "f0", { pursuit: 10 }, { pick: taking("pursuit") });
    expect(rise.run.state.pursuit).toBe(11);
    expect(rise.run.state.cards[rise.made.hero]?.damage).toBe(0);
    const undefended = haiFight(world, CODES.banksOfEntwash, "f0", { pursuit: 10 }, { pick: taking("undefended") });
    expect(undefended.run.state.pursuit).toBe(10);
    // The attack was defended by the first hero, but it is considered undefended: the hero took the whole 1 Attack.
    expect(undefended.run.state.cards[undefended.made.hero]?.damage).toBe(1);
  });
});

describe("143030 Rest by Night?", () => {
  it("143030:A:1 When Revealed: either the quest phase ends at once and the pursuit value rises by 3, or each committed character takes 1 damage", () => {
    const t = haiTable(world, { pursuit: 10 });
    const committed = { ...t.state, mode: "staging" as const, ...{ cards: { ...t.state.cards, [t.hero]: { ...t.state.cards[t.hero]!, committed: true } } } };
    const ended = resolveRecords(committed, t.ctx, CODES.restByNight, "whenRevealed", undefined, taking("end"), false);
    expect(ended.state.pursuit).toBe(13);
    // The quest phase ended at once: the committed characters were sent home, and the round went on past the staging step.
    expect(ended.state.cards[t.hero]?.committed).toBe(false);
    expect(ended.state.mode).not.toBe("staging");
    const damaged = resolveRecords({ ...committed, mode: "stopped" }, t.ctx, CODES.restByNight, "whenRevealed", undefined, taking("damage"));
    expect(damaged.state.pursuit).toBe(10);
    expect(damaged.state.cards[t.hero]?.damage).toBe(1);
    expect(damaged.state.cards[t.hero2]?.damage).toBe(0);
  });

  it("143030:A:1 the effect cannot be canceled", () => {
    const record = world.definition && haiTable(world).ctx.effects.find((effect) => effect.id === "143030:whenRevealed:1");
    expect(record?.uncancelable).toBeDefined();
  });
});

describe("143031 Strange Weariness and 143032 Unseen Barrier", () => {
  it("143031:A:1 each character committed when it resolves gets -1 Willpower until the end of the round, even after the quest phase (user ruling, 2026-11-08)", () => {
    const t = haiTable(world);
    const committed = updateCard(t.state, t.hero, { committed: true });
    const run = resolveRecords(committed, t.ctx, CODES.strangeWeariness, "whenRevealed");
    const willpower = (state: ScenarioState, id: string) => modifiedStat(state, state.cards[id]!, "willpower", world.cards);
    expect(willpower(run.state, t.hero)).toBe(1);
    expect(willpower(run.state, t.hero2)).toBe(2);
    // The quest phase is over: the hero is no longer committed and keeps the penalty; a character that commits later does not get it.
    const after = settle({ ...updateCard(updateCard(run.state, t.hero, { committed: false }), t.hero2, { committed: true }), window: null }, t.ctx, []);
    expect(willpower(after, t.hero)).toBe(1);
    expect(willpower(after, t.hero2)).toBe(2);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "willpower" && modifier.until === "endOfRound" && modifier.instanceId === t.hero)).toBe(true);
  });

  it("143031:A:2 Shadow: the attacking enemy makes an additional attack against you after this one", () => {
    // The enemy's attack (1 Attack, defended by the hero's 2 Defense) is followed by a second one, which is dealt no shadow card.
    const fight = haiFight(world, CODES.strangeWeariness, "f0", {}, { undefended: true });
    expect(fight.run.steps.filter((step) => step.kind === "attack" && step.side === "enemy")).toHaveLength(2);
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(2);
  });

  it("143032:A:1 When Revealed: no more than 3 progress can be placed on the current quest this round", () => {
    const t = haiTable(world);
    expect(questRoom(t.state)).toBe(Number.MAX_SAFE_INTEGER);
    const run = resolveRecords(t.state, t.ctx, CODES.unseenBarrier, "whenRevealed");
    expect(questRoom(run.state)).toBe(3);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "questProgressCap" && modifier.until === "endOfRound" && modifier.amount === 3)).toBe(true);
  });
});

describe("143063 Isengard Uruk and 143064 Uruk-hai Fighter", () => {
  it("143063:A:2 When Revealed: either 3 damage is assigned among the characters you control, or one more encounter card is revealed", () => {
    const t = haiTable(world, { deck: ["f3"] });
    const answers = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes("damage") ? "damage" : (state.window.options[0] ?? "")) : "");
    const damaged = reveal(t, CODES.isengardUruk, answers);
    const total = [t.hero, t.hero2].reduce((sum, id) => sum + (damaged.state.cards[id]?.damage ?? 0), 0);
    expect(total).toBe(3);
    const more = reveal(t, CODES.isengardUruk, taking("reveal"));
    expect(codes(more.state, more.state.staging)).toContain("f3");
    expect([t.hero, t.hero2].reduce((sum, id) => sum + (more.state.cards[id]?.damage ?? 0), 0)).toBe(0);
  });

  it("143064:A:2 Forced: after it attacks and destroys a character it returns to the staging area", () => {
    const fight = haiFight(world, "f0", CODES.urukHaiFighter, {}, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    const fighter = idOf(fight.run.state, CODES.urukHaiFighter);
    expect(fight.run.state.cards[fight.made.hero]?.zone).toBe("discard");
    expect(fight.run.state.cards[fighter]?.zone).toBe("staging");
    const unharmed = haiFight(world, "f0", CODES.urukHaiFighter, {}, { undefended: true });
    expect(unharmed.run.state.cards[idOf(unharmed.run.state, CODES.urukHaiFighter)]?.zone).toBe("engaged");
  });

  it("143064:A:3 Shadow: its target discards a non-objective attachment they control", () => {
    const fight = haiFight(world, CODES.urukHaiFighter, "f0", {}, {
      tweak: (state, made) => {
        const placed = spawn(state, "att", { zone: "play", seat: 0 });
        return attachTo(placed.state, placed.id, made.hero);
      },
    });
    expect(fight.run.state.cards[idOf(fight.run.state, "att")]?.zone).toBe("discard");
  });
});

describe("143065 Fighting Uruk-hai, 143066 Snaga and 143067 Saruman's Orders", () => {
  it("143065:A:2 When Revealed: an Uruk-hai enemy is found, revealed and put into play engaged with you; until the end of the round each enemy engaged with you adds its Threat to the staging area's", () => {
    const t = haiTable(world, { deck: ["f0", CODES.urukHaiFighter, "f3"], discard: [] });
    const before = stagingThreat(t.state, world.cards);
    const run = reveal(t, CODES.fightingUrukHai);
    const fighter = idOf(run.state, CODES.urukHaiFighter);
    expect(run.state.cards[fighter]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(run.state.seats[0].engaged).toContain(fighter);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code).sort()).toEqual(["f0", "f3"]);
    // The Fighter's Threat 3 counts, and so does an enemy that engages the player later this round.
    expect(stagingThreat(run.state, world.cards) - before).toBe(3);
    const f3 = spawn(run.state, "f3", { zone: "staging" });
    const engaged = engageWith(f3.state, 0, f3.id, []);
    expect(stagingThreat(engaged, world.cards) - before).toBe(6);
    // Another seat's engaged enemies do not count.
    const other = haiTable(world, { seats: 2, deck: [CODES.urukHaiFighter] });
    const done = reveal(other, CODES.fightingUrukHai);
    const stray = spawn(done.state, "f3", { zone: "staging" });
    expect(stagingThreat(engageWith(stray.state, 1, stray.id, []), world.cards)).toBe(3);
  });

  it("143066:A:2 When Revealed: a random card of your hand is discarded and Snaga gets +X Threat until the end of the round, X being its printed cost", () => {
    const t = haiTable(world, { hand: ["c2"] });
    const run = reveal(t, CODES.snaga);
    const snaga = run.state.cards[idOf(run.state, CODES.snaga)]!;
    const base = world.cards.get(CODES.snaga)?.threat ?? 0;
    expect(run.state.seats[0].hand).toEqual([]);
    expect(run.state.seats[0].discard).toHaveLength(1);
    expect(modifiedStat(run.state, snaga, "threat", world.cards)).toBe(base + 2);
    const empty = reveal(haiTable(world), CODES.snaga);
    expect(modifiedStat(empty.state, empty.state.cards[idOf(empty.state, CODES.snaga)]!, "threat", world.cards)).toBe(base);
  });

  it("143067:A:1 When Revealed: each player either returns an enemy engaged with them to the staging area or reveals an encounter card", () => {
    const t = haiTable(world, { seats: 2, engaged: [{ code: "f0", seat: 0 }], deck: ["f3"] });
    const run = reveal(t, CODES.sarumanSOrders, taking("return"));
    // Seat 0 returned its enemy; seat 1 has none to return and revealed a card.
    expect(run.state.seats[0].engaged).toEqual([]);
    expect(codes(run.state, run.state.staging).filter((code) => code !== CODES.sarumanSOrders).sort()).toEqual(["f0", "f3"]);
  });

  it("143067:A:2 Shadow: the attacker gets +1 Attack, and if the attack destroys a character it returns to the staging area", () => {
    const hurt = haiFight(world, CODES.sarumanSOrders, "f0", {}, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    expect(hurt.run.state.cards[hurt.made.hero]?.zone).toBe("discard");
    expect(attackerZone(hurt.run.state)).toBe("staging");
    const fine = haiFight(world, CODES.sarumanSOrders, "f0", {}, { undefended: true });
    expect(attackerZone(fine.run.state)).toBe("engaged");
    expect(fine.run.state.cards[fine.made.hero]?.damage).toBe(2);
  });
});
