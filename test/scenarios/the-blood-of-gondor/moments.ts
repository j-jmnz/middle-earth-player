import type { ScenarioState } from "../../../src/rules/core/state.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import type { ReduceContext } from "../../../src/rules/engine/reduce.ts";
import { hiddenIds } from "../../../src/rules/families/pelargir/hidden.ts";
import { stepsByIntent, type PlayedGame } from "../../harness/game-kit.ts";
import { ALCARON, CAPTURED, FARAMIR } from "./game.ts";

// Test helper. The moments of a played Blood of Gondor game that its goldens and its seed finder name, read from the states between the intents (`trail`): each is the index of the intent that made it, so a check asserts the
// intent exactly and the table can be opened `--at` that many intents. `before(i)` is the state the intent i met, `trail[i]` the state it left. A moment names a hidden card only by its code after it was turned (a card still
// facedown is never named).
export type Kind =
  | "takeQuest" | "takeChoice" | "takeTravel" | "takeShadow" | "takeEngaged" | "takeOther" | "takeRevealed"
  | "turnChoice" | "turnFive" | "turnCaptured" | "turnUruk" | "turnShadow" | "turnLying" | "discarded" | "turnFaramir"
  | "captured" | "faramir" | "alcaron" | "control" | "crossroads" | "conflict" | "discardWoods";
export type Moment = { kind: Kind; at: number; seat: number; codes: string[]; ids?: string[] };

export const codeOf = (state: ScenarioState, id: string | null | undefined): string => state.cards[id ?? ""]?.code ?? "";
export const beforeOf = (played: Pick<PlayedGame, "kept" | "trail">, at: number): ScenarioState => (at === 0 ? played.kept : (played.trail?.[at - 1] as ScenarioState));
/** The seats' hidden counts. */
export const counts = (state: ScenarioState): number[] => state.seats.map((_, seat) => hiddenIds(state, seat).length);
/** The shadow cards (by code) revealed in the steps of an intent. */
export const shadowsIn = (steps: readonly EngineStep[], state: ScenarioState): string[] => steps.filter((step) => step.kind === "push" && step.frame === "shadow").map((step) => codeOf(state, (step as { cardId: string | null }).cardId));
/** The codes of the cards pushed as a frame (a reveal, a When Revealed) in the steps. */
export const pushedIn = (steps: readonly EngineStep[], state: ScenarioState, frame: string): string[] => steps.filter((step) => step.kind === "push" && step.frame === frame).map((step) => codeOf(state, (step as { cardId: string | null }).cardId));

// The engine steps of each intent come from the play itself (game-kit.ts, `stepsByIntent`), never from a second replay.
export { stepsByIntent };

const TAKING_SHADOWS: readonly string[] = ["06122", "06131"];
const TURNING_SHADOWS: readonly string[] = ["06121", "06130"];

const MOMENTS = new WeakMap<PlayedGame, Moment[]>();
export function momentsOf(played: PlayedGame, ctx: ReduceContext): Moment[] {
  const known = MOMENTS.get(played);
  if (known) return known;
  const trail = played.trail ?? [];
  const steps = stepsByIntent(played, ctx);
  const found: Moment[] = [];
  // The first player token passed and the control of Faramir and Lord Alcaron is still to follow: the Forced effects of the pass differ, so the new first player is asked their order (rr.forced) before the control moves.
  let owed = false;
  trail.forEach((after, at) => {
    const before = beforeOf(played, at);
    const intent = played.intents[at];
    const list = steps[at] ?? [];
    const now = counts(after);
    const shadows = shadowsIn(list, after);
    const stage = codeOf(after, after.questStage);
    for (const seat of now.keys()) {
      const had = hiddenIds(before, seat);
      const has = new Set(hiddenIds(after, seat));
      const gone = had.filter((id) => !has.has(id));
      const gained = [...has].filter((id) => !had.includes(id));
      const codes = gone.map((id) => codeOf(after, id));
      if (gained.length > 0) {
        const kind: Kind = intent?.type === "Choose" && intent.optionId === "take" ? "takeChoice" : intent?.type === "Travel" ? "takeTravel" : shadows.some((code) => TAKING_SHADOWS.includes(code)) ? "takeShadow" : list.some((step) => step.kind === "engage") ? "takeEngaged" : pushedIn(list, after, "whenRevealed").includes("06130") ? "takeRevealed" : before.mode === "planning" && intent?.type === "Pass" ? "takeQuest" : "takeOther";
        found.push({ kind, at, seat, codes: [], ids: gained });
      }
      if (gone.length === 0) continue;
      const via: Kind =
        intent?.type === "Choose" && intent.optionId === "turn" ? "turnChoice"
        : stage === CAPTURED && codeOf(before, before.questStage) !== CAPTURED ? "turnCaptured"
        : intent?.type === "Trigger" && intent.effectId === `${FARAMIR}:action:1` || (intent?.type === "Choose" && intent.optionId.startsWith("seat:")) ? "turnFaramir"
        : shadows.some((code) => TURNING_SHADOWS.includes(code)) ? "turnShadow"
        : pushedIn(list, after, "forced").includes("06128") ? "discardWoods"
        : pushedIn(list, after, "forced").includes("06121") ? "turnUruk"
        : pushedIn(list, after, "reveal").includes("06129") ? "turnLying"
        : stage === CAPTURED ? "turnFive"
        : "discarded";
      found.push({ kind: via, at, seat, codes, ids: gone });
    }
    if (stage === CAPTURED && codeOf(before, before.questStage) !== CAPTURED) {
      found.push({ kind: "captured", at, seat: -1, codes: Object.values(after.cards).filter((card) => card.zone === "captive").map((card) => card.code) });
    }
    if (intent?.type === "Trigger" && intent.effectId === `${FARAMIR}:action:1`) found.push({ kind: "faramir", at, seat: after.activeSeat, codes: [] });
    if (intent?.type === "Trigger" && intent.effectId === `${ALCARON}:action:1`) found.push({ kind: "alcaron", at, seat: after.activeSeat, codes: [] });
    const control = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.code === FARAMIR || card.code === ALCARON).map((card) => `${card.code}:${card.controller ?? "-"}:${card.zone}`).join(",");
    if (before.firstPlayer !== after.firstPlayer) owed = true;
    if (owed && after.window?.kind !== "choose") {
      owed = false;
      found.push({ kind: "control", at, seat: after.firstPlayer, codes: [control(after)] });
    }
    const inPlay = (state: ScenarioState) => Object.values(state.cards).some((card) => card.code === "06123" && (card.zone === "staging" || state.activeLocation === card.id));
    if (stage === CAPTURED && inPlay(after) && !(codeOf(before, before.questStage) === CAPTURED && inPlay(before))) found.push({ kind: "crossroads", at, seat: -1, codes: [] });
    if (pushedIn(list, after, "whenRevealed").includes("06131") || pushedIn(list, after, "reveal").includes("06131")) found.push({ kind: "conflict", at, seat: -1, codes: [] });
  });
  MOMENTS.set(played, found);
  return found;
}
