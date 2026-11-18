import { emptyLog, type CampaignLog } from "../../../src/campaign/log.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { CampaignFacts, ModeCard } from "../../../src/rules/core/campaign-state.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { TREASURES, campaign, lostmirk } from "./scene.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaignGame, fillerLoadout, HERO_STATS, type PlayedGame } from "../../harness/game-kit.ts";

// Test helper. A whole game of Lost in Mirkwood in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. TODO: say how the players travel, engage and answer the choices this scenario asks.
export const LOSTMIRK_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "18070", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat; "brittle": strong questers that die to an attack.
export type LostmirkDecks = "strong" | "weak" | "brittle";

export const lostmirkLoadout = fillerLoadout;

// The goldens' world, the plan and start of a game, and the log of a campaign whose earlier parts were won: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const lostmirkWorld = (decks: LostmirkDecks = "strong") => game.world(decks);
export const afterUpanduin = (seatCount: 1 | 2) => game.after(seatCount);
export const lostmirkPlan = (seatCount: 1 | 2, log: CampaignLog = emptyLog(seatCount)) => game.plan(seatCount, log);
export const lostmirkStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, facts?: Omit<CampaignFacts, "modeCard">, log: CampaignLog = emptyLog(seatCount), modeCard?: ModeCard) => game.start(seatCount, seed, difficulty, { facts, log, modeCard });

export type LostmirkPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
  // The Resolution's offer: Melanwar joins the pool for the first seat's player (first) or the guidance line is written (last).
  resolve: "first" | "last";
  // Where the players travel: "escape" aims at stage 4C (see below), "any" takes the first location offered.
  route: "escape" | "any";
};
export const DEFAULT_POLICY: LostmirkPolicy = { choose: "first", resolve: "first", route: "escape" };
const OBJECTIVE_LOCATIONS: readonly string[] = ["18029", "18030", "18031", "18032"];
const ESCAPE_LOCATIONS: readonly string[] = ["18030", "18032"];

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
// `options`: the auto-player's own policy for the answers this one does not give; the fixtures (scripts/e2e/lost-in-mirkwood.ts) play real decklists, so they turn card play on.
export function lostmirkIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: LostmirkPolicy = DEFAULT_POLICY, options: PolicyOptions = LOSTMIRK_POLICY): PlayerIntent {
  // The Resolution's offer (Melanwar joins the pool for a player, or the guidance line): the first option is the ally, the last the line.
  if (state.window?.kind === "resolution") {
    const options = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    return { type: "ChooseResolution", optionId: (policy.resolve === "last" ? options.at(-1) : options[0]) ?? "" };
  }
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  // The nemesis (stage 4A) holds the stage shut: it is engaged and attacked first. Nobody else engages: an engaged enemy costs threat (stage 1B, and each round in stage 4C).
  const isNemesis = (id: string) => state.cards[id]?.nemesis === true;
  if (state.window?.kind === "optionalEngage") {
    const nemesis = legalTargets(state, { type: "Engage" }, ctx).find(isNemesis);
    return nemesis ? { type: "Engage", enemyId: nemesis } : { type: "DeclineEngage" };
  }
  // Each character attacks alone, the nemesis first: the enemies engaged with the seat fall one for each hero.
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const mine = Object.values(state.cards).filter((card) => card.controller === state.activeSeat && (card.zone === "heroes" || card.zone === "play")).map((card) => card.id);
    for (const character of mine) {
      const enemies = legalTargets(state, { type: "DeclareAttackers", cardId: character }, ctx);
      const enemy = enemies.find(isNemesis) ?? enemies[0];
      if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [character] };
    }
  }
  // Stage 4C, Escape from Taur-nu-fuin, is reached when the third jump of the quest is made through Abandoned Village or Forest Clearing (the next stage C): "escape" travels to the Objective-Locations that keep one of them for the third jump,
  // else to a location that is not an Objective-Location, else nowhere. "any" travels to the first location it may.
  if (state.window?.kind === "travel" && policy.route === "escape") {
    const targets = legalTargets(state, { type: "Travel" }, ctx);
    const used = (code: string) => Object.values(state.cards).some((card) => card.code === code && (card.zone === "victory" || card.zone === "activeLocation"));
    const jumps = OBJECTIVE_LOCATIONS.filter(used).length;
    const freeC = ESCAPE_LOCATIONS.filter((code) => !used(code)).length;
    const allowed = (code: string) => OBJECTIVE_LOCATIONS.includes(code) && !used(code) && (jumps >= 2 ? ESCAPE_LOCATIONS.includes(code) : !ESCAPE_LOCATIONS.includes(code) || freeC >= 2);
    const wanted = targets.find((id) => allowed(state.cards[id]?.code ?? "")) ?? targets.find((id) => !OBJECTIVE_LOCATIONS.includes(state.cards[id]?.code ?? ""));
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  return nextIntent(state, ctx, options, memory, legalIntents(state, ctx));
}

export type LostmirkGame = PlayedGame;

// The goldens (src/campaign/scenarios/lost-in-mirkwood/golden.test.ts).
// `after`: the log of a campaign whose earlier parts were won. `upgraded`: the Upgraded sides. `mode`: the Hard or Expert Mode card.
export type LostmirkGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: LostmirkDecks; outcome: "won" | "lost"; policy?: Partial<LostmirkPolicy>; after?: boolean; upgraded?: boolean; mode?: ModeCard; lossReason?: string };

// The pinned games: wins (true solo and two-handed, Normal and Easy, Melanwar joining the pool and the guidance line, a treasure discovered, the quest through Carried Away and through Truly Lost to Escape from Taur-nu-fuin) and losses (the
// threat reaching 50, the first player's elimination taking Haldan with it, every hero dead), each on a fixed seed.
export const LOSTMIRK_GOLDENS: readonly LostmirkGolden[] = [
  { name: "true solo, won, Melanwar joins the pool, a treasure discovered, a hero carried away", seatCount: 1, seed: 24, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, hands under the locations, a treasure discovered", seatCount: 1, seed: 13, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, no treasure discovered", seatCount: 1, seed: 17, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, won, after Journey Up the Anduin (Turayn in the pool)", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", after: true },
  { name: "true solo, Easy, won, the guidance line", seatCount: 1, seed: 18, difficulty: "Easy", decks: "strong", outcome: "won", policy: { resolve: "last" } },
  { name: "two-handed, won, Melanwar joins the pool, a treasure discovered", seatCount: 2, seed: 16, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, Easy, won, the guidance line", seatCount: 2, seed: 36, difficulty: "Easy", decks: "strong", outcome: "won", policy: { resolve: "last" } },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "true solo, brittle, lost with every hero dead", seatCount: 1, seed: 3, difficulty: "Normal", decks: "brittle", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed, weak, lost: the first player's threat takes Haldan out of play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "Haldan left play" },
  { name: "two-handed, lost: a player eliminated on threat takes Haldan out of play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Haldan left play" },
];
const STATS = { ...HERO_STATS, strong: { ...HERO_STATS.strong, willpower: 100 }, brittle: { ...HERO_STATS.brittle, willpower: 100 } } as const;

const game = campaignGame<LostmirkDecks, LostmirkPolicy>({
  campaign,
  scenario: lostmirk,
  stats: STATS,
  // The scenario's cards, the cards its campaign card places (Melanwar), Haldan, the treasures the campaign card can attach, and what the first part leaves in the pool: Turayn, A Growing Threat and any card of its encounter sets.
  codes: [...lostmirk.cards.map((card) => card.code), ...lostmirk.campaignPlaced, "12166", "12167", "18070", ...TREASURES, ...loadScenario("journey-up-the-anduin").cards.map((card) => card.code)],
  intent: lostmirkIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
  upgraded: [],
  // Journey Up the Anduin gained no XP (the campaign has none), put Turayn in the first seat's pool and marked no card.
  earlier: { xp: [0], pool: [{ code: "12166", seat: 0 }], marks: {} },
});

export const playGolden = (golden: LostmirkGolden, ctx: ReduceContext): LostmirkGame => game.playGolden(golden, ctx);
