// Rules: dcce.island-map, dcce.exploration, dcce.uncharted, rr.travel (data/rules/entries.json); ledger lines 12067:A:1, 12067:B:2, 12071:A:2, 110078:B:3, 11197:A:2, 11199:A:2, 12068:A:1, 12068:B:3. The words of the island family's
// verbs inside a choice (src/catalog/families/island.ts): what a Pick or a question is for, the label of an option that is no card, and what a travel row on the map says. Every prompt names the card it is about and leads
// with the decision; a travel row says what it leaves behind and what it brings back. Pure.
import type { Instruction } from "../catalog/boundary.ts";
import { cellOf, exploring, islandOf, TEMPLE_COLUMN } from "../rules/families/island-map.ts";
import { seatThreat } from "../rules/families/play-hooks.ts";
import { effectsOf } from "../rules/listen.ts";
import { printedOf } from "../rules/printed.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";

import type { ChoiceNames, PickWords } from "./choice-words.ts";

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** One instruction in words, or null when it is not one of the family's. */
export function islandWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "FlipSecret":
      return "flip over the secret at your location";
    case "LookAtSecret":
      return "look at a secret";
    case "ShuffleIntoPlayerDeck":
      return "shuffle it into a player's deck";
    case "PlaceProgressInStaging":
      return "place the progress on locations in the staging area";
    case "EngageFromVictory":
      return `put ${instruction.name} into play from the victory display, engaged with the player with the highest threat`;
    default:
      return null;
  }
}

/** What a Pick of the family's cards, or one of its questions, asks. Null for any other pick. `next` is the instruction after it. */
export function islandPickWords(pick: Instruction, next: Instruction | undefined, names: ChoiceNames, sourceId: string | null, game?: ScenarioState): PickWords | null {
  const host = sourceId ? names.card(sourceId) : "This card";
  switch (pick.verb) {
    case "PlaceProgressInStaging":
      return { verb: "Place", prompt: `${host}: ${plural(pick.left ?? 0, "progress", "progress")} left to place. Choose a location in the staging area to put it on, or keep it on the quest, where it does nothing.` };
    case "RaiseThreatToAttach": {
      const card = names.code(pick.code);
      return pick.accepted === true ? { verb: "Attach", prompt: `${host}: choose the hero ${card} is attached to.` } : { verb: "Raise", prompt: `${host}: Player ${(pick.seat ?? 0) + 1}, raise your threat by ${pick.amount} to attach ${card} to a hero?${game ? ` Your threat would be ${seatThreat(game, pick.seat ?? 0) + pick.amount}.` : ""}` };
    }
    case "ShuffleIntoPlayerDeck":
      return { verb: "Shuffle in", prompt: `${host}: choose the player whose deck it is shuffled into.` };
    case "EngageFromVictory":
      return { verb: "Engage", prompt: `${pick.name} comes back into play. Players are tied for the highest threat: choose the one it engages.` };
    case "Pick":
      break;
    default:
      return null;
  }
  const island = pick.pick.island;
  if (island === "start" && next?.verb === "SetIslandActive") return { verb: "Start here", prompt: `${host}: choose the starting active location. The marker is put on it.` };
  if (island === "temple" && next?.verb === "LookAtFacedown") return { verb: "Look", prompt: `${host}: choose a Temple of the Deceived location to look at the facedown side of.` };
  if (island === "secret" && next?.verb === "LookAtSecret") return { verb: "Look", prompt: `${host}: choose a secret to look at. It stays facedown.` };
  return null;
}

/** The label of an option that is no card: keep the progress on the quest, raise threat to attach or keep it as it is. Null for a card (the sheet names it). */
export function islandOptionLabel(instruction: Instruction, id: string, game: ScenarioState, names: ChoiceNames): string | null {
  if (instruction.verb === "PlaceProgressInStaging" && id === "keep") return "Keep the rest on the quest";
  if (instruction.verb === "RaiseThreatToAttach" && !instruction.accepted) {
    const seat = instruction.seat ?? 0;
    if (id === "attach") return `Raise threat by ${instruction.amount} to ${seatThreat(game, seat) + instruction.amount} and attach ${names.code(instruction.code)} to a hero`;
    if (id === "keep") return "Keep my threat as it is";
  }
  return null;
}

// ---- Traveling on the map (docs/design-system-table.md, The Island Map). ----

/** The sentence under a travel choice on the map: the marker moves, the location left stays where it lies and loses its progress. Null in a game with no map. */
export function islandTravelNote(game: ScenarioState, name: (id: string) => string): string | null {
  if (!exploring(game) || !game.activeLocation) return null;
  const progress = game.cards[game.activeLocation]?.progress ?? 0;
  return `The marker moves to the location, which stays where it lies. ${name(game.activeLocation)} is explored${progress > 0 ? ` and its ${plural(progress, "progress", "progress")} is removed` : ""}.`;
}

/** What a full-up active location needs before the players can travel from it, as the empty travel sheet says it ("3 more progress before the players can travel from it"). Null in a game with no map. */
export function islandBlocked(game: ScenarioState, needed: number, name: string): string | null {
  return exploring(game) ? `${plural(Math.max(0, needed), "more progress", "more progress")} on ${name} before the players can travel from it.` : null;
}

export type IslandTravelRow = { words: string; caution: string | null };

// The enemies engaged with a player that attack when the players travel to the right ("Forced: When you travel to the right, Profane Dead makes an immediate attack", 12077:A:1).
function attackersOnRight(game: ScenarioState, ctx: ReduceContext): string[] {
  return game.seats.flatMap((seat) => seat.engaged).filter((id) => effectsOf(ctx, game.cards[id]?.code ?? "").some((effect) => effect.trigger === "traveled" && effect.condition?.kind === "all" && effect.condition.conditions.some((entry) => entry.kind === "island" && entry.movedRight === true)));
}

/** What a travel row on the map says of the location: how far away it is (Winding Caverns), that the Temple Guardian comes back (a covered Temple location), and the enemies that attack when the players go right. The caution arms the confirm. */
export function islandTravelRow(game: ScenarioState, ctx: ReduceContext, locationId: string, name: (id: string) => string): IslandTravelRow | null {
  const island = islandOf(game);
  const active = game.activeLocation;
  if (!island || !active || !exploring(game)) return null;
  const to = cellOf(island, locationId);
  const from = cellOf(island, active);
  if (!to || !from) return null;
  const parts: string[] = [];
  const cautions: string[] = [];
  const away = Math.abs(to.row - from.row) + Math.abs(to.col - from.col);
  if (away > 1) parts.push(`${away} locations away`);
  // Every Temple location, whichever it turns out to be, brings Temple Guardian back from the victory display (12068:A:1, 12069:A:2).
  const guardian = game.victory.find((id) => printedOf(ctx.cards, game.cards[id]?.code ?? "").name === "Temple Guardian");
  if (to.col === TEMPLE_COLUMN && game.cards[locationId]?.face === "B" && guardian) {
    parts.push(`${name(guardian)} comes back`);
    cautions.push(`${name(guardian)} comes back into play, engaged with the player with the highest threat`);
  }
  if (to.col > from.col) {
    const enemies = attackersOnRight(game, ctx);
    if (enemies.length > 0) {
      const names = enemies.map(name).join(" and ");
      parts.push(`${names} attack${enemies.length === 1 ? "s" : ""}`);
      cautions.push(`${names} ${enemies.length === 1 ? "makes" : "make"} an immediate attack`);
    }
  }
  if (parts.length === 0) return null;
  return { words: parts.join(" · "), caution: cautions.length > 0 ? `Tap again: ${cautions.join("; ")}` : null };
}
