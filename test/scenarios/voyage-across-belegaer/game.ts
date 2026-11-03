import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import { buildStart } from "../../../src/campaign/start.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts , ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import { askingToCommit } from "../../../src/rules/families/sea/sailing-legal.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { campaign, ORIGINAL_SHIPS, SHIP_CODES, voyage } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { gameCodes } from "../../../scripts/data/load-scenarios.ts";

// Test helper. A whole game of Voyage Across Belegaer in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small
// to quest, or too brittle to survive an attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play.
// Each player takes a ship (the first option each choice offers), fits the Modification boon the choice offers first, and keeps or trades the damage on it as the policy
// says; the Sailing test commits no one or the Dream-chaser, as the policy says. Ships defend, the heroes attack the Ship enemies.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const VOYAGE_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type VoyageDecks = "strong" | "weak" | "brittle" | "tense";

export function voyageLoadout(seatCount: 1 | 2): LoadoutSeat[] {
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

export async function voyageWorld(decks: VoyageDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const dealt = campaignScenario(voyage);
  const codes = [...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, voyage), ...SHIP_CODES, ...ORIGINAL_SHIPS];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function voyagePlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) {
  if (!LOADED) throw new Error("Build the world first (voyageWorld)");
  const plan = checklist({ log, scenario: campaignScenario(voyage), seats: voyageLoadout(seatCount), effects: EFFECTS, cards: LOADED });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function voyageStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard): StartScenario {
  const plan = voyagePlan(seatCount, log);
  return buildStart({
    campaign,
    scenario: voyage,
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

export type VoyagePolicy = {
  // "keep" or "trade" 2 damage on each ship for a resource; "pass" or "ship" at the Sailing test (commit no one, or the ships that can sail).
  trade: "keep" | "trade";
  sail: "pass" | "ships";
  // Engage the Ship enemies in the optional engagement step ("ships"), or leave them in the staging area ("none").
  engage: "ships" | "none";
  // Choose Corsair Pursuit (stage 3) whenever the defeated stage offers it ("early"), or the first stage offered ("first").
  stage: "early" | "first";
};
export const DEFAULT_POLICY: VoyagePolicy = { trade: "keep", sail: "pass", engage: "ships", stage: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: the Sailing test commits no one or the ships; a trade of damage for a resource is answered as the policy says; in
// a player attack window every ready character that can attack the target attacks together (the Ship enemy with the least hit points left, else the first enemy it can reach);
// in the optional engagement step the seat engages one Ship enemy at a time; defense falls to the ships. Every intent is one the reducer listed.
export function voyageIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: VoyagePolicy = DEFAULT_POLICY): PlayerIntent {
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
  if (state.window?.kind === "choose" && state.window.options.every((option) => option === "trade" || option === "keep")) return { type: "Choose", optionId: policy.trade };
  // Damage the players assign among their characters falls on the least wounded hero (the heroes are big numbers), never on a ship.
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => HEROES.includes(state.cards[option]?.code ?? ""));
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  // The stage the quest advances to: Corsair Pursuit when it is offered and the policy wants it.
  if (state.window?.kind === "choose" && policy.stage === "early") {
    const pursuit = state.window.options.find((option) => state.cards[option]?.code === "11021");
    if (pursuit) return { type: "Choose", optionId: pursuit };
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
  return nextIntent(state, ctx, VOYAGE_POLICY, memory, legalIntents(state, ctx));
}

export type VoyageGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playVoyage(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), policy: VoyagePolicy = DEFAULT_POLICY, modeCard?: ModeCard, limit = 8000): VoyageGame {
  const start = voyageStart(seatCount, seed, difficulty, facts, log, modeCard);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = voyageIntent(state, ctx, memory, policy);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}


// The goldens (src/campaign/scenarios/voyage-across-belegaer/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `upgraded`: the cards the log marks as upgraded (the ships and the Modification boons), dealt on their Upgraded side. `mode`: the Hard or Expert Mode card.
export type VoyageGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: VoyageDecks; outcome: "won" | "lost"; policy?: Partial<VoyagePolicy>; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

export const UPGRADED_CODES = [...SHIP_CODES, "11172", "11173", "11174", "11175"];
const THREAT_LOST = "No seats remain";

// A win needs Corsair Pursuit won on-course (Sun) or with no Ship enemy in play: the ships sail every round to bring the heading back, and the quest takes stage 3 as soon as the
// defeated stage offers it (only on-course, as the card says) while the Ship enemies stay in the staging area.
const SAIL: Partial<VoyagePolicy> = { sail: "ships", stage: "early", engage: "none" };
const FIGHT: Partial<VoyagePolicy> = { sail: "ships", stage: "first", engage: "ships" };

export const VOYAGE_GOLDENS: readonly VoyageGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", policy: SAIL },
  { name: "true solo, the ships fight the Ship enemies they engage, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: FIGHT },
  { name: "true solo, the ships trade damage for resources, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { ...SAIL, trade: "trade" } },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard", policy: SAIL },
  { name: "true solo, Upgraded ships and boons, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", upgraded: true, policy: SAIL },
  { name: "two-handed, won", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL },
  { name: "two-handed, the ships fight the Ship enemies they engage, won", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won", policy: FIGHT },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won", policy: SAIL },
  { name: "two-handed, Expert Mode card, Upgraded ships and boons, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true, policy: { ...SAIL, trade: "trade" } },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, the Dream-chaser destroyed, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Dream-chaser", policy: { sail: "pass", engage: "ships" } },
];

export function playGolden(golden: VoyageGolden, ctx: ReduceContext): VoyageGame {
  const facts = golden.upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } : undefined;
  return playVoyage(golden.seatCount, golden.seed, golden.difficulty, ctx, facts, undefined, { ...DEFAULT_POLICY, ...golden.policy }, golden.mode);
}
