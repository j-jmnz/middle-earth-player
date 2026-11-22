// The pieces Attack on Dol Guldur adds (the wilderland family's TallySiege and SelectRandomStage): templates and the samples read-fields-samples.ts checks them with.
import { type Obj, str } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const GULDUR_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  TallySiege: () => ({ text: "add the Siege value printed on the card the event is about (a destroyed enemy, an explored location; 0 when it prints none) to this round's Siege tally", read: [] }),
  TakeControlOfStaged: (i) => ({ text: `the card in the staging area with code ${str(i.code)} enters the first player's play area under his control, faceup and ready`, read: ["code"] }),
  DiscardCopiesOfDiscarded: () => ({ text: "discard each card in play, whoever controls it, with the title of the card this effect last discarded from a deck", read: [] }),
  SelectRandomStage: (i) => ({ text: `choose at random, with the game's seed, one of the stages ${Array.isArray(i.codes) ? i.codes.map(str).join(", ") : ""} but the current one, and note it as the option taken`, read: ["codes"] }),
};

export const GULDUR_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  TallySiege: [{ verb: "TallySiege" }],
  TakeControlOfStaged: [{ verb: "TakeControlOfStaged", code: "50908" }],
  DiscardCopiesOfDiscarded: [{ verb: "DiscardCopiesOfDiscarded" }],
  SelectRandomStage: [{ verb: "SelectRandomStage", codes: ["50903", "50904"] }],
};
