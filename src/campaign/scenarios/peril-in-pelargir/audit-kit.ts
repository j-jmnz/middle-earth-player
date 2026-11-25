// The tables and helpers the audit files of Peril in Pelargir share (card-audit).

import { expect } from "vitest";
import type { Effect } from "../../../catalog/boundary.ts";
import { updateCard, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import { drive, engagedCodes, fightEnemy, finish, type Run, idOf, legalIntents, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

import { SCROLL, withScroll } from "../../../../test/scenarios/peril-in-pelargir/scroll.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";

const S = "peril-in-pelargir";
export type Es = readonly Effect[];
export const tbl = (effects: Es, layout: Layout = {}, extra: readonly string[] = []): LayoutTable => tableFromLayout(S, layout, { effects, extra });
export const scrolled = (effects: Es, layout: Layout = {}, host = "dh1"): LayoutTable => withScroll(tbl(effects, layout), host);
export const hasScroll = (state: ScenarioState, hostId: string): boolean => (state.cards[hostId]?.attachments ?? []).some((id) => state.cards[id]?.code === "05019");
export const threatOf = (state: ScenarioState, seat = 0): number | undefined => state.seats[seat]?.threat;
// The Scroll on an enemy, as the engine leaves it: zone attached, claimed, no controller.
export const scrollOn = (table: LayoutTable, hostCode: string): LayoutTable => {
  const spawned = spawn(table.state, SCROLL, { zone: "attached" }, "up");
  const attached = attachTo(spawned.state, spawned.id, idOf(spawned.state, hostCode));
  return { ...table, state: syncConstants(updateCard(attached, spawned.id, { claimed: true, controller: null, face: "up" }), table.ctx) };
};
export const scrollAction = (state: ScenarioState, table: LayoutTable) => legalIntents(state, table.ctx).find((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === "05019");

export const raised = (seat: number): GameEvent => ({ trigger: "threatRaised", seat }) as GameEvent;
export const shadowFight = (effects: Es, shadow: string, layout: Layout = {}, options: { undefended?: boolean; enemy?: string; scrollOn?: string; seats?: 1 | 2 } = {}) =>
  fightEnemy((l) => (options.scrollOn ? scrolled(effects, l, options.scrollOn) : tbl(effects, l)), shadow, options.enemy ?? "05043", { seats: options.seats ?? (1 as const), ...layout }, { undefended: options.undefended });
export const dmg = (out: ReturnType<typeof shadowFight>, id: string): number => out.run.state.cards[id]?.damage ?? 0;
export const LOW = [10, 10] as const;
export const handOf = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.zone === "hand").length;
export const resourcesOn = (state: ScenarioState, id: string): number => state.cards[id]?.resources ?? 0;
// The first player's seat engages the enemy from the optional engagement window (a threat of 45 keeps the check from deciding it).
export const engage = (effects: Es, enemy: string, layout: Layout = {}) => {
  const t = tbl(effects, { phase: "Encounter", staging: [enemy], threat: [45, 45], ...layout });
  const run = finish(send(start(t.state), { type: "Engage", enemyId: idOf(t.state, enemy) }, t.ctx), t.ctx);
  expect(engagedCodes(run.state), `${enemy} engaged by choice`).toEqual([enemy]);
  return { t, state: run.state };
};
// The heroes commit to the quest and every window is passed until the quest is over (a won game, or the travel phase).
export const quested = (table: LayoutTable, heroes: readonly string[] = [table.hero, table.hero2]): Run => drive(table, send(start(table.state), { type: "Commit", cardIds: heroes }, table.ctx), (state) => state.phase !== "Quest" || state.stageCleared);
export const quays = { stage: "05067" };
