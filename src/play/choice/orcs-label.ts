// Rules: hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage (data/rules/entries.json); ledger lines 17044:A:2, 16064:A:1. The row of an enemy in a pick that can reach the Orcs' area (Racing Warg, Mordor Warg): it says where the
// enemy stands, so two Orcs of one name read apart and the player sees which are out of reach: "Uruk Pursuer · Orcs' area", "· staging area", "· engaged with Player 2". Pure.
import type { ScenarioState } from "../../rules/core/state.ts";

import { orcsRoleOf } from "../store/orcs-table.ts";
import { engagedWords } from "./sheet-parts.ts";
import type { SheetNames } from "./sheet-types.ts";

/** The row of `id` with its place, when the game has an Orcs' area and one row of the pick lies in it; undefined for any other row. */
export function orcsLabel(game: ScenarioState, names: SheetNames, id: string, options: readonly string[]): string | undefined {
  const card = game.cards[id];
  if (!game.orcs || !card || !options.some((other) => game.cards[other]?.zone === "orcsArea")) return undefined;
  const place = placeWords(game, id, card.zone);
  if (place == null) return undefined;
  const attached = card.attachments.map((other) => names.card(other));
  return `${names.card(id)} · ${place}${attached.length > 0 ? ` · with ${attached.join(", ")}` : ""}`;
}

// Where the enemy stands: a member of the area by its role (apart in the area zone, together in the staging area), else its zone.
function placeWords(game: ScenarioState, id: string, zone: string): string | undefined {
  const role = orcsRoleOf(game, id);
  if (role === "apart") return "Orcs' area";
  if (role === "together") return "Orcs' area, in the staging area";
  if (zone === "staging") return "staging area";
  return zone === "engaged" ? engagedWords(game, game.seats.findIndex((seat) => seat.engaged.includes(id))) : undefined;
}
