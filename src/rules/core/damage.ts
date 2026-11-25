// Rules: rr.damage, rr.cancel, mec109.toughness, mec109.indestructible, hob.indestructible (data/rules/entries.json). Placing damage on a card: the guards, the cancels and the events it queues; and the hold on a character's destruction while its damage is answered.
import type { Cause } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import { isCharacterType, printedOf, type PrintedCard } from "./printed.ts";
import { queueEvent } from "../windows/queue.ts";
import type { ScenarioState } from "./state.ts";
import { flagged, heldAmount, updateCard } from "./state.ts";
import { inPlay } from "./zones.ts";
import { damageBarred, damageGoesTo } from "../families/defense/damage.ts";
import { resourceCancel, resourceShield } from "../families/aflame/attack.ts";
import { cancelAllDamage, damageShield } from "../families/wilderland/shield.ts";
import { reduceLife, takesLifeInstead } from "../families/burden/life.ts";
import { placedLimit } from "../families/uncharted/limit.ts";
import { wallRoom } from "../families/pelennor/wall.ts";
import { indestructible, placedAmount, playerCardEffectCanChoose, sourcePrinted } from "./keyword-flags.ts";
import { destroyAndAnnounce } from "./destroy.ts";
import { modifiedStat } from "./modified-stat.ts";

// `combat` is the damage of an attack (rr.step-6-4-3, rr.step-6-8-3); every other kind is non-combat damage.
// `quest`: an effect of a quest card or a side quest (framework damage that a card's "non-quest effects" limit does not count, 19074:A:2).
export type DamageSource = "framework" | "player" | "combat" | "quest";

export function placeDamage(state: ScenarioState, assigned: string, amount: number, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[], source: DamageSource, cause: Cause, sourceId?: string | null): ScenarioState {
  // "Damage that would be placed on Minas Tirith must be placed on City Wall first" (145046:A:1): the wall takes what it has room for, the rest goes on the card.
  const wall = amount > 0 ? wallRoom(state, assigned, cards) : null;
  if (!wall) return placeDamageHere(state, assigned, amount, cards, steps, source, cause, sourceId);
  const onWall = Math.min(amount, wall.room);
  const first = placeDamageHere(state, wall.wall, onWall, cards, steps, source, cause, sourceId);
  return amount > onWall ? placeDamageHere(first, assigned, amount - onWall, cards, steps, source, cause, sourceId) : first;
}

function placeDamageHere(state: ScenarioState, assigned: string, amount: number, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[], source: DamageSource, cause: Cause, sourceId?: string | null): ScenarioState {
  // Damage assigned to a card another takes for it ("attached hero takes all damage assigned to the chosen hero", 02099).
  const id = damageGoesTo(state, assigned, source);
  const instance = state.cards[id];
  // Damage goes only on a card in play (rr.in-play-and-out-of-play): a defender that already left play takes none.
  if (!instance || !inPlay(instance.zone)) return state;
  const printed = printedOf(cards, instance.code);
  if (source === "player" && !playerCardEffectCanChoose(printed, state, id, sourcePrinted(state, cards, sourceId))) return state;
  // "While The Watcher is in the staging area, it cannot be damaged by player card effects" (901502:A:1): the damage of a player card's effect is not placed; an attack's combat damage and an encounter card's are.
  if (source === "player" && flagged(state, id, "noPlayerEffectDamage")) return state;
  // "When attached hero would take any amount of damage, reduce the Ring-bearer's life by an equal amount instead" (141057:A:2).
  if (takesLifeInstead(state, id)) return reduceLife(state, amount, steps, cause);
  // "Enemies cannot take damage" (141048:A:1), "cannot take non-combat damage" (141070:A:2): no damage is placed. Bilbo Baggins in the riddle area takes damage only from Gollum (hob.riddle-area).
  // "Cannot take damage" is lost by Goblin Chieftain while the stage says so (41007:B:1); combat damage dealt to an attacking enemy is canceled
  // by Lightless Passage's Shadow (41033:A:2).
  if ((flagged(state, id, "cannotTakeDamage") && !flagged(state, id, "losesNoDamage")) || (source !== "combat" && flagged(state, id, "cannotTakeNonCombatDamage")) || damageBarred(state, id, source, sourceId)) return state;
  // "Cannot take damage from non-quest effects" (19127:A:1): the damage of a combat or of a quest card's effect is still placed.
  if (source !== "combat" && source !== "quest" && flagged(state, id, "cannotTakeNonQuestDamage")) return state;
  if (source === "combat" && flagged(state, id, "combatDamageCanceled")) return state;
  // "While Shelob has at least 1 resource, cancel all damage she would be dealt and discard 1 resource from her instead" (144072:B:2).
  const paid = resourceCancel(state, id, amount);
  if (paid) return paid;
  // "When attached enemy would take any amount of damage, cancel all of that damage. Then, discard Dragon Scales" (18059:A:2).
  const scaled = flagged(state, id, "cancelsDamage") ? cancelAllDamage(state, id, amount) : null;
  if (scaled) return scaled;
  // "When attached enemy is dealt enough damage to destroy it, cancel the damage and discard Smoking Blood instead" (51017:A:1): only damage that would destroy the card is canceled.
  const lethalCanceled = flagged(state, id, "cancelsLethalDamage") && printed.health != null && instance.damage + placedAmount(state, id, printed, amount) >= modifiedStat(state, instance, "hitPoints", cards) ? cancelAllDamage(state, id, amount, "cancelsLethalDamage") : null;
  if (lethalCanceled) return lethalCanceled;
  // A card that takes no more than a number of damage each round ("cannot take more than 4 damage each round", 11177:A:4) takes what is left of it.
  const cap = source === "quest" && flagged(state, id, "damageCapSparesQuest") ? 0 : heldAmount(state, id, "damageCap");
  const taken = state.roundDamage?.[id] ?? 0;
  const resources = resourceShield(state, id, placedLimit(state, id, placedAmount(state, id, printed, amount)));
  // "The next time that character would be dealt damage this round, cancel 1 of that damage" (12166:A:2): the flag's points come off first, and it is spent.
  const shield = damageShield(resources.state, id, resources.amount);
  const capped = cap > 0 ? Math.max(0, Math.min(shield.amount, cap - taken)) : shield.amount;
  // "It cannot have more than 18 damage" (19023:B:3): a card with a ceiling takes what room is left under it.
  const ceiling = heldAmount(state, id, "damageCeiling");
  const dealt = ceiling > 0 ? Math.max(0, Math.min(capped, ceiling - instance.damage)) : capped;
  const damage = instance.damage + dealt;
  steps.push({ kind: "damage", targetId: id, amount: dealt, cause });
  let next = updateCard(cap > 0 ? { ...shield.state, roundDamage: { ...state.roundDamage, [id]: taken + dealt } } : shield.state, id, { damage });
  const hurt = dealt > 0 && inPlay(instance.zone);
  // An indestructible enemy keeps its damage but is never destroyed; it hears that it took damage (the Watcher in the Water, 142024:A:3).
  if (indestructible(state, id, printed)) return hurt ? queueEvent(next, { trigger: "damaged", seat: instance.controller, cardId: id, subject: id, amount: dealt }) : next;
  const lethal = printed.health != null && damage >= modifiedStat(next, instance, "hitPoints", cards);
  // Damage dealt to a character is first offered to the Responses that cancel it ("cancel X damage just dealt", rr.cancel).
  // A character it would destroy is destroyed by the sweep once they have had their chance (destroyOverwhelmed, damageHeld).
  // An enemy whose own Forced effect answers the damage dealt to it (Patrol Leader, 03014:A:1) is offered it the same way (families/encounter/patrol.ts markEnemyDamage).
  if (hurt && (isCharacterType(printed) || (printed.type === "enemy" && state.enemyDamageHeard?.includes(instance.code) === true))) {
    next = queueEvent(next, { trigger: "damageDealt", seat: instance.controller, cardId: id, subject: id, amount: dealt });
    if (lethal && state.holdLethal) return next;
  }
  if (lethal) {
    next = destroyAndAnnounce(next, instance, printed, cards, steps);
  } else if (hurt) {
    // A card that took damage and is still in play hears about it ("After Boromir takes any amount of damage").
    next = queueEvent(next, { trigger: "damaged", seat: instance.controller, cardId: id, subject: id, amount: dealt });
  }
  return next;
}

// A character's destruction by damage waits while that damage is still being answered: its `damageDealt` event is queued, its
// Responses are being offered, or one of them is resolving (rr.cancel: "cancel X damage just dealt").
export function damageHeld(state: ScenarioState, id: string): boolean {
  if ((state.pendingEvents ?? []).some((event) => event.trigger === "damageDealt" && event.cardId === id)) return true;
  return state.stack.some(
    (frame) =>
      ((frame.data.kind === "responses" || frame.data.kind === "event") && frame.data.event.trigger === "damageDealt" && frame.data.event.cardId === id) ||
      (frame.data.kind === "effect" && frame.data.hold === id),
  );
}
