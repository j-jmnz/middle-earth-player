// Rules: emce.discover, emce.loot, emce.treasure, rr.first-player, rr.optional-engagement, rr.player-elimination (data/rules/entries.json); ledger lines 19094:A:3, 19096:A:3, 19101:A:2, 19104:A:2, 19106:A:1, 19099:A:3, 19110:B:1, 19108:A:2, 12189:B:2, 12189:B:3, 12191:A:1, 12192:A:1.
// The choices of The Ghost of Framsburg on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player, and the cost or consequence before an irreversible choice. One player's choice leads with "Player N:" two-handed
// (`owned`, so the sheet adds no "Player N chooses."), solo it has no lead; the first player's choice for the group is not owned, so the sheet adds who chooses. The words read the shape of a record's instructions, never a card code or an effect id. Pure.
import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { flagged, heldLeast, livingSeats, type GameEvent, type ScenarioState } from "../../rules/core/state.ts";
import { uniqueEnemiesEngaged } from "../../rules/families/wilderland/engage.ts";
import { discoverValue } from "../../rules/families/wilderland/discover.ts";
import { undiscoveredTreasures } from "../../rules/families/wilderland/treasure.ts";
import { constantVerbCodes } from "../../rules/interpret/constant-records.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";
import { seatSays } from "./seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;
type Facts = { game: ScenarioState; ctx: ReduceContext; options: readonly string[] };
type Kind = "discoverValue" | "searching" | "shadowStalker";

const THREAT_ELIMINATION = 50;
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;
const list = (items: readonly string[]): string => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

// Which of the scenario's Choose windows this is, from the instructions of its options; null for another Choose.
function kindOf(choose: Choose): Kind | null {
  const ids = choose.options.map((option) => option.id);
  const has = (id: string, verb: Instruction["verb"]) => choose.options.find((option) => option.id === id)?.instructions.some((step) => step.verb === verb) === true;
  if (choose.options.length === 2 && choose.options.every((option) => option.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "discoverValue"))) return "discoverValue";
  if (choose.options.length === 2 && ids[0] === "threat" && ids[1] === "location" && has("threat", "RaiseThreat") && has("location", "DiscardUntil")) return "searching";
  if (choose.options.length === 2 && ids[0] === "threat" && ids[1] === "staging" && has("threat", "RaiseThreat") && has("staging", "ReturnToStaging")) return "shadowStalker";
  return null;
}

const raiseOf = (choose: Choose, id: string): number => {
  const step = choose.options.find((option) => option.id === id)?.instructions.find((entry) => entry.verb === "RaiseThreat");
  return step?.verb === "RaiseThreat" && typeof step.amount === "number" ? step.amount : 1;
};

/** What Discover looks at now: the active location and its value, the cards on top of the encounter deck that value reaches, the Loot objectives among them and the Hazard cards among them. */
function lookedAt(game: ScenarioState, ctx: ReduceContext, seat: number): { place: string | null; depth: number; loot: number; hazards: readonly string[] } {
  const depth = discoverValue(game, ctx, seat);
  const looked = game.encounterDeck.slice(0, depth);
  const loot = constantVerbCodes(ctx, "Loot");
  return {
    place: game.activeLocation,
    depth,
    loot: looked.filter((id) => loot.has(game.cards[id]?.code ?? "")).length,
    hazards: looked.filter((id) => !loot.has(game.cards[id]?.code ?? "") && hasTrait(game, id, "Hazard", ctx)),
  };
}

/**
 * What becomes of the Hazard cards a Discover looked at (emce.discover): one is selected at random, revealed and added to the staging area; a treachery has no place there, so its When Revealed effect resolves and it is discarded. Copies of one card are named as copies.
 * Empty with no Hazard card among them.
 */
function hazardWords(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, hazards: readonly string[]): string {
  if (hazards.length === 0) return "";
  const codes = new Set(hazards.map((id) => game.cards[id]?.code ?? id));
  const treacheries = hazards.filter((id) => printedOf(ctx.cards, game.cards[id]?.code ?? "").type === "treachery").length;
  const which = hazards.length === 1 ? "the 1 Hazard card looked at" : codes.size === 1 ? `1 of the ${hazards.length} copies of ${names.card(hazards[0] ?? "")} looked at` : `1 of the ${hazards.length} Hazard cards looked at, picked at random,`;
  const fate = treacheries === 0 ? "is revealed and added to the staging area" : treacheries === hazards.length ? "is revealed, its When Revealed effect resolves and it is discarded" : "is revealed: an enemy or location is added to the staging area, a treachery resolves its When Revealed effect and is discarded";
  return `${which} ${fate}, and `;
}

/** The unique enemies engaged with a seat, named. */
const uniquesOf = (game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, seat: number): string[] => uniqueEnemiesEngaged(game, seat, ctx.cards).map((id) => names.card(id));

/**
 * The sentence a pick or an ask of The Ghost of Framsburg makes: the Loot objective a Discover attaches and what happens to the rest of the cards looked at (19106:A:1, ResolveDiscover, and the keyword itself), the Loot objective an enemy guards (19101:A:2), Crypt Key's choice of the Discover
 * location whose value it changes (19094:A:3), Scatha's Teeth's choice of the player who reduces their threat (19096:A:3), the character Slammed Shut exhausts (19108:A:2) and the player Gundabad Hunter attacks (12191:A:1). Null for any other pick.
 */
export function framsburgAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  const says = facts ? seatSays(facts.game) : null;
  // `name`: the card that asks leads the sentence with the one colon ("Player 1, Crypt Key: ..."), not a second one after "Player 1:".
  const sentence = (verb: string, text: string, name?: string): PickWords => {
    if (says) return { verb, prompt: name ? says.titled(name, text) : says.say(text), ...says.owned };
    const whole = name ? `${name}: ${text}` : text;
    return { verb, prompt: `${whole.charAt(0).toUpperCase()}${whole.slice(1)}` };
  };
  // A choice the first player makes for the group is not owned: the sheet adds who chooses.
  const group = (verb: string, text: string): PickWords => ({ verb, prompt: `${text.charAt(0).toUpperCase()}${text.slice(1)}` });
  const card = source ? names.card(source) : "this card";
  const now = (instruction.verb === "Discover" || instruction.verb === "ResolveDiscover") && facts && says ? lookedAt(facts.game, facts.ctx, says.seat) : null;
  if (now && facts && says && now.depth > 0) {
    const place = now.place ? names.card(now.place) : "the active location";
    const rest = `${hazardWords(facts.game, facts.ctx, names, now.hazards)}the other cards looked at`;
    const looked = `The top ${plural(now.depth, "card")} of the encounter deck were looked at: ${now.loot === 1 ? "1 of them is a Loot objective" : `${now.loot} of them are Loot objectives`}. Choose 1 to attach to ${place} as a guarded objective; ${rest} go to the encounter discard pile.`;
    if (instruction.verb === "Discover") return group("Attach", `Discover ${now.depth} at ${place}. ${looked}`);
    return sentence("Attach", `resolve Discover ${now.depth} at ${place}. ${looked}`, card);
  }
  // The treasure the Response of the campaign card attaches (12189:B:2) is attached to the enemy that engaged a player, the subject of the Response: the first player chooses it for the group.
  if (instruction.verb === "AttachRandomTreasure" && instruction.to === "subject" && facts) {
    const data = topFrame(facts.game)?.data;
    const guard = data?.kind === "effect" && data.subject ? names.card(data.subject) : "The enemy";
    return group("Choose", `Choose 1 of ${facts.options.length || instruction.count || 3} random undiscovered treasures to attach as a guarded objective. ${guard} stays engaged; the players cannot claim the treasure until it is free of encounters, when ${guard} leaves play.`);
  }
  if (instruction.verb === "AttachLootFromDiscard") return sentence("Attach", `choose a Loot objective in the encounter discard pile to attach to the enemy just added to the staging area, as its guarded objective.`);
  if (instruction.verb !== "Pick") return null;
  const pick = instruction.pick;
  if (pick.type === "location" && pick.active === true && next?.verb === "Choose" && next.options.some((option) => option.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "discoverValue"))) {
    const only = facts?.options.length === 1 ? facts.options[0] : undefined;
    return sentence("Choose", `choose the location you traveled to${only ? ` (${names.card(only)})` : ""}, then add 1 to its Discover value or take 1 off it before the keyword resolves.`, card);
  }
  if (pick.type === "player" && next?.verb === "LowerThreat" && next.who === "picked") return sentence("Choose", `choose a player to reduce their threat by ${typeof next.amount === "number" ? next.amount : 2}.`, card);
  if (pick.type === "player" && pick.engagedWithUnique === true && facts) {
    const engaged = facts.options.map((option) => {
      const seat = Number(option.replace("seat:", ""));
      const uniques = Number.isInteger(seat) ? uniquesOf(facts.game, facts.ctx, names, seat) : [];
      return uniques.length > 0 ? `${facts.game.seatCount > 1 ? `Player ${seat + 1}` : "you"} with ${list(uniques)}` : null;
    }).filter((part): part is string => part != null);
    return group("Choose", `${card}: choose a player engaged with a unique enemy${engaged.length > 0 ? ` (${list(engaged)})` : ""}. ${card} makes an immediate attack against that player from the staging area.`);
  }
  // A When Revealed effect that has each player in turn exhaust a ready character they control (19108:A:2); a cost or an effect of any other card keeps its own words.
  const eachExhausts = facts != null && source != null && effectsOf(facts.ctx, facts.game.cards[source]?.code ?? "").some((effect) => effect.timing === "whenRevealed" && effect.instructions.some((step) => step.verb === "ForEachPlayer" && step.instructions.some((inner) => inner.verb === "Pick" && JSON.stringify(inner.pick) === JSON.stringify(pick))));
  if (pick.type === "character" && pick.state === "ready" && next?.verb === "Exhaust" && eachExhausts) return sentence("Exhaust", "choose a ready character you control to exhaust. It cannot be readied by player card effects this round.", card);
  return null;
}

/** The Discover value of the active location and what the Crypt Key-style choice makes of it: the value now, and what each option leaves it, never below 0. */
function valueAfter(game: ScenarioState, ctx: ReduceContext, seat: number, change: number): number {
  return Math.max(0, discoverValue(game, ctx, seat) + change);
}

/** Every living seat that reaches 50 threat when `amount` is added (one seat, or all of them), told for the caution of a branch that raises threat. */
function eliminated(game: ScenarioState, seats: readonly number[], amount: number): number[] {
  return seats.filter((seat) => (game.seats[seat]?.threat ?? 0) + amount >= THREAT_ELIMINATION);
}

/** The sentence over a Choose of The Ghost of Framsburg: Crypt Key's change of a Discover value (19094:A:3), the first player's choice at Searching the Ruins (19110:B:1) and the Shadow of Crypt Stalker (19099:A:3). Null for any other Choose. */
export function framsburgChooseNote(choose: Choose, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, source?: string | null): string | null {
  const kind = kindOf(choose);
  if (!kind) return null;
  const { titled, seat } = seatSays(game);
  const card = source ? names.card(source) : "this card";
  if (kind === "discoverValue") {
    const place = game.activeLocation ? names.card(game.activeLocation) : "the location";
    const value = discoverValue(game, ctx, seat);
    return titled(card, `${place} has Discover ${value}. Change it until the end of the phase, before the keyword resolves.`);
  }
  if (kind === "searching") {
    const raise = raiseOf(choose, "threat");
    const threats = livingSeats(game).map((index) => (game.seatCount > 1 ? `Player ${index + 1} ${game.seats[index]?.threat ?? 0}` : `${game.seats[index]?.threat ?? 0}`));
    return `${card}: raise each player's threat by ${raise} (now ${list(threats)}), or discard cards from the encounter deck until a location is discarded and add it to the staging area?`;
  }
  const raise = raiseOf(choose, "threat");
  const attacker = game.pendingAttack?.enemyId;
  return titled(card, `raise your threat by ${raise} (now ${game.seats[seat]?.threat ?? 0}), or return ${attacker ? names.card(attacker) : "the attacking enemy"} to the staging area, which ends the attack?`);
}

/** The rows a Choose of Crypt Key's kind or of the Shadow of Crypt Stalker states with what is true now: the Discover value after each option (never below 0), the enemy the Shadow returns to the staging area. Empty for any other Choose. */
export function framsburgBranchNow(game: ScenarioState, ctx: ReduceContext, choose: Choose, seat: number): Readonly<Record<string, string>> {
  const kind = kindOf(choose);
  if (kind === "shadowStalker") {
    const attacker = game.pendingAttack?.enemyId;
    return attacker ? { staging: `Return ${printedOf(ctx.cards, game.cards[attacker]?.code ?? "").name} to the staging area` } : {};
  }
  if (kind !== "discoverValue" || !game.activeLocation) return {};
  return Object.fromEntries(choose.options.map((option) => {
    const change = option.id === "increase" ? 1 : -1;
    return [option.id, `${change > 0 ? "Add 1" : "Take 1 off"} (Discover ${valueAfter(game, ctx, seat, change)})`];
  }));
}

/** The row of an option of that Choose, or null for another. */
export function framsburgBranchWords(choose: Choose, optionId: string, rows?: Readonly<Record<string, string>>): string | null {
  const kind = kindOf(choose);
  if (!kind) return null;
  if (kind === "discoverValue") return rows?.[optionId] ?? (optionId === "increase" ? "Add 1" : "Take 1 off");
  if (kind === "searching") return optionId === "threat" ? `Each player raises their threat by ${raiseOf(choose, "threat")}` : "Discard cards until a location is discarded, then add it to the staging area";
  return optionId === "threat" ? `Raise your threat by ${raiseOf(choose, "threat")}` : (rows?.[optionId] ?? "Return the attacking enemy to the staging area");
}

/** "Tap again: ..." for raising threat when it eliminates a player: every living player (the game is lost) or some of them. Null when nobody reaches 50. */
function lossCaution(game: ScenarioState, reached: readonly number[]): string | null {
  if (reached.length === 0) return null;
  if (reached.length === livingSeats(game).length) return `Tap again: ${game.seatCount > 1 ? "every player reaches" : "you reach"} ${THREAT_ELIMINATION} threat and the game is lost`;
  return `Tap again: ${list(reached.map((index) => `Player ${index + 1}`))} ${reached.length === 1 ? "reaches" : "reach"} ${THREAT_ELIMINATION} threat and ${reached.length === 1 ? "is" : "are"} eliminated`;
}

/** The caution of the branch that raises threat: armed when it eliminates a player. Null for another branch. */
export function framsburgBranchCaution(choose: Choose, optionId: string, game: ScenarioState, seat: number): string | null {
  const kind = kindOf(choose);
  if (!kind || kind === "discoverValue" || optionId !== "threat") return null;
  return lossCaution(game, eliminated(game, kind === "searching" ? livingSeats(game) : [seat], raiseOf(choose, "threat")));
}

/** The caution of an Action that makes every player raise their threat (the campaign card's, 12189:B:3): armed when it eliminates a player, so the first tap cannot lose the game. Null for another Action or when nobody reaches 50. */
export function framsburgActionCaution(game: ScenarioState, effect: Pick<Effect, "instructions">): string | null {
  const raises = effect.instructions.find((step) => step.verb === "RaiseThreat" && step.who === "eachSeat");
  if (!effect.instructions.some((step) => step.verb === "ShuffleEncounterDiscard") || raises?.verb !== "RaiseThreat") return null;
  return lossCaution(game, eliminated(game, livingSeats(game), typeof raises.amount === "number" ? raises.amount : 1));
}

/**
 * The sentence over the Response window of a Discover location's travel (Crypt Key, 19094:A:3) or of Fram's Shade engaging a player (the campaign card, 12189:B:2), when one of the Responses offered is its own. Null for another event.
 */
export function framsburgResponseNote(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, event: GameEvent | null, offered: readonly string[]): string | null {
  const seat = game.window?.kind === "response" ? game.window.seat : game.firstPlayer;
  const { say } = seatSays(game, seat);
  const records = (cardId: string): readonly Effect[] => effectsOf(ctx, game.cards[cardId]?.code ?? "").filter((effect) => effect.timing === "response" && effect.trigger === event?.trigger);
  const has = (cardId: string, test: (step: Instruction) => boolean) => records(cardId).some((effect) => effect.instructions.some(test));
  const adjusting = offered.find((cardId) => has(cardId, (step) => step.verb === "Choose" && kindOf(step) === "discoverValue"));
  if (event?.trigger === "traveled" && adjusting) {
    const place = event.cardId ?? game.activeLocation;
    const value = discoverValue(game, ctx, seat);
    return say(`you traveled to ${place ? names.card(place) : "a Discover location"}, Discover ${value}. ${names.card(adjusting)} may be exhausted now to add 1 to that value or take 1 off it; the keyword resolves after this window. Pass and it resolves as printed.`);
  }
  const attaching = offered.find((cardId) => has(cardId, (step) => step.verb === "AttachRandomTreasure"));
  if (event?.trigger === "engaged" && attaching) {
    const enemy = event.subject ?? event.cardId;
    const shade = enemy ? names.card(enemy) : "The enemy";
    const left = Math.min(3, undiscoveredTreasures(game, ctx).length);
    if (left === 0) return say(`${shade} engaged you. No undiscovered treasure is left to look at, so nothing can be attached to ${shade}.`);
    return say(`${shade} engaged you. Look at ${left === 1 ? "the 1 random undiscovered treasure" : `${left} random undiscovered treasures`} and attach 1 to ${shade} as a guarded objective: ${shade} stays engaged with you, the players cannot claim the treasure until it is free of encounters, when ${shade} leaves play, and if they win with it they discover it. Group limit once per game. Pass and it stays unused for a later engagement at stage 1B or 2B.`);
  }
  return null;
}

/** The cap on what player card effects reduce a player's threat by each round (19104:A:2): the card holding it in the staging area, the smallest cap any copy sets (copies do not add up), and what a seat may still lower this round. Null with no cap. */
export function framsburgThreatCap(game: ScenarioState, seat: number, names: Pick<ChoiceNames, "card">): { holder: string; cap: number; left: number } | null {
  const cap = heldLeast(game, `seat:${seat}`, "playerThreatReductionCap");
  if (cap <= 0) return null;
  const holder = game.staging.find((id) => flagged(game, id, "playerThreatReductionCap")) ?? game.staging[0];
  return { holder: holder ? names.card(holder) : "A card in the staging area", cap, left: Math.max(0, cap - (game.playerThreatLoweredBy?.[seat] ?? 0)) };
}

/** The sentence under an Action of The Ghost of Framsburg: the campaign card's (each player raises their threat to shuffle the encounter discard pile, 12189:B:3) with the players it would eliminate, and a player card's threat reduction under the cap the card in the staging area sets (19104:A:2). Null for another card's Action. */
export function framsburgActionNote(game: ScenarioState, ctx: ReduceContext, effect: Pick<Effect, "instructions" | "cardCode">, names: Pick<ChoiceNames, "card">, sourceId: string): string | null {
  const shuffles = effect.instructions.some((step) => step.verb === "ShuffleEncounterDiscard");
  const raises = effect.instructions.find((step) => step.verb === "RaiseThreat" && step.who === "eachSeat");
  if (shuffles && raises?.verb === "RaiseThreat") {
    const amount = typeof raises.amount === "number" ? raises.amount : 1;
    const pile = game.encounterDiscard.length;
    const out = eliminated(game, livingSeats(game), amount);
    const solo = game.seatCount === 1;
    const warning = out.length === 0 ? "" : out.length === livingSeats(game).length ? ` ${solo ? "Your threat would reach 50 and the game would be lost." : "Every player would reach 50 threat and the game would be lost."}` : ` ${list(out.map((seat) => `Player ${seat + 1}`))} would reach 50 threat and be eliminated.`;
    return `Each player raises their threat by ${amount}, then the encounter discard pile (${plural(pile, "card")}) is shuffled into the encounter deck. Any player may use it.${warning}`;
  }
  const lowers = effect.instructions.some((step) => step.verb === "LowerThreat");
  if (!lowers || !printedOf(ctx.cards, effect.cardCode).type || ["objective", "location", "enemy", "treachery"].includes(printedOf(ctx.cards, effect.cardCode).type ?? "")) return null;
  const seat = game.window?.kind === "response" ? game.window.seat : game.activeSeat;
  const { say } = seatSays(game, seat);
  const source = names.card(sourceId);
  const own = framsburgThreatCap(game, seat, names);
  if (!own) return null;
  // An effect that lets its player choose whose threat goes down: every player's own room, not only the user's.
  const picks = effect.instructions.some((step) => step.verb === "LowerThreat" && step.who === "picked") && livingSeats(game).length > 1;
  if (picks) {
    const rooms = livingSeats(game).map((index) => `Player ${index + 1} has ${framsburgThreatCap(game, index, names)?.left ?? 0} left`);
    return say(`${own.holder} is in the staging area. Player card effects reduce a player's threat by ${own.cap} at most each round. ${list(rooms)} this round.`);
  }
  const room = own.left === 0 ? `Your ${own.cap} for this round is used, so ${source} reduces it by 0.` : `${own.left === own.cap ? "You have not lowered it yet this round" : `You have ${own.left} left this round`}, so ${source} reduces it by ${own.left} at most.`;
  return say(`${own.holder} is in the staging area. Player card effects reduce your threat by ${own.cap} at most each round. ${room}`);
}

/** The sentence added to the optional engagement (rr.optional-engagement): an enemy only a player engaged with a unique enemy may engage (12192:A:1), and whether the seat is one. Null with no such enemy in the staging area. */
export function framsburgEngageNote(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, seat: number): string | null {
  const barred = game.staging.filter((id) => game.cards[id] && flagged(game, id, "optionalEngageUnique"));
  if (barred.length === 0) return null;
  const uniques = uniquesOf(game, ctx, names, seat);
  const name = list([...new Set(barred.map((id) => names.card(id)))]);
  const many = barred.length > 1;
  const rule = `${name} may be engaged only by a player engaged with a unique enemy`;
  return uniques.length > 0 ? `${rule}, and you are engaged with ${list(uniques)}, so you may choose ${many ? "them" : "it"}.` : `${rule}, and you are not engaged with one, so you cannot choose ${many ? "them" : "it"} here.`;
}
