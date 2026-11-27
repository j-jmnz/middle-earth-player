// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 17145:A:1, 17145:A:4, 17150:A:2, 17151:A:1, 17157:A:1, 17158:A:1, 17159:A:1, 17160:A:1 to 17162:A:1 (docs/scenarios/haradrim/the-crossings-of-poros.md, Table).
// The Crossings of Poros as top-bar dials: the encounter sets set aside with the cards each still holds (the readout "the set with the most cards remaining" needs), the stages of the path played and removed, and Poros Garrison with its damage against its hit
// points, and the seat that controls it (its ring's held mark). The engine decided every number; nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { ASIDE_SETS } from "../../../effects/authored/haradrim/the-crossings-of-poros.ts";
import { modifiedStat } from "../../../rules/core/modified-stat.ts";
import { inPlay, type ScenarioState } from "../../../rules/core/state.ts";
import { asideOf } from "../../../rules/families/haradrim/set-aside.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";

import { ASIDE_FOOT, asideTie, ASIDE_LABEL, ASIDE_NAME, asideLine, asideNote, GARRISON_LABEL, GARRISON_HELD_WORDS, GARRISON_NAME, garrisonLimitWords, garrisonNearWords, garrisonNote, PATH_LABEL, PATH_NAME, pathNote, stageLine } from "../../words/scenarios/haradrim/poros-table.ts";
import { cardsOf, type TableDial } from "../dials.ts";
import type { HeldDial } from "../widgets.ts";

const SCENARIO = "the-crossings-of-poros";
const GARRISON = "17145";
// The stages by number: the ones the players pick at random are the stage 2 and the stage 3 cards.
const STAGES: readonly (readonly string[])[] = [["17157"], ["17158", "17159"], ["17160", "17161", "17162"], ["17163"]];
const NEAR = 2;
const CRITICAL = 1;

type Status = "current" | "played" | "removed" | "aside" | "ahead";

/** How a stage card stands: the one in play, a stage 2 removed from the game (17158:A:1), a stage 3 set aside by stage 3A (the stage 4 search reads it), one played and left, or one still in the quest deck. */
function statusOf(game: ScenarioState, code: string, number: number): Status | null {
  const cards = Object.values(game.cards).filter((card) => card.code === code);
  if (cards.length === 0) return null;
  if (game.questStage != null && game.cards[game.questStage]?.code === code) return "current";
  if (cards.some((card) => card.removedStage === true)) return number === 3 ? "aside" : "removed";
  return cards.some((card) => game.questDeck.includes(card.id)) ? "ahead" : "played";
}

/** The sets set aside with their cards left, the most first; null in another scenario. */
function asideCounts(game: ScenarioState, ctx: ReduceContext): { set: string; left: number }[] | null {
  if (game.scenarioId !== SCENARIO) return null;
  return ASIDE_SETS.map((set) => ({ set, left: asideOf(game, set, ctx).length })).sort((a, b) => b.left - a.left);
}

/** The dials of The Crossings of Poros: none in any other scenario. */
export function porosDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const counts = asideCounts(game, ctx);
  if (!counts) return [];
  const dials: TableDial[] = [];
  // Poros Garrison first: it is the dial that says the players lose, so it stays in view where the left zone scrolls (top bar, keptBox).
  const garrison = cardsOf(game, GARRISON)[0];
  if (garrison) {
    const hitPoints = modifiedStat(game, garrison, "hitPoints", ctx.cards);
    const left = Math.max(0, hitPoints - garrison.damage);
    const level = left <= CRITICAL ? ("critical" as const) : left <= NEAR ? ("near" as const) : null;
    dials.push({ id: "garrison", testID: "poros-garrison", label: GARRISON_LABEL, name: GARRISON_NAME, value: garrison.damage, limit: hitPoints, warms: true, ...(level ? { warn: { level, words: garrisonNearWords(left) } } : {}), limitWords: garrisonLimitWords(hitPoints), note: garrisonNote(game.seatCount > 1 ? (garrison.controller ?? game.firstPlayer) : null, garrison.damage, hitPoints), cardId: garrison.id });
  }
  // The Aside dial counts what is set aside: with no card left in any set it has nothing to say, so it is not pushed.
  const most = counts[0]?.left ?? 0;
  if (most > 0) {
    const lines = counts.map(({ set, left }) => asideLine(set, left, left === most));
    const leaders = counts.filter(({ left }) => left === most).map(({ set }) => set);
    dials.push({ id: "aside", testID: "poros-aside", label: ASIDE_LABEL, name: ASIDE_NAME, value: most, note: asideNote(most, leaders), lists: [{ heading: ASIDE_NAME, lines }], said: lines.join(". "), foot: leaders.length > 1 ? `${asideTie(leaders)} ${ASIDE_FOOT}` : ASIDE_FOOT });
  }

  const path = STAGES.map((codes, index) => ({ number: index + 1, rows: codes.flatMap((code) => { const status = statusOf(game, code, index + 1); return status ? [{ code, status }] : []; }) }));
  const current = path.find(({ rows }) => rows.some(({ status }) => status === "current"));
  if (current) {
    const code = current.rows.find(({ status }) => status === "current")?.code ?? "";
    const lists = path.filter(({ number, rows }) => (number === 2 || number === 3) && rows.length > 0).map(({ number, rows }) => ({ heading: `Stage ${number}`, lines: rows.map(({ code: stage, status }) => stageLine(nameOf(stage), status)) }));
    const said = lists.map(({ heading, lines: rows }) => `${heading}. ${rows.join(". ")}`).join(". ");
    dials.push({ id: "path", testID: "poros-path", label: PATH_LABEL, name: PATH_NAME, value: current.number, limit: 4, goal: true, note: pathNote(current.number, nameOf(code)), lists, said });
  }
  return dials;
}

/** The seat that controls Poros Garrison wears the held mark on its ring, two-handed only (a lone player's threat dial has no seat to tell from another). None while no player controls it and in any other scenario. */
export function porosHeld(game: ScenarioState): readonly HeldDial[] {
  if (game.scenarioId !== SCENARIO || game.seatCount < 2) return [];
  return cardsOf(game, GARRISON).flatMap((card) => (card.controller == null || !inPlay(card.zone) ? [] : [{ seat: card.controller, words: GARRISON_HELD_WORDS, mark: "hero" as const }]));
}
