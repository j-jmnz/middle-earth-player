// Saves parked on a moment of a scenario, for the Maestro flows that need a finished scenario (docs/architecture.md, Tests):
// a flow opens a fixture instead of playing fifty rounds of unscripted draws. Each fixture is a real loadout of deck cards,
// a seed and the intents that reach the moment; nothing in it is a number the engine computes. `won` and `lost` are games of
// A Shadow of the Past from an empty log. `knife-lost` is a game of A Knife in the Dark, parked on its loss, from the log
// the `won` game writes when its Resolution is answered with `past.choices` (scenario 1's earned cards reach scenario 2
// through the Campaign Setup Checklist). The e2e-fixtures script writes them, and `fixtures.test.ts` replays each through the
// reducer (and the scenario 1 game into that log) so a change to the engine or the cards that moves a game fails there and
// the script is run again. `won`, and so `knife-lost`, are open (docs/phases/STATUS.md): no legal win of the two starter
// decks has been found, so neither is committed, and a name whose fixture is absent is not offered (`hasFixture`). `duo` is a
// two-handed game of scenario 1 parked on the first player's planning window of round 1, for the flows that need two dials and a seat
// that is not acting (the peek, `.maestro/seat-peek.yaml`). `mirkwood-won` and `mirkwood-lost` are two-handed games of Passage Through
// Mirkwood (Mirkwood Paths part 1) from an empty log, parked on the win and on the loss (the e2e-mirkwood script); a fixture names its campaign.
// `anduin-won` and `anduin-lost` are two-handed games of Journey Along the Anduin (part 2) from the log `mirkwood-won` writes when it is confirmed
// (`past`), parked on the win and on the loss (the e2e-anduin script). `dol-guldur-won` and `dol-guldur-lost` are two-handed games of Escape from
// Dol Guldur (part 3) from the log a real `anduin-won` writes (the e2e-dol-guldur script); both are open until `anduin-won` exists. `oath-won` and
// `oath-lost` are two-handed games of The Oath from the blank log a new The Dark of Mirkwood playthrough starts on (the e2e-oath script), parked on the
// win and on the loss; the same game in Mirkwood Paths would start from a real `dol-guldur-won` log, which is open. `nibin-dum-won` and `nibin-dum-lost` are two-handed games of The Caves of
// Nibin-Dûm from the log a real `oath-won` writes when it is confirmed (the e2e-nibin-dum script), parked on the win and on the loss. `nibin-dum-won` is open: the two decklists
// start at threat 37 and 25 and the auto-player found no win in 120 seeds, so only `nibin-dum-lost` is committed.
// `sea-solo` and `sea-duo` are games of Voyage Across Belegaer (Dream-chaser part 1) from the blank log of a new Dream-chaser playthrough (the e2e-voyage script): `sea-solo` true solo, parked on the first Sailing test's commit; `sea-duo`
// two-handed, parked on the first player's planning window. `voyage-lost` is parked on the loss. `voyage-won` is open: no auto-played win with real decks was found (docs/phases/STATUS.md), so it is not committed.
import knifeFixtures from "./fixtures/a-knife-in-the-dark.json";
import dolGuldurFixtures from "./fixtures/escape-from-dol-guldur.json";
import anduinFixtures from "./fixtures/journey-along-the-anduin.json";
import mirkwoodFixtures from "./fixtures/passage-through-mirkwood.json";
import nibinDumFixtures from "./fixtures/the-caves-of-nibin-dum.json";
import oathFixtures from "./fixtures/the-oath.json";
import voyageFixtures from "./fixtures/voyage-across-belegaer.json";
import fixtures from "./fixtures/scenario-1.json";

import type { PlayerIntent } from "../rules/intents.ts";
import { ENGINE_VERSION } from "../rules/version.ts";

import { emptyLog, type CampaignLog } from "./log.ts";
import { FELLOWSHIP_ID, parseLoadout, parseLog, parseSeatCount, type Save, type StoredLoadout } from "./save.ts";

export type FixtureName = "won" | "lost" | "knife-lost" | "duo" | "mirkwood-won" | "mirkwood-lost" | "anduin-won" | "anduin-lost" | "dol-guldur-won" | "dol-guldur-lost" | "oath-won" | "oath-lost" | "nibin-dum-won" | "nibin-dum-lost" | "sea-solo" | "sea-duo" | "voyage-won" | "voyage-lost";

// `past`: the scenario 1 fixture and the Resolution answers whose log this fixture starts from.
export type Fixture = { campaignId: string; seatCount: 1 | 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: FixtureName; choices: string[] } | null };

type StoredFixture = { campaignId?: string; seatCount: number; loadout: unknown; seed: number; intents: unknown[]; log?: unknown; past?: { fixture: string; choices: string[] } };

export const FIXTURE_NAMES: readonly FixtureName[] = ["won", "lost", "knife-lost", "duo", "mirkwood-won", "mirkwood-lost", "anduin-won", "anduin-lost", "dol-guldur-won", "dol-guldur-lost", "oath-won", "oath-lost", "nibin-dum-won", "nibin-dum-lost", "sea-solo", "sea-duo", "voyage-won", "voyage-lost"];

export function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

const STORED: Readonly<Partial<Record<FixtureName, StoredFixture>>> = {
  ...(fixtures as Partial<Record<"won" | "lost" | "duo", StoredFixture>>),
  ...(knifeFixtures as Partial<Record<"knife-lost", StoredFixture>>),
  ...(mirkwoodFixtures as Partial<Record<"mirkwood-won" | "mirkwood-lost", StoredFixture>>),
  ...(anduinFixtures as Partial<Record<"anduin-won" | "anduin-lost", StoredFixture>>),
  ...(dolGuldurFixtures as Partial<Record<"dol-guldur-won" | "dol-guldur-lost", StoredFixture>>),
  ...(oathFixtures as Partial<Record<"oath-won" | "oath-lost", StoredFixture>>),
  ...(nibinDumFixtures as Partial<Record<"nibin-dum-won" | "nibin-dum-lost", StoredFixture>>),
  ...(voyageFixtures as Partial<Record<"sea-solo" | "sea-duo" | "voyage-won" | "voyage-lost", StoredFixture>>),
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
    active: { engineVersion: ENGINE_VERSION, dataHash, seed: found.seed, intents: [...found.intents] },
    loadout: found.loadout,
  };
}
