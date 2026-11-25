// Rules: ats.captain-enemies, rr.damage (data/rules/entries.json); ledger lines 06147:A:3, 06148:A:1, 06153:A:2.
// What the intent of The Morgul Vale did that no engine step tells by itself, kept with the round's steps the table holds: the count To the Tower reaches after each placement or removal, the Captain whose damage a Morgul Bodyguard took, and the damage the Nazgûl's cut reduced. The table
// writes it on its own copy of each step, as it does for the control of Osgiliath locations (osgiliath-steps.ts), and the banner and the log word it. Nothing the engine returns, the save or the step log changes. Empty in any other scenario.
import type { Cause } from "../../../rules/core/cause.ts";
import type { EngineStep, ScenarioState } from "../../../rules/engine/reduce.ts";

import { bodyguardTookWords, cutWords, murzagEngagesWords, murzagRevealsWords, switchEngagesWords, towerStepWords } from "../../words/scenarios/against-the-shadow/vale.ts";

const SCENARIO = "the-morgul-vale";
const TOWER = "06147";
const BODYGUARD = "06148";
const NAZGUL = "06153";
const MURZAG = "06151";
const CAPTAINS: ReadonlySet<string> = new Set([MURZAG, "06152", NAZGUL]);

/** What a step carries: the tokens on To the Tower after it, the Captain a Bodyguard took damage for, or the damage the Nazgûl's cut reduced. */
// `by`: Murzag, whose Forced effect revealed the card or engaged the enemy; `quiet`: a damage step of 0 the Nazgûl's cut left, which the strike's "No damage" already says.
export type ValeNote = { tower?: number; for?: string; cutFrom?: number; by?: string; quiet?: true; switched?: true };
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
    if (step.kind === "progress" && tower && step.targetId === tower.id) {
      now = Math.max(0, now + step.amount);
      changed = true;
      return { ...step, vale: { tower: now } } as ValeStep;
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
        return { ...step, vale: { cutFrom: strength } } as ValeStep;
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
  if (step.kind === "progress" && note.tower != null) return `${towerStepWords(step.amount, card(step.targetId), note.tower)}${from ? ` (${from})` : ""}`;
  if (step.kind === "damage" && note.for != null) return bodyguardTookWords(step.amount, card(step.targetId), card(note.for));
  if (step.kind === "damage" && note.cutFrom != null) return cutWords(card(step.targetId), note.cutFrom);
  return null;
}

/** The card whose effect placed or removed tokens, for the banner: the card in play whose printed line caused the step. Null for a rule's cause and in another scenario. */
export function valeFrom(after: ScenarioState, cause: Cause, card: (id: string) => string): string | null {
  if (after.scenarioId !== SCENARIO || !("line" in cause)) return null;
  const code = cause.line.split(":")[0];
  const source = Object.values(after.cards).find((entry) => entry.code === code && entry.zone !== "deck" && entry.zone !== "removed");
  return source ? card(source.id) : null;
}
