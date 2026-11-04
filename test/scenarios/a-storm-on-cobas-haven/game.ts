import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { characters, legalAttackEnemies } from "../../../src/rules/combat/combat.ts";
import { askingToCommit } from "../../../src/rules/families/sea/sailing-legal.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { CODES, SHIP_CODES, campaign, haven } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, STRONG_HEROES as HEROES, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of A Storm on Cobas Haven in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players choose the first option of each Setup question (the Dol Amroth objective the Setup searches for, who
// takes Gavin, Belfalas Islet's Ship enemy, the phase Send for Help adds), take Círdan's Blessing, keep a hero at home to attack, and let the Sailing test commit no one or the ships and the ships defend, as the policy says.
export const HAVEN_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack; "armed": strong heroes and ships with big attacks, so the ships sink the Raider Flagship in one combat phase.
export type HavenDecks = "strong" | "weak" | "brittle" | "armed";

export const havenLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export async function havenWorld(decks: HavenDecks = "strong") {
  const world = await game.world(decks);
  // The "armed" ships attack as hard as the stand-in heroes do (a ship's own stats are too small for the Raider Flagship's 18 hit points and Defense 3 within the quest's rounds).
  if (decks === "armed") for (const code of SHIP_CODES) world.cards.set(code, { ...world.cards.get(code)!, attack: 12, defense: 6, health: 40 });
  return world;
}
export const afterRuins = (seatCount: 1 | 2) => game.after(seatCount);
// The campaign card's Setup (11209:A:3) through the Campaign Setup Checklist: the seats are asked in turn for the one copy of Círdan's Blessing until a player takes it ("skip" refuses); the first player does here.
export const blessingChoices = (): string[] => [CODES.cirdanSBlessing];
export const havenPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = blessingChoices()) => game.plan(seatCount, log, choices);
export const havenStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices: readonly string[] = blessingChoices()) => game.start(seatCount, seed, difficulty, facts, log, modeCard, choices);

export type HavenPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // "pass" or "ships" at the Sailing test (commit no one, or the ships that can sail).
  sail: "pass" | "ships";
  // The optional engagement step engages one enemy at a time ("ships"), only Corsair Skirmisher ("skirmisher", so the heroes can destroy it and the players may take it as a ship), or no one ("none").
  engage: "ships" | "none" | "skirmisher";
  // Travel to Belfalas Islet when the players may ("islet"), else to the first location.
  travel: "first" | "islet";
  // Hunt the Raider Flagship ("flagship"): once stage 3 is current no hero quests and a hero defends, so the ships stay ready and attack it (only Ship objectives may) before the quest is won.
  hunt: "none" | "flagship";
  // Who defends: a hero ("heroes", the strong heroes' Defense and hit points are big) or a ship ("ships", which leaves the hero ready to attack).
  defend: "heroes" | "ships";
  // Use each Action once a round and answer each Response when able (Gavin's Planning Action, the towers' Actions, Calaerion, Corsair Skirmisher's Response).
  act: boolean;
};
export const DEFAULT_POLICY: HavenPolicy = { choose: "first", sail: "pass", engage: "ships", travel: "first", hunt: "none", defend: "heroes", act: false };

const codeOf = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

// In a player attack window: every ready ship that can attack the engaged Raider Flagship does, together. Null when it is not engaged to the seat or no ship can.
function attackFlagship(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  const seat = state.activeSeat;
  const flagship = state.seats[seat]?.engaged.find((id) => codeOf(state, id) === CODES.raiderFlagship);
  if (!flagship) return null;
  const ships = characters(state, seat, ctx.cards).filter((id) => SHIP_CODES.includes(codeOf(state, id)) && legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0 && legalAttackEnemies(state, seat, id, ctx.cards).includes(flagship));
  return ships.length > 0 ? { type: "DeclareAttackers", enemyId: flagship, attackerIds: ships } : null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: the Sailing test commits no one or the ships; the players travel to Belfalas Islet when the policy says; in a player attack window every ready character that
// can attack the target attacks together; the optional engagement step engages one enemy at a time; defense falls to the ships; damage the players assign falls on the least wounded hero, never on a ship; any other choice takes the first
// option, or the last as the policy says. Every intent is one the reducer listed.
export function havenIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: HavenPolicy = DEFAULT_POLICY): PlayerIntent {
  const hunting = policy.hunt === "flagship" && codeOf(state, state.questStage ?? "") === CODES.stage3;
  if (askingToCommit(state)) {
    if (policy.sail === "ships") {
      const ships = legalTargets(state, { type: "Commit" }, ctx).filter((id) => SHIP_CODES.includes(codeOf(state, id)));
      if (ships.length > 0) return { type: "Commit", cardIds: ships };
    }
    return { type: "Pass" };
  }
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
    const heroes = ids.filter((id) => HEROES.includes(codeOf(state, id)));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      const questers = ids.filter((id) => !home.includes(id) && !SHIP_CODES.includes(codeOf(state, id)));
      if (hunting) return { type: "Pass" };
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const hunt = hunting ? attackFlagship(state, ctx) : null;
  if (hunt) return hunt;
  const together = attackTogether(state, ctx);
  if (together) return together;
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    const heroes = options.filter((option) => HEROES.includes(codeOf(state, option)));
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least && heroes.length < options.length) return { type: "Choose", optionId: least };
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  if (state.window?.kind === "travel" && policy.travel === "islet" && legalIntents(state, ctx).some((intent) => intent.type === "Travel")) {
    const islet = legalTargets(state, { type: "Travel" }, ctx).find((id) => codeOf(state, id) === CODES.belfalasIslet);
    if (islet) return { type: "Travel", locationId: islet };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    // The hero kept at home defends ("heroes") or a ship does ("ships": the hero stays ready to attack). Hunting the Flagship, a hero defends: a ship that defends is exhausted and cannot attack it.
    const wanted = hunting || policy.defend === "heroes" ? HEROES : SHIP_CODES;
    const defender = defenders.find((id) => wanted.includes(codeOf(state, id))) ?? defenders[0];
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "optionalEngage" && policy.engage === "none") return { type: "DeclineEngage" };
  if (state.window?.kind === "optionalEngage" && policy.engage === "skirmisher") {
    const skirmisher = legalIntents(state, ctx).some((intent) => intent.type === "Engage") ? legalTargets(state, { type: "Engage" }, ctx).find((id) => codeOf(state, id) === CODES.corsairSkirmisher) : undefined;
    return skirmisher ? { type: "Engage", enemyId: skirmisher } : { type: "DeclineEngage" };
  }
  const engaging = engageOneEach(state, ctx, 2);
  if (engaging) return engaging;
  return nextIntent(state, ctx, { ...HAVEN_POLICY, act: policy.act }, memory, legalIntents(state, ctx));
}

export type HavenGame = PlayedGame;

// The goldens (src/campaign/scenarios/a-storm-on-cobas-haven/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type HavenGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: HavenDecks; outcome: "won" | "lost"; policy?: Partial<HavenPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string; choices?: readonly string[] };

export const UPGRADED_CODES = [CODES.blackKey, CODES.calaerion];
const THREAT_LOST = "No seats remain";

const SAIL_TO_ISLET: Partial<HavenPolicy> = { sail: "ships", travel: "islet" };
const ACT: Partial<HavenPolicy> = { ...SAIL_TO_ISLET, act: true };
const HUNT: Partial<HavenPolicy> = { hunt: "flagship" };
const SHIPS_DEFEND: Partial<HavenPolicy> = { defend: "ships" };
const DREAM_CHASER_LOST = "Dream-chaser left play";

export const HAVEN_GOLDENS: readonly HavenGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, after The Drowned Ruins, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "true solo, travels to Belfalas Islet, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: SAIL_TO_ISLET },
  { name: "true solo, Raider Flagship sunk, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "armed", outcome: "won", policy: HUNT },
  { name: "true solo, Gavin's Action and Taking on Water, won", seatCount: 1, seed: 14, difficulty: "Normal", decks: "strong", outcome: "won", policy: ACT },
  { name: "true solo, Hard Mode card, Upgraded Black Key and Calaerion, won", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, after The Drowned Ruins, won", seatCount: 2, seed: 8, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, Raider Flagship held under Belfalas Islet, won", seatCount: 2, seed: 35, difficulty: "Normal", decks: "strong", outcome: "won", policy: ACT },
  { name: "two-handed, an added phase, won", seatCount: 2, seed: 15, difficulty: "Normal", decks: "strong", outcome: "won", policy: ACT },
  { name: "two-handed, Expert Mode card, Upgraded Black Key and Calaerion, won", seatCount: 2, seed: 9, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, the Dream-chaser destroyed, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: SHIPS_DEFEND, lossReason: DREAM_CHASER_LOST },
  { name: "two-handed, The Beacon takes a Warship, the Warship destroyed, the Dream-chaser destroyed, lost", seatCount: 2, seed: 22, difficulty: "Normal", decks: "strong", outcome: "lost", policy: ACT, lossReason: DREAM_CHASER_LOST },
  { name: "two-handed, the Dream-chaser destroyed, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: DREAM_CHASER_LOST },
];

const game = campaignGame<HavenDecks, HavenPolicy>({
  campaign,
  scenario: haven,
  stats: { ...HERO_STATS, armed: HERO_STATS.strong },
  // The ships' reprints, the Send for Help cards' heroes and Gandalf come from the collection; Ominous Fate is in the pool the earlier parts leave.
  codes: [...haven.cards.map((card) => card.code), "11176"],
  intent: havenIntent,
  policy: DEFAULT_POLICY,
  limit: 8000,
  upgraded: UPGRADED_CODES,
  // The XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [4, 3, 5, 4, 4, 5, 4], pool: [{ code: "11176" }], marks: { "11080": 1, "11172": 2, "11184": 3, "11198": 2 } },
});

export const playGolden = (golden: HavenGolden, ctx: ReduceContext): HavenGame => game.playGolden(golden, ctx, golden.choices ?? blessingChoices());
export { DREAM_CHASER_LOST, THREAT_LOST };
