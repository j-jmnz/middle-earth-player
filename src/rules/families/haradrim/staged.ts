// Rules: hrd.heroes-in-the-staging-area, hrd.guarded-heroes, hrd.objective-heroes, rr.blank, rr.immune, rr.ownership-and-control (data/rules/entries.json); ledger lines 16071:A:1, 16071:B:1, 16071:B:3, 16072:B:1, 16072:B:3, 16073:A:1.
//
// The Long Arm of Mordor's heroes in the staging area. A hero there is a Captive held by no card (families/captives: the captive zone, `captive`, host null): in play, controlled by nobody, keeping its tokens and attachments, remembering its owner and its
// place among that owner's heroes, so its owner is not out of heroes while it is held (core/eliminate.ts). A guarded hero is the same Captive held by an Orc (`guardedHero` too, the flag Lost in Mirkwood's Carried Away uses, which releases it when the guard leaves play).
// The hero is not among its owner's heroes, so no default pick, resource, willpower or threat reaches it. Its own text is blank and it is immune to player card effects "for the remainder of the game": the settle sweep keeps both marks on each such hero while
// it is held and takes them off once it is not.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, livingSeats, updateCard, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { damageBarred } from "../defense/damage.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { holdCaptive, releaseCaptive } from "../captives/index.ts";
import { captivesOf } from "../captives/values.ts";
import { heroGuardedBy } from "../wilderland/carried.ts";
import type { Focus } from "../index.ts";

/** The source of the marks the sweep puts on heroes in the staging area. */
const MARKER = "staged-heroes";

/** The heroes in the staging area: Captives held by no card, in card order. */
export function stagedHeroes(state: ScenarioState): CardInstance[] {
  return captivesOf(state).filter((card) => card.host == null);
}

/** MoveHeroesToStaging: each hero of each seat leaves its seat's list and becomes a Captive held by no card. The heroes go from the last place to the first, so each remembers the place it had. */
export function moveHeroesToStaging(state: ScenarioState): ScenarioState {
  let next = state;
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    for (const id of [...(state.seats[seat]?.heroes ?? [])].reverse()) next = holdCaptive(next, id, null);
  }
  return next;
}

// The option the actor chose (`focus.chosen`), the only option, or undefined when the actor must be asked.
export function chosenOf(options: readonly string[], focus: Focus): string | undefined {
  return focus.chosen != null && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
}

// A choice that needs a running effect to ask it: without one the Setup cannot go on.
function ask(state: ScenarioState, instruction: Instruction, seat: number, options: readonly string[], steps: EngineStep[]): ScenarioState {
  return effectData(state) ? askTarget(state, { instruction, seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : { ...state, failure: `${instruction.verb} needs a choice, and no effect is asking` };
}

/** TakeObjectiveHero: the actor takes one of the set-aside objective-heroes with these codes among their heroes, faceup, with `resources` resources on it (the actor is asked when several are left). */
export function takeObjectiveHero(state: ScenarioState, instruction: Extract<Instruction, { verb: "TakeObjectiveHero" }>, focus: Focus, steps: EngineStep[]): ScenarioState {
  const options = state.setAside.filter((id) => instruction.codes.includes(state.cards[id]?.code ?? ""));
  if (options.length === 0) return state;
  const chosen = chosenOf(options, focus);
  if (!chosen) return ask(state, instruction, focus.seat, options, steps);
  const moved = moveCard(state, chosen, { zone: "heroes", seat: focus.seat });
  const taken = updateCard(moved, chosen, { face: "up", committed: false, resources: (moved.cards[chosen]?.resources ?? 0) + instruction.resources });
  // "Objective-heroes function the same as regular heroes" (hrd.objective-heroes): the card is no hero by its printed type, so it holds the flag that keeps it among its player's heroes (families/play/sweep.ts) for as long as it is in play.
  return { ...taken, modifiers: [...taken.modifiers, { instanceId: chosen, sourceId: chosen, stat: "heroType", amount: 1, until: "endOfGame" }] };
}

/** ReleaseStagedHero: the actor takes control of one of the heroes in the staging area they own, exhausted (the actor is asked when they own several); nothing changes when they own none. */
export function releaseStagedHero(state: ScenarioState, instruction: Instruction, focus: Focus, steps: EngineStep[]): ScenarioState {
  if (state.seats[focus.seat]?.eliminated) return state;
  const options = stagedHeroes(state).filter((card) => card.owner === focus.seat).map((card) => card.id);
  if (options.length === 0) return state;
  const chosen = chosenOf(options, focus);
  return chosen ? releaseCaptive(state, chosen, { exhausted: true }) : ask(state, instruction, focus.seat, options, steps);
}

// The heroes in the staging area, the first player's first, each seat's in the order it held them.
export function stagedInOrder(state: ScenarioState): CardInstance[] {
  const order = livingSeats(state);
  return stagedHeroes(state)
    .filter((card) => card.owner != null && order.includes(card.owner))
    .sort((left, right) => order.indexOf(left.owner ?? 0) - order.indexOf(right.owner ?? 0) || (left.heroSlot ?? 0) - (right.heroSlot ?? 0));
}

// The Orc enemies in the staging area that guard no hero, in staging order.
function freeOrcs(state: ScenarioState, ctx: ReduceContext): string[] {
  return state.staging.filter((id) => {
    const card = state.cards[id];
    const printed = card ? printedOf(ctx.cards, card.code) : undefined;
    return card != null && printed?.type === "enemy" && printed.traits.includes("Orc") && heroGuardedBy(state, id) == null;
  });
}

/** GuardStagedHeroes: the first player pairs each hero in the staging area with an Orc enemy in the staging area that guards no hero (asked when several Orcs are free); the hero becomes guarded by it. A hero with no Orc left stays in the staging area. */
export function guardStagedHeroes(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  let answer = focus.chosen;
  for (;;) {
    const hero = stagedInOrder(next)[0];
    const orcs = freeOrcs(next, ctx);
    if (!hero || orcs.length === 0) return next;
    const chosen = chosenOf(orcs, { ...focus, ...(answer != null ? { chosen: answer } : {}) });
    answer = undefined;
    if (!chosen) return ask(next, instruction, next.firstPlayer, orcs, steps);
    next = updateCard(holdCaptive(next, hero.id, chosen), hero.id, { guardedHero: true });
  }
}

/** The settle sweep: in a game with the staging Setup, each Captive (a hero in the staging area or a guarded hero) has its text box blank and is immune to player card effects, and a hero that is no Captive any more has neither mark. */
export function markStagedHeroes(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"MoveHeroesToStaging"')) return state;
  const held = new Set(captivesOf(state).map((card) => card.id));
  const marks = state.modifiers.filter((modifier) => modifier.sourceId === MARKER);
  const kept = marks.filter((modifier) => held.has(modifier.instanceId));
  const missing = [...held].filter((id) => !kept.some((modifier) => modifier.instanceId === id));
  if (kept.length === marks.length && missing.length === 0) return state;
  const added = missing.flatMap((id) => [
    { instanceId: id, sourceId: MARKER, stat: "blankText" as const, amount: 1, until: "endOfGame" as const },
    { instanceId: id, sourceId: MARKER, stat: "immuneToPlayerCards" as const, amount: 1, until: "endOfGame" as const },
  ]);
  return { ...state, modifiers: [...state.modifiers.filter((modifier) => modifier.sourceId !== MARKER || held.has(modifier.instanceId)), ...added] };
}

/** The `combat.undefended` hook: while a stage holds `undefendedToStaged`, the heroes in the staging area take the damage of an undefended attack, the attacked player naming which; none when no hero is there (the damage then goes to the player's own heroes). */
export function undefendedStaged(state: ScenarioState): readonly string[] {
  if (state.modifiers.length === 0 || !flagged(state, "table", "undefendedToStaged")) return [];
  // A hero that cannot take this attack's damage is not offered, and a shadow effect that names the heroes the damage must go on (`onlyHeroes`) still binds, as for the player's own heroes (combat.ts undefendedTargets).
  const only = state.pendingAttack?.onlyHeroes;
  return stagedHeroes(state).map((card) => card.id).filter((id) => !damageBarred(state, id, "combat", null) && (only == null || only.includes(id)));
}
