// Rules: mec108.thaurdir, mec108.indestructible, rr.active-location (data/rules/entries.json); ledger lines 10125:B:1, 10125:B:3, 10126:B:1, 10126:B:2, 10126:B:3, 10127:A:4, 10128:A:4, 10129:A:1, 10139:A:3.
//
// The pieces The Battle of Carn Dûm's cards hold on the table: Thaurdir's side with the shadow cards dealt to him against the 3 that flip him on stage 1B (one plain dial: a flip is neither good nor bad), and on stage 2B the progress on Midwinter's Crux against the 15 that take his Indestructible
// away (a goal). The engine decided every number (`shadowCards`, the stage's progress, `hitPointsOf`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { CRUX_PROGRESS, THAURDIR_FLIP_SHADOWS } from "../../effects/authored/angmar-awakened/the-battle-of-carn-dum.ts";
import { inPlay, type CardInstance, type ScenarioState } from "../../rules/core/state.ts";
import { shadowCards } from "../../rules/core/zones.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";

import { cruxLimitWords, cruxName, cruxWords, thaurdirDialName, thaurdirDialWords, thaurdirLimitWords, type ThaurdirSide } from "../words/scenarios/angmar/carn-dum-table.ts";
import type { TableDial } from "./dials.ts";

export const CLUTCHES_OF_CARN_DUM = "10125";
export const MIDWINTERS_CRUX = "10126";
export const THAURDIR_CAPTAIN = "10127";
export const THAURDIR_CHAMPION = "10128";
export const CARN_DUM_GARRISON = "10129";
export const FURIOUS_CHARGE = "10139";

/** Thaurdir in play (either side), or undefined. */
export const thaurdirNow = (game: ScenarioState): CardInstance | undefined => Object.values(game.cards).find((card) => (card.code === THAURDIR_CAPTAIN || card.code === THAURDIR_CHAMPION) && inPlay(card.zone));

/** The side Thaurdir shows: his code says it (10127 Captain, 10128 Champion). */
export const sideOf = (card: CardInstance): ThaurdirSide => (card.code === THAURDIR_CAPTAIN ? "Captain" : "Champion");

/** The shadow cards dealt to him that flip him on stage 1B, or null on any other stage. */
export function flipsAt(game: ScenarioState): number | null {
  const stage = stageOf(game, 0);
  return stage != null && game.cards[stage]?.code === CLUTCHES_OF_CARN_DUM ? THAURDIR_FLIP_SHADOWS : null;
}

export function dumDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  const stageId = stageOf(game, 0);
  const stage = stageId ? game.cards[stageId] : undefined;
  if (stage?.code !== CLUTCHES_OF_CARN_DUM && stage?.code !== MIDWINTERS_CRUX) return [];
  const dials: TableDial[] = [];
  const thaurdir = thaurdirNow(game);
  // Thaurdir's side and the shadow cards dealt to him: a count against the number that flips him on stage 1B; on stage 2B shadow cards flip nobody, so the dial has no limit. Neither side of the flip is good news or bad, so the ring never warms and has no warning.
  if (thaurdir) {
    const side = sideOf(thaurdir);
    const shadows = shadowCards(thaurdir).length;
    const limit = flipsAt(game);
    dials.push({ id: "side", testID: "angmar-side", label: side, name: thaurdirDialName(side), value: shadows, ...(limit != null ? { limit, limitWords: thaurdirLimitWords(limit) } : {}), note: thaurdirDialWords(side, shadows, limit) });
  }
  // Stage 2B: the progress on the stage against 15, the way out the players move toward (a goal: it fills in the accent, never warms).
  if (stage.code === MIDWINTERS_CRUX) dials.push({ id: "crux", testID: "angmar-crux", label: "Crux", name: cruxName(nameOf(stage.code)), value: stage.progress, limit: CRUX_PROGRESS, goal: true, limitWords: cruxLimitWords(CRUX_PROGRESS), note: cruxWords(stage.progress, CRUX_PROGRESS, nameOf(stage.code)) });
  return dials;
}
