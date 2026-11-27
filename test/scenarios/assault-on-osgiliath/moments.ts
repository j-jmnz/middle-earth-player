import type { ScenarioState } from "../../../src/rules/core/state.ts";
import type { ReduceContext } from "../../../src/rules/engine/reduce.ts";
import { stepsByIntent, type PlayedGame } from "../../harness/game-kit.ts";
import { TOWER } from "../../../src/rules/families/pelargir/ruined-tower.ts";
import { controlledIds, UNIQUE } from "./game.ts";

// Test helper. The moments of a played Assault on Osgiliath game that its goldens and its seed finder name, read from the states between the intents (`trail`): each is the index of the intent that made it, so a check asserts the
// intent exactly and the table can be opened `--at` that many intents. `before(i)` is the state the intent i met, `trail[i]` the state it left.
export type Moment = { kind: "taken" | "lostUndefended" | "lostTravel" | "lostDestroyed" | "shadowReturn" | "lostOther" | "gate" | "twoActive" | "split" | "siege" | "battle"; at: number; code: string; id: string };

const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
const seats = (state: ScenarioState) => state.seats;
/** The codes of the locations the players control, each listed once for each copy. */
export const controlledCodes = (state: ScenarioState): string[] => controlledIds(state).map((id) => codeOf(state, id));
/** The code of the quest's second active location. */
export const secondActive = (state: ScenarioState): string => codeOf(state, state.secondActiveLocation);
/** The Siege or Battle location that is active (West Quarter 06100 gives Siege, East Quarter 06101 Battle), or "". */
export const questKeyword = (state: ScenarioState): "" | "siege" | "battle" => {
  const active = [codeOf(state, state.activeLocation), codeOf(state, state.secondActiveLocation)];
  return active.includes("06100") ? "siege" : active.includes("06101") ? "battle" : "";
};
const heroCount = (state: ScenarioState): number => seats(state).reduce((sum, seat) => sum + seat.heroes.length, 0);

export function momentsOf(played: PlayedGame): Moment[] {
  const trail = played.trail ?? [];
  const found: Moment[] = [];
  trail.forEach((after, at) => {
    const before = at === 0 ? played.kept : (trail[at - 1] as ScenarioState);
    const intent = played.intents[at];
    const was = new Set(controlledIds(before));
    const now = new Set(controlledIds(after));
    for (const id of now) if (!was.has(id)) found.push({ kind: "taken", at, code: codeOf(after, id), id });
    for (const id of was) {
      if (now.has(id)) continue;
      const code = codeOf(before, id);
      const kind = intent?.type === "Undefended" ? "lostUndefended" : intent?.type === "Travel" ? "lostTravel" : heroCount(after) < heroCount(before) ? "lostDestroyed" : "lostOther";
      found.push({ kind, at, code, id });
    }
    if (intent?.type === "Trigger" && intent.effectId === "06096:action:1") found.push({ kind: "gate", at, code: "06096", id: intent.cardId });
    if (!before.secondActiveLocation && after.secondActiveLocation) found.push({ kind: "twoActive", at, code: secondActive(after), id: after.secondActiveLocation });
    if (intent?.type === "Choose" && intent.optionId.startsWith("split:")) found.push({ kind: "split", at, code: TOWER, id: after.secondActiveLocation ?? before.secondActiveLocation ?? "" });
    if (questKeyword(before) === "" && questKeyword(after) !== "") found.push({ kind: questKeyword(after) as "siege" | "battle", at, code: questKeyword(after) === "siege" ? "06100" : "06101", id: (questKeyword(after) === "siege" ? [after.activeLocation, after.secondActiveLocation].find((id) => codeOf(after, id) === "06100") : [after.activeLocation, after.secondActiveLocation].find((id) => codeOf(after, id) === "06101")) ?? "" });
  });
  return found;
}

export const isUnique = (code: string): boolean => (UNIQUE as readonly string[]).includes(code);

// The engine steps of each intent come from the play itself (game-kit.ts, `stepsByIntent`), never from a second replay.
export { stepsByIntent };

/** The shadow cards whose Shadow line returns a location when the attack destroys a character (West Quarter, East Quarter, Pinned Down). */
export const RETURNING_SHADOWS: readonly string[] = ["06100", "06101", "06104"];

/** The intents in which one of those shadow cards was revealed on an attack that destroyed a character and a location the players control left their area (the controller returned it). */
export function shadowReturns(played: PlayedGame, ctx: ReduceContext): Moment[] {
  const steps = stepsByIntent(played, ctx);
  const trail = played.trail ?? [];
  const found: Moment[] = [];
  steps.forEach((list, at) => {
    const before = at === 0 ? played.kept : (trail[at - 1] as ScenarioState);
    const after = trail[at] as ScenarioState;
    const shadow = list.find((step) => step.kind === "push" && step.frame === "shadow" && RETURNING_SHADOWS.includes(codeOf(after, step.cardId)));
    const killed = list.some((step) => step.kind === "destroy" && before.cards[step.targetId]?.zone === "heroes");
    if (!shadow || !killed) return;
    const was = controlledIds(before);
    const now = new Set(controlledIds(after));
    for (const id of was) if (!now.has(id)) found.push({ kind: "shadowReturn", at, code: codeOf(before, id), id });
  });
  return found;
}
