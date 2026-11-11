// The Maestro fixtures of The Oath (The Dark of Mirkwood part 1), written into src/campaign/fixtures/the-oath.json by scripts/e2e/fixtures.ts: two real
// games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, from the blank log a new
// `the-dark-of-mirkwood` playthrough starts on (tdom.mini-campaign), so each is a real save. Each seat chose an Adaptation at the Campaign Setup
// Checklist (the first seat's first hero carries The Fervor of Lore, the second seat's The Might of Tactics). Played by the auto-player, every intent one the
// reducer listed.
// `oath-won`: the first seed that wins and has used an Adaptation (so the Campaign Log shows what is used once), parked on the win (41050's Resolution asks
// nothing: 6 or more tokens on the campaign card earn Guilty Conscience). `oath-lost`: the first seed that loses, parked on the loss.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { type CampaignLog } from "../../src/campaign/log.ts";
import { finish, resume } from "../../src/campaign/session.ts";
import { newSave, type Save, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld } from "../../src/campaign/world.ts";
import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { ENGINE_VERSION } from "../../src/rules/engine/version.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import { createLog } from "../log.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { firstSeed, FIXTURE_DECKS, prebuiltDeck } from "./seed-kit.ts";
import { attackTogether, engageOneEach } from "../../test/harness/game-kit.ts";

const say = createLog("e2e-oath");
const ADAPTATIONS = ["41044", "41045"] as const;

// The log The Oath's won game writes: replay the fixture and confirm it (6 or more tokens earn Guilty Conscience; the Adaptations and Stalking Goblin join the pool).
export function oathWonLog(won: OathFixture): CampaignLog {
  const scenario = loadScenario("the-oath");
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const codes = [...won.loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...ADAPTATIONS];
  const world = loadWorld(catalog, loadCampaign(won.campaignId), scenario, EFFECTS, codes);
  const save: Save = { ...newSave("fixture", won.campaignId, 2), loadout: won.loadout, active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: null, seed: won.seed, intents: [...won.intents] } };
  const resumed = resume(save, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  if (!resumed.state.stageCleared || resumed.state.lost) throw new Error("The oath-won fixture does not replay to a win");
  return finish(save, world, resumed.state).log;
}

export type OathFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };

// The auto-player's answer, with what the scenario asks of the players: the second stage's search takes Goblin Trail (the stage cannot be defeated without
// it), a hero stays home to attack and one defends, and every ready character attacks the first enemy it can reach (Goblin Troop must be defeated).
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.length > 1) {
    const trail = state.window.options.find((id) => state.cards[id]?.code === "41014");
    if (trail) return { type: "Choose", optionId: trail };
    if (state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
      const options = [...state.window.options].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0));
      return { type: "Choose", optionId: options[0] ?? "" };
    }
  }
  if (state.window?.kind === "defense") {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx);
    const strongest = [...defenders].sort((a, b) => (ctx.cards.get(state.cards[b]?.code ?? "")?.defense ?? 0) - (ctx.cards.get(state.cards[a]?.code ?? "")?.defense ?? 0))[0];
    if (strongest && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return { type: "DeclareDefender", defenderId: strongest };
    const left = (id: string): number => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0);
    const heroes = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((a, b) => left(b) - left(a));
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  const engaging = engageOneEach(state, ctx, 3);
  if (engaging) return engaging;
  // Each seat keeps its last hero out of the quest, ready to attack.
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => state.cards[id]?.zone === "heroes");
    const home = heroes.length > 1 ? heroes.at(-1) : undefined;
    const questers = ids.filter((id) => id !== home);
    if (questers.length > 0) return { type: "Commit", cardIds: questers };
  }
  return nextIntent(state, ctx, { scout: "", prefer: "41014", protect: "", play: true, act: true }, memory);
}

// Each seat's Adaptation goes on its first hero (the answers to the campaign card's Setup choices, in seat order).
const SPEC = {
  campaignId: "the-dark-of-mirkwood",
  scenarioId: "the-oath",
  seatCount: 2,
  choices: FIXTURE_DECKS.map((id, index) => `${ADAPTATIONS[index]}>${prebuiltDeck(id).heroes[0]}`),
  codes: ADAPTATIONS,
  seeds: 200,
  answer: intentFor,
} as const;

function firstGame(wanted: (state: ScenarioState) => boolean, label: string): OathFixture | null {
  return firstSeed(say, SPEC, "OATH_SEEDS", wanted, label);
}

export function oathFixtures(): Partial<Record<"oath-won" | "oath-lost", OathFixture>> {
  const won = firstGame((state) => state.stageCleared && !state.lost && (state.campaignFacts?.usedOnce.length ?? 0) > 0, "oath-won") ?? firstGame((state) => state.stageCleared && !state.lost, "oath-won");
  const lost = firstGame((state) => state.lost, "oath-lost");
  return { ...(won ? { "oath-won": won } : {}), ...(lost ? { "oath-lost": lost } : {}) };
}
