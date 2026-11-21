// The pieces every sheet builder uses: the step's words, a card's stat as the engine reads it, an option's label, and
// whether an intent type is legal now.
import type { LegalIntent, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { isReanimatedCode, printedOf } from "../../rules/core/printed.ts";
import { inPlay } from "../../rules/core/state.ts";

import { pictureKey } from "../canvas/picture-key.ts";
import { islandTell } from "../words/scenarios/uncharted.ts";
import { STEP_WORDS } from "../phases/rail.ts";
import type { SheetNames, SheetOption, SheetStat } from "./sheet-types.ts";
import { pseudoHostWords } from "../cards/host-words.ts";

export function step(game: ScenarioState): string {
  return STEP_WORDS[game.mode] ?? game.phase;
}

type StatName = "willpower" | "attack" | "defense" | "threat";
const STAT_WORDS: Record<StatName, string> = { willpower: "Willpower", attack: "Attack", defense: "Defense", threat: "Threat" };

/** One of a card's stats as the engine reads it now (modifiers applied), for a sheet tile or header. */
export function statOf(game: ScenarioState, ctx: ReduceContext, id: string, stat: StatName): SheetStat[] {
  const card = game.cards[id];
  return card ? [{ icon: stat, value: modifiedStat(game, card, stat, ctx.cards), word: STAT_WORDS[stat] }] : [];
}

/** A card's name as a tile or row reads it; a Lost Island's is followed by what tells it from the others (progress, place in staging). */
export function cardLabel(game: ScenarioState, names: SheetNames, id: string): string {
  const card = game.cards[id];
  const tell = card ? islandTell(game, card) : null;
  return tell ? `${names.card(id)} · ${tell}` : names.card(id);
}

/**
 * The row of a Captive of The Uruk-hai in a pick (Grishnákh's, 143024:A:1; Hands of a Healer's, 143016:A:3, which mixes Captives with the heroes the players control): "Legolas · Captive · 2 of 4 damage", with
 * " · Player 2" after it when the options hold the heroes of more than one player. Undefined for any other row.
 */
export function captiveLabel(game: ScenarioState, ctx: ReduceContext, names: SheetNames, id: string, options: readonly string[]): string | undefined {
  const card = game.cards[id];
  if (card?.captive !== true) return undefined;
  const hitPoints = printedOf(ctx.cards, card.code).health;
  const damage = hitPoints == null ? `${card.damage} damage` : `${card.damage} of ${hitPoints} damage`;
  const owners = new Set(options.map((other) => game.cards[other]?.owner).filter((owner) => owner != null));
  return `${names.card(id)} · Captive · ${damage}${card.owner != null && owners.size > 1 ? ` · Player ${card.owner + 1}` : ""}`;
}

/**
 * The row of an ally lying in the staging area under nobody's control in a pick (Retreat from Osgiliath's damage among them, 145074:B:3): "Gimli · Player 2's ally", the owner named when the options hold the allies of more than one player.
 * Undefined for any other row.
 */
export function stagedAllyLabel(game: ScenarioState, ctx: ReduceContext, names: SheetNames, id: string, options: readonly string[]): string | undefined {
  const card = game.cards[id];
  if (card?.zone !== "staging" || card.controller != null || card.owner == null || printedOf(ctx.cards, card.code).type !== "ally") return undefined;
  const owners = new Set(options.map((other) => game.cards[other]?.owner).filter((owner) => owner != null));
  return owners.size > 1 ? `${names.card(id)} · Player ${card.owner + 1}'s ally` : undefined;
}

/** The seat a card of a pick belongs to: the player an enemy is engaged with, the player who controls a character in play, or the owner of a captured or rescued card. Null when it belongs to no seat. */
function seatOfCard(game: ScenarioState, id: string): number | null {
  const card = game.cards[id];
  if (!card) return null;
  if (card.zone === "engaged") return game.seats.findIndex((seat) => seat.engaged.includes(id));
  // A card captured underneath another, or rescued into a hand, is its owner's (Escape from Mount Gram).
  if (card.zone === "captured" || card.zone === "hand") return card.owner ?? card.controller;
  // An attachment is its host's player's: the player who controls the hero or ally, the player an enemy host is engaged with, or the owner of a Reanimated Dead in the staging area (Possession); a host no seat owns (a location, an enemy in the staging area) gives none.
  if (card.zone === "attached" && card.host != null) {
    const host = game.cards[card.host];
    if (!host) return null;
    return host.zone === "staging" && isReanimatedCode(host.code) ? (host.owner ?? null) : seatOfCard(game, host.id);
  }
  return card.zone === "play" || card.zone === "heroes" ? card.controller : null;
}

/**
 * The row of a card in a pick of Intruders in Chetwood whose options belong to more than one player (Borders of Bree-land's enemy, Angmar Orc's ally): the owner is named on each row, "Angmar Orc \u00b7 engaged with Player 2",
 * "Gimli \u00b7 Player 1's ally". An attachment names the card it lies on and whose that is, so two of one name read apart ("A Fell Dread \u00b7 on Aragorn, Player 2's hero", "Possession \u00b7 on Reanimated Dead, Player 1's card", "... on Orc Archer, enemy engaged with Player 1");
 * one lying on a card no seat owns has no label. Undefined for any other row, and in a game with one seat or none of the side quest rules (or of the Setup line that has the first player pick among every player's heroes, `seatedRows`).
 */
export function seatedLabel(game: ScenarioState, ctx: ReduceContext, names: SheetNames, id: string, options: readonly string[]): string | undefined {
  if ((game.sideQuests !== true && game.seatedRows !== true) || game.seatCount < 2) return undefined;
  const seat = seatOfCard(game, id);
  if (seat == null || seat < 0) return undefined;
  const seats = new Set(options.map((other) => seatOfCard(game, other)).filter((other) => other != null && other >= 0));
  if (seats.size < 2) return undefined;
  const type = printedOf(ctx.cards, game.cards[id]?.code ?? "").type;
  // An attachment says which card it lies on and whose that is.
  const host = game.cards[id]?.zone === "attached" ? game.cards[game.cards[id]?.host ?? ""] : undefined;
  if (host) {
    const hostName = names.card(host.id);
    const hostType = printedOf(ctx.cards, host.code).type;
    const on = isReanimatedCode(host.code) ? `${hostName}, Player ${seat + 1}'s card` : hostType === "enemy" ? `${hostName}, enemy engaged with Player ${seat + 1}` : `${hostName}, Player ${seat + 1}'s ${hostType}`;
    return `${names.card(id)} \u00b7 on ${on}`;
  }
  const kind = type === "hero" || type === "attachment" || type === "event" ? type : type === "player-side-quest" ? "side quest" : "ally";
  return type === "enemy" ? `${names.card(id)} \u00b7 engaged with Player ${seat + 1}` : `${names.card(id)} \u00b7 Player ${seat + 1}'s ${kind}`;
}

/**
 * The row of an encounter card in play in a pick of Escape from Mount Gram (Captives of Gornákh's tie, 10051:A:1) that shares its name with another row: "Goblin Tormentor · staging area · 3 Threat", "· engaged with Player 2", "· active location", so two cards of one name read apart.
 * Undefined for any other row, and in a game with no captured deck.
 */
export function tiedLabel(game: ScenarioState, ctx: ReduceContext, names: SheetNames, id: string, options: readonly string[]): string | undefined {
  const card = game.cards[id];
  if (game.capture == null || !card || (card.zone !== "staging" && card.zone !== "activeLocation" && card.zone !== "engaged")) return undefined;
  const name = names.card(id);
  if (options.filter((other) => other !== id && game.cards[other] != null && names.card(other) === name).length === 0) return undefined;
  const seat = card.zone === "engaged" ? game.seats.findIndex((one) => one.engaged.includes(id)) : -1;
  const place = card.zone === "activeLocation" ? "active location" : card.zone === "engaged" ? (game.seatCount > 1 && seat >= 0 ? `engaged with Player ${seat + 1}` : "engaged with you") : "staging area";
  const threat = printedOf(ctx.cards, card.code).threat == null ? 0 : modifiedStat(game, card, "threat", ctx.cards);
  return `${name} \u00b7 ${place} \u00b7 ${threat} Threat`;
}

/**
 * The row of a card in play that shares its name with another row of the pick, so copies read apart: Mr. Underhill's two
 * engaged Black Riders (141017:A:3) read "Black Rider · attacking · engaged with you" and "Black Rider · engaged with you".
 * It says whether the card is attacking, where it is, its damage and its attachments. Undefined when no other row has its name.
 */
export function copyLabel(game: ScenarioState, names: SheetNames, id: string, options: readonly string[]): string | undefined {
  const card = game.cards[id];
  if (!card || !inPlay(card.zone)) return undefined;
  const name = names.card(id);
  if (!options.some((other) => other !== id && game.cards[other] != null && names.card(other) === name)) return undefined;
  const seat = game.seats.findIndex((one) => one.engaged.includes(id));
  const engaged = game.seatCount > 1 && seat >= 0 ? `engaged with Player ${seat + 1}` : "engaged with you";
  const places: Partial<Record<string, string>> = { engaged, staging: "staging area", activeLocation: "active location" };
  const host = card.zone === "attached" && card.host ? `on ${names.card(card.host)}` : undefined;
  const attachments = card.attachments.map((other) => names.card(other));
  const attacking = game.pendingAttack?.enemyId === id ? "attacking" : undefined;
  const damage = card.damage > 0 ? `${card.damage} damage` : undefined;
  const withAttachments = attachments.length > 0 ? `with ${attachments.join(", ")}` : undefined;
  const parts = [attacking, places[card.zone] ?? host, damage, withAttachments].filter((part): part is string => part != null);
  return parts.length > 0 ? `${name} \u00b7 ${parts.join(" \u00b7 ")}` : undefined;
}

export function option(game: ScenarioState, names: SheetNames, id: string): SheetOption {
  // The staging area, where a Trap or a Guarded attachment is played, and a seat's play area (src/rules/families/attachments/play.ts).
  const place = pseudoHostWords(id, false);
  if (place) return { id, label: place, code: null };
  const card = game.cards[id];
  // Lost Islands share one name: what tells them apart (progress, place in staging) follows it.
  if (card) return { id, label: cardLabel(game, names, id), code: pictureKey(card) };
  // A branch of a Choose instruction is named by its id in the effect record.
  return { id, label: id.charAt(0).toUpperCase() + id.slice(1), code: null };
}

export function has(legal: readonly LegalIntent[], type: LegalIntent["type"]): boolean {
  return legal.some((intent) => intent.type === type);
}
