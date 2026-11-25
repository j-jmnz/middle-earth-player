// The pieces The Ring-maker adds (src/catalog/families/ring-maker.ts): time counters taken off the current quest, a treachery that goes into a hand and stays, the enemy a discard puts into play engaged, and the samples read-fields.test.ts checks them with.
import { amt, type Samples, type Templates } from "../family-kit.ts";
import { str } from "../kit.ts";

export const RING_MAKER_TEMPLATES: Templates = {
  RemoveTimeFromQuest: (i, ctx) => ({ text: `up to ${amt(i.amount, ctx)} time counter(s) come off the current quest stage, one at a time; when the last one goes the stage's Forced effect for it resolves (a stage with none loses none)`, read: ["amount"] }),
  DrawSelfIntoHand: () => ({ text: "this card goes into the acting player's hand, which is no draw from a deck (no card hears a draw), and cannot leave that hand; the reveal does not discard it", read: [] }),
  EngageTopDiscarded: (i) => ({ text: `of the cards this effect discarded from the encounter deck, the ${str(i.trait)} enemy discarded last is put into play engaged with the acting player (as if it had engaged him; nothing when none was discarded)`, read: ["trait"] }),
};

export const RING_MAKER_SAMPLES: Samples = {
  RemoveTimeFromQuest: [{ verb: "RemoveTimeFromQuest", amount: 1 }],
  DrawSelfIntoHand: [{ verb: "DrawSelfIntoHand" }],
  EngageTopDiscarded: [{ verb: "EngageTopDiscarded", trait: "Dunland" }],
};
