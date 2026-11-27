// Rules: ats.captain-enemies, rr.damage (data/rules/entries.json); ledger lines 06147:A:3, 06148:A:1, 06153:A:2.
// What the intent of The Morgul Vale did that no engine step tells by itself, kept with the round's steps the table holds: the count To the Tower reaches after each placement or removal, the Captain whose damage a Morgul Bodyguard took, and the damage the Nazgûl's cut reduced. The table
// writes it on its own copy of each step, as it does for the control of Osgiliath locations (osgiliath-steps.ts), and the banner and the log word it. Nothing the engine returns, the save or the step log changes. Empty in any other scenario.
import type { Cause } from "../../../rules/core/cause.ts";
import type { EngineStep, ScenarioState } from "../../../rules/engine/reduce.ts";

import { bodyguardTookWords, cutWords, murzagEngagesWords, returnsWords, murzagRevealsWords, switchEngagesWords, towerStepWords } from "../../words/scenarios/against-the-shadow/vale.ts";

const SCENARIO = "the-morgul-vale";
const TOWER = "06147";
const BODYGUARD = "06148";
const NAZGUL = "06153";
const MURZAG = "06151";
const CAPTAINS: ReadonlySet<string> = new Set([MURZAG, "06152", NAZGUL]);
/** What a step carries: the tokens on To the Tower after it, the Captain a Bodyguard took damage for, or that the Nazgûl's cut reduced the damage. */
// `by`: Murzag, whose Forced effect revealed the card or engaged the enemy; `who`: the player whose choice placed the tokens (two players only); `returns`: the engine's step of an enemy that went back to the staging area, by the shadow card `via` or by the Forced effect of the card `via`; `quiet`: a damage step of 0 the Nazgûl's cut left, which the strike's "No damage" already says.
export type ValeNote = { who?: number; returns?: { via: string; shadow: boolean }; tower?: number; for?: string; cut?: true; by?: string; quiet?: true; switched?: true };
export type ValeStep = EngineStep & { vale?: ValeNote };

/** The steps with each progress step on To the Tower stamped with the count it leaves, and each damage step a Bodyguard or the Nazgûl took after a player's strike stamped with why. The same steps in another scenario. */
export function stampVale(steps: readonly EngineStep[], before: ScenarioState): readonly EngineStep[] {
  if (before.scenarioId !== SCENARIO || steps.length === 0) return steps;
  const tower = Object.values(before.cards).find((card) => card.code === TOWER && card.zone === "staging");
  let now = tower?.progress ?? 0;
  let strike: Extract<EngineStep, { kind: "strike" }> | null = null;
  // The Murzag whose attack was the last one in the intent (the attack in progress when it began, or one it began): the cards revealed and the enemy engaged after it are his Forced effect's (06151:A:1), until the next attack begins.
  let murzag: string | null = before.pendingAttack != null && before.cards[before.pendingAttack.enemyId]?.code === MURZAG ? before.pendingAttack.enemyId : null;
  let revealed = false;
  let changed = false;
  // The effect record the open choice window belongs to.
  const frame = before.window?.kind === "choose" ? before.stack[before.stack.length - 1]?.data : undefined;
  const asked = frame?.kind === "effect" ? frame.effectId : null;
  const stamped = steps.map((step): EngineStep => {
    if (step.kind === "strike" && step.side === "player") strike = step;
    if (step.kind === "attack" && step.side === "enemy") {
      murzag = before.cards[step.enemyId]?.code === MURZAG ? step.enemyId : null;
      revealed = false;
    }
    // The enemy of the attack in progress engages another player: a Morgul Bodyguard's shadow effect (06148:A:2) ended the attack and began a new one on him.
    if (step.kind === "engage" && before.pendingAttack != null && step.enemyId === before.pendingAttack.enemyId && step.seat !== before.pendingAttack.seat) {
      changed = true;
      return { ...step, vale: { switched: true } } as ValeStep;
    }
    if (murzag && step.kind === "engage" && before.cards[step.enemyId]?.zone !== "engaged") {
      changed = true;
      return { ...step, vale: { by: murzag } } as ValeStep;
    }
    if (murzag && step.kind === "reveal" && !revealed) {
      revealed = true;
      changed = true;
      // The enemy he reveals is told in its engagement line, so the reveal says nothing of its own.
      const engaged = steps.some((later) => later.kind === "engage" && later.enemyId === step.cardId);
      return { ...step, vale: { by: murzag, ...(engaged ? { quiet: true as const } : {}) } } as ValeStep;
    }
    // An enemy the engine returned to the staging area: the card whose printed line did it is told, a shadow card of the enemy's own or Morgul Vale at the end of the round.
    if (step.kind === "returnToStaging" && "line" in step.cause) {
      const code = step.cause.line.split(":")[0];
      const enemy = before.cards[step.enemyId];
      const own = [enemy?.shadowId, ...(enemy?.extraShadowIds ?? [])].find((id) => id != null && before.cards[id]?.code === code);
      const via = own ?? Object.values(before.cards).find((card) => card.code === code && card.zone !== "deck" && card.zone !== "removed")?.id;
      if (via) {
        changed = true;
        return { ...step, vale: { returns: { via, shadow: own != null } } } as ValeStep;
      }
    }
    if (step.kind === "progress" && tower && step.targetId === tower.id) {
      now = Math.max(0, now + step.amount);
      changed = true;
      // The tokens a player's own choice placed name the player: a choice window of a seat was open when the intent began, and this step is the effect record that window belongs to placing them (not another card's token in the same intent).
      const chose = before.window?.kind === "choose" && before.seatCount > 1 && step.amount > 0 && "effect" in step.cause && step.cause.effect === asked ? { who: before.window.seat } : {};
      return { ...step, vale: { tower: now, ...chose } } as ValeStep;
    }
    if (step.kind === "damage" && strike && step.amount === 0 && before.cards[step.targetId]?.code === NAZGUL && strike.targetId === step.targetId) {
      changed = true;
      return { ...step, vale: { quiet: true } } as ValeStep;
    }
    if (step.kind === "damage" && strike && step.amount > 0) {
      const code = before.cards[step.targetId]?.code;
      const hit = before.cards[strike.targetId]?.code ?? "";
      if (code === BODYGUARD && CAPTAINS.has(hit)) {
        changed = true;
        return { ...step, vale: { for: strike.targetId } } as ValeStep;
      }
      const strength = Math.max(0, strike.attack - strike.defense);
      if (code === NAZGUL && strike.targetId === step.targetId && strength > step.amount) {
        changed = true;
        return { ...step, vale: { cut: true } } as ValeStep;
      }
    }
    return step;
  });
  return changed ? stamped : steps;
}

/** The note a kept step carries, or null. */
export const valeOf = (step: EngineStep): ValeNote | null => ("vale" in step && step.vale != null ? (step.vale as ValeNote) : null);

/** Whether a kept step says nothing of its own: the damage of 0 the Nazgûl's cut leaves after a strike that "No damage" has told. */
export const valeQuiet = (step: EngineStep): boolean => valeOf(step)?.quiet === true;

/** The banner's and the log's words for a stamped step, or null for any other (the caller's own words stand). `from`: the card whose effect did it, for the banner only. */
export function valeStepWords(step: EngineStep, card: (id: string) => string, from?: string | null, seats?: { count: number }): string | null {
  const note = valeOf(step);
  if (!note) return null;
  if (step.kind === "reveal" && note.by != null) return murzagRevealsWords(card(note.by), card(step.cardId));
  if (step.kind === "engage" && note.switched === true) return switchEngagesWords(card(step.enemyId), seats && seats.count > 1 ? `Player ${step.seat + 1}` : "you");
  if (step.kind === "engage" && note.by != null) return murzagEngagesWords(card(note.by), card(step.enemyId), seats && seats.count > 1 ? `Player ${step.seat + 1}` : "you");
  if (step.kind === "progress" && note.tower != null) return `${towerStepWords(step.amount, card(step.targetId), note.tower, note.who != null ? `Player ${note.who + 1}` : undefined)}${from ? ` (${from})` : ""}`;
  if (step.kind === "damage" && note.for != null) return bodyguardTookWords(step.amount, card(step.targetId), card(note.for));
  if (step.kind === "returnToStaging" && note.returns != null) return returnsWords(card(step.enemyId), card(note.returns.via), note.returns.shadow);
  if (step.kind === "damage" && note.cut === true) return cutWords(card(step.targetId));
  return null;
}

/** The card whose effect placed or removed tokens, for the banner: the card in play whose printed line caused the step. Null for a rule's cause and in another scenario. */
export function valeFrom(after: ScenarioState, cause: Cause, card: (id: string) => string): string | null {
  if (after.scenarioId !== SCENARIO || !("line" in cause)) return null;
  const code = cause.line.split(":")[0];
  const source = Object.values(after.cards).find((entry) => entry.code === code && entry.zone !== "deck" && entry.zone !== "removed");
  return source ? card(source.id) : null;
}
