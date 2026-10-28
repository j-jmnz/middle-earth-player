// The Maestro fixtures of Escape from Dol Guldur (Mirkwood Paths part 3), written into src/campaign/fixtures/escape-from-dol-guldur.json by
// scripts/e2e-fixtures.ts: two real games of saved decklists (the Dwarves of Durin and Elves of Lórien lists of data/decks/prebuilt.json), two-handed,
// Easy, from the log the `anduin-won` game writes when it is confirmed (scripts/e2e-anduin.ts): its prisoner, its pool. That win is open (no fixture,
// docs/phases/STATUS.md), and nothing here builds a log by hand, so no fixture of this scenario is written until `anduin-won` exists. Played by the auto-player,
// every intent one the reducer listed.
// `dol-guldur-won`: the first seed that wins, parked on the win (01131's Resolution asks nothing: Mendor, if he is still in play, and each
// player's Mendor's Support are kept for the next campaign). `dol-guldur-lost`: the first seed that loses, parked on the loss.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { type CampaignLog } from "../src/campaign/log.ts";
import { contextOf, deal, resume } from "../src/campaign/session.ts";
import { newSave, type StoredLoadout } from "../src/campaign/save.ts";
import { loadWorld, logCodes } from "../src/campaign/world.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { characters, legalAttackEnemies } from "../src/rules/combat.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";

import { nextIntent } from "./auto-player.ts";
import { loadCampaign, loadScenario } from "./data/load-scenarios.ts";
import { anduinWonLog, replaced, type AnduinFixture } from "./e2e-anduin.ts";
import { createLog } from "./log.ts";
import { temporaryCatalog } from "./temp-catalog.ts";

const say = createLog("e2e-dol-guldur");

export type DolGuldurFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: string; choices: string[] } };

const campaign = loadCampaign("mirkwood-paths");
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

// The log a real win of Journey Along the Anduin writes (`anduin-won`, replayed and confirmed): its prisoner is the one 01130:B:1 names. The first
// player attaches Appointed by Fate (01131:A:2) to a hero that is not the prisoner.
function anduinLog(anduin: AnduinFixture): { log: CampaignLog; loadout: StoredLoadout } {
  const log = anduinWonLog(anduin);
  const swapped = replaced({ ...anduin.loadout, scenarioId: "escape-from-dol-guldur" }, log);
  const heroes = swapped.seats.flatMap((seat) => seat.heroes);
  const bearer = heroes.find((code) => code !== log.prisoner) ?? heroes[0];
  return { log, loadout: { ...swapped, choices: [`01134>${bearer}`] } };
}

// The auto-player's answer, with what the scenario asks of the players: a hero stays home to attack and one defends, Dungeon Torch is claimed last,
// a claimed objective goes on the hero with the fewest attachments, and every ready character attacks the first enemy it can reach.
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.length > 1 && state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
    const options = [...state.window.options].sort((a, b) => (state.cards[a]?.attachments.length ?? 0) - (state.cards[b]?.attachments.length ?? 0));
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== "01135");
    const strongest = [...defenders].sort((a, b) => (ctx.cards.get(state.cards[b]?.code ?? "")?.defense ?? 0) - (ctx.cards.get(state.cards[a]?.code ?? "")?.defense ?? 0))[0];
    if (strongest && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return { type: "DeclareDefender", defenderId: strongest };
    const left = (id: string): number => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0);
    const heroes = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((a, b) => left(b) - left(a));
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const enemy = ready.map((id) => legalAttackEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
    const attackers = ready.filter((id) => enemy != null && legalAttackEnemies(state, seat, id, ctx.cards).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
    if (enemy && seat && seat.engaged.length < 3) return { type: "Engage", enemyId: enemy };
  }
  // Each seat keeps its last hero out of the quest, ready to attack.
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => state.cards[id]?.zone === "heroes");
    const home = heroes.length > 1 ? heroes.at(-1) : undefined;
    const questers = ids.filter((id) => id !== home);
    if (questers.length > 0) return { type: "Commit", cardIds: questers };
  }
  // Dungeon Torch raises its hero's controller's threat by 2 every round: it is claimed last, once the prisoner is rescued.
  const stage = state.cards[state.questStage ?? ""]?.code;
  const held = Object.values(state.cards).some((card) => card.zone === "captive" && card.prisoner === true && card.host == null);
  const intents = legalIntents(state, ctx).filter((intent) => !((stage === "01123" || held) && intent.type === "Trigger" && intent.effectId === "01109:action:1"));
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, intents);
}

function play(log: CampaignLog, loadout: StoredLoadout, seed: number): { intents: PlayerIntent[]; state: ScenarioState } {
  const scenario = loadScenario("escape-from-dol-guldur");
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)]);
  const dealt = deal({ ...newSave("fixture", campaign.id, 2), log }, world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < 6000 && !state.lost && !state.stageCleared; turn += 1) {
    const intent = intentFor(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { intents, state };
}

// A fixture whose game is not found is left out (a name whose fixture is absent is not offered, `hasFixture`). With no `anduin-won` fixture there is no
// honest log for this scenario to start from (docs/phases/phase-13-flight-to-the-ford.md: a fixture is a real save), so none is written.
export function dolGuldurFixtures(anduin: AnduinFixture | undefined): Partial<Record<"dol-guldur-won" | "dol-guldur-lost", DolGuldurFixture>> {
  if (!anduin) {
    say.warn("no anduin-won fixture: Escape from Dol Guldur's fixtures are open until Journey Along the Anduin has a won game");
    return {};
  }
  const { log, loadout } = anduinLog(anduin);
  const past = { fixture: "anduin-won", choices: [] as string[] };
  const first = (wanted: (state: ScenarioState) => boolean, label: string): DolGuldurFixture | null => {
    for (let seed = 1; seed <= Number(process.env.DOL_GULDUR_SEEDS ?? 60); seed += 1) {
      const game = play(log, loadout, seed);
      say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "stalled"}`);
      if (!wanted(game.state)) continue;
      say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${game.state.lost ? game.state.lossReason : "won"}`);
      return { campaignId: "mirkwood-paths", seatCount: 2, loadout, seed, intents: game.intents, log, past };
    }
    say.warn(`no ${label} game found in ${process.env.DOL_GULDUR_SEEDS ?? 60} seeds`);
    return null;
  };
  const won = first((state) => state.stageCleared && !state.lost, "dol-guldur-won");
  const lost = first((state) => state.lost, "dol-guldur-lost");
  return { ...(won ? { "dol-guldur-won": won } : {}), ...(lost ? { "dol-guldur-lost": lost } : {}) };
}
