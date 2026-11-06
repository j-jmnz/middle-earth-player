// The Maestro fixtures of The Caves of Nibin-Dûm (The Dark of Mirkwood part 2, the last part of the campaign), written into src/campaign/fixtures/the-caves-of-nibin-dum.json by
// scripts/e2e/fixtures.ts: two real games of saved decklists (the Defenders of Gondor and Swords of the Noldor lists of data/decks/prebuilt.json), two-handed, Easy, from the
// log the `oath-won` game writes when it is confirmed (scripts/e2e/the-oath.ts: the Adaptations, Stalking Goblin and Guilty Conscience in the pool, the once-per-campaign uses),
// so each is a real save and nothing here builds a log by hand. Played by the auto-player, every intent one the reducer listed.
// `nibin-dum-won`: the first seed that wins, parked on the win (41051's Resolution asks nothing: with the highest final threat under 40 each player earns a Ranger Sense
// and a Ranger Sense for each player is kept for the next campaign). `nibin-dum-lost`: the first seed that loses, parked on the loss.
import { type CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { characters, legalAttackEnemies } from "../../src/rules/combat/combat.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { replaced } from "./journey-along-the-anduin.ts";
import { oathWonLog, type OathFixture } from "./the-oath.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-nibin-dum");

export type NibinDumFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: string; choices: string[] } };

const CHIEFTAIN = "41027";
const PILLAR = "41028";

// The auto-player's answer, with what the scenario asks of the players: a hero stays home to attack and one defends; the Pillar is worn down in the combat phase
// (stage 3), the Goblin Chieftain is engaged and killed once the stage holds 8 progress, and it is kept from taking progress off the quest until then.
export function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.includes("staging") && state.window.options.includes("progress")) {
    const progress = state.cards[state.questStage ?? ""]?.progress ?? 0;
    return { type: "Choose", optionId: progress - 4 >= 8 ? "progress" : "staging" };
  }
  if (state.window?.kind === "choose" && state.window.options.length > 1 && state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
    const options = [...state.window.options].sort((a, b) => (state.cards[a]?.damage ?? 0) - (state.cards[b]?.damage ?? 0));
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx);
    const strongest = [...defenders].sort((a, b) => (ctx.cards.get(state.cards[b]?.code ?? "")?.defense ?? 0) - (ctx.cards.get(state.cards[a]?.code ?? "")?.defense ?? 0))[0];
    if (strongest && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return { type: "DeclareDefender", defenderId: strongest };
    const left = (id: string): number => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0);
    const heroes = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((a, b) => left(b) - left(a));
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.activeSeat;
    const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
    const reachable = (id: string) => legalAttackEnemies(state, seat, id, ctx.cards);
    const pillar = Object.values(state.cards).find((card) => card.code === PILLAR && card.zone === "staging");
    const wearDown = pillar != null && pillar.damage < 4 && ready.some((id) => reachable(id).includes(pillar.id));
    const chieftain = Object.values(state.cards).find((card) => card.code === CHIEFTAIN && card.zone === "engaged" && ready.some((id) => reachable(id).includes(card.id)));
    const killable = chieftain != null && (state.cards[state.questStage ?? ""]?.progress ?? 0) >= 8;
    const enemy = wearDown ? pillar.id : killable ? chieftain.id : ready.map((id) => reachable(id).find((target) => target !== pillar?.id))?.find((id) => id != null);
    const attackers = ready.filter((id) => enemy != null && reachable(id).includes(enemy));
    if (enemy && attackers.length > 0) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const targets = legalTargets(state, { type: "Engage" }, ctx);
    const chieftain = targets.find((id) => state.cards[id]?.code === CHIEFTAIN);
    if (chieftain && (state.cards[state.questStage ?? ""]?.progress ?? 0) >= 8) return { type: "Engage", enemyId: chieftain };
    const enemy = targets.find((id) => state.cards[id]?.code !== CHIEFTAIN);
    if (enemy && seat && seat.engaged.length < 3) return { type: "Engage", enemyId: enemy };
  }
  // "No Time to Waste!" lowers every player's threat by 3: it is played in the quest phase once a seat's threat is 30 or more.
  if (state.mode === "questCommit" && state.window?.kind === "pass") {
    const seatThreat = state.seats[state.activeSeat]?.threat ?? 0;
    const play = legalIntents(state, ctx).find((intent) => intent.type === "PlayCard" && state.cards[intent.cardId]?.code === "41048");
    if (play?.type === "PlayCard" && seatThreat >= 30) return { type: "PlayCard", cardId: play.cardId, payments: [] };
  }
  // Each seat keeps its last hero out of the quest, ready to attack, from the third stage on (the Pillar and the Chieftain are fought); before it everyone quests.
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => state.cards[id]?.zone === "heroes");
    const fighting = ["41006", "41007"].includes(state.cards[state.questStage ?? ""]?.code ?? "");
    const home = fighting && heroes.length > 1 ? heroes.at(-1) : undefined;
    const questers = ids.filter((id) => id !== home);
    if (questers.length > 0) return { type: "Commit", cardIds: questers };
  }
  return nextIntent(state, ctx, { scout: "", prefer: PILLAR, protect: "", play: true, act: true }, memory);
}

// A fixture whose game is not found is left out (a name whose fixture is absent is not offered, `hasFixture`). With no `oath-won` fixture there is no honest log for this
// scenario to start from (docs/phases/STATUS.md, Fixtures and Maestro: a fixture is a real save), so none is written.
export function nibinDumFixtures(oath: OathFixture | undefined): Partial<Record<"nibin-dum-won" | "nibin-dum-lost", NibinDumFixture>> {
  if (!oath) {
    say.warn("no oath-won fixture: The Caves of Nibin-Dûm's fixtures are open until The Oath has a won game");
    return {};
  }
  const log = oathWonLog(oath);
  // The same decks and seats as The Oath's game, with a card in place of each hero that fell there; no choices (the Setup's hero choice is asked in the game).
  const loadout: StoredLoadout = { ...replaced({ ...oath.loadout, scenarioId: "the-caves-of-nibin-dum" }, log, "The Oath"), choices: [] };
  const past = { fixture: "oath-won", choices: [] as string[] };
  const first = (wanted: (state: ScenarioState) => boolean, label: string): NibinDumFixture | null => {
    const found = firstSeed(say, { campaignId: "the-dark-of-mirkwood", scenarioId: "the-caves-of-nibin-dum", seatCount: 2, loadout, log, limit: 6000, seeds: 60, codes: ["41048", "41049", "41042"], answer: intentFor }, "NIBIN_DUM_SEEDS", wanted, label);
    return found && { ...found, log, past };
  };
  const won = first((state) => state.stageCleared && !state.lost, "nibin-dum-won");
  const lost = first((state) => state.lost, "nibin-dum-lost");
  return { ...(won ? { "nibin-dum-won": won } : {}), ...(lost ? { "nibin-dum-lost": lost } : {}) };
}
