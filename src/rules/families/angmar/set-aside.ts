// Rules: rr.campaign-pool (data/rules/entries.json). The two steps the boons and the burdens share: which of a list of one-copy cards the game can still hand out, and the copy it hands out (the set-aside one, or one from the supply).
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";

/** The codes of `codes` that are loaded and not in the game outside the set-aside zone: each has one copy, so one already attached (a pool card of an earlier scenario) is not handed out twice. A game that loaded none has none free. */
export function freeCodes(state: ScenarioState, codes: readonly string[], ctx: ReduceContext): string[] {
  const aside = new Set(state.setAside);
  return codes.filter((code) => ctx.cards.has(code) && Object.values(state.cards).every((card) => card.code !== code || aside.has(card.id)));
}

/** The set-aside copy of `code`, or a copy from the supply put into the set-aside zone faceup (the game dealt none). */
export function takeOrSpawnSetAside(state: ScenarioState, code: string): { state: ScenarioState; id: string } {
  const copy = state.setAside.find((id) => state.cards[id]?.code === code);
  if (copy) return { state, id: copy };
  return spawn(state, code, { zone: "setAside" }, "up");
}
