// Saves parked on a moment of a scenario, for the tests that need a finished scenario (docs/architecture.md, Tests):
// a flow opens a fixture instead of playing fifty rounds of unscripted draws. Each fixture is a real loadout of deck cards,
// a seed and the intents that reach the moment; nothing in it is a number the engine computes. The names are in
// `fixtures/registry.ts`, one line per scenario; the e2e fixtures script (`e2e/fixtures.ts` in the scripts folder) writes the JSON beside it and `fixtures.test.ts`
// replays each through the reducer, so a change to the engine or the cards that moves a game fails there and the script is
// run again. The registry names only committed fixtures, but two that are not offered (`hasFixture`): `won` and
// `knife-lost` (no legal win of scenario 1's two starter decks has been found; `knife-lost` starts from the log `won` writes
// when its Resolution is answered with `past.choices`, as the Campaign Setup Checklist carries scenario 1's earned cards to
// scenario 2). No won fixture is searched for (docs/architecture.md, Tests). A part after the first starts from the log the earlier parts' wins write.
import knifeFixtures from "./fixtures/a-knife-in-the-dark.json";
import dolGuldurFixtures from "./fixtures/escape-from-dol-guldur.json";
import anduinFixtures from "./fixtures/journey-along-the-anduin.json";
import mirkwoodFixtures from "./fixtures/passage-through-mirkwood.json";
import nibinDumFixtures from "./fixtures/the-caves-of-nibin-dum.json";
import oathFixtures from "./fixtures/the-oath.json";
import voyageFixtures from "./fixtures/voyage-across-belegaer.json";
import fateFixtures from "./fixtures/the-fate-of-numenor.json";
import raidFixtures from "./fixtures/raid-on-the-grey-havens.json";
import stormcallerFixtures from "./fixtures/flight-of-the-stormcaller.json";
import depthsFixtures from "./fixtures/the-thing-in-the-depths.json";
import templeFixtures from "./fixtures/temple-of-the-deceived.json";
import fixtures from "./fixtures/scenario-1.json";
import ruinsFixtures from "./fixtures/the-drowned-ruins.json";
import havenFixtures from "./fixtures/a-storm-on-cobas-haven.json";
import corsairsFixtures from "./fixtures/the-city-of-corsairs.json";
import upanduinFixtures from "./fixtures/journey-up-the-anduin.json";
import lostmirkFixtures from "./fixtures/lost-in-mirkwood.json";
import kingsquestFixtures from "./fixtures/the-kings-quest.json";
import heathFixtures from "./fixtures/the-withered-heath.json";
import rhovanionFixtures from "./fixtures/roam-across-rhovanion.json";
import nightFixtures from "./fixtures/fire-in-the-night.json";
import framsburgFixtures from "./fixtures/the-ghost-of-framsburg.json";
import gundabadFixtures from "./fixtures/mount-gundabad.json";
import wilderlandFixtures from "./fixtures/the-fate-of-wilderland.json";
import haiFixtures from "./fixtures/the-uruk-hai.json";
import deepFixtures from "./fixtures/helms-deep.json";
import isengardFixtures from "./fixtures/the-road-to-isengard.json";
import marshesFixtures from "./fixtures/the-passage-of-the-marshes.json";
import roadsFixtures from "./fixtures/journey-to-the-cross-roads.json";
import lairFixtures from "./fixtures/shelobs-lair.json";
import companyFixtures from "./fixtures/the-passing-of-the-grey-company.json";
import gondorFixtures from "./fixtures/the-siege-of-gondor.json";
import fieldsFixtures from "./fixtures/the-battle-of-the-pelennor-fields.json";
import ungolFixtures from "./fixtures/the-tower-of-cirith-ungol.json";
import opensFixtures from "./fixtures/the-black-gate-opens.json";
import doomFixtures from "./fixtures/mount-doom.json";
import chetwoodFixtures from "./fixtures/intruders-in-chetwood.json";
import hillsFixtures from "./fixtures/the-weather-hills.json";
import dikeFixtures from "./fixtures/deadmens-dike.json";
import eriadorFixtures from "./fixtures/the-wastes-of-eriador.json";
import gramFixtures from "./fixtures/escape-from-mount-gram.json";
import ettenmoorsFixtures from "./fixtures/across-the-ettenmoors.json";
import rhudaurFixtures from "./fixtures/the-treachery-of-rhudaur.json";
import dumFixtures from "./fixtures/the-battle-of-carn-dum.json";
import realmFixtures from "./fixtures/the-dread-realm.json";
import gollumFixtures from "./fixtures/the-hunt-for-gollum.json";
import carrockFixtures from "./fixtures/conflict-at-the-carrock.json";
import rhosgobelFixtures from "./fixtures/a-journey-to-rhosgobel.json";
import muilFixtures from "./fixtures/the-hills-of-emyn-muil.json";
import deadmarshesFixtures from "./fixtures/the-dead-marshes.json";
import returnmirkwoodFixtures from "./fixtures/return-to-mirkwood.json";
import pitFixtures from "./fixtures/into-the-pit.json";
import levelFixtures from "./fixtures/the-seventh-level.json";
import frommoriaFixtures from "./fixtures/flight-from-moria.json";
import gateFixtures from "./fixtures/the-redhorn-gate.json";
import rivendellFixtures from "./fixtures/road-to-rivendell.json";
import waterFixtures from "./fixtures/the-watcher-in-the-water.json";
import darkFixtures from "./fixtures/the-long-dark.json";
import stoneFixtures from "./fixtures/foundations-of-stone.json";
import flameFixtures from "./fixtures/shadow-and-flame.json";
import osgiliathFixtures from "./fixtures/the-massing-at-osgiliath.json";
import townFixtures from "./fixtures/the-battle-of-lake-town.json";
import erechFixtures from "./fixtures/the-stone-of-erech.json";
import forestFixtures from "./fixtures/the-old-forest.json";
import downsFixtures from "./fixtures/fog-on-the-barrow-downs.json";
import belegostFixtures from "./fixtures/the-ruins-of-belegost.json";
import ponyFixtures from "./fixtures/murder-at-the-prancing-pony.json";
import annuminasFixtures from "./fixtures/the-siege-of-annuminas.json";
import guldurFixtures from "./fixtures/attack-on-dol-guldur.json";
import questFixtures from "./fixtures/the-wizards-quest.json";
import woodlandFixtures from "./fixtures/the-woodland-realm.json";
import minesFixtures from "./fixtures/the-mines-of-moria.json";
import khazadFixtures from "./fixtures/escape-from-khazad-dum.json";
import dreadnaughtFixtures from "./fixtures/the-hunt-for-the-dreadnaught.json";
import pelargirFixtures from "./fixtures/peril-in-pelargir.json";
import grimFixtures from "./fixtures/over-the-misty-mountains-grim.json";
import spidersFixtures from "./fixtures/flies-and-spiders.json";
import dayFixtures from "./fixtures/we-must-away-ere-break-of-day.json";
import dimFixtures from "./fixtures/dungeons-deep-and-caverns-dim.json";
import mountainFixtures from "./fixtures/the-lonely-mountain.json";
import ithilienFixtures from "./fixtures/into-ithilien.json";
import armiesFixtures from "./fixtures/the-battle-of-five-armies.json";
import androsFixtures from "./fixtures/the-siege-of-cair-andros.json";
import fearFixtures from "./fixtures/the-stewards-fear.json";
import druadanFixtures from "./fixtures/the-druadan-forest.json";
import dinFixtures from "./fixtures/encounter-at-amon-din.json";
import assaultFixtures from "./fixtures/assault-on-osgiliath.json";
import bloodFixtures from "./fixtures/the-blood-of-gondor.json";
import valeFixtures from "./fixtures/the-morgul-vale.json";
import isenFixtures from "./fixtures/the-fords-of-isen.json";
import orcFixtures from "./fixtures/to-catch-an-orc.json";
import fangornFixtures from "./fixtures/into-fangorn.json";
import umbarFixtures from "./fixtures/escape-from-umbar.json";
import crossingFixtures from "./fixtures/desert-crossing.json";
import trapFixtures from "./fixtures/the-dunland-trap.json";
import mordorFixtures from "./fixtures/the-long-arm-of-mordor.json";
import trialsFixtures from "./fixtures/the-three-trials.json";
import mumakilFixtures from "./fixtures/the-mumakil.json";
import tharbadFixtures from "./fixtures/trouble-in-tharbad.json";
import haradFixtures from "./fixtures/race-across-harad.json";

import type { PlayerIntent } from "../rules/core/intents.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";

import { FIXTURE_REGISTRY, fixtureKindOf, type FixtureName, type FixtureScenarioId } from "./fixtures/registry.ts";
import { parseStandaloneLoadout, type StandaloneGame, type StandaloneLoadout } from "./standalone.ts";
import { emptyLog, type CampaignLog } from "./log.ts";
import { FELLOWSHIP_ID, parseLoadout, parseLog, parseSeatCount, type Save, type StoredLoadout } from "./save.ts";

export type { FixtureName };
export { fixtureKindOf };

// `past`: the scenario 1 fixture and the Resolution answers whose log this fixture starts from.
export type Fixture = { campaignId: string; seatCount: 1 | 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: FixtureName; choices: string[] } | null };

type StoredFixture = { campaignId?: string; seatCount: number; loadout: unknown; seed: number; intents: unknown[]; log?: unknown; past?: { fixture: string; choices: string[] } };

export const FIXTURE_NAMES: readonly FixtureName[] = FIXTURE_REGISTRY.flatMap((entry) => entry.names);

export function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

// The JSON file of each scenario in the registry (Metro needs the static imports; a scenario missing here fails the type check).
const FILES: Readonly<Record<FixtureScenarioId, unknown>> = {
  "a-shadow-of-the-past": fixtures,
  "a-knife-in-the-dark": knifeFixtures,
  "passage-through-mirkwood": mirkwoodFixtures,
  "journey-along-the-anduin": anduinFixtures,
  "escape-from-dol-guldur": dolGuldurFixtures,
  "the-oath": oathFixtures,
  "the-caves-of-nibin-dum": nibinDumFixtures,
  "voyage-across-belegaer": voyageFixtures,
  "the-fate-of-numenor": fateFixtures,
  "raid-on-the-grey-havens": raidFixtures,
  "flight-of-the-stormcaller": stormcallerFixtures,
  "the-thing-in-the-depths": depthsFixtures,
  "temple-of-the-deceived": templeFixtures,
  "the-drowned-ruins": ruinsFixtures,
  "a-storm-on-cobas-haven": havenFixtures,
  "the-city-of-corsairs": corsairsFixtures,
  "journey-up-the-anduin": upanduinFixtures,
  "lost-in-mirkwood": lostmirkFixtures,
  "the-kings-quest": kingsquestFixtures,
  "the-withered-heath": heathFixtures,
  "roam-across-rhovanion": rhovanionFixtures,
  "fire-in-the-night": nightFixtures,
  "the-ghost-of-framsburg": framsburgFixtures,
  "mount-gundabad": gundabadFixtures,
  "the-fate-of-wilderland": wilderlandFixtures,
  "the-uruk-hai": haiFixtures,
  "helms-deep": deepFixtures,
  "the-road-to-isengard": isengardFixtures,
  "the-passage-of-the-marshes": marshesFixtures,
  "journey-to-the-cross-roads": roadsFixtures,
  "shelobs-lair": lairFixtures,
  "the-passing-of-the-grey-company": companyFixtures,
  "the-siege-of-gondor": gondorFixtures,
  "the-battle-of-the-pelennor-fields": fieldsFixtures,
  "the-tower-of-cirith-ungol": ungolFixtures,
  "the-black-gate-opens": opensFixtures,
  "mount-doom": doomFixtures,
  "intruders-in-chetwood": chetwoodFixtures,
  "the-weather-hills": hillsFixtures,
  "deadmens-dike": dikeFixtures,
  "the-wastes-of-eriador": eriadorFixtures,
  "escape-from-mount-gram": gramFixtures,
  "across-the-ettenmoors": ettenmoorsFixtures,
  "the-treachery-of-rhudaur": rhudaurFixtures,
  "the-battle-of-carn-dum": dumFixtures,
  "the-dread-realm": realmFixtures,
  "the-hunt-for-gollum": gollumFixtures,
  "conflict-at-the-carrock": carrockFixtures,
  "a-journey-to-rhosgobel": rhosgobelFixtures,
  "the-hills-of-emyn-muil": muilFixtures,
  "the-dead-marshes": deadmarshesFixtures,
  "return-to-mirkwood": returnmirkwoodFixtures,
  "into-the-pit": pitFixtures,
  "the-seventh-level": levelFixtures,
  "flight-from-moria": frommoriaFixtures,
  "the-redhorn-gate": gateFixtures,
  "road-to-rivendell": rivendellFixtures,
  "the-watcher-in-the-water": waterFixtures,
  "the-long-dark": darkFixtures,
  "foundations-of-stone": stoneFixtures,
  "shadow-and-flame": flameFixtures,
  "the-massing-at-osgiliath": osgiliathFixtures,
  "the-battle-of-lake-town": townFixtures,
  "the-stone-of-erech": erechFixtures,
  "the-old-forest": forestFixtures,
  "fog-on-the-barrow-downs": downsFixtures,
  "the-ruins-of-belegost": belegostFixtures,
  "murder-at-the-prancing-pony": ponyFixtures,
  "the-siege-of-annuminas": annuminasFixtures,
  "attack-on-dol-guldur": guldurFixtures,
  "the-wizards-quest": questFixtures,
  "the-woodland-realm": woodlandFixtures,
  "the-mines-of-moria": minesFixtures,
  "escape-from-khazad-dum": khazadFixtures,
  "the-hunt-for-the-dreadnaught": dreadnaughtFixtures,
  "peril-in-pelargir": pelargirFixtures,
  "into-ithilien": ithilienFixtures,
  "the-siege-of-cair-andros": androsFixtures,
  "the-stewards-fear": fearFixtures,
  "the-druadan-forest": druadanFixtures,
  "encounter-at-amon-din": dinFixtures,
  "assault-on-osgiliath": assaultFixtures,
  "the-blood-of-gondor": bloodFixtures,
  "the-morgul-vale": valeFixtures,
  "we-must-away-ere-break-of-day": dayFixtures,
  "over-the-misty-mountains-grim": grimFixtures,
  "dungeons-deep-and-caverns-dim": dimFixtures,
  "flies-and-spiders": spidersFixtures,
  "the-lonely-mountain": mountainFixtures,
  "the-battle-of-five-armies": armiesFixtures,
  "the-fords-of-isen": isenFixtures,
  "to-catch-an-orc": orcFixtures,
  "into-fangorn": fangornFixtures,
  "the-dunland-trap": trapFixtures,
  "the-three-trials": trialsFixtures,
  "trouble-in-tharbad": tharbadFixtures,
  "escape-from-umbar": umbarFixtures,
  "desert-crossing": crossingFixtures,
  "the-long-arm-of-mordor": mordorFixtures,
  "the-mumakil": mumakilFixtures,
  "race-across-harad": haradFixtures,
};

const STORED: Readonly<Partial<Record<FixtureName, StoredFixture>>> = Object.fromEntries(
  FIXTURE_REGISTRY.flatMap((entry) => {
    const saves = FILES[entry.scenarioId] as Partial<Record<FixtureName, StoredFixture>>;
    return entry.names.flatMap((name) => (saves[name] ? [[name, saves[name]] as const] : []));
  }),
);

// The fixture is committed. The e2e route opens only these.
export function hasFixture(name: FixtureName): boolean {
  return STORED[name] != null;
}

export function fixture(name: FixtureName): Fixture {
  const stored = STORED[name];
  if (!stored) throw new Error(`Fixture ${name} is not committed`);
  if (fixtureKindOf(name) === "standalone") throw new Error(`Fixture ${name} is a standalone game: read it with standaloneFixture`);
  const loadout = parseLoadout(stored.loadout);
  if (!loadout) throw new Error(`Fixture ${name} has no loadout`);
  const seatCount = parseSeatCount(stored.seatCount);
  const past = stored.past && isFixtureName(stored.past.fixture) ? { fixture: stored.past.fixture, choices: [...stored.past.choices] } : null;
  // The intents are the reducer's own, written by the script from intents it accepted; the log is the one the scenario 1
  // fixture writes, which fixtures.test.ts checks by replaying that game.
  return { campaignId: stored.campaignId ?? FELLOWSHIP_ID, seatCount, loadout, seed: stored.seed, intents: stored.intents as PlayerIntent[], log: stored.log == null ? emptyLog(seatCount) : parseLog(stored.log), past };
}

/**
 * A new save holding the fixture's open scenario, stamped with this build's engine version and catalog version. `at` keeps only its first intents, so
 * the save opens on an earlier moment of the same game (the e2e route's `?at=`, the same count `pnpm game show --at` prints).
 */
export function fixtureSave(name: FixtureName, id: string, dataHash: number, at?: number): Save {
  const found = fixture(name);
  return {
    id,
    campaignId: found.campaignId,
    seatCount: found.seatCount,
    log: found.log,
    active: { engineVersion: ENGINE_VERSION, dataHash, world: null, seed: found.seed, intents: found.intents.slice(0, at ?? found.intents.length) },
    loadout: found.loadout,
  };
}

/** What a standalone fixture stores: the cycle, the seat count, the loadout the briefing deals (no log, no choices), the seed and the intents that reach the moment. */
export type StandaloneFixture = { campaignId: string; seatCount: 1 | 2; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };

/** The stored game of a standalone fixture (a scenario of a cycle). */
export function standaloneFixture(name: FixtureName): StandaloneFixture {
  const stored = STORED[name];
  if (!stored) throw new Error(`Fixture ${name} is not committed`);
  if (fixtureKindOf(name) !== "standalone") throw new Error(`Fixture ${name} is a campaign save: read it with fixture`);
  const loadout = parseStandaloneLoadout(stored.loadout);
  if (!loadout) throw new Error(`Fixture ${name} has no loadout`);
  if (stored.campaignId === undefined) throw new Error(`Fixture ${name} names no cycle`);
  return { campaignId: stored.campaignId, seatCount: parseSeatCount(stored.seatCount), loadout, seed: stored.seed, intents: stored.intents as PlayerIntent[] };
}

/** A new standalone game holding the fixture's open scenario, stamped with this build's engine version and catalog version. */
export function fixtureStandalone(name: FixtureName, id: string, dataHash: number, at?: number): StandaloneGame {
  const found = standaloneFixture(name);
  return {
    id,
    campaignId: found.campaignId,
    scenarioId: found.loadout.scenarioId,
    seatCount: found.seatCount,
    loadout: found.loadout,
    active: { engineVersion: ENGINE_VERSION, dataHash, world: null, seed: found.seed, intents: found.intents.slice(0, at ?? found.intents.length) },
    result: null,
  };
}
