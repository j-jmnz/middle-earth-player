// The Maestro fixtures of The Uruk-hai (the-two-towers part 1), written into src/campaign/fixtures/the-uruk-hai.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, from the blank log a new `the-two-towers` playthrough starts on, so each is a real save. `hai-won` is the first seed that wins, parked on
// the win (the Resolution waits); `hai-lost` the first that loses, parked on the loss. A game not found in the seeds is left out.
// The Campaign Setup asks nothing; the Setup of the quest card asks each seat for its Captive (no log names one, so each chooses a non-Fellowship hero: the answer is the first option the window lists). A win defeats Uglúk, so the
// decklists engage him the moment stage 2 lets them and every character that did not quest attacks him first, together, with card play on; all but the last hero of a seat quest.
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { attackTogether } from "../../test/harness/game-kit.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-hai");

export type HaiFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type HaiFixtureName = "hai-won" | "hai-lost";

const UGLUK = "143023";
const ARAGORN = "143001";
const POLICY = { scout: "", prefer: "", protect: ARAGORN, play: true, act: true } as const;

// The auto-player's answer with what The Uruk-hai asks: a choice takes the first option, all but the last hero of a seat quest, the heroes at home attack Uglúk first, and Uglúk is engaged when the engine lets them.
export function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  // A choice among cards (the character an Isengard Uruk's damage is assigned to) is never Aragorn; any other takes the first option.
  if (state.window?.kind === "choose") return { type: "Choose", optionId: state.window.options.find((option) => state.cards[option] != null && state.cards[option]?.code !== ARAGORN) ?? state.window.options[0] ?? "" };
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => state.cards[id]?.zone === "heroes");
    const questers = ids.filter((id) => !(heroes.length >= 2 && id === heroes.at(-1)));
    if (questers.length > 0) return { type: "Commit", cardIds: questers };
  }
  // The damage the players assign (the archery) falls on a character other than Aragorn, who has 5 hit points and whose leaving play loses the game.
  if (state.window?.kind === "archery") {
    const recipient = legalTargets(state, { type: "Distribute" }, ctx).find((id) => state.cards[id]?.code !== ARAGORN);
    if (recipient) return { type: "Distribute", assignments: [{ cardId: recipient, amount: state.window.total }] };
  }
  const together = attackTogether(state, ctx, undefined, (enemyId) => (state.cards[enemyId]?.code === UGLUK ? 0 : 1));
  if (together) return together;
  if (state.window?.kind === "optionalEngage") {
    const ugluk = legalTargets(state, { type: "Engage" }, ctx).find((id) => state.cards[id]?.code === UGLUK);
    if (ugluk) return { type: "Engage", enemyId: ugluk };
  }
  return nextIntent(state, ctx, POLICY, memory, legalIntents(state, ctx));
}

export async function haiFixtures(): Promise<Partial<Record<HaiFixtureName, HaiFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): HaiFixture | null => firstSeed(say, { campaignId: "the-two-towers", scenarioId: "the-uruk-hai", seatCount: 2, answer: intentFor }, "HAI_SEEDS", wanted, label);
  const won = find((state) => state.stageCleared && !state.lost, "hai-won");
  const lost = find((state) => state.lost, "hai-lost");
  return { ...(won ? { "hai-won": won } : {}), ...(lost ? { "hai-lost": lost } : {}) };
}
