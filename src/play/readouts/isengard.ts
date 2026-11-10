// Rules: mec112.wizardry, rr.player-elimination, rr.resources (data/rules/entries.json); ledger lines 143078:B:2, 143079:B:2, 143046:A:1, 143048:A:2, 143080:B:3.
//
// The numbers of The Road to Isengard's table dials (docs/design-system-table.md, Cards, The Road to Isengard): the resources on stage 1B (the cards revealed on advancing), the damage on stage 2B against the 5 that advance the
// players, each Ent of Fangorn's resources against the 3 that give a player control of it, Saruman's hit points left (the win gate, while the Staff is on him) and each seat's cards in hand on stage 3B, which warn at 1 and 0. The
// limits are read from the records that use them. The engine decided every number; nothing here changes one. Pure, so a test reads it.
import { useMemo } from "react";

import type { Effect } from "../../catalog/boundary.ts";
import { flagged, inPlay, livingSeats, type CardInstance } from "../../rules/core/state.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { damageLimitWords, entLimitWords, gateWords, handWarning, REVEALS_WORDS } from "../words/scenarios/isengard.ts";

const STAGE_1 = "143078";
const STAGE_2 = "143079";
const STAGE_3 = "143080";
const ENT = "143046";
const SARUMAN = "143047";
const STAFF = "143048";

/** One dial of the top bar: its label, what a screen reader calls it, its number, and what it counts toward. `goal`: the limit is the players' way out (the ring fills in the accent, never warms). */
export type IsengardDial = {
  id: string;
  label: string;
  name: string;
  value: number;
  limit?: number;
  goal?: true;
  limitWords?: string;
  note?: string;
  warn?: { level: "near" | "critical"; words: string };
};

// The number a record's `less` condition on an instruction names, plus 1: "2 less than the resources" (143046:A:1) is the 3 resources that end it, "4 less than the damage" (143079:B:2) the 5 damage that advance.
function reaches(ctx: ReduceContext, code: string, verb: string): number | null {
  for (const effect of effectsOf(ctx, code) as readonly Effect[]) {
    for (const instruction of effect.instructions) {
      if (instruction.verb !== verb) continue;
      const when = "when" in instruction ? instruction.when : undefined;
      if (when?.kind === "less" && typeof when.left === "number") return when.left + 1;
    }
  }
  return null;
}

function currentStage(game: ScenarioState, code: string): CardInstance | undefined {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  return stage?.code === code ? stage : undefined;
}

/** Every dial The Road to Isengard's pieces hold now, in the order the top bar draws them. Empty in any other scenario and before a piece exists. */
export function isengardDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly IsengardDial[] {
  const dials: IsengardDial[] = [];
  const first = currentStage(game, STAGE_1);
  if (first) dials.push({ id: "reveals", label: "Reveals", name: `Resource tokens on ${nameOf(STAGE_1)}`, value: first.resources, note: REVEALS_WORDS });
  const second = currentStage(game, STAGE_2);
  const damageLimit = reaches(ctx, STAGE_2, "AdvanceToStage");
  if (second && damageLimit != null) dials.push({ id: "damage", label: "Damage", name: `Damage on ${nameOf(STAGE_2)}`, value: second.damage, limit: damageLimit, goal: true, limitWords: damageLimitWords(second.damage, damageLimit, nameOf(STAGE_3)) });
  const entLimit = reaches(ctx, ENT, "TakeControl");
  if (entLimit != null) {
    for (const ent of Object.values(game.cards)) {
      if (ent.code !== ENT || ent.zone !== "staging" || ent.resources === 0) continue;
      dials.push({ id: `ent-${ent.id}`, label: "Ent", name: `Resource tokens on ${nameOf(ENT)}`, value: ent.resources, limit: entLimit, goal: true, limitWords: entLimitWords(ent.resources, entLimit) });
    }
  }
  const saruman = Object.values(game.cards).find((card) => card.code === SARUMAN && inPlay(card.zone));
  if (saruman && saruman.attachments.some((id) => game.cards[id]?.code === STAFF)) {
    const left = Math.max(0, (printedOf(ctx.cards, SARUMAN).health ?? 0) - saruman.damage);
    dials.push({ id: "gate", label: "Gate", name: `${nameOf(SARUMAN)}'s hit points left`, value: left, note: gateWords(left) });
  }
  if (currentStage(game, STAGE_3) && flagged(game, "table", "eliminatedAtEmptyHand")) {
    const seats = livingSeats(game);
    for (const seat of seats) {
      const count = game.seats[seat]?.hand.length ?? 0;
      const warn = handWarning(count);
      dials.push({ id: `hand-${seat}`, label: seats.length > 1 ? `P${seat + 1} hand` : "Hand", name: `${seats.length > 1 ? `Player ${seat + 1}'s` : "Your"} cards in hand`, value: count, ...(warn ? { warn } : {}) });
    }
  }
  return dials;
}

/** The dials for the top bar: the same list while no dial's words or number changed, so the bar re-renders only when a token, a hit point or a card moves. */
export function useIsengardDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly IsengardDial[] {
  const key = JSON.stringify(isengardDials(game, ctx, nameOf));
  return useMemo((): readonly IsengardDial[] => JSON.parse(key), [key]);
}
