// Rules: dcce.grapple (data/rules/entries.json); ledger lines 12051:A:1 to 12054:A:1. What the table says of the enemies grappled with a location: they are facedown under it, count against nothing the players can
// choose, and add 2 Threat each to it. The one sentence the preview, the screen reader and the round summary read from. Pure.
import type { Instruction } from "../catalog/boundary.ts";
import { GRAPPLE_THREAT, grappledWith } from "../rules/families/grapple-values.ts";
import type { ScenarioState } from "../rules/state.ts";

import type { ChoiceNames, PickWords } from "./choice-words.ts";

/** "Grappled: 2 facedown enemies, +4 Threat": the enemies grappled with a location, never named (they are facedown), and the Threat they add. Null with none. */
export function grappledWords(count: number): string | null {
  if (count <= 0) return null;
  return `Grappled: ${count} facedown ${count === 1 ? "enemy" : "enemies"}, +${count * GRAPPLE_THREAT} Threat`;
}

/** The sentence for the location with this id, or null when no enemy is grappled with it. */
export function grappleDetail(game: ScenarioState, locationId: string): string | null {
  return grappledWords(grappledWith(game, locationId).length);
}

/** The sentence as a screen reader hears it after a card's name: " · Grappled: 2 facedown enemies, +4 Threat", or nothing. */
export function grappleTell(game: ScenarioState, locationId: string): string {
  const detail = grappleDetail(game, locationId);
  return detail ? ` · ${detail}` : "";
}

/** The enemy that attached itself to a location as it was revealed or resolved: the line names the location, never the enemy. */
export function grappleLine(location: string): string {
  return `An enemy grapples with ${location}`;
}

/** An enemy detached from a location and added to the staging area, faceup. */
export function detachLine(enemy: string, location: string): string {
  return `${enemy} is detached from ${location}`;
}

/** What a choice of the grapple family asks: the location an enemy grapples with among those tied (the enemy is not named, it goes facedown), a Giant Arm's engage or grapple, the Trait a character gains,
 * and the player Come Together goes to. Null for any other. */
export function grappleAsk(pick: Instruction, sourceId: string | null, names: ChoiceNames): PickWords | null {
  const host = sourceId ? names.card(sourceId) : "This card";
  switch (pick.verb) {
    case "ResolveGrapple":
      return { verb: "Grapple", prompt: "Choose the location the enemy grapples with. The locations are tied. The enemy goes facedown under it." };
    case "EngageOrGrapple":
      return { verb: "Choose", prompt: `${host}: put it into play engaged with you and deal it a shadow card, or resolve its Grapple keyword?` };
    case "GainChosenTrait":
      return { verb: "Gain", prompt: `${host}: choose the Trait this character gains until the end of the round.` };
    default:
      return null;
  }
}

/** The label of an option of the family that is no card: Giant Arm's two ways, a Trait. Null for a card (the sheet names it). */
export function grappleOptionLabel(instruction: Instruction, id: string): string | null {
  if (instruction.verb === "EngageOrGrapple") return id === "engage" ? "Put it into play engaged with you, and deal it a shadow card" : id === "grapple" ? "Resolve its Grapple keyword" : null;
  if (instruction.verb === "GainChosenTrait") return id;
  return null;
}
