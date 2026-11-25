// The save fixtures of Assault on Osgiliath (against-the-shadow cycle part 7), written into src/campaign/fixtures/assault-on-osgiliath.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `assault-lost` is the first seed that loses
// with the moments the table shows here, parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so the finder plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions as the goldens do (`assaultIntent`, test/scenarios/assault-on-osgiliath/game.ts): the Setup takes the first enemy and the first unique location, the seat keeps its last two heroes out of the
// quest, travels to the Osgiliath location with the fewest quest points (Ruined Tower as the second active location), each seat engages up to three enemies, the heroes attack one enemy each, a hero defends when he may and the cards of the hand are played.
import { assaultIntent, controlledIds, DEFAULT_POLICY, type AssaultPolicy } from "../../../test/scenarios/assault-on-osgiliath/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed, type StandaloneSeedSpec } from "../seed-kit.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";

const say = createLog("e2e-assault");

// What a game showed along the way, by seed, with the number of intents already played when each moment first showed (the `--at` of `pnpm game show` and `pnpm browser shot`): the lost fixture must pass through the moments of the
// Table step, which the final state no longer holds (the heroes are gone and the locations are back in the staging area).
type Moments = { played: number; controlled?: number; row?: number; twoActive?: number; sheet?: number; sheetControlled?: number; explore?: number };
const seen = new Map<number, Moments>();
const KEEP_FIRST = <K extends keyof Moments>(found: Moments, key: K, value: number): void => {
  if (found[key] === undefined) found[key] = value;
};

// The moments of the table the Table step made (src/play/): a location the first player controls (the quest dial's "Controlled" and the first player's play row beside his heroes), two active locations with Ruined Tower, an attack sheet (the defense
// window) with a controlled location in play, and the first intent that took a location under control (the banner's moment).
function note(state: ScenarioState, previous: ScenarioState | undefined): void {
  const found = seen.get(state.seed) ?? { played: 0 };
  seen.set(state.seed, found);
  found.played += 1;
  const at = found.played - 1;
  const held = controlledIds(state);
  if (held.length > 0) KEEP_FIRST(found, "controlled", at);
  if (held.length > (previous ? controlledIds(previous).length : 0)) KEEP_FIRST(found, "explore", at);
  if (held.length > 0 && state.seats[0]?.play.some((id) => held.includes(id))) KEEP_FIRST(found, "row", at);
  if (state.secondActiveLocation != null && state.activeLocation != null) KEEP_FIRST(found, "twoActive", at);
  if (state.window?.kind === "defense") {
    KEEP_FIRST(found, "sheet", at);
    if (held.length > 0) KEEP_FIRST(found, "sheetControlled", at);
  }
}

// The goldens' policy, with the cards of the hand played.
const POLICY: Partial<AssaultPolicy> = { play: true };
const last = new Map<number, ScenarioState>();
const spec: StandaloneSeedSpec<2> = {
  campaignId: "against-the-shadow",
  scenarioId: "assault-on-osgiliath",
  seatCount: 2,
  answer: (state, ctx, memory) => {
    note(state, last.get(state.seed));
    last.set(state.seed, state);
    return assaultIntent(state, ctx, memory, { ...DEFAULT_POLICY, ...POLICY });
  },
};

const through = (state: ScenarioState): boolean => {
  const found = seen.get(state.seed);
  return found?.row !== undefined && found.twoActive !== undefined && found.sheetControlled !== undefined && found.explore !== undefined;
};
// The loss the fixture parks on, best first: through every moment; then any loss with a controlled location and an attack sheet; then any loss that controlled a location.
const throughAll = (state: ScenarioState): boolean => state.lost && through(state);
const withSheet = (state: ScenarioState): boolean => state.lost && seen.get(state.seed)?.sheetControlled !== undefined;
const controlled = (state: ScenarioState): boolean => state.lost && seen.get(state.seed)?.row !== undefined;

// Each search plays every seed once, so the count of intents of a seed starts again with it.
const search = (wanted: (state: ScenarioState) => boolean) => {
  seen.clear();
  last.clear();
  return firstStandaloneSeed(say, spec, "ASSAULT_SEEDS", wanted, "assault-lost");
};

export const assaultFixtures = async () => {
  const lost = search(throughAll) ?? search(withSheet) ?? search(controlled);
  if (lost) say.info(`assault-lost moments (intents played before each): ${JSON.stringify(seen.get(lost.seed))}`);
  return lost ? { "assault-lost": lost } : {};
};
