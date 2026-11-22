// Rules: rr.the-word-choose (data/rules/entries.json); ledger lines 142021:B:2, 142027:A:1, 906403:A:2, 906404:A:1, 900303:A:3, 141070:A:2, 141074:A:2, 142043:A:2, 142059:A:2, 142079:A:1.
//
// The picks the plain chain left bare (docs/design-system-table.md, Choice tray): the active location that takes damage, the attacking enemy whose delayed threat is raised, the Nazgûl an attachment lies on, the Balrog that attacks from the staging area.
// Each sentence says what the picked card is for, in the card's own numbers.
import type { Instruction } from "../../catalog/boundary.ts";
import { amountWords } from "./instruction.ts";

type Words = { verb: string; prompt: string };

/** The active location that takes damage ("place 1 damage on an active location"), the one that is not the first ("each active location": the other), or the attacking enemy a Shadow card's delayed threat raise counts on. Null for any other pick. */
export function activePickWords(pick: Instruction, next: Instruction | undefined): Words | null {
  if (pick.verb !== "Pick") return null;
  if (pick.pick.type === "location" && pick.pick.active === true && next?.verb === "PlaceDamage" && next.card === "picked") {
    const which = pick.pick.different === true ? "the other active location" : "an active location";
    return { verb: "Place", prompt: `Choose ${which} to place ${amountWords(next.amount)} damage on.` };
  }
  // Crazed Captive's shadow (900303:A:3): the attacking enemy, and the threat the defending player raises at the end of the phase if it is not defeated.
  const [raise] = next?.verb === "Delay" && next.subject === "picked" ? next.instructions : [];
  if (pick.pick.attackingEnemy === true && raise?.verb === "RaiseThreat" && typeof raise.amount === "number") {
    return { verb: "Mark", prompt: `Choose the attacking enemy. If it is not defeated this phase, raise your threat by ${raise.amount} at the end of the phase.` };
  }
  return null;
}

/** An attachment that lies on an enemy of a trait ("Attach to a Nazgûl enemy in play, if able", 141070:A:2): which enemy, and the card that attaches. Null for any other instruction. */
export function attachEnemyWords(asked: Instruction, sourceName: string | null): Words | null {
  if (asked.verb !== "AttachSelf" || asked.to.kind !== "enemy") return null;
  return { verb: "Attach", prompt: `Choose a ${asked.to.trait} enemy in play to attach ${sourceName ?? "it"} to.` };
}
