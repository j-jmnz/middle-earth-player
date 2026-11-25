// Rules: bts.valour (data/rules/entries.json): the `threat` condition marked `valour` holds from 40 threat, from 80 while the main quest has Dire (mec113.dire).
// `holds` is the dispatcher: a family's hook is asked first, then the handler of the condition's kind. The handlers are module-level tables by what they read (condition-kinds/: a new kind goes in the file that reads what it reads, and the type checks that every kind has one). The handlers that read a card's Traits or call `holds` are here, since the Trait readers below call `holds` too.
import type { Condition } from "../../catalog/boundary.ts";
import { headOf, inAreaOf, isolatedAreas } from "../families/breaking/areas.ts";
import { withTwin } from "../families/nightmare/guards.ts";
import { flaggedTrait, lostTrait } from "../families/misc/traits.ts";
import { effectsOf } from "../windows/listen.ts";
import { printedOf, type Sphere } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { flagged, inPlay } from "../core/state.ts";
import { familyCondition } from "./family-hooks.ts";
import { cardHandlers } from "./condition-kinds/cards.ts";
import { combatHandlers } from "./condition-kinds/combat.ts";
import { eventHandlers, shadowBlankOf } from "./condition-kinds/event.ts";
import { familyOnlyHandlers } from "./condition-kinds/family-only.ts";
import { playerHandlers } from "./condition-kinds/players.ts";
import { questHandlers } from "./condition-kinds/quest.ts";
import { scenarioHandlers } from "./condition-kinds/scenario.ts";
import type { ConditionHandlers, ConditionKind, Scope } from "./condition-scope.ts";
import type { ReduceContext } from "./interpret.ts";

export type { Scope };
export { shadowBlankOf };

// The kinds that read a card's Traits or evaluate another condition.
const traitHandlers = {
  hasEngaged: (state, condition, scope, ctx) => {
    const trait = condition.trait;
    return (state.seats[scope.actor]?.engaged ?? []).some((id) => trait == null || hasTrait(state, id, trait, ctx));
  },
  heroesAll: (state, condition, scope, ctx) => {
    const heroes = state.seats[scope.actor]?.heroes ?? [];
    return heroes.length > 0 && heroes.every((id) => hasTrait(state, id, condition.trait, ctx));
  },
  enemyInPlay: (state, condition, scope, ctx) => {
    const trait = condition.trait;
    // Isolated areas (isolatedAreas): an enemy "in play" is one in the asking player's own area (mec108.create-staging-area).
    const area = isolatedAreas(state) ? headOf(state, scope.actor) : null;
    const found = Object.values(state.cards).some(
      (card) =>
        inPlay(card.zone) && card.asAttachment == null && printedOf(ctx.cards, card.code).type === "enemy" && (condition.other !== true || card.id !== scope.sourceId) && (trait == null || hasTrait(state, card.id, trait, ctx)) && (area == null || inAreaOf(state, card, area)),
    );
    return found === condition.is;
  },
  campaignCopyOutside: (state, condition, scope, ctx) =>
    holds(state, { kind: "campaign" }, scope, ctx) && !Object.values(state.cards).some((card) => card.code === condition.code && (inPlay(card.zone) || card.zone === "removed")),
  not: (state, condition, scope, ctx) => !holds(state, condition.condition, scope, ctx),
  all: (state, condition, scope, ctx) => condition.conditions.every((inner) => holds(state, inner, scope, ctx)),
  any: (state, condition, scope, ctx) => condition.conditions.some((inner) => holds(state, inner, scope, ctx)),
} satisfies Partial<ConditionHandlers>;

// Every condition kind has exactly one handler (a missing or a repeated kind fails the type check).
const HANDLERS: ConditionHandlers = {
  ...familyOnlyHandlers,
  ...cardHandlers,
  ...combatHandlers,
  ...eventHandlers,
  ...playerHandlers,
  ...questHandlers,
  ...scenarioHandlers,
  ...traitHandlers,
};

export function holds(state: ScenarioState, named: Condition, scope: Scope, ctx: ReduceContext): boolean {
  // A card named by code is the Nightmare card of its title when the recipe replaced it (families/nightmare/guards.ts).
  const condition = withTwin(state, named, ctx.cards);
  // A family's own condition kind (interpret/family-hooks.ts): asked first, null when it is not the family's, so the table below stands.
  const familial = familyCondition(state, condition, scope, ctx);
  if (familial !== null) return familial;
  // The handler of this kind takes this kind's condition: the table is keyed by `kind`, which the type system cannot correlate with the union.
  const handler = HANDLERS[condition.kind as ConditionKind] as (state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext) => boolean;
  return handler(state, condition, scope, ctx);
}

export function hasTrait(state: ScenarioState, id: string, trait: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (instance != null && lostTrait(state, id, trait)) return false;
  return (
    instance != null &&
    ((printedOf(ctx.cards, instance.code).traits.includes(trait) && !flagged(state, id, "blanksTraits")) || grantedTraits(state, id, ctx).includes(trait) || flaggedTrait(state, id, trait) || countedTraits(state, id, ctx).includes(trait))
  );
}

// An encounter card its own text attached to a card "counts as" an attachment, with a trait or none, while it is attached ("Counts as a
// Condition attachment", 141043:A:2, 141055:A:2; "Counts as an attachment", 50208:A:2; rr.attachment-cards): its CountsAs records.
function countsAsRecords(state: ScenarioState, id: string, ctx: ReduceContext): { trait?: string }[] {
  const instance = state.cards[id];
  if (!instance || instance.zone !== "attached" || instance.host == null) return [];
  return ctx.effects.flatMap((effect) =>
    effect.cardCode === instance.code && effect.timing === "constant" ? effect.instructions.flatMap((instruction) => (instruction.verb === "CountsAs" ? [instruction] : [])) : [],
  );
}

// The traits those records give it.
export function countedTraits(state: ScenarioState, id: string, ctx: ReduceContext): string[] {
  return countsAsRecords(state, id, ctx).flatMap((record) => (record.trait ? [record.trait] : []));
}

export function countsAsAttachment(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  return countsAsRecords(state, id, ctx).length > 0;
}

// What the constant records of a card's attachments give it: the Gondor trait from Steward of Gondor, a resource icon
// from Celebrían's Stone. Read where the trait or the icon is asked about.
function grants(state: ScenarioState, id: string, ctx: ReduceContext): { trait?: string; sphere?: Sphere }[] {
  const instance = state.cards[id];
  if (!instance || instance.attachments.length === 0) return [];
  const found: { trait?: string; sphere?: Sphere }[] = [];
  for (const attachmentId of instance.attachments) {
    const attachment = state.cards[attachmentId];
    if (!attachment) continue;
    // A hero card attached to Thorongil lends its host its resource icon (families/misc/text.ts).
    const lent = attachment.lends ? state.cards[attachment.lends] : undefined;
    const lentSphere = lent ? printedOf(ctx.cards, lent.code).sphere : null;
    if (lentSphere && lentSphere !== "neutral" && lentSphere !== "fellowship" && lentSphere !== "baggins") found.push({ sphere: lentSphere });
    for (const effect of effectsOf(ctx, attachment.code)) {
      if (effect.timing !== "constant") continue;
      // Only a record that grants a trait or an icon is read here: another record's condition may itself ask for a trait (Esquire of Gondor, 145015:A:4), which would read this one again.
      if (!effect.instructions.some((instruction) => instruction.verb === "GrantTrait" || instruction.verb === "GrantIcon")) continue;
      const scope = { actor: attachment.controller ?? state.firstPlayer, sourceId: attachment.id, returned: 0 };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      for (const instruction of effect.instructions) {
        if (instruction.verb !== "GrantTrait" && instruction.verb !== "GrantIcon") continue;
        if (instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
        found.push(instruction.verb === "GrantTrait" ? { trait: instruction.trait } : { sphere: instruction.sphere });
      }
    }
  }
  return found;
}

export function grantedTraits(state: ScenarioState, id: string, ctx: ReduceContext): string[] {
  return grants(state, id, ctx).flatMap((grant) => (grant.trait ? [grant.trait] : []));
}

export function grantedIcons(state: ScenarioState, id: string, ctx: ReduceContext): Sphere[] {
  return grants(state, id, ctx).flatMap((grant) => (grant.sphere ? [grant.sphere] : []));
}
