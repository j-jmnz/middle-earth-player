import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { reduce, type ReduceContext } from "../../../src/rules/engine/reduce.ts";
import type { PlayedGame } from "../../harness/game-kit.ts";
import { ALCARON, BODYGUARD, POWER, BRIDGE, CAPTAINS, MURZAG, NAZGUL, TOWER } from "./game.ts";

// Test helper. The moments of a played Morgul Vale game that its goldens and its seed finder name, read from the engine steps and the states between the intents (`trail`): each is the index of the intent that made it, so a
// check asserts the intent exactly and the table can be opened `--at` that many intents. `before(i)` is the state the intent i met, `trail[i]` the state it left.
export type Kind =
  | "captain" | "advance" | "won" | "stageProgress" | "token" | "lost" | "shield" | "switch" | "murzag" | "alcaron" | "cap" | "bridge" | "power" | "revealAttack" | "choice" | "removed" | "returned";
export type Moment = { kind: Kind; at: number; seat: number; codes: string[]; ids?: string[] };

export const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
export const beforeOf = (played: Pick<PlayedGame, "kept" | "trail">, at: number): ScenarioState => (at === 0 ? played.kept : (played.trail?.[at - 1] as ScenarioState));
/** The progress tokens on To the Tower in a state. */
export const towerOf = (state: ScenarioState): number => Object.values(state.cards).find((card) => card.code === TOWER)?.progress ?? 0;
/** The id of the first card with a code. */
export const idOfCode = (state: ScenarioState, code: string): string | undefined => Object.values(state.cards).find((card) => card.code === code)?.id;
/** The code of the effect that caused a step, "rule" for a rule's. */
export const effectOf = (step: EngineStep): string => {
  const cause = (step as { cause?: { effect?: string; rule?: string } }).cause;
  return cause?.effect ?? (cause?.rule ? `rule:${cause.rule}` : "");
};

/** The engine steps of each intent of the game (the game replayed: a played game keeps its steps in one list). */
const STEPS = new WeakMap<PlayedGame, (readonly EngineStep[])[]>();
export function stepsByIntent(played: PlayedGame, ctx: ReduceContext): (readonly EngineStep[])[] {
  const known = STEPS.get(played);
  if (known) return known;
  let state = played.kept;
  const steps = played.intents.map((intent) => {
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    return result.steps;
  });
  STEPS.set(played, steps);
  return steps;
}

const MOMENTS = new WeakMap<PlayedGame, Moment[]>();
export function momentsOf(played: PlayedGame, ctx: ReduceContext): Moment[] {
  const known = MOMENTS.get(played);
  if (known) return known;
  const trail = played.trail ?? [];
  const steps = stepsByIntent(played, ctx);
  const found: Moment[] = [];
  const attacks = new Map<string, number>();
  const revealedEnemies = new Map<string, number>();
  trail.forEach((after, at) => {
    const before = beforeOf(played, at);
    const list = steps[at] ?? [];
    const stage = codeOf(after, after.questStage);
    const was = codeOf(before, before.questStage);
    const tower = idOfCode(after, TOWER);
    const place = (kind: Kind, seat: number, codes: string[], ids?: string[]) => found.push({ kind, at, seat, codes, ...(ids ? { ids } : {}) });
    list.forEach((step, index) => {
      if (step.kind === "destroy" && !step.under && CAPTAINS.includes(codeOf(after, step.targetId))) place("captain", -1, [codeOf(after, step.targetId)], [step.targetId]);
      if (step.kind === "progress" && step.targetId === tower && step.amount > 0) place("token", step.seat ?? -1, [effectOf(step), String(step.amount)], [step.targetId]);
      if (step.kind === "progress" && step.amount > 0 && step.targetId === before.questStage && stage === was) place("stageProgress", -1, [was, String(step.amount)]);
      // A player's attack on a shielded Captain: the damage lands on a Morgul Bodyguard.
      if (step.kind === "damage" && codeOf(after, step.targetId) === BODYGUARD) {
        const strike = list.slice(0, index).reverse().find((item) => item.kind === "strike" && item.side === "player");
        if (strike?.kind === "strike" && CAPTAINS.includes(codeOf(after, strike.enemyId))) place("shield", -1, [codeOf(after, strike.enemyId), String(step.amount)], [strike.enemyId, step.targetId]);
      }
      if (step.kind === "strike" && step.side === "player" && codeOf(after, step.enemyId) === NAZGUL) {
        const dealt = list.slice(index + 1).find((item) => item.kind === "damage" && item.targetId === step.enemyId);
        if (dealt?.kind === "damage") place("cap", -1, [String(step.attack - step.defense), String(dealt.amount)], [step.enemyId]);
      }
      // A Morgul Bodyguard's shadow card in a two-handed game: the attacking enemy engages the other player, who is attacked in turn.
      if (step.kind === "push" && step.frame === "shadow" && codeOf(after, step.cardId) === BODYGUARD) {
        const engaged = list.slice(index).find((item) => item.kind === "engage");
        if (engaged?.kind === "engage" && engaged.seat !== before.activeSeat) place("switch", engaged.seat, [codeOf(after, engaged.enemyId)], [engaged.enemyId]);
      }
      // Murzag's Forced line: the top card of the encounter deck revealed in full, engaging the player if it is an enemy.
      if (step.kind === "push" && step.frame === "forced" && codeOf(after, step.cardId) === MURZAG) {
        const revealed = list.slice(index).find((item) => item.kind === "reveal");
        if (revealed?.kind === "reveal") {
          const engaged = list.slice(index).find((item) => item.kind === "engage" && item.enemyId === revealed.cardId);
          place("murzag", revealed.seat, [codeOf(after, revealed.cardId), engaged ? "engaged" : "kept"], [revealed.cardId]);
          if (engaged) revealedEnemies.set(revealed.cardId, before.round);
        }
      }
      // The enemy that Murzag's reveal engaged attacks in the same round.
      if (step.kind === "attack" && step.side === "enemy" && revealedEnemies.get(step.enemyId) === before.round) {
        place("revealAttack", step.seat, [codeOf(after, step.enemyId)], [step.enemyId]);
        revealedEnemies.delete(step.enemyId);
      }
      // Lord Alcaron's second attack of a round (his Forced line, after a shadow card with no shadow effect).
      if (step.kind === "attack" && step.side === "enemy" && codeOf(after, step.enemyId) === ALCARON) {
        const key = `${before.round}:${step.enemyId}`;
        attacks.set(key, (attacks.get(key) ?? 0) + 1);
        if (attacks.get(key) === 2) place("alcaron", step.seat, [], [step.enemyId]);
      }
    });
    // A choice of one of the scenario's cards: Sorcerer (place, undefended), Fog (tokens, reveal), Malice (discard, token), Morgul Road (remove, damage).
    const intent = played.intents[at];
    if (intent?.type === "Choose" && before.window?.kind === "choose") {
      const options = before.window.options;
      const owner = options.includes("place") ? "06149" : options.includes("tokens") ? "06157" : options.includes("discard") ? "06158" : options.includes("remove") ? "06154" : "";
      if (owner) place("choice", before.window.seat, [owner, intent.optionId]);
    }
    if (tower && towerOf(after) < towerOf(before)) place("removed", -1, [String(towerOf(before) - towerOf(after))]);
    if (stage !== was) place("advance", -1, [was, stage]);
    if (after.stageCleared && !before.stageCleared) place("won", -1, [stage]);
    if (after.lost && !before.lost) place("lost", -1, [String(towerOf(after))]);
    if (list.some((step) => step.kind === "quest") && towerOf(before) > 0) {
      const bridge = idOfCode(before, BRIDGE);
      if (bridge && (before.staging.includes(bridge) || before.activeLocation === bridge)) place("bridge", -1, [String(towerOf(before)), before.staging.includes(bridge) ? "staging" : "active"]);
    }
    // The Power of Mordor revealed: the codes are the Captains in the staging area the intent before.
    if (list.some((step) => step.kind === "push" && step.frame === "whenRevealed" && codeOf(after, step.cardId) === POWER)) place("power", -1, before.staging.map((id) => codeOf(before, id)).filter((code) => CAPTAINS.includes(code)));
  });
  MOMENTS.set(played, found);
  return found;
}
