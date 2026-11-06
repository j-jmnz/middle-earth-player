// How the core calls the hooks of the mechanic families (docs/architecture.md, Mechanic families): each function walks a family list, RULES_FAMILIES by
// default (registered by families/index.ts; withFamilies swaps it for a test). A hook returns a new state or the same object, never a changed one.
import type { Amount, Condition, Instruction, PickSpec } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import type { PrintedCard } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import type { AmountScope } from "./amounts.ts";
import type { Scope } from "./conditions.ts";
import type { RulesFamily, SettleHook, SettleHooks, TravelCharge } from "./family-manifest.ts";
import type { ReduceContext } from "./interpret.ts";
import type { PickContext } from "./pick.ts";

export type SettlePhase = keyof SettleHooks;

// The family list the core's calls walk: RULES_FAMILIES, or the one withFamilies sets for a test.
let scoped: readonly RulesFamily[] | null = null;
let registry: { readonly families: readonly RulesFamily[]; readonly order: Order } | null = null;
const active = (): readonly RulesFamily[] => scoped ?? loaded().families;
const loaded = () => {
  if (!registry) throw new Error("the mechanic families are not loaded: src/rules/families/index.ts registers them");
  return registry;
};

/**
 * Called once by src/rules/families/index.ts with its lists. The core's hook calls cannot import that file: it imports every family, and the core is
 * imported by them, so a module that reached the core first would read the lists before they exist.
 */
export function registerFamilies(families: readonly RulesFamily[], order: Order): void {
  registry = { families, order };
}
const NONE: readonly string[] = [];

/** Runs `fn` with the core's hook calls walking `families` instead of RULES_FAMILIES, then restores the list (for tests of the core's call sites). */
export function withFamilies<T>(families: readonly RulesFamily[], fn: () => T): T {
  const before = scoped;
  scoped = families;
  try {
    return fn();
  } finally {
    scoped = before;
  }
}

type Order = Readonly<Record<SettlePhase, readonly string[]>>;

// The families that have each kind of hook, once per list: the lists are constants, so the walk is not repeated on every call.
type Hooked = {
  readonly may: readonly RulesFamily[];
  readonly reach: readonly RulesFamily[];
  readonly cost: readonly RulesFamily[];
  readonly forced: readonly RulesFamily[];
  readonly unpayable: readonly RulesFamily[];
  readonly play: readonly RulesFamily[];
  readonly pick: readonly RulesFamily[];
  readonly condition: readonly RulesFamily[];
  readonly amount: readonly RulesFamily[];
  readonly attached: readonly RulesFamily[];
  readonly combat: readonly RulesFamily[];
  readonly optionalEngage: readonly RulesFamily[];
};
const hookedBy = new WeakMap<readonly RulesFamily[], Hooked>();

function hooked(families: readonly RulesFamily[]): Hooked {
  let found = hookedBy.get(families);
  if (!found) {
    found = {
      may: families.filter((family) => family.travel?.may != null),
      reach: families.filter((family) => family.travel?.reach != null),
      cost: families.filter((family) => family.travel?.cost != null),
      forced: families.filter((family) => family.travel?.forced != null),
      unpayable: families.filter((family) => family.travel?.unpayable != null),
      play: families.filter((family) => family.play != null),
      pick: families.filter((family) => family.pick != null),
      condition: families.filter((family) => family.condition != null),
      amount: families.filter((family) => family.amount != null),
      attached: families.filter((family) => family.attached != null),
      combat: families.filter((family) => family.combat != null),
      optionalEngage: families.filter((family) => family.optionalEngage != null),
    };
    hookedBy.set(families, found);
  }
  return found;
}

// The ordered settle hooks, once per family list, order and phase.
const settleCache = new WeakMap<readonly RulesFamily[], WeakMap<Order, Partial<Record<SettlePhase, readonly SettleHook[]>>>>();

/**
 * The settle hooks of the families for the phase, in the order SETTLE_ORDER names them. Every family with a hook for the phase is listed there: explicit
 * order is what keeps play deterministic, so an unlisted one throws at its first use.
 */
export function settleHooks(phase: SettlePhase, families: readonly RulesFamily[] = active(), order: Order = loaded().order): readonly SettleHook[] {
  let byOrder = settleCache.get(families);
  if (!byOrder) {
    byOrder = new WeakMap();
    settleCache.set(families, byOrder);
  }
  let byPhase = byOrder.get(order);
  if (!byPhase) {
    byPhase = {};
    byOrder.set(order, byPhase);
  }
  const cached = byPhase[phase];
  if (cached) return cached;
  const mine = families.filter((family) => family.settle?.[phase] != null);
  for (const family of mine) if (!order[phase].includes(family.name)) throw new Error(`family ${family.name} has a settle.${phase} hook but SETTLE_ORDER.${phase} does not list it`);
  const ordered = order[phase].flatMap((name) => mine.filter((family) => family.name === name)).flatMap((family) => (family.settle?.[phase] ? [family.settle[phase]] : []));
  byPhase[phase] = ordered;
  return ordered;
}

/** Runs the settle hooks of one phase in order, each on the state the one before returned. */
export function runSettle(phase: SettlePhase, state: ScenarioState, ctx: ReduceContext, steps: EngineStep[], families: readonly RulesFamily[] = active(), order: Order = loaded().order): ScenarioState {
  let current = state;
  for (const hook of settleHooks(phase, families, order)) current = hook(current, ctx, steps);
  return current;
}

/** Whether some family lets the players travel from where they are. */
export function familyMayTravel(state: ScenarioState, ctx: ReduceContext, families: readonly RulesFamily[] = active()): boolean {
  for (const family of hooked(families).may) if (family.travel?.may?.(state, ctx) === true) return true;
  return false;
}

/** The locations beyond staging that the families let the players travel to; the same empty list when none adds one. */
export function familyTravelReach(state: ScenarioState, ctx: ReduceContext, families: readonly RulesFamily[] = active()): readonly string[] {
  let found: readonly string[] = NONE;
  for (const family of hooked(families).reach) {
    const more = family.travel?.reach?.(state, ctx);
    if (more && more.length > 0) found = found.length === 0 ? more : [...found, ...more];
  }
  return found;
}

/** The charge a family puts on traveling to the location (`locationId` null: on declining to travel), or null when none does (the first family's charge). */
export function familyTravelCost(state: ScenarioState, ctx: ReduceContext, locationId: string | null, families: readonly RulesFamily[] = active()): TravelCharge | null {
  for (const family of hooked(families).cost) {
    const charge = family.travel?.cost?.(state, ctx, locationId);
    if (charge) return charge;
  }
  return null;
}

/** The staged locations the families say the players must travel to; the same empty list when none does. */
export function familyForcedTravel(state: ScenarioState, ctx: ReduceContext, families: readonly RulesFamily[] = active()): readonly string[] {
  let found: readonly string[] = NONE;
  for (const family of hooked(families).forced) {
    const more = family.travel?.forced?.(state, ctx);
    if (more && more.length > 0) found = found.length === 0 ? more : [...found, ...more];
  }
  return found;
}

/** Whether some family says the players cannot pay this instruction of a Travel line now. */
export function familyTravelUnpayable(state: ScenarioState, instruction: Instruction, families: readonly RulesFamily[] = active()): boolean {
  for (const family of hooked(families).unpayable) if (family.travel?.unpayable?.(state, instruction) === true) return true;
  return false;
}

/** Whether some family bars the card from being played or put into play. */
export function familyPlayBarred(state: ScenarioState, cardId: string, ctx: ReduceContext, families: readonly RulesFamily[] = active()): boolean {
  for (const family of hooked(families).play) if (family.play?.(state, cardId, ctx) === true) return true;
  return false;
}

/** Whether some family bars the seat from optionally engaging the enemy in the staging area. */
export function familyOptionalEngageBarred(state: ScenarioState, enemyId: string, seat: number, cards: ReadonlyMap<string, PrintedCard>, families: readonly RulesFamily[] = active()): boolean {
  for (const family of hooked(families).optionalEngage) if (family.optionalEngage?.(state, enemyId, seat, cards) === true) return true;
  return false;
}

/** False when a family's pick predicate rejects the card. */
export function familyPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext, families: readonly RulesFamily[] = active()): boolean {
  for (const family of hooked(families).pick) if (family.pick?.(state, id, spec, at, ctx) === false) return false;
  return true;
}

/** The first family's answer to a condition, or null when none owns it. */
export function familyCondition(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext, families: readonly RulesFamily[] = active()): boolean | null {
  for (const family of hooked(families).condition) {
    const answer = family.condition?.(state, condition, scope, ctx);
    if (answer != null) return answer;
  }
  return null;
}

/** The first family's value for an amount, or null when none owns it. */
export function familyAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext, families: readonly RulesFamily[] = active()): number | null {
  for (const family of hooked(families).amount) {
    const value = family.amount?.(state, amount, scope, ctx);
    if (value != null) return value;
  }
  return null;
}

/** Tells the families that AttachSelf attached `id` to `host`, each on the state the one before returned. */
export function familyAttached(state: ScenarioState, id: string, host: string, ctx: ReduceContext, families: readonly RulesFamily[] = active()): ScenarioState {
  let current = state;
  for (const family of hooked(families).attached) current = family.attached?.(current, id, host, ctx) ?? current;
  return current;
}

/** Why a family bars the character from defending the attack in progress, or null (the first family's reason). */
export function familyDefenseReason(state: ScenarioState, defender: PrintedCard, cards: ReadonlyMap<string, PrintedCard>, families: readonly RulesFamily[] = active()): string | null {
  for (const family of hooked(families).combat) {
    const reason = family.combat?.defense?.(state, defender, cards);
    if (reason) return reason;
  }
  return null;
}

/** Why a family bars the attacker from being declared against the enemy, or null (the first family's reason). */
export function familyAttackReason(state: ScenarioState, enemyId: string, attacker: PrintedCard, target: PrintedCard, attackerId: string, families: readonly RulesFamily[] = active()): string | null {
  for (const family of hooked(families).combat) {
    const reason = family.combat?.attack?.(state, enemyId, attacker, target, attackerId);
    if (reason) return reason;
  }
  return null;
}

/** The characters a family sends an undefended attack's damage to instead of the heroes (the first non-empty answer), or an empty list. */
export function familyUndefendedTargets(state: ScenarioState, candidates: () => readonly string[], cards: ReadonlyMap<string, PrintedCard>, families: readonly RulesFamily[] = active()): readonly string[] {
  for (const family of hooked(families).combat) {
    const found = family.combat?.undefended?.(state, candidates, cards);
    if (found && found.length > 0) return found;
  }
  return NONE;
}
