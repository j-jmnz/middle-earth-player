import { buildStart } from "../../../src/campaign/start.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { scenarioCards, type Difficulty } from "../../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { anduin, campaign } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { loadPrinted } from "../../harness/catalog.ts";

// Test helper. A whole game of Journey Along the Anduin in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are
// big numbers (or too small to quest), and the decks free events, so the outcome depends on the engine, the seed and the encounter deck,
// not on player card play. Mendor is put into play by the campaign card's Setup; Valor and Scarred are set aside by it; no saga setup runs.
export const STRONG_HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const ANDUIN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: true };
// "strong": big-number heroes. "weak": heroes too small to quest, so the players lose on threat. "brittle": strong quest and attack with 3 hit
// points and no Defense, so a Hill Troll's attack destroys a hero (Scarred, a prisoner chosen among the heroes left).
export type AnduinDecks = "strong" | "weak" | "brittle";

export function anduinLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: ["q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

const WEAK_STATS = { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 } as const;
const STRONG_STATS = { threat: 8, willpower: 20, attack: 12, defense: 6, health: 100 } as const;
const BRITTLE_STATS = { threat: 8, willpower: 20, attack: 12, defense: 0, health: 7 } as const;

export async function anduinWorld(decks: AnduinDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(anduin).map((card) => card.code), ...anduin.campaignPlaced, anduin.campaignCard];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of STRONG_HEROES) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...(decks === "weak" ? WEAK_STATS : decks === "brittle" ? BRITTLE_STATS : STRONG_STATS) }));
  }
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function anduinStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty): StartScenario {
  return buildStart({ campaign, scenario: anduin, seatCount, seed, threatModifier: 0, seats: anduinLoadout(seatCount), effects: EFFECTS, difficulty });
}

// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set(["q1", "q2", "q4", "q5"]);

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack window
// every ready character that can attack the first enemy it can reach attacks it together, and in the optional engagement step the
// seat engages one enemy at a time. Every intent is one the reducer listed.
export function anduinIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
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
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded hero.
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    if (enemy && seat && seat.engaged.length < seat.heroes.length) return { type: "Engage", enemyId: enemy };
  }
  return nextIntent(state, ctx, ANDUIN_POLICY, memory);
}

export type AnduinGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playAnduin(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, limit = 8000): AnduinGame {
  const start = anduinStart(seatCount, seed, difficulty);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = anduinIntent(state, ctx, memory);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}

// The goldens (src/campaign/scenarios/journey-along-the-anduin/golden.test.ts), also played by the causes and replay tests. A win runs the campaign card's Resolution; a
// loss writes nothing.
export type AnduinGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: AnduinDecks; outcome: "won" | "lost"; lossReason?: string };

const MENDOR_LOST = "Mendor left play";
const THREAT_LOST = "No seats remain";

export const ANDUIN_GOLDENS: readonly AnduinGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, brittle heroes, won after a hero was lost", seatCount: 1, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "won" },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, won", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "two-handed, brittle heroes, won with a Valor and a Scarred", seatCount: 2, seed: 20, difficulty: "Normal", decks: "brittle", outcome: "won" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, brittle heroes, lost when Mendor leaves play", seatCount: 2, seed: 4, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: MENDOR_LOST },
];

export function playGolden(golden: AnduinGolden, ctx: ReduceContext): AnduinGame {
  return playAnduin(golden.seatCount, golden.seed, golden.difficulty, ctx);
}
