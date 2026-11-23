import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { LegalIntent } from "../../../src/rules/core/intents.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, triggerPayments, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("the-hobbit");
const spiders = loadAnyScenario("flies-and-spiders");

// Test helper. A whole standalone game of Flies and Spiders played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on the player cards. The players act as a careful player does where the scenario asks (the policy's `careful`). There is no campaign: no checklist, no log, no earlier part, no Resolution. Bilbo Baggins is dealt as the loadout deals him (hob.bilbo-baggins-otd) and the players
// keep him out of every defense and take the first option of every choice (every player shuffles in a Ring, discards go first).
export const SPIDERS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "132001", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type SpidersDecks = "strong" | "weak" | "brittle";

// The seats as the loadout deals them: Bilbo Baggins (132001) in front of the first seat's heroes (hob.bilbo-baggins-otd), his own deck beside the filler events (src/campaign/briefing.ts, loadoutOf).
// The Spider enemies the golden decks meet attack the stand-in heroes, so the filler decks are what the players draw.
export const BILBO = "132001";
export function spidersLoadout(seatCount: 1 | 2) {
  const [first, ...rest] = fillerLoadout(seatCount);
  return [{ ...first!, heroes: [BILBO, ...first!.heroes] }, ...rest];
}

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const spidersWorld = (decks: SpidersDecks = "strong") => game.world(decks);
export const spidersStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type SpidersPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // A careful player: puts a Ring on Bilbo, uses its Action for Baggins resources while the threat is low and spends 2 of them to ready an unconscious character at stages 3 and 4 (132069:B:3, 132070:B:3).
  careful: boolean;
};
export const DEFAULT_POLICY: SpidersPolicy = { choose: "first", careful: true };
// The Ring's Action stops at this threat: the player keeps clear of the elimination level (50).
const RING_THREAT_LIMIT = 40;
const READY_ACTIONS = new Set(["132069:action:1", "132070:action:1"]);

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function spidersIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: SpidersPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  const intents = legalIntents(state, ctx);
  if (policy.careful && state.window?.kind === "pass") {
    const careful = carefulIntent(state, ctx, intents);
    if (careful) return careful;
  }
  return nextIntent(state, ctx, SPIDERS_POLICY, memory, intents);
}

// What a careful player does in a pass window before the policy's pass: the Ring onto Bilbo, the Ring's Action, the stage's Action to ready a character.
function carefulIntent(state: ScenarioState, ctx: ReduceContext, intents: readonly LegalIntent[]): PlayerIntent | null {
  const seat = state.seats[state.activeSeat];
  for (const intent of intents) {
    if (intent.type === "PlayCard" && state.cards[intent.cardId]?.code === "132019") {
      const host = legalTargets(state, { type: "PlayCard", cardId: intent.cardId }, ctx)[0];
      if (host) return { type: "PlayCard", cardId: intent.cardId, payments: [], hostId: host };
    }
    if (intent.type !== "Trigger") continue;
    const ring = intent.effectId === "132019:action:1" && (seat?.threat ?? 50) < RING_THREAT_LIMIT;
    if (!ring && !READY_ACTIONS.has(intent.effectId)) continue;
    const paid = triggerPayments(state, ctx, intent);
    if (paid) return paid.length > 0 ? { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId, payments: paid } : { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId };
  }
  return null;
}

export type SpidersGame = PlayedGame;

// The goldens (src/campaign/scenarios/flies-and-spiders/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type SpidersGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: SpidersDecks; outcome: "won" | "lost"; policy?: Partial<SpidersPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): a true solo win and two-handed wins on Normal and Easy, and the two ways to lose, each true solo and two-handed: every player's threat at 50 and Bilbo Baggins leaving play.
// The players are careful (the policy's `careful`): a Ring on Bilbo, its Action for resources while the threat is low, and the stage Actions that ready an unconscious character. The two-handed games play stage 3 in the first player's area (Bilbo with the first player's
// heroes) while the other player takes stage 4; the first player joins stage 4 once stage 3 is defeated. A solo win needs a seed whose encounter deck lets Bilbo and the awake heroes fill the 11 points of stage 3 (4 of the first 40 seeds win).
export const SPIDERS_GOLDENS: readonly SpidersGolden[] = [
  { name: "solo win", seatCount: 1, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 19, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 36, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: Bilbo leaves play", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Bilbo Baggins left play" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Bilbo leaves play", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Bilbo Baggins left play" },
];

const game = standaloneGame<SpidersDecks, SpidersPolicy>({
  campaign: cycle,
  scenario: spiders,
  stats: HERO_STATS,
  codes: [BILBO, ...spiders.cards.map((card) => card.code)],
  loadout: spidersLoadout,
  intent: spidersIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: SpidersGolden, ctx: ReduceContext): SpidersGame => game.playGolden(golden, ctx);
