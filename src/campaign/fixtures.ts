// Saves parked on a moment of a scenario, for the Maestro flows that need a finished scenario (docs/architecture.md, Tests):
// a flow opens a fixture instead of playing fifty rounds of unscripted draws. Each fixture is a real loadout of deck cards,
// a seed and the intents that reach the moment; nothing in it is a number the engine computes. `won` and `lost` are games of
// A Shadow of the Past from an empty log. `knife-lost` is a game of A Knife in the Dark, parked on its loss, from the log
// the `won` game writes when its Resolution is answered with `past.choices` (scenario 1's earned cards reach scenario 2
// through the Campaign Setup Checklist). The e2e-fixtures script writes them, and `fixtures.test.ts` replays each through the
// reducer (and the scenario 1 game into that log) so a change to the engine or the cards that moves a game fails there and
// the script is run again. `won`, and so `knife-lost`, are open (docs/phases/STATUS.md): no legal win of the two starter
// decks has been found, so neither is committed, and a name whose fixture is absent is not offered (`hasFixture`).
import knifeFixtures from "./fixtures/a-knife-in-the-dark.json";
import fixtures from "./fixtures/scenario-1.json";

import type { PlayerIntent } from "../rules/intents.ts";
import { ENGINE_VERSION } from "../rules/version.ts";

import { emptyLog, type CampaignLog } from "./log.ts";
import { FELLOWSHIP_ID, parseLoadout, parseLog, parseSeatCount, type Save, type StoredLoadout } from "./save.ts";

export type FixtureName = "won" | "lost" | "knife-lost";

// `past`: the scenario 1 fixture and the Resolution answers whose log this fixture starts from.
export type Fixture = { seatCount: 1 | 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: FixtureName; choices: string[] } | null };

type StoredFixture = { seatCount: number; loadout: unknown; seed: number; intents: unknown[]; log?: unknown; past?: { fixture: string; choices: string[] } };

export const FIXTURE_NAMES: readonly FixtureName[] = ["won", "lost", "knife-lost"];

export function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

const STORED: Readonly<Partial<Record<FixtureName, StoredFixture>>> = {
  ...(fixtures as Partial<Record<"won" | "lost", StoredFixture>>),
  ...(knifeFixtures as Partial<Record<"knife-lost", StoredFixture>>),
};

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
  return { seatCount, loadout, seed: stored.seed, intents: stored.intents as PlayerIntent[], log: stored.log == null ? emptyLog(seatCount) : parseLog(stored.log), past };
}

/** A new save holding the fixture's open scenario, stamped with this build's engine version and catalog version. */
export function fixtureSave(name: FixtureName, id: string, dataHash: number): Save {
  const found = fixture(name);
  return {
    id,
    campaignId: FELLOWSHIP_ID,
    seatCount: found.seatCount,
    log: found.log,
    active: { engineVersion: ENGINE_VERSION, dataHash, seed: found.seed, intents: [...found.intents] },
    loadout: found.loadout,
  };
}
