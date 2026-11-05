// Rules: emce.caves-deck, emce.deep, emce.guarded-x, rr.victory, rr.quest-advancement, rr.then, rr.search (data/rules/entries.json); ledger lines 18078:A:1, 18078:B:1, 18078:B:2, 18079:A:1, 18079:B:1 to 18079:B:3, 18080:A:1, 18080:B:1 to 18080:B:3.
// The three stages of The King's Quest on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { flagged, updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { CODES, codesIn, finish, idOf, kingsquestTable, legalIntents, loadKingsquestWorld, resolveRecords, send, start, type KingsquestWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-kings-quest/scene.ts";

let world: KingsquestWorld;
beforeAll(async () => {
  world = await loadKingsquestWorld();
}, 120_000);

type Layout = Parameters<typeof kingsquestTable>[1];
const stageCode = (run: Run): string | undefined => (run.state.questStage ? run.state.cards[run.state.questStage]?.code : undefined);
const cavesOf = (run: Run) => (run.state.piles?.cavesDeck ?? []).map((id) => run.state.cards[id]?.code);
const choose = (option: string) => (state: Run["state"]) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === option) ?? state.window.options[0] ?? "") : "");

describe("18078 The Iron Hills (stage 1)", () => {
  it("18078:A:1 Setup: the Caves deck is shuffled, the encounter deck is shuffled, and each player discards until an enemy or location is discarded and adds it to the staging area", () => {
    const t = kingsquestTable(world, { seats: 2, deck: ["f0", "treachery", "place", "treachery", "f3"], caves: [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen, CODES.lightlessGrotto, CODES.crumblingCavern, CODES.undergroundLake] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? undefined);
    const staged = codesIn(run.state, "staging");
    expect(staged).toHaveLength(2);
    for (const code of staged) expect(["enemy", "location"]).toContain(world.cards.get(code)?.type);
    // The Caves deck is shuffled with the seed: the same cards, in an order the seed decides.
    expect([...cavesOf(run)].sort()).toEqual([CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen, CODES.lightlessGrotto, CODES.crumblingCavern, CODES.undergroundLake].sort());
  });

  it("18078:B:1 at the beginning of the quest phase a location is discarded and the first player adds it to the staging area, or every player raises their threat by its printed Threat", () => {
    const t = kingsquestTable(world, { seats: 2, deck: ["f0", CODES.ancientTreasury, "f0"], stage: "18078" });
    const add = resolveRecords(t.state, t.ctx, CODES.stage1, "forced", t.state.questStage ?? undefined, choose("add"));
    expect(codesIn(add.state, "staging")).toContain(CODES.ancientTreasury);
    expect(codesIn(add.state, "encounterDiscard")).toEqual(["f0"]);
    const raise = resolveRecords(t.state, t.ctx, CODES.stage1, "forced", t.state.questStage ?? undefined, choose("threat"));
    expect(codesIn(raise.state, "staging")).not.toContain(CODES.ancientTreasury);
    expect(raise.state.seats[0]?.threat).toBe(31);
    expect(raise.state.seats[1]?.threat).toBe(31);
  });

  it("18078:B:2 cannot be defeated unless there are 3 locations with victory points in the victory display", () => {
    const two = kingsquestTable(world, { stage: "18078", victory: [CODES.lostArmory, CODES.ancientTreasury] });
    expect(restricted(two.state, two.ctx, "advance").length).toBeGreaterThan(0);
    const three = kingsquestTable(world, { stage: "18078", victory: [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen] });
    expect(restricted(three.state, three.ctx, "advance")).toEqual([]);
    const noPoints = kingsquestTable(world, { stage: "18078", victory: [CODES.lostArmory, CODES.ancientTreasury, "place"] });
    expect(restricted(noPoints.state, noPoints.ctx, "advance").length).toBeGreaterThan(0);
  });
});

describe("18079 The Lower Depths (stage 2)", () => {
  const second = (layout: Layout = {}) => kingsquestTable(world, { stage: "18079", ...layout });

  it("18079:A:1 Dragon Hoard goes to the bottom of the Caves deck, Fire-drake to the staging area and the Dragon Might set into the encounter deck", () => {
    const t = kingsquestTable(world, { stage: "18078", caves: [CODES.lostArmory, CODES.ancientTreasury], setAside: [CODES.fireDrake, CODES.dragonHoard, CODES.dragonBreath, CODES.dragonScales], deck: ["f0", "f0"] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage2, "whenRevealed", t.state.questStage ?? undefined);
    expect(cavesOf(run)).toEqual([CODES.lostArmory, CODES.ancientTreasury, CODES.dragonHoard]);
    expect(codesIn(run.state, "staging")).toEqual([CODES.fireDrake]);
    expect(codesIn(run.state, "encounterDeck").sort()).toEqual(["f0", "f0", CODES.dragonBreath, CODES.dragonScales].sort());
  });

  it("18079:B:1 Fire-drake cannot leave the staging area (it cannot be engaged) or take damage", () => {
    const t = second({ staging: [CODES.fireDrake] });
    const drake = idOf(t.state, CODES.fireDrake);
    expect(flagged(t.state, drake, "cannotTakeDamage")).toBe(true);
    expect(flagged(t.state, drake, "cannotBeEngaged")).toBe(true);
    const later = kingsquestTable(world, { stage: "18080", staging: [CODES.fireDrake] });
    expect(flagged(later.state, idOf(later.state, CODES.fireDrake), "cannotTakeDamage")).toBe(false);
    expect(flagged(later.state, idOf(later.state, CODES.fireDrake), "cannotBeEngaged")).toBe(false);
  });

  it("18079:B:2 after progress is placed from questing successfully, 5 progress may be removed to look at the top 2 Caves cards, one staying on top and the other going to the bottom", () => {
    const t = second({ progress: 3, caves: [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen] });
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    for (let guard = 0; guard < 6 && run.state.window?.kind !== "response"; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, t.ctx);
    }
    expect(run.state.window?.kind).toBe("response");
    const progress = run.state.cards[run.state.questStage ?? ""]?.progress ?? 0;
    expect(progress).toBeGreaterThanOrEqual(5);
    const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "18079:response:1");
    expect(offered).toBeDefined();
    const used = finish(send(run, offered as PlayerIntent, t.ctx), t.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    expect(used.state.cards[used.state.questStage ?? ""]?.progress).toBe(progress - 5);
    expect(cavesOf(used)).toEqual([CODES.ancientTreasury, CODES.frightfulDen, CODES.lostArmory]);
  });

  it("18079:B:2 two-handed, the look is chosen by the seat that resolves the Response, not always the first player", () => {
    const t = second({ seats: 2, progress: 5, caves: [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen] });
    // The Response's conditions (the quest phase, a successful quest, 5 progress) are the Response test above; here the effect itself runs for a seat.
    const effects = t.ctx.effects.filter((effect) => effect.id === "18079:response:1").map(({ condition: _condition, ...effect }) => effect);
    const looking = (seat: number) => {
      const pushed = pushCardEffects(t.state, "forced", t.state.questStage ?? "", seat, false, effects, t.ctx, []);
      return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []).window;
    };
    expect(looking(1)).toMatchObject({ kind: "choose", seat: 1 });
    expect(looking(0)).toMatchObject({ kind: "choose", seat: 0 });
  });

  it("18079:B:2 with fewer than 5 progress the Response is not offered", () => {
    const t = second({ progress: 0, caves: [CODES.lostArmory, CODES.ancientTreasury] });
    const weak = updateCard(t.state, t.hero, { committed: true });
    expect(legalIntents({ ...weak, window: { kind: "response", seat: 0 } }, t.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "18079:response:1")).toBe(false);
  });

  it("18079:B:3 after Dragon Hoard becomes the active location the quest advances to stage 3, whose When Revealed attaches a Dragon treachery to Fire-drake", () => {
    const t = second({ phase: "Travel", staging: [CODES.dragonHoard, CODES.fireDrake], deck: [CODES.dragonBreath, "f0"], caves: [CODES.lostArmory] });
    let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.dragonHoard) }, t.ctx);
    for (let guard = 0; guard < 6 && run.state.window?.kind === "response"; guard += 1) run = finish(send(run, { type: "Pass" }, t.ctx), t.ctx);
    run = finish(run, t.ctx);
    expect(stageCode(run)).toBe("18080");
    expect(run.state.cards[idOf(run.state, CODES.dragonBreath)]).toMatchObject({ zone: "attached", host: idOf(run.state, CODES.fireDrake) });
  });
});

describe("18080 The Fire Worm (stage 3)", () => {
  const third = (layout: Layout = {}) => kingsquestTable(world, { stage: "18080", ...layout });

  it("18080:A:1 a Dragon treachery from the encounter deck or discard pile, the first player's choice, is attached to Fire-drake", () => {
    const t = third({ staging: [CODES.fireDrake], deck: ["f0", CODES.dragonBreath], discard: [CODES.dragonScales] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === CODES.dragonScales) ?? "") : ""));
    expect(run.state.cards[idOf(run.state, CODES.dragonScales)]).toMatchObject({ zone: "attached", host: idOf(run.state, CODES.fireDrake) });
    expect(run.state.cards[idOf(run.state, CODES.dragonBreath)]?.zone).toBe("encounterDeck");
  });

  it("18080:A:1 with no Dragon treachery in the deck or the discard pile nothing is attached", () => {
    const t = third({ staging: [CODES.fireDrake], deck: ["f0"] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? undefined);
    expect(run.state.cards[idOf(run.state, CODES.fireDrake)]?.attachments).toEqual([]);
  });

  it("18080:B:1 the Deep keyword is ignored", () => {
    const t = third({ phase: "Travel", staging: [CODES.deepChasm], caves: [CODES.lostArmory] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.deepChasm) }, t.ctx), t.ctx);
    expect(run.state.cards[run.state.activeLocation ?? ""]?.code).toBe(CODES.deepChasm);
    expect(cavesOf(run)).toEqual([CODES.lostArmory]);
  });

  const attack = (progress: number, attackers: 1 | 2, option: string, drakeDamage = 0) => {
    const t = third({ phase: "PlayerAttacks", progress, engaged: [{ code: CODES.fireDrake, seat: 0, damage: drakeDamage }] });
    const strong: typeof t.state = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: t.hero, sourceId: t.hero, stat: "attack", amount: 6, until: "endOfPhase" }, { instanceId: t.hero2, sourceId: t.hero2, stat: "attack", amount: 6, until: "endOfPhase" }] };
    const drake = idOf(strong, CODES.fireDrake);
    const run = send(start(strong), { type: "DeclareAttackers", enemyId: drake, attackerIds: attackers === 1 ? [t.hero] : [t.hero, t.hero2] }, t.ctx);
    return { t, drake, run: finish(run, t.ctx, choose(option)) };
  };

  it("18080:B:2 after a player declares X attackers against Fire-drake they remove X progress from the main quest, or the attack is canceled", () => {
    const removed = attack(5, 2, "remove");
    expect(removed.run.state.cards[removed.run.state.questStage ?? ""]?.progress).toBe(3);
    expect(removed.run.state.cards[removed.drake]?.damage).toBeGreaterThan(0);
    const canceled = attack(5, 2, "cancel");
    expect(canceled.run.state.cards[canceled.run.state.questStage ?? ""]?.progress).toBe(5);
    expect(canceled.run.state.cards[canceled.drake]?.damage).toBe(0);
  });

  it("18080:B:2 with fewer than X progress the only choice is to cancel the attack", () => {
    const poor = attack(1, 2, "remove");
    expect(poor.run.state.cards[poor.drake]?.damage).toBe(0);
    expect(poor.run.state.cards[poor.run.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("18080:B:2 once per declared attack: X is that attack's attackers (2 attackers remove 2, not 1 each twice), exactly X progress still lets the player remove it, and a canceled attack leaves its attackers exhausted (user ruling, 2026-11-05)", () => {
    const exact = attack(2, 2, "remove");
    expect(exact.run.state.cards[exact.run.state.questStage ?? ""]?.progress).toBe(0);
    expect(exact.run.state.cards[exact.drake]?.damage).toBeGreaterThan(0);
    const canceled = attack(5, 2, "cancel");
    for (const id of [canceled.t.hero, canceled.t.hero2]) expect(canceled.run.state.cards[id]?.exhausted).toBe(true);
  });

  it("18080:B:3 the stage cannot be defeated while Fire-drake is in play, and defeating it wins the game", () => {
    const t = third({ engaged: [{ code: CODES.fireDrake, seat: 0 }] });
    expect(restricted(t.state, t.ctx, "advance").length).toBeGreaterThan(0);
    const gone = third({});
    expect(restricted(gone.state, gone.ctx, "advance")).toEqual([]);
    const slain = attack(2, 1, "remove", 16);
    expect(slain.run.state.cards[slain.drake]?.zone).not.toBe("engaged");
    expect(slain.run.state.stageCleared).toBe(true);
  });
});
