import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { characters, declarableEnemies } from "../../../src/rules/combat/combat.ts";
import { askingToCommit } from "../../../src/rules/families/sea/sailing-legal.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { CODES, SHIP_CODES, campaign, corsairs } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, engageOneEach, fillerLoadout, HERO_STATS, STRONG_HEROES as HEROES, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The City of Corsairs in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to the first location they are offered (declining only when none is), engage one enemy at a time, and answer a choice with the first option or, as the policy says, the last; the Sailing test, the hunt for Captain Sahír and The Black Sword's Refresh Action are the policy fields below.
export const CORSAIRS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type CorsairsDecks = "strong" | "weak" | "brittle" | "armed";

export const corsairsLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const corsairsWorld = (decks: CorsairsDecks = "strong") => game.world(decks);
export const afterHaven = (seatCount: 1 | 2) => game.after(seatCount);
// The campaign card's Setup (11215:A:3) through the Campaign Setup Checklist: the seats are asked in turn for the one copy of Círdan's Blessing until a player takes it ("skip" refuses); the first player does here.
export const blessingChoices = (): string[] => [CODES.cirdanSBlessing];
export const corsairsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = blessingChoices()) => game.plan(seatCount, log, choices);
export const corsairsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices: readonly string[] = blessingChoices()) => game.start(seatCount, seed, difficulty, { facts, log, modeCard, choices });

export type CorsairsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // "pass" or "ships" at the Sailing test (commit no one, or the ships that can sail).
  sail: "pass" | "ships";
  // The optional engagement step engages one enemy at a time ("ships") or no one ("none").
  engage: "ships" | "none";
  // Hunt Captain Sahír ("sahir"): once stage 4 is current no hero quests and every ready character attacks him, so the resources on the enemies are discarded and he is destroyed.
  hunt: "none" | "sahir";
  // Sink the Stormcaller ("stormcaller"): while stage 1 is current the Sailing test commits no ship and every ready ship that can attack it does, so the quest advances with it in the victory display (12147:B:1).
  sink: "none" | "stormcaller";
  // Who defends: a hero ("heroes", the strong heroes' Defense and hit points are big) or a ship ("ships", which leaves the hero ready to attack).
  defend: "heroes" | "ships" | "none";
  // Use each Action once a round and answer each Response when able (the Black Sword's Refresh Action).
  act: boolean;
};
export const DEFAULT_POLICY: CorsairsPolicy = { choose: "first", sail: "pass", engage: "ships", hunt: "none", sink: "none", defend: "heroes", act: false };

const codeOf = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

// In a player attack window while the Stormcaller is sunk: every ready ship that can attack it (engaged to the seat) does, together. Null when it is not engaged to the seat or no ship can.
function attackStormcaller(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  const seat = state.activeSeat;
  const stormcaller = state.seats[seat]?.engaged.find((id) => codeOf(state, id) === CODES.stormcaller);
  if (!stormcaller) return null;
  const ships = characters(state, seat, ctx.cards).filter((id) => SHIP_CODES.includes(codeOf(state, id)) && legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0 && declarableEnemies(state, seat, id, ctx.cards).includes(stormcaller));
  return ships.length > 0 ? { type: "DeclareAttackers", enemyId: stormcaller, attackerIds: ships } : null;
}

// In a player attack window while Sahír is hunted: every ready character that can attack the target does, together. Captain Sahír is indestructible while any enemy has resources, so the target is an enemy with resources
// engaged to the seat (its resources go to Sahír when it is destroyed) and, when none is, Sahír. Null when no one can attack.
function attackHunted(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  const seat = state.activeSeat;
  const engaged = state.seats[seat]?.engaged ?? [];
  const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
  const reach = (enemy: string) => ready.filter((id) => declarableEnemies(state, seat, id, ctx.cards).includes(enemy));
  const sahir = engaged.find((id) => codeOf(state, id) === CODES.captainSahir);
  const target = engaged.find((id) => id !== sahir && (state.cards[id]?.resources ?? 0) > 0 && reach(id).length > 0) ?? (sahir && reach(sahir).length > 0 ? sahir : undefined);
  return target ? { type: "DeclareAttackers", enemyId: target, attackerIds: reach(target) } : null;
}

// In a player attack window: every ready character attacks together the first enemy any of them may still attack this phase (an enemy is attacked once). Null when no one can attack.
function attackRest(state: ScenarioState, ctx: ReduceContext): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  const seat = state.activeSeat;
  const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
  const enemy = ready.map((id) => declarableEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
  const attackers = ready.filter((id) => enemy != null && declarableEnemies(state, seat, id, ctx.cards).includes(enemy));
  return enemy && attackers.length > 0 ? { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers } : null;
}

// The auto-player's answer (test/harness/auto-player.ts), except: the Sailing test commits no one or the ships; in a player attack window every ready character that can attack the target attacks together; the optional
// engagement step engages one enemy at a time; defense falls to a hero or to the ships; damage the players assign falls on the least wounded hero, never on a ship; any other choice takes the first option, or the last as
// the policy says. Every intent is one the reducer listed.
export function corsairsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: CorsairsPolicy = DEFAULT_POLICY): PlayerIntent {
  const sinking = policy.sink === "stormcaller" && codeOf(state, state.questStage ?? "") === CODES.stage1;
  const hunting = policy.hunt === "sahir" && codeOf(state, state.questStage ?? "") === CODES.stage4;
  if (askingToCommit(state)) {
    if (policy.sail === "ships") {
      const ships = legalTargets(state, { type: "Commit" }, ctx).filter((id) => SHIP_CODES.includes(codeOf(state, id)));
      if (ships.length > 0) return { type: "Commit", cardIds: ships };
    }
    return { type: "Pass" };
  }
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    // With the strong loadout the last hero of each seat stays out of the quest (the last two once Sahír is hunted), so they are ready to attack.
    const heroes = ids.filter((id) => HEROES.includes(codeOf(state, id)));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(hunting ? -2 : -1) : [];
      const questers = ids.filter((id) => !home.includes(id) && !SHIP_CODES.includes(codeOf(state, id)));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  // The Refresh Action of the campaign card (11215:B:3) is used in the last action window of the round, once a round, until The Black Sword is gone.
  if (policy.act && state.window?.kind === "frameAction") {
    const refresh = legalIntents(state, ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "11215:action:1");
    const key = `${state.round}:refresh`;
    if (refresh?.type === "Trigger" && !memory.has(key)) {
      memory.add(key);
      return { type: "Trigger", cardId: refresh.cardId, effectId: refresh.effectId };
    }
  }
  const sink = sinking ? attackStormcaller(state, ctx) : null;
  if (sink) return sink;
  const hunt = hunting ? attackHunted(state, ctx) : null;
  if (hunt) return hunt;
  const together = attackRest(state, ctx);
  if (together) return together;
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    const heroes = options.filter((option) => HEROES.includes(codeOf(state, option)));
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least && heroes.length < options.length) return { type: "Choose", optionId: least };
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  if (state.window?.kind === "defense") {
    const defenders = policy.defend !== "none" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    const wanted = policy.defend === "heroes" ? HEROES : SHIP_CODES;
    const defender = defenders.find((id) => wanted.includes(codeOf(state, id))) ?? defenders[0];
    if (defender && policy.defend !== "none") return { type: "DeclareDefender", defenderId: defender };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "optionalEngage" && policy.engage === "none") return { type: "DeclineEngage" };
  const engaging = engageOneEach(state, ctx, hunting ? 99 : 2);
  if (engaging) return engaging;
  return nextIntent(state, ctx, { ...CORSAIRS_POLICY, act: policy.act }, memory, legalIntents(state, ctx));
}

export type CorsairsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-city-of-corsairs/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type CorsairsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: CorsairsDecks; outcome: "won" | "lost"; policy?: Partial<CorsairsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string; choices?: readonly string[] };

export const UPGRADED_CODES = [CODES.gavin, CODES.calaerion, CODES.theBlackSword, "110129"];
const THREAT_LOST = "No seats remain";
const DREAM_CHASER_LOST = "Dream-chaser left play";

// The winning policy: the ships sail the Sailing test, the characters kept at home hunt Captain Sahír (the enemies with resources first), nobody defends, and the Refresh Action takes the resources off The Black Sword.
const HUNT: Partial<CorsairsPolicy> = { sail: "ships", hunt: "sahir", defend: "none", act: true };

// A Storm on Cobas Haven left a Círdan's Blessing (11205) in the pool, so the Setup offers a copy not in it.
const AFTER_CHOICES = [CODES.cirdanSBlessing11206];
const SINK: Partial<CorsairsPolicy> = { ...HUNT, sail: "pass", sink: "stormcaller" };

export const CORSAIRS_GOLDENS: readonly CorsairsGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", policy: HUNT },
  { name: "true solo, Easy, won", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", policy: HUNT },
  { name: "true solo, after A Storm on Cobas Haven, Ominous Fate in the victory display, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: HUNT, after: true, choices: AFTER_CHOICES },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { ...HUNT, choose: "last" } },
  { name: "true solo, the Stormcaller sunk, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "armed", outcome: "won", policy: SINK },
  { name: "true solo, Hard Mode card, Gavin returned and the Upgraded cards, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: HUNT, mode: "hard", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", policy: HUNT },
  { name: "two-handed, Easy, after A Storm on Cobas Haven, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", policy: HUNT, after: true, choices: AFTER_CHOICES },
  { name: "two-handed, Expert Mode card, Gavin returned and the Upgraded cards, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: HUNT, mode: "expert", upgraded: true },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, the Dream-chaser destroyed, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: HUNT, lossReason: DREAM_CHASER_LOST },
  { name: "two-handed, the Dream-chaser destroyed, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", policy: HUNT, lossReason: DREAM_CHASER_LOST },
  { name: "true solo, the Stormcaller sunk, Captain Sahir not destroyed, lost", seatCount: 1, seed: 30, difficulty: "Normal", decks: "armed", outcome: "lost", policy: SINK, lossReason: THREAT_LOST },
  { name: "two-handed, Captain Sahir not destroyed, lost", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "lost", policy: HUNT, lossReason: THREAT_LOST },
];

const game = campaignGame<CorsairsDecks, CorsairsPolicy>({
  campaign,
  scenario: corsairs,
  // The strong heroes' hit points are 300 here: with nobody defending, they outlast the hunt for Sahír.
  stats: { ...HERO_STATS, strong: { ...HERO_STATS.strong, health: 300 }, armed: { ...HERO_STATS.strong, health: 300 } },
  // The "armed" ships attack as hard as the stand-in heroes do (a ship's own stats are too small for the Stormcaller's 18 hit points and Defense 6).
  shipStats: { armed: { attack: 12, defense: 6, health: 40 } },
  shipCodes: SHIP_CODES,
  // Ominous Fate is in the pool the earlier parts leave.
  codes: [...corsairs.cards.map((card) => card.code), "11176"],
  intent: corsairsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: UPGRADED_CODES,
  // The XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log. Gavin returned: his four boxes are marked.
  earlier: { xp: [4, 3, 5, 4, 4, 5, 4, 1], pool: [{ code: "11176" }, { code: CODES.cirdanSBlessing }], marks: { "11080": 1, "11172": 2, "11184": 3, "11198": 2, [CODES.gavin]: 4 } },
});

export const playGolden = (golden: CorsairsGolden, ctx: ReduceContext): CorsairsGame => game.playGolden(golden, ctx, golden.choices ?? blessingChoices(), { trail: true });

export { DREAM_CHASER_LOST, HUNT, THREAT_LOST };
