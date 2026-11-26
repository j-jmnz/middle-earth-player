import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import type { PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/reduce.ts";
import { attackAllTogether, chooseFirstOrLast, commitAllBut, policyIntent, type Policy, type Rule } from "../../harness/policy-kit.ts";

const cycle = loadCampaign("the-ring-maker");
const crown = loadAnyScenario("the-antlered-crown");

// Test helper. A whole standalone game of The Antlered Crown played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution.
// The players play every free event they draw (the auto-player's `play`): Dunland Battlefield, Raven Country, the Dunland enemies and Fierce Folk all count the cards in a hand, so a hand left to grow drowns the table in damage and threat. Chief Turch (08150) has 5 hit points and the players lose when he
// leaves play, so no rule below lets him commit to the quest, defend, attack or take assigned damage unless he is the only character offered. The heroes take the attacks and the damage the cards assign.
export const CROWN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type CrownDecks = "strong" | "weak" | "brittle";

export const crownLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const crownWorld = (decks: CrownDecks = "strong") => game.world(decks);
export const crownStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type CrownPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: CrownPolicy = { choose: "first" };

// The policy (test/harness/policy-kit.ts): a list of rules tried in order, then the auto-player's answer with CROWN_POLICY. A rule answers its own window and returns null for any other. The kit's rules:
//   chooseFirstOrLast(which)  a Choose window takes the first or the last option
//   chooseOption(wanted, otherwise)  a Choose window takes the option `wanted` names for the options offered, else the first or last
//   commitAllBut(reserve, keepHome)  the quest commit: every character but the last `reserve` heroes (and those `keepHome` names)
//   travelFewestQuestPoints(allow)  a travel window: the location with the fewest quest points (one `allow` permits), else decline
//   declineTravel()  a travel window: decline
//   defendFirst(perRound)  a defense window: the first character who may defends (the first `perRound` attacks of a seat's round), else the first hero is undefended
//   undefendedLeastDamaged(except)  a defense window: nobody defends, the least damaged hero takes the attack (the others stay ready to attack)
//   archeryLeastDamaged(skip)  an archery window: all the damage to the least damaged character
//   attackAllTogether(rank, may)  the player attack window: every ready character attacks the enemy of the lowest `rank` (else the first) together
//   attackEach(options)  the player attack window: the first ready character attacks alone, so each takes a different enemy when `once`
//   declineAttack()  the player attack window: decline to attack
//   engageUpTo(most, options)  the optional engagement step: engage the enemy of the lowest `rank` (`allow` permits) while engaged with fewer than `most`
//   triggerActions(effectIds, oncePerRound)  an Action or Response of the records named, each time (or once a round) the engine offers it and the seat can pay
//   passCommitWhile(when)  the quest commit: pass without committing while `when` holds
const TURCH = "08150";
const CAMP = "08152";
const RAVEN_CHIEF = "08151";
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
const notTurch = (state: ScenarioState, id: string): boolean => codeOf(state, id) !== TURCH;
const damageOf = (state: ScenarioState, id: string): number => state.cards[id]?.damage ?? 0;
const inPlayCode = (state: ScenarioState, code: string): boolean => Object.values(state.cards).some((card) => card.code === code && ["staging", "engaged", "activeLocation", "secondActiveLocation"].includes(card.zone));
const leastDamagedOf = (state: ScenarioState, ids: readonly string[]): string | undefined => {
  const pool = ids.filter((id) => notTurch(state, id));
  return [...(pool.length > 0 ? pool : ids)].sort((left, right) => damageOf(state, left) - damageOf(state, right))[0];
};
// A Choose window whose options are characters is a damage assignment (Dunland Battlefield, Raven Country, Wild Men of Dunland: one point at a time): the least damaged character that is not Chief Turch takes it.
const damageToHeroes: Rule = (state) => {
  if (state.window?.kind !== "choose") return null;
  const options = state.window.options;
  if (options.length === 0 || !options.every((id) => state.cards[id] && ["heroes", "play"].includes(state.cards[id].zone))) return null;
  return { type: "Choose", optionId: leastDamagedOf(state, options) ?? options[0] ?? "" };
};
// A defense window: the first ready character that is not Chief Turch defends the seat's first attack of a round; every other attack is undefended and falls on the least damaged hero (Turch only when he is the one character offered), so the other heroes stay ready to attack.
const heroesDefend: Rule = (state, ctx, memory) => {
  if (state.window?.kind !== "defense") return null;
  const key = `defended:${state.round}:${state.activeSeat}`;
  const first = !memory.has(key);
  const defender = first && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => notTurch(state, id)) : undefined;
  if (defender) {
    memory.add(key);
    return { type: "DeclareDefender", defenderId: defender };
  }
  const hero = leastDamagedOf(state, legalTargets(state, { type: "Undefended" }, ctx));
  return hero ? { type: "Undefended", heroId: hero } : null;
};
// A travel window: Raven Chief's Camp as soon as it is in the staging area (its 9 quest points hold the Raven Chief's shield, and the Camp leaves play to the victory display once explored), else the location with the fewest quest points, else the active location stays.
const travelToCamp: Rule = (state, ctx) => {
  if (state.window?.kind !== "travel") return null;
  const targets = legalTargets(state, { type: "Travel" }, ctx);
  const points = (id: string): number => ctx.cards.get(codeOf(state, id))?.questPoints ?? 99;
  const best = targets.find((id) => codeOf(state, id) === CAMP) ?? [...targets].sort((left, right) => points(left) - points(right))[0];
  return best ? { type: "Travel", locationId: best } : { type: "DeclineTravel" };
};
// The optional engagement step: only Raven Chief, and only once the Camp is out of play (while it stands he cannot be damaged, and each of his attacks takes a time counter off the active location, 08151:A:2). The other enemies stay in the staging area, where the players' Willpower
// outweighs them, so a seat is not buried in attacks (Raven Warrior, the Dunland enemies and the stage 3 Forced attack grow with every enemy engaged).
const engageWhenUseful: Rule = (state, ctx) => {
  if (state.window?.kind !== "optionalEngage") return null;
  const target = legalTargets(state, { type: "Engage" }, ctx).find((id) => codeOf(state, id) === RAVEN_CHIEF && !inPlayCode(state, CAMP));
  return target ? { type: "Engage", enemyId: target } : { type: "DeclineEngage" };
};
// The commit window with no one but Chief Turch to commit: nobody does (his 1 Willpower is not worth the risk of an exhausted Turch at the next attack).
const turchStaysHome: Rule = (state) => (state.mode === "questCommit" && state.window?.kind === "pass" ? { type: "Pass" } : null);
// Once the Camp has been explored Raven Chief is the one thing left to do (08149:B:3): nobody quests, so every hero is ready to attack him the round he engages (his Engagement Cost 15 is within reach of a threat that has grown).
const huntRavenChief: Rule = (state) => (state.mode === "questCommit" && state.window?.kind === "pass" && codeOf(state, state.questStage) === "08149" && !inPlayCode(state, CAMP) ? { type: "Pass" } : null);
// The attack window: every ready character but Chief Turch attacks together, Raven Chief first once the Camp is out of play and last before (he is shielded until the Camp is explored).
const rules = (policy: CrownPolicy): Policy => [
  damageToHeroes,
  chooseFirstOrLast(policy.choose),
  travelToCamp,
  huntRavenChief,
  commitAllBut(1, (state, id) => !notTurch(state, id)),
  turchStaysHome,
  heroesDefend,
  attackAllTogether((state, id) => (codeOf(state, id) === RAVEN_CHIEF ? (inPlayCode(state, CAMP) ? 2 : 0) : 1), notTurch),
  engageWhenUseful,
];

// Every intent is one the reducer listed.
export function crownIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CrownPolicy = DEFAULT_POLICY): PlayerIntent {
  return policyIntent(rules(policy), CROWN_POLICY, state, ctx, memory);
}

export type CrownGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-antlered-crown/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type CrownGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CrownDecks; outcome: "won" | "lost"; policy?: Partial<CrownPolicy>; lossReason?: string };

// The games to pin (about 400 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed on Normal, each ending when Raven Chief lies in the victory display at the end of a round of stage 3. There is no Easy golden: the Easy deal changes only the counts of the encounter cards, not a rule.
// The ways to lose are a player's threat reaching 50 (heroes too weak to quest, solo and two-handed), every hero destroyed (solo, heroes with 7 hit points and no defense) and Chief Turch leaving play (08150:A:3): two-handed with the same brittle heroes, the second player holds the first player token when
// their last hero is destroyed and Chief Turch, who follows the token, leaves play with them.
export const CROWN_GOLDENS: readonly CrownGolden[] = [
  { name: "solo win", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: threat", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "solo loss: every hero destroyed", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Chief Turch leaves play", seatCount: 2, seed: 2, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "Chief Turch left play" },
];

const game = standaloneGame<CrownDecks, CrownPolicy>({
  campaign: cycle,
  scenario: crown,
  stats: HERO_STATS,
  // TODO: the cards a game loads besides the scenario's piles and its Nightmare deck.
  codes: [...crown.cards.map((card) => card.code)],
  intent: crownIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: CrownGolden, ctx: ReduceContext): CrownGame => game.playGolden(golden, ctx);
