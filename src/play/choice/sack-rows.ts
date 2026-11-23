// Rules: hob.sack-x, hob.sack-x-example (data/rules/entries.json); ledger lines 131044:A:1 to 131050:A:1.
// The deciding number of a Sack card's tie, as a stat on each row of the pick: the characters tied for the highest printed Attack show "Attack 2", so the player sees why these characters and no others are offered. The engine's own reader gives the number.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { valueOf } from "../../rules/families/sack/attach.ts";

import type { SheetStat } from "./sheet-types.ts";

type SackBy = Extract<Instruction, { verb: "AttachSacked" }>["by"];

const ICON: Readonly<Record<SackBy, SheetStat["icon"]>> = { cost: "cost", attack: "attack", defense: "defense", willpower: "willpower", hitPoints: "hitPoints", attachments: "attachment", resources: "resource" };
const WORD: Readonly<Record<SackBy, string>> = { cost: "Printed cost", attack: "Printed Attack", defense: "Printed Defense", willpower: "Printed Willpower", hitPoints: "Printed hit points", attachments: "Attachments", resources: "Resources" };

/** The stat a row of an AttachSacked pick shows: the value its tie is decided by. None for any other pick. */
export function sackStat(instruction: Instruction, id: string, game: ScenarioState, ctx: ReduceContext): SheetStat[] {
  const card = game.cards[id];
  if (instruction.verb !== "AttachSacked" || !card) return [];
  return [{ icon: ICON[instruction.by], value: valueOf(game, card, instruction.by, ctx), word: WORD[instruction.by] }];
}
