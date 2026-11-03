import { checklist } from "../src/campaign/checklist.ts";
import { emptyLog, poolCard, type CampaignLog } from "../src/campaign/log.ts";
import { buildStart } from "../src/campaign/start.ts";
import type { LoadoutSeat } from "../src/campaign/loadout.ts";
import { campaignScenario, type Difficulty } from "../src/catalog/scenario-data.ts";
import { EFFECTS } from "../src/effects/index.ts";
import type { CampaignFacts, ModeCard } from "../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat/combat.ts";
import { expectOk } from "../src/rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../src/rules/core/printed.ts";
import type { EngineStep } from "../src/rules/core/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/engine/reduce.ts";
import type { StartScenario } from "../src/rules/setup/setup.ts";

import { campaign, CODES, depths } from "./depths-scene.ts";
import { nextIntent, type PolicyOptions } from "./auto-player.ts";
import { loadPrinted } from "./test-catalog.ts";
import { gameCodes } from "./data/load-scenarios.ts";

// Test helper. A whole game of The Thing in the Depths in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an
// attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to Helm of the Stormcaller first, then to a location whenever
// they can, engage and attack whatever the engine lets them, answer the choices (the location a Grapple keyword picks among, Come Together's player) with the first option, and let the first hero defend.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const DEPTHS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DepthsDecks = "strong" | "weak" | "brittle";

export function depthsLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: ["q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

const STATS = {
  strong: { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 },
  weak: { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 },
  brittle: { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 },
} as const;

let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

export async function depthsWorld(decks: DepthsDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const dealt = campaignScenario(depths);
  const codes = [...dealt.cards.map((card) => card.code), ...dealt.campaignPlaced, dealt.campaignCard, ...gameCodes(campaign, depths), ...depths.cards.map((card) => card.code), CODES.ominousFate, CODES.sahirAlly, CODES.naasiyahAlly, CODES.thingOriginal];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

/** The log of a campaign whose first four parts were won: Ominous Fate in the pool and the XP they gained, marked on a Galdor's Counsel and the Dream-chaser. */
export function afterFlight(seatCount: 1 | 2): CampaignLog {
  if (!LOADED) throw new Error("Build the world first (depthsWorld)");
  const base = emptyLog(seatCount);
  return {
    ...base,
    completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller"],
    campaignPool: [poolCard(LOADED.get(CODES.ominousFate)!, CODES.ominousFate, null, null)],
    xpGained: { "voyage-across-belegaer": 4, "the-fate-of-numenor": 3, "raid-on-the-grey-havens": 5, "flight-of-the-stormcaller": 4 },
    marks: { "11080": 1, "11172": 2, "11184": 3 },
  };
}

export function depthsPlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) {
  if (!LOADED) throw new Error("Build the world first (depthsWorld)");
  const plan = checklist({ log, scenario: campaignScenario(depths), seats: depthsLoadout(seatCount), effects: EFFECTS, cards: LOADED });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function depthsStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard): StartScenario {
  const plan = depthsPlan(seatCount, log);
  return buildStart({
    campaign,
    scenario: depths,
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

export type DepthsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: DepthsPolicy = { choose: "first" };

// The auto-player's answer (scripts/auto-player.ts), except: the heroes of a seat that has three quest together, the last one staying out when the table has the strength; the players travel to Helm of the Stormcaller
// first and to the first location they can after it; defense falls to the strongest hero; a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function depthsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DepthsPolicy = DEFAULT_POLICY): PlayerIntent {
  // A choice among cards (the character a Grasping Arm exhausts, the location a Grapple keyword picks) takes the last option; any other takes the first, or the last as the policy says.
  if (state.window?.kind === "choose" && (policy.choose === "last" || state.window.options.every((option) => state.cards[option] != null))) return { type: "Choose", optionId: state.window.options.at(-1) ?? "" };
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      // The objective allies stay home with the last hero: they attack, and a Grasping Arm exhausts the last ready character of the list.
      const questers = ids.filter((id) => !home.includes(id) && HEROES.includes(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  if (state.window?.kind === "travel" && legalIntents(state, ctx).some((intent) => intent.type === "Travel")) {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const helm = targets.find((id) => state.cards[id]?.code === CODES.helm);
    if (helm) return { type: "Travel", locationId: helm };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
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
  return nextIntent(state, ctx, DEPTHS_POLICY, memory, legalIntents(state, ctx));
}

export type DepthsGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playDepths(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), policy: DepthsPolicy = DEFAULT_POLICY, modeCard?: ModeCard, limit = 6000): DepthsGame {
  const start = depthsStart(seatCount, seed, difficulty, facts, log, modeCard);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = depthsIntent(state, ctx, memory, policy);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}

// The goldens (src/campaign/golden-depths.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `after`: the log of a campaign whose first four parts were won (the pool, XP and marks reach this part). `upgraded`: the Upgraded sides (Black Key, Come Together's level). `mode`: the Hard or Expert Mode card.
export type DepthsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DepthsDecks; outcome: "won" | "lost"; policy?: Partial<DepthsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

export const UPGRADED_CODES = [CODES.blackKey, CODES.blackKeyBurden];
const THREAT_LOST = "No seats remain";
const STORMCALLER_LOST = "The Stormcaller was destroyed";
const SAHIR_LOST = "Captain Sahír left play";
const NAASIYAH_LOST = "Na'asiyah left play";

export const DEPTHS_GOLDENS: readonly DepthsGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, after Flight of the Stormcaller, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard" },
  { name: "true solo, Upgraded Black Keys and Come Together, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, after Flight of the Stormcaller, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, Expert Mode card, Upgraded Black Keys, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true },
  { name: "true solo, lost on threat with the arms engaged", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, Easy, Na'asiyah destroyed, lost", seatCount: 1, seed: 7, difficulty: "Easy", decks: "strong", outcome: "lost", lossReason: NAASIYAH_LOST },
  { name: "two-handed, a Ship location reaches 9 Threat, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: STORMCALLER_LOST },
  { name: "two-handed, Easy, Captain Sahír destroyed, lost", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "lost", lossReason: SAHIR_LOST },
  { name: "two-handed, Na'asiyah destroyed, lost", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: NAASIYAH_LOST },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
];

export function playGolden(golden: DepthsGolden, ctx: ReduceContext): DepthsGame {
  const facts = golden.upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } : golden.after ? { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.comeTogether]: 2 } } : undefined;
  const log = golden.after ? afterFlight(golden.seatCount) : undefined;
  return playDepths(golden.seatCount, golden.seed, golden.difficulty, ctx, facts, log, { ...DEFAULT_POLICY, ...golden.policy }, golden.mode);
}
export { NAASIYAH_LOST, SAHIR_LOST, STORMCALLER_LOST, THREAT_LOST };
