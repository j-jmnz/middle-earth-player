// Rules: rr.first-player, rr.campaign-pool, rr.burdens, rr.blank (data/rules/entries.json); ledger lines 10166:A:3, 10167:A:1, 10168:A:1, 10168:A:2, 10169:A:2, 10170:A:2.
// Thaurdir's burdens (Deadmen's Dike): one of the three set-aside burdens is picked at random and attached to Thaurdir when he enters play (AttachRandomBurden), then follows each Sorcery treachery to the hero with the most of something (MoveToHero); a burden in the pool
// attaches to the card with a title when a later scenario sets up, or leaves the game when there is none (AttachSelfToNamed).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import { inPlay, livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectData } from "../encounter/moves.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// A burden is an encounter card attached to a card, faceup and controlled by nobody (a Condition attachment), whoever carries it.
function attachBurden(state: ScenarioState, id: string, hostId: string): ScenarioState {
  const card = state.cards[id];
  const old = card?.host != null ? state.cards[card.host] : undefined;
  let next = old ? updateCard(state, old.id, { attachments: old.attachments.filter((other) => other !== id) }) : state;
  next = attachTo(updateCard(moveCard(next, id, { zone: "attached" }), id, { face: "up", controller: null, host: null }), id, hostId);
  return queueEvent(next, { trigger: "attached", seat: null, subject: id, other: hostId });
}

/**
 * AttachRandomBurden: of the burdens named that the game set aside, one is picked at random with the game's seed and attached to the card the record names (the event's card, Thaurdir as he enters play), though he cannot have attachments: a card's own "attach it" is not the play of an attachment (Reading 1; attachBlocked reads the play and the effects that attach). A game with none set aside (standalone play) attaches nothing.
 */
export function attachRandomBurden(state: ScenarioState, instruction: Verb<"AttachRandomBurden">, focus: Focus): ScenarioState {
  const hostId = refCard(state, instruction.to ?? "subject", frameScope(state, focus.seat, focus.sourceId));
  const host = hostId ? state.cards[hostId] : undefined;
  const aside = state.setAside.filter((id) => instruction.codes.includes(state.cards[id]?.code ?? ""));
  if (!host || !inPlay(host.zone) || aside.length === 0) return state;
  const shuffled = shuffleIds(aside, state.seed, state.seedCursor);
  const picked = shuffled.ids[0];
  return picked ? attachBurden({ ...state, seedCursor: shuffled.cursor }, picked, host.id) : state;
}

// The heroes of the living players, in play.
function heroesInPlay(state: ScenarioState): string[] {
  return livingSeats(state).flatMap((seat) => state.seats[seat]?.heroes ?? []).filter((id) => state.cards[id]?.zone === "heroes");
}

// What a hero holds of the thing a burden follows: resource tokens, attachments that are not objectives (the burdens are objectives), damage.
function holdsOf(state: ScenarioState, heroId: string, most: Verb<"MoveToHero">["most"], ctx: ReduceContext): number {
  const hero = state.cards[heroId];
  if (!hero) return 0;
  if (most === "resources") return hero.resources;
  if (most === "damage") return hero.damage;
  return hero.attachments.filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type !== "objective").length;
}

/**
 * MoveToHero: the source burden goes to the hero (any player's) that holds the most resources, non-objective attachments or damage. The hero it is on counts: it keeps the burden when it holds the most; when heroes tie for the most, the first player chooses
 * among them (rr.first-player). With no hero in play nothing moves. Run outside an effect frame, which cannot ask, a tie fails the step.
 */
export function moveToHero(state: ScenarioState, instruction: Verb<"MoveToHero">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const heroes = heroesInPlay(state);
  if (!source || !inPlay(source.zone) || heroes.length === 0) return state;
  const most = Math.max(...heroes.map((id) => holdsOf(state, id, instruction.most, ctx)));
  const tied = heroes.filter((id) => holdsOf(state, id, instruction.most, ctx) === most);
  if (source.host != null && tied.includes(source.host)) return state;
  const target = tied.length === 1 ? tied[0] : focus.chosen != null && tied.includes(focus.chosen) ? focus.chosen : undefined;
  if (target) return attachBurden(state, source.id, target);
  if (!effectData(state)) return { ...state, failure: "Choosing the hero to move a burden to needs a choice, and no effect is asking" };
  return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
}

/**
 * AttachSelfToNamed (Setup of a burden or boon of the pool): the source attaches to the card with the title in play (`outOfPlay`: or set aside, out of play), and with no such card it is removed from the game. Run for a pool card at a later scenario's
 * Setup (Amarthiúl's Courage, the three burdens).
 */
export function attachSelfToNamed(state: ScenarioState, instruction: Verb<"AttachSelfToNamed">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const id = focus.sourceId;
  if (!id || !state.cards[id]) return state;
  const named = (card: { code: string }): boolean => printedOf(ctx.cards, card.code).name === instruction.name;
  const aside = new Set(state.setAside);
  const host = Object.values(state.cards).find((card) => card.id !== id && named(card) && (inPlay(card.zone) || (instruction.outOfPlay === true && aside.has(card.id))));
  return host ? attachBurden(state, id, host.id) : moveCard(state, id, { zone: "removed" });
}
