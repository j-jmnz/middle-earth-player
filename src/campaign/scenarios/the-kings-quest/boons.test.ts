// Rules: emce.boon-allies, emce.campaign-pool-encounter, emce.treasure, emce.caves-deck, emce.guarded-x, rr.then (data/rules/entries.json); ledger lines 12171:A:1, 12171:A:2, 12172:A:1, 12172:A:2, 12173:A:1, 12173:A:2, 12174:A:1, 12174:A:2.
// Isolde (12171) and the three burdens The King's Quest places (12172 to 12174) on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { flagged, updateCard } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { CODES, TREASURES, codesIn, finish, idOf, kingsquestTable, legalIntents, loadKingsquestWorld, resolveRecords, send, start, type KingsquestWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-kings-quest/scene.ts";

let world: KingsquestWorld;
beforeAll(async () => {
  world = await loadKingsquestWorld();
}, 120_000);

type Layout = Parameters<typeof kingsquestTable>[1];
const choose = (option: string) => (state: Run["state"]) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === option) ?? state.window.options[0] ?? "") : "");

describe("12171 Isolde", () => {
  it("12171:A:1 gets +2 Willpower while she has an Item attachment", () => {
    const t = kingsquestTable(world, { play: [CODES.isolde] });
    const isolde = idOf(t.state, CODES.isolde);
    expect(modifiedStat(t.state, t.state.cards[isolde]!, "willpower", world.cards)).toBe(1);
    const blade = spawn(t.state, CODES.bladeOfGondolin, { zone: "attached" });
    const armed = syncConstants(attachTo(blade.state, blade.id, isolde), t.ctx);
    expect(modifiedStat(armed, armed.cards[isolde]!, "willpower", world.cards)).toBe(3);
  });

  it("12171:A:2 after her player engages an enemy she readies", () => {
    const t = kingsquestTable(world, { phase: "Encounter", play: [CODES.isolde], staging: ["mild"] });
    const isolde = idOf(t.state, CODES.isolde);
    const tired = updateCard(t.state, isolde, { exhausted: true });
    let run = start(tired);
    expect(run.state.window?.kind).toBe("optionalEngage");
    run = send(run, { type: "Engage", enemyId: idOf(tired, "mild") }, t.ctx);
    const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "12171:response:1");
    expect(offered).toBeDefined();
    run = send(run, offered as PlayerIntent, t.ctx);
    expect(run.state.cards[isolde]?.exhausted).toBe(false);
  });
});

describe("12172 The Threat to Wilderland", () => {
  it("12172:A:1 Setup: a copy found in the encounter deck enters the staging area with X resources, X the campaign card's part number", () => {
    const t = kingsquestTable(world, { staging: [] });
    const aside = spawn(t.state, CODES.theThreatToWilderland, { zone: "setAside" }, "down");
    const run = resolveRecords(aside.state, t.ctx, CODES.theThreatToWilderland, "setup", aside.id);
    const threats = Object.values(run.state.cards).filter((card) => card.code === CODES.theThreatToWilderland);
    expect(threats).toHaveLength(1);
    expect(threats[0]).toMatchObject({ zone: "staging", resources: 3 });
  });

  const forced = (resources: number, option: string) => {
    const t = kingsquestTable(world, { seats: 2, staging: [{ code: CODES.theThreatToWilderland, resources }, "f3"] });
    const threat = idOf(t.state, CODES.theThreatToWilderland);
    return { t, threat, run: resolveRecords(t.state, t.ctx, CODES.theThreatToWilderland, "forced", threat, choose(option)) };
  };

  it("12172:A:2 at the beginning of the quest phase a resource is removed, then every player raises their threat by 2", () => {
    const made = forced(3, "threat");
    expect(made.run.state.cards[made.threat]?.resources).toBe(2);
    expect(made.run.state.seats.map((seat) => seat.threat)).toEqual([30, 30]);
  });

  it("12172:A:2 or all encounter cards are immune to player card effects until the end of the phase", () => {
    const made = forced(2, "immune");
    expect(made.run.state.cards[made.threat]?.resources).toBe(1);
    expect(made.run.state.seats.map((seat) => seat.threat)).toEqual([28, 28]);
    const synced = syncConstants(made.run.state, made.t.ctx);
    expect(flagged(synced, idOf(synced, "f3"), "immuneToPlayerCards")).toBe(true);
    expect(flagged(synced, made.t.hero, "immuneToPlayerCards")).toBe(false);
  });

  it("12172:A:2 with no resource left nothing happens (rr.then: the choice follows a resource removed)", () => {
    const t = kingsquestTable(world, { staging: [{ code: CODES.theThreatToWilderland, resources: 0 }] });
    const record = t.ctx.effects.find((effect) => effect.id === "12172:forced:1")!;
    const id = idOf(t.state, CODES.theThreatToWilderland);
    expect(holds(t.state, record.condition!, { actor: 0, sourceId: id, returned: 0, phase: "Quest" }, t.ctx)).toBe(false);
    const full = kingsquestTable(world, { staging: [{ code: CODES.theThreatToWilderland, resources: 1 }] });
    expect(holds(full.state, record.condition!, { actor: 0, sourceId: idOf(full.state, CODES.theThreatToWilderland), returned: 0, phase: "Quest" }, full.ctx)).toBe(true);
  });
});

describe("12173 Dagnir's Spawn", () => {
  it("12173:A:1 cannot have non-Dragon attachments", () => {
    const t = kingsquestTable(world, { staging: [CODES.dagnirSSpawn] });
    expect(restricted(t.state, t.ctx, "attach").some((entry) => entry.sourceId === idOf(t.state, CODES.dagnirSSpawn))).toBe(true);
  });

  const revealed = (option: string, layout: Layout = {}) => {
    const t = kingsquestTable(world, { deck: [CODES.dagnirSSpawn, "f0", "f0"], ...layout });
    return { t, run: finish(send(start(t.state), { type: "Pass" }, t.ctx), t.ctx, choose(option)) };
  };

  it("12173:A:2 when revealed each player may distribute X damage (X the part number) among their characters; if they do it is shuffled into the encounter deck", () => {
    const { t, run } = revealed("distribute");
    const spawn = run.state.cards[idOf(t.state, CODES.dagnirSSpawn)];
    expect(spawn?.zone).toBe("encounterDeck");
    expect((run.state.cards[t.hero]?.damage ?? 0) + (run.state.cards[t.hero2]?.damage ?? 0)).toBe(3);
  });

  it("12173:A:2 if no player does it enters the staging area as an enemy", () => {
    const { t, run } = revealed("decline");
    expect(run.state.cards[idOf(t.state, CODES.dagnirSSpawn)]?.zone).toBe("staging");
    expect((run.state.cards[t.hero]?.damage ?? 0) + (run.state.cards[t.hero2]?.damage ?? 0)).toBe(0);
  });
});

describe("12174 Abandoned Ruin", () => {
  it("12174:A:1 Setup: a copy found in the encounter deck is shuffled into the Caves deck", () => {
    const t = kingsquestTable(world, { caves: [CODES.lostArmory, CODES.ancientTreasury] });
    const aside = spawn(t.state, CODES.abandonedRuin, { zone: "setAside" }, "down");
    const run = resolveRecords(aside.state, t.ctx, CODES.abandonedRuin, "setup", aside.id);
    expect((run.state.piles?.cavesDeck ?? []).map((id) => run.state.cards[id]?.code).sort()).toEqual([CODES.lostArmory, CODES.ancientTreasury, CODES.abandonedRuin].sort());
  });

  it("12174:A:1 Setup: with no Caves deck it is removed from the game", () => {
    const t = kingsquestTable(world, {});
    const aside = spawn(t.state, CODES.abandonedRuin, { zone: "setAside" }, "down");
    const run = resolveRecords(aside.state, t.ctx, CODES.abandonedRuin, "setup", aside.id);
    expect(run.state.cards[aside.id]?.zone).toBe("removed");
  });

  const traveled = () => {
    const t = kingsquestTable(world, { phase: "Travel", staging: [CODES.abandonedRuin] });
    let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.abandonedRuin) }, t.ctx);
    const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "12174:response:1");
    expect(offered).toBeDefined();
    run = finish(send(run, offered as PlayerIntent, t.ctx), t.ctx);
    return { t, run };
  };

  it("12174:A:2 after it becomes the active location one of 3 random undiscovered treasures is attached to it as a guarded objective", () => {
    const { run } = traveled();
    const treasures = Object.values(run.state.cards).filter((card) => (TREASURES as readonly string[]).includes(card.code));
    expect(treasures).toHaveLength(1);
    expect(treasures[0]).toMatchObject({ zone: "staging" });
    expect(run.state.cards[idOf(run.state, CODES.abandonedRuin)]).toMatchObject({ host: treasures[0]?.id, guard: true });
  });

  it("12174:A:2 when the treasure is free of encounters the players claim it and the first player chooses the character it attaches to", () => {
    const { t, run } = traveled();
    const treasure = Object.values(run.state.cards).find((card) => (TREASURES as readonly string[]).includes(card.code))!;
    // The guard leaves play (explored); the next settle claims the treasure and the first player chooses the character it attaches to.
    let freed = send({ state: moveCard(run.state, idOf(run.state, CODES.abandonedRuin), { zone: "victory" }), steps: [] }, { type: "Pass" }, t.ctx);
    for (let guard = 0; guard < 6 && freed.state.window?.kind === "choose"; guard += 1) freed = send(freed, { type: "Choose", optionId: freed.state.window.options[0] ?? "" }, t.ctx);
    expect(freed.state.cards[treasure.id]?.zone).not.toBe("staging");
    expect(freed.state.cards[treasure.id]?.controller).toBe(0);
    expect(codesIn(freed.state, "victory")).toContain(CODES.abandonedRuin);
  });

  it("12174:A:2 the Response is used once per game for the group", () => {
    const { t, run } = traveled();
    const second = spawn(run.state, CODES.abandonedRuin, { zone: "staging" });
    const again = send({ state: { ...second.state, phase: "Travel", mode: "travel", window: { kind: "travel" }, activeLocation: null, secondActiveLocation: null }, steps: [] }, { type: "Travel", locationId: second.id }, t.ctx);
    expect(legalIntents(again.state, t.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "12174:response:1")).toBe(false);
  });
});
