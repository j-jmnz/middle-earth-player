// Rules: rr.forced, rr.quest-advancement (data/rules/entries.json); ledger lines 21077:B:2, 21078:B:2, 21033:A:1, 21035:A:2, 21037:A:1 (docs/scenarios/vengeance-of-mordor/danger-in-dorwinion.md, Table).
//
// The numbers Danger in Dorwinion keeps in view: the resources on stage 1B or 2B against the number that let it be defeated (a goal dial, the players' way out), the resources on Bribes (each adds 1 Threat), the damage on Sauron Worship (each lowers the elimination level), and a mark on each seat while Hillside Manor is in the staging area (the threat player card effects took off this round against the 1 allowed).
// The engine decided every number (`resources`, `damage`, `playerThreatLoweredBy`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { inPlay, livingSeats } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { cardsOf, type TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";
import { bribesWords, capMarkLabel, capMarkWords, gateLimitWords, gateNearWords, gateWords, worshipWords } from "./dorwinion-words.ts";

const SCENARIO = "danger-in-dorwinion";
/** The stages that hold resources (1B and 2B), Bribes, Sauron Worship and Hillside Manor. */
const CITY = "21077";
const SHADOW = "21078";
const BRIBES = "21033";
const WORSHIP = "21035";
const MANOR = "21037";

/** The resources a stage needs before it can be defeated: 2 on stage 1, 3 more than the players on stage 2. */
const neededOn = (game: ScenarioState, code: string): number | null => (code === CITY ? 2 : code === SHADOW ? game.seatCount + 3 : null);

/** The dials the table holds now: the stage gate, then Bribes and Sauron Worship while each is in play. None in any other scenario. */
export function dorwinionDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const needed = stage ? neededOn(game, stage.code) : null;
  if (stage && needed != null && stage.face === "B") {
    const name = nameOf(stage.code);
    // The gate holds the stage back once its progress would defeat it: the progress fills its quest points (stage 2B prints 0, so any progress does).
    const points = modifiedStat(game, stage, "questPoints", ctx.cards);
    const held = stage.resources < needed && stage.progress > 0 && stage.progress >= points;
    dials.push({ id: "gate", testID: "dorwinion-gate", label: "Gate", name: `Resources on ${name}:`, value: stage.resources, limit: needed, goal: true, limitWords: gateLimitWords(needed), cardId: stage.id, note: gateWords(name, stage.resources, needed), ...(held ? { warn: { level: "near" as const, words: gateNearWords(name, needed - stage.resources, points > 0) } } : {}) });
  }
  const bribes = cardsOf(game, BRIBES).find((card) => card.zone === "staging" || card.zone === "engaged");
  if (bribes) dials.push({ id: "bribes", testID: "dorwinion-bribes", label: "Bribes", name: `Resources on ${nameOf(BRIBES)}:`, value: bribes.resources, cardId: bribes.id, note: bribesWords(bribes.resources) });
  const worship = cardsOf(game, WORSHIP).find((card) => inPlay(card.zone));
  if (worship) dials.push({ id: "worship", testID: "dorwinion-worship", label: "Worship", name: `Damage on ${nameOf(WORSHIP)}:`, value: worship.damage, cardId: worship.id, note: worshipWords(worship.damage) });
  return dials;
}

/** Each living seat's mark while Hillside Manor is in the staging area: what player card effects took off its threat this round against the 1 allowed. None otherwise. */
export function dorwinionHands(game: ScenarioState): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO || !cardsOf(game, MANOR).some((card) => card.zone === "staging")) return [];
  return livingSeats(game).map((seat) => {
    const lowered = game.playerThreatLoweredBy?.[seat] ?? 0;
    return { seat, label: capMarkLabel(game.seatCount > 1 ? seat : null, lowered), note: capMarkWords(lowered) };
  });
}
