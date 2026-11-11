// Saves parked on a moment of a scenario, for the Maestro flows that need a finished scenario (docs/architecture.md, Tests):
// a flow opens a fixture instead of playing fifty rounds of unscripted draws. Each fixture is a real loadout of deck cards,
// a seed and the intents that reach the moment; nothing in it is a number the engine computes. The names are in
// `fixtures/registry.ts`, one line per scenario; the e2e fixtures script (`e2e/fixtures.ts` in the scripts folder) writes the JSON beside it and `fixtures.test.ts`
// replays each through the reducer, so a change to the engine or the cards that moves a game fails there and the script is
// run again. A name whose fixture is absent is open (docs/phases/STATUS.md) and is not offered (`hasFixture`): `won` and
// `knife-lost` (no legal win of scenario 1's two starter decks has been found; `knife-lost` starts from the log `won` writes
// when its Resolution is answered with `past.choices`, as the Campaign Setup Checklist carries scenario 1's earned cards to
// scenario 2), and any `-won` the seeds did not find. A part after the first starts from the log the earlier parts' wins write.
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

import type { PlayerIntent } from "../rules/core/intents.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";

import { FIXTURE_REGISTRY, type FixtureName, type FixtureScenarioId } from "./fixtures/registry.ts";
import { emptyLog, type CampaignLog } from "./log.ts";
import { FELLOWSHIP_ID, parseLoadout, parseLog, parseSeatCount, type Save, type StoredLoadout } from "./save.ts";

export type { FixtureName };

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
  const loadout = parseLoadout(stored.loadout);
  if (!loadout) throw new Error(`Fixture ${name} has no loadout`);
  const seatCount = parseSeatCount(stored.seatCount);
  const past = stored.past && isFixtureName(stored.past.fixture) ? { fixture: stored.past.fixture, choices: [...stored.past.choices] } : null;
  // The intents are the reducer's own, written by the script from intents it accepted; the log is the one the scenario 1
  // fixture writes, which fixtures.test.ts checks by replaying that game.
  return { campaignId: stored.campaignId ?? FELLOWSHIP_ID, seatCount, loadout, seed: stored.seed, intents: stored.intents as PlayerIntent[], log: stored.log == null ? emptyLog(seatCount) : parseLog(stored.log), past };
}

/** A new save holding the fixture's open scenario, stamped with this build's engine version and catalog version. */
export function fixtureSave(name: FixtureName, id: string, dataHash: number): Save {
  const found = fixture(name);
  return {
    id,
    campaignId: found.campaignId,
    seatCount: found.seatCount,
    log: found.log,
    active: { engineVersion: ENGINE_VERSION, dataHash, world: null, seed: found.seed, intents: [...found.intents] },
    loadout: found.loadout,
  };
}
