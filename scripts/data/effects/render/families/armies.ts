// The pieces The Battle of Five Armies adds (src/catalog/families/armies.ts): the stages in play together, the stage conditions, the Goblin that surges and the defender with the most damage, and the samples read-fields.test.ts checks them with.
import { amt, type ConditionTemplates, type Samples } from "../family-kit.ts";
import { str, type Ctx, type Obj } from "../kit.ts";

type Made = { text: string; read: readonly string[] };

export const ARMIES_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>> = {
  PutStagesIntoPlay: (i) => ({ text: `the quest stages with the codes ${(Array.isArray(i.codes) ? i.codes : []).map(str).join(", ")} leave the quest deck and lie in play together with side B up, no progress on them (the first is the current quest stage until the first player chooses); the stage this is on leaves play`, read: ["codes"] }),
  SetCurrentStage: (i) => ({ text: `the quest stage with the card id ${str(i.card)} is the current quest stage (nothing for a card that is not a stage in play together)`, read: ["card"] }),
  RemoveProgressFromStages: (i, ctx) => ({ text: `${typeof i.code === "string" ? `the quest stage ${i.code} in play loses` : "each quest stage in play loses"} up to ${amt(i.amount, ctx)} progress`, read: ["amount", "code"] }),
  FirstRevealedSurges: (i) => ({ text: `while this card is in play, the first ${str(i.trait)} ${str(i.type)} revealed each round (the Setup's reveals count for round 1) gains Surge as it is revealed`, read: ["trait", "type"] }),
  StageTopmostFromDiscard: (i) => ({ text: `the last ${str(i.type)} of the encounter discard pile is added to the staging area (put there, not revealed; nothing with none)`, read: ["type"] }),
  MustDefendMostDamaged: () => ({ text: "the attack in progress must be defended by the character the defending player controls with the most damage (one of those tied), exhausted or not, and cannot be left undefended while a character can defend", read: [] }),
};

export const ARMIES_SAMPLES: Samples = {
  PutStagesIntoPlay: [{ verb: "PutStagesIntoPlay", codes: ["132076", "132077", "132078"] }],
  SetCurrentStage: [{ verb: "SetCurrentStage", card: "i1" }],
  RemoveProgressFromStages: [{ verb: "RemoveProgressFromStages", amount: 2, code: "132077" }, { verb: "RemoveProgressFromStages", amount: 1 }],
  FirstRevealedSurges: [{ verb: "FirstRevealedSurges", trait: "Goblin", type: "enemy" }],
  StageTopmostFromDiscard: [{ verb: "StageTopmostFromDiscard", type: "enemy" }],
  MustDefendMostDamaged: [{ verb: "MustDefendMostDamaged" }],
};

export const ARMIES_CONDITIONS: ConditionTemplates = {
  stagesComplete: (c) => ({ text: `${c.is === false ? "not every" : "every"} quest stage in play with the code ${(Array.isArray(c.codes) ? c.codes : []).map(str).join(" and ")} holds at least its quest points in progress`, read: ["codes", "is"] }),
  stageIsCurrent: (c) => ({ text: `the quest stage ${str(c.code)} is the current quest stage`, read: ["code"] }),
  stageNoProgress: (c) => ({ text: `the quest stage ${str(c.code)} is in play with no progress on it`, read: ["code"] }),
};

export const ARMIES_CONDITION_SAMPLES: Samples = {
  stagesComplete: [{ kind: "stagesComplete", codes: ["132077", "132078"] }, { kind: "stagesComplete", codes: ["132077"], is: false }],
  stageIsCurrent: [{ kind: "stageIsCurrent", code: "132077" }],
  stageNoProgress: [{ kind: "stageNoProgress", code: "132076" }],
};
