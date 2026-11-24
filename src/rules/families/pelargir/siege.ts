// Rules: ats.cair-andros-location-damage, ats.cair-andros-defense-carry-over, ats.cair-andros-remove-stage, rr.removed-from-game, rr.quest-advancement (data/rules/entries.json); ledger lines 05033:A:1, 05034:A:1, 05035:A:1, 05072:B:2.
// The Battleground locations of The Siege of Cair Andros: a location with enough damage is removed from the game, an undefended attack's damage goes to the lowest Threat Battleground location in play, and the quest advances at once when none is left. Damage on a location is separate from
// its progress and only counts toward the removal (ats.cair-andros-location-damage); damage that is left when a location is removed does not carry over (ats.cair-andros-defense-carry-over).
import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import { modifiedStat, releaseAttachments } from "../../core/keywords.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import { flagged, heldAmount, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { activeLocations } from "../south/locations.ts";
import { advanceNow } from "./advance.ts";

const BATTLEGROUND = "Battleground";

/** The Battleground locations in play, in the staging area and active, in that order. */
export function battlegroundsInPlay(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): string[] {
  return [...state.staging, ...activeLocations(state)].filter((id) => {
    const card = state.cards[id];
    const printed = card ? printedOf(cards, card.code) : undefined;
    return printed != null && printed.type === "location" && printed.traits.includes(BATTLEGROUND);
  });
}

/** The Battleground locations in play with the lowest Threat as it stands: the targets of an undefended attack's damage while the current stage holds `undefendedToBattleground` (more than one on a tie, and the defending player names it). None: the heroes take it as usual. */
export function undefendedBattlegrounds(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): readonly string[] {
  const stage = state.questStage;
  if (state.modifiers.length === 0 || !stage || !flagged(state, stage, "undefendedToBattleground")) return [];
  const threats = battlegroundsInPlay(state, cards).flatMap((id) => {
    const card = state.cards[id];
    return card ? [{ id, threat: modifiedStat(state, card, "threat", cards) }] : [];
  });
  const lowest = Math.min(...threats.map((entry) => entry.threat));
  return threats.filter((entry) => entry.threat === lowest).map((entry) => entry.id);
}

/**
 * An undefended attack's damage is set after its shadow card resolved (rr.step-6-4-3), so a shadow effect that removed the Battleground location the attack was aimed at (Siege Raft on The Banks) leaves the damage to the lowest Threat Battleground location
 * then in play, or to a character the engine's list of undefended targets holds when none is left (`heroesLeft`, ats.cair-andros-location-damage). The attack stays undefended: it is not defended again, whatever the player is asked. The state with the attack aimed
 * again, or with the defending player asked to name the card when it is not one location or one character; null when the target is not a removed Battleground location.
 */
export function aimAgain(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, heroesLeft: (state: ScenarioState) => readonly string[]): ScenarioState | null {
  const attack = state.pendingAttack;
  const aimed = attack?.heroId != null ? state.cards[attack.heroId] : undefined;
  const stage = state.questStage;
  if (!attack || !aimed || aimed.zone !== "removed" || !stage || !flagged(state, stage, "undefendedToBattleground") || !printedOf(cards, aimed.code).traits.includes(BATTLEGROUND)) return null;
  const left = undefendedBattlegrounds(state, cards);
  if (left.length === 1) return { ...state, pendingAttack: { ...attack, undefended: true, heroId: left[0] } };
  // No Battleground location is left: the one character who may take it does so without being asked, and none leaves the attack with no damage.
  const heroes = left.length === 0 ? heroesLeft(state) : [];
  if (left.length === 0 && heroes.length <= 1) return { ...state, pendingAttack: { ...attack, undefended: true, heroId: heroes[0] ?? "" } };
  const { heroId: _removed, ...rest } = attack;
  return { ...state, pendingAttack: { ...rest, undefended: true }, window: { kind: "defense", enemyId: attack.enemyId, seat: attack.seat } };
}

/** A location that holds `removedAtDamage` and has that much damage (or more) is removed from the game: it is not explored and goes to no pile, its attachments are discarded, its damage and progress are gone. */
function removeFull(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of [...state.staging, ...activeLocations(state)]) {
    const card = next.cards[id];
    const limit = card ? heldAmount(next, id, "removedAtDamage") : 0;
    if (!card || limit <= 0 || card.damage < limit) continue;
    const released = releaseAttachments(next, id, cards, steps);
    next = moveCard(updateCard(released, id, { damage: 0, progress: 0, resources: 0 }), id, { zone: "removed" });
    next = { ...next, modifiers: next.modifiers.filter((modifier) => modifier.instanceId !== id) };
  }
  return next;
}

/** The current stage holds `advancesWithoutBattleground` and no Battleground location is in play: the quest advances at once to the next stage still in the quest deck, and its When Revealed effects resolve. Not during the Setup (the mulligan and the opening), before the locations are in play, and not while a window, an effect or an attack is open (the Response of the location explored last comes first). */
function advanceWithout(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const stage = state.questStage;
  if (state.mode === "mulligan" || state.mode === "afterOpening" || state.lost || state.stageCleared || state.stack.length > 0 || state.window || state.pendingAttack || state.pendingStrike || !stage || !flagged(state, stage, "advancesWithoutBattleground")) return state;
  if (battlegroundsInPlay(state, ctx.cards).length > 0) return state;
  return advanceNow(state, ctx, steps);
}

/** The family's settle sweep: the removals at damage first, then the immediate advance. Inert in a game with no modifier and in one whose records have no `removedAtDamage` (gameReads caches that per effect list). */
export function sieges(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || !gameReads(state, ctx, '"removedAtDamage"')) return state;
  return advanceWithout(removeFull(state, ctx.cards, steps), ctx, steps);
}
