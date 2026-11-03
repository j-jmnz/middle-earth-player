import { checklist } from "../../../src/campaign/checklist.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../../src/campaign/log.ts";
import { buildStart } from "../../../src/campaign/start.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { campaignScenario, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { campaign, CODES, raid } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";
import { gameCodes } from "../../../scripts/data/load-scenarios.ts";

// Test helper. A whole game of Raid on the Grey Havens in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an
// attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to a location whenever they can, attack whatever the
// engine lets them attack, answer the Campaign Setup's offer of a Galdor's Counsel as the policy says, and (the tied Aflame locations and the damage to heal) take the first option.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const RAID_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type RaidDecks = "strong" | "weak" | "brittle";

export function raidLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: ["q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

const STATS = {
  strong: { threat: 3, willpower: 20, attack: 40, defense: 6, health: 100 },
  weak: { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 },
  brittle: { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 },
} as const;

let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

export async function raidWorld(decks: RaidDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const dealt = campaignScenario(raid);
  const codes = [...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, raid), CODES.ominousFate, CODES.sahirAlly, CODES.naasiyahAlly, "11080", "11081", "11082", "11083"];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

/** The log of a campaign whose first two parts were won: Ominous Fate in the pool and the XP they gained, marked on Galdor's Counsel and the Dream-chaser's Spyglass. */
export function afterFate(seatCount: 1 | 2): CampaignLog {
  if (!LOADED) throw new Error("Build the world first (raidWorld)");
  const base = emptyLog(seatCount);
  return { ...base, completed: ["voyage-across-belegaer", "the-fate-of-numenor"], campaignPool: [poolCard(LOADED.get(CODES.ominousFate)!, CODES.ominousFate, null, null)], xpGained: { "voyage-across-belegaer": 4, "the-fate-of-numenor": 3 }, marks: { "11080": 1, [CODES.counselLeadership]: 3, [CODES.counselTactics]: 1 } };
}

/** What each seat answers when the Campaign Setup offers a Galdor's Counsel: the code it takes, or "skip". */
export type CounselChoice = readonly string[];
const NO_COUNSEL: CounselChoice = ["skip", "skip"];

export function raidPlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), counsel: CounselChoice = NO_COUNSEL) {
  if (!LOADED) throw new Error("Build the world first (raidWorld)");
  const plan = checklist({ log, scenario: campaignScenario(raid), seats: raidLoadout(seatCount), effects: EFFECTS, cards: LOADED, choices: counsel.slice(0, seatCount) });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function raidStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, counsel: CounselChoice = NO_COUNSEL): StartScenario {
  const plan = raidPlan(seatCount, log, counsel);
  return buildStart({
    campaign,
    scenario: raid,
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

export type RaidPolicy = {
  // The option a Choose window with these answers takes: "damage" or "search" (Corsair Arsonist), "damage" or "discard" (Pillaged Ship), "character" or "location" (Put to the Torch).
  burn: "first" | "last";
};
export const DEFAULT_POLICY: RaidPolicy = { burn: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: the heroes of a seat that has three quest together, the last one staying out when the table has the strength; the players travel to the first
// location they can; defense falls to the strongest hero; a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function raidIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RaidPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose" && policy.burn === "last") return { type: "Choose", optionId: state.window.options.at(-1) ?? "" };
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    // Graxar can be attacked by one character each round: the first alone.
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: ctx.cards.get(state.cards[enemy]?.code ?? "")?.name === "Graxar" ? attackers.slice(0, 1) : attackers };
  }
  // Nobody defends: the home hero stays ready to attack, and the heroes have the hit points to take what comes undefended.
  if (state.window?.kind === "defense") {
    const target = legalTargets(state, { type: "Undefended" }, ctx)[0];
    if (target) return { type: "Undefended", heroId: target };
  }
  if (state.window?.kind === "optionalEngage") {
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    const seat = state.seats[state.activeSeat];
    if (enemy && seat && seat.engaged.length < 2) return { type: "Engage", enemyId: enemy };
  }
  return nextIntent(state, ctx, RAID_POLICY, memory, legalIntents(state, ctx));
}

export type RaidGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playRaid(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), policy: RaidPolicy = DEFAULT_POLICY, modeCard?: ModeCard, counsel: CounselChoice = NO_COUNSEL, limit = 8000): RaidGame {
  const start = raidStart(seatCount, seed, difficulty, facts, log, modeCard, counsel);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = raidIntent(state, ctx, memory, policy);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}

// The goldens (src/campaign/golden-raid.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `after`: the log of a campaign whose first two parts were won (the pool, XP and marks reach this part). `upgraded`: the Upgraded sides (Calphon, Spyglass, Black Key). `counsel`: what each seat takes at the Campaign Setup.
export type RaidGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RaidDecks; outcome: "won" | "lost"; policy?: Partial<RaidPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; counsel?: CounselChoice; lossReason?: string };

export const UPGRADED_CODES = [CODES.calphon, CODES.spyglass, CODES.blackKey];
const THREAT_LOST = "No seats remain";
const FLEET_LOST = "The Corsairs have destroyed the Elven fleet";
const DREAM_CHASER_LOST = "The Dream-chaser was placed underneath The Havens Burn";

export const RAID_GOLDENS: readonly RaidGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, a Galdor's Counsel (Spirit) taken, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", counsel: [CODES.counselSpirit] },
  { name: "true solo, after The Fate of Númenor, a Galdor's Counsel (Leadership) taken, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true, counsel: [CODES.counselLeadership] },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { burn: "last" } },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard" },
  { name: "true solo, Upgraded Calphon, Spyglass and Black Key, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, a Galdor's Counsel each (Leadership and Tactics), won", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", counsel: [CODES.counselLeadership, CODES.counselTactics] },
  { name: "two-handed, Easy, after The Fate of Númenor, won", seatCount: 2, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won", after: true, counsel: [CODES.counselLore, "skip"] },
  { name: "two-handed, Expert Mode card, Upgraded Calphon, Spyglass and Black Key, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true, policy: { burn: "last" } },
  { name: "true solo, weak, lost when the Dream-chaser burns", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: DREAM_CHASER_LOST },
  { name: "true solo, weak, lost with four cards underneath The Havens Burn", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: FLEET_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, brittle heroes, lost", seatCount: 2, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
];

export function playGolden(golden: RaidGolden, ctx: ReduceContext): RaidGame {
  const facts = golden.upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } : golden.after ? { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.counselLeadership]: 3, [CODES.counselTactics]: 1 } } : undefined;
  const log = golden.after ? afterFate(golden.seatCount) : undefined;
  return playRaid(golden.seatCount, golden.seed, golden.difficulty, ctx, facts, log, { ...DEFAULT_POLICY, ...golden.policy }, golden.mode, golden.counsel);
}
export { DREAM_CHASER_LOST, FLEET_LOST, THREAT_LOST };
