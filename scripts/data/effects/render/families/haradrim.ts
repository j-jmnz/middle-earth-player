// The pieces the haradrim family adds (src/catalog/families/haradrim.ts): the card placed faceup under a location, the main quest card that has been in play the whole round and the heat tracker's verbs and condition (the amount is in family-amounts.ts), with the samples read-fields.test.ts checks them with.
import { amt, type ConditionTemplates, type Samples } from "../family-kit.ts";
import type { Ctx, Obj } from "../kit.ts";
import { str } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const HARADRIM_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  PlaceUnderSelfFaceup: () => ({ text: "the last picked card is placed faceup under this location; while it is there it is out of play", read: [] }),
  SetTemperature: (i) => ({ text: `place the heat tracker next to the quest deck and set the temperature to ${str(i.value)} (no "temperature changed" event)`, read: ["value"] }),
  RaiseTemperature: (i, ctx) => ({ text: `increase the temperature by ${amt(i.amount, ctx)} (nothing before the tracker is set; a change queues the "temperature changed" event the stages' loss answers)`, read: ["amount"] }),
  LowerTemperature: (i, ctx) => ({ text: `reduce the temperature by ${amt(i.amount, ctx)}, never below 0 (nothing before the tracker is set; a change queues the "temperature changed" event)`, read: ["amount"] }),
};

const range = (min: unknown, max: unknown): string => [typeof min === "number" ? `at least ${min}` : "", typeof max === "number" ? `at most ${max}` : ""].filter((part) => part !== "").join(" and ");

export const HARADRIM_SAMPLES: Samples = {
  PlaceUnderSelfFaceup: [{ verb: "PlaceUnderSelfFaceup" }],
  SetTemperature: [{ verb: "SetTemperature", value: 10 }],
  RaiseTemperature: [{ verb: "RaiseTemperature", amount: 4 }],
  LowerTemperature: [{ verb: "LowerTemperature", amount: 10 }],
};

export const HARADRIM_CONDITIONS: ConditionTemplates = {
  temperature: (c) => ({ text: `the temperature is ${range(c.min, c.max)} (false while no heat tracker is set)`, read: ["min", "max"] }),
  stageInPlayWholeRound: () => ({ text: "the current main quest card was in play before this round began (from Setup or an earlier round), not revealed during it", read: [] }),
};

export const HARADRIM_CONDITION_SAMPLES: Samples = {
  stageInPlayWholeRound: [{ kind: "stageInPlayWholeRound" }],
  temperature: [{ kind: "temperature", min: 40 }, { kind: "temperature", max: 39 }],
};
