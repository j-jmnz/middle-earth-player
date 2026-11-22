// The pieces Shadow and Flame adds (src/catalog/families/flame.ts): the Balrog deck of the Nightmare deck, Dark Pit's discard of Durin's Bane and the event Counter-Spell cancels, and the samples read-fields.test.ts checks them with.
import { str, type Ctx, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const FLAME_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  SetThreat: (i) => ({ text: `the acting player's threat becomes ${str(i.value)}`, read: ["value"] }),
  FormBalrogDeck: (i) => ({ text: `the encounter cards with the trait ${str(i.trait)} leave the encounter deck, facedown, for the Balrog deck, which is shuffled; the Balrog discard pile starts empty`, read: ["trait"] }),
  ShuffleBalrogDiscard: () => ({ text: "the Balrog discard pile is shuffled back into the Balrog deck (nothing with an empty pile)", read: [] }),
  DiscardNamedFromPlay: (i) => ({ text: `the card in play titled "${str(i.name)}" is discarded from play, although it cannot leave the staging area (the discard supersedes that text)`, read: ["name"] }),
  CancelEventEffects: () => ({ text: "the effects of the event just played are canceled (it is still played, its cost paid, and it goes to its owner's discard pile)", read: [] }),
};

export const FLAME_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  SetThreat: [{ verb: "SetThreat", value: 0 }],
  FormBalrogDeck: [{ verb: "FormBalrogDeck", trait: "Attack" }],
  ShuffleBalrogDiscard: [{ verb: "ShuffleBalrogDiscard" }],
  DiscardNamedFromPlay: [{ verb: "DiscardNamedFromPlay", name: "Durin's Bane" }],
  CancelEventEffects: [{ verb: "CancelEventEffects" }],
};
