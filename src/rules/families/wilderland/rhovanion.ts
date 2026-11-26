// Rules: rr.objective-cards, rr.guarded, rr.ownership-and-control, rr.quest-advancement, emce.campaign-pool-encounter (data/rules/entries.json); ledger lines 12184:A:2, 12184:B:1, 19036:A:1, 19037:A:1, 19044:A:1, 19047:B:2, 19051:A:1.
// The verbs Roam Across Rhovanion adds to the wilderland family: the quest advanced to a random stage, an objective ally flipped to its enemy side, the trust put in Urdug, an objective claimed once nothing guards it, and Urdug put back under a location as a guarded objective.
import type { Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { randomNextOf } from "../../../catalog/random-next.ts";

import { currentCause, effectCause, UNATTRIBUTED } from "../../core/cause.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { hostOf, inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { advanceStage } from "../../quest/quest.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { queueEvent } from "../../windows/queue.ts";
import { guardWith } from "../objectives/guard.ts";
import { freeOfEncounters } from "../objectives/free.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/**
 * AdvanceToRandomStage: run on the stage the quest is at, the quest advances now (19047:B:2); run on a stage already defeated, the quest has taken its random stage (advanceStage), so nothing happens. A record with `stageSet` advances by the stage's own set; one without it names a set of its own
 * (08095:B:2), which stands in for the stage's during this advance only, so the stage's defeat keeps its own.
 */
export function advanceToRandomStage(state: ScenarioState, instruction: Verb<"AdvanceToRandomStage">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!focus.sourceId || state.questStage !== focus.sourceId) return state;
  const before = steps.length;
  const own = instruction.stageSet === true ? undefined : randomNextOf(instruction);
  return afterProgress(advanceStage(state, ctx.cards, steps, (current) => !restricted(current, ctx, "advance").length, own), before, ctx, steps);
}

function inPlayWithCode(state: ScenarioState, code: string): string | undefined {
  return hostOf(state, code) ?? undefined;
}

/** The card `id` becomes the card `into`, faceup and ready in the staging area, controlled by no one, with its damage removed; it keeps its resources and the cards attached to it, and the card it was is kept as its other side. Shared by FlipToEnemySide and ReturnFromVictory. */
export function turnIntoInStaging(state: ScenarioState, id: string, into: string): ScenarioState {
  const card = state.cards[id];
  if (!card) return state;
  return updateCard(moveCard(state, id, { zone: "staging" }), id, { code: into, other: card.code, face: "up", controller: null, damage: 0, exhausted: false });
}

/** FlipToEnemySide: the card in play with the code becomes `into`, faceup and ready in the staging area, controlled by no one, with its damage removed; it keeps its resources and the cards attached to it. The old side is kept as the card's other side. */
export function flipToEnemySide(state: ScenarioState, instruction: Verb<"FlipToEnemySide">): ScenarioState {
  const id = inPlayWithCode(state, instruction.code);
  return id ? turnIntoInStaging(state, id, instruction.into) : state;
}

/**
 * PutTrust: the first player chooses to place a resource on the card with the code (Urdug, whichever side he shows) or a copy of the burden is shuffled into the encounter deck. The resource is a token of the card, so it needs no controller to hold it.
 * With no such card in play only the burden is offered.
 */
export function putTrust(state: ScenarioState, instruction: Verb<"PutTrust">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const name = printedOf(ctx.cards, instruction.code).name;
  const pick: PickSpec = { type: "card", control: "any", names: [name], engagedEnemies: true };
  const choose: Instruction = {
    verb: "Choose",
    who: "firstPlayer",
    options: [
      { id: "trust", requires: { kind: "canPick", pick }, instructions: [{ verb: "Pick", pick }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }] },
      { id: "burden", instructions: [{ verb: "ShuffleIntoEncounterDeck", code: instruction.burden }] },
    ],
  };
  const cause = currentCause(steps, UNATTRIBUTED);
  return queueFront(state, [{ instruction: choose, seat: focus.seat, chosen: null, cause }]);
}

/**
 * GuardReturnedBy: the card in play with the code goes back to the staging area, controlled by no one, guarded by the last picked card, which must be in the staging area (19044:A:1). With `returns: "firstPlayer"` (Arwen under Goblin Gate, 901402:B:1) the guard may be the active location
 * too, and the card is marked (`guardedAlly`) to rejoin the first player's play area once nothing guards it (families/play/sweep.ts); it keeps its damage, tokens and attachments.
 */
export function guardReturnedBy(state: ScenarioState, instruction: Verb<"GuardReturnedBy">): ScenarioState {
  const id = inPlayWithCode(state, instruction.code);
  const guard = lastPicked(state);
  const where = guard ? state.cards[guard]?.zone : undefined;
  const returns = instruction.returns === "firstPlayer";
  if (!id || !guard || (where !== "staging" && !(returns && where === "activeLocation")) || guard === id) return state;
  // An ally keeps its owner (it goes to that discard pile if it is destroyed in the staging area, as defeatedDestination reads).
  const kept = returns ? { owner: state.cards[id]?.owner ?? state.cards[id]?.controller ?? undefined } : {};
  const guarded = guardWith(updateCard(moveCard(state, id, { zone: "staging" }), id, { controller: null, face: "up", ...kept }), guard, id);
  return returns ? { ...guarded, modifiers: [...guarded.modifiers, { instanceId: id, sourceId: guard, stat: "guardedAlly", amount: 1, until: "endOfGame" }] } : guarded;
}

const CLAIMERS = new WeakMap<readonly unknown[], readonly { code: string; host: string | undefined; id: string }[]>();

/** The objectives whose records name ClaimWhenFree, with the title of the card each is attached to (none: a hero of the first player). */
function claimers(ctx: ReduceContext): readonly { code: string; host: string | undefined; id: string }[] {
  let found = CLAIMERS.get(ctx.effects);
  if (!found) {
    found = ctx.effects.flatMap((effect) => (effect.timing === "constant" ? effect.instructions.flatMap((instruction) => (instruction.verb === "ClaimWhenFree" ? [{ code: effect.cardCode, host: instruction.host, id: effect.id }] : [])) : []));
    CLAIMERS.set(ctx.effects, found);
  }
  return found;
}

/**
 * The settle sweep (19036:A:1, 19037:A:1): an objective in the staging area that names ClaimWhenFree and has nothing guarding it is claimed by the first player. One that names a host is attached to the card in play with that title (controlled by that card's controller); the
 * other is attached to a hero the first player chooses, in a frame. `claimed` is announced. Only a game that has such an objective looks.
 */
export function claimFreed(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || state.stageCleared || state.staging.length === 0 || !gameReads(state, ctx, '"ClaimWhenFree"')) return state;
  const codes = constantVerbCodes(ctx, "ClaimWhenFree");
  // The first free objective that can be claimed now: one that names a host waits for that card to be in play and the next is tried.
  for (const id of state.staging) {
    const card = state.cards[id];
    if (!card || card.zone !== "staging" || !codes.has(card.code) || !freeOfEncounters(state, id)) continue;
    const rule = claimers(ctx).find((entry) => entry.code === card.code);
    if (!rule) continue;
    if (rule.host == null) {
      const record = ctx.effects.find((effect) => effect.id === rule.id);
      if (!record || state.seats[state.firstPlayer]?.eliminated) continue;
      const instructions: Instruction[] = [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "ClaimObjective" }];
      return pushEffectFrame(state, { frame: "ResolveEffect", sourceId: id, actor: state.firstPlayer, peril: false, effectId: record.id, instructions, picked: [], cancel: null, blockCancel: null, cause: effectCause(record) }, steps);
    }
    const hostId = Object.values(state.cards).find((other) => inPlay(other.zone) && other.id !== id && printedOf(ctx.cards, other.code).name === rule.host)?.id;
    const host = hostId ? state.cards[hostId] : undefined;
    if (!hostId || !host) continue;
    const attached = updateCard(attachTo(moveCard(state, id, { zone: "attached" }), id, hostId), id, { face: "up", controller: host.controller, claimed: true });
    return queueEvent(attached, { trigger: "claimed", seat: state.firstPlayer, cardId: id });
  }
  return state;
}
