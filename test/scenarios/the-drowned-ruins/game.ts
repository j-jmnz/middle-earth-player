import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, CODES, ruins } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, STRONG_HEROES, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Drowned Ruins in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to the Underwater side of a Grotto location when they can (a Grotto location they travel to is
// flipped by its Response) and to the Grotto side otherwise, keep each Underwater location Underwater when its Forced effect offers the flip back, and engage and attack whatever the engine lets them. Once the stage is
// Sahír's Betrayal they travel on to the Shrine to Morgoth. They answer the other choices with the first option, and let the first hero defend.
export const RUINS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
export type RuinsDecks = "strong" | "weak" | "brittle";

export const ruinsLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const ruinsWorld = (decks: RuinsDecks = "strong") => game.world(decks);
export const afterTemple = (seatCount: 1 | 2) => game.after(seatCount);
export const ruinsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount), choices: readonly string[] = commandChoices(seatCount)) => game.plan(seatCount, log, choices);
export const ruinsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard, choices: readonly string[] = commandChoices(seatCount)) => game.start(seatCount, seed, difficulty, facts, log, modeCard, choices);

export type RuinsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The objective ally who defends every attack, when able (the game is lost if he or she leaves play, 11077:A:4, 11079:A:4).
  defender?: "sahir" | "naasiyah";
};
export const DEFAULT_POLICY: RuinsPolicy = { choose: "first" };

const codeOf = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";
const GROTTO_SIDES: readonly string[] = [CODES.underseaGrotto, CODES.cursedCaverns, CODES.waterLoggedHalls];

/** The location the players travel to: the Shrine to Morgoth when it is a target, else an Underwater location (the Underwater side of a Grotto location, or Drowned Cave), else a Grotto side the Response will flip, else the first. */
export function ruinsTravel(state: ScenarioState, targets: readonly string[], ctx: ReduceContext): string | undefined {
  const underwater = (id: string) => ctx.cards.get(codeOf(state, id))?.traits.includes("Underwater") === true;
  const shrine = targets.find((id) => [CODES.shrineToMorgoth, "12095"].includes(codeOf(state, id)));
  if (shrine) return shrine;
  return targets.find((id) => underwater(id)) ?? targets.find((id) => GROTTO_SIDES.includes(codeOf(state, id))) ?? targets[0];
}

// The auto-player's answer (test/harness/auto-player.ts), except: the players travel as ruinsTravel says and flip the Grotto location they travel to (the Response is taken); an Underwater location
// stays Underwater (the first player declines its flip back); they engage and attack whatever the engine lets them; the first hero defends, or the objective ally the policy names; a choice takes the first option, or the last
// as the policy says. Every intent is one the reducer listed.
export function ruinsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: RuinsPolicy = DEFAULT_POLICY): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") {
    const options = state.window.options;
    if (options.includes("stay") && options.includes("flip")) return { type: "Choose", optionId: "stay" };
    return { type: "Choose", optionId: (policy.choose === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  if (state.window?.kind === "response") {
    const flip = intents.find((intent) => intent.type === "Trigger" && /^(12098|12099|12100):response:1$/.test(intent.effectId));
    if (flip?.type === "Trigger") return { type: "Trigger", cardId: flip.cardId, effectId: flip.effectId };
  }
  if (state.window?.kind === "travel" && intents.some((intent) => intent.type === "Travel")) {
    const pick = ruinsTravel(state, legalTargets(state, { type: "Travel" }, ctx), ctx);
    if (pick) return { type: "Travel", locationId: pick };
  }
  // The objective ally the policy sends to defend stays home from the quest, ready.
  if (policy.defender && state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const heroes = legalTargets(state, { type: "Commit" }, ctx).filter((id) => STRONG_HEROES.includes(codeOf(state, id)));
    if (heroes.length > 0) return { type: "Commit", cardIds: heroes };
  }
  if (state.window?.kind === "defense" && policy.defender) {
    const wanted = policy.defender === "sahir" ? CODES.captainSahir : CODES.naAsiyah;
    const defender = legalTargets(state, { type: "DeclareDefender" }, ctx).find((id) => codeOf(state, id) === wanted);
    if (defender) return { type: "DeclareDefender", defenderId: defender };
  }
  const engaging = engageOneEach(state, ctx, 2);
  if (engaging) return engaging;
  const attack = attackTogether(state, ctx);
  if (attack) return attack;
  return nextIntent(state, ctx, RUINS_POLICY, memory, intents);
}

export type RuinsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-drowned-ruins/golden.test.ts), also played by the causes and replay tests once test/harness/golden-registry.ts lists them.
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides (Black Key). `mode`: the Hard or Expert Mode card.
export type RuinsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: RuinsDecks; outcome: "won" | "lost"; policy?: Partial<RuinsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string; choices?: readonly string[] };

// The campaign card's Setup (11200:A:2) through the Campaign Setup Checklist: each seat in turn may take one copy of Command ("skip" refuses), then each seat in turn may take the one copy of Cirdan's Blessing until a player has (the first player does here).
export const commandChoices = (seatCount: 1 | 2): string[] => [...(seatCount === 1 ? [CODES.command] : [CODES.command, CODES.command11202]), CODES.cirdanSBlessing];

export const UPGRADED_CODES = [CODES.blackKey];
const THREAT_LOST = "No seats remain";

const SAHIR_LOST = "Captain Sahír left play";
const NAASIYAH_LOST = "Na'asiyah left play";

export const RUINS_GOLDENS: readonly RuinsGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, after Temple of the Deceived, won", seatCount: 1, seed: 3, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "true solo, Hard Mode card, Upgraded Black Key, won", seatCount: 1, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, after Temple of the Deceived, won", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, no Command taken, won", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", choices: ["skip", "skip", "skip", "skip"] },
  { name: "two-handed, Expert Mode card, Upgraded Black Key, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 3, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, Captain Sahír destroyed, lost", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { defender: "sahir" }, lossReason: SAHIR_LOST },
  { name: "two-handed, Na'asiyah destroyed, lost", seatCount: 2, seed: 3, difficulty: "Normal", decks: "strong", outcome: "lost", policy: { defender: "naasiyah" }, lossReason: NAASIYAH_LOST },
];

const game = campaignGame<RuinsDecks, RuinsPolicy>({
  campaign,
  scenario: ruins,
  stats: HERO_STATS,
  // The Underwater sides of the Grotto deck and of the Shrine to Morgoth are cards of their own; Ominous Fate is in the pool the earlier parts leave.
  codes: [...ruins.cards.flatMap((card) => [card.code, ...(card.back != null ? [card.back] : [])]), "11176"],
  intent: ruinsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: UPGRADED_CODES,
  // The XP each earlier part gained (in campaign order), the cards they put in the pool and the marks on the cards, as a campaign that won them leaves the log.
  earlier: { xp: [4, 3, 5, 4, 4, 5], pool: [{ code: "11176" }], marks: { "11080": 1, "11172": 2, "11184": 3, "11198": 2 } },
});

export const playGolden = (golden: RuinsGolden, ctx: ReduceContext): RuinsGame => game.playGolden(golden, ctx, golden.choices ?? commandChoices(golden.seatCount));
export { NAASIYAH_LOST, SAHIR_LOST, THREAT_LOST };
