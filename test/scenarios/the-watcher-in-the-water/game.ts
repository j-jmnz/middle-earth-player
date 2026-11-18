import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { engageOneEach, HERO_STATS, STRONG_HEROES, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const water = loadAnyScenario("the-watcher-in-the-water");

// Test helper. A whole standalone game of The Watcher in the Water played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks hold the scenario's own player cards
// (their titles are what Doors of Durin's Action reads: the letters G, S, W, R, A, E and L), so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
// The policy: the third hero of the first player (q3) stays out of the quest and attacks; nobody defends; the players engage the enemies one each after the quest (the Watcher cannot be optionally engaged while another Tentacle is in play, so it is engaged last) and attack them;
// every choice takes its first option; Wrapped!'s Combat Action is used when a spare hero is ready and Doors of Durin's Action every round, the hands discarded whole (the letters are luck: the policy is patient).
export const WATER_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type WaterDecks = "strong" | "weak" | "brittle";

// The scenario's player cards, three of each, in the deck: the titles Doors of Durin's Action compares with the encounter deck's.
const PLAYER_CARDS = ["04054", "04055", "04056", "04057", "04058", "04059", "04060", "04061", "04062"];
export function waterLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const deck = Array.from({ length: 30 }, (_, at) => PLAYER_CARDS[at % PLAYER_CARDS.length] ?? "04054");
  const first = { heroes: STRONG_HEROES.slice(0, 3), deck };
  return seatCount === 1 ? [first] : [first, { heroes: STRONG_HEROES.slice(3, 6), deck }];
}

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const waterWorld = (decks: WaterDecks = "strong") => game.world(decks);
export const waterStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type WaterPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: WaterPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says (Doors' hand discards take a card while there is one: the hand goes whole); Wrapped!'s Combat Action and Doors of Durin's Action are used
// when offered; nobody defends (the damage of an undefended attack goes to the seat's least damaged hero); the players engage one enemy each and attack with one hero alone. Every intent is one the reducer listed.
export function waterIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: WaterPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    const card = options.find((option) => option !== "done" && state.cards[option]?.zone === "hand");
    if (options.includes("done") && card) return { type: "Choose", optionId: card };
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  const used = legalIntents(state, ctx).find((intent) => intent.type === "Trigger" && ["040076", "04065"].includes(state.cards[intent.cardId]?.code ?? ""));
  if (used) return used;
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
      const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, WATER_POLICY, memory, legalIntents(state, ctx));
}

export type WaterGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-watcher-in-the-water/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type WaterGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: WaterDecks; outcome: "won" | "lost"; policy?: Partial<WaterPolicy>; lossReason?: string };

// The games to pin (about 1000 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, Easy and Nightmare (Normal: The Watcher killed; Easy: Doors of Durin by a matching letter; Nightmare: both in the victory display), and the ways to
// lose: the threat of every player at 50 (heroes too weak to quest), every hero destroyed (heroes too brittle), and on Nightmare the stage held at 5 progress while the threat climbs (The Watcher cannot be engaged until Doors of Durin has left play, and Doors' Action is luck).
export const WATER_GOLDENS: readonly WaterGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 1, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 4, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "Nightmare solo loss: the stage waits for Doors of Durin and The Watcher", seatCount: 1, seed: 2, difficulty: "Nightmare", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<WaterDecks, WaterPolicy>({
  campaign: cycle,
  scenario: water,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...water.cards.map((card) => card.code), ...PLAYER_CARDS],
  loadout: waterLoadout,
  intent: waterIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: WaterGolden, ctx: ReduceContext): WaterGame => game.playGolden(golden, ctx);
