// The Maestro fixtures of Temple of the Deceived (Dream-chaser part 6), written into src/campaign/fixtures/temple-of-the-deceived.json by scripts/e2e-fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `temple-won` is the first seed that wins, parked on the win (the Resolution waits); `temple-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the first five parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps this part locked and the path opens Voyage Across Belegaer): it is the
// log of `scripts/e2e-depths.ts` (the Voyage, Fate, Raid and Flight goldens' wins), and on top of it the one of The Thing in the Depths' golden ("two-handed, won"), each run through the same `applyResolution` that writes
// it in the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won`, `fate-won`, `raid-won`, `stormcaller-won` and `depths-won`, real-decklist wins, are open
// (docs/phases/STATUS.md). The Campaign Setup asks no choice (its questions, damage for threat and Spyglass for threat, come in the game and the policy answers them); the Resolution asks which player a Recurring Nightmare
// goes to when one was flipped.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyResolution, type CampaignLog } from "../src/campaign/log.ts";
import { contextOf, deal, resume } from "../src/campaign/session.ts";
import { newSave, type StoredLoadout } from "../src/campaign/save.ts";
import { loadWorld, logCodes } from "../src/campaign/world.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { reduce, legalIntents, legalTargets, type PlayerIntent, type ScenarioState, type ReduceContext } from "../src/rules/engine/reduce.ts";

import { DEPTHS_GOLDENS, depthsWorld, playGolden as playDepths } from "./depths-game.ts";
import { stormcallerWonLog } from "./e2e-depths.ts";
import { intentFor, listed } from "./e2e-raid.ts";
import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { createLog } from "./log.ts";
import { keyClaimed, templeTravel } from "./temple-game.ts";
import { temporaryCatalog } from "./temp-catalog.ts";

const say = createLog("e2e-temple");
const DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
const CAMPAIGN = "dream-chaser";
const ELITE: readonly string[] = ["11077", "11079"];

export type TempleFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type TempleFixtureName = "temple-won" | "temple-lost";

// The log of a playthrough whose first five parts were won: the log of the first four (scripts/e2e-depths.ts), then the Depths golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function depthsWonLog(): Promise<CampaignLog> {
  const before = await stormcallerWonLog();
  const golden = DEPTHS_GOLDENS.find((item) => item.name === "two-handed, won");
  if (!golden) throw new Error("The Depths golden \"two-handed, won\" is gone");
  const world = await depthsWorld(golden.decks);
  const game = playDepths(golden, world.ctx);
  if (!game.state.stageCleared || game.state.lost) throw new Error("The Depths golden no longer wins");
  const written = applyResolution(before, game.state.scenarioId, game.state, world.cards);
  return { ...written, heroesBySeat: before.heroesBySeat, fallenHeroesBySeat: before.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) };
}

type Game = { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState };

// The saved decklists' policy (scripts/e2e-raid.ts), except that the players travel as the Temple game's policy does (scripts/temple-game.ts) and claim the Gate Key when it falls free.
export function intentForTemple(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "travel" && intents.some((intent) => intent.type === "Travel")) {
    const pick = templeTravel(state, legalTargets(state, { type: "Travel" }, ctx));
    if (pick) return { type: "Travel", locationId: pick };
  }
  // Captain Sahír and Na'asiyah never defend and take no damage the players assign: the game is lost if either leaves play (11077:A:4, 11079:A:4).
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => !ELITE.includes(state.cards[id]?.code ?? "")) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const bare = [...legalTargets(state, { type: "Undefended" }, ctx)].filter((id) => !ELITE.includes(state.cards[id]?.code ?? "")).sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (bare) return { type: "Undefended", heroId: bare };
  }
  // Archery damage is spread over the heroes, one point at a time to the least wounded.
  if (state.window?.kind === "archery" && intents.some((intent) => intent.type === "Distribute")) {
    const heroes = legalTargets(state, { type: "Distribute" }, ctx).filter((id) => state.cards[id]?.zone === "heroes");
    if (heroes.length > 0) {
      const given = new Map<string, number>();
      for (let point = 0; point < state.window.total; point += 1) {
        const target = [...heroes].sort((a, b) => (state.cards[a]?.damage ?? 0) + (given.get(a) ?? 0) - ((state.cards[b]?.damage ?? 0) + (given.get(b) ?? 0)))[0] ?? "";
        given.set(target, (given.get(target) ?? 0) + 1);
      }
      return { type: "Distribute", assignments: [...given].map(([cardId, amount]) => ({ cardId, amount })) };
    }
  }
  const claim = intents.find((intent) => intent.type === "Trigger" && /^110078:action:[13]$/.test(intent.effectId));
  if (claim?.type === "Trigger" && !keyClaimed(state)) return { type: "Trigger", cardId: claim.cardId, effectId: claim.effectId };
  return intentFor(state, ctx, memory);
}

function play(seed: number, log: CampaignLog): Game {
  const campaign = loadCampaign(CAMPAIGN);
  const scenario = loadScenario("temple-of-the-deceived");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = DECKS.map((id) => ({ deckId: id, ...listed(id) }));
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)]);
  const dealt = deal({ ...newSave("fixture", campaign.id, 2), log }, world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 8000 && !state.lost && !state.stageCleared; turn += 1) {
    const intent = intentForTemple(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { loadout, intents, state };
}

function firstSeed(log: CampaignLog, wanted: (state: ScenarioState) => boolean, label: string): TempleFixture | null {
  const limit = Number(process.env.TEMPLE_SEEDS ?? 100);
  for (let seed = 1; seed <= limit; seed += 1) {
    const game = play(seed, log);
    say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "stalled"}`);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : "won"}`);
    return { campaignId: CAMPAIGN, seatCount: 2, loadout: game.loadout, seed, intents: game.intents, log };
  }
  say.warn(`no ${label} game found in ${limit} seeds`);
  return null;
}

export async function templeFixtures(): Promise<Partial<Record<TempleFixtureName, TempleFixture>>> {
  const log = await depthsWonLog();
  const won = firstSeed(log, (state) => state.stageCleared && !state.lost, "temple-won");
  const lost = firstSeed(log, (state) => state.lost, "temple-lost");
  return { ...(won ? { "temple-won": won } : {}), ...(lost ? { "temple-lost": lost } : {}) };
}
