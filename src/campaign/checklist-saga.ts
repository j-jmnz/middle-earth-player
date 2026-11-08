// Rules: mec112.setting-up-the-game, mec112.aragorn, mec112.campaign-mode-aragorn (data/rules/entries.json). What the Campaign Setup Checklist needs to know about the
// saga hero of a scenario that has a `sagaStart` (The Two Towers): which hero the scenario grants, which logged heroes belong to the saga and are not a player's choice
// of hero, and which are an earlier version of the granted Aragorn. A scenario with no `sagaStart` (every other campaign, and the Fellowship's six) is `active: false`: the
// checklist reads it exactly as before. Pure.
import type { ScenarioData } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/core/printed.ts";

import type { PoolCard } from "./log.ts";

export type ChecklistSaga = {
  active: boolean;
  // The ☺ hero the scenario grants the first player (☺ Aragorn in scenarios 7 to 9), or null (a Ring-bearer scenario).
  granted: string | null;
  // A Fellowship-sphere hero: the saga's, so changing or leaving one out is no hero change (the Ring-bearer Frodo, ☺ Aragorn).
  ofSaga: (code: string) => boolean;
  // A hero titled Aragorn other than the granted one: the version a player recorded in the log, who is lost when the scenario grants ☺ Aragorn.
  isAragorn: (code: string) => boolean;
};

const INACTIVE: ChecklistSaga = { active: false, granted: null, ofSaga: () => false, isAragorn: () => false };

export function sagaOf(scenario: Pick<ScenarioData, "sagaStart">, cards: ReadonlyMap<string, PrintedCard>): ChecklistSaga {
  const start = scenario.sagaStart;
  if (!start) return INACTIVE;
  const granted = "hero" in start ? start.hero : null;
  const grantedName = granted != null ? cards.get(granted)?.name : undefined;
  return {
    active: true,
    granted,
    ofSaga: (code) => {
      const card = cards.get(code);
      return card != null && card.type === "hero" && card.sphere === "fellowship";
    },
    isAragorn: (code) => grantedName != null && code !== granted && cards.get(code)?.type === "hero" && cards.get(code)?.name === grantedName,
  };
}

/**
 * "If Aragorn had previously been added to the list of fallen heroes, remove his name from the list and each player incurs a permanent +1 threat
 * penalty" (mec112.campaign-mode-aragorn): the fallen lists without the logged Aragorn, and the penalty that costs each player (0 when there is none to remove).
 */
export function fallenWithoutAragorn(saga: ChecklistSaga, fallen: readonly (readonly string[])[]): { fallenLists: readonly (readonly string[])[]; forcedPenalty: number } {
  if (!saga.active || saga.granted == null || !fallen.flat().some(saga.isAragorn)) return { fallenLists: fallen, forcedPenalty: 0 };
  return { fallenLists: fallen.map((list) => list.filter((code) => !saga.isAragorn(code))), forcedPenalty: 1 };
}

/**
 * One seat's logged heroes and the heroes it plays, split by the saga: `lost` the logged Aragorn the scenario replaces, `keptSaga` the Fellowship heroes the log keeps, `loggedPlayers` and
 * `playersNow` the heroes that are the player's own choice (the granted hero and the saga's are not).
 */
export function sagaSeat(saga: ChecklistSaga, logged: readonly string[], playing: readonly string[]): { lost: string[]; keptSaga: string[]; loggedPlayers: string[]; playersNow: string[] } {
  const lost = saga.active ? logged.filter(saga.isAragorn) : [];
  const keptSaga = saga.active ? logged.filter((code) => saga.ofSaga(code)) : [];
  const loggedPlayers = logged.filter((code) => !lost.includes(code) && !(saga.active && saga.ofSaga(code)));
  const playersNow = playing.filter((code) => !(saga.active && saga.ofSaga(code)));
  return { lost, keptSaga, loggedPlayers, playersNow };
}

/** The heroes that replace a lost Aragorn without the +1 penalty: one for each. */
export function freedBy(lost: readonly string[], added: readonly string[]): number {
  return Math.min(lost.length, added.length);
}

/** The pool with the cards stuck to a logged Aragorn moved to the granted hero (mec112.campaign-mode-aragorn). */
export function moveToGranted(pool: readonly PoolCard[], forgotten: ReadonlySet<string>, saga: ChecklistSaga): PoolCard[] {
  const granted = saga.granted;
  if (forgotten.size === 0 || granted == null) return [...pool];
  return pool.map((card) => (card.attachedTo != null && forgotten.has(card.attachedTo) ? { ...card, attachedTo: granted } : card));
}
