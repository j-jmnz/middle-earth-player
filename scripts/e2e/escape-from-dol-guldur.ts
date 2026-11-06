// The Maestro fixtures of Escape from Dol Guldur (Mirkwood Paths part 3), written into src/campaign/fixtures/escape-from-dol-guldur.json by
// scripts/e2e/fixtures.ts: two real games of saved decklists (the Dwarves of Durin and Elves of Lórien lists of data/decks/prebuilt.json), two-handed,
// Easy, from the log the `anduin-won` game writes when it is confirmed (scripts/e2e/journey-along-the-anduin.ts): its prisoner, its pool. That win is open (no fixture,
// docs/phases/STATUS.md), and nothing here builds a log by hand, so no fixture of this scenario is written until `anduin-won` exists. Played by the auto-player,
// every intent one the reducer listed.
// `dol-guldur-won`: the first seed that wins, parked on the win (01131's Resolution asks nothing: Mendor, if he is still in play, and each
// player's Mendor's Support are kept for the next campaign). `dol-guldur-lost`: the first seed that loses, parked on the loss.
import { type CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { anduinWonLog, replaced, type AnduinFixture } from "./journey-along-the-anduin.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";
import { attackTogether, engageOneEach } from "../../test/harness/game-kit.ts";

const say = createLog("e2e-dol-guldur");

export type DolGuldurFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog; past: { fixture: string; choices: string[] } };

// The log a real win of Journey Along the Anduin writes (`anduin-won`, replayed and confirmed): its prisoner is the one 01130:B:1 names. The first
// player attaches Appointed by Fate (01131:A:2) to a hero that is not the prisoner.
function anduinLog(anduin: AnduinFixture): { log: CampaignLog; loadout: StoredLoadout } {
  const log = anduinWonLog(anduin);
  const swapped = replaced({ ...anduin.loadout, scenarioId: "escape-from-dol-guldur" }, log);
  const heroes = swapped.seats.flatMap((seat) => seat.heroes);
  const bearer = heroes.find((code) => code !== log.prisoner) ?? heroes[0];
  return { log, loadout: { ...swapped, choices: [`01134>${bearer}`] } };
}

// The auto-player's answer, with what the scenario asks of the players: a hero stays home to attack and one defends, Dungeon Torch is claimed last,
// a claimed objective goes on the hero with the fewest attachments, and every ready character attacks the first enemy it can reach.
function intentFor(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.window?.kind === "choose" && state.window.options.length > 1 && state.window.options.every((id) => state.cards[id]?.zone === "heroes")) {
    const options = [...state.window.options].sort((a, b) => (state.cards[a]?.attachments.length ?? 0) - (state.cards[b]?.attachments.length ?? 0));
    return { type: "Choose", optionId: options[0] ?? "" };
  }
  if (state.window?.kind === "defense") {
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.code !== "01135");
    const strongest = [...defenders].sort((a, b) => (ctx.cards.get(state.cards[b]?.code ?? "")?.defense ?? 0) - (ctx.cards.get(state.cards[a]?.code ?? "")?.defense ?? 0))[0];
    if (strongest && legalIntents(state, ctx).some((intent) => intent.type === "DeclareDefender")) return { type: "DeclareDefender", defenderId: strongest };
    const left = (id: string): number => (ctx.cards.get(state.cards[id]?.code ?? "")?.health ?? 0) - (state.cards[id]?.damage ?? 0);
    const heroes = [...legalTargets(state, { type: "Undefended" }, ctx)].sort((a, b) => left(b) - left(a));
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  const engaging = engageOneEach(state, ctx, 3);
  if (engaging) return engaging;
  // Each seat keeps its last hero out of the quest, ready to attack.
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    const heroes = ids.filter((id) => state.cards[id]?.zone === "heroes");
    const home = heroes.length > 1 ? heroes.at(-1) : undefined;
    const questers = ids.filter((id) => id !== home);
    if (questers.length > 0) return { type: "Commit", cardIds: questers };
  }
  // Dungeon Torch raises its hero's controller's threat by 2 every round: it is claimed last, once the prisoner is rescued.
  const stage = state.cards[state.questStage ?? ""]?.code;
  const held = Object.values(state.cards).some((card) => card.zone === "captive" && card.prisoner === true && card.host == null);
  const intents = legalIntents(state, ctx).filter((intent) => !((stage === "01123" || held) && intent.type === "Trigger" && intent.effectId === "01109:action:1"));
  return nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory, intents);
}

// A fixture whose game is not found is left out (a name whose fixture is absent is not offered, `hasFixture`). With no `anduin-won` fixture there is no
// honest log for this scenario to start from (docs/phases/STATUS.md, Fixtures and Maestro: a fixture is a real save), so none is written.
export function dolGuldurFixtures(anduin: AnduinFixture | undefined): Partial<Record<"dol-guldur-won" | "dol-guldur-lost", DolGuldurFixture>> {
  if (!anduin) {
    say.warn("no anduin-won fixture: Escape from Dol Guldur's fixtures are open until Journey Along the Anduin has a won game");
    return {};
  }
  const { log, loadout } = anduinLog(anduin);
  const past = { fixture: "anduin-won", choices: [] as string[] };
  const first = (wanted: (state: ScenarioState) => boolean, label: string): DolGuldurFixture | null => {
    const found = firstSeed(say, { campaignId: "mirkwood-paths", scenarioId: "escape-from-dol-guldur", seatCount: 2, loadout, log, limit: 6000, seeds: 60, answer: intentFor }, "DOL_GULDUR_SEEDS", wanted, label);
    return found && { ...found, log, past };
  };
  const won = first((state) => state.stageCleared && !state.lost, "dol-guldur-won");
  const lost = first((state) => state.lost, "dol-guldur-lost");
  return { ...(won ? { "dol-guldur-won": won } : {}), ...(lost ? { "dol-guldur-lost": lost } : {}) };
}
