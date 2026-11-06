// Rules: emce.discover, emce.loot, rr.first-player (data/rules/entries.json); ledger lines 19094:A:3, 19096:A:3, 19101:A:2, 19106:A:1.
// The choices of The Ghost of Framsburg on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player. One player's choice leads with "Player N:" two-handed (`owned`, so the sheet adds no
// "Player N chooses."), solo it has no lead. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";
import { seatSays } from "./seat.ts";

type Facts = { game: ScenarioState; ctx: ReduceContext; options: readonly string[] };

/**
 * The sentence a pick or an ask of The Ghost of Framsburg makes: Crypt Key's choice of the Discover location whose value it changes (19094:A:3), Scatha's Teeth's choice of the player who reduces their threat (19096:A:3), the Loot objective a Discover
 * attaches (19106:A:1, ResolveDiscover) or the Forgotten Crypt's enemy guards (19101:A:2). Null for any other pick.
 */
export function framsburgAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  const says = facts ? seatSays(facts.game) : null;
  const sentence = (verb: string, text: string): PickWords => (says ? { verb, prompt: says.say(text), ...says.owned } : { verb, prompt: `${text.charAt(0).toUpperCase()}${text.slice(1)}` });
  const card = source ? names.card(source) : "this card";
  if (instruction.verb === "ResolveDiscover") return sentence("Attach", "choose 1 Loot objective to attach to the active location as a guarded objective, as the Discover keyword says.");
  if (instruction.verb === "AttachLootFromDiscard") return sentence("Attach", "choose a Loot objective in the encounter discard pile to attach to the enemy just added to the staging area, as its guarded objective.");
  if (instruction.verb !== "Pick") return null;
  const pick = instruction.pick;
  if (pick.type === "location" && pick.active === true && next?.verb === "Choose" && next.options.some((option) => option.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "discoverValue"))) {
    const only = facts?.options.length === 1 ? facts.options[0] : undefined;
    return sentence("Choose", `${card}: choose the location you traveled to${only ? ` (${names.card(only)})` : ""}, then add 1 to its Discover value or take 1 off it before the keyword resolves.`);
  }
  if (pick.type === "player" && next?.verb === "LowerThreat" && next.who === "picked") return sentence("Choose", `${card}: choose a player to reduce their threat by ${typeof next.amount === "number" ? next.amount : 2}.`);
  return null;
}
