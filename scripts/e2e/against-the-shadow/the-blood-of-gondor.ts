// The save fixtures of The Blood of Gondor (against-the-shadow cycle part 8), written into src/campaign/fixtures/the-blood-of-gondor.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `blood-lost` is the first seed that loses
// with the moments the table shows here, parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so the finder plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions as the goldens do (`bloodIntent`, test/scenarios/the-blood-of-gondor/game.ts): the combat choice takes a hidden card, then turns, in turn; each seat keeps its last two heroes and the
// objective allies out of the quest, travels to the location with the fewest quest points (The Cross-roads only on stage 2), engages up to three enemies, defends with the first character who may, attacks one enemy for each character, uses
// Faramir's and Lord Alcaron's Actions and plays the cards of the hand.
import { ALCARON, bloodIntent, CAPTURED, DEFAULT_POLICY, FARAMIR, type BloodPolicy } from "../../../test/scenarios/the-blood-of-gondor/game.ts";
import { counts } from "../../../test/scenarios/the-blood-of-gondor/moments.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed, type StandaloneSeedSpec } from "../seed-kit.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";

const say = createLog("e2e-blood");

// What a game showed along the way, by seed, with the number of intents already played when each moment first showed (the `--at` of `pnpm game show` and `pnpm browser shot`): the lost fixture must pass through the moments of the Table step,
// which the final state no longer holds (the table is parked on the loss, the hidden cards turned or discarded).
type Moments = { played: number; both?: number; sheet?: number; turn?: number; held?: number; five?: number; faramir?: number; two?: number };
const seen = new Map<number, Moments>();
const KEEP_FIRST = <K extends keyof Moments>(found: Moments, key: K, value: number): void => {
  if (found[key] === undefined) found[key] = value;
};
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";

// The moments of the table the Table step made (src/play/): hidden cards held by both players (the seat marks and the total dial), the combat start's choice (the sheet), the intent that turned cards by that choice (the banner), the allies held
// under Captured! (the pill), a seat that held 4 and turned its cards at once on stage 2 (the turn at 5), Faramir's Action offered, and two hidden cards or more in one seat.
function note(state: ScenarioState, previous: ScenarioState | undefined): void {
  const found = seen.get(state.seed) ?? { played: 0 };
  seen.set(state.seed, found);
  found.played += 1;
  const at = found.played - 1;
  const held = counts(state);
  if (held.every((count) => count > 0)) KEEP_FIRST(found, "both", at);
  if (held.some((count) => count >= 2)) KEEP_FIRST(found, "two", at);
  if (state.window?.kind === "choose" && state.window.options.includes("turn") && state.window.options.includes("take")) KEEP_FIRST(found, "sheet", at);
  if (previous && codeOf(state, state.questStage) === CAPTURED && held.some((count, seat) => (counts(previous)[seat] ?? 0) >= 4 && count === 0)) KEEP_FIRST(found, "five", at);
  if (previous && previous.window?.kind === "choose" && previous.window.options.includes("turn") && counts(previous).some((count, seat) => count > 0 && (held[seat] ?? 0) < count)) KEEP_FIRST(found, "turn", at);
  if (Object.values(state.cards).some((card) => [FARAMIR, ALCARON].includes(card.code) && card.zone === "captive")) KEEP_FIRST(found, "held", at);
  if (Object.values(state.cards).some((card) => card.code === FARAMIR && card.zone === "play" && !card.exhausted) && state.phase === "Combat") KEEP_FIRST(found, "faramir", at);
}

// The goldens' policy, with the cards of the hand played.
const POLICY: Partial<BloodPolicy> = { play: true };
const last = new Map<number, ScenarioState>();
const spec: StandaloneSeedSpec<2> = {
  campaignId: "against-the-shadow",
  scenarioId: "the-blood-of-gondor",
  seatCount: 2,
  answer: (state, ctx, memory) => {
    note(state, last.get(state.seed));
    last.set(state.seed, state);
    return bloodIntent(state, ctx, memory, { ...DEFAULT_POLICY, ...POLICY });
  },
};

const through = (state: ScenarioState): boolean => {
  const found = seen.get(state.seed);
  return found?.both !== undefined && found.sheet !== undefined && found.turn !== undefined && found.held !== undefined && found.five !== undefined;
};
// The loss the fixture parks on, best first: through every moment; then a loss with the allies held and the combat sheet; then any loss with hidden cards held by both players.
const throughAll = (state: ScenarioState): boolean => state.lost && through(state);
const withHeld = (state: ScenarioState): boolean => state.lost && seen.get(state.seed)?.held !== undefined && seen.get(state.seed)?.sheet !== undefined;
const withBoth = (state: ScenarioState): boolean => state.lost && seen.get(state.seed)?.both !== undefined && seen.get(state.seed)?.sheet !== undefined;

// Each search plays every seed once, so the count of intents of a seed starts again with it.
const search = (wanted: (state: ScenarioState) => boolean) => {
  seen.clear();
  last.clear();
  return firstStandaloneSeed(say, spec, "BLOOD_SEEDS", wanted, "blood-lost");
};

export const bloodFixtures = async () => {
  const lost = search(throughAll) ?? search(withHeld) ?? search(withBoth);
  if (lost) say.info(`blood-lost moments (intents played before each): ${JSON.stringify(seen.get(lost.seed))}`);
  return lost ? { "blood-lost": lost } : {};
};
