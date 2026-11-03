import { buildStart } from "../src/campaign/start.ts";
import type { LoadoutSeat } from "../src/campaign/loadout.ts";
import { scenarioCards, type Difficulty } from "../src/catalog/scenario-data.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat/combat.ts";
import { expectOk } from "../src/rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../src/rules/core/printed.ts";
import type { EngineStep } from "../src/rules/core/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/engine/reduce.ts";
import type { StartScenario } from "../src/rules/setup/setup.ts";

import { nextIntent, type PolicyOptions } from "./auto-player.ts";
import { campaign, south } from "./south-scene.ts";
import { loadPrinted } from "./test-catalog.ts";

// Test helper. A whole game of The Ring Goes South played by the auto-player, true solo or two-handed. The loadouts are the ones the
// Flight to the Ford goldens use (scripts/ford-game.ts): the seeded starter decks with the saga Frodo as a fourth hero, or big-number
// heroes beside the saga Frodo and a deck of free events, so the outcome depends on the engine and the seed, not on card play.
export const RING_BEARER = "141001";
export const STRONG_HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const SOUTH_POLICY: PolicyOptions = { scout: "", prefer: "", protect: RING_BEARER, play: true, act: true };
// "strong": big-number heroes. "weak": heroes too small to quest, so the players lose on threat.
export type SouthDecks = "starter" | "strong" | "weak";

function starter(id: string): LoadoutSeat {
  const deck = campaign.starterDecks.find((entry) => entry.id === id);
  if (!deck) throw new Error(`No starter deck ${id}`);
  return {
    heroes: deck.rows.filter((row) => row.type === "hero").map((row) => row.code),
    deck: deck.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)),
  };
}

export function southLoadout(seatCount: 1 | 2, decks: SouthDecks = "starter"): LoadoutSeat[] {
  if (decks !== "starter") {
    const filler = Array.from({ length: 30 }, () => "filler");
    const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: filler };
    return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
  }
  const stealth = starter("stealth-and-steadfastness");
  const first = { heroes: [RING_BEARER, ...stealth.heroes], deck: stealth.deck };
  return seatCount === 1 ? [first] : [first, starter("wisdom-and-wizardry")];
}

const WEAK_STATS = { threat: 8, willpower: 0, attack: 0, defense: 0, health: 100 } as const;
const STRONG_STATS = { threat: 8, willpower: 20, attack: 12, defense: 6, health: 100 } as const;

export async function southWorld(decks: SouthDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [
    ...scenarioCards(south).map((card) => card.code),
    ...south.campaignPlaced,
    south.campaignCard,
    ...campaign.prelude.map((card) => card.code),
    ...southLoadout(2).flatMap((seat) => [...seat.heroes, ...seat.deck]),
  ];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of STRONG_HEROES) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", ...(decks === "weak" ? WEAK_STATS : STRONG_STATS) }));
  }
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function southStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty, decks: SouthDecks = "starter"): StartScenario {
  return buildStart({ campaign, scenario: south, seatCount, seed, threatModifier: 0, seats: southLoadout(seatCount, decks), effects: EFFECTS, difficulty });
}

// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set([RING_BEARER, "q1", "q2", "q4", "q5"]);

// The auto-player's answer (scripts/auto-player.ts), except where the auto-player alone always declines: in a player attack window
// every ready character that can attack the first enemy it can reach attacks it together, and in the optional engagement step the
// seat engages one enemy at a time. Every intent is one the reducer listed.
export function southIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => state.cards[id]?.code !== RING_BEARER && legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const enemy = ready.map((id) => legalAttackEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
    const attackers = ready.filter((id) => enemy != null && legalAttackEnemies(state, seat, id, ctx.cards).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded strong hero (or the location a shadow
  // card names).
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // A choice among cards (Redhorn Pass's damage, the faceup cards): never the Ring-bearer.
  if (state.window?.kind === "choose") {
    const other = state.window.options.find((id) => state.cards[id] != null && state.cards[id]?.code !== RING_BEARER);
    if (other) return { type: "Choose", optionId: other };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    if (enemy && seat && seat.engaged.length < seat.heroes.length) return { type: "Engage", enemyId: enemy };
  }
  return nextIntent(state, ctx, SOUTH_POLICY, memory);
}

export type SouthGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playSouth(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, decks: SouthDecks = "starter", limit = 8000): SouthGame {
  const start = southStart(seatCount, seed, difficulty, decks);
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = southIntent(state, ctx, memory);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
  }
  return { start, kept, state, intents, steps };
}

// The goldens (src/campaign/golden-south.test.ts), also played by the causes and replay tests. A win runs the campaign card's
// Resolution; a loss writes nothing.
export type SouthGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: SouthDecks; outcome: "won" | "lost"; lossReason?: string };

const DOORS = "Doors of Durin holds";

export const SOUTH_GOLDENS: readonly SouthGolden[] = [
  { name: "true solo, strong, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, strong, won", seatCount: 2, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, strong, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, strong, lost on Doors of Durin", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: DOORS },
  { name: "two-handed, strong, lost on Doors of Durin", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: DOORS },
  { name: "true solo, starter decks, lost with the One Ring", seatCount: 1, seed: 1, difficulty: "Normal", decks: "starter", outcome: "lost", lossReason: "The One Ring left play" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
];

export function playGolden(golden: SouthGolden, ctx: ReduceContext): SouthGame {
  return playSouth(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.decks);
}
