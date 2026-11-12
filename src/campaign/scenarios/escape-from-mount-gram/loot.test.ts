// Rules: mec108.side-quests-in-play, mec108.captured-cards, mec108.captured-deck, mec108.campaign-log, rr.attachment-cards, rr.first-player, rr.refresh-phase (data/rules/entries.json);
// ledger lines 10174:B:1, 10174:B:2, 10175:A:1, 10175:A:2, 10176:A:1, 10177:A:2, 10178:A:1, 10179:A:1, 10180:A:3, 10181:A:2, 10181:A:3.
// The campaign card, Loot the Dungeons and the boons it rewards, on tables built from data/ by the scene kit (the Setup and the Resolution of the campaign card are in setup.test.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted, type PrintedCard } from "../../../rules/core/printed.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { legalIntents, reduce, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { rescueCards } from "../../../rules/families/captured/rescue.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { HERO, idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { begin as begun } from "../../../../test/scenarios/escape-from-mount-gram/begun.ts";
import { gramIntent, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";

const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout("escape-from-mount-gram", layout);
const BOONS = ["10176", "10177", "10178", "10179", "10180", "10181"];
const firstOption = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");

describe("Loot the Dungeons", () => {
  it("10175:A:1 has 4 quest points and 4 more for each player in the game", () => {
    for (const [seats, points] of [[1, 8], [2, 12]] as const) {
      const t = table({ seats, staging: ["10175"] });
      const loot = idOf(t.state, "10175");
      expect(modifiedStat(t.state, t.state.cards[loot]!, "questPoints", t.ctx.cards)).toBe(points);
    }
  });

  it("10175:A:2 lets each player in turn choose one boon, adds it to their hand and the Campaign Pool, and offers a boon taken to nobody else", () => {
    const t = table({ seats: 2, staging: ["10175"] });
    const loot = idOf(t.state, "10175");
    const offered: string[][] = [];
    const run = resolveRecords(t.state, t.ctx, "10175", "forced", loot, (state) => {
      if (state.window?.kind === "choose") offered.push([...state.window.options]);
      return firstOption(state);
    });
    expect(offered).toHaveLength(2);
    // The first player is offered every boon (and may decline); the second the five that are left.
    expect(offered[0]?.filter((option) => BOONS.includes(option))).toEqual(BOONS);
    expect(offered[1]?.filter((option) => BOONS.includes(option))).toEqual(BOONS.slice(1));
    expect(run.state.seats[0].hand.some((id) => run.state.cards[id]?.code === "10176")).toBe(true);
    expect(run.state.seats[1].hand.some((id) => run.state.cards[id]?.code === "10177")).toBe(true);
    expect(run.state.resolutionLog.earned.map((item) => item.code)).toEqual(expect.arrayContaining(["10176", "10177"]));
  });
});

describe("The campaign card", () => {
  it("10174:B:2 attaches the set-aside boons of a hero when it enters play, in the order of the log, and not before", () => {
    const t = table({ stage: "10039", campaign: true });
    const stage = t.state.questStage ?? "";
    const made = spawn(t.state, "dh3", { zone: "captured", hostId: stage, seat: 0 }, "down");
    const hero = made.id;
    const first = spawn(updateCard(made.state, hero, { heroSlot: 1 }), "10177", { zone: "setAside" }, "up");
    const second = spawn(first.state, "10180", { zone: "setAside" }, "up");
    const set = { ...second.state, heroBoons: [[first.id, hero], [second.id, hero]] as const };
    expect(set.cards[first.id]?.host).toBeFalsy();
    const back = rescueCards(set, stage, [hero]);
    expect(back.cards[hero]?.attachments).toEqual([first.id, second.id]);
    expect(back.heroBoons ?? []).toHaveLength(0);
  });
});

describe("The campaign card in a played round", () => {
  let world: Awaited<ReturnType<typeof gramWorld>>;
  beforeAll(async () => {
    world = await gramWorld("strong");
  }, 120_000);

  // The threat steps of the first player's first refresh phase, with `sides` side quests in the victory display: the refresh phase's own +1 and the campaign card's raise.
  function refreshThreat(sides: number): { rule: number; card: number } {
    let state = begun(world.ctx, 1);
    for (let count = 0; count < sides; count += 1) state = spawn(state, "10053", { zone: "victory" }, "up").state;
    const memory = new Set<string>();
    const found = { rule: 0, card: 0 };
    for (let guard = 0; guard < 300 && found.rule + found.card === 0; guard += 1) {
      const intent = gramIntent(state, world.ctx, memory);
      const next = reduce(state, intent, world.ctx);
      if (!next.ok) throw new Error(`${state.phase} ${state.mode} ${state.window?.kind}: ${JSON.stringify(intent)}`);
      state = next.state;
      for (const step of next.steps) {
        if (step.kind !== "threat" || step.seat !== 0) continue;
        if ("rule" in step.cause && step.cause.rule === "rr.step-7-3") found.rule += step.amount;
        if ("effect" in step.cause && step.cause.effect === "10174:forced:1") found.card += step.amount;
      }
    }
    return found;
  }

  it("10174:B:1 raises threat by the completed quest cards, and by 1 more for each side quest in the victory display, with no extra 1", () => {
    // The refresh phase's own +1 is not raised: the campaign card raises by the completed quest cards and the side quests instead. The strong heroes rescue every captured card in the first quest phase, so the players are at stage 3 by the first refresh phase: 2 quest cards are completed.
    expect(refreshThreat(0)).toEqual({ rule: 0, card: 2 });
    expect(refreshThreat(2)).toEqual({ rule: 0, card: 4 });
  });
});

describe("The boons", () => {
  it("10176:A:1 Berelind: after she destroys an enemy the player chooses a quest card in play and 1 progress goes on it directly", () => {
    const t = table({ stage: "10039", staging: ["10175", "place"], active: "10046", play: ["10176"] });
    const berelind = idOf(t.state, "10176");
    const loot = idOf(t.state, "10175");
    // The choice is the current quest stage or a side quest in the staging area; the active location does not take it.
    const seen: string[][] = [];
    const onLoot = resolveRecords(t.state, t.ctx, "10176", "response", berelind, (state) => {
      if (state.window?.kind === "choose") seen.push([...state.window.options]);
      return state.window?.kind === "choose" ? (state.window.options.includes(loot) ? loot : (state.window.options[0] ?? "")) : "";
    });
    expect(seen[0]).toEqual([t.state.questStage, loot]);
    expect(onLoot.state.cards[loot]?.progress).toBe(1);
    expect(onLoot.state.cards[idOf(onLoot.state, "10046")]?.progress).toBe(0);
    const onStage = resolveRecords(t.state, t.ctx, "10176", "response", berelind, (state) => (state.window?.kind === "choose" ? (t.state.questStage ?? "") : ""));
    expect(onStage.state.cards[idOf(t.state, "10046")]?.progress).toBe(0);
  });

  it("10177:A:2 Chieftain's Brooch gives each ally that shares a Trait with the attached hero +1 Willpower", () => {
    const t = table({ play: ["10178"] });
    (t.ctx.cards as Map<string, PrintedCard>).set("dhD", definePrinted({ code: "dhD", name: "dhD", type: "hero", sphere: "tactics", traits: ["Dúnedain"], threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
    const hero = spawn(t.state, "dhD", { zone: "heroes", seat: 0 }, "up");
    const brooch = spawn(hero.state, "10177", { zone: "play", seat: 0 }, "up");
    const attached = syncConstants({ ...brooch.state, cards: { ...brooch.state.cards, [hero.id]: { ...brooch.state.cards[hero.id]!, attachments: [brooch.id] }, [brooch.id]: { ...brooch.state.cards[brooch.id]!, host: hero.id, zone: "attached" } } }, t.ctx);
    const ally = attached.cards[idOf(attached, "10178")]!;
    expect(modifiedStat(attached, ally, "willpower", t.ctx.cards)).toBe(modifiedStat({ ...attached, modifiers: [] }, ally, "willpower", t.ctx.cards) + 1);
    // The Brooch is the first of the cards with the Trait: the other hero is not Dúnedain.
    expect(modifiedStat(attached, attached.cards[t.hero]!, "willpower", t.ctx.cards)).toBe(2);
  });

  it("10180:A:3 Mail of Eärnur: after a player's threat is lowered 1 damage is healed from the attached hero", () => {
    const t = table({ attached: [{ code: "10180", to: "dh1" }] });
    const damaged = updateCard(t.state, t.hero, { damage: 2 });
    const mail = idOf(damaged, "10180");
    const run = resolveRecords(damaged, t.ctx, "10180", "response", mail);
    expect(run.state.cards[t.hero]?.damage).toBe(1);
  });

  it("10181:A:2 Silverthorn gives the attached hero +1 Attack and +1 Defense against an enemy that shares a Trait with an enemy in the victory display", () => {
    const t = table({ attached: [{ code: "10181", to: "dh1" }], engaged: ["10044"], victory: ["10043"] });
    const synced = syncConstants(t.state, t.ctx);
    const goblin = idOf(synced, "10044");
    const hero = synced.cards[t.hero]!;
    expect(modifiedStat(synced, hero, "attack", t.ctx.cards, goblin)).toBe(3);
    expect(modifiedStat(synced, hero, "defense", t.ctx.cards, goblin)).toBe(3);
    // Against an enemy sharing no Trait with it, nothing changes.
    expect(modifiedStat(synced, hero, "attack", t.ctx.cards, undefined)).toBe(2);
    const none = syncConstants(table({ attached: [{ code: "10181", to: "dh1" }], engaged: ["10044"] }).state, t.ctx);
    expect(modifiedStat(none, none.cards[idOf(none, HERO)]!, "attack", t.ctx.cards, idOf(none, "10044"))).toBe(2);
  });

  // The event is announced and settled; the Response of the card is used (the cost `payments` pays) and the choices are answered with their first option.
  function used(t: ReturnType<typeof table>, event: Parameters<typeof queueEvent>[1], cardId: string, payments: readonly { heroId: string; amount: number }[] = []): ScenarioState {
    const heard = settle({ ...queueEvent({ ...t.state, window: null }, event) }, t.ctx, []);
    const trigger = legalIntents(heard, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cardId);
    expect(trigger).toBeTruthy();
    let state = expectOk(reduce(heard, { ...trigger!, payments } as unknown as PlayerIntent, t.ctx)).state;
    for (let guard = 0; guard < 5 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: firstOption(state) }, t.ctx)).state;
    return state;
  }

  it("10178:A:1 Coruhaer: after he defends an attack the player spends 1 resource to deal 2 damage to the attacking enemy", () => {
    const t = table({ engaged: ["f3"], play: ["10178"], heroResources: 1 });
    const done = used(t, { trigger: "declaredDefender", seat: 0, cardId: idOf(t.state, "10178"), other: idOf(t.state, "f3") }, idOf(t.state, "10178"), [{ heroId: t.hero, amount: 1 }]);
    expect(done.cards[idOf(t.state, "f3")]?.damage).toBe(2);
    expect(done.cards[t.hero]?.resources).toBe(0);
  });

  it("10179:A:1 Laermuin: after he commits to a quest 1 damage is healed from a character", () => {
    const t = table({ play: [{ code: "10179", damage: 1 }] });
    const laermuin = idOf(t.state, "10179");
    const done = used(t, { trigger: "committed", seat: 0, cardId: laermuin }, laermuin);
    expect(done.cards[laermuin]?.damage).toBe(0);
  });

  it("10181:A:3 Silverthorn: after the attached hero destroys an enemy it adds that enemy to the victory display, once a game", () => {
    const t = table({ attached: [{ code: "10181", to: "dh1" }], engaged: ["10044"] });
    const goblin = idOf(t.state, "10044");
    const silver = idOf(t.state, "10181");
    const heard = settle({ ...queueEvent({ ...t.state, window: null }, { trigger: "attackDestroyed", seat: 0, cardId: t.hero, other: goblin }) }, t.ctx, []);
    const trigger = legalIntents(heard, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === silver);
    expect(trigger).toBeTruthy();
    const done = expectOk(reduce(heard, trigger as unknown as PlayerIntent, t.ctx)).state;
    expect(done.victory).toContain(goblin);
  });
});
