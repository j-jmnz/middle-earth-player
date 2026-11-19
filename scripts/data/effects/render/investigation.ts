// The pieces Murder at the Prancing Pony adds (the investigation family): the Investigation deck's Setup, the looks at it, the removal and the shuffle, the accusation, and the flag a location holds: templates, flag words and the samples read-fields.test.ts checks them with.
import { joinAnd, str, type Ctx, type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

const codes = (value: unknown): string => joinAnd((Array.isArray(value) ? value : []).map(str));

export const INVESTIGATION_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  HideSuspectAndHideout: (i) => ({
    text: `of the set-aside cards with codes ${codes(i.suspects)} one, and of those with codes ${codes(i.hideouts)} one, chosen with the game's seed, stay set aside out of play facedown; the others go into the Investigation deck facedown (no step names any of them)`,
    read: ["suspects", "hideouts"],
  }),
  BuildInvestigationDeck: (i) => ({ text: `the set-aside cards with codes ${codes(i.codes)} join the Investigation deck facedown, and the deck is shuffled with the game's seed`, read: ["codes"] }),
  Investigate: (i) => ({
    text: `the first player shuffles the Investigation deck and looks at the top ${str(i.amount)} card(s) (more with the flag investigateLooked; fewer if the deck holds fewer); they stay on top in the same order; nothing happens while a card in play ignores the Investigate keyword`,
    read: ["amount"],
  }),
  LookAtInvestigation: (i) => ({
    text: `the acting player looks at the ${str(i.from)} ${i.count === undefined ? "card" : `${str(i.count)} card(s)`} of the Investigation deck (nothing is shuffled or moved); a card looked at that hears the look (Taken by Surprise) resolves once this effect is done`,
    read: ["from", "count"],
  }),
  RemoveRandomInvestigation: () => ({ text: "a random card of the Investigation deck, chosen with the game's seed, is removed from the game without being looked at (no step names it)", read: [] }),
  ShuffleSelfIntoInvestigation: () => ({ text: "this card is shuffled into the Investigation deck, facedown", read: [] }),
  NameInvestigation: (i) => ({ text: `the acting player names one ${str(i.kind)} (a Suspect or a Hideout), by title, of the cards with codes ${codes(i.codes)} (a card in play too)`, read: ["kind", "codes"] }),
  MakeAccusation: (i) => ({
    text: `the facedown out-of-play Suspect and Hideout (the set-aside cards among ${codes(i.suspects)} and ${codes(i.hideouts)}) are turned faceup and added to the staging area; for each name that is not one of them, the Investigation deck is searched for that card and it is added to the staging area unless it is in play; X is 1 if either name was wrong, else 0`,
    read: ["suspects", "hideouts"],
  }),
  AddLookedToStaging: (i) => ({ text: `the top card of the Investigation deck (the card the keyword just showed) is added to the staging area faceup if it has the Trait ${joinAnd((Array.isArray(i.traits) ? i.traits : []).map(str))}`, read: ["traits"] }),
};

// The plain words a stat flag of the scenario adds after its name.
export const INVESTIGATION_STAT_NOTES: Readonly<Record<string, string>> = {
  investigateLooked: " (the Investigate keyword of this location looks at this many cards more than its value, while it resolves)",
};

export const INVESTIGATION_CONDITIONS: Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>> = {
  investigateIgnored: () => ({ text: "a card in play says to ignore the Investigate keyword", read: [] }),
  investigationTop: (c) => ({ text: `the top card of the Investigation deck (the card the keyword just showed) has the Trait ${joinAnd((Array.isArray(c.traits) ? c.traits : []).map(str))}`, read: ["traits"] }),
};

export const INVESTIGATION_CONDITION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  investigateIgnored: [{ kind: "investigateIgnored" }],
  investigationTop: [{ kind: "investigationTop", traits: ["Suspect", "Hideout"] }],
};

export const INVESTIGATION_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  HideSuspectAndHideout: [{ verb: "HideSuspectAndHideout", suspects: ["50709", "50710"], hideouts: ["50704", "50705"] }],
  BuildInvestigationDeck: [{ verb: "BuildInvestigationDeck", codes: ["50714"] }],
  Investigate: [{ verb: "Investigate", amount: 2 }],
  LookAtInvestigation: [{ verb: "LookAtInvestigation", from: "top", count: 2 }, { verb: "LookAtInvestigation", from: "bottom" }],
  RemoveRandomInvestigation: [{ verb: "RemoveRandomInvestigation" }],
  ShuffleSelfIntoInvestigation: [{ verb: "ShuffleSelfIntoInvestigation" }],
  NameInvestigation: [{ verb: "NameInvestigation", kind: "suspect", codes: ["50709", "50710"] }, { verb: "NameInvestigation", kind: "hideout", codes: ["50704", "50705"] }],
  MakeAccusation: [{ verb: "MakeAccusation", suspects: ["50709", "50710"], hideouts: ["50704", "50705"] }],
  AddLookedToStaging: [{ verb: "AddLookedToStaging", traits: ["Suspect", "Hideout"] }],
};
