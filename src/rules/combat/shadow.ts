// Rules: rr.step-6-2, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.cancel, rr.attacks-outside-the-combat-phase,
// faq.enemy-attacks-outside-combat, faq.additional-attacks, ltp.shadow-discard (data/rules/entries.json).
import { undefendedToCity } from "../families/pelennor/combat.ts";
import { verbsRunningInFrame, type Effect } from "../../catalog/boundary.ts";

import { pushEffectFrame } from "../interpret/effect-frames.ts";
import { holdsNow } from "../interpret/verbs.ts";
import { shadowBlankOf } from "../interpret/conditions.ts";
import type { EngineStep } from "../core/intents.ts";
import { gameReads } from "../core/game-reads.ts";
import { queueEvent } from "../windows/queue.ts";
import { runInstruction, type ReduceContext } from "../interpret/interpret.ts";
import { defenseAsDefender, modifiedStat } from "../core/keywords.ts";
import type { PendingAttack, ScenarioState } from "../core/state.ts";
import { expireModifiers, flagged, heldAmount, inPlay, updateCard } from "../core/state.ts";
import { withFrame } from "../windows/windows.ts";
import { moveCard, shadowCards } from "../core/zones.ts";
import { effectCause, inCause, ruleCause } from "../core/cause.ts";
import { offerResponses } from "../windows/responses.ts";
import { enemyAttackWindow } from "../engine/step-window.ts";
import { noteAttackDamage } from "../families/defense/damage.ts";
import { announceHurt } from "../families/angmar/damage.ts";
import { discardableShadow } from "../families/angmar/shadows.ts";
import { combatDamage, excessDamageAfter } from "../families/defense/excess.ts";
import { attackCanceled, defendersDeclared, holdAttackEnd, specialStrike } from "../families/defense/defenders.ts";
import { holdAttack } from "../families/defense/listen.ts";
import { startShadowAttack } from "../families/defense/shadow-attack.ts";
import { announceShadowRaise, noteShadowStart } from "../families/defense/shadow.ts";
import { announceShadowResolved } from "../families/dungeon/shadow.ts";
import { announceShadowsResolved } from "../families/angmar/reanimate/shadows.ts";
import { announceShadowWizardry } from "../families/wizardry/shadow.ts";
import { announceDestroyed, charactersDestroyed, destroyedByAttack } from "../families/burden/attack.ts";
import { printedOf } from "../core/printed.ts";
import { attackHere, attackKey, countsEachAttack, locationDamage } from "../families/south/watcher.ts";
import { pillageAfter } from "../families/sea/pillage.ts";

// Turns the attacker's shadow card up and runs its shadow effects in their own frame. The attack in
// progress is on state.pendingAttack, so an effect can read whether it is defended and change it.
function resolveShadow(state: ScenarioState, enemyId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const shadowId = state.cards[enemyId]?.shadowId;
  return shadowId ? resolveShadowCard(state, shadowId, seat, ctx, steps) : state;
}

// A shadow effect that asks a player (Pick, Choose: "Discard a non-objective attachment you control", 141071:A:2), repeats an
// instruction ("Deal X shadow cards to this attacker", 01112:A:2) or resolves another card's When Revealed effects ("Resolve the
// \"When Revealed\" effect of Iron Shackles", 01105:A:2), assigns damage a point at a time ("Assign X damage among characters you control", 142057:A:2),
// runs on each card that matches ("exhaust all characters you control", 900103:A:2), or
// reveals an encounter card ("Reveal an encounter card", 11176:A:4), or discards the bottom card of a deck and reads its printed cost (11032:A:2), or grapples (the first player chooses among tied locations, 12053:A:3, 12054:A:3), or searches for an enemy and adds it to the staging area (the first player chooses among the kinds found, 12106:A:2), runs in a frame: only a frame expands a Repeat or an Each or waits for the effects it pushes. A verb says so in its schema entry (`runsInFrame`, src/catalog/verb-flags.ts); this lists none.
export function runsInFrame(effects: readonly Effect[]): boolean {
  const framed = verbsRunningInFrame();
  return effects.some((effect) => effect.instructions.some((instruction) => framed.has(instruction.verb)));
}

function resolveShadowCard(state: ScenarioState, shadowId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const shadow = state.cards[shadowId];
  if (!shadow) return state;
  const turned = updateCard(state, shadowId, { face: "up" });
  const effects = ctx.effects.filter((effect) => effect.cardCode === shadow.code && effect.timing === "shadow");
  // An effect that waits for a player runs in a frame settle advances; the attack goes on when it pops (afterShadowFrame).
  if (runsInFrame(effects) && turned.pendingAttack) {
    const framed = pushEffectFrame(
      // The defense window is over: the defender is declared.
      { ...turned, window: null, pendingAttack: { ...turned.pendingAttack, shadowFrame: shadowId } },
      {
        frame: "shadow",
        sourceId: shadowId,
        actor: seat,
        peril: false,
        effectId: effects[0]?.id ?? `${shadowId}:shadow`,
        instructions: effects.flatMap((effect) => effect.instructions),
        causes: effects.flatMap((effect) => effect.instructions.map(() => effectCause(effect))),
        cancel: null,
        blockCancel: null,
      },
      steps,
    );
    return framed;
  }
  const resolved = withFrame(turned, "shadow", shadowId, false, (framed) => {
    let next = framed;
    // Mountains of Angmar: a shadow card with no shadow effect gains "Shadow: Raise defending player's threat by 2" (10133:A:1).
    const gained = effects.length === 0 ? heldAmount(next, "table", "blankShadowGains") : 0;
    if (gained > 0) next = inCause(steps, ruleCause("rr.shadow-effects"), () => runInstruction(next, { verb: "RaiseThreat", amount: gained, who: "actor" }, { seat, sourceId: shadowId }, ctx, steps));
    for (const effect of ctx.effects) {
      if (effect.cardCode !== shadow.code || effect.timing !== "shadow") continue;
      for (const instruction of effect.instructions) {
        if (!holdsNow(next, instruction, { actor: seat, sourceId: shadowId, returned: 0 }, ctx)) continue;
        next = inCause(steps, effectCause(effect), () => runInstruction(next, instruction, { seat, sourceId: shadowId }, ctx, steps));
        if (next.lost || next.failure) return next;
      }
    }
    return next;
  }, steps);
  // A resolved shadow card stays with its enemy, face up, unless its effect put it somewhere else ("Shuffle this card into
  // the encounter deck", 141069:A:3): it is discarded when the enemy leaves play or the combat phase ends (ltp.shadow-discard).
  return resolved;
}

// The shadow cards an enemy was dealt for an earlier attack, discarded before it makes another (faq.additional-attacks).
export function discardShadowOf(state: ScenarioState, enemyId: string): ScenarioState {
  let next = state;
  for (const id of shadowCards(state.cards[enemyId])) {
    if (next.cards[id]) next = moveCard(next, id, { zone: "encounterDiscard" });
  }
  return next;
}

// The shadow cards an enemy holds that an earlier attack already turned up: discarded before it is dealt another, so they are not resolved a second time (stage 1B and 2B of The Battle of Carn Dûm).
export function discardResolvedShadowOf(state: ScenarioState, enemyId: string): ScenarioState {
  let next = state;
  for (const id of shadowCards(state.cards[enemyId])) {
    if (next.cards[id]?.face === "up") next = moveCard(next, id, { zone: "encounterDiscard" });
  }
  return next;
}

// The next additional shadow card to resolve: the one turned up for its cancel Responses while it is still with the enemy,
// else the first still face down. One already resolved stays with the enemy, face up.
function nextExtraShadow(state: ScenarioState, enemyId: string): string | undefined {
  const ids = state.cards[enemyId]?.extraShadowIds ?? [];
  const offered = state.pendingAttack?.extraOffered;
  if (offered != null && ids.includes(offered)) return offered;
  return ids.find((id) => state.cards[id]?.face !== "up");
}

// End of the combat phase: every shadow card dealt this round is discarded (ltp.shadow-discard).
export function discardShadows(state: ScenarioState): ScenarioState {
  let next = state;
  for (const instance of Object.values(state.cards)) {
    // Stage 1B of The Battle of Carn Dûm: "Do not discard unresolved shadow cards at the end of the combat phase" (10125:B:2).
    if (instance.zone === "shadow" && discardableShadow(state, instance.id)) next = moveCard(next, instance.id, { zone: "encounterDiscard" });
  }
  return next;
}

function hasShadowEffect(state: ScenarioState, enemyId: string, ctx: ReduceContext): boolean {
  return cardHasShadowEffect(state, state.cards[enemyId]?.shadowId ?? "", ctx);
}

function cardHasShadowEffect(state: ScenarioState, shadowId: string, ctx: ReduceContext): boolean {
  const shadow = state.cards[shadowId];
  return shadow != null && ctx.effects.some((effect) => effect.cardCode === shadow.code && effect.timing === "shadow");
}

// The attack waits for settle: a shadow frame, or the cancel Responses offered for a shadow card, are still open.
export function attackResumes(state: ScenarioState): boolean {
  const attack = state.pendingAttack;
  if (!attack || state.stack.length > 0 || state.window) return false;
  if (attack.shadowFrame != null) return true;
  if (attack.shadowOffered && !attack.shadowResolved) return true;
  return attack.extraOffered != null && nextExtraShadow(state, attack.enemyId) === attack.extraOffered;
}

// The additional shadow cards (141069:A:2) resolve after the first, in the order dealt, each after its own cancel offer
// (rr.cancel). The card is turned face up before the offer, so the player sees the effect a Response would cancel. A resolved
// or canceled card stays with the enemy, face up, so the next one is the first still face down. Returns the state and
// whether the attack now waits for settle.
function resolveExtraShadows(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): { state: ScenarioState; waits: boolean } {
  let next = state;
  for (let guard = 0; guard < 20; guard += 1) {
    const attack = next.pendingAttack;
    const shadowId = attack ? nextExtraShadow(next, attack.enemyId) : undefined;
    if (!attack || shadowId == null) return { state: next, waits: false };
    if (attack.extraOffered !== shadowId && cardHasShadowEffect(next, shadowId, ctx) && !flagged(next, attack.enemyId, "shadowsImmune")) {
      const turned = updateCard(next, shadowId, { face: "up" });
      const marked: ScenarioState = { ...turned, pendingAttack: { ...attack, extraOffered: shadowId, shadowCanceled: false } };
      const offered = offerResponses(marked, { trigger: "shadowPending", seat: attack.seat }, ctx, steps);
      if (offered.stack.length > marked.stack.length) return { state: { ...offered, window: null }, waits: true };
      next = offered;
    }
    const current = next.pendingAttack ?? attack;
    const canceled = current.extraOffered === shadowId && current.shadowCanceled === true;
    // The offer is over: the card is no longer the one waiting for its Responses.
    const { extraOffered: _offered, ...rest } = current;
    const settled: ScenarioState = { ...next, pendingAttack: rest };
    next = canceled ? updateCard(settled, shadowId, { face: "up" }) : resolveShadowCard(settled, shadowId, attack.seat, ctx, steps);
    if (next.lost || next.failure || next.pendingAttack?.shadowFrame != null) return { state: next, waits: true };
  }
  return { state: next, waits: false };
}

// Runs once the defender is declared or the hero is named. The shadow resolves first, then damage.
export function resolveAttack(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // The enemy's Attack as its shadow cards begin to resolve, to tell whether one raises it (defense family).
  let next = noteShadowStart(state, ctx);
  const begun = next.pendingAttack;
  if (!begun) return state;
  // A canceled attack resolves nothing more (rr.cancel).
  if (attackCanceled(next)) return finishAttack(next, ctx, steps);
  if (!begun.shadowResolved) {
    // The shadow effect has just triggered: a Response may cancel it first (Hasty Stroke). The card is turned face up
    // first, so the player sees the effect before choosing (rr.shadow-effects). The attack waits for the Responses, and
    // settle comes back here when they are done.
    const shadowId = next.cards[begun.enemyId]?.shadowId;
    if (!begun.shadowOffered && shadowId && hasShadowEffect(next, begun.enemyId, ctx) && !flagged(next, begun.enemyId, "shadowsImmune")) {
      const turned = updateCard(next, shadowId, { face: "up" });
      const offered = offerResponses({ ...turned, pendingAttack: { ...begun, shadowOffered: true } }, { trigger: "shadowPending", seat: begun.seat }, ctx, steps);
      // The defense window is over: the defender is declared. Settle runs the Responses, then the attack goes on.
      if (offered.stack.length > next.stack.length) return { ...offered, window: null };
      next = offered;
    }
    const current = next.pendingAttack ?? begun;
    next = { ...next, pendingAttack: { ...current, shadowResolved: true } };
    if (!current.shadowCanceled) next = resolveShadow(next, begun.enemyId, begun.seat, ctx, steps);
    if (next.lost || next.failure || next.pendingAttack?.shadowFrame != null) return next;
  }
  // A shadow frame that asked a player has popped: the attack goes on, and the card stays with the enemy.
  if (next.pendingAttack?.shadowFrame != null) {
    const { shadowFrame: _frame, ...rest } = next.pendingAttack;
    next = { ...next, pendingAttack: rest };
  }
  if (nextExtraShadow(next, begun.enemyId) != null) {
    const extra = resolveExtraShadows(next, ctx, steps);
    if (extra.waits) return extra.state;
    next = extra.state;
  }
  // 6.4.2: the shadow effects are resolved; an action window comes before combat damage. "When a shadow card increases an
  // enemy's Attack" is answered before it too.
  if (next.pendingAttack && !next.pendingAttack.shadowsDone) {
    next = announceShadowRaise(announceShadowWizardry(announceShadowsResolved(announceShadowResolved({ ...next, pendingAttack: { ...next.pendingAttack, shadowsDone: true } }, ctx), ctx), ctx), ctx);
    const between = enemyAttackWindow(next, ctx, "damage") ?? holdAttack(next, ctx, "damage", ["shadowRaisedAttack", "shadowEffectResolved", "shadowsResolved", "shadowWizardry"]);
    if (between) return between;
  }
  const attack = next.pendingAttack;
  const enemy = attack ? next.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || !attackHere(next, attack.enemyId)) return finishAttack(next, ctx, steps);
  // Several defenders (rr.multiple-defenders), or the attack turned on another enemy (06062): the defense family deals the damage.
  const special = specialStrike(next, ctx, steps);
  if (special) return special.wait || special.state.lost ? special.state : afterDamage(special.state, ctx, steps);
  // A defender that left play before damage leaves the attack undefended (rr.step-6-4-3).
  const gone = attack.defenderId != null && !attack.undefended && !inPlay(next.cards[attack.defenderId]?.zone ?? "removed");
  if (gone) next = { ...next, pendingAttack: { ...attack, undefended: true } };
  if (attack.defenderId != null && !attack.undefended && !gone) {
    const defender = next.cards[attack.defenderId];
    const strength = modifiedStat(next, enemy, "attack", ctx.cards);
    const defense = defender ? defenseAsDefender(next, attack.defenderId, ctx.cards) : 0;
    if (defender) steps.push({ kind: "strike", side: "enemy", enemyId: attack.enemyId, targetId: attack.defenderId, attack: strength, defense, undefended: false, cause: ruleCause("rr.step-6-4-3") });
    // "This attack deals no damage" (a flag the enemy holds, families/misc.ts).
    const raw = defender && !flagged(next, enemy.id, "dealsNoDamage") ? Math.max(0, strength - defense) : 0;
    const damaged = noteAttackDamage(next, defender ? combatDamage(noteStruck(next, strength, ctx), attack.enemyId, attack.defenderId, raw, ctx, steps) : next, ctx, steps);
    return damaged.lost ? damaged : afterDamage(damaged, ctx, steps);
  }
  // A shadow effect sent the damage to an active location (families/south/watcher.ts).
  const located = attack.toLocation || undefendedToCity(next, attack.enemyId) ? locationDamage(next, attack, ctx, steps) : null;
  if (located) return located.lost || located.window ? located : afterDamage(noteAttackDamage(next, located, ctx, steps), ctx, steps);
  // A shadow effect made a defended attack undefended: the player still names the hero who takes it.
  if (attack.heroId == null) return { ...next, window: { kind: "defense", enemyId: attack.enemyId, seat: attack.seat } };
  // No hero is left to take the attack (every hero of the seat is held, 18074): it deals no damage.
  if (!next.cards[attack.heroId]) return afterDamage(next, ctx, steps);
  const strength = modifiedStat(next, enemy, "attack", ctx.cards);
  steps.push({ kind: "strike", side: "enemy", enemyId: attack.enemyId, targetId: attack.heroId, attack: strength, defense: 0, undefended: true, cause: ruleCause("rr.step-6-4-3") });
  const hit = noteAttackDamage(next, combatDamage(noteStruck(next, strength, ctx), attack.enemyId, attack.heroId, flagged(next, enemy.id, "dealsNoDamage") ? 0 : strength, ctx, steps), ctx, steps);
  return hit.lost ? hit : afterDamage(hit, ctx, steps);
}

// The Attack the enemy struck with, kept for the effect the attack leaves for its end, only in a game with a card that resolves the attack against each player (900208:A:2).
function noteStruck(state: ScenarioState, strength: number, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  return attack && gameReads(state, ctx, '"AttackOthersUndefended"') ? { ...state, pendingAttack: { ...attack, struck: strength } } : state;
}

// 6.4.3: combat damage is placed; an action window comes before the attack ends.
function afterDamage(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  const marked: ScenarioState = { ...state, pendingAttack: { ...attack, damaged: true } };
  return enemyAttackWindow(marked, ctx, "end") ?? finishAttack(marked, ctx, steps);
}

// The step window between two steps of an attack has closed: the attack goes on with the step that follows it.
export function resumeAttack(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack?.awaiting) return state;
  const { awaiting, awaitDepth: _depth, ...rest } = attack;
  const cleared: ScenarioState = { ...state, pendingAttack: rest };
  if (!attackHere(cleared, attack.enemyId)) return finishAttack(cleared, ctx, steps);
  switch (awaiting) {
    case "defense":
      // Defenders declared by an effect before the defense step (11007, 12140), or a canceled attack, skip it.
      if (attackCanceled(cleared)) return finishAttack(cleared, ctx, steps);
      if (defendersDeclared(cleared)) return enemyAttackWindow(cleared, ctx, "shadow") ?? holdAttack(cleared, ctx, "shadow", ["declaredDefender", "exhausted"]) ?? resolveAttack(cleared, ctx, steps);
      return { ...cleared, window: { kind: "defense", enemyId: attack.enemyId, seat: attack.seat }, activeSeat: attack.seat };
    // More defenders were declared (01038): the window after the declaration (6.4.1), then the shadow cards.
    case "defenders":
      return enemyAttackWindow(cleared, ctx, "shadow") ?? holdAttack(cleared, ctx, "shadow", ["declaredDefender", "exhausted"]) ?? resolveAttack(cleared, ctx, steps);
    case "shadow":
    case "damage":
      return resolveAttack(cleared, ctx, steps);
    case "end":
      return finishAttack(cleared, ctx, steps);
  }
}

// The enemies that made an immediate attack in the phase now under way, with this one added; those of an earlier phase or round are forgotten.
function noteImmediate(state: ScenarioState, enemyId: string): NonNullable<ScenarioState["immediateAttacks"]> {
  const noted = state.immediateAttacks;
  const here = noted != null && noted.round === state.round && noted.phase === state.phase;
  return { round: state.round, phase: state.phase, enemies: here && noted.enemies.includes(enemyId) ? noted.enemies : [...(here ? noted.enemies : []), enemyId] };
}

// Ends the attack: endOfAttack modifiers expire, the enemy's attack is used up, and instructions a
// shadow effect left for after the attack run in a frame of their own.
export function finishAttack(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  // The Responses to the damage just dealt, and what the end of the attack says about its defenders, come first (defense family).
  const held = holdAttackEnd(state, ctx, steps);
  if (held) return held;
  // The characters this attack destroyed are the X of the effect it leaves for its end ("If this attack destroys a character").
  // Cave-troll's excess damage (excessToDamage) is one more instruction for the attack's end.
  const troll = excessDamageAfter(state, attack, ctx);
  const destroyed = (attack.after ?? []).length > 0 ? charactersDestroyed(state, attack, ctx) : 0;
  const sendsExcess = flagged(state, attack.enemyId, "excessToShip");
  const done = expireModifiers(state, ["endOfAttack"]);
  const resolvedAttacks =
    attack.immediate || (done.resolvedAttacks.includes(attackKey(done, attack.enemyId, attack.seat)) && !countsEachAttack(done, attack.enemyId)) ? done.resolvedAttacks : [...done.resolvedAttacks, attackKey(done, attack.enemyId, attack.seat)];
  // The shadow cards an attack outside the combat phase was dealt are discarded once it resolves
  // (faq.enemy-attacks-outside-combat).
  // The events it announces answer after the shadow card is gone, so they carry whether it had no effect (18022:A:1).
  const blank = shadowBlankOf(done, attack.enemyId, ctx);
  const cleared = attack.immediate && done.phase !== "Combat" ? discardShadowOf(done, attack.enemyId) : done;
  // "After an attack in which ~ defends resolves", "After a non-unique enemy attacks you": the attack is over.
  const defender = attack.defenderId && !attack.undefended ? { other: attack.defenderId } : {};
  const announced = queueEvent(announceHurt(announceDestroyed(cleared, attack, ctx), attack), { trigger: "attackResolved", seat: attack.seat, cardId: attack.enemyId, ...defender, ...(blank ? { shadowBlank: true as const } : {}) });
  // An immediate attack leaves resolvedAttacks alone (it does not use up the enemy's attack). A game with a card that asks whether an enemy attacked this phase notes it for the phase it was made in (attackedThisPhase); every other game's state stays as it was.
  const noted = attack.immediate && gameReads(done, ctx, '"kind":"attackedThisPhase"') ? { immediateAttacks: noteImmediate(done, attack.enemyId) } : {};
  const ended: ScenarioState = { ...announced, pendingAttack: null, window: null, resolvedAttacks, ...noted };
  // A shadow card that attacks the defending player (Wolf Rider) attacks once this attack's own "after" instructions have run, and the
  // shadow cards that follow it once its attack has ended (startShadowAttack carries the rest of the list onto its attack).
  // Pillage X (The Hunt for the Dreadnaught, families/sea/pillage.ts) is the last thing an attack leaves.
  const pillage = pillageAfter(state, attack.enemyId, ctx);
  const base = troll ? [...(attack.after ?? []), ...troll.instructions] : (attack.after ?? []);
  const after = pillage ? [...base, pillage] : base;
  const waiting = attack.shadowAttackers ?? [];
  if (after.length === 0 && waiting.length > 0) return startShadowAttack(ended, attack.seat, waiting, ctx, steps) ?? ended;
  if (after.length === 0) return ended;
  // The attack's own state decides where it was made from: an enemy that attacked from the staging area without being flagged is `fromStaging`.
  if (!attackHere(state, attack.enemyId)) return waiting.length > 0 ? (startShadowAttack(ended, attack.seat, waiting, ctx, steps) ?? ended) : ended;
  // Only the effect that searches the deck for another copy of a destroyed ally (DiscardCopiesFromDeck of "other", 10137:A:2) reads the ally the attack destroyed.
  const destroyedAlly = after.some((one) => one.verb === "DiscardCopiesFromDeck" && one.of === "other") ? destroyedAllyOf(state, attack, ctx) : undefined;
  // Only an effect that reanimates the character the attack destroyed (Unholy Crypt, 101161:A:2) reads it.
  const destroyedCharacter = after.some((one) => one.verb === "Reanimate" && one.from === "destroyed") ? destroyedByAttack(state, attack, ctx)[0] : undefined;
  return pushEffectFrame(
    ended,
    {
      frame: "shadow",
      sourceId: attack.enemyId,
      actor: attack.seat,
      peril: false,
      effectId: `${attack.enemyId}:afterAttack`,
      instructions: waiting.length > 0 ? [...after, { verb: "StartShadowAttack", attackers: [...waiting] }] : after,
      cancel: null,
      blockCancel: null,
      // An attack that sends its excess damage on (excessToShip) leaves that damage (0 when there was none) for the effect; X is the characters it destroyed.
      ...(sendsExcess ? { excess: attack.defense?.excess ?? 0 } : {}),
      ...(attack.struck != null ? { struck: attack.struck } : {}),
      ...(destroyed > 0 ? { x: destroyed } : {}),
      // `other`: the defending character, or the hero an undefended attack landed on ("the hero damaged by this attack", 900209:A:2).
      ...(afterTarget(attack) ? { other: afterTarget(attack) } : {}),
      ...(destroyedAlly ? { destroyedAlly } : {}),
      ...(destroyedCharacter ? { destroyedCharacter } : {}),
      ...(attack.defense?.landed ? { dealt: attack.defense.landed } : {}),
      ...(attack.afterCause ?? troll?.cause ? { cause: (attack.afterCause ?? troll?.cause)! } : {}),
    },
    steps,
  );
}

// The first ally the attack destroyed (the first of them when several).
function destroyedAllyOf(state: ScenarioState, attack: PendingAttack, ctx: ReduceContext): string | undefined {
  return destroyedByAttack(state, attack, ctx).find((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "ally");
}

// The character an attack that ended was made against: its defender, or the hero an undefended attack's damage was assigned to.
function afterTarget(attack: PendingAttack): string | undefined {
  return attack.undefended || !attack.defenderId ? attack.heroId : attack.defenderId;
}
