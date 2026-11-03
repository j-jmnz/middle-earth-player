import { checklist } from "../src/campaign/checklist.ts";
import { emptyLog, poolCard, type CampaignLog } from "../src/campaign/log.ts";
import { buildStart } from "../src/campaign/start.ts";
import type { LoadoutSeat } from "../src/campaign/loadout.ts";
import { campaignScenario, type Difficulty } from "../src/catalog/scenario-data.ts";
import { EFFECTS } from "../src/effects/index.ts";
import type { CampaignFacts , ModeCard } from "../src/rules/campaign-state.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat.ts";
import { expectOk } from "../src/rules/fixture.ts";
import { askingToCommit } from "../src/rules/families/sea/sailing-legal.ts";
import { definePrinted, type PrintedCard } from "../src/rules/printed.ts";
import type { EngineStep } from "../src/rules/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import type { StartScenario } from "../src/rules/setup.ts";

import { campaign, CODES, flight, MODIFICATIONS, ORIGINAL_SHIPS, SHIP_CODES } from "./stormcaller-scene.ts";
import { nextIntent, type PolicyOptions } from "./auto-player.ts";
import { loadPrinted } from "./test-catalog.ts";
import { gameCodes } from "./data/load-scenarios.ts";

// Test helper. A whole game of Flight of the Stormcaller in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small
// to quest, or too brittle to survive an attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play.
// Each player takes a ship (the first option each choice offers), fits the Modification boon the choice offers first, and keeps or trades the damage on it as the policy
// says; the Sailing test commits no one or the Dream-chaser, as the policy says. Ships defend, the heroes attack the Ship enemies.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const FLIGHT_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FlightDecks = "strong" | "weak" | "brittle" | "tense";

export function flightLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: ["q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

const STATS = {
  strong: { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 },
  weak: { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 },
  brittle: { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 },
  tense: { threat: 14, willpower: 20, attack: 12, defense: 6, health: 100 },
} as const;

let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

export async function flightWorld(decks: FlightDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const dealt = campaignScenario(flight);
  const codes = [...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, flight), ...SHIP_CODES, ...ORIGINAL_SHIPS, ...flight.cards.map((card) => card.code), CODES.ominousFate, COUNSEL];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

const COUNSEL = "11184";

/** The log of a campaign whose first three parts were won: Ominous Fate and a Galdor's Counsel in the pool, the XP they gained, and marks on the ships, a Modification boon and the Counsel. */
export function afterRaid(seatCount: 1 | 2): CampaignLog {
  if (!LOADED) throw new Error("Build the world first (flightWorld)");
  const base = emptyLog(seatCount);
  return {
    ...base,
    completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens"],
    campaignPool: [poolCard(LOADED.get(CODES.ominousFate)!, CODES.ominousFate, null, null), poolCard(LOADED.get(COUNSEL)!, COUNSEL, null, 0)],
    xpGained: { "voyage-across-belegaer": 4, "the-fate-of-numenor": 3, "raid-on-the-grey-havens": 5 },
    marks: { "11080": 1, "11172": 2, [COUNSEL]: 3 },
  };
}

export function flightPlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) {
  if (!LOADED) throw new Error("Build the world first (flightWorld)");
  const plan = checklist({ log, scenario: campaignScenario(flight), seats: flightLoadout(seatCount), effects: EFFECTS, cards: LOADED });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function flightStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard): StartScenario {
  const plan = flightPlan(seatCount, log);
  return buildStart({
    campaign,
    scenario: flight,
    seatCount,
    seed,
    threatModifier: plan.threatModifier,
    seats: plan.seats,
    effects: EFFECTS,
    difficulty,
    poolEncounterCards: plan.poolEncounterCards,
    poolIntoPlay: plan.poolIntoPlay,
    ...(facts ? { facts } : {}),
    ...(modeCard ? { modeCard } : {}),
  });
}

export type FlightPolicy = {
  // "keep" or "trade": unused (the campaign card offers no trade of damage), kept so a golden names one policy shape with Voyage's.
  // "pass" or "ships" at the Sailing test (commit no one, or the ships that can sail).
  sail: "pass" | "ships";
  // Engage the Ship enemies in the optional engagement step ("ships"), or leave them in the staging area ("none").
  engage: "ships" | "none";
};
export const DEFAULT_POLICY: FlightPolicy = { sail: "pass", engage: "ships" };

// The auto-player's answer (scripts/auto-player.ts), except: the Sailing test commits no one or the ships; a trade of damage for a resource is answered as the policy says; in
// a player attack window every ready character that can attack the target attacks together (the Ship enemy with the least hit points left, else the first enemy it can reach);
// in the optional engagement step the seat engages one Ship enemy at a time; defense falls to the ships. Every intent is one the reducer listed.
export function flightIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FlightPolicy = DEFAULT_POLICY): PlayerIntent {
  if (askingToCommit(state)) {
    if (policy.sail === "ships") {
      const ships = legalTargets(state, { type: "Commit" }, ctx).filter((id) => SHIP_CODES.includes(state.cards[id]?.code ?? ""));
      if (ships.length > 0) return { type: "Commit", cardIds: ships };
    }
    return { type: "Pass" };
  }
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id) && !SHIP_CODES.includes(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  // Damage the players assign among their characters falls on the least wounded hero (the heroes are big numbers), never on a ship.
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => HEROES.includes(state.cards[option]?.code ?? ""));
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  // The ships defend; a seat without one falls to its least wounded hero.
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "optionalEngage" && policy.engage === "none") return { type: "DeclineEngage" };
  if (state.window?.kind === "optionalEngage") {
    const targets = legalTargets(state, { type: "Engage" }, ctx);
    const enemy = targets[0];
    const seat = state.seats[state.activeSeat];
    if (enemy && seat && seat.engaged.length < 2) return { type: "Engage", enemyId: enemy };
  }
  return nextIntent(state, ctx, FLIGHT_POLICY, memory, legalIntents(state, ctx));
}

export type FlightGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playFlight(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), policy: FlightPolicy = DEFAULT_POLICY, modeCard?: ModeCard, limit = 8000): FlightGame {
  const start = flightStart(seatCount, seed, difficulty, facts, log, modeCard);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = flightIntent(state, ctx, memory, policy);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}


// The goldens (src/campaign/golden-stormcaller.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `upgraded`: the cards the log marks as upgraded (the ships, the Modification boons, Black Key and Calaerion), dealt on their Upgraded side. `mode`: the Hard or Expert Mode card.
export type FlightGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FlightDecks; outcome: "won" | "lost"; policy?: Partial<FlightPolicy>; upgraded?: boolean; mode?: ModeCard; after?: boolean; lossReason?: string };

export const UPGRADED_CODES = [...SHIP_CODES, ...MODIFICATIONS, CODES.blackKey, CODES.calaerion];
const THREAT_LOST = "No seats remain";

// A win needs the players to catch up to the Stormcaller: the ships sail every round to bring the heading back on-course, and the Ship enemies stay in the staging area.
const SAIL: Partial<FlightPolicy> = { sail: "ships", engage: "none" };
const STORMCALLER_LOST = "The Stormcaller has defeated stage 4";
const SHIP_LOST = "Dream-chaser left play";

export const FLIGHT_GOLDENS: readonly FlightGolden[] = [
  { name: "true solo, won on stage 2B, on-course", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, Easy, won on stage 2B", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, won on stage 3B", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, won on stage 4B", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, after Raid on the Grey Havens, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, after: true },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, mode: "hard" },
  { name: "true solo, Upgraded ships, Modification boons, Black Key and Calaerion, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", policy: SAIL },
  { name: "two-handed, Expert Mode card, Upgraded cards, won on stage 3B", seatCount: 2, seed: 18, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL, mode: "expert", upgraded: true },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, weak, the Stormcaller defeats stage 4, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: STORMCALLER_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, the Dream-chaser destroyed, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: SAIL, lossReason: SHIP_LOST },
  { name: "two-handed, the Stormcaller defeats stage 4, lost", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "lost", policy: SAIL, lossReason: STORMCALLER_LOST },
  { name: "true solo, the Stormcaller defeats stage 4, lost", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: STORMCALLER_LOST },
];

export function playGolden(golden: FlightGolden, ctx: ReduceContext): FlightGame {
  const facts = golden.upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } : golden.after ? { prisoner: null, usedOnce: [], counters: {}, levels: { "11184": 3 } } : undefined;
  const log = golden.after ? afterRaid(golden.seatCount) : undefined;
  return playFlight(golden.seatCount, golden.seed, golden.difficulty, ctx, facts, log, { ...DEFAULT_POLICY, ...golden.policy }, golden.mode);
}
export { SHIP_LOST, STORMCALLER_LOST, THREAT_LOST };
