// The save fixtures of Encounter at Amon Dîn (against-the-shadow cycle part 6), written into src/campaign/fixtures/encounter-at-amon-din.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `din-lost` is the first seed that loses
// after passing through stage 2 with the moments the table shows there, parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so the finder plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions as the goldens do (`dinIntent`, test/scenarios/encounter-at-amon-din/game.ts): the seat keeps its last two heroes out of the quest, travels to the location with the most villager tokens, each seat engages up
// to three enemies, the ready characters attack together (Ghulat first), a hero defends but the first two attacks on stage 2 go undefended (the damage is villager tokens off Rescued Villagers), Lord Alcaron's Response is taken and Craven Eagle's discard of three cards is paid.
import { DEAD, dinIntent, GHULAT, RESCUED, STAGE_TWO, type DinPolicy } from "../../../test/scenarios/encounter-at-amon-din/game.ts";
import { legalIntents } from "../../../src/rules/engine/reduce.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed, type StandaloneSeedSpec } from "../seed-kit.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import type { ReduceContext } from "../../../src/rules/engine/reduce.ts";

const say = createLog("e2e-din");

// What a game showed along the way, by seed, with the number of intents already played when each moment first showed (the `--at` of `pnpm game show` and `pnpm browser shot`): the lost fixture must pass through the scenario's
// stage 2 moments, which the final state no longer holds (Ghulat is usually in the victory display by then).
type Moments = { played: number; location?: number; dials?: number; sheet?: number; response?: number; ghulat?: number; defeated?: number };
const seen = new Map<number, Moments>();
const inPlay = (card: { zone: string }) => card.zone === "staging" || card.zone === "engaged" || card.zone === "activeLocation";
const KEEP_FIRST = <K extends keyof Moments>(found: Moments, key: K, value: number): void => {
  if (found[key] === undefined) found[key] = value;
};

// The moments of the stage 2 table the Table step made (src/play/): a location with villager tokens in play, both dials non-zero (tokens on Rescued Villagers, damage on Dead Villagers), the attack sheet of an attack before its defender
// is declared, Lord Alcaron's Response window and Ghulat in play; and the first intent at which stage 2 is defeated (its 15 progress in) while Ghulat is in play.
function note(state: ScenarioState, ctx: ReduceContext): void {
  const found = seen.get(state.seed) ?? { played: 0 };
  seen.set(state.seed, found);
  found.played += 1;
  const at = found.played - 1;
  const stage = state.cards[state.questStage ?? ""];
  if (stage?.code !== STAGE_TWO) return;
  const cards = Object.values(state.cards);
  const rescued = cards.find((card) => card.code === RESCUED)?.resources ?? 0;
  const dead = cards.find((card) => card.code === DEAD)?.damage ?? 0;
  if (cards.some((card) => inPlay(card) && card.resources > 0 && card.code !== RESCUED && !card.code.startsWith("q"))) KEEP_FIRST(found, "location", at);
  if (rescued > 0 && dead > 0) KEEP_FIRST(found, "dials", at);
  if (state.window?.kind === "defense") KEEP_FIRST(found, "sheet", at);
  if (state.window?.kind === "response" && legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "06070:response:1")) KEEP_FIRST(found, "response", at);
  if (cards.some((card) => card.code === GHULAT && inPlay(card))) {
    KEEP_FIRST(found, "ghulat", at);
    if (stage.progress >= 15) KEEP_FIRST(found, "defeated", at);
  }
}

const POLICY: Partial<DinPolicy> = { choose: "first", reserve: 2, engage: 3, undefended: 2, play: true };
const spec: StandaloneSeedSpec<2> = {
  campaignId: "against-the-shadow",
  scenarioId: "encounter-at-amon-din",
  seatCount: 2,
  answer: (state, ctx, memory) => {
    note(state, ctx);
    return dinIntent(state, ctx, memory, { choose: "first", reserve: 2, engage: 3, undefended: 2, huntFirst: false, noAlcaron: false, play: true, ...POLICY });
  },
};

const through = (state: ScenarioState): boolean => {
  const found = seen.get(state.seed);
  return found?.location !== undefined && found.dials !== undefined && found.sheet !== undefined && found.response !== undefined && found.ghulat !== undefined;
};
// The loss the fixture parks on, best first: after stage 2 was defeated with Ghulat in play and a loss by the comparison or by Lord Alcaron leaving play; then any loss through the stage's moments; then any loss that reached stage 2.
const afterDefeat = (state: ScenarioState): boolean => state.lost && through(state) && seen.get(state.seed)?.defeated !== undefined && /Dead Villagers|Lord Alcaron/.test(state.lossReason ?? "");
const throughStageTwo = (state: ScenarioState): boolean => state.lost && through(state);
const reachedStageTwo = (state: ScenarioState): boolean => state.lost && seen.get(state.seed)?.sheet !== undefined;

// Each search plays every seed once, so the count of intents of a seed starts again with it.
const search = (wanted: (state: ScenarioState) => boolean) => {
  seen.clear();
  return firstStandaloneSeed(say, spec, "DIN_SEEDS", wanted, "din-lost");
};

export const dinFixtures = async () => {
  const lost = search(afterDefeat) ?? search(throughStageTwo) ?? search(reachedStageTwo);
  if (lost) say.info(`din-lost moments (intents played before each): ${JSON.stringify(seen.get(lost.seed))}`);
  return lost ? { "din-lost": lost } : {};
};
