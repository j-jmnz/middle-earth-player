// The pieces The Ruins of Belegost adds (the wilderland family's HideRandomLoot, the quest family's AdvanceIfAttached and the two Discover amounts the locations hold): templates, flag words and the samples read-fields.test.ts checks them with.
import { joinAnd, str, type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

export const RUINS_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  HideRandomLoot: (i) => ({
    text: `of the set-aside cards with codes ${joinAnd((Array.isArray(i.codes) ? i.codes : []).map(str))} one, chosen with the game's seed, is placed facedown under the card in play with code ${str(i.under)} (out of play); the others go facedown into the encounter deck, unseen (the next shuffle mixes them in)`,
    read: ["codes", "under"],
  }),
  AdvanceIfAttached: (i) => ({
    text: `when this stage is defeated, the quest advances to the quest card with code ${str(i.then)} if the card with code ${str(i.code)} is attached to a hero, otherwise to the quest card with code ${str(i.otherwise)} (a stage played before comes back from the set-aside pile with no progress; this stage has no next stage in order)`,
    read: ["code", "then", "otherwise"],
  }),
};

// The plain words a stat flag of the scenario adds after its name.
export const RUINS_STAT_NOTES: Readonly<Record<string, string>> = {
  discoverLooked: " (the Discover keyword of this location looks at this many cards more than its value, while it resolves)",
  discoverHazards: " (the Discover keyword of this location reveals this many more of the looked-at Hazard cards, one at a time, at random)",
};

export const RUINS_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  HideRandomLoot: [{ verb: "HideRandomLoot", codes: ["50610", "50611"], under: "50608" }],
  AdvanceIfAttached: [{ verb: "AdvanceIfAttached", code: "50611", then: "50603", otherwise: "50602" }],
};
