// The pieces The Siege of Annúminas adds (the wilderland family's DiscardHeldHero and ReturnHeldHeroes): templates and the samples read-fields-samples.ts checks them with.
import { type Obj } from "./kit.ts";

type Made = { text: string; read: readonly string[] };

export const SIEGE_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  DiscardHeldHero: (i) => ({
    text: `while the current quest stage is stage ${String(i.stage)}, discard 1 random hero lying facedown under it, chosen with the game's seed, to its owner's discard pile (a player left with no hero is eliminated)`,
    read: ["stage"],
  }),
  ReturnHeldHeroes: (i) => ({
    text: `while the current quest stage is stage ${String(i.stage)}, return each hero lying facedown under it to its owner's control, exhausted`,
    read: ["stage"],
  }),
};

export const SIEGE_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  DiscardHeldHero: [{ verb: "DiscardHeldHero", stage: 3 }],
  ReturnHeldHeroes: [{ verb: "ReturnHeldHeroes", stage: 3 }],
};
