// Saves parked on a moment of A Shadow of the Past, for the Maestro flows that need a finished scenario
// (docs/architecture.md, Tests): a flow opens a fixture instead of playing fifty rounds of unscripted draws. Each fixture is a
// real loadout of the two starter decks, a seed and the intents that reach the moment; nothing in it is a number the engine
// computes. The e2e-fixtures script writes them, and `fixtures.test.ts` replays each through the reducer so a change to the
// engine or the cards that moves the game fails there and the script is run again.
import fixtures from "./fixtures/scenario-1.json";

import type { PlayerIntent } from "../rules/intents.ts";
import { ENGINE_VERSION } from "../rules/version.ts";

import { emptyLog } from "./log.ts";
import { FELLOWSHIP_ID, parseLoadout, parseSeatCount, type Save, type StoredLoadout } from "./save.ts";

export type FixtureName = "won" | "lost";

export type Fixture = { seatCount: 1 | 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };

type StoredFixture = { seatCount: number; loadout: unknown; seed: number; intents: unknown[] };

export const FIXTURE_NAMES: readonly FixtureName[] = ["won", "lost"];

export function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

export function fixture(name: FixtureName): Fixture {
  const stored = (fixtures as Record<FixtureName, StoredFixture>)[name];
  const loadout = parseLoadout(stored.loadout);
  if (!loadout) throw new Error(`Fixture ${name} has no loadout`);
  // The intents are the reducer's own, written by the script from intents it accepted.
  return { seatCount: parseSeatCount(stored.seatCount), loadout, seed: stored.seed, intents: stored.intents as PlayerIntent[] };
}

/** A new save holding the fixture's open scenario, stamped with this build's engine version and catalog version. */
export function fixtureSave(name: FixtureName, id: string, dataHash: number): Save {
  const found = fixture(name);
  return {
    id,
    campaignId: FELLOWSHIP_ID,
    seatCount: found.seatCount,
    log: emptyLog(found.seatCount),
    active: { engineVersion: ENGINE_VERSION, dataHash, seed: found.seed, intents: [...found.intents] },
    loadout: found.loadout,
  };
}
