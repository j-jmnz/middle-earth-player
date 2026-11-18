// The fixtures of Journey Along the Anduin (Mirkwood Paths part 2), written into src/campaign/fixtures/journey-along-the-anduin.json by
// scripts/e2e/fixtures.ts: two real games of saved decklists (The One Deck and the Elves of Lórien lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed,
// Easy, from the log the `mirkwood-won` game (scripts/e2e/passage-through-mirkwood.ts) writes when it is confirmed (Passage Through Mirkwood's earned pool reaches
// this scenario through the Campaign Setup Checklist), played by the auto-player, every intent one the reducer listed.
// `anduin-won`: the first seed that wins, parked on the win (01130's Resolution asks nothing: each Valor and Scarred attached to a hero goes to the
// pool on that hero and the hero with the most damage is the prisoner). `anduin-lost`: the first seed that loses when Mendor leaves play (01130:A:5), parked on the loss.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { inArray } from "drizzle-orm";

import { type CampaignLog } from "../../src/campaign/log.ts";
import { cards as cardRows } from "../../src/catalog/schema.ts";
import { finish, resume } from "../../src/campaign/session.ts";
import { newSave, type Save, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld, logCodes } from "../../src/campaign/world.ts";
import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { ENGINE_VERSION } from "../../src/rules/engine/version.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import type { MirkwoodFixture } from "./passage-through-mirkwood.ts";
import { createLog } from "../log.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { firstSeed } from "./seed-kit.ts";
import { attackTogether, engageOneEach } from "../../test/harness/game-kit.ts";

const say = createLog("e2e-anduin");

export type AnduinFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: string; choices: string[] } };

const campaign = loadCampaign("mirkwood-paths");
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

// The log Passage Through Mirkwood's won game writes: replay the fixture and confirm it.
export function passageLog(won: MirkwoodFixture): CampaignLog {
  const scenario = loadScenario("passage-through-mirkwood");
  const codes = won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]);
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", campaign.id, 2), loadout: won.loadout, active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: null, seed: won.seed, intents: [...won.intents] } };
  const resumed = resume(save, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  if (!resumed.state.stageCleared || resumed.state.lost) throw new Error("The mirkwood-won fixture does not replay to a win");
  return finish(save, world, resumed.state).log;
}

// The log Journey Along the Anduin's won game writes: replay the fixture and confirm it (the prisoner is the one its Resolution names).
export function anduinWonLog(won: AnduinFixture): CampaignLog {
  const scenario = loadScenario("journey-along-the-anduin");
  const codes = [...won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(won.log)];
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", campaign.id, 2), log: won.log, loadout: won.loadout, active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: null, seed: won.seed, intents: [...won.intents] } };
  const resumed = resume(save, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  if (!resumed.state.stageCleared || resumed.state.lost) throw new Error("The anduin-won fixture does not replay to a win");
  return finish(save, world, resumed.state).log;
}

// The auto-player's answer, except that Mendor ("if Mendor leaves play, the players lose the game", 01130:A:5) is never chosen when another card can be: not as
// a defender, and not as the ally Pursued by Shadow sends back to its owner's hand (a player never would).
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose") {
    const others = state.window.options.filter((id) => state.cards[id]?.code !== "01135");
    if (others.length > 0 && others.length < state.window.options.length) return { type: "Choose", optionId: others[0] ?? "" };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== "01135");
    const first = defenders.sort((a, b) => ((ctx.cards.get(state.cards[b]?.code ?? "")?.defense ?? 0) - (ctx.cards.get(state.cards[a]?.code ?? "")?.defense ?? 0)))[0];
    if (first && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return { type: "DeclareDefender", defenderId: first };
    // The hero with the most hit points left takes an undefended attack, so no hero dies while another can take it.
    const left = (id: string): number => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0);
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => state.cards[id]?.code !== "01135").sort((a, b) => left(b) - left(a));
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  // The scenario is won by defeating the enemies, which the auto-player alone never attacks: every ready character that can reach the first enemy
  // attacks it together, and each seat engages one enemy at a time in the optional engagement step.
  const together = attackTogether(state, ctx, (id) => state.cards[id]?.code !== "01135");
  if (together) return together;
  const engaging = engageOneEach(state, ctx, 2);
  if (engaging) return engaging;
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
}

// A Core Set hero of each sphere, in place of a hero that fell in Passage Through Mirkwood (checklist step 2: a fallen hero cannot start; a
// player who changes heroes takes the threat penalty, step 3).
const REPLACEMENT: Readonly<Record<string, string>> = { leadership: "01001", tactics: "01004", spirit: "01007", lore: "01010" };

// `after`: the scenario the heroes fell in, for the line that says who replaces whom.
export function replaced(loadout: StoredLoadout, log: CampaignLog, after = "Passage Through Mirkwood"): StoredLoadout {
  const fallen = log.fallenHeroesBySeat.flat();
  const spheres = new Map(catalog.select().from(cardRows).where(inArray(cardRows.code, fallen)).all().map((row) => [row.code, row.sphereCode]));
  // A hero title may be in only one seat (The One Deck has an Éowyn of its own beside the Core Set's), so a candidate is taken by its title.
  const candidates = [...Object.values(REPLACEMENT), "01002", "01005", "01008", "01011"];
  const titles = new Map(catalog.select().from(cardRows).where(inArray(cardRows.code, [...candidates, ...loadout.seats.flatMap((seat) => seat.heroes)])).all().map((row) => [row.code, row.name]));
  const taken = new Set(loadout.seats.flatMap((seat) => seat.heroes.map((code) => titles.get(code) ?? code)));
  const seats = loadout.seats.map((seat, index) => ({
    ...seat,
    heroes: seat.heroes.map((code) => {
      if (!(log.fallenHeroesBySeat[index] ?? []).includes(code)) return code;
      const sphere = spheres.get(code) ?? "neutral";
      const candidate = [REPLACEMENT[sphere] ?? "01001", "01002", "01005", "01008", "01011"].find((hero) => !taken.has(titles.get(hero) ?? hero)) ?? "01001";
      taken.add(titles.get(candidate) ?? candidate);
      say.info(`${code} fell in ${after}: seat ${index + 1} starts ${candidate} in its place`);
      return candidate;
    }),
  }));
  return { ...loadout, seats, acceptPenalty: fallen.length > 0 };
}

// A fixture whose game is not found is left out (a name whose fixture is absent is not offered, `hasFixture`).
export function anduinFixtures(passage: MirkwoodFixture): Partial<Record<"anduin-won" | "anduin-lost", AnduinFixture>> {
  const log = passageLog(passage);
  const loadout: StoredLoadout = replaced({ ...passage.loadout, scenarioId: "journey-along-the-anduin" }, log);
  const past = { fixture: "mirkwood-won", choices: [] as string[] };
  const first = (wanted: (state: ScenarioState) => boolean, label: string): AnduinFixture | null => {
    const found = firstSeed(say, { campaignId: "mirkwood-paths", scenarioId: "journey-along-the-anduin", seatCount: 2, loadout, log, limit: 6000, seeds: 60, answer: intentFor }, "ANDUIN_SEEDS", wanted, label);
    return found && { ...found, log, past };
  };
  const won = first((state) => state.stageCleared && !state.lost, "anduin-won");
  const lost = first((state) => state.lost && (state.lossReason ?? "").includes("Mendor left play"), "anduin-lost");
  return { ...(won ? { "anduin-won": won } : {}), ...(lost ? { "anduin-lost": lost } : {}) };
}
