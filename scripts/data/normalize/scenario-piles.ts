import type { Card } from "../../../src/catalog/card-facts.ts";
import { clausesOf, codesOf, type ParsedSetup, type SetupClause, type SetupStep } from "./setup-text.ts";

// What the quest card's printed Setup says about one card of a scenario's load list. `same` is true for a code and itself, and for the two
// sides of one two-sided card (the Stormcaller Elite's enemy and objective-ally rows), so a Setup that names a card by title is satisfied by
// the physical card it is loaded as and by no other card of that title.
export type QuestFacts = {
  said: (kinds: readonly SetupClause["kind"][]) => boolean;
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
    steps: (...wanted) => stepClauses.some((clause) => wanted.includes(clause.step) && clause.codes.some((named) => same(named, code))),
    stepExists: (...wanted) => stepClauses.some((clause) => wanted.includes(clause.step)),
    inSets,
    setAsideBySet: stepClauses.some((clause) => inSets(clause.asideSets ?? [])),
  };
}

// A pile a card sits in must be one a Setup line of the quest card puts it in (the campaign card's lines are checked by the caller). The
// Dream-chaser decks are dealt by their "Prepare the ... deck" step, the fleet by "Players prepare their fleet", the second encounter deck
// by the encounter set the Setup sets aside.
export function pileAccepts(args: { code: string; pile: string; printed: Card | undefined; quest: ParsedSetup; facts: QuestFacts }): boolean {
  const { code, pile, printed, quest, facts } = args;
  const { said, steps, stepExists, setAsideBySet } = facts;
  const own = printed?.text ?? "";
  const fleet = stepExists("prepareFleet") && /Fleet/.test(printed?.encounterSet ?? "");
  switch (pile) {
    case "setAside":
      return said(["aside"]) || steps("takeControl", "attach", "prepareStormcallerArea") || setAsideBySet || (fleet && (printed?.type === "ship-objective" || printed?.type === "objective"));
    case "activeLocation":
      return said(["active"]);
    case "attachedChosen":
      return said(["attachChosen"]);
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
      return stepExists("secondDeck", "buildDeck") && setAsideBySet;
    default:
      return true;
  }
}
