// Who "the acting player" is in a record's steps, read from the record's own fields and the type of its card (the engine's rules: forcedActor in src/rules/windows/triggers.ts, resolveShadowCard in src/rules/combat/shadow.ts, actionEffect in src/rules/player/actions.ts).
import type { Ctx, Obj } from "./kit.ts";

// The card types a player owns: a Forced effect of one answers to its controller. Any other card's Forced effect answers to the player the event happened to.
const PLAYER_TYPES: ReadonlySet<string> = new Set(["hero", "ally", "attachment", "event", "player-side-quest", "contract", "treasure"]);
// An Action of these cards, in play, belongs to no player: any player may trigger it.
const SHARED_TYPES: ReadonlySet<string> = new Set(["objective", "quest", "location"]);
// Events with no player: an encounter card's Forced effect on one then answers to the first player.
const PHASE_EVENTS: ReadonlySet<string> = new Set(["beginningOfPhase", "endOfPhase", "endOfRound", "stagingStepBegins"]);
const ATTACK_EVENTS: ReadonlySet<string> = new Set(["attacks", "attackResolved"]);

// A line saying who the acting player is, or "" when the record's fields do not decide it.
export function actorNote(effect: Obj, ctx: Ctx): string {
  const timing = effect.timing;
  const trigger = typeof effect.trigger === "string" ? effect.trigger : "";
  const encounterCard = ctx.cardType !== undefined && !PLAYER_TYPES.has(ctx.cardType);
  if (timing === "shadow") return "the acting player is the defending player (the player the attack is against)";
  if ((timing === "forced" || timing === "triggered") && encounterCard) {
    if (ATTACK_EVENTS.has(trigger)) return "the acting player is the defending player (the player the attack is against)";
    if (trigger === "engaged") return "the acting player is the player the enemy engaged";
    if (PHASE_EVENTS.has(trigger)) return "the acting player is the first player (a phase has no player of its own)";
    if (trigger !== "") return "the acting player is the player the event happened to (the first player when the event names no player)";
  }
  if (timing === "action" && ctx.cardType !== undefined && SHARED_TYPES.has(ctx.cardType)) return "any player may trigger it; the acting player is the one who does";
  return "";
}
