// The words of the sea family's verbs (src/catalog/families/sea.ts) inside a choice: what a branch of a Choose does ("Either shift your heading
// off-course or deal 1 damage to each exhausted character", 11055:A:1).
import type { Instruction } from "../../../catalog/boundary.ts";
import { frameScope, resolveAmount } from "../../../rules/interpret/amounts.ts";
import { controlledShips } from "../../../rules/families/sea/campaign.ts";
import { titleDeck } from "../../../rules/families/sea/cards.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { printedOf, type PrintedCard } from "../../../rules/core/printed.ts";
import { familyTravelCost } from "../../../rules/interpret/family-hooks.ts";
import { lastPicked } from "../../../rules/interpret/player-verbs.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { livingSeats } from "../../../rules/core/state.ts";
import { topFrame } from "../../../rules/windows/windows.ts";
import { effectData } from "../../../rules/families/encounter/moves.ts";

import type { ChoiceNames, PickWords } from "../choice.ts";

/** One sea instruction in words, or null when it is not one of them. */
export function seaWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "ShiftHeading":
      return instruction.direction === "offCourse" ? "shift your heading off-course" : "shift your heading on-course";
    case "RevealCorsair": {
      const count = instruction.count == null ? "1" : typeof instruction.count === "number" ? String(instruction.count) : "X";
      const engaged = instruction.who === "eachSeat" ? "each player" : instruction.who === "anyPlayer" ? "the player the first player names" : "you";
      return `reveal the top ${count === "1" ? "card" : `${count} cards`} of the Corsair deck and put ${count === "1" ? "it" : "them"} into play engaged with ${engaged}`;
    }
    case "EngageLastPlayer":
      return "it engages the last player";
    case "DamageShip":
      return typeof instruction.amount === "number" ? `deal ${instruction.amount} damage to a Ship objective you control` : instruction.amount.excess ? "deal the excess damage to a Ship objective you control" : "deal damage to a Ship objective you control";
    case "SearchShips":
      return typeof instruction.count === "number" && instruction.count > 1 ? `add the ${instruction.count} Ship enemies with the highest Threat to the staging area` : "add the Ship enemy with the highest Threat to the staging area";
    default:
      return null;
  }
}

const article = (noun: string): string => (/^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`);

// A Pick whose picked card the next instruction uses, for the cards of Cobas Haven: the Ship enemy chosen to guard an objective or the objective it guards (12121:A:1, 12126:A:3, 12133:A:1), the Ship enemy
// Belfalas Islet holds out of play (12129:A:2), the one that makes Ramming Speed!'s immediate attack (12131:A:1), the Ship enemy Tower of the Gull damages (12135:A:3), the characters Taking on Water's Action exhausts
// (12132:A:1) and the Ship objective Coast of Anfalas's Travel cost exhausts (12128:A:2). `game` is the table (the card picked before, the frame), `after` the instructions after `next`.
function seaPickThenWords(pick: Extract<Instruction, { verb: "Pick" }>, next: Instruction, names: ChoiceNames | undefined, sourceId: string | null, game: ScenarioState | undefined, after: readonly Instruction[] | undefined): PickWords | null {
  // The card the effect picked last, named; null when nothing is known of it.
  const previous = (): string | null => {
    const id = game ? lastPicked(game) : "";
    return id && game?.cards[id] && names ? names.card(id) : null;
  };
  const source = sourceId && names ? names.card(sourceId) : null;
  switch (next.verb) {
    case "AttachGuard": {
      // This pick is the guard: it attaches to the objective picked before it (Battle in the Bay).
      if (next.guard === "picked") return { verb: "Guard", prompt: `Choose ${article(`${pick.pick.nonUnique === true ? "non-unique " : ""}Ship enemy`)} to attach to ${next.to === "previous" ? (previous() ?? "the objective") : "the objective"} as its guard.` };
      // This pick is the objective: the enemy that guards it is the one picked before it (The Raiders' Assault) or the source (Siege Ship).
      const guard = next.guard === "previous" ? previous() : source;
      return { verb: "Guard", prompt: guard ? `Choose the unguarded objective ${guard} guards.` : "Choose an unguarded objective in the staging area to guard." };
    }
    case "ReturnToStaging":
      return { verb: "Guard", prompt: "Choose a Ship enemy to attach to an unguarded objective as its guard. An engaged enemy returns to the staging area first." };
    case "ConsiderOutOfPlay":
      return { verb: "Out of play", prompt: `Choose a Ship enemy that is not guarding an objective. While ${source ?? "this location"} is the active location, it is considered to be out of play.` };
    case "AttackWithPicked":
      return { verb: "Attack", prompt: "Choose which of the Ship enemies engaged with you, tied for the highest Attack, makes an immediate attack." };
    case "DamageCard":
      return pick.pick.type === "enemy" && pick.pick.trait === "Ship" && typeof next.amount === "number" ? { verb: "Assign", prompt: `Choose ${article(`${pick.pick.nonUnique === true ? "non-unique " : ""}Ship enemy`)} to take ${next.amount} damage.` } : null;
    case "Exhaust": {
      // Taking on Water's Action: three characters, one at a time, to discard it. The count is the picks made in this effect and the picks still to come.
      if (pick.pick.type === "character" && pick.pick.control === "you" && (after ?? []).some((item) => item.verb === "Discard" && item.target.kind === "self")) {
        const done = game ? (effectData(game)?.picked?.length ?? 0) : 0;
        const left = (after ?? []).filter((item) => item.verb === "Pick").length;
        return { verb: "Exhaust", prompt: `Choose a character you control to exhaust (${done + 1} of ${done + 1 + left}) to discard ${source ?? "this card"}.` };
      }
      // Coast of Anfalas's Travel cost: the Ship objective that pays it.
      return pick.pick.trait === "Ship" && game && topFrame(game)?.frame === "travel" ? { verb: "Exhaust", prompt: `Choose a Ship objective to exhaust to travel to ${source ?? "this location"}.` } : null;
    }
    default:
      return null;
  }
}

const resources = (count: number): string => `${count} ${count === 1 ? "resource" : "resources"}`;

/** The armed line of a travel option, or of "Do not travel" (`locationId` null), when a rule charges for it (Streets of Umbar, 12160:A:1): "Tap again: 2 resources go on a Raider enemy (Streets of Umbar)".
 * Undefined when nothing is charged. */
export function travelTaxCaution(game: ScenarioState, ctx: ReduceContext, locationId: string | null, names: Pick<ChoiceNames, "card">): string | undefined {
  const charge = familyTravelCost(game, ctx, locationId);
  const place = charge?.instructions.find((step) => step.verb === "PlaceResourceTokens");
  if (!charge || place?.verb !== "PlaceResourceTokens" || typeof place.amount !== "number") return undefined;
  const pick = charge.instructions.find((step) => step.verb === "Pick");
  const where = pick?.verb === "Pick" && pick.pick.type === "enemy" ? article(`${pick.pick.trait ? `${pick.pick.trait} ` : ""}enemy`) : "a card";
  return `Tap again: ${resources(place.amount)} ${place.amount === 1 ? "goes" : "go"} on ${where} (${names.card(charge.source)})`;
}

/** What a sea verb that asks a player for a card or an option says to ask (dcce.prepare-your-fleet, 11171:A:2, 11016:B:3, 11021:A:1, 110139:A:4, 110139:B:5). Null for any other verb.
 * Each prompt leads with the decision, so it reads first on a short screen. The ship a question is about is named by `seaAsk`, which reads the game. */
export function seaPickWords(instruction: Instruction, next?: Instruction, names?: ChoiceNames, sourceId?: string | null, game?: ScenarioState, after?: readonly Instruction[]): PickWords | null {
  if (instruction.verb === "Pick" && next) return seaPickThenWords(instruction, next, names, sourceId ?? null, game, after);
  switch (instruction.verb) {
    case "PrepareFleet":
      return { verb: "Take", prompt: "Choose a Ship objective to take control of. One player must take the Dream-chaser." };
    case "FitShips":
      return { verb: "Fit", prompt: "Choose a Modification boon to attach to a Ship objective." };
    case "TradeShipDamage":
      return { verb: "Trade", prompt: `Deal ${instruction.damage} damage to a Ship objective to add ${resources(instruction.resources)} to a hero's pool?` };
    case "LookAtStages":
      return { verb: "Advance", prompt: "Choose the stage to advance to. The other goes to the bottom." };
    case "SearchShips":
      return { verb: "Add", prompt: "Choose which Ship enemy with the highest Threat is added to the staging area." };
    case "AttachSelf":
      return instruction.to.kind === "ship" ? { verb: "Attach", prompt: `Choose the Ship objective to attach ${names && sourceId ? names.card(sourceId) : "it"} to.` } : null;
    case "MakeEngagementChecks":
      return { verb: "Engage", prompt: "Choose which of the enemies tied for the highest engagement cost the engagement check engages." };
    case "NameCard":
      return { verb: "Name", prompt: "Name a card. If you discard it from the deck you choose next, the damage is 2 instead of 1." };
    case "DiscardFromAnyDeck":
      return { verb: "Discard", prompt: `Choose the deck whose top ${instruction.count === 1 ? "card is" : `${instruction.count} cards are`} discarded.` };
    default:
      return null;
  }
}

/** The questions that need the game to be worded: the ship a Campaign Setup choice is for (the fitting's ship is the first without a Modification boon, the trade's is
 * `instruction.ship`), the hero a trade pays, the second ship of a lone player, and the excess damage a Ship objective takes. Null for any other pick. `options` are the ids
 * the sheet offers. */
export function seaAsk(pick: Instruction, next: Instruction | undefined, options: readonly string[], game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, sourceId: string | null, after: readonly Instruction[] = []): PickWords | null {
  if (pick.verb === "FitShips") {
    const ship = controlledShips(game, ctx).find((id) => !(game.cards[id]?.attachments ?? []).some((attached) => pick.codes.includes(game.cards[attached]?.code ?? "")));
    return { verb: "Fit", prompt: ship ? `${names.card(ship)}: choose a Modification boon to attach.` : "Choose a Modification boon to attach." };
  }
  if (pick.verb === "TradeShipDamage") {
    if (pick.hero === "?") return { verb: "Add", prompt: `Choose the hero who gets ${resources(pick.resources)}.` };
    const ship = pick.ship ? `${names.card(pick.ship)}: ` : "";
    return { verb: "Trade", prompt: `${ship}${ship ? "deal" : "Deal"} ${pick.damage} damage to it to add ${resources(pick.resources)} to a hero's pool?` };
  }
  if (pick.verb === "PrepareFleet") {
    // A lone player takes the Dream-chaser and then one other ship: the second choice names itself. The Dream-chaser is mentioned only while it can still be taken.
    if (game.seatCount === 1 && options.length > 0 && !options.some((id) => names.card(id) === DREAM_CHASER)) return { verb: "Take", prompt: "Choose your second ship." };
    const open = options.some((id) => names.card(id) === DREAM_CHASER);
    return { verb: "Take", prompt: open ? "Choose a Ship objective to take control of. One player must take the Dream-chaser." : "Choose a Ship objective to take control of." };
  }
  // Corsair Skirmisher's discard (12125:A:3): the Willpower the allies already chosen leave to reach.
  if (pick.verb === "DiscardAlliesForWillpower") {
    const taken = pick.taken ?? [];
    const have = taken.reduce((sum, id) => sum + (game.cards[id] ? modifiedStat(game, game.cards[id], "willpower", ctx.cards) : 0), 0);
    const left = Math.max(0, pick.willpower - have);
    const host = sourceId ? names.card(sourceId) : "This card";
    return { verb: "Discard", prompt: `${host}: choose ${taken.length === 0 ? "an ally" : "another ally"} to discard. At least ${left}${taken.length === 0 ? "" : " more"} Willpower is needed to take control of it as a Ship objective.` };
  }
  // The engagement checks of the second stage's end (12122:A:1): the seat whose check is tied.
  if (pick.verb === "MakeEngagementChecks") {
    const seat = livingSeats(game)[pick.ordinal ?? 0] ?? 0;
    return { verb: "Engage", prompt: `Choose the enemy that engages ${game.seatCount > 1 ? `Player ${seat + 1}` : "you"}. These are tied for the highest engagement cost.` };
  }
  if (pick.verb === "Pick" && next?.verb === "DamageShip") {
    if (typeof next.amount === "number") return { verb: "Assign", prompt: `Choose the Ship objective you control that takes ${next.amount} damage.` };
    const amount = resolveAmount(game, next.amount, frameScope(game, game.activeSeat, sourceId), ctx);
    return { verb: "Assign", prompt: amount > 0 ? `Choose the Ship objective you control that takes ${amount} excess damage.` : "Choose the Ship objective you control that takes the excess damage." };
  }
  // A Raider enemy that gets resources (Watch Tower's Shadow, 12156:A:2; Foes of Ecthelion, 12163:A:1): the player chooses which.
  if (pick.verb === "Pick" && pick.pick.type === "enemy" && pick.pick.trait === "Raider" && next?.verb === "PlaceResourceTokens" && next.on === "picked") {
    const host = sourceId ? names.card(sourceId) : "This card";
    const gets = typeof next.amount === "number" ? resources(next.amount) : next.amount.stat === "cost" && next.amount.of === "other" ? "resources equal to the printed cost of the ally destroyed" : "resources";
    return { verb: "Give", prompt: `${host}: choose a Raider enemy ${pick.pick.stagingOnly === true ? "in the staging area " : ""}to get ${gets}.` };
  }
  // Umbar Harbor's Shadow (12162:A:2): the hero who gives the 1 resource, before the attacking Raider that gets it is picked.
  if (pick.verb === "Pick" && pick.pick.type === "hero" && pick.pick.hasResources === true && next?.verb === "Pick" && next.pick.attackingEnemy === true) {
    return { verb: "Give", prompt: `${sourceId ? names.card(sourceId) : "This card"}: choose a hero you control to give 1 resource to the attacking Raider.` };
  }
  // Southern Belfalas's Travel (12154:A:1): any one player reveals the top Corsair card and engages it.
  if (pick.verb === "RevealCorsair" && pick.who === "anyPlayer") {
    return { verb: "Engage", prompt: `${sourceId ? names.card(sourceId) : "This card"}: choose the player who reveals the top card of the Corsair deck and engages it.` };
  }
  // The Black Sword's Refresh Action (11215:B:3): the Sword is the only card that holds the resource, so it is taken without asking and the hero's choice says what it is for.
  const moved = after[0];
  if (pick.verb === "Pick" && pick.pick.type === "hero" && pick.pick.control === "you" && pick.pick.state === "ready" && next?.verb === "Exhaust" && moved?.verb === "MoveResources" && typeof moved.amount === "number") {
    return { verb: "Exhaust", prompt: `Choose a hero you control to exhaust and take ${resources(moved.amount)} from The Black Sword.` };
  }
  // The Black Sword's Refresh Action (11215:B:3): the resource comes off the Sword.
  if (pick.verb === "Pick" && pick.pick.names?.includes("The Black Sword") && next?.verb === "Pick") return { verb: "Take", prompt: "The Black Sword gives 1 resource to the hero who exhausts." };
  return null;
}

const DREAM_CHASER = "Dream-chaser";

/** The label of an option a sea verb offers that is not a card: trade or keep the damage, a deck to discard from, a title to name. Null for a card (the sheet names it). */
export function seaOptionLabel(instruction: Instruction, id: string, game: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): string | null {
  if (instruction.verb === "TradeShipDamage" && (id === "trade" || id === "keep")) {
    return id === "trade" ? `Trade: ${instruction.damage} damage to the ship for ${resources(instruction.resources)}` : "Keep the ship as it is";
  }
  if (instruction.verb === "DiscardFromAnyDeck") {
    if (id === "encounter") return "The encounter deck";
    if (id === "corsair") return "The Corsair deck";
    if (id.startsWith("seat:")) {
      const seat = Number(id.slice(5));
      return game.seatCount > 1 ? (seat === game.activeSeat ? `Your deck (Player ${seat + 1})` : `Player ${seat + 1}'s deck`) : "Your deck";
    }
  }
  if (instruction.verb === "NameCard" && id.startsWith("name:")) {
    const title = id.slice("name:".length);
    const card = Object.values(game.cards).find((item) => printedOf(cards, item.code).name === title);
    return card ? `${title} · ${titleDeck(printedOf(cards, card.code))}` : title;
  }
  return null;
}

// ---- What the table says of the sea family's pieces (phase 39b; docs/design-system-table.md). Pure, so a test reads every sentence. ----

/** Boarding's beat in the banner (dcce.boarding): "Boarding 2 · Corsair Warship: 2 Corsairs engage Player 1" (solo: "... engage you"). */
export function boardingWords(a: { ship: string; count: number; seat: number; seats: number }): string {
  const who = a.seats > 1 ? `Player ${a.seat + 1}` : "you";
  return `Boarding ${a.count} · ${a.ship}: ${a.count} ${a.count === 1 ? "Corsair engages" : "Corsairs engage"} ${who}`;
}

/** What a screen reader hears of a pile in the second slot: "Corsair deck, 9 cards", "Corsair discard pile, 2 cards". */
export function pileCountWords(name: string, count: number): string {
  return `${name}, ${count} ${count === 1 ? "card" : "cards"}`;
}

/** The reader table's line for the ships: "Ships: Dream-chaser, 3 damage; Dawn Star". */
export function shipsLine(ships: readonly { name: string; damage: number }[]): string {
  return `Ships: ${ships.map((ship) => (ship.damage > 0 ? `${ship.name}, ${ship.damage} damage` : ship.name)).join("; ")}`;
}

/** The reader table's line for the Heading: "Heading: Rain (off-course)". */
export function headingLine(step: string, onCourse: boolean): string {
  return `Heading: ${step} (${onCourse ? "on-course" : "off-course"})`;
}

/** The Sailing test's title over its look (dcce.sailing-tests): "Sailing test · 2 successes". */
export function sailingTitle(successes: number): string {
  return `Sailing test · ${successes} ${successes === 1 ? "success" : "successes"}`;
}

/** The Sailing commit's title and its note (dcce.sailing-tests, step 2): characters exhaust and look at cards, and add no willpower. */
export const SAILING_COMMIT_TITLE = "Commit to the Sailing test";
export const SAILING_COMMIT_NOTE = "Tap characters to commit them to the test. They exhaust, and each looks at one card from the encounter deck. They add no willpower.";

/** The armed line of the commit's Pass (dcce.sailing-tests): nobody is committed, so nobody looks, and the heading stays shifted. */
export const SAILING_PASS_ARMED = "Tap again: nobody looks, and the heading stays shifted";

/** The commit's readout: "Looks at 5 cards · the Dream-chaser counts as 2 · Calm Waters +2". `total` is every card the test looks at; `counts` are the picked characters that
 * count as more than one, with what gives it; `extra` the additional cards a card in play says to look at, with the cards that say so. */
export function sailingLookWords(total: number, counts: readonly { name: string; weight: number; sources: readonly string[] }[], extra?: { amount: number; sources: readonly string[] }): string {
  const base = `Looks at ${total} ${total === 1 ? "card" : "cards"}`;
  const extras = counts.map((row) => `the ${row.name} counts as ${row.weight}${row.sources.length > 0 ? ` (${row.sources.join(", ")})` : ""}`);
  const more = extra && extra.amount > 0 ? [`${extra.sources.join(", ")} +${extra.amount}`] : [];
  return [base, ...extras, ...more].join(" · ");
}

/** The heading change in words ("Rain to Sun", or "Sun, no change"). */
export function headingChangeWords(from: string, to: string): string {
  return from === to ? `${from}, no change` : `${from} to ${to}`;
}

/** What one tap on "Shift on-course" does, and how many symbols the test would still ask after it: "Rain to Cloud · 1 more symbol". */
export function shiftReadoutWords(from: string, to: string, more: number): string {
  return more > 0 ? `${headingChangeWords(from, to)} · ${more} more ${more === 1 ? "symbol" : "symbols"}` : headingChangeWords(from, to);
}

/** A looked-at card's success in words, on the tray row and for a screen reader: "Success", or "Success ×2" with two symbols. */
export function successWords(success: number): string {
  return success === 1 ? "Success" : `Success ×${success}`;
}

/** The success medallion's count: "×2" with two symbols, nothing with one. */
export function medallionCount(success: number): string | null {
  return success > 1 ? `×${success}` : null;
}

/** The pill on a location that holds Ship enemies out of play (Belfalas Islet, 12129:A:2): "1 held", with the sentence a screen reader hears after the location's name: "Corsair Warship held underneath". */
export function heldWords(names: readonly string[]): { text: string; loses: boolean; speech: string } {
  return { text: `${names.length} held`, loses: false, speech: `${names.join(" and ")} held underneath` };
}
