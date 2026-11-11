// Rules: mec112.wizardry, rr.player-elimination, rr.resources (data/rules/entries.json); ledger lines 143078:B:2, 143079:B:2, 143046:A:1, 143048:A:2, 143080:B:3.
//
// The numbers of The Road to Isengard's table dials (docs/design-system-table.md, Cards, The Road to Isengard): the resources on stage 1B (the cards revealed on advancing), the damage on stage 2B against the 5 that advance the
// players, each Ent of Fangorn's resources against the 3 that give a player control of it, Saruman's hit points (the win gate, while the Staff is on him) and, on stage 3B, each seat's cards in hand, which its threat dial wears in its label and warns with at 1 and 0. The
// limits are read from the records that use them. The engine decided every number; nothing here changes one. Pure, so a test reads it.
import type { Effect } from "../../catalog/boundary.ts";
import { flagged, inPlay, livingSeats, type CardInstance } from "../../rules/core/state.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import type { TableDial } from "./dials.ts";
import { advanceLimitWords } from "../words/scenarios/fortress.ts";
import { entLimitWords, gateWords, handLabel, handWarning, REVEALS_WORDS } from "../words/scenarios/isengard.ts";

const STAGE_1 = "143078";
const STAGE_2 = "143079";
const STAGE_3 = "143080";
const ENT = "143046";
const SARUMAN = "143047";
const STAFF = "143048";

/** What a seat's threat dial says of its hand on stage 3B: its label (the count, which a screen reader hears with it) and the warning at 1 card and 0. */
export type HandMark = { seat: number; label: string; warn?: { level: "near" | "critical"; words: string } };

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
export function isengardDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  const first = currentStage(game, STAGE_1);
  if (first) dials.push({ id: "reveals", label: "Reveals", name: `Resource tokens on ${nameOf(STAGE_1)}`, value: first.resources, note: REVEALS_WORDS });
  const second = currentStage(game, STAGE_2);
  const damageLimit = reaches(ctx, STAGE_2, "AdvanceToStage");
  if (second && damageLimit != null) dials.push({ id: "damage", label: "Damage", name: `Damage on ${nameOf(STAGE_2)}`, value: second.damage, limit: damageLimit, goal: true, limitWords: advanceLimitWords(second.damage, damageLimit, nameOf(STAGE_3)) });
  // One dial for the Ents: the one closest to control (the most resources against the 3 that give a player control), and every Ent's count in its spoken words.
  const entLimit = reaches(ctx, ENT, "TakeControl");
  const ents = entLimit == null ? [] : Object.values(game.cards).filter((ent) => ent.code === ENT && ent.zone === "staging");
  if (entLimit != null && ents.some((ent) => ent.resources > 0)) {
    const counts = ents.map((ent) => ent.resources).sort((left, right) => right - left);
    dials.push({ id: "ents", label: "Ents", name: `Resource tokens on the ${nameOf(ENT)} closest to control`, value: counts[0] ?? 0, limit: entLimit, goal: true, limitWords: entLimitWords(counts, entLimit) });
  }
  // Saruman's gate (143048:A:2): the damage fills the ring toward his hit points as the engine reads them (modified, not printed), the disc keeps the hit points left, and a gate that is open says so.
  const saruman = Object.values(game.cards).find((card) => card.code === SARUMAN && inPlay(card.zone));
  if (saruman && saruman.attachments.some((id) => game.cards[id]?.code === STAFF)) {
    const hitPoints = modifiedStat(game, saruman, "hitPoints", ctx.cards);
    const left = Math.max(0, hitPoints - saruman.damage);
    dials.push({ id: "gate", label: "Gate \u00b7 HP", name: `${nameOf(SARUMAN)}'s hit points left`, value: left, limit: hitPoints, filled: Math.min(hitPoints, saruman.damage), goal: true, limitWords: gateWords(left) });
  }
  return dials;
}

/** Each living seat's cards in hand on stage 3B (143080:B:3), for its threat dial's label and warning; empty on any other stage and in any other scenario. */
export function isengardHands(game: ScenarioState): readonly HandMark[] {
  if (!currentStage(game, STAGE_3) || !flagged(game, "table", "eliminatedAtEmptyHand")) return [];
  const seats = livingSeats(game);
  return seats.map((seat) => {
    const count = game.seats[seat]?.hand.length ?? 0;
    const warn = handWarning(count);
    return { seat, label: handLabel(count, seats.length > 1 ? seat : null), ...(warn ? { warn } : {}) };
  });
}
