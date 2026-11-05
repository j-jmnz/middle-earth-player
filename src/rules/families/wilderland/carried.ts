// Rules: rr.player-elimination, rr.ownership-and-control, rr.guarded (data/rules/entries.json); ledger lines 18074:A:1, 18074:B:1, 18074:B:2, 18074:B:3.
// Carried Away: an enemy guards a hero. The hero is in play, facedown under the enemy and controlled by no one (the captive zone the Ring-bearer under the Watcher uses, families/south/captive.ts), flagged `guardedHero` so its
// owner is not eliminated for want of heroes (core/keywords.ts eliminateEmpties). The enemy that guards it is the card the hero lies under.
import { eliminateEmpties, releaseAttachments } from "../../core/keywords.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickedList } from "../../interpret/player-verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, updateCard, withSeat, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { captureHero, releaseHero } from "../south/captive.ts";

/** The hero the enemy guards, or null: the guarded hero lying under it, whether or not the enemy is still in play. */
export function heroGuardedBy(state: ScenarioState, enemyId: string): string | null {
  return Object.values(state.cards).find((card) => card.guardedHero === true && card.zone === "captive" && card.host === enemyId)?.id ?? null;
}

/** CarryAwayHero: the hero picked before the last card (the enemy just discarded and added to the staging area) loses its tokens and attachments and lies under the enemy. Nothing happens when no enemy came or the hero is not a hero in play. */
export function carryAwayHero(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const picked = pickedList(state);
  const enemyId = picked.at(-1);
  const heroId = picked.at(-2);
  const enemy = enemyId ? state.cards[enemyId] : undefined;
  const hero = heroId ? state.cards[heroId] : undefined;
  if (!enemyId || !heroId || !enemy || !hero || hero.zone !== "heroes" || hero.controller == null || !inPlay(enemy.zone) || printedOf(ctx.cards, enemy.code).type !== "enemy") return state;
  const seat = hero.controller;
  const slot = state.seats[seat]?.heroes.indexOf(heroId) ?? -1;
  const bare = releaseAttachments(state, heroId, ctx.cards, steps);
  return updateCard(captureHero(bare, heroId, enemyId), heroId, { guardedHero: true, owner: seat, committed: false, ...(slot >= 0 ? { heroSlot: slot } : {}) });
}

/** ReleaseGuardedHero: the hero the subject (the defeated enemy) guarded returns among its owner's heroes where it was, faceup and exhausted. */
export function releaseGuardedHero(state: ScenarioState, subject: string | null): ScenarioState {
  const heroId = subject ? heroGuardedBy(state, subject) : null;
  const hero = heroId ? state.cards[heroId] : undefined;
  if (!heroId || !hero || hero.owner == null) return state;
  const seat = hero.owner;
  const slot = hero.heroSlot;
  const released = releaseHero(state, heroId, seat, { exhausted: true, face: "up", guardedHero: undefined, owner: undefined, heroSlot: undefined, host: null });
  const current = released.seats[seat];
  if (slot == null || !current) return released;
  const others = current.heroes.filter((id) => id !== heroId);
  return withSeat(released, seat, { ...current, heroes: [...others.slice(0, slot), heroId, ...others.slice(slot)] });
}

/** DiscardGuardedHeroes: each hero an enemy guards goes to its owner's discard pile; a player with no hero left is eliminated. */
export function discardGuardedHeroes(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.guardedHero !== true || card.zone !== "captive" || card.owner == null) continue;
    next = updateCard(moveCard(next, card.id, { zone: "discard", seat: card.owner }), card.id, { face: "up", guardedHero: undefined, owner: undefined, heroSlot: undefined });
  }
  return next === state ? state : eliminateEmpties(next, steps);
}
