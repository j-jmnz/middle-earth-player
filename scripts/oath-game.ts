import { checklist } from "../src/campaign/checklist.ts";
import { emptyLog, type CampaignLog } from "../src/campaign/log.ts";
import { buildStart } from "../src/campaign/start.ts";
import type { LoadoutSeat } from "../src/campaign/loadout.ts";
import { scenarioCards, type Difficulty } from "../src/catalog/scenario-data.ts";
import { EFFECTS } from "../src/effects/index.ts";
import type { CampaignFacts } from "../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat/combat.ts";
import { expectOk } from "../src/rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../src/rules/core/printed.ts";
import type { EngineStep } from "../src/rules/core/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/engine/reduce.ts";
import type { StartScenario } from "../src/rules/setup/setup.ts";

import { ADAPTATIONS, campaign, oath } from "./oath-scene.ts";
import { nextIntent, type PolicyOptions } from "./auto-player.ts";
import { loadPrinted } from "./test-catalog.ts";

// Test helper. A whole game of The Oath in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small
// to quest, or too brittle to survive an attack), and the decks free events, so the outcome depends on the engine, the seed and the encounter deck,
// not on player card play. Each seat chooses an Adaptation boon at the Campaign Setup Checklist and attaches it to its first hero; the Stalking
// Goblin burden is shuffled into the encounter deck. The Oath's Response (a token at the end of each round) is taken or declined by the golden.
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const OATH_POLICY: PolicyOptions = { scout: "", prefer: "41014", protect: "", play: true, act: true };
// "strong": big-number heroes. "steady": heroes that quest for little, so the scenario takes many rounds. "weak": heroes too small to quest, so the
// players lose on threat. "brittle": strong quest and attack with a few hit points and no Defense, so an enemy's attack destroys a hero.
export type OathDecks = "strong" | "steady" | "weak" | "brittle";

export function oathLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: ["q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

const WEAK_STATS = { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 } as const;
const STRONG_STATS = { threat: 3, willpower: 20, attack: 12, defense: 6, health: 100 } as const;
const STEADY_STATS = { threat: 3, willpower: 6, attack: 12, defense: 6, health: 100 } as const;
const BRITTLE_STATS = { threat: 3, willpower: 20, attack: 12, defense: 0, health: 7 } as const;
const STATS = { strong: STRONG_STATS, steady: STEADY_STATS, weak: WEAK_STATS, brittle: BRITTLE_STATS } as const;

export async function oathWorld(decks: OathDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(oath).map((card) => card.code), ...oath.campaignPlaced, oath.campaignCard, ...ADAPTATIONS];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...STATS[decks] }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  LOADED = cards;
  return { cards, ctx: { effects: EFFECTS, cards } };
}

// The cards of the last world built: the checklist reads the pool cards' printed data.
let LOADED: ReadonlyMap<string, PrintedCard> | null = null;

// The Adaptation each seat chooses at the checklist, in seat order (the first seat's first hero carries its card, then the second seat's).
export type Adaptations = readonly (typeof ADAPTATIONS)[number][];
export const DEFAULT_ADAPTATIONS: Adaptations = ["41044", "41045"];

export function oathChoices(seatCount: 1 | 2, adaptations: Adaptations = DEFAULT_ADAPTATIONS): string[] {
  return Array.from({ length: seatCount }, (_, seat) => `${adaptations[seat] ?? "41044"}>${seat === 0 ? "q1" : "q4"}`);
}

// The scenario dealt through the Campaign Setup Checklist: each seat's chosen Adaptation goes on its first hero, Stalking Goblin joins the encounter deck
// and the pool a log carries is dealt with it.
export function oathPlan(seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), adaptations: Adaptations = DEFAULT_ADAPTATIONS) {
  if (!LOADED) throw new Error("Build the world first (oathWorld)");
  const plan = checklist({ log, scenario: oath, seats: oathLoadout(seatCount), effects: EFFECTS, cards: LOADED, choices: oathChoices(seatCount, adaptations) });
  if (!plan.ok) throw new Error(plan.errors.join("; ") || "The campaign card asks for a choice");
  return plan;
}

export function oathStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: CampaignFacts, log: CampaignLog = emptyLog(seatCount), adaptations: Adaptations = DEFAULT_ADAPTATIONS): StartScenario {
  const plan = oathPlan(seatCount, log, adaptations);
  return buildStart({
    campaign,
    scenario: oath,
    seatCount,
    seed,
    threatModifier: plan.threatModifier,
    seats: plan.seats,
    effects: EFFECTS,
    difficulty,
    poolEncounterCards: plan.poolEncounterCards,
    poolIntoPlay: plan.poolIntoPlay,
    ...(facts ? { facts } : {}),
  });
}

// What the policy does besides the auto-player's answer: `tokens` says whether the players place The Oath's resource token at the end of each round.
export type OathPolicy = { tokens: "take" | "skip" };

// The auto-player's answer (scripts/auto-player.ts), except where the auto-player alone always declines: in a player attack window every ready
// character that can attack the first enemy it can reach attacks it together, and in the optional engagement step the seat engages one enemy at a
// time. Every intent is one the reducer listed.
export function oathIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: OathPolicy = { tokens: "take" }): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-2) : heroes.length === 2 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const enemy = ready.map((id) => legalAttackEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
    const attackers = ready.filter((id) => enemy != null && legalAttackEnemies(state, seat, id, ctx.cards).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  // A choice among heroes (the hero a card picks): the least wounded one.
  if (state.window?.kind === "choose" && state.window.options.length > 1 && state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
    const options = [...state.window.options].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0));
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  // A search for a Forest location (stage 2B): Goblin Trail, which the second stage cannot be defeated without.
  if (state.window?.kind === "choose" && state.window.options.length > 1) {
    const trail = state.window.options.find((id) => state.cards[id]?.code === "41014");
    if (trail) return { type: "Choose", optionId: trail };
  }
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    if (enemy && seat && seat.engaged.length < seat.heroes.length) return { type: "Engage", enemyId: enemy };
  }
  // The Oath's Response: placed when the golden takes the token, passed when it declines.
  const refused = policy.tokens === "skip" && state.window?.kind === "response";
  const intents = legalIntents(state, ctx).filter((intent) => !(refused && intent.type === "Trigger" && intent.effectId === "41050:response:1"));
  return nextIntent(state, ctx, OATH_POLICY, memory, intents);
}

export type OathGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playOath(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, facts?: CampaignFacts, policy: OathPolicy = { tokens: "take" }, adaptations: Adaptations = DEFAULT_ADAPTATIONS, limit = 8000): OathGame {
  const start = oathStart(seatCount, seed, difficulty, facts, emptyLog(seatCount), adaptations);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = oathIntent(state, ctx, memory, policy);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}

// The goldens (src/campaign/golden-oath.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution; a loss writes
// nothing.
export type OathGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: OathDecks; outcome: "won" | "lost"; tokens?: "take" | "skip"; adaptations?: Adaptations; facts?: CampaignFacts; lossReason?: string };

const THREAT_LOST = "No seats remain";
// The Fervor of Lore was used in an earlier scenario of the campaign: the Campaign Log's `usedOnce` fact.
const FERVOR_USED: CampaignFacts = { prisoner: null, usedOnce: ["41044"], counters: {} };

export const OATH_GOLDENS: readonly OathGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, the Fervor of Lore already used, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", facts: FERVOR_USED },
  { name: "true solo, steady heroes, 6 tokens placed, won with Guilty Conscience", seatCount: 1, seed: 1, difficulty: "Normal", decks: "steady", outcome: "won" },
  { name: "true solo, steady heroes, tokens declined, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "steady", outcome: "won", tokens: "skip" },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", adaptations: ["41046", "41047"] },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, steady heroes, 6 tokens placed, won with Guilty Conscience", seatCount: 2, seed: 3, difficulty: "Normal", decks: "steady", outcome: "won" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, steady heroes, lost", seatCount: 1, seed: 2, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, steady heroes, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "steady", outcome: "lost", lossReason: THREAT_LOST },
];

export function playGolden(golden: OathGolden, ctx: ReduceContext): OathGame {
  return playOath(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.facts, { tokens: golden.tokens ?? "take" }, golden.adaptations);
}
