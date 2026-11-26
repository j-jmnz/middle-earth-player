// Rules: dcce.stormcallers-area, hrd.orcs-area (data/rules/entries.json). The words of a quest area, one record for each kind of area (the Stormcaller's, the Orcs'). Every site that says something of the area (a card's preview, what a screen
// reader hears, a row list's title, a fold stack's phrase) reads its record through `areaWordsOf(areaKind(game))`, so a new sentence is written once for each kind and no site chooses between two sets of words. Pure.
import { ORCS_APART, ORCS_FOLD_WHERE, ORCS_LIST_TITLE, ORCS_TOGETHER, orcsMemberSpeech, orcsStageLines, orcsStageSpeech, orcsTell } from "./haradrim/orcs-table.ts";
import { AREA_APART, AREA_FOLD_WHERE, AREA_LIST_TITLE, AREA_TOGETHER, areaTell, memberSpeech, stageLines, stageSpeech, type AreaKind, type StageFacts } from "./stormcaller.ts";

export type AreaWords = {
  /** The preview sentence of a card of the area while the players are at another stage, and at the area's stage. */
  apart: string;
  together: string;
  /** The title of the row list that holds only the area's cards, and what a screen reader hears of its fold stack ("3 more cards in the Orcs' area"). */
  listTitle: string;
  foldWhere: string;
  /** The preview lines of the area's current stage. */
  stageLines: (facts: StageFacts) => string[];
  /** What a screen reader hears of the stage and of a card of the area. */
  stageSpeech: (facts: StageFacts & { name: string; names: readonly string[] }) => string;
  memberSpeech: (name: string, role: "apart" | "together") => string;
  /** The word a card of the area wears on a list that does not draw it. */
  tell: (role: "stage" | "apart" | "together", stage?: StageFacts | null) => string;
};

export const AREA_WORDS: Readonly<Record<AreaKind, AreaWords>> = {
  stormcaller: { apart: AREA_APART, together: AREA_TOGETHER, listTitle: AREA_LIST_TITLE, foldWhere: AREA_FOLD_WHERE, stageLines, stageSpeech, memberSpeech, tell: areaTell },
  orcs: { apart: ORCS_APART, together: ORCS_TOGETHER, listTitle: ORCS_LIST_TITLE, foldWhere: ORCS_FOLD_WHERE, stageLines: orcsStageLines, stageSpeech: orcsStageSpeech, memberSpeech: orcsMemberSpeech, tell: orcsTell },
};

/** The words of the game's area; a game with no area gets the Stormcaller's, which no site reads then. */
export const areaWordsOf = (kind: AreaKind | null | undefined): AreaWords => AREA_WORDS[kind ?? "stormcaller"];
