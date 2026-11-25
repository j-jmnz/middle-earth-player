// The save fixtures of The Morgul Vale (against-the-shadow cycle part 9), written into src/campaign/fixtures/the-morgul-vale.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `vale-lost` is the first seed that loses
// with the moments the table shows here, parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so the finder plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions as the goldens' losing game does (`valeIntent` with `TOKENS`, test/scenarios/the-morgul-vale/game.ts): the Sorcerer, Impenetrable Fog and Sleepless Malice put their tokens on To the Tower, Morgul Road's
// Response deals its damage, each seat keeps its last two heroes out of the quest and defends one attack a round, the players engage the Captain of the stage and up to three enemies, attack together (the Captain first) and play the cards of the hand.
import { DEFAULT_POLICY, TOKENS, valeIntent, BODYGUARD, CAPTAINS, TOWER, type ValePolicy } from "../../../test/scenarios/the-morgul-vale/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed, type StandaloneSeedSpec } from "../seed-kit.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";

const say = createLog("e2e-vale");

// What a game showed along the way, by seed, with the number of intents already played when each moment first showed (the `--at` of `pnpm game show` and `pnpm browser shot`): the lost fixture must pass through the moments of the Table step,
// which the final state no longer holds (the table is parked on the loss).
type Moments = { played: number; seven?: number; nine?: number; shield?: number; advance?: number; sorcerer?: number; fog?: number; malice?: number; road?: number };
const seen = new Map<number, Moments>();
const KEEP_FIRST = <K extends keyof Moments>(found: Moments, key: K, value: number): void => {
  if (found[key] === undefined) found[key] = value;
};
const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
const tower = (state: ScenarioState): number => Object.values(state.cards).find((card) => card.code === TOWER)?.progress ?? 0;
const inPlay = (state: ScenarioState, code: string): boolean => Object.values(state.cards).some((card) => card.code === code && (card.zone === "staging" || card.zone === "engaged"));

// The moments of the table the Table step made (src/play/): the dial at 7 (warm) and at 9 (red), a Morgul Bodyguard hurt while a Captain is in play (the shield), a stage advanced, and the choice sheets of the Morgul Sorcerer, Impenetrable Fog, Sleepless Malice and Morgul Road.
function note(state: ScenarioState, previous: ScenarioState | undefined): void {
  const found = seen.get(state.seed) ?? { played: 0 };
  seen.set(state.seed, found);
  found.played += 1;
  const at = found.played - 1;
  if (tower(state) >= 7) KEEP_FIRST(found, "seven", at);
  if (tower(state) >= 9) KEEP_FIRST(found, "nine", at);
  if (previous && codeOf(state, state.questStage) !== codeOf(previous, previous.questStage)) KEEP_FIRST(found, "advance", at);
  const hurt = Object.values(state.cards).some((card) => card.code === BODYGUARD && card.damage > (previous?.cards[card.id]?.damage ?? 0));
  if (hurt && CAPTAINS.some((code) => inPlay(state, code))) KEEP_FIRST(found, "shield", at);
  const options = state.window?.kind === "choose" ? state.window.options : [];
  if (options.includes("place")) KEEP_FIRST(found, "sorcerer", at);
  if (options.includes("tokens")) KEEP_FIRST(found, "fog", at);
  if (options.includes("discard")) KEEP_FIRST(found, "malice", at);
  if (options.includes("remove") || options.includes("damage")) KEEP_FIRST(found, "road", at);
}

// The goldens' tokens policy, with the cards of the hand played and the Actions used.
const POLICY: ValePolicy = { ...DEFAULT_POLICY, ...TOKENS, play: true, act: true };
const last = new Map<number, ScenarioState>();
const spec: StandaloneSeedSpec<2> = {
  campaignId: "against-the-shadow",
  scenarioId: "the-morgul-vale",
  seatCount: 2,
  answer: (state, ctx, memory) => {
    note(state, last.get(state.seed));
    last.set(state.seed, state);
    return valeIntent(state, ctx, memory, POLICY);
  },
};

const through = (state: ScenarioState): boolean => {
  const found = seen.get(state.seed);
  return found?.nine !== undefined && found.shield !== undefined && found.advance !== undefined && found.sorcerer !== undefined && found.fog !== undefined && found.malice !== undefined;
};
// The loss the fixture parks on, best first: through every moment; then a loss with a choice sheet of Fog or Malice and the dial at 7; then any loss with the dial at 7 and a Bodyguard hurt.
const throughAll = (state: ScenarioState): boolean => state.lost && through(state);
const withSheets = (state: ScenarioState): boolean => state.lost && seen.get(state.seed)?.seven !== undefined && (seen.get(state.seed)?.fog !== undefined || seen.get(state.seed)?.malice !== undefined) && seen.get(state.seed)?.advance !== undefined;
const withShield = (state: ScenarioState): boolean => state.lost && seen.get(state.seed)?.seven !== undefined && seen.get(state.seed)?.shield !== undefined;

// Each search plays every seed once, so the count of intents of a seed starts again with it.
const search = (wanted: (state: ScenarioState) => boolean) => {
  seen.clear();
  last.clear();
  return firstStandaloneSeed(say, spec, "VALE_SEEDS", wanted, "vale-lost");
};

export const valeFixtures = async () => {
  const lost = search(throughAll) ?? search(withSheets) ?? search(withShield);
  if (lost) say.info(`vale-lost moments (intents played before each): ${JSON.stringify(seen.get(lost.seed))}`);
  return lost ? { "vale-lost": lost } : {};
};
