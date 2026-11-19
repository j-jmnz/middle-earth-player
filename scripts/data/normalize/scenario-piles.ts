import type { Card } from "../../../src/catalog/card-facts.ts";
import { clausesOf, codesOf, type ParsedSetup, type SetupClause, type SetupStep } from "./setup-text.ts";

// What the quest card's printed Setup says about one card of a scenario's load list. `same` is true for a code and itself, and for the two
// sides of one two-sided card (the Stormcaller Elite's enemy and objective-ally rows), so a Setup that names a card by title is satisfied by
// the physical card it is loaded as and by no other card of that title.
export type QuestFacts = {
  said: (kinds: readonly SetupClause["kind"][]) => boolean;
  // The Setup puts this card into play engaged with the first player (the Passage of the Marshes' Gollum): the card waits set aside until then.
  putEngaged: boolean;
  steps: (...wanted: readonly SetupStep[]) => boolean;
  stepExists: (...wanted: readonly SetupStep[]) => boolean;
  inSets: (list: readonly string[]) => boolean;
  setAsideBySet: boolean;
};

export function questFacts(args: { quest: ParsedSetup; code: string; printed: Card | undefined; same: (left: string, right: string) => boolean; canon: (name: string) => string }): QuestFacts {
  const { quest, code, printed, same, canon } = args;
  const stepClauses = clausesOf(quest, "step");
  const inSets = (list: readonly string[]) => list.some((name) => canon(name) === canon(printed?.encounterSet ?? "\u0000"));
  return {
    said: (kinds) => [...codesOf(quest, kinds)].some((named) => same(named, code)),
    putEngaged: clausesOf(quest, "putIntoPlay").some((clause) => clause.under === "engagedFirstPlayer" && clause.codes.some((named) => same(named, code))),
    steps: (...wanted) => stepClauses.some((clause) => wanted.includes(clause.step) && clause.codes.some((named) => same(named, code))),
    stepExists: (...wanted) => stepClauses.some((clause) => wanted.includes(clause.step)),
    inSets,
    setAsideBySet: stepClauses.some((clause) => inSets(clause.asideSets ?? [])),
  };
}

// A Harad enemy the campaign log records: a Setup that sets "each Harad enemy recorded in the campaign log" aside deals the card, whatever its own pile (Journey to the Cross-roads and The Battle of the Pelennor Fields).
export function loggedHarad(setup: ParsedSetup, printed: Card | undefined): boolean {
  return clausesOf(setup, "step").some((clause) => clause.step === "asideLogged") && printed?.traits.includes("Harad") === true;
}

// A pile a card sits in must be one a Setup line of the quest card puts it in (the campaign card's lines are checked by the caller). The
// Dream-chaser decks are dealt by their "Prepare the ... deck" step, the fleet by "Players prepare their fleet", the second encounter deck
// by the encounter set the Setup sets aside.
export function pileAccepts(args: { code: string; pile: string; printed: Card | undefined; quest: ParsedSetup; facts: QuestFacts }): boolean {
  const { code, pile, printed, quest, facts } = args;
  const { said, putEngaged, steps, stepExists, setAsideBySet } = facts;
  const own = printed?.text ?? "";
  // The Setup shuffles the set this card is printed in and places it under a card (Journey to the Cross-roads' Men of Harad).
  const setUnder = clausesOf(quest, "step").some((clause) => clause.step === "shuffleSetUnder" && facts.inSets(clause.asideSets ?? []));
  const fleet = stepExists("prepareFleet") && /Fleet/.test(printed?.encounterSet ?? "");
  switch (pile) {
    case "setAside":
      return said(["aside", "putIntoPlay"]) || putEngaged || steps("takeControl", "attach", "prepareStormcallerArea", "attachToDifferentHeroes", "attachToThreatDial") || setAsideBySet || loggedHarad(quest, printed) || (fleet && (printed?.type === "ship-objective" || printed?.type === "objective")) || (stepExists("asideEachOtherObjective") && printed?.type === "objective") || steps("hideLoot", "hideSuspectAndHideout", "buildInvestigationDeck");
    case "activeLocation":
      return said(["active"]);
    case "attachedChosen":
      return said(["attachChosen"]) || steps("attachToRingBearerHero");
    case "attached":
      return said(["attachRingBearer"]) || /Setup: Attach to the Ring-bearer/.test(own);
    case "staging": {
      const eachPlayer = clausesOf(quest, "stage").some((clause) => clause.perPlayer != null && clause.codes.includes(code));
      const explorers = clausesOf(quest, "eachPlayerAddsLocation").length > 0 && printed?.type === "location";
      const searched = clausesOf(quest, "searchObjectives").length > 0 && printed?.type === "objective";
      return said(["stage"]) || eachPlayer || explorers || searched || fleet || /Setup: Add .* to the staging area/.test(own);
    }
    case "burden":
      return true;
    case "corsairDeck":
      return stepExists("prepareCorsairDeck");
    case "unchartedDeck":
      return stepExists("prepareUnchartedDeck");
    case "grottoDeck":
      return stepExists("prepareGrottoDeck");
    case "islandMap":
      return stepExists("prepareIslandMap");
    case "stormcallerQuests":
      return stepExists("prepareStormcallerArea");
    case "encounterDeck2":
      return stepExists("secondDeck", "buildDeck", "setSetsAside") && setAsideBySet;
    // Angmar Awakened's Orc deck: built by the Weather Hills' Setup step.
    case "smaugDeck":
      return stepExists("buildSmaugDeck");
    case "angmarOrcDeck":
      return stepExists("buildOrcDeck");
    // Ered Mithrin's decks: built by their Setup step, or (the two Lost in Mirkwood sets) set aside by set name.
    case "evilCreaturesDeck":
      return stepExists("buildEvilCreaturesDeck");
    case "cavesDeck":
      return stepExists("buildCavesDeck");
    case "sideQuestDeck":
      return stepExists("buildSideQuestDeck");
    case "spidersDeck":
    case "orcsDeck":
    case "greatSpiderDeck":
      return setAsideBySet;
    case "haradDeck":
      return setUnder;
    default:
      return true;
  }
}
