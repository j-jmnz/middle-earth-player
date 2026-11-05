// Rules: rr.the-word-choose, rr.ownership-and-control, rr.step-1-3 (data/rules/entries.json).
//
// The Pick filters the misc family adds (effect-schema-pick.ts): `controlledBy`, `onPicked`, `playerCard`, `maxDefense` and
// `drawn`. Each reads the card itself and what the running effect has picked.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { isPlayerType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

export type MiscPickContext = { seat: number; sourceId: string | null; picked?: readonly string[] };

// The effect's picks: the ones the filter is read with, else the running effect frame's.
function pickedOf(state: ScenarioState, at: MiscPickContext): readonly string[] {
  if (at.picked && at.picked.length > 0) return at.picked;
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.picked ?? []) : [];
}

export function miscPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: MiscPickContext, ctx: ReduceContext): boolean {
  if (spec.controlledBy == null && !spec.nonObjective && !spec.objective && !spec.onPicked && spec.playerCard == null && spec.maxDefense == null && !spec.drawn && spec.maxAttachments == null && !spec.exceptNames) return true;
  const instance = state.cards[id];
  if (!instance) return false;
  if (spec.controlledBy === "picked") {
    const entry = [...pickedOf(state, at)].reverse().find((value) => value.startsWith("seat:"));
    if (entry == null || instance.controller !== Number(entry.slice("seat:".length))) return false;
  }
  if (spec.nonObjective && printedOf(ctx.cards, instance.code).type === "objective") return false;
  if (spec.objective && printedOf(ctx.cards, instance.code).type !== "objective") return false;
  if (spec.controlledBy === "host") {
    const host = at.sourceId ? state.cards[state.cards[at.sourceId]?.host ?? ""] : undefined;
    if (!host || host.controller == null || instance.controller !== host.controller) return false;
  }
  if (spec.onPicked) {
    const card = [...pickedOf(state, at)].reverse().find((value) => value !== "" && !value.startsWith("seat:"));
    if (!card || instance.host !== card) return false;
  }
  if (spec.exceptNames?.includes(printedOf(ctx.cards, instance.code).name)) return false;
  if (spec.maxAttachments != null && instance.attachments.length > spec.maxAttachments) return false;
  if (spec.playerCard != null && spec.playerCard !== isPlayerType(printedOf(ctx.cards, instance.code))) return false;
  if (spec.maxDefense != null && modifiedStat(state, instance, "defense", ctx.cards) > spec.maxDefense) return false;
  if (spec.drawn && !(instance.zone === "hand" && instance.controller != null && (state.resourceDrawn?.[instance.controller] ?? []).includes(id))) return false;
  return true;
}
