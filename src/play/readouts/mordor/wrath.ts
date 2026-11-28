// Rules: vom.controlling-locations, vom.losing-control-of-a-location, rr.travel, rr.quest-advancement (data/rules/entries.json); ledger lines 22025:B:3, 22026:B:2, 22014:A:2, 22014:A:3, 22022:A:1, 22015:A:3, 22016:A:2.
//
// The numbers Wrath and Ruin keeps in view: the locations the players control against the locations in the staging area (which gate stage 1B, the Gate of Dorwinion's travel and X), stage 2B's progress against the 12 the Gate needs, a mark on each seat of the locations it controls (two-handed) and
// the preview of Gate of Dorwinion and of the two locations that return. A controlled location lies in its player's play row and its preview and banner come from Assault on Osgiliath's hooks (readouts/against-the-shadow/osgiliath.ts, which this scenario shares).
// The engine decided every number (the controlled locations, the staging area, `progress`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { printedOf } from "../../../rules/core/printed.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { livingSeats } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { stagedLocationCount } from "../../../rules/families/mordor/outnumber.ts";
import { controllerOf, controlledLocations } from "../../../rules/families/pelargir/location-control.ts";
import type { TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";
import { controlLimitWords, controlMarkLabel, controlMarkWords, controlWords, gateCardWords, gateLimitWords, gateWords, HOUSE_HELD, SQUARE_HELD } from "./wrath-words.ts";

const SCENARIO = "wrath-and-ruin";
const STAGE_1 = "22025";
const STAGE_2 = "22026";
const GATE = "22014";
const SQUARE = "22015";
const HOUSE = "22016";
/** The progress on stage 2B that opens the way to the Gate. */
const GATE_AT = 12;

const nameIn = (ctx: ReduceContext, game: ScenarioState, id: string): string => printedOf(ctx.cards, game.cards[id]?.code ?? "").name;

/** The dials the table holds now: Control (the locations the players control against those in the staging area) from stage 1 on, and the Gate (stage 2B's progress) on stage 2B. None in any other scenario. */
export function wrathDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage || (stage.code !== STAGE_1 && stage.code !== STAGE_2)) return [];
  const held = controlledLocations(game);
  const staged = stagedLocationCount(game, ctx);
  const dials: TableDial[] = [
    { id: "control", testID: "wrath-control", label: "Control", name: `Locations the players control, against more than the ${staged} in the staging area:`, value: held.length, limit: staged + 1, goal: true, limitWords: controlLimitWords(staged), cardId: stage.id, note: controlWords(held.map((id) => nameIn(ctx, game, id)), staged) },
  ];
  if (stage.code === STAGE_2 && stage.face === "B") dials.push({ id: "gate", testID: "wrath-gate", label: "Gate", name: `Progress on ${nameOf(STAGE_2)}:`, value: stage.progress, limit: GATE_AT, goal: true, limitWords: gateLimitWords(), cardId: stage.id, note: gateWords(stage.progress) });
  return dials;
}

/** Each living seat's mark in a two-handed game: the locations it controls ("P1 2"). A solo game has none (the Control dial says the one count). None in any other scenario. */
export function wrathHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO || game.seatCount <= 1) return [];
  const stage = game.questStage ? game.cards[game.questStage]?.code : undefined;
  if (stage !== STAGE_1 && stage !== STAGE_2) return [];
  return livingSeats(game).map((seat) => {
    const names = controlledLocations(game).filter((id) => controllerOf(game, id) === seat).map((id) => nameIn(ctx, game, id));
    return { seat, label: controlMarkLabel(seat, names.length), note: controlMarkWords(game.seatCount, seat, names) };
  });
}

/** The preview's line for Gate of Dorwinion, and for a controlled Contested Square or Ransacked House. Null for any other card or scenario. */
export function wrathDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (game.scenarioId !== SCENARIO || !card) return null;
  if (card.code === GATE && (card.zone === "staging" || card.zone === "activeLocation")) {
    const stage = game.questStage ? game.cards[game.questStage] : undefined;
    const held = controlledLocations(game).length;
    return gateCardWords(held + 1, stage?.code === STAGE_2 ? stage.progress : 0, held, stagedLocationCount(game, ctx));
  }
  if (card.zone === "play" && controllerOf(game, cardId) != null) {
    if (card.code === SQUARE) return SQUARE_HELD;
    if (card.code === HOUSE) return HOUSE_HELD;
  }
  return null;
}
