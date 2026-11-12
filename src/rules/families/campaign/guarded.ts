// Rules: mec113.setting-up-the-game, rr.guarded, rr.objective-cards, rr.permanent, rr.effects, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 146069:A:1, 146069:B:1.
// The Tower of Cirith Ungol's campaign card: A Heavy Burden attached to the hero that holds Last of the Company and moved to the Ring-bearer at stage 3A, and the Item boons the players set aside, which Shagrat then guards.
import type { Instruction } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import { ringBearerId } from "../burden/deck.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AttachToHeroWith: a copy of the card from the supply goes on the hero that has `with` attached, in play under that hero's controller. With no such hero nothing is attached. */
export function attachToHeroWith(state: ScenarioState, instruction: Verb<"AttachToHeroWith">): ScenarioState {
  const hostId = state.seats.flatMap((seat) => seat.heroes).find((id) => state.cards[id]?.attachments.some((attached) => state.cards[attached]?.code === instruction.with));
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || host?.controller == null) return state;
  const spawned = spawn(state, instruction.code, { zone: "play", seat: host.controller });
  return attachTo(spawned.state, spawned.id, hostId);
}

/** MoveAttachment: the card in play with the code goes onto the picked hero or the Ring-bearer, under that hero's controller, with what is on it; it was never out of play. */
export function moveAttachment(state: ScenarioState, instruction: Verb<"MoveAttachment">, ctx: ReduceContext): ScenarioState {
  const id = Object.values(state.cards).find((card) => card.code === instruction.code && inPlay(card.zone) && card.host != null)?.id;
  const hostId = instruction.to === "picked" ? lastPicked(state) : ringBearerId(state, ctx);
  const card = id ? state.cards[id] : undefined;
  const host = hostId ? state.cards[hostId] : undefined;
  if (!id || !card || !hostId || host?.zone !== "heroes" || host.controller == null || card.host === hostId) return state;
  const moved = attachTo(updateCard(moveCard(state, id, { zone: "play", seat: host.controller }), id, { host: null, face: "up" }), id, hostId);
  return queueEvent(moved, { trigger: "attached", seat: host.controller, subject: id, other: hostId });
}

/**
 * GuardWithSetAside: each boon the game set aside (state.setAside) is attached to the card in play with the code `host`, faceup, held for its owner: nobody controls it, and it is the owner's again when the host leaves play (the settle sweep that
 * returns a held card, families/wilderland/kings.ts returnHeld). A boon is a card the pool holds as one (`campaignKind`). With the host not in play the boons stay set aside.
 */
export function guardWithSetAside(state: ScenarioState, instruction: Verb<"GuardWithSetAside">, _focus: Focus, ctx: ReduceContext): ScenarioState {
  const hostId = Object.values(state.cards).find((card) => card.code === instruction.host && inPlay(card.zone))?.id;
  if (!hostId) return state;
  let next = state;
  for (const id of state.setAside) {
    const card = state.cards[id];
    if (!card || printedOf(ctx.cards, card.code).campaignKind !== instruction.kind) continue;
    next = attachTo(updateCard(moveCard(next, id, { zone: "attached" }), id, { face: "up", controller: null, held: true, ...(card.owner != null ? { owner: card.owner } : {}) }), id, hostId);
  }
  return next;
}

/** PlaceLoggedHeroDamage (10193:A:2): each hero in play takes the damage the Campaign Log noted for its code (`campaignFacts.angmar.heroDamage`); a hero with no note takes none. */
export function placeLoggedHeroDamage(state: ScenarioState): ScenarioState {
  const noted = state.campaignFacts?.angmar?.heroDamage;
  if (!noted) return state;
  let next = state;
  for (const hero of Object.values(state.cards).filter((card) => card.zone === "heroes")) {
    const damage = noted[hero.code] ?? 0;
    if (damage > 0) next = updateCard(next, hero.id, { damage: hero.damage + damage });
  }
  return next;
}
