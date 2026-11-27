// Amount shapes only one family or box reads (src/catalog/effect-schema-amount.ts; each says where the engine reads it): the captured counts, the excess damage, the island and Stormcaller values and the recorded count.
import { str, type Obj } from "../kit.ts";
import { cardRef } from "../amounts.ts";

type Made = { text: string; read: string[] };

const CAPTURED: Readonly<Record<string, string>> = {
  under: "the number of captured cards underneath this card",
  cardsWith: "the number of cards in play with 1 or more captured cards underneath them",
  questsAndSides: "the number of quest cards the players have completed plus the number of side quests in the victory display",
  players: "the number of players in the game, for each player at every staging area",
};

/** The value of an amount expression that only a family reads, or null when the expression is none of them. */
export function familyAmount(expr: Obj): Made | null {
  if (typeof expr.captured === "string") return { text: CAPTURED[expr.captured] ?? str(expr.captured), read: ["captured"] };
  if (expr.excessOf === "subject") return { text: "the damage on the card the event is about beyond its printed hit points", read: ["excessOf"] };
  if (expr.excess === true) return { text: "the damage the attack in progress sent on past its defender", read: ["excess"] };
  if (expr.grappled === true) return { text: "the number of enemies grappled with locations in the staging area", read: ["grappled"] };
  if (expr.islandLeft === true) return { text: "the total Threat of the locations to the left of the active location, in its row on the Island Map", read: ["islandLeft"] };
  if (expr.stormcallerStage === true) return { text: "the stage number of the Stormcaller's current quest stage (0 with no Stormcaller's area)", read: ["stormcallerStage"] };
  if (expr.stagedAlliesCost === true) return { text: "the total printed cost of the allies in the staging area (a card with no printed cost counts 0)", read: ["stagedAlliesCost"] };
  if (typeof expr.recorded === "string") return { text: `the count the earlier Resolution recorded in the Campaign Log's notes as "${expr.recorded}" (0 when none is recorded or the game has no log)`, read: ["recorded"] };
  if (typeof expr.poison === "string") return { text: `the number of poison on ${cardRef(expr.poison)}`, read: ["poison"] };
  if (typeof expr.hidden === "string") return { text: expr.hidden === "own" ? "the number of hidden cards in the acting player's play area" : "the total number of hidden cards in every player's play area", read: ["hidden"] };
  if (expr.temperature === "value") return { text: "the temperature of the heat tracker (0 while none is set)", read: ["temperature"] };
  if (expr.temperature === "tens") return { text: "the tens digit of the temperature of the heat tracker (0 while none is set)", read: ["temperature"] };
  if (expr.willpowerGap === true) return { text: "while this enemy attacks a defending character with less Willpower than its own Threat: its Threat less that Willpower (otherwise 0; an undefended attack has no defending character)", read: ["willpowerGap"] };
  if (typeof expr.heldPrinted === "object" && expr.heldPrinted !== null) {
    const held = expr.heldPrinted as { stat?: unknown; ownedByActor?: unknown };
    return { text: `the printed ${held.stat === "cost" ? "cost" : "Willpower"} of the captive this card holds${held.ownedByActor === true ? " that the acting player owns" : ""} (0 when it holds none)`, read: ["heldPrinted"] };
  }
  if (expr.part === true) return { text: "the part number of the campaign card of the scenario being played: its place in its campaign, counting from 1", read: ["part"] };
  return null;
}

export const FAMILY_AMOUNT_SAMPLES: readonly Obj[] = [
  { captured: "under" },
  { captured: "cardsWith" },
  { captured: "questsAndSides" },
  { captured: "players", times: 4 },
  { excessOf: "subject" },
  { excess: true },
  { grappled: true },
  { islandLeft: true },
  { stormcallerStage: true },
  { stagedAlliesCost: true },
  { recorded: "corsairFleet" },
  { part: true },
  { temperature: "value" },
  { temperature: "tens" },
  { willpowerGap: true },
  { heldPrinted: { stat: "willpower" } },
  { heldPrinted: { stat: "cost", ownedByActor: true } },
  { poison: "picked" },
  { hidden: "own" },
  { hidden: "all" },
];
