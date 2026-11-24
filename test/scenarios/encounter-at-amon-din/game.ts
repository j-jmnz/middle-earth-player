import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { characters } from "../../../src/rules/combat/combat.ts";
import { effectById } from "../../../src/rules/windows/listen.ts";
import { topFrame } from "../../../src/rules/windows/windows.ts";
import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, engageOneEach, fillerLoadout, HERO_STATS, playToEnd, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("against-the-shadow");
const din = loadAnyScenario("encounter-at-amon-din");

// Test helper. A whole standalone game of Encounter at Amon Dîn played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The policy: the players travel to the
// location with the most villager tokens and explore it, quest with every hero but the reserve (never Lord Alcaron, who stays ready for his Response, a `Trigger` the auto-player takes in the response window), engage the
// enemies by choice, defend with the first hero who may (Alcaron never), attack together with Ghulat first, keep Alcaron alive (Craven Eagle's discard of three cards is paid) and, as the golden says, let stage 2's attacks go
// undefended (the damage is villager tokens off Rescued Villagers) or quest on stage 2 only once Ghulat is gone.
export const DIN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: true };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DinDecks = "strong" | "weak" | "brittle";

export const dinLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const dinWorld = (decks: DinDecks = "strong") => game.world(decks);
export const dinStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type DinPolicy = {
  // The option a Choose window with these answers takes: the first or the last ("first" also pays the discard of three cards that keeps a character, Craven Eagle's prevent; "last" lets the character go).
  choose: "first" | "last";
  // Heroes of each seat kept out of the quest, so they can defend and attack.
  reserve: number;
  // The most enemies a seat engages by choice.
  engage: number;
  // A defender on stage 2: the first ready hero defends ("defend"), or no hero does ("undefended": the attack takes villager tokens from Rescued Villagers, the first `undefended` attacks of the game on stage 2).
  undefended: number;
  // On stage 2 the players commit nobody to the quest while Ghulat is in play, so he is defeated before the stage is.
  huntFirst: boolean;
  // The players do not use Lord Alcaron's Response.
  noAlcaron: boolean;
};
export const DEFAULT_POLICY: DinPolicy = { choose: "first", reserve: 2, engage: 3, undefended: 0, huntFirst: false, noAlcaron: false };
export const ALCARON = "06070";
export const GHULAT = "06071";
export const RESCUED = "06068";
export const DEAD = "06069";
export const STAGE_TWO = "06067";
// The quest points of stage 2B.
const QUEST_POINTS = 15;
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
const inPlay = (card: { zone: string }) => card.zone === "staging" || card.zone === "engaged" || card.zone === "active" || card.zone === "play";
export const ghulatInPlay = (state: ScenarioState): boolean => Object.values(state.cards).some((card) => card.code === GHULAT && inPlay(card));

/** In a travel window: the location in the staging area with the most villager tokens. */
function travelAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "travel") return null;
  const targets = legalTargets(state, { type: "Travel" }, ctx);
  const best = [...targets].sort((left, right) => (state.cards[right]?.resources ?? 0) - (state.cards[left]?.resources ?? 0))[0];
  return best ? { type: "Travel", locationId: best } : { type: "DeclineTravel" };
}

/** In a quest commit: every character but Lord Alcaron and the last `reserve` heroes; on stage 2 with `huntFirst`, nobody while Ghulat is in play. Null outside the commit, or once the seat has committed. */
function commitAnswer(state: ScenarioState, ctx: ReduceContext, policy: DinPolicy): PlayerIntent | null {
  if (state.mode !== "questCommit" || state.window?.kind !== "pass") return null;
  if (Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) return null;
  const stage = state.cards[state.questStage ?? ""];
  // On stage 2 the quest is full once its progress is enough (the end waits for Ghulat): every hero stays home to defend and attack him.
  if (stage?.code === STAGE_TWO && ghulatInPlay(state) && (policy.huntFirst || stage.progress >= QUEST_POINTS)) return { type: "Pass" };
  const home = new Set((state.seats[state.activeSeat]?.heroes ?? []).slice(-policy.reserve));
  const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => !home.has(id) && codeOf(state, id) !== ALCARON);
  return ids.length > 0 ? { type: "Commit", cardIds: ids } : null;
}

/** In the player attack window: every ready character but Lord Alcaron attacks together, Ghulat first. */
function attackAnswer(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  const rank = (enemy: string) => (codeOf(state, enemy) === GHULAT ? 0 : 1);
  return attackTogether(state, ctx, (id) => codeOf(state, id) !== ALCARON, rank);
}

/** The count of attacks on stage 2 an undefended answer has made, read from the defender intents of the game so far (the memory holds them). */
function defenseAnswer(state: ScenarioState, ctx: ReduceContext, policy: DinPolicy, memory: Set<string>): PlayerIntent | null {
  if (state.window?.kind !== "defense") return null;
  const intents = legalIntents(state, ctx);
  const stageTwo = codeOf(state, state.questStage) === STAGE_TWO;
  const used = [...memory].filter((key) => key.startsWith("undefended:")).length;
  if (stageTwo && used < policy.undefended && intents.some((intent) => intent.type === "Undefended")) {
    const target = legalTargets(state, { type: "Undefended" }, ctx)[0];
    if (target) {
      memory.add(`undefended:${used}`);
      return { type: "Undefended", heroId: target };
    }
  }
  const defender = intents.some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => codeOf(state, id) !== ALCARON) : undefined;
  if (defender) return { type: "DeclareDefender", defenderId: defender };
  const heroes = legalTargets(state, { type: "Undefended" }, ctx);
  const target = heroes.find((id) => codeOf(state, id) !== ALCARON) ?? heroes[0];
  return target ? { type: "Undefended", heroId: target } : null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: the choices (the discard of three cards that keeps a character is taken, the first or last option otherwise), the travel, the commit, the attack, the
// defense and the engagement above. Lord Alcaron's Response is the auto-player's `Trigger` in the response window. Every intent is one the reducer listed.
export function dinIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DinPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    return { type: "Choose", optionId: (options.includes("prevent") && policy.choose === "first" ? "prevent" : policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  if (state.window?.kind === "response" && policy.noAlcaron) return { type: "Pass" };
  const travel = travelAnswer(state, ctx);
  if (travel) return travel;
  const defense = defenseAnswer(state, ctx, policy, memory);
  if (defense) return defense;
  const commit = commitAnswer(state, ctx, policy);
  if (commit) return commit;
  const attack = attackAnswer(state, ctx);
  if (attack) return attack;
  const engage = engageOneEach(state, ctx, policy.engage);
  if (engage) return engage;
  if (state.window?.kind === "playerAttack") return { type: "DeclineAttack" };
  return nextIntent(state, ctx, DIN_POLICY, memory, legalIntents(state, ctx));
}

export type DinGame = PlayedGame;

// The goldens (src/campaign/scenarios/encounter-at-amon-din/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type DinGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DinDecks; outcome: "won" | "lost"; policy?: Partial<DinPolicy>; lossReason?: string };

// The games to pin (.claude/rules/code-standards.md, Test cost): a solo and a two-handed Normal win, one Easy win and a loss for each way to lose (the golden suite names each).
// - solo win (seed 1): Ghulat is in play when Protect the Villagers is defeated, so the end is held until the heroes defeat him;
// - two-handed win, hunt first (seed 4): the players quest on stage 2 only once Ghulat is defeated, so the stage is the last thing to go;
// - Easy two-handed win (seed 1): the Easy deal, Ghulat held as in the solo win;
// - solo loss, every hero destroyed (seed 1, brittle heroes): the heroes die to Ghulat's and the Orcs' attacks while the end is held;
// - solo loss, Lord Alcaron leaves play (seed 8): Craven Eagle discards him, the loss waits for Ghulat to leave play;
// - two-handed loss, threat 50 (seed 3, weak heroes);
// - two-handed loss, the comparison (seed 1): two undefended attacks on stage 2 discard villager tokens, so fewer are rescued than died.
export const DIN_GOLDENS: readonly DinGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win, hunt first", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { huntFirst: true } },
  { name: "Easy two-handed win", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: Lord Alcaron leaves play", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { choose: "last" }, lossReason: "Lord Alcaron left play" },
  { name: "two-handed loss: threat 50", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: the comparison", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { undefended: 2 }, lossReason: "Dead Villagers: not more villager tokens were rescued than died" },
];

const game = standaloneGame<DinDecks, DinPolicy>({
  campaign: cycle,
  scenario: din,
  stats: HERO_STATS,
  // The scenario deals no Nightmare deck and no card besides its own piles, so the codes are the scenario's cards.
  codes: [...din.cards.map((card) => card.code)],
  intent: dinIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

// A golden keeps the state after each intent (`trail`), so the suite's checks read the moments between intents from the one play.
export const playGolden = (golden: DinGolden, ctx: ReduceContext): DinGame => {
  const policy = { ...DEFAULT_POLICY, ...golden.policy };
  return playToEnd(game.start(golden.seatCount, golden.seed, golden.difficulty), ctx, (state, memory) => dinIntent(state, ctx, memory, policy), 6000, { trail: true });
};

/** Whether the open window is the pick or choice of an effect whose record holds this verb (the frame's own record). */
export function isWindowOf(state: ScenarioState, ctx: Pick<ReduceContext, "effects">, verb: string): boolean {
  const data = topFrame(state)?.data;
  const record = data?.kind === "effect" ? effectById(ctx, data.effectId) : undefined;
  return record?.instructions.some((step) => step.verb === verb) ?? false;
}
void characters;
