// Rules: mec109.permanent, rr.attachment-cards, rr.modifiers, rr.defending-player, rr.step-6-4-1, rr.step-6-8-3, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 143015:A:2 to 143019:A:3. The Skill boons and Beyond All Hope
// (the cards the campaign card of The Uruk-hai earns) on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { enemyCard } from "../../../../test/harness/scene-kit.ts";
import { CODES, haiTable, legalIntents, loadHaiWorld, resolveRecords, send, start, type HaiWorld, type PlayerIntent } from "../../../../test/scenarios/the-uruk-hai/scene.ts";

let world: HaiWorld;
beforeAll(async () => {
  world = await loadHaiWorld();
  for (const [code, trait] of [["warrior", "Warrior"], ["healer", "Healer"], ["ranger", "Ranger"], ["noble", "Noble"]] as const) {
    world.cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", traits: [trait], threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
  }
  world.cards.set("d3", enemyCard("d3", { engagementCost: 10, attack: 1, defense: 3, health: 20 }));
  world.cards.set("d3u", enemyCard("d3u", { engagementCost: 10, attack: 1, defense: 3, health: 20, isUnique: true }));
  world.cards.set("treach", definePrinted({ code: "treach", name: "treach", type: "treachery" }));
  world.cards.set("att", definePrinted({ code: "att", name: "att", type: "attachment", sphere: "neutral", cost: 0 }));
}, 120_000);

// A table with the hero `host` of seat 0 holding the boon.
function holding(boon: string, host: string, layout: Parameters<typeof haiTable>[1] = {}) {
  const t = haiTable(world, layout);
  const hero = spawn(t.state, host, { zone: "heroes", seat: 0 });
  const placed = spawn(hero.state, boon, { zone: "play", seat: 0 });
  const state = attachTo(placed.state, placed.id, hero.id);
  return { t, state, hero: hero.id, boon: placed.id };
}

describe("Setup: the boon attaches to a hero with its Trait (143015:A:2, 143016:A:2, 143017:A:2, 143018:A:2)", () => {
  const cases = [
    [CODES.intimidation, "warrior"],
    [CODES.handsOfAHealer, "healer"],
    [CODES.forewarned, "ranger"],
    [CODES.leaderOfMen, "noble"],
  ] as const;
  for (const [boon, trait] of cases) {
    it(`${boon} goes on the ${trait} hero and on no other`, () => {
      const t = haiTable(world);
      let state = t.state;
      for (const code of ["warrior", "healer", "ranger", "noble"]) state = spawn(state, code, { zone: "heroes", seat: 0 }).state;
      const placed = spawn(state, boon, { zone: "hand", seat: 0 });
      const run = resolveRecords(placed.state, t.ctx, boon, "setup", placed.id);
      const host = run.state.cards[placed.id]?.host;
      expect(host).toBeTruthy();
      expect(run.state.cards[host ?? ""]?.code).toBe(trait);
    });
  }
});

describe("143015 Intimidation", () => {
  const fight = (enemy: string, attackers: "one" | "two") => {
    const made = holding(CODES.intimidation, "warrior", { phase: "PlayerAttacks", engaged: [enemy] });
    const enemyId = made.t.state.seats[0].engaged[0] ?? "";
    let run = send(start(made.state), { type: "DeclareAttackers", enemyId, attackerIds: attackers === "one" ? [made.hero] : [made.hero, made.t.hero] }, made.t.ctx);
    const offered = legalIntents(run.state, made.t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "143015:response:1");
    if (offered) run = send(run, offered as PlayerIntent, made.t.ctx);
    return { run, offered, enemyId, made };
  };

  it("143015:A:3 declared as the only attacker against a non-unique enemy, exhausting it gives that enemy -2 Defense for this attack", () => {
    const { run, offered, enemyId } = fight("d3", "one");
    expect(offered).toBeDefined();
    // 2 Attack against 3 - 2 = 1 Defense.
    expect(run.state.cards[enemyId]?.damage).toBe(1);
  });

  it("143015:A:3 is not offered when the hero does not attack alone, or against a unique enemy", () => {
    expect(fight("d3", "two").offered).toBeUndefined();
    expect(fight("d3u", "one").offered).toBeUndefined();
  });
});

describe("143016 Hands of a Healer", () => {
  it("143016:A:3 Action: exhaust the attached hero and Hands of a Healer to heal up to 3 damage from a hero, a Captive included (user ruling, 2026-11-08)", () => {
    const made = holding(CODES.handsOfAHealer, "healer", { captives: ["hero2"], phase: "Planning" });
    const hurt = updateCard(updateCard(made.state, made.t.hero2, { damage: 5 }), made.t.hero, { damage: 2 });
    const used = legalIntents(hurt, made.t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "143016:action:1");
    expect(used).toBeDefined();
    // Choose the Captive: it heals 3 of its 5 damage; the healer and the boon are exhausted.
    const run = send({ state: hurt, steps: [] }, used as PlayerIntent, made.t.ctx);
    const picked = run.state.window?.kind === "choose" ? send(run, { type: "Choose", optionId: run.state.window.options.find((id) => id === made.t.hero2) ?? "" }, made.t.ctx) : run;
    expect(picked.state.cards[made.t.hero2]?.damage).toBe(2);
    expect(picked.state.cards[made.hero]?.exhausted).toBe(true);
    expect(picked.state.cards[made.boon]?.exhausted).toBe(true);
  });

  it("143016:A:3 is not offered when no hero is damaged", () => {
    const made = holding(CODES.handsOfAHealer, "healer", { captives: ["hero2"], phase: "Planning" });
    expect(legalIntents(made.state, made.t.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "143016:action:1")).toBe(false);
  });
});

describe("143017 Forewarned", () => {
  it("143017:A:3 declared as a defender against a non-unique enemy, exhausting it discards 1 shadow card from that enemy", () => {
    const made = holding(CODES.forewarned, "ranger", { phase: "Encounter", engaged: ["d3"], deck: ["treach", "f0", "f0"], hand: ["filler"] });
    // The enemy attacks, dealt a shadow card; the Ranger defends and may discard it before it is revealed.
    let current = send(start(made.state), { type: "DeclineEngage" }, made.t.ctx);
    for (let guard = 0; guard < 40 && current.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(current.state, made.t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      current = send(current, pass as PlayerIntent, made.t.ctx);
    }
    expect(current.state.window?.kind).toBe("defense");
    const enemy = current.state.pendingAttack?.enemyId ?? "";
    expect(current.state.cards[enemy]?.shadowId).toBeTruthy();
    const shadow = current.state.cards[enemy]?.shadowId ?? "";
    current = send(current, { type: "DeclareDefender", defenderId: made.hero }, made.t.ctx);
    const offered = legalIntents(current.state, made.t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "143017:response:1");
    expect(offered).toBeDefined();
    current = send(current, offered as PlayerIntent, made.t.ctx);
    expect(current.state.cards[shadow]?.zone).toBe("encounterDiscard");
    expect(current.state.cards[made.boon]?.exhausted).toBe(true);
  });
});

describe("143018 Leader of Men", () => {
  it("143018:A:3 after the attached hero quests successfully, exhausting it adds 1 resource to that hero's pool", () => {
    const made = holding(CODES.leaderOfMen, "noble", { phase: "Quest", pursuit: 10 });
    const committed = updateCard(made.state, made.hero, { committed: true });
    let run = send(start(committed), { type: "Pass" }, made.t.ctx);
    for (let guard = 0; guard < 6 && run.state.window?.kind !== "response"; guard += 1) {
      const pass = legalIntents(run.state, made.t.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.phase !== "Quest") break;
      run = send(run, pass as PlayerIntent, made.t.ctx);
    }
    const offered = legalIntents(run.state, made.t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "143018:response:1");
    expect(offered).toBeDefined();
    const before = run.state.cards[made.hero]?.resources ?? 0;
    const used = send(run, offered as PlayerIntent, made.t.ctx);
    expect(used.state.cards[made.hero]?.resources).toBe(before + 1);
    expect(used.state.cards[made.boon]?.exhausted).toBe(true);
  });
});

describe("143019 Beyond All Hope", () => {
  it("143019:A:3 the attached hero gets +1 Willpower, +1 Attack and +1 Defense", () => {
    const made = holding(CODES.beyondAllHope, "warrior");
    const t = made.t;
    const settled = settleSynced(made.state, t);
    const hero = settled.cards[made.hero]!;
    for (const stat of ["willpower", "attack", "defense"] as const) expect(modifiedStat(settled, hero, stat, world.cards)).toBe(3);
    expect(modifiedStat(settled, settled.cards[t.hero]!, "attack", world.cards)).toBe(2);
  });

  it("143019:A:3 the attached hero cannot have treachery cards attached, and another hero can", () => {
    const made = holding(CODES.beyondAllHope, "warrior");
    const settled = settleSynced(made.state, made.t);
    expect(attachBlocked(settled, made.t.ctx, made.hero, "treach")).toBe(true);
    expect(attachBlocked(settled, made.t.ctx, made.t.hero, "treach")).toBe(false);
    expect(attachBlocked(settled, made.t.ctx, made.hero, "att")).toBe(false);
  });
});

// The constants of the cards on the table, as the engine syncs them before a stat is read.
function settleSynced(state: ScenarioState, t: ReturnType<typeof haiTable>): ScenarioState {
  return syncConstants(state, t.ctx);
}
