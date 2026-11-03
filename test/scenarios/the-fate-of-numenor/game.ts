import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../../src/campaign/log.ts";
import { buildStart } from "../../../src/campaign/start.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { campaign, CODES, fate } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { gameCodes } from "../../../scripts/data/load-scenarios.ts";
import { attackTogether, engageOneEach, FILLER, fillerCard, fillerLoadout, type PlayedGame, playToEnd } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Fate of Númenor in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to
// survive an attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to a location whenever they can
// and, when asked, trade no damage for threat and do not look at the facedown side of a Lost Island.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const FATE_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FateDecks = "strong" | "weak" | "brittle";

export const fateLoadout = fillerLoadout;

const STATS = {
  strong: { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 },
  weak: { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 },
  brittle: { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 },
} as const;

let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

export async function fateWorld(decks: FateDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const dealt = campaignScenario(fate);
  const codes = [...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, fate), CODES.calphonOriginal, CODES.ominousFate];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set(FILLER, fillerCard());
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

/** The log of a campaign whose first part was won: Voyage Across Belegaer completed, with the Ominous Fate it earned in the pool and XP gained that it has marked. */
export function afterVoyage(seatCount: 1 | 2): CampaignLog {
  if (!LOADED) throw new Error("Build the world first (fateWorld)");
  const base = emptyLog(seatCount);
  return { ...base, completed: ["voyage-across-belegaer"], campaignPool: [poolCard(LOADED.get(CODES.ominousFate)!, CODES.ominousFate, null, null)], xpGained: { "voyage-across-belegaer": 4 }, marks: { "11080": 1 } };
}

export function fatePlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) {
  if (!LOADED) throw new Error("Build the world first (fateWorld)");
  const plan = checklist({ log, scenario: campaignScenario(fate), seats: fateLoadout(seatCount), effects: EFFECTS, cards: LOADED });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function fateStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard): StartScenario {
  const plan = fatePlan(seatCount, log);
  return buildStart({
    campaign,
    scenario: fate,
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

export type FatePolicy = {
  // "keep" or "trade" 1 damage on each character in play for 1 threat.
  trade: "keep" | "trade";
  // Which option a Choose window with the Lush Jungle's two answers takes: exhaust the ready heroes, or let the location return to the staging area.
  jungle: "exhaust" | "return";
  // Look at the facedown side of a Lost Island whenever an Action or a Response offers it ("look"), or never ("none").
  peek: "look" | "none";
};
export const DEFAULT_POLICY: FatePolicy = { trade: "keep", jungle: "exhaust", peek: "none" };

// The auto-player's answer (test/harness/auto-player.ts), except: the trade of damage for threat is answered as the policy says; the heroes of a seat that has three quest together, the last one
// staying out when the table has the strength; the players travel to the first location they can; defense falls to the strongest hero. Every intent is one the reducer listed.
export function fateIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FatePolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.every((option) => option === "trade" || option === "keep")) return { type: "Choose", optionId: policy.trade };
  if (state.window?.kind === "choose" && state.window.options.includes(policy.jungle) && state.window.options.length === 2 && state.window.options.includes("return")) return { type: "Choose", optionId: policy.jungle };
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  const engaging = engageOneEach(state, ctx, 2);
  if (engaging) return engaging;
  return nextIntent(state, ctx, FATE_POLICY, memory, legalIntents(state, ctx));
}

export type FateGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playFate(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), policy: FatePolicy = DEFAULT_POLICY, modeCard?: ModeCard, limit = 8000): FateGame {
  const start = fateStart(seatCount, seed, difficulty, facts, log, modeCard);
  return playToEnd(start, ctx, (state, memory) => fateIntent(state, ctx, memory, policy), limit);
}

// The goldens (src/campaign/scenarios/the-fate-of-numenor/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `after`: the log of a campaign whose first part was won (the pool, XP and marks reach this part). `upgraded`: Calphon and Spyglass on their Upgraded sides. `mode`: the Hard or Expert Mode card.
export type FateGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FateDecks; outcome: "won" | "lost"; policy?: Partial<FatePolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

export const UPGRADED_CODES = [CODES.calphon, CODES.spyglass];
const THREAT_LOST = "No seats remain";

export const FATE_GOLDENS: readonly FateGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, after Voyage Across Belegaer, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, damage traded for threat, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { trade: "trade" } },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard" },
  { name: "true solo, Upgraded Calphon and Spyglass, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, the Lush Jungle returns to the staging area, won", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: { jungle: "return" } },
  { name: "two-handed, Easy, after Voyage Across Belegaer, won", seatCount: 2, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, Expert Mode card, Upgraded Calphon and Spyglass, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true, policy: { trade: "trade" } },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
];

export function playGolden(golden: FateGolden, ctx: ReduceContext): FateGame {
  const facts = golden.upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } : undefined;
  const log = golden.after ? afterVoyage(golden.seatCount) : undefined;
  return playFate(golden.seatCount, golden.seed, golden.difficulty, ctx, facts, log, { ...DEFAULT_POLICY, ...golden.policy }, golden.mode);
}
