// Rules: mec112.setup-shelobs-lair, rr.play-and-put-into-play (data/rules/entries.json); ledger lines 144040:A:2, 144071:B:2, 144071:B:3, 144072:B:2.
//
// The pieces of Shelob's Lair's table (docs/design-system-table.md, Cards, Shelob's Lair): Shelob's resources (each is +1 Threat, and on stage 3B each cancels one instance of damage), the progress placed on the quest stage this round
// against stage 2B's cap of 4, and each player's allies this round against the 1 they may bring into play. The engine decided every number (`questCapTally`, `entries`, `modifiedStat`); nothing here changes one. Pure, so a test reads it.
import { inPlay } from "../../rules/core/state.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { questCapTally } from "../../rules/families/caves/progress.ts";
import { constantInstructions } from "../../rules/interpret/constant-records.ts";

import { alliesWords, capWords, shelobWords } from "../words/scenarios/lair.ts";
import type { TableDial } from "./dials.ts";

const SHELOB = "144040";
const PASS = "144071";
const STAGE_THREE = "144072";

/**
 * The dials Shelob's Lair's pieces hold now, in the order the top bar draws them: Shelob's resources (while she is in play), the stage's progress cap (while the Pass is the stage) and each seat's allies (while its limit holds).
 * None warms: a cap or a limit holds the players back, it does not lose them the game. Empty in any other scenario.
 */
export function lairDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dials: TableDial[] = [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const shelob = Object.values(game.cards).find((card) => card.code === SHELOB && inPlay(card.zone));
  if (shelob) dials.push({ id: "shelob", testID: "lair-shelob", label: "Shelob", name: `Resources on ${nameOf(SHELOB)}, +1 Threat each:`, value: shelob.resources, note: shelobWords(shelob.resources, stage?.code === STAGE_THREE) });
  const cap = stage?.code === PASS ? questCapTally(game) : null;
  if (cap) dials.push({ id: "cap", testID: "lair-cap", label: "Progress", name: "Progress placed on the quest stage this round:", value: cap.placed, limit: cap.limit, limitWords: capWords(cap.placed, cap.limit) });
  const limit = constantInstructions(game, ctx).flatMap(({ instruction }) => (instruction.verb === "LimitEntries" && instruction.perPlayer ? [instruction.max] : []))[0];
  if (limit != null) {
    const entered = game.entries?.round === game.round ? (game.entries.bySeat ?? []) : [];
    for (let seat = 0; seat < game.seatCount; seat += 1) {
      const count = entered[seat] ?? 0;
      const who = game.seatCount > 1 ? `Player ${seat + 1}` : "You";
      dials.push({ id: `allies-${seat}`, testID: `lair-allies-${seat}`, label: game.seatCount > 1 ? `P${seat + 1} · Allies` : "Allies", name: `Allies ${who === "You" ? "you have" : `${who} has`} played or put into play this round:`, value: count, limit, limitWords: alliesWords(count, limit, who) });
    }
  }
  return dials;
}
