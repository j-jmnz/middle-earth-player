import { PLAYER_TEMPLATES } from "./player-templates.ts";
import { SCENARIO_TEMPLATES } from "./scenario-templates.ts";
import type { Template } from "./template-kit.ts";

export type { Draft, Template, TemplateContext } from "./template-kit.ts";

// Scenario and encounter lines first, then player cards; the first template that matches a whole line wins.
export const TEMPLATES: readonly Template[] = [...SCENARIO_TEMPLATES, ...PLAYER_TEMPLATES];
