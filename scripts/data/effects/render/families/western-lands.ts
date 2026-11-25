// The western-lands family's pieces (src/catalog/families/western-lands.ts, the Western Lands encounter set): the template of its verb and the sample read-fields.test.ts checks it with.
import { str, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const WESTERN_LANDS_TEMPLATES: Readonly<Record<string, (i: Obj) => Made>> = {
  ShuffleShadowIntoEncounterDeck: (i) => ({ text: `the shadow card with code ${str(i.code)} that the attacking enemy holds (else the topmost copy in the encounter discard pile, once an attack outside combat has discarded it) is shuffled into the encounter deck`, read: ["code"] }),
};

export const WESTERN_LANDS_SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  ShuffleShadowIntoEncounterDeck: [{ verb: "ShuffleShadowIntoEncounterDeck", code: "131035" }],
};
