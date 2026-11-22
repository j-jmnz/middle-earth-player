// The family files this renderer reads, gathered: one table of verb templates and their samples, and one of condition templates and theirs.
import { BURDEN_SAMPLES, BURDEN_TEMPLATES } from "./families/burden.ts";
import { CAPTURED_CONDITIONS, CAPTURED_CONDITION_SAMPLES, CAPTURED_SAMPLES, CAPTURED_TEMPLATES } from "./families/captured.ts";
import { CORE_SAMPLES, CORE_TEMPLATES } from "./families/core-verbs.ts";
import { FAMILY_CONDITION_TEMPLATES, FAMILY_CONDITION_TEMPLATE_SAMPLES } from "./families/family-conditions.ts";
import { GRAPPLE_SAMPLES, GRAPPLE_TEMPLATES } from "./families/grapple.ts";
import { NIGHTMARE_SAMPLES, NIGHTMARE_TEMPLATES } from "./families/nightmare.ts";
import { QUEST_VERB_SAMPLES, QUEST_VERB_TEMPLATES } from "./families/quest-verbs.ts";
import { SEA_SAMPLES, SEA_TEMPLATES } from "./families/sea.ts";
import { SOUTH_SAMPLES, SOUTH_TEMPLATES } from "./families/south.ts";
import { STORMCALLER_SAMPLES, STORMCALLER_TEMPLATES } from "./families/stormcaller.ts";
import { UNCHARTED_SAMPLES, UNCHARTED_TEMPLATES } from "./families/uncharted.ts";
import { WILDERLAND_SAMPLES, WILDERLAND_TEMPLATES } from "./families/wilderland.ts";

export const FAMILY_TEMPLATES = { ...BURDEN_TEMPLATES, ...CAPTURED_TEMPLATES, ...CORE_TEMPLATES, ...GRAPPLE_TEMPLATES, ...NIGHTMARE_TEMPLATES, ...QUEST_VERB_TEMPLATES, ...SEA_TEMPLATES, ...SOUTH_TEMPLATES, ...STORMCALLER_TEMPLATES, ...UNCHARTED_TEMPLATES, ...WILDERLAND_TEMPLATES };
export const FAMILY_SAMPLES = { ...BURDEN_SAMPLES, ...CAPTURED_SAMPLES, ...CORE_SAMPLES, ...GRAPPLE_SAMPLES, ...NIGHTMARE_SAMPLES, ...QUEST_VERB_SAMPLES, ...SEA_SAMPLES, ...SOUTH_SAMPLES, ...STORMCALLER_SAMPLES, ...UNCHARTED_SAMPLES, ...WILDERLAND_SAMPLES };
export const FAMILY_CONDITIONS = { ...CAPTURED_CONDITIONS, ...FAMILY_CONDITION_TEMPLATES };
export const FAMILY_CONDITION_SAMPLES = { ...CAPTURED_CONDITION_SAMPLES, ...FAMILY_CONDITION_TEMPLATE_SAMPLES };
