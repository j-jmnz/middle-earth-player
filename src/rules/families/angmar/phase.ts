// Rules: rr.step-3-3, rr.framework-steps, mec108.campaign-mode (data/rules/entries.json); ledger line 09070:A:1. "End the current phase": the verb leaves a mark on the table; once the effect that ran it has finished and the attack it came from has been resolved, the machine (engine/machine.ts, `automatic`)
// reads the mark and carries the round to the end of the phase in progress. Nothing of the phase is played after it: in the quest phase the characters stay exhausted but are no longer committed and the quest is not resolved, in the travel and encounter phases nobody travels or engages
// any more, in the combat phase no attack is made, and every end-of-phase Forced effect resolves as the phase ends (state.ts withMode, windows/triggers.ts crossBoundary).
import { discardShadows } from "../../combat/shadow.ts";
import { flagged, updateCard, withMode, type ModeName, type ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";

/** EndPhase: the phase in progress ends once the running effect has finished. The mark lasts until the phase does. */
export function endPhase(state: ScenarioState, focus: Focus): ScenarioState {
  if (state.modifiers.some((modifier) => modifier.stat === "phaseEnds")) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: focus.sourceId ?? "table", stat: "phaseEnds", amount: 1, until: "endOfPhase" }] };
}

const COMBAT: ReadonlySet<ModeName> = new Set(["combatStart", "combatShadows", "combatActions", "enemyAttacks", "playerAttacks"]);

/** The state with the phase in progress ended, when an EndPhase left its mark and nothing is left to resolve; null when there is no mark. */
export function phaseEnds(state: ScenarioState): ScenarioState | null {
  if (!state.modifiers.some((modifier) => modifier.stat === "phaseEnds")) return null;
  const cleared: ScenarioState = { ...state, modifiers: state.modifiers.filter((modifier) => modifier.stat !== "phaseEnds"), window: null, planningSeat: null };
  const mode = state.mode;
  if (mode === "beginRound" || mode === "resourceGrant" || mode === "resourceActions") return withMode(cleared, "planning");
  if (mode === "planning") return withMode(cleared, "questCommit");
  if (mode === "questCommit" || mode === "staging" || mode === "resolution") {
    // The quest phase's last step is already under way: the phase ends with it.
    if (mode === "resolution" && state.questResolved) return cleared;
    let next: ScenarioState = { ...cleared, revealCursor: null };
    for (const card of Object.values(state.cards)) if (card.committed) next = updateCard(next, card.id, { committed: false });
    return { ...withMode(next, "resolution"), questResolved: true };
  }
  if (mode === "travel") return withMode(cleared, flagged(state, "table", "skipEncounter") ? "combatStart" : "optionalEngage");
  if (mode === "optionalEngage" || mode === "engagement") return withMode({ ...cleared, engagement: null }, "combatStart");
  if (COMBAT.has(mode)) return withMode({ ...discardShadows(cleared), engagement: null, pendingAttack: null }, "refresh");
  if (mode === "refresh") return withMode(cleared, "endRound");
  return cleared;
}
