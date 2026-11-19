import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { engageOneEach, fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("dwarrowdelf");
const dark = loadAnyScenario("the-long-dark");

// Test helper. A whole standalone game of The Long Dark played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
// The policy: the third hero of the first player (q3) stays out of the quest and attacks; nobody defends; the players engage the enemies one each after the quest and attack them; a locate test discards a hand card while more than `keep` cards are left and stops
// there (a PASS card ends it sooner); the Lost effects the first player orders, and the one a Shadow or Dreadful Deep makes a player choose, take the card the policy ranks first (a card of `LOST_RANK` by its code, else the first option); every other choice takes its first option.
export const DARK_POLICY: PolicyOptions = { scout: "q3", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DarkDecks = "strong" | "weak" | "brittle";

export const darkLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const darkWorld = (decks: DarkDecks = "strong") => game.world(decks);
export const darkStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DarkPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The cards a locate test leaves in the hand: it discards one while more are left, and stops when the hand is at `keep` (a hand of fillers costs the players nothing, so 0 tries every card).
  keep: number;
  // What a choice other than the locate test takes (a Lost effect, a hero, a card to discard): the best-ranked card of `LOST_RANK`, or the last option the choice lists.
  lost: "ranked" | "last";
};
export const DEFAULT_POLICY: DarkPolicy = { choose: "first", keep: 2, lost: "ranked" };

// The cards whose Lost effect hurts least, best first: the Dwarven Forge's hand discard (the decks are free events), the Warlord's ally discard, the Nightmare setup card's, Lost and Helpless. The others come after, in the order the sheet lists them.
const LOST_RANK = ["04090", "04099", "901601", "901608"];

// The auto-player's answer (test/harness/auto-player.ts), except: the locate test and the Lost choices as the policy says, any other choice takes the first option (or the last); nobody defends (the damage of an undefended attack goes to the seat's least damaged hero); the players engage one enemy each and attack with one hero alone. Every intent is one the reducer listed.
export function darkIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DarkPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    // The locate test: a card of the hand to discard, or "stop".
    if (options.includes("stop")) {
      const hand = options.filter((option) => option !== "stop");
      return { type: "Choose", optionId: hand.length > policy.keep ? (hand[0] ?? "stop") : "stop" };
    }
    // A Lost effect to trigger or to resolve next: the best-ranked card in the choice.
    const ranked = policy.lost === "last" ? undefined : LOST_RANK.map((code) => options.find((option) => state.cards[option]?.code === code)).find((option) => option != null);
    if (ranked) return { type: "Choose", optionId: ranked };
    if (policy.lost === "last") return { type: "Choose", optionId: options.at(-1) ?? "" };
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
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
  return nextIntent(state, ctx, DARK_POLICY, memory, legalIntents(state, ctx));
}

export type DarkGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-long-dark/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type DarkGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DarkDecks; outcome: "won" | "lost"; policy?: Partial<DarkPolicy>; lossReason?: string };

// The games to pin (about 500 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, Easy and Nightmare, two wins that vary the policy (a locate test that tries the whole hand, a Lost choice that takes the last card) and the ways to lose: the threat of every player at 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle).
export const DARK_GOLDENS: readonly DarkGolden[] = [
  { name: "solo win", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "Easy solo win", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Easy two-handed win", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "Nightmare solo win", seatCount: 1, seed: 1, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "Nightmare two-handed win", seatCount: 2, seed: 4, difficulty: "Nightmare", decks: "strong", outcome: "won" },
  { name: "solo win: every locate test tries the whole hand", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: { keep: 0 } },
  { name: "Nightmare two-handed win: the last Lost effect of each choice", seatCount: 2, seed: 3, difficulty: "Nightmare", decks: "strong", outcome: "won", policy: { lost: "last" } },
  { name: "solo loss: threat 50", seatCount: 1, seed: 4, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 2, difficulty: "Easy", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 5, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "Nightmare solo loss: every hero destroyed", seatCount: 1, seed: 11, difficulty: "Nightmare", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
];

const game = standaloneGame<DarkDecks, DarkPolicy>({
  campaign: cycle,
  scenario: dark,
  stats: HERO_STATS,
  codes: [...dark.cards.map((card) => card.code)],
  intent: darkIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: DarkGolden, ctx: ReduceContext): DarkGame => game.playGolden(golden, ctx);
