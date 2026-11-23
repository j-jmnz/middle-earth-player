// Rules: rr.cancel, rr.damage (data/rules/entries.json); ledger line 03014:A:1 (docs/scenarios/dwarrowdelf/into-the-pit.md, Into the Pit).
// An enemy whose own Forced effect answers the damage dealt to it: "Before Patrol Leader is dealt damage, discard the top card of the encounter deck. If the discarded card is an enemy, cancel that damage." The damage is placed and offered to the
// Forced effect as `damageDealt` before the enemy can be destroyed by it (the window a character's damage has, rr.cancel), so the cancel takes it off again; a card that cannot answer is not offered anything and no other game changes.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

// Orc Taskmaster (901104:A:2) hears the damage dealt to another enemy: "Forced: When a Goblin enemy with at least 1 resource on it is dealt any amount of damage ... cancel all damage just dealt to it." A dealt card whose record hears `damageDealt` about
// enemies in general marks every enemy the game deals, so the damage dealt to any of them is offered to it.
/** Reads the dealt enemies whose records hear `damageDealt` on themselves, or every dealt enemy when a dealt enemy's record hears it about enemies (`enemyDamageHeard`). Absent when the game deals none (every other scenario). */
export function markEnemyDamage(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const dealt = new Set(Object.values(state.cards).map((card) => card.code));
  const heard = new Set<string>();
  for (const effect of ctx.effects) {
    if (effect.trigger !== "damageDealt" || !dealt.has(effect.cardCode) || printedOf(ctx.cards, effect.cardCode).type !== "enemy") continue;
    if (effect.subject === "self") heard.add(effect.cardCode);
    else if (typeof effect.subject === "object" && effect.subject.type === "enemy") for (const code of dealt) if (printedOf(ctx.cards, code).type === "enemy") heard.add(code);
  }
  return heard.size === 0 ? state : { ...state, enemyDamageHeard: [...heard] };
}
