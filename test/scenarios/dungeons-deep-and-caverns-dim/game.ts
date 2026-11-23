import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { loadoutOf } from "../../../src/campaign/briefing.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("the-hobbit");
const dim = loadAnyScenario("dungeons-deep-and-caverns-dim");

// Test helper. A whole standalone game of Dungeons Deep and Caverns Dim played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks hold
// Guard of the Citadel (a leadership ally of cost 2) 30 times, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. Bilbo Baggins is dealt by the loadout, as the briefing deals him (loadoutOf).
// There is no campaign: no checklist, no log, no earlier part, no Resolution. The first player answers every riddle: he answers it when offered, names what the deck holds (an ally, leadership, cost 2) so each discarded card is a match
// (`right`), or names what it never holds, so every riddle fails and Gollum attacks Bilbo each time (`wrong`); he spends no Baggins resource on the Ring. Travel, engaging and defending are the auto-player's.
export const DIM_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DimDecks = "strong" | "weak" | "brittle";

const GUARD = "01013";
const BILBO = "131001";
/** The seats a game deals: three stand-in heroes a seat and 30 copies of Guard of the Citadel, with Bilbo Baggins in front of the first seat (the saga hero of the box, `sagaStart`). */
export function dimLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const deck = Array.from({ length: 30 }, () => GUARD);
  const seats = [{ deckId: "d1", heroes: ["q1", "q2", "q3"], deck }, { deckId: "d2", heroes: ["q4", "q5", "q6"], deck }];
  return loadoutOf({ world: { campaign: cycle, scenario: dim, effects: EFFECTS, cards: new Map(), sets: new Map() }, seatCount, seats, ringBearer: null });
}

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const dimWorld = (decks: DimDecks = "strong") => game.world(decks);
export const dimStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DimPolicy = {
  // What the first player names when he answers a riddle: what his deck holds, or what it never holds.
  riddle: "right" | "wrong";
};
export const DEFAULT_POLICY: DimPolicy = { riddle: "right" };

// What each name of a riddle is, by the options its window offers (a card type, a sphere, a cost).
const RIGHT: Readonly<Record<string, string>> = { ally: "ally", leadership: "leadership", "2": "2" };
const WRONG: Readonly<Record<string, string>> = { treasure: "treasure", baggins: "baggins", "6": "6" };

// The auto-player's answer (test/harness/auto-player.ts), except: the first player answers a riddle when he is offered one, names by the policy, and leaves Bilbo's Magic Ring unused. Every other choice takes the first option. Every intent is one the reducer listed.
export function dimIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DimPolicy = DEFAULT_POLICY): PlayerIntent {
  const window = state.window;
  if (window?.kind === "choose") {
    const names = policy.riddle === "right" ? RIGHT : WRONG;
    const named = window.options.find((option) => names[option] === option);
    const wanted = window.options.includes("answer") ? "answer" : window.options.includes("stop") ? "stop" : named;
    return { type: "Choose", optionId: wanted ?? window.options[0] ?? "" };
  }
  return nextIntent(state, ctx, DIM_POLICY, memory, legalIntents(state, ctx));
}

export type DimGame = PlayedGame;

// The goldens (src/campaign/scenarios/dungeons-deep-and-caverns-dim/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type DimGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DimDecks; outcome: "won" | "lost"; policy?: Partial<DimPolicy>; lossReason?: string };

// The games to pin: a win true solo and one two-handed, and a loss for each way to lose (every player's threat at 50, Bilbo Baggins destroyed by Gollum after riddles that find no match).
export const DIM_GOLDENS: readonly DimGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Bilbo Baggins destroyed", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { riddle: "wrong" }, lossReason: "Bilbo Baggins left play" },
];

const game = standaloneGame<DimDecks, DimPolicy>({
  campaign: cycle,
  scenario: dim,
  stats: HERO_STATS,
  // The cards a game loads besides the scenario's piles: Bilbo Baggins and the card the decks hold.
  codes: [...dim.cards.map((card) => card.code), BILBO, GUARD],
  intent: dimIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  loadout: dimLoadout,
});

export const playGolden = (golden: DimGolden, ctx: ReduceContext): DimGame => game.playGolden(golden, ctx);
