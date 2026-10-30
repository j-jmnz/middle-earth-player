// Rules: rr.setup, rr.forced, rr.reveal, rr.step-6-4-2, rr.attachment-cards, rr.refresh-phase (data/rules/entries.json). What the nightmare
// family adds for the Mirkwood Paths Nightmare decks, run with their real records (src/effects/authored/nightmare/) on fixture cards under
// their codes. Each test names the ledger line (data/printed/nightmare.json) it is for.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as DUNGEONS } from "../../effects/authored/nightmare/escape-from-dol-guldur.ts";
import { AUTHORED_EFFECTS as ANDUIN } from "../../effects/authored/nightmare/journey-along-the-anduin.ts";
import { AUTHORED_EFFECTS as MIRKWOOD } from "../../effects/authored/nightmare/passage-through-mirkwood.ts";

import { constantWin, syncConstants } from "../constants.ts";
import { canAttack } from "../combat.ts";
import { pushCardEffects, pushEffectFrame } from "../effect-frames.ts";
import { cardMap, expectOk, hero, idleScenario } from "../fixture.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat } from "../keywords.ts";
import { settle } from "../machine.ts";
import { readyCard } from "../player-verbs.ts";
import { reduce } from "../reduce.ts";
import { definePrinted } from "../printed.ts";
import { doRefresh } from "../refresh.ts";
import { finishSetup } from "../setup.ts";
import { flagged, updateCard, withThreat, type ScenarioState } from "../state.ts";
import { fireForced } from "../triggers.ts";
import { spawn } from "../zones.ts";
import { run as runNightmare } from "./nightmare.ts";
import { prisonerHeroes, run as runPrisoner } from "./prisoner.ts";
import { afterQuestOutcome } from "./quest-outcome.ts";

const cards = cardMap([
  definePrinted({ code: "900101", name: "Passage Through Mirkwood Nightmare", type: "nightmare" }),
  definePrinted({ code: "900102", name: "Ungoliant's Spawn", type: "enemy", traits: ["Creature", "Spider"], engagementCost: 32, threat: 3, attack: 5, defense: 3, health: 9 }),
  definePrinted({ code: "900103", name: "Ungoliant's Brood", type: "enemy", traits: ["Creature", "Spider"], engagementCost: 31, threat: 2, attack: 3, defense: 2, health: 5 }),
  definePrinted({ code: "900105", name: "Spiders of Mirkwood", type: "enemy", traits: ["Spider"], engagementCost: 18, threat: 3, attack: 2, defense: 2, health: 4 }),
  definePrinted({ code: "900106", name: "The Spider's Web", type: "treachery" }),
  definePrinted({ code: "900107", name: "Backtrack!", type: "treachery" }),
  definePrinted({ code: "900109", name: "Glade of the Spawn", type: "location", traits: ["Mirkwood"], threat: 4, questPoints: 4 }),
  definePrinted({ code: "rider", name: "Rider", type: "enemy", threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }),
  definePrinted({ code: "road", name: "Road", type: "location", threat: 1, questPoints: 2 }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery" }),
  definePrinted({ code: "stage", name: "Flies and Spiders", type: "quest", questPoints: 8 }),
  definePrinted({ code: "900201", name: "Journey Along the Anduin Nightmare", type: "nightmare" }),
  definePrinted({ code: "900202", name: "Marshland Outlaws", type: "enemy", traits: ["Marshland"], engagementCost: 21, threat: 2, attack: 2, defense: 2, health: 8 }),
  definePrinted({ code: "900203", name: "Anduin Troll Spawn", type: "enemy", traits: ["Troll"], engagementCost: 26, threat: 2, attack: 4, defense: 3, health: 5 }),
  definePrinted({ code: "900204", name: "Brown Water Rats", type: "enemy", traits: ["Creature", "Rat"], engagementCost: 1, threat: 1, attack: 1, defense: 1, health: null }),
  definePrinted({ code: "900205", name: "A Flooded Ford", type: "location", traits: ["Riverland"], threat: 3, questPoints: 6 }),
  definePrinted({ code: "900207", name: "Pursuit on the Shore", type: "treachery" }),
  definePrinted({ code: "900208", name: "Troll Attack", type: "treachery" }),
  definePrinted({ code: "900209", name: "Smoking Blood", type: "treachery" }),
  definePrinted({ code: "01082", name: "Hill Troll", type: "enemy", traits: ["Troll"], engagementCost: 30, threat: 1, attack: 6, defense: 3, health: 9 }),
  definePrinted({ code: "s2", name: "Anduin Passage", type: "quest", questPoints: 16 }),
  definePrinted({ code: "s3", name: "Ambush on the Shore", type: "quest", questPoints: 0 }),
  definePrinted({ code: "900301", name: "Escape from Dol Guldur Nightmare", type: "nightmare" }),
  definePrinted({ code: "900302", name: "Torture Master", type: "enemy", traits: ["Dol Guldur", "Orc"], engagementCost: 45, threat: 5, attack: 1, defense: 2, health: 4 }),
  definePrinted({ code: "900305", name: "Torture Chamber", type: "location", traits: ["Dol Guldur"], threat: 3, questPoints: 6 }),
  definePrinted({ code: "900306", name: "Dungeon Labyrinth", type: "location", traits: ["Dol Guldur"], threat: 1, questPoints: 4 }),
  definePrinted({ code: "900309", name: "Dark Interrogation", type: "treachery" }),
  definePrinted({ code: "01102", name: "Nazgûl of Dol Guldur", type: "enemy", traits: ["Nazgûl"], engagementCost: 40, threat: 5, attack: 4, defense: 3, health: 9 }),
  definePrinted({ code: "blade", name: "Blade", type: "attachment", cost: 1 }),
  hero("frodo", "spirit", 8, 2),
  hero("sam", "spirit", 8, 2),
  hero("gimli", "tactics", 8, 3),
]);

function record(effects: readonly Effect[], id: string): Effect {
  const found = effects.find((effect) => effect.id === id);
  if (!found) throw new Error(`No record ${id}`);
  return found;
}

// One seat (or two) with three ready heroes each, and the quest stage in play.
function table(seatCount: 1 | 2 = 1): { state: ScenarioState; heroes: string[][] } {
  let state: ScenarioState = { ...idleScenario(seatCount), stages: [{ code: "stage" }], firstPlayer: 0 };
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = updateCard(placed.state, placed.id, { face: "B" });
  const heroes: string[][] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    const own: string[] = [];
    for (const code of ["frodo", "sam", "gimli"]) {
      const made = spawn(state, code, { zone: "heroes", seat });
      state = made.state;
      own.push(made.id);
    }
    heroes.push(own);
  }
  return { state, heroes };
}

function deck(state: ScenarioState, codes: readonly string[], zone: "encounterDeck" | "encounterDiscard" = "encounterDeck"): ScenarioState {
  let next = state;
  for (const code of codes) next = spawn(next, code, { zone }).state;
  return next;
}

describe("Passage Through Mirkwood Nightmare (900101-900109)", () => {
  const ctx: ReduceContext = { effects: MIRKWOOD, cards };
  const choose = (state: ScenarioState, optionId: string): ScenarioState => expectOk(reduce(state, { type: "Choose", optionId }, ctx)).state;
  const fire = (state: ScenarioState, frame: "whenRevealed" | "forced" | "shadow", sourceId: string, id: string, steps: EngineStep[] = []) =>
    settle(pushCardEffects(state, frame, sourceId, 0, false, [record(MIRKWOOD, id)], ctx, steps), ctx, steps);

  it("has each player reveal a card during Setup, from the setup card next to the quest deck (900101:A:2, duringSetup)", () => {
    const { state: base } = table(2);
    const placed = spawn(deck(base, ["rider", "road", "rider"]), "900101", { zone: "nightmare" }).state;
    const done = settle({ ...finishSetup({ ...placed, phase: "Setup", setup: [] }, ctx, []), mode: "stopped" }, ctx, []);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["rider", "road"]);
    expect(done.encounterDeck).toHaveLength(1);
    // Without the setup card nothing is revealed.
    const normal = settle({ ...finishSetup({ ...deck(base, ["rider", "road"]), phase: "Setup", setup: [] }, ctx, []), mode: "stopped" }, ctx, []);
    expect(normal.staging).toEqual([]);
  });

  it("discards each committed character Ungoliant's Spawn leaves at 0 Willpower (900102:A:1)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = "", gimli = ""] = heroes[0] ?? [];
    let state = updateCard(updateCard(base, frodo, { committed: true, exhausted: true }), gimli, { committed: true, exhausted: true });
    const spawned = spawn(state, "900102", { zone: "staging" });
    state = fire(spawned.state, "whenRevealed", spawned.id, "900102:whenRevealed:1");
    expect(state.cards[frodo]?.zone).toBe("discard");
    expect(state.cards[gimli]?.zone).toBe("heroes");
    expect(state.cards[sam]?.zone).toBe("heroes");
    const gimliCard = state.cards[gimli];
    expect(gimliCard ? modifiedStat(state, gimliCard, "willpower", cards) : -1).toBe(1);
  });

  it("keeps the engaged player's cards from readying for the rest of the round once Ungoliant's Brood engages (900103:A:1, cannotReady)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = ""] = heroes[0] ?? [];
    const brood = spawn(updateCard(updateCard(base, frodo, { exhausted: true }), sam, { exhausted: true }), "900103", { zone: "engaged", seat: 0 });
    const barred = fire(brood.state, "forced", brood.id, "900103:forced:1");
    expect(readyCard(barred, frodo).cards[frodo]?.exhausted).toBe(true);
    const refreshed = doRefresh(barred, ctx, []);
    expect(refreshed.cards[frodo]?.exhausted).toBe(true);
    expect(refreshed.cards[sam]?.exhausted).toBe(true);
    // Before it engages, they ready.
    expect(readyCard(brood.state, frodo).cards[frodo]?.exhausted).toBe(false);
  });

  it("gives Spiders of Mirkwood +1 Attack for each exhausted character of the player it is engaged with (900105:A:1)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = ""] = heroes[0] ?? [];
    const engaged = spawn(updateCard(updateCard(base, frodo, { exhausted: true }), sam, { exhausted: true }), "900105", { zone: "engaged", seat: 0 });
    const synced = syncConstants(engaged.state, ctx);
    const spider = synced.cards[engaged.id];
    expect(spider ? modifiedStat(synced, spider, "attack", cards) : 0).toBe(4);
    const staged = spawn(engaged.state, "900105", { zone: "staging" });
    const quiet = syncConstants(staged.state, ctx);
    const other = quiet.cards[staged.id];
    expect(other ? modifiedStat(quiet, other, "attack", cards) : 0).toBe(2);
  });

  it("attaches The Spider's Web to a hero of the player with the highest threat, who exhausts each hero; each ready deals 1 damage (900106:A:1)", () => {
    const { state: base, heroes } = table(2);
    const high = withThreat(base, 1, 40);
    const web = spawn(high, "900106", { zone: "staging" });
    const asked = fire(web.state, "whenRevealed", web.id, "900106:whenRevealed:1");
    const attached = choose(asked, heroes[1]?.[2] ?? "");
    const host = attached.cards[web.id]?.host ?? "";
    expect(host).toBe(heroes[1]?.[2]);
    for (const id of heroes[1] ?? []) expect(attached.cards[id]?.exhausted).toBe(true);
    for (const id of heroes[0] ?? []) expect(attached.cards[id]?.exhausted).toBe(false);
    const readied = settle(readyCard(syncConstants(attached, ctx), host), ctx, []);
    expect(readied.cards[host]?.damage).toBe(1);
    const other = (heroes[1] ?? []).find((id) => id !== host) ?? "";
    expect(settle(readyCard(readied, other), ctx, []).cards[other]?.damage).toBe(0);
  });

  it("returns the topmost enemy or location in the encounter discard pile to the staging area (900107:A:2)", () => {
    const { state: base } = table();
    const piled = deck(base, ["rider", "road", "mist"], "encounterDiscard");
    const back = spawn(piled, "900107", { zone: "staging" });
    const done = fire(back.state, "whenRevealed", back.id, "900107:whenRevealed:1");
    expect(done.staging.map((id) => done.cards[id]?.code)).toContain("road");
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toEqual(["rider", "mist"]);
  });

  it("deals the attacking enemy the topmost card with a Shadow effect in the encounter discard pile (900107:A:3)", () => {
    const { state: base } = table();
    const enemy = spawn(deck(base, ["900102", "mist"], "encounterDiscard"), "rider", { zone: "engaged", seat: 0 });
    const attacking = { ...enemy.state, pendingAttack: { enemyId: enemy.id, seat: 0 } };
    const dealt = runNightmare(attacking, { verb: "DealShadowFromDiscard" }, { seat: 0, sourceId: null }, ctx, []);
    const spawnCard = Object.values(dealt?.cards ?? {}).find((card) => card.code === "900102");
    expect(spawnCard?.zone).toBe("shadow");
    expect(dealt?.encounterDiscard.map((id) => dealt.cards[id]?.code)).toEqual(["mist"]);
  });

  it("has each player exhaust a character when a Spider enters play while Glade of the Spawn is the active location (900109:A:1)", () => {
    const { state: base, heroes } = table();
    const glade = spawn(base, "900109", { zone: "activeLocation" });
    const spider = spawn(glade.state, "900105", { zone: "staging" });
    const asked = settle({ ...spider.state, pendingEvents: [{ trigger: "encounterEnteredPlay", seat: null, subject: spider.id }] }, ctx, []);
    const heard = choose(asked, heroes[0]?.[1] ?? "");
    expect((heroes[0] ?? []).filter((id) => heard.cards[id]?.exhausted)).toHaveLength(1);
  });
});

describe("Journey Along the Anduin Nightmare (900201-900209)", () => {
  const ctx: ReduceContext = { effects: ANDUIN, cards };
  const choose = (state: ScenarioState, optionId: string): ScenarioState => expectOk(reduce(state, { type: "Choose", optionId }, ctx)).state;
  const fire = (state: ScenarioState, frame: "whenRevealed" | "forced" | "shadow", sourceId: string, id: string) =>
    settle(pushCardEffects(state, frame, sourceId, 0, false, [record(ANDUIN, id)], ctx, []), ctx, []);
  const runFrame = (state: ScenarioState, sourceId: string, instructions: Parameters<typeof pushEffectFrame>[1]["instructions"], extra: { other?: string } = {}) =>
    settle(pushEffectFrame(state, { frame: "shadow", sourceId, actor: 0, peril: false, effectId: "fixture", instructions, cancel: null, blockCancel: null, ...extra }, []), ctx, []);

  it("gives Troll enemies \"Cannot have attachments\" and refills an empty encounter deck in any phase (900201:A:2, 900201:A:3)", () => {
    const { state: base } = table();
    const setup = spawn({ ...base, phase: "Combat" }, "900201", { zone: "nightmare" }).state;
    const troll = spawn(setup, "01082", { zone: "staging" });
    const synced = syncConstants(deck(troll.state, ["mist", "road"], "encounterDiscard"), ctx);
    expect(flagged(synced, troll.id, "cannotHaveAttachments")).toBe(true);
    const refilled = settle({ ...synced, mode: "stopped" }, ctx, []);
    expect(refilled.encounterDeck).toHaveLength(2);
    expect(refilled.encounterDiscard).toEqual([]);
    const normal = settle({ ...syncConstants(deck({ ...base, phase: "Combat" }, ["mist"], "encounterDiscard"), ctx), mode: "stopped" }, ctx, []);
    expect(normal.encounterDeck).toEqual([]);
  });

  it("holds the player engaged with Marshland Outlaws to attacking and damaging Marshland Outlaws (900202:A:1, attackOnlyTitle)", () => {
    const { state: base, heroes } = table();
    const hero = heroes[0]?.[0] ?? "";
    const outlaws = spawn(base, "900202", { zone: "engaged", seat: 0 });
    const troll = spawn(outlaws.state, "01082", { zone: "engaged", seat: 0 });
    const synced = syncConstants(troll.state, ctx);
    expect(canAttack(synced, 0, hero, troll.id, cards)).toBe(false);
    expect(canAttack(synced, 0, hero, outlaws.id, cards)).toBe(true);
    // A hero's effect does not damage the Hill Troll either, and does damage Marshland Outlaws.
    expect(runFrame(synced, hero, [{ verb: "DamageCard", amount: 1, target: "other" }], { other: troll.id }).cards[troll.id]?.damage).toBe(0);
    expect(runFrame(synced, hero, [{ verb: "DamageCard", amount: 1, target: "other" }], { other: outlaws.id }).cards[outlaws.id]?.damage).toBe(1);
    // In the staging area it holds nobody.
    const staged = syncConstants(spawn(base, "900202", { zone: "staging" }).state, ctx);
    const loose = spawn(staged, "01082", { zone: "engaged", seat: 0 });
    expect(canAttack(syncConstants(loose.state, ctx), 0, hero, loose.id, cards)).toBe(true);
  });

  it("has Anduin Troll Spawn engage the player engaged with a Hill Troll at the beginning of the combat phase (900203:A:2)", () => {
    const { state: base } = table(2);
    const hill = spawn(base, "01082", { zone: "engaged", seat: 1 });
    const spawnTroll = spawn(hill.state, "900203", { zone: "staging" });
    const engaged = fire({ ...spawnTroll.state, phase: "Combat" }, "forced", spawnTroll.id, "900203:forced:1");
    expect(engaged.cards[spawnTroll.id]).toMatchObject({ zone: "engaged", controller: 1 });
    const none = fire({ ...spawn(base, "900203", { zone: "staging" }).state, phase: "Combat" }, "forced", "i0", "900203:forced:1");
    expect(none.staging).toHaveLength(1);
  });

  it("discards Brown Water Rats on stage 3 once only Rats are left, and not before (900204:A:2, onStage)", () => {
    const { state: base } = table();
    const third: ScenarioState = { ...base, stages: [{ code: "stage" }, { code: "s2" }, { code: "s3" }] };
    const onThird = updateCard(third, third.questStage ?? "", { code: "s3" });
    const rats = spawn(onThird, "900204", { zone: "staging" });
    const gone = fire(rats.state, "forced", rats.id, "900204:forced:3");
    expect(gone.cards[rats.id]?.zone).toBe("encounterDiscard");
    const withTroll = spawn(rats.state, "01082", { zone: "staging" }).state;
    expect(fire(withTroll, "forced", rats.id, "900204:forced:3").cards[rats.id]?.zone).toBe("staging");
    const firstStage = spawn(third, "900204", { zone: "staging" });
    expect(fire(firstStage.state, "forced", firstStage.id, "900204:forced:3").cards[firstStage.id]?.zone).toBe("staging");
  });

  it("raises each player's threat by A Flooded Ford's progress when the encounter deck reveals a card (900205:A:1)", () => {
    const { state: base } = table();
    const ford = spawn(base, "900205", { zone: "staging" });
    const placed = updateCard(deck(ford.state, ["mist"]), ford.id, { progress: 2 });
    const threat = placed.seats[0]?.threat ?? 0;
    const mist = placed.encounterDeck[0] ?? "";
    // A Flooded Ford in the staging area hears the encounter deck reveal another card.
    const fired = settle(fireForced(placed, { trigger: "revealed", seat: 0, cardId: mist, fromDeck: true }, ctx, []), ctx, []);
    expect(settle(fireForced(placed, { trigger: "revealed", seat: 0, cardId: mist }, ctx, []), ctx, []).seats[0]?.threat).toBe(threat);
    expect(fired.seats[0]?.threat).toBe(threat + 2);
  });

  it("returns the enemy with the most hit points from the victory display or discard pile to the staging area (900207:A:1)", () => {
    const { state: base } = table();
    const piled = deck(deck(base, ["rider"], "encounterDiscard"), ["mist"]);
    const troll = spawn(piled, "01082", { zone: "victory" });
    const pursuit = spawn(troll.state, "900207", { zone: "staging" });
    const done = fire(pursuit.state, "whenRevealed", pursuit.id, "900207:whenRevealed:1");
    expect(done.cards[troll.id]?.zone).toBe("staging");
    expect(done.victory).toEqual([]);
  });

  it("has only the engaged Troll enemies attack (900208:A:1, ImmediateAttackEach trait)", () => {
    const { state: base } = table();
    const rider = spawn(deck(base, ["mist", "mist"]), "rider", { zone: "engaged", seat: 0 });
    const troll = spawn(rider.state, "01082", { zone: "engaged", seat: 0 });
    const attack = spawn(troll.state, "900208", { zone: "staging" });
    const done = fire(attack.state, "whenRevealed", attack.id, "900208:whenRevealed:1");
    expect(done.pendingAttack?.enemyId).toBe(troll.id);
  });

  it("resolves a Troll's attack against each other player as an undefended attack (900208:A:2, AttackOthersUndefended)", () => {
    const { state: base, heroes } = table(2);
    const troll = spawn(base, "01082", { zone: "engaged", seat: 0 });
    const asked = runFrame(troll.state, troll.id, [{ verb: "AttackOthersUndefended" }]);
    const target = heroes[1]?.[2] ?? "";
    const hit = choose(asked, target);
    expect(hit.cards[target]?.damage).toBe(6);
    for (const id of heroes[0] ?? []) expect(hit.cards[id]?.damage).toBe(0);
  });

  it("removes all damage from enemies and raises each engaged player's threat by it; with none, gains surge (900209:A:1)", () => {
    const { state: base } = table();
    const troll = spawn(base, "01082", { zone: "engaged", seat: 0 });
    const staged = spawn(troll.state, "rider", { zone: "staging" });
    const hurt = updateCard(updateCard(staged.state, troll.id, { damage: 3 }), staged.id, { damage: 1 });
    const blood = spawn(deck(hurt, ["mist"]), "900209", { zone: "staging" });
    const threat = blood.state.seats[0]?.threat ?? 0;
    const done = fire(blood.state, "whenRevealed", blood.id, "900209:whenRevealed:1");
    expect(done.cards[troll.id]?.damage).toBe(0);
    expect(done.cards[staged.id]?.damage).toBe(0);
    expect(done.seats[0]?.threat).toBe(threat + 3);
  });

  it("moves all damage on the attacking enemy to the character the attack was made against (900209:A:2, MoveDamageTo)", () => {
    const { state: base, heroes } = table();
    const target = heroes[0]?.[2] ?? "";
    const troll = spawn(base, "01082", { zone: "engaged", seat: 0 });
    const hurt = updateCard(troll.state, troll.id, { damage: 2 });
    const moved = runFrame(hurt, troll.id, [{ verb: "MoveDamageTo", from: "self", to: "other" }], { other: target });
    expect(moved.cards[troll.id]?.damage).toBe(0);
    expect(moved.cards[target]?.damage).toBe(2);
  });
});

describe("Escape from Dol Guldur Nightmare (900301-900309)", () => {
  const ctx: ReduceContext = { effects: DUNGEONS, cards };
  const fire = (state: ScenarioState, frame: "whenRevealed" | "forced" | "shadow", sourceId: string, id: string) =>
    settle(pushCardEffects(state, frame, sourceId, 0, false, [record(DUNGEONS, id)], ctx, []), ctx, []);
  const runFrame = (state: ScenarioState, sourceId: string, instructions: Parameters<typeof pushEffectFrame>[1]["instructions"], extra: { other?: string; dealt?: number } = {}) =>
    settle(pushEffectFrame(state, { frame: "shadow", sourceId, actor: 0, peril: false, effectId: "fixture", instructions, cancel: null, blockCancel: null, ...extra }, []), ctx, []);

  it("captures one hero in all with 1 or 2 players, and rescues every prisoner together (900301:A:2)", () => {
    const { state: base } = table(2);
    const taken = runPrisoner(base, { verb: "TakePrisoner" }, { seat: 0, sourceId: null }, ctx, []) ?? base;
    const more = runNightmare(taken, { verb: "TakeMorePrisoners" }, { seat: 0, sourceId: null }, ctx, []) ?? taken;
    expect(prisonerHeroes(more)).toHaveLength(1);
  });

  it("turns a hero the attack damaged face down as a prisoner, keeping its damage, and rescues each prisoner (900302:A:2)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = ""] = heroes[0] ?? [];
    const master = spawn(updateCard(base, frodo, { damage: 1 }), "900302", { zone: "engaged", seat: 0 });
    const missed = runFrame(master.state, master.id, [{ verb: "TakeHeroPrisoner", card: "other", dealt: true }], { other: frodo });
    expect(missed.cards[frodo]?.zone).toBe("heroes");
    const hit = runFrame(master.state, master.id, [{ verb: "TakeHeroPrisoner", card: "other", dealt: true }], { other: frodo, dealt: 1 });
    expect(hit.cards[frodo]).toMatchObject({ zone: "captive", prisoner: true, damage: 1 });
    const second = runFrame(hit, master.id, [{ verb: "TakeHeroPrisoner", card: "other", dealt: true }], { other: sam, dealt: 2 });
    expect(prisonerHeroes(second)).toHaveLength(2);
    const rescued = runPrisoner(second, { verb: "RescuePrisoner", damage: 1 }, { seat: 0, sourceId: null }, ctx, []) ?? second;
    expect(prisonerHeroes(rescued)).toEqual([]);
    expect(rescued.cards[frodo]).toMatchObject({ zone: "heroes", damage: 2 });
    expect(rescued.cards[sam]).toMatchObject({ zone: "heroes", damage: 1 });
  });

  it("returns the players from stage 3 to stage 2B (900302:A:2, ReturnToStage)", () => {
    const { state: base } = table();
    const staged: ScenarioState = { ...base, stages: [{ code: "stage" }, { code: "s2" }, { code: "s3" }] };
    const third = updateCard(staged, staged.questStage ?? "", { code: "s3", progress: 2 });
    const second = spawn(third, "s2", { zone: "setAside" });
    const back = runNightmare(second.state, { verb: "ReturnToStage", stage: 2 }, { seat: 0, sourceId: null }, ctx, []) ?? second.state;
    expect(back.questStage).toBe(second.id);
    expect(back.cards[second.id]).toMatchObject({ zone: "questStage", face: "B", progress: 0 });
    expect(back.cards[third.questStage ?? ""]).toMatchObject({ zone: "questDeck", progress: 0 });
  });

  it("loses the game once Torture Chamber holds 4 resource tokens (900305:A:1), and Dungeon Labyrinth grows with its tokens (900306:A:1)", () => {
    const { state: base } = table();
    const chamber = spawn(base, "900305", { zone: "staging" });
    expect(constantWin(updateCard(chamber.state, chamber.id, { resources: 3 }), ctx).lost).toBe(false);
    expect(constantWin(updateCard(chamber.state, chamber.id, { resources: 4 }), ctx).lost).toBe(true);
    const maze = spawn(chamber.state, "900306", { zone: "staging" });
    const synced = syncConstants(updateCard(maze.state, maze.id, { resources: 2 }), ctx);
    const card = synced.cards[maze.id];
    expect(card ? modifiedStat(synced, card, "threat", cards) : 0).toBe(3);
    expect(card ? modifiedStat(synced, card, "questPoints", cards) : 0).toBe(6);
    const tokens = fire(synced, "forced", chamber.id, "900305:forced:1");
    // Each Dol Guldur location in play takes 1 at the end of the round: the chamber itself too.
    expect(tokens.cards[maze.id]?.resources).toBe(3);
    expect(tokens.cards[chamber.id]?.resources).toBe(1);
  });

  it("puts the Nazgûl of Dol Guldur into play engaged with the first player when the players quest unsuccessfully (900307:A:1)", () => {
    const { state: base } = table(2);
    const nazgul = spawn({ ...base, firstPlayer: 1 }, "01102", { zone: "setAside" });
    const delayed = { ...nazgul.state, delayed: [{ id: "d", until: "questFailed" as const, sourceId: null, seat: 0, phase: nazgul.state.phase, instructions: [{ verb: "EngageOutOfPlay" as const, code: "01102" }], uncancelable: null }] };
    const success = settle(afterQuestOutcome(delayed, { committed: [], result: "success" }, ctx, []), ctx, []);
    expect(success.cards[nazgul.id]?.zone).toBe("setAside");
    expect(success.delayed).toEqual([]);
    const failure = settle(afterQuestOutcome(delayed, { committed: [], result: "failure" }, ctx, []), ctx, []);
    expect(failure.cards[nazgul.id]).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("moves 1 resource from each of the defending player's heroes to a Dol Guldur location in the staging area (900308:A:3)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = "", gimli = ""] = heroes[0] ?? [];
    const chamber = spawn(updateCard(updateCard(base, frodo, { resources: 2 }), sam, { resources: 1 }), "900305", { zone: "staging" });
    const moved = runFrame(chamber.state, chamber.id, [{ verb: "MoveResourceFromHeroes", to: "self" }]);
    expect(moved.cards[chamber.id]?.resources).toBe(2);
    expect([frodo, sam, gimli].map((id) => moved.cards[id]?.resources)).toEqual([1, 0, 0]);
  });

  it("discards each card the defending player controls with a copy in his discard pile (900309:A:2, copyInDiscard)", () => {
    const { state: base, heroes } = table();
    const host = heroes[0]?.[0] ?? "";
    const blade = spawn(base, "blade", { zone: "play", seat: 0 });
    const piled = spawn(blade.state, "blade", { zone: "discard", seat: 0 }).state;
    const interrogation = spawn(piled, "900309", { zone: "staging" });
    const done = fire(interrogation.state, "shadow", interrogation.id, "900309:shadow:1");
    expect(done.cards[blade.id]?.zone).toBe("discard");
    expect(done.cards[host]?.zone).toBe("heroes");
  });

  it("has a player with 2 or fewer cards in hand reveal an encounter card instead of discarding (900309:A:1)", () => {
    const { state: base } = table();
    const hand = spawn(deck(base, ["rider"]), "blade", { zone: "hand", seat: 0 }).state;
    const interrogation = spawn(hand, "900309", { zone: "staging" });
    const done = fire(interrogation.state, "whenRevealed", interrogation.id, "900309:whenRevealed:1");
    expect(done.encounterDeck).toEqual([]);
    expect(done.seats[0]?.hand).toHaveLength(1);
  });
});
