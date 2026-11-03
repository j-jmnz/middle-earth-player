// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.campaign-pool, rr.campaign-log, rr.winning-the-game, rr.destroy, ltp.campaign-setup-checklist
// (data/rules/entries.json). Journey Along the Anduin in a campaign: what Passage Through Mirkwood hands it, its campaign card (Mendor, Valor and
// Scarred), what a win writes (the pool on its heroes, the prisoner) and unlocks, and what a loss leaves.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../catalog/boundary.ts";
import { EFFECTS } from "../effects/index.ts";
import { syncConstants } from "../rules/interpret/constants.ts";
import { pushEffectFrame } from "../rules/interpret/effect-frames.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { legalIntents } from "../rules/engine/legal.ts";
import { settle } from "../rules/engine/machine.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { resolutionResult } from "../rules/setup/resolution.ts";
import { queueEvent } from "../rules/windows/queue.ts";
import { updateCard } from "../rules/core/state.ts";
import { attachTo, spawn } from "../rules/core/zones.ts";
import { loadScenario } from "../../scripts/data/load-scenarios.ts";
import { ANDUIN_GOLDENS, anduinLoadout, anduinWorld, playGolden, type AnduinGame } from "../../scripts/anduin-game.ts";
import { anduin, anduinTable, campaign, fight, loadAnduinWorld, MENDOR, type AnduinLayout, type AnduinWorld } from "../../scripts/anduin-scene.ts";
import { MIRKWOOD_GOLDENS, mirkwoodWorld, playGolden as playPassage } from "../../scripts/mirkwood-game.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";
import { first, send, start, type Run } from "../../scripts/past-scene.ts";

import { checklist } from "./checklist.ts";
import { resolutionView, settledSentence } from "./resolution-view.ts";
import { loadWorld } from "./world.ts";
import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { buildStart } from "./start.ts";

let world: AnduinWorld;
let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
const games = new Map<string, AnduinGame>();

beforeAll(async () => {
  world = await loadAnduinWorld();
  // Honour Guard answers damage dealt, so a game with it in hand holds a lethal wound for the Responses.
  for (const [code, card] of await loadPrinted(["10004"])) world.cards.set(code, card);
  const strong = await anduinWorld("strong");
  const extra = await loadPrinted(["01132", "01134", "01136", "01137", "01135", "01129"]);
  cards = new Map([...world.cards, ...strong.cards, ...extra]);
  ctx = { effects: EFFECTS, cards };
  const brittle = await anduinWorld("brittle");
  for (const golden of ANDUIN_GOLDENS.filter((item) => item.outcome === "won")) games.set(golden.name, playGolden(golden, (golden.decks === "brittle" ? brittle : strong).ctx));
}, 240_000);

function make(layout: AnduinLayout = {}) {
  const made = anduinTable(world, { campaign: true, ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// The reducer's answer to an intent. The test frames below run effects under an id of their own, so their numbers have no record to name.
function step(run: Run, intent: PlayerIntent, c: ReduceContext): Run {
  const result = expectOk(reduce(run.state, intent, c));
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

// Runs the instructions as an effect frame of the campaign card and lets what they started resolve, answering each choice with the first option
// and using each Response offered.
function frame(state: ScenarioState, instructions: readonly Instruction[], c: ReduceContext, use = true): Run {
  const steps: Run["steps"] = [];
  const pushed = pushEffectFrame(state, { frame: "ResolveEffect", sourceId: first(state, "01130"), actor: 0, peril: false, effectId: "test", instructions, cancel: null, blockCancel: null }, steps);
  let run: Run = { state: settle({ ...pushed, window: null }, c, steps), steps };
  for (let guard = 0; guard < 20; guard += 1) {
    const trigger = use ? legalIntents(run.state, c).find((intent) => intent.type === "Trigger") : undefined;
    if (trigger) run = step(run, trigger as PlayerIntent, c);
    else if (run.state.window?.kind === "choose") run = step(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, c);
    else break;
  }
  return run;
}

const KILL_TROLLS: Instruction = { verb: "Each", pick: { type: "enemy", control: "any", names: ["Hill Troll"] }, instructions: [{ verb: "DamageCard", amount: 99, target: "picked" }] };

function attached(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code && card.zone === "play" && card.host != null).map((card) => state.cards[card.host ?? ""]?.code ?? "").sort();
}

describe("Journey Along the Anduin in a campaign", () => {
  it("is the second part of Mirkwood Paths, and Escape from Dol Guldur follows it", () => {
    expect(campaign.scenarios.slice(0, 3)).toEqual(["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"]);
    expect(anduin.campaignCard).toBe("01130");
    expect(anduin.campaignPlaced).toEqual(["01133", "01135", "01138"]);
  });

  it("receives Passage Through Mirkwood's earned pool through the Campaign Setup Checklist (01129:B:1)", async () => {
    const golden = MIRKWOOD_GOLDENS.find((item) => item.outcome === "won" && item.seatCount === 2)!;
    const passage = playPassage(golden, (await mirkwoodWorld("strong")).ctx);
    const log = applyResolution(emptyLog(2), passage.state.scenarioId, passage.state, cards);
    expect(log.completed).toEqual(["passage-through-mirkwood"]);
    expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "current", "locked"]);
    const plan = checklist({ log, scenario: anduin, seats: anduinLoadout(2), effects: EFFECTS, cards });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    for (const seat of [0, 1]) expect(plan.seats[seat]?.deck.filter((code) => code === "01132"), `seat ${seat}`).toHaveLength(1);
    const burden = log.campaignPool.find((card) => card.back === "encounter")?.code;
    expect(plan.poolEncounterCards).toEqual([burden]);
    // The campaign card's Setup is dealt by the engine: Mendor is put into play and a Valor and a Scarred for each player are set aside.
    const start = buildStart({ campaign, scenario: anduin, seatCount: 2, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay, mode: "campaign" });
    expect(start.definition.setup.map((instruction) => ("code" in instruction ? `${instruction.verb}:${instruction.code}` : instruction.verb))).toEqual(["PutObjectiveAllyIntoPlay:01135", "SetAsideEachPlayer:01133", "SetAsideEachPlayer:01138", "ShuffleEncounterDeck"]);
  });

  it("deals it as a standalone game with no campaign card, no Mendor and no Valor or Scarred", () => {
    const standalone = buildStart({ campaign, scenario: anduin, seatCount: 1, seed: 1, threatModifier: 0, seats: anduinLoadout(1), effects: EFFECTS, mode: "standalone" });
    let state = startScenario(standalone, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect(Object.values(state.cards).filter((card) => ["01130", "01135", "01133", "01138"].includes(card.code))).toEqual([]);
    expect(state.resolution).toEqual([]);
  });
});

describe("the campaign card's lines", () => {
  it("has the first player's Response attach a Valor to a hero of each player when a Hill Troll is defeated, at most one to a hero (01130:A:3)", () => {
    const made = make({ seats: 2, engaged: [{ code: "01082", seat: 0 }], setAside: ["01133", "01133"] });
    const run = frame(made.state, [KILL_TROLLS], made.ctx);
    // Seat 0 chose among its two heroes (the first option), seat 1 has one hero.
    expect(attached(run.state, "01133")).toEqual(["ah1", "ah3"]);
    expect(run.state.cards[first(run.state, "01133")]?.zone).toBe("play");
    // Two Trolls for one player: the hero who has a Valor is not offered again (Limit 1 per hero), so the second copy goes to the other hero.
    const second = make({ engaged: [{ code: "01082", seat: 0 }, { code: "01082", seat: 0 }], setAside: ["01133"] });
    const hero = first(second.state, "ah1");
    const withValor = spawn(second.state, "01133", { zone: "play", seat: 0 });
    const held = syncConstants(attachTo(withValor.state, withValor.id, hero), second.ctx);
    const next = frame(held, [KILL_TROLLS], second.ctx);
    expect(attached(next.state, "01133")).toEqual(["ah1", "ah2"]);
  });

  it("makes no one attach a Valor when no hero can take one, or no copy is set aside (01130:A:3)", () => {
    const made = make({ engaged: [{ code: "01082", seat: 0 }] });
    const bare = { ...made.state, setAside: [] };
    expect(attached(frame(bare, [KILL_TROLLS], made.ctx).state, "01133")).toEqual([]);
  });

  it("has a character destroyed by a Hill Troll bring a Scarred to each player, once per game (01130:A:4)", () => {
    // Undefended, a Hill Troll's 6 Attack destroys a hero who already has 4 damage (6 hit points).
    const hit = fight(world, "f0", "01082", { campaign: true, seats: 2, damage: [["ah1", 4]], setAside: ["01138", "01138"] }, { undefended: true });
    expect(hit.run.state.cards[hit.hero]?.zone).toBe("discard");
    expect(attached(hit.run.state, "01138")).toEqual(["ah2", "ah3"]);
    expect(hit.run.state.uses.filter((use) => use.effectId === "01130:forced:1")).toHaveLength(1);
    // The limit is spent: another character a Hill Troll destroys brings no more.
    const troll = Object.values(hit.run.state.cards).find((card) => card.code === "01082")!;
    const again = settle(queueEvent({ ...hit.run.state, window: null }, { trigger: "characterDestroyedByAttack", seat: 0, subject: first(hit.run.state, "ah2"), other: troll.id }), hit.ctx, []);
    expect(attached(again, "01138")).toEqual(["ah2", "ah3"]);
    // A character another enemy destroys brings none.
    const other = fight(world, "f0", "brute", { campaign: true, damage: [["ah1", 4]], setAside: ["01138"] }, { undefended: true });
    expect(other.run.state.cards[other.hero]?.zone).toBe("discard");
    expect(attached(other.run.state, "01138")).toEqual([]);
  });

  it("brings the Scarred when a card that answers damage is in hand, so the lethal damage is held and the hero is destroyed after the Responses (01130:A:4)", () => {
    // Honour Guard (10004) answers damage dealt: the engine holds the lethal damage, then destroys the hero at the end of the attack.
    const held = fight(world, "f0", "01082", { campaign: true, seats: 2, damage: [["ah1", 4]], setAside: ["01138", "01138"], hand: ["10004"] }, { undefended: true });
    expect(held.run.state.cards[held.hero]?.zone).toBe("discard");
    expect(attached(held.run.state, "01138")).toEqual(["ah2", "ah3"]);
    // The same attack with nothing in hand that answers damage brings the same cards.
    const plain = fight(world, "f0", "01082", { campaign: true, seats: 2, damage: [["ah1", 4]], setAside: ["01138", "01138"] }, { undefended: true });
    expect(attached(plain.run.state, "01138")).toEqual(attached(held.run.state, "01138"));
  });

  it("has Scarred raise its controller's threat by 1 when a character they control is destroyed (01138:A:2), and Valor heal its hero and hurt the enemy it attacks (01133:A:2)", () => {
    const made = make({ seats: 2, engaged: [{ code: "grunt", seat: 0 }], phase: "Combat", damage: [["ah2", 2]] });
    const hero = first(made.state, "ah1");
    const second = first(made.state, "ah2");
    const scar = spawn(made.state, "01138", { zone: "play", seat: 0 });
    const valor = spawn(scar.state, "01133", { zone: "play", seat: 0 });
    const held = syncConstants(attachTo(attachTo(valor.state, valor.id, second), scar.id, hero), made.ctx);
    // A character its controller controls is destroyed: threat +1 (an ally here, so the hero keeping Scarred stays).
    const ally = spawn(held, "ally", { zone: "play", seat: 0 });
    const lost = frame(ally.state, [{ verb: "Pick", pick: { type: "ally", control: "you", names: ["ally"] } }, { verb: "DamageCard", amount: 99, target: "picked" }], made.ctx, false);
    expect(lost.state.seats[0].threat).toBe(29);
    expect(lost.state.seats[1].threat).toBe(26);
    // Valor: the attached hero declared as an attacker may exhaust Valor to heal 1 damage from it and deal 1 damage to the enemy.
    let run: Run = start(held);
    for (let guard = 0; guard < 12 && run.state.window?.kind !== "playerAttack"; guard += 1) {
      if (run.state.window?.kind === "defense") run = send(run, { type: "DeclareDefender", defenderId: hero }, made.ctx);
      else run = send(run, legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass") as PlayerIntent, made.ctx);
    }
    const grunt = first(held, "grunt");
    run = send(run, { type: "DeclareAttackers", enemyId: grunt, attackerIds: [second] }, made.ctx);
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "01133:response:1");
    expect(trigger).toBeDefined();
    run = send(run, trigger as PlayerIntent, made.ctx);
    expect(run.state.cards[second]?.damage).toBe(1);
    expect(run.state.cards[grunt]?.damage).toBeGreaterThanOrEqual(1);
    expect(run.state.cards[valor.id]?.exhausted).toBe(true);
  });

  it("loses the game when Mendor leaves play (01130:A:5)", () => {
    const made = make({});
    const run = frame(made.state, [{ verb: "Each", pick: { type: "character", control: "any", names: ["Mendor"] }, instructions: [{ verb: "DamageCard", amount: 99, target: "picked" }] }], made.ctx);
    expect(run.state.lost).toBe(true);
    expect(run.state.lossReason).toContain("Mendor left play");
    expect(first(made.state, MENDOR)).toBeTruthy();
  });
});

// A won game's state: the stage cleared and the heroes as the test leaves them, resolved by the campaign card's Resolution.
function resolved(layout: AnduinLayout, edit: (state: ScenarioState, ids: { hero: string; hero2: string; hero3: string | null }) => ScenarioState = (state) => state, seed = 3) {
  const made = make({ stage: "01128", seed, ...layout });
  const state = edit(made.state, { hero: made.hero, hero2: made.hero2, hero3: made.seat1Hero });
  const won = settle({ ...state, stageCleared: true, window: null }, made.ctx, []);
  return { ...made, state: won, result: resolutionResult(won) };
}

describe("what a win writes", () => {
  it("names the hero with the most damage the prisoner, and a tie is broken at random from the seed (01130:B:1)", () => {
    const most = resolved({ seats: 2 }, (state, ids) => updateCard(updateCard(updateCard(state, ids.hero, { damage: 2 }), ids.hero2, { damage: 5 }), ids.hero3 ?? "", { damage: 3 }));
    expect(most.result?.prisoner).toBe("ah2");
    const picked = new Set<string | null | undefined>();
    for (let seed = 1; seed <= 30; seed += 1) {
      const tied = resolved({ seats: 2 }, (state, ids) => updateCard(updateCard(updateCard(state, ids.hero, { damage: 4 }), ids.hero2, { damage: 4 }), ids.hero3 ?? "", { damage: 1 }), seed);
      picked.add(tied.result?.prisoner);
      // The same seed gives the same prisoner.
      expect(resolved({ seats: 2 }, (state, ids) => updateCard(updateCard(updateCard(state, ids.hero, { damage: 4 }), ids.hero2, { damage: 4 }), ids.hero3 ?? "", { damage: 1 }), seed).result?.prisoner).toBe(tied.result?.prisoner);
    }
    expect([...picked].sort()).toEqual(["ah1", "ah2"]);
    // With no damage anywhere every hero is tied; a hero that fell is not a candidate.
    const fresh = resolved({});
    expect(["ah1", "ah2"]).toContain(fresh.result?.prisoner);
  });

  it("adds each Valor and Scarred in play to the Campaign Pool on its hero and records the prisoner in the log (01130:B:1)", () => {
    const made = resolved({ seats: 2 }, (state, ids) => {
      const valor = spawn(state, "01133", { zone: "play", seat: 0 });
      const scarred = spawn(valor.state, "01138", { zone: "play", seat: 1 });
      const second = spawn(scarred.state, "01133", { zone: "play", seat: 0 });
      return updateCard(attachTo(attachTo(attachTo(second.state, second.id, ids.hero2), scarred.id, ids.hero3 ?? ""), valor.id, ids.hero), ids.hero2, { damage: 3 });
    });
    // Both of seat 0's heroes carry a Valor: one pool card for each hero, not one for the seat.
    expect(made.result?.earned.map((item) => `${item.code}@${item.hero}`).sort()).toEqual(["01133@ah1", "01133@ah2", "01138@ah3"]);
    expect(made.result?.prisoner).toBe("ah2");
    const log = applyResolution(emptyLog(2), made.state.scenarioId, made.state, cards);
    expect(log.completed).toEqual(["journey-along-the-anduin"]);
    expect(log.prisoner).toBe("ah2");
    expect(log.campaignPool.map((card) => `${card.code}@${card.attachedTo}`).sort()).toEqual(["01133@ah1", "01133@ah2", "01138@ah3"]);
    expect(campaignPath(campaign, {}, { ...log, completed: ["passage-through-mirkwood", ...log.completed] }).map((node) => node.status).slice(0, 3)).toEqual(["completed", "completed", "current"]);
  });

  it("takes a fallen hero's Valor and Scarred out of the pool", () => {
    const made = resolved({ seats: 2 }, (state, ids) => {
      const valor = spawn(state, "01133", { zone: "play", seat: 0 });
      return attachTo(valor.state, valor.id, ids.hero);
    });
    const log = applyResolution({ ...emptyLog(2), fallenHeroesBySeat: [["ah1"], []] }, made.state.scenarioId, made.state, cards);
    expect(log.campaignPool).toEqual([]);
  });

  it("hands the pool on its heroes to the next scenario's checklist: each Valor and Scarred is attached to its hero again (01130:B:1)", () => {
    const game = games.get("two-handed, brittle heroes, won with a Valor and a Scarred")!;
    expect(game.state.stageCleared).toBe(true);
    const log = applyResolution(emptyLog(2), game.state.scenarioId, game.state, cards);
    expect(log.campaignPool.length).toBeGreaterThan(0);
    // Escape from Dol Guldur's campaign card asks the first player where Appointed by Fate goes (01131:A:2).
    const plan = checklist({ log, scenario: loadScenario("escape-from-dol-guldur"), seats: log.heroesBySeat.map((heroes) => ({ heroes, deck: Array.from({ length: 30 }, () => "filler") })), effects: EFFECTS, cards, choices: [`01134>${log.heroesBySeat[0]?.[0]}`] });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    // Appointed by Fate (01134) is the campaign card's own attachment, not the pool's.
    const onHeroes = plan.seats.flatMap((seat) => (seat.attachments ?? []).filter((item) => item.code !== "01134").map((item) => `${item.code}@${item.host}`)).sort();
    expect(onHeroes).toEqual(log.campaignPool.map((card) => `${card.code}@${card.attachedTo}`).sort());
    expect(log.prisoner).not.toBeNull();
  });

  it("tells the player what confirming writes: each Valor and Scarred on its hero, the prisoner, and the scenario it unlocks (01130:B:1)", () => {
    const game = games.get("two-handed, brittle heroes, won with a Valor and a Scarred")!;
    const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
    const base = loadWorld(catalog, campaign, anduin, EFFECTS, ["01133", "01138"]);
    const named = { ...base, cards: new Map([...base.cards, ...cards]) };
    const view = resolutionView(game.state, named);
    expect(view.kind).toBe("settled");
    if (view.kind !== "settled") return;
    expect(view.prisoner).toBe(game.state.resolutionLog.prisoner);
    const sentence = settledSentence(view, named, "Escape from Dol Guldur");
    expect(sentence).toMatch(/^Confirming records Valor on \w+ and Scarred on \w+ in the campaign and unlocks Escape from Dol Guldur\. \w+, the hero with the most damage, is taken prisoner\.$/);
    // A game with nothing attached still names the prisoner.
    const plain = games.get("true solo, won")!;
    const bare = resolutionView(plain.state, named);
    if (bare.kind !== "settled") throw new Error("not settled");
    expect(settledSentence(bare, named, "Escape from Dol Guldur")).toMatch(/^Confirming records Valor on \w+ in the campaign and unlocks Escape from Dol Guldur\. \w+, the hero with the most damage, is taken prisoner\.$/);
  });
});
