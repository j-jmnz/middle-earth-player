// Bump ENGINE_VERSION when a change to the engine can move a game that was replayed from its intents: a rule, a verb, the shuffle, the order of ids.
// A bump adds an ENGINE_CHANGES entry for the new number: the scenarios it reaches (or "all") and one plain line for players. The table's sheet for a game
// dealt on an earlier version lists the lines that reach its scenario, and the release notes name the scenarios the lines since the last release reach.

export type EngineChange = {
  version: number;
  /** The ids of the scenarios whose games the change can move, or "all". */
  scenarios: readonly string[] | "all";
  /** One sentence for a player: what the rules now do, in sentence case, with no rule ids or code names. */
  note: string;
};

const FELLOWSHIP = ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark", "breaking-of-the-fellowship"];
const SEA = ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived", "the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"];

// One entry for each version, from the first listed to ENGINE_VERSION (src/rules/engine/version.test.ts).
export const ENGINE_CHANGES: readonly EngineChange[] = [
  { version: 10, scenarios: FELLOWSHIP, note: "An ally you control that has printed combat stats now counts as an ally whenever a card asks you to pick a character or an ally." },
  { version: 11, scenarios: ["the-oath"], note: "A location's Response that puts progress on the quest now waits for the stage that progress advanced, and The Eaves of Mirkwood stops only the Responses that cancel." },
  { version: 12, scenarios: ["journey-along-the-anduin"], note: "A full quest stage that was held back now advances as soon as nothing holds it, not at the next quest resolution." },
  { version: 13, scenarios: "all", note: "While a Peril card is revealed, an any-player Response is offered only to the player revealing it, and the quest phase offers Commit only in its pass window." },
  { version: 14, scenarios: ["the-ring-goes-south", "journey-in-the-dark", "the-caves-of-nibin-dum", ...SEA], note: "An enemy that attacks from the staging area now makes the additional attack its shadow card grants, and a Sailing test turns the heading before you commit." },
  { version: 15, scenarios: "all", note: "A two-handed planning phase goes on in player order from the first player, a cannot-attack effect ends the attack it was used against, and a ship-enemy's Boarding comes after the Responses to its engagement." },
  { version: 16, scenarios: ["voyage-across-belegaer"], note: "Naming a card offers every card of the game, and Sudden Storms, Ballista and the Hard and Expert Mode cards work as printed." },
  { version: 17, scenarios: "all", note: "The separate staging areas and the sea scenarios now share one rules engine, so every earlier change of either side applies together." },
  { version: 18, scenarios: ["the-fate-of-numenor", "voyage-across-belegaer"], note: "The Scramble in A Fateful Discovery changes which card lies behind each Lost Island, and an explored location is heard by the Fate quest cards when it leaves play." },
  { version: 19, scenarios: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens"], note: "A choice made through an objective ally with an encounter card back is no longer a player card effect, and the Corsair Skiff offers Boarding only while a Corsair card is available." },
  { version: 20, scenarios: ["the-thing-in-the-depths"], note: "An enemy grappled with a location stays in play beside it and joins the staging area only when that location becomes active or is explored." },
  { version: 21, scenarios: ["temple-of-the-deceived"], note: "A card that exhausts another by name exhausts a ready one, and the Island Map keeps the locations you traveled from." },
  { version: 22, scenarios: ["the-drowned-ruins"], note: "The campaign card of The Drowned Ruins counts the resources on its own card, so a game can end with more XP." },
  { version: 23, scenarios: ["the-thing-in-the-depths", "the-city-of-corsairs"], note: "An enemy destroyed by damage that reached its hit points is heard by the cards attached to it, which can end these scenarios sooner." },
  { version: 24, scenarios: ["journey-up-the-anduin"], note: "A location that prints X quest points now has quest points, so it takes progress as the active location and can be explored." },
  { version: 25, scenarios: "all", note: "A player eliminated by a damage sweep hands their open window on at once, and a full stage advances after Forced effects when an explored location may cancel its progress." },
  { version: 26, scenarios: "all", note: "A hand you mulligan away no longer fires the draw effects of its cards." },
];

export const ENGINE_VERSION = 26;

/** The notes of the changes after `fromVersion`, up to the build's version, that can move a game of `scenarioId`. */
export function changesReaching(scenarioId: string, fromVersion: number): readonly string[] {
  return ENGINE_CHANGES.filter((change) => change.version > fromVersion && change.version <= ENGINE_VERSION && (change.scenarios === "all" || change.scenarios.includes(scenarioId))).map((change) => change.note);
}
