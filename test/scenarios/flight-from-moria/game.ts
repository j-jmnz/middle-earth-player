import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const frommoria = loadAnyScenario("flight-from-moria");

// Test helper. A whole standalone game of Flight from Moria played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The third hero of the first player (q3) stays out of the quest and
// attacks; the first player stays on a stage (a bypass is offered at the end of every combat phase) unless it cannot be defeated by questing (Escape from Darkness, Blocked by Flame), takes the stage to the bottom at Blocked by Shadow (no elimination) and answers every other choice with its first option.
export const FROMMORIA_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "steady": slow questers, so a game has more than a round of play; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type FrommoriaDecks = "strong" | "steady" | "weak" | "brittle";

export const frommoriaLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const frommoriaWorld = (decks: FrommoriaDecks = "strong") => game.world(decks);
export const frommoriaStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type FrommoriaPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: FrommoriaPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: the answers of the policy above, and any other choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function frommoriaIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: FrommoriaPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    // The first player stays on a stage the quest can defeat and bypasses one it cannot (Escape from Darkness takes progress only from the Tools, Blocked by Flame has no quest points).
    if (options.includes("bypass") && options.includes("stay")) {
      const stage = state.cards[state.questStage ?? ""]?.code;
      return { type: "Choose", optionId: stage === "03076" || stage === "901203" ? "bypass" : "stay" };
    }
    if (options.includes("next")) return { type: "Choose", optionId: "next" };
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  // Nobody defends, so q3 stays ready to attack: the damage of an undefended attack goes to the seat's least damaged hero.
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Enemies are engaged one each after the optional step and attacked by one hero alone; The Nameless Fear is attacked from the staging area by a hero too (Blocked by Flame lets every character).
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
      const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, FROMMORIA_POLICY, memory, legalIntents(state, ctx));
}

export type FrommoriaGame = PlayedGame;

// The goldens (src/campaign/scenarios/flight-from-moria/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type FrommoriaGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FrommoriaDecks; outcome: "won" | "lost"; policy?: Partial<FrommoriaPolicy>; lossReason?: string };

// The games to pin (about 1200 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed, on Normal, Easy and Nightmare, and the three ways to lose: the threat of every player at 50 (heroes too weak to quest), every hero
// destroyed (heroes too brittle for the Goblins) and the players eliminated by Blocked by Shadow's discard of a treachery (strong heroes, the quest deck empty so the discard is the only choice). The wins end on Blocked by Shadow (9 progress), Escape from Darkness
// (4 progress, the Tools' Actions) or, on Nightmare, Pursued by Shadow (5 progress, 1 a round); the two-handed Nightmare win also plays Blocked by Flame (The Nameless Fear's attacks, the 10 damage that advance the stage).
export const FROMMORIA_GOLDENS: readonly FrommoriaGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 7, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 5, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 8, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 5, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 6, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: eliminated by Blocked by Shadow", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<FrommoriaDecks, FrommoriaPolicy>({
  campaign: cycle,
  scenario: frommoria,
  // "brittle" quest for nothing and carry 3 hit points, so the staged Goblins destroy them before the threat reaches 50 (the strong ones win too fast to be attacked).
  stats: { ...HERO_STATS, brittle: { threat: 10, willpower: 0, attack: 0, defense: 0, health: 3 } },
  codes: [...frommoria.cards.map((card) => card.code)],
  intent: frommoriaIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: FrommoriaGolden, ctx: ReduceContext): FrommoriaGame => game.playGolden(golden, ctx);
