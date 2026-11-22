// The fixtures of Raid on the Grey Havens (Dream-chaser part 3), written into src/campaign/fixtures/raid-on-the-grey-havens.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `raid-won` is the first seed that wins, parked on the win (the Resolution
// waits); `raid-lost` the first that loses, parked on the loss. A game not found in the seeds is left out.
// The log has parts 1 and 2 recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it (a blank log keeps Raid locked and the path opens Voyage Across Belegaer): it is the log
// the won game of Voyage Across Belegaer's golden writes (src/campaign/scenarios/voyage-across-belegaer/golden.test.ts, "two-handed, won"), and on top of it the one of The Fate of Númenor's golden (src/campaign/scenarios/the-fate-of-numenor/golden.test.ts,
// "two-handed, won"), each run through the same `applyResolution` that writes it in the app, with the goldens' plain-number heroes taken out (the fixture's seats play real decklists). `voyage-won` and
// `fate-won`, real-decklist wins, are open (GitHub issue #188). The Campaign Setup's offer of a Galdor's Counsel is answered in the loadout: neither player takes one.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { characters, legalAttackEnemies } from "../../src/rules/combat/combat.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { engageOneEach } from "../../test/harness/game-kit.ts";
import { FATE_GOLDENS, playGolden as playFate, fateWorld } from "../../test/scenarios/the-fate-of-numenor/game.ts";
import { createLog } from "../log.ts";
import { voyageWonLog } from "./the-fate-of-numenor.ts";
import { DREAM_CHASER, firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-raid");

export type RaidFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RaidFixtureName = "raid-won" | "raid-lost";

// The log of a playthrough whose first two parts were won: the Voyage golden's two-handed win resolved onto a new log, then the Fate golden's, their heroes and what hangs on them left out.
export async function fateWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Fate", goldens: FATE_GOLDENS, world: fateWorld, play: playFate }, await voyageWonLog());
}

// The auto-player's answer with what the scenario asks: damage the players assign falls on the least wounded hero, the heroes attack together (Graxar alone), and the first location the travel phase
// offers is travelled to.
export function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose") {
    const heroes = state.window.options.filter((option) => state.cards[option]?.zone === "heroes");
    const least = [...heroes].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least && heroes.length < state.window.options.length) return { type: "Choose", optionId: least };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender") ? legalTargets(state, { type: "DeclareDefender" }, ctx) : [];
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const least = [...targets].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const enemy = ready.flatMap(reachable)[0];
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    const limited = enemy != null && ctx.cards.get(state.cards[enemy]?.code ?? "")?.name === "Graxar";
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: limited ? attackers.slice(0, 1) : attackers };
  }
  if (state.window?.kind === "optionalEngage") return engageOneEach(state, ctx, 2) ?? { type: "DeclineEngage" };
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, legalIntents(state, ctx));
}

export async function raidFixtures(): Promise<Partial<Record<RaidFixtureName, RaidFixture>>> {
  const log = await fateWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RaidFixture | null => {
    // Neither player takes a Galdor's Counsel at the Campaign Setup.
    const found = firstSeed(say, { campaignId: DREAM_CHASER, scenarioId: "raid-on-the-grey-havens", seatCount: 2, log, answer: intentFor }, "RAID_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "raid-won");
  const lost = find((state) => state.lost, "raid-lost");
  return { ...(won ? { "raid-won": won } : {}), ...(lost ? { "raid-lost": lost } : {}) };
}
