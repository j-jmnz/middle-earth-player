// Rules: mec108.thaurdir, mec108.indestructible, rr.active-location (data/rules/entries.json); ledger lines 10125:B:1, 10125:B:3, 10126:B:1, 10126:B:2, 10126:B:3, 10127:A:4, 10128:A:4, 10129:A:1, 10139:A:3.
//
// The pieces The Battle of Carn Dûm's cards hold on the table: Thaurdir's side with the shadow cards dealt to him against the 3 that flip him on stage 1B (one dial; each flip does something, which its note says), and on stage 2B the progress on Midwinter's Crux against the 15 that take his Indestructible
// away (a goal). The engine decided every number (`shadowCards`, the stage's progress, `hitPointsOf`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { CAPTAIN, CHAMPION, CLUTCHES, CRUX, CRUX_PROGRESS, FURIOUS_CHARGE as FURIOUS, GARRISON, THAURDIR_FLIP_SHADOWS, THAURDIR_HEAL } from "../../effects/authored/angmar-awakened/the-battle-of-carn-dum.ts";
import { inPlay, type CardInstance, type ScenarioState } from "../../rules/core/state.ts";
import { shadowCards } from "../../rules/core/zones.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { hitPointsOf } from "../../rules/families/angmar/quest.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";

import { cruxLimitWords, cruxName, cruxWords, thaurdirDialName, thaurdirDialWords, thaurdirLimitWords, thaurdirNearWords, type ThaurdirSide } from "../words/scenarios/angmar/carn-dum-table.ts";
import type { TableDial } from "./dials.ts";

export const CLUTCHES_OF_CARN_DUM = CLUTCHES;
export const MIDWINTERS_CRUX = CRUX;
export const THAURDIR_CAPTAIN = CAPTAIN;
export const THAURDIR_CHAMPION = CHAMPION;
export const CARN_DUM_GARRISON = GARRISON;
export const FURIOUS_CHARGE = FURIOUS;

/** Thaurdir in play (either side), or undefined. */
export const thaurdirNow = (game: ScenarioState): CardInstance | undefined => Object.values(game.cards).find((card) => (card.code === THAURDIR_CAPTAIN || card.code === THAURDIR_CHAMPION) && inPlay(card.zone));

/** The side Thaurdir shows: his code says it (10127 Captain, 10128 Champion). */
export const sideOf = (card: CardInstance): ThaurdirSide => (card.code === THAURDIR_CAPTAIN ? "Captain" : "Champion");

/** The shadow cards dealt to him that flip him on stage 1B, or null on any other stage. */
export function flipsAt(game: ScenarioState): number | null {
  const stage = stageOf(game, 0);
  return stage != null && game.cards[stage]?.code === CLUTCHES_OF_CARN_DUM ? THAURDIR_FLIP_SHADOWS : null;
}

export function dumDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const stageId = stageOf(game, 0);
  const stage = stageId ? game.cards[stageId] : undefined;
  if (stage?.code !== CLUTCHES_OF_CARN_DUM && stage?.code !== MIDWINTERS_CRUX) return [];
  const dials: TableDial[] = [];
  const thaurdir = thaurdirNow(game);
  // Thaurdir's side and the shadow cards dealt to him: a count against the number that flips him on stage 1B; on stage 2B shadow cards flip nobody, so the dial has no limit. Holding that many or more, another card does not flip him (10125:B:3 fires on exactly 3), so the limit goes
  // until the cards are discarded. The label is his name, so it does not change width with his side; the side is in the name and the note. The ring never warms or goes critical, but a Captain one card short of flipping warns: the flip to Champion heals him and attacks at once.
  if (thaurdir) {
    const side = sideOf(thaurdir);
    const shadows = shadowCards(thaurdir).length;
    const flips = flipsAt(game);
    const limit = flips != null && shadows < flips ? flips : null;
    const near = side === "Captain" && flips != null && shadows === flips - 1;
    dials.push({
      id: "side",
      testID: "angmar-side",
      label: "Thaurdir",
      name: thaurdirDialName(side),
      value: shadows,
      ...(limit != null ? { limit, limitWords: thaurdirLimitWords(limit) } : {}),
      ...(near ? { warn: { level: "near" as const, words: thaurdirNearWords(THAURDIR_HEAL) } } : {}),
      note: thaurdirDialWords(side, shadows, flips, THAURDIR_HEAL),
    });
  }
  // Stage 2B: the progress on the stage against 15, the way out the players move toward (a goal: it fills in the accent, never warms). At 15 the next goal is the damage on Thaurdir against his hit points, read in its note.
  if (stage.code === MIDWINTERS_CRUX) {
    const hurt = thaurdir ? { damage: thaurdir.damage, hitPoints: hitPointsOf(game, thaurdir, ctx) } : null;
    dials.push({ id: "crux", testID: "angmar-crux", label: "Crux", name: cruxName(nameOf(stage.code)), value: stage.progress, limit: CRUX_PROGRESS, goal: true, limitWords: cruxLimitWords(CRUX_PROGRESS), note: cruxWords(stage.progress, CRUX_PROGRESS, nameOf(stage.code), hurt) });
  }
  return dials;
}
