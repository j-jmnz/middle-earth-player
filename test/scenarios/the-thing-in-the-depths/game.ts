import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { campaign, CODES, depths } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { attackTogether, campaignGame, engageOneEach, fillerLoadout, HERO_STATS, STRONG_HEROES as HEROES, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of The Thing in the Depths in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an
// attack) and the decks free events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. The players travel to Helm of the Stormcaller first, then to a location whenever
// they can, engage and attack whatever the engine lets them, answer the choices (the location a Grapple keyword picks among, Come Together's player) with the first option, and let the first hero defend.
export const DEPTHS_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type DepthsDecks = "strong" | "weak" | "brittle";

export const depthsLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose first four parts were won (Ominous Fate in the pool and the XP they gained, marked on a
// Galdor's Counsel and the Dream-chaser): the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const depthsWorld = (decks: DepthsDecks = "strong") => game.world(decks);
export const afterFlight = (seatCount: 1 | 2) => game.after(seatCount);
export const depthsPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const depthsStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type DepthsPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: DepthsPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: the heroes of a seat that has three quest together, the last one staying out when the table has the strength; the players travel to Helm of the Stormcaller
// first and to the first location they can after it; defense falls to the strongest hero; a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function depthsIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: DepthsPolicy = DEFAULT_POLICY): PlayerIntent {
  // A choice among cards (the character a Grasping Arm exhausts, the location a Grapple keyword picks) takes the last option; any other takes the first, or the last as the policy says.
  if (state.window?.kind === "choose" && (policy.choose === "last" || state.window.options.every((option) => state.cards[option] != null))) return { type: "Choose", optionId: state.window.options.at(-1) ?? "" };
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => HEROES.includes(state.cards[id]?.code ?? ""));
    if (heroes.length > 0) {
      const home = heroes.length >= 3 ? heroes.slice(-1) : [];
      // The objective allies stay home with the last hero: they attack, and a Grasping Arm exhausts the last ready character of the list.
      const questers = ids.filter((id) => !home.includes(id) && HEROES.includes(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  if (state.window?.kind === "travel" && legalIntents(state, ctx).some((intent) => intent.type === "Travel")) {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const helm = targets.find((id) => state.cards[id]?.code === CODES.helm);
    if (helm) return { type: "Travel", locationId: helm };
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  // Nobody defends: the home hero stays ready to attack, and the heroes have the hit points to take what comes undefended.
  if (state.window?.kind === "defense") {
    const target = legalTargets(state, { type: "Undefended" }, ctx)[0];
    if (target) return { type: "Undefended", heroId: target };
  }
  const engaging = engageOneEach(state, ctx, 2);
  if (engaging) return engaging;
  return nextIntent(state, ctx, DEPTHS_POLICY, memory, legalIntents(state, ctx));
}

export type DepthsGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-thing-in-the-depths/golden.test.ts). A win runs the campaign card's Resolution and awards its XP; a loss writes nothing.
// `after`: the log of a campaign whose first four parts were won (the pool, XP and marks reach this part). `upgraded`: the Upgraded sides (Black Key, Come Together's level). `mode`: the Hard or Expert Mode card.
export type DepthsGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: DepthsDecks; outcome: "won" | "lost"; policy?: Partial<DepthsPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

export const UPGRADED_CODES = [CODES.blackKey, CODES.blackKeyBurden];
const THREAT_LOST = "No seats remain";
const STORMCALLER_LOST = "The Stormcaller was destroyed";
const SAHIR_LOST = "Captain Sahír left play";
const NAASIYAH_LOST = "Na'asiyah left play";

export const DEPTHS_GOLDENS: readonly DepthsGolden[] = [
  { name: "true solo, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, Easy, won", seatCount: 1, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, after Flight of the Stormcaller, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, the last option of each choice, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", policy: { choose: "last" } },
  { name: "true solo, Hard Mode card, won", seatCount: 1, seed: 8, difficulty: "Normal", decks: "strong", outcome: "won", mode: "hard" },
  { name: "true solo, Upgraded Black Keys and Come Together, won", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", upgraded: true },
  { name: "two-handed, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, after Flight of the Stormcaller, won", seatCount: 2, seed: 1, difficulty: "Easy", decks: "strong", outcome: "won", after: true },
  { name: "two-handed, Expert Mode card, Upgraded Black Keys, won", seatCount: 2, seed: 4, difficulty: "Normal", decks: "strong", outcome: "won", mode: "expert", upgraded: true },
  { name: "true solo, lost on threat with the arms engaged", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, Easy, Na'asiyah destroyed, lost", seatCount: 1, seed: 7, difficulty: "Easy", decks: "strong", outcome: "lost", lossReason: NAASIYAH_LOST },
  { name: "two-handed, a Ship location reaches 9 Threat, lost", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: STORMCALLER_LOST },
  { name: "two-handed, Easy, Captain Sahír destroyed, lost", seatCount: 2, seed: 4, difficulty: "Easy", decks: "strong", outcome: "lost", lossReason: SAHIR_LOST },
  { name: "two-handed, Na'asiyah destroyed, lost", seatCount: 2, seed: 8, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: NAASIYAH_LOST },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "true solo, brittle heroes, lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: THREAT_LOST },
];

const game = campaignGame<DepthsDecks, DepthsPolicy>({
  campaign,
  scenario: depths,
  stats: HERO_STATS,
  codes: [...depths.cards.map((card) => card.code), CODES.ominousFate, CODES.sahirAlly, CODES.naasiyahAlly, CODES.thingOriginal],
  intent: depthsIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: UPGRADED_CODES,
  levels: { [CODES.comeTogether]: 2 },
  earlier: { xp: [4, 3, 5, 4], pool: [{ code: CODES.ominousFate }], marks: { "11080": 1, "11172": 2, "11184": 3 } },
});

export const playGolden = (golden: DepthsGolden, ctx: ReduceContext): DepthsGame => game.playGolden(golden, ctx);
export { NAASIYAH_LOST, SAHIR_LOST, STORMCALLER_LOST, THREAT_LOST };
