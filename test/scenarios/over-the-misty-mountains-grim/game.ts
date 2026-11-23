import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("the-hobbit");
const grim = loadAnyScenario("over-the-misty-mountains-grim");

// Test helper. A whole standalone game of Over the Misty Mountains Grim played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. Bilbo Baggins is dealt by the loadout in front of the first seat (sagaStart).
// The policy: nobody defends (the damage of an undefended attack goes to the seat's least damaged hero); the players engage the enemies one each after the quest and attack them, which the stage 3 needs (The Great Goblin must reach the victory display); every choice takes its first option (X = 0, search for a treasure), or the last as the policy says.
export const GRIM_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type GrimDecks = "strong" | "weak" | "brittle";

// The loadout as the briefing deals it (loadoutOf, src/campaign/briefing.ts): Bilbo Baggins (sagaStart) in front of the first seat's heroes.
const BILBO = "131001";
export const grimLoadout = (seatCount: 1 | 2) => fillerLoadout(seatCount).map((seat, index) => (index === 0 ? { ...seat, heroes: [BILBO, ...seat.heroes] } : seat));

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const grimWorld = (decks: GrimDecks = "strong") => game.world(decks);
export const grimStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type GrimPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: GrimPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function grimIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: GrimPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    // A choice of a card never takes Bilbo (he is the first hero of the first seat): the players lose when he leaves play.
    // When only Bilbo is left to choose (a choice of one of the first seat's heroes), the list as it is offered.
    const withoutBilbo = state.window.options.filter((option) => state.cards[option]?.code !== BILBO);
    const options = withoutBilbo.length > 0 ? withoutBilbo : state.window.options;
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  if (state.window?.kind === "defense") {
    const heroes = (state.seats[state.window.seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes" && state.cards[id]?.code !== BILBO);
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    for (const hero of (state.seats[state.activeSeat]?.heroes ?? []).filter((id) => state.cards[id]?.code !== BILBO)) {
      const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
    }
  }
  const engage = engageOneEach(state, ctx, 6);
  if (engage) return engage;
  return nextIntent(state, ctx, GRIM_POLICY, memory, legalIntents(state, ctx));
}

export type GrimGame = PlayedGame;

// The goldens (src/campaign/scenarios/over-the-misty-mountains-grim/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type GrimGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: GrimDecks; outcome: "won" | "lost"; policy?: Partial<GrimPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, a true solo win on Easy, and the ways to lose: every player's threat at 50 (heroes too weak to quest), every hero destroyed (heroes too brittle) and Bilbo Baggins leaving play (131001:A:3).
export const GRIM_GOLDENS: readonly GrimGolden[] = [
  { name: "solo win", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: every hero destroyed", seatCount: 2, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Bilbo Baggins leaves play", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "Bilbo Baggins left play" },
];

const game = standaloneGame<GrimDecks, GrimPolicy>({
  campaign: cycle,
  scenario: grim,
  stats: HERO_STATS,
  codes: [...grim.cards.map((card) => card.code), BILBO],
  loadout: grimLoadout,
  intent: grimIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: GrimGolden, ctx: ReduceContext): GrimGame => game.playGolden(golden, ctx);
