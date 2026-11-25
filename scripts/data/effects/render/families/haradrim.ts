// The pieces Escape from Umbar adds (src/catalog/families/haradrim.ts): the card placed faceup under a location and the main quest card that has been in play the whole round, with the samples read-fields.test.ts checks them with.
import type { ConditionTemplates, Samples } from "../family-kit.ts";
import type { Ctx, Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const HARADRIM_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  PlaceUnderSelfFaceup: () => ({ text: "the last picked card is placed faceup under this location; while it is there it is out of play", read: [] }),
};

export const HARADRIM_SAMPLES: Samples = {
  PlaceUnderSelfFaceup: [{ verb: "PlaceUnderSelfFaceup" }],
};

export const HARADRIM_CONDITIONS: ConditionTemplates = {
  stageInPlayWholeRound: () => ({ text: "the current main quest card was in play before this round began (from Setup or an earlier round), not revealed during it", read: [] }),
};

export const HARADRIM_CONDITION_SAMPLES: Samples = {
  stageInPlayWholeRound: [{ kind: "stageInPlayWholeRound" }],
};
