// Rules: emce.treasure, rr.guarded (data/rules/entries.json); ledger lines 12168:A:2, 12189:B:2, 18074:A:1, 18075:A:1, 18076:A:1. What the table says when the players look at random undiscovered treasures and choose one to attach as a
// guarded objective (AttachRandomTreasure). The sentence the choice sheet reads from. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import { recordsOfFace } from "../../rules/families/dreamchaser/faces.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { undiscoveredTreasures } from "../../rules/families/wilderland/treasure.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import { countMatching } from "../../rules/interpret/pick.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import type { BranchNow } from "./aflame.ts";
import type { ChoiceNames, PickWords } from "./choice.ts";
import { heathAsk, heathBranchWords, heathChooseNote, heathOptionLabel } from "./heath.ts";
import { askedSeat, seatSays } from "./seat.ts";
import { assignDamageWords } from "./south.ts";

/** The table the words read: what is dealt now, the records, and the options the window offers. */
type Facts = { game: ScenarioState; ctx: ReduceContext; options: readonly string[] };

/** Whether the instruction draws random treasures for the players to choose among: the first step of a treasure draw (AttachRandomTreasure, ClaimRandomTreasure). */
export function isTreasureDraw(instruction: Instruction): instruction is Extract<Instruction, { verb: "AttachRandomTreasure" | "ClaimRandomTreasure" }> {
  return instruction.verb === "AttachRandomTreasure" || instruction.verb === "ClaimRandomTreasure";
}

// What a treasure attaches to, from its record ("Attach to a hero" for the one hero-only treasure, 12199:A:1): the noun of the character step.
function hostNoun(facts: Facts | undefined, treasure: string | null): string {
  const code = treasure ? facts?.game.cards[treasure]?.code : undefined;
  const host = code ? facts?.ctx.effects.flatMap((effect) => (effect.cardCode === code ? effect.instructions : [])).find((step) => step.verb === "AttachesTo") : undefined;
  return host?.verb === "AttachesTo" && host.host?.kind === "hero" ? "hero" : "character";
}

// Weighed Down (18027:A:1), on its way to a hero and on that hero's readying: who it goes to, and which attachment is discarded.
function weighedDownAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  const name = source ? names.card(source) : "This card";
  if (instruction.verb === "AttachSelf" && instruction.to.kind === "hero" && instruction.to.control === "mostAttachments") {
    const options = facts?.options ?? [];
    return options.length > 1
      ? { verb: "Attach", prompt: `Heroes are tied for the most attachments: choose who gets ${name}. That hero is exhausted.` }
      : { verb: "Attach", prompt: `${name} attaches to ${options[0] ? names.card(options[0]) : "the hero with the most attachments"}. That hero is exhausted.` };
  }
  const host = source ? facts?.game.cards[source]?.host : null;
  if (instruction.verb !== "Pick" || instruction.pick.attachedTo !== "host" || next?.verb !== "Discard" || next.target.kind !== "picked" || !host) return null;
  const hero = names.card(host);
  const itself = source != null && facts?.options.includes(source) === true;
  return { verb: "Discard", prompt: `${name}: choose an attachment to discard from ${hero}.${itself ? ` ${name} can discard itself: ${hero} has no other attachment that is not an objective.` : ""}` };
}

function stageAsk(instruction: Instruction, facts: Facts | undefined): PickWords | null {
  const game = facts?.game;
  if (!game || (instruction.verb !== "PlaceHandUnderLocation" && instruction.verb !== "SearchNemesis")) return null;
  const { seat, owned, say } = seatSays(game);
  if (instruction.verb === "SearchNemesis") {
    const hitPoints = facts.options[0] ? printedOf(facts.ctx.cards, game.cards[facts.options[0]]?.code ?? "").health : undefined;
    return { verb: "Choose", prompt: say(`${facts.options.length} enemies are tied for the most hit points${hitPoints != null ? ` (${hitPoints})` : ""}. Choose the nemesis: it enters the staging area with +2 Threat, Attack and Defense and attacks the first player at the end of each round.`), ...owned };
  }
  const count = game.seats[seat]?.hand.length ?? 0;
  const cardsWord = count === 1 ? "card" : "cards";
  return { verb: "Choose", prompt: say(`put your ${count} ${cardsWord} facedown under a location in the staging area. It gets +${count} quest ${count === 1 ? "point" : "points"}, the ${cardsWord} ${count === 1 ? "returns" : "return"} to your hand when it is explored, and ${count === 1 ? "is" : "are"} discarded if the players advance.`), ...owned };
}

// The search Twilight Hall offers at Setup (12168:A:2): the Choose the engine queues, whose branches search for the card and guard a treasure with it, or leave it.
function searchOffer(choose: Extract<Instruction, { verb: "Choose" }>): { code: string; count: number } | null {
  const search = choose.options.find((option) => option.id === "search");
  const find = search?.instructions.find((step) => step.verb === "SearchMove");
  const draw = search?.instructions.find((step) => step.verb === "AttachRandomTreasure");
  return choose.options.length === 2 && find?.verb === "SearchMove" && find.code != null && draw?.verb === "AttachRandomTreasure" ? { code: find.code, count: draw.count ?? 3 } : null;
}

/** The sentence over the Twilight Hall search offer (12168:A:2): the card, where it enters and the treasures it will guard, as many as are left to draw. Null for any other Choose. */
export function wilderlandChooseNote(choose: Extract<Instruction, { verb: "Choose" }>, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, seat?: number, source?: string | null): string | null {
  // Dagnir's Spawn (12173:A:2): each player decides for their own characters, so two-handed the note leads with the player.
  const spread = choose.options.map(distributeBranch).find((assign) => assign != null);
  if (spread) {
    const damage = resolveAmount(game, spread.amount, frameScope(game, seat ?? game.firstPlayer, source ?? null), ctx);
    const text = `distribute ${damage} damage among characters you control? If you do, ${source ? names.card(source) : "this card"} is shuffled into the encounter deck.`;
    return game.seatCount > 1 ? `Player ${(seat ?? game.firstPlayer) + 1}: ${text}` : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  }
  const heath = heathChooseNote(choose, game, names);
  if (heath) return heath;
  const offer = searchOffer(choose);
  if (!offer) return null;
  const left = Math.min(offer.count, undiscoveredTreasures(game, ctx).length);
  const hall = names.code(offer.code);
  const guard = left === 0 ? "No undiscovered treasure is left to guard." : `It enters the staging area guarding ${left === 1 ? "the 1 random undiscovered treasure" : `1 of ${left} random undiscovered treasures`}.`;
  return `Search the encounter deck for ${hall}? ${guard}`;
}

/** Whether the effect frame is the claim of a freed guarded treasure (the settle sweep, mirkwood.ts freeTreasures): its source is the treasure itself, picked from the start. */
export function isFreedTreasureClaim(game: ScenarioState, ctx: ReduceContext, source: string | null, picked: string | null): boolean {
  return source != null && source === picked && ctx.cards.get(game.cards[source]?.code ?? "")?.campaignKind === "treasure";
}

/** The sentence and the verb of the choice AttachRandomTreasure, ClaimRandomTreasure or Discover asks, or the character a claimed treasure goes on, or null for another instruction. */
export function wilderlandAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next?: Instruction, picked?: string | null, facts?: Facts): PickWords | null {
  // The character a claimed treasure is attached to (120165:A:3): the Pick of a card it may attach to (`hostForPicked`) before AttachPicked; the treasure is named once the table knows it.
  if (instruction.verb === "Pick" && instruction.pick.hostForPicked === true && next?.verb === "AttachPicked") {
    const noun = hostNoun(facts, picked ?? null);
    // A guarded treasure whose guard left play (emce.treasure: "once that treasure is free of encounters, the players claim it").
    if (facts && picked && isFreedTreasureClaim(facts.game, facts.ctx, source, picked)) {
      const searched = facts.ctx.effects.flatMap((effect) => effect.instructions).find((step) => step.verb === "SearchGuardForTreasure");
      const guard = searched?.verb === "SearchGuardForTreasure" ? names.code(searched.code) : "Its guard";
      return { verb: "Attach", prompt: `${guard} has left play: ${names.card(picked)} is free of encounters and the players claim it. Choose a ${noun} to carry it.` };
    }
    return { verb: "Attach", prompt: picked ? `Choose a ${noun} to carry ${names.card(picked)}.` : `Choose a ${noun} to attach it to.` };
  }
  // Turayn's Response (12166:A:2): the next damage the chosen character is dealt this round is lessened.
  if (instruction.verb === "Pick" && next?.verb === "ModifyStat" && next.stat === "damageShield") {
    const amount = typeof next.amount === "number" ? next.amount : 1;
    return { verb: "Protect", prompt: `Choose another character: the next time it would be dealt damage this round, cancel ${amount} of that damage.` };
  }
  const stage = stageAsk(instruction, facts) ?? carriedAwayAsk(instruction, next, facts);
  if (stage) return stage;
  const weighed = weighedDownAsk(instruction, source, names, next, facts);
  if (weighed) return weighed;
  // Discover X looked at several Loot objectives: the first player picks the one to attach to the active location (emce.discover).
  if (instruction.verb === "Discover") return { verb: "Attach", prompt: `Discover: choose 1 Loot objective to attach to ${source ? names.card(source) : "the active location"} as a guarded objective.` };
  // The treasures drawn, as many as there are (3 unless fewer are undiscovered): the step chooses one, the character step after it attaches it.
  const drawn = isTreasureDraw(instruction) ? (facts?.options.length || instruction.count || 3) : 0;
  // ClaimRandomTreasure (120165:A:3): the treasure is claimed for a character; the choice of the character follows (choice.ts, AttachPicked).
  if (instruction.verb === "ClaimRandomTreasure") return { verb: "Choose", prompt: `Choose 1 of ${drawn} random undiscovered treasures to attach to a character.` };
  // The Shadow card of Frenzied Creature goes on the attacking enemy, whom nobody chooses (18018:A:2).
  if (instruction.verb === "AttachSelf" && instruction.to.kind === "attackingEnemy") return { verb: "Attach", prompt: `Attach ${source ? names.card(source) : "this card"} to the attacking enemy.` };
  // Players tied for the most cards in hand: the first player names who takes the card (18026:A:1).
  if (instruction.verb === "AddSourceToHandOfMost") {
    const card = source ? names.card(source) : "this card";
    return { verb: "Choose", prompt: `Players are tied for the most cards in hand: choose who adds ${card} to their hand. Playing a card then discards that player's whole hand, and player card effects cannot discard ${card}.` };
  }
  const kings = kingsQuestAsk(instruction, source, names, next, facts);
  if (kings) return kings;
  const heath = heathAsk(instruction, source, names, next, facts);
  if (heath) return heath;
  if (instruction.verb !== "AttachRandomTreasure") return null;
  const choose = `Choose 1 of ${drawn} random undiscovered treasures to attach as a guarded objective.`;
  // The guard is attached to the treasure and keeps it from being claimed until it is dealt with (rr.guarded). It is the card the record picked (Twilight Hall, searched for by the campaign card) or the source itself.
  const guardId = instruction.to === "picked" && picked ? picked : source;
  if (!guardId) return { verb: "Choose", prompt: choose };
  const host = names.card(guardId);
  return { verb: "Choose", prompt: `${choose} ${host} is attached to it, and the players cannot claim it until ${host} is dealt with.` };
}

// The King's Quest's choices (18043:A:3, 18044:A:1, 18047:A:1, 18048:A:1, 18049:A:2, 18049:A:3, 18055:A:2, 18057:A:2, 18058:A:2, 18059:A:2, 18060:A:1, 18061:A:1, 18064:A:1, 12173:A:2, 18079:B:2, 18080:A:1): the sentence each asks, from the verb it opens or the pick before it.
// A choice made by one player at a time names the number, the side of the table and the player (Choice tray): two-handed it leads with "Player N:" (`owned`), solo it has no lead.
function kingsQuestAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  const name = source ? names.card(source) : "This card";
  // The source is the card's instance on the table; the words test hands the card's code.
  const code = source ? (facts?.game.cards[source]?.code ?? source) : undefined;
  const game = facts?.game;
  const says = game ? seatSays(game) : null;
  const ask = (verb: string, text: string): PickWords => (says ? { verb, prompt: says.say(text), ...says.owned } : { verb, prompt: `${text.charAt(0).toUpperCase()}${text.slice(1)}` });
  // The look is one player's: the seat that triggered it. The action first, then where the rest go.
  if (instruction.verb === "ArrangeCaves") return ask("Choose", `keep 1 on top of the Caves deck; the ${instruction.count === 2 ? "other goes" : "others go"} to the bottom.`);
  if (instruction.verb === "AttachSearched") return { verb: "Attach", prompt: `Choose a ${instruction.trait} ${instruction.type} from the encounter deck or its discard pile to attach to ${instruction.to}.` };
  if (instruction.verb === "AttachSelf" && instruction.to.kind === "enemy" && instruction.to.trait === "Dragon") return { verb: "Attach", prompt: `Choose a Dragon enemy to attach ${name} to.` };
  // Stone-troll (18049:A:2): the number of cards is the excess damage the destroyed character took, the frame's X.
  if (instruction.verb === "DiscardFromHand" && typeof instruction.amount === "object" && instruction.amount.excessOf != null && game) {
    const count = frameScope(game, game.activeSeat, source).x ?? 0;
    return ask("Discard", `choose ${count} ${count === 1 ? "card" : "cards"} from your hand to discard, one at a time (1 for each point of excess damage).`);
  }
  if (instruction.verb === "AssignDamage" && (code === "18064" || code === "12173")) {
    const words = assignDamageWords(instruction, null);
    return ask(words.verb, `${words.prompt.charAt(0).toLowerCase()}${words.prompt.slice(1)}`);
  }
  if (instruction.verb !== "Pick") return null;
  const pick = instruction.pick;
  // Stone-troll's excess (18049:A:2) is expanded into one pick and discard for each card; the sheet says how many are left, counting this one.
  if (code === "18049" && pick.from === "hand" && next?.verb === "DiscardPicked" && game) {
    const data = topFrame(game)?.data;
    const left = data?.kind === "effect" ? data.queue.filter((item) => item.instruction.verb === "DiscardPicked").length : 1;
    return ask("Discard", `discard 1 card from your hand (${left} left: 1 for each point of excess damage).`);
  }
  if (next?.verb === "GuardPickedAttachment") return ask("Guard", "choose an Artifact attachment in your hand: it lies in the staging area guarded by a location from the encounter deck, and the players claim it once that location is dealt with.");
  if (code === "18043" && pick.type === "player" && next?.verb === "SwitchActor") return { verb: "Choose", prompt: "Choose the player who puts an Artifact from their hand in the staging area, guarded by a location." };
  if (next?.verb === "AttackFromStaging" && pick.highestAttack === true) {
    const first = game && facts?.options[0] && game.cards[facts.options[0]] ? modifiedStat(game, game.cards[facts.options[0]]!, "attack", facts.ctx.cards) : null;
    const tied = facts?.options.length ?? 0;
    // Who the enemy attacks: the chooser when the chooser is the first player, else the first player by number.
    const attacked = game && game.seatCount > 1 && says && says.seat !== game.firstPlayer ? `Player ${game.firstPlayer + 1}` : "you";
    return ask("Choose", `choose the enemy that attacks ${attacked}${tied > 1 ? ` (${tied} tied${first != null ? ` at ${first} Attack` : ""})` : ""}.`);
  }
  if (next?.verb === "AttachSelfToPicked" && pick.type === "hero" && pick.committed === true) return ask("Attach", `choose a questing hero of any player to attach ${name} to. It is removed from the quest.`);
  // Each player's own card: "return 1 card from his discard pile" (18044:A:1), "search his deck" (18060:A:1), "a hero's resource pool" (18061:A:1), "a questing character you control" and "an ally you control" (18057), "an attachment you control" (18049:A:3).
  if (code === "18044" && pick.from === "discard") return ask("Take", "choose a card from your discard pile to return to your hand.");
  if (code === "18060" && pick.from === "deck") return ask("Take", "search your deck: choose a Weapon or Armor attachment to put into your hand. Your deck is then shuffled.");
  if (code === "18061" && pick.type === "hero") return ask("Add", "choose a hero you control to add 1 resource to.");
  if (code === "18057" && pick.committed === true) return ask("Discard", "choose a questing character you control to discard.");
  if (code === "18057" && pick.type === "ally") return ask("Discard", "choose an ally you control to discard.");
  if (code === "18049" && pick.type === "attachment") return ask("Discard", "choose an attachment you control to discard.");
  return null;
}

/** The label of an option of that choice: the treasure's title, or the card a Caves look or a Dragon search offers. Null for another instruction. */
export function wilderlandOptionLabel(instruction: Instruction, id: string, names: ChoiceNames): string | null {
  if (instruction.verb === "ArrangeCaves" || instruction.verb === "AttachSearched") return names.card(id);
  const done = heathOptionLabel(instruction, id, names);
  if (done) return done;
  return isTreasureDraw(instruction) ? names.code(id) : null;
}

// A Choose whose branches count cards at the table (Ruined Supplies, 18025:A:2): the number each states now, read when the sheet is built. Null for any other Choose.
function countedBranch(option: Extract<Instruction, { verb: "Choose" }>["options"][number], choose: Extract<Instruction, { verb: "Choose" }>): Extract<Instruction, { verb: "RaiseThreat" | "DamageEach" }> | null {
  const step = option.instructions.length === 1 ? option.instructions[0] : undefined;
  // Eyes in the Dark (18057:A:2) counts the questing characters, beside a branch that discards one; another card's committed count keeps its own words.
  const questing = choose.options.some((other) => other.instructions.some((entry) => entry.verb === "Discard"));
  if (step?.verb === "RaiseThreat" && typeof step.amount === "object" && step.amount.count != null && step.amount.count.control === "you" && (step.amount.count.committed !== true || questing) && (step.who ?? "actor") === "actor") return step;
  return step?.verb === "DamageEach" && typeof step.amount === "number" && step.pick?.control === "you" && step.engagedWith == null ? step : null;
}

// A branch whose number the table holds now (the victory display's locations, a discarded location's printed Threat, the attackers of a declared attack): "Each player raises threat by X" (18045:A:2, 18078:B:1), "Remove X progress from the quest" (18080:B:2).
function numberedBranch(option: Extract<Instruction, { verb: "Choose" }>["options"][number]): Extract<Instruction, { verb: "RaiseThreat" | "RemoveProgressFromQuest" }> | null {
  const step = option.instructions.length === 1 ? option.instructions[0] : undefined;
  if (step?.verb === "RaiseThreat" && step.who === "eachSeat" && typeof step.amount === "object") return step;
  return step?.verb === "RemoveProgressFromQuest" && typeof step.amount === "object" && step.amount.count != null ? step : null;
}

// A branch that distributes damage among the player's characters and shuffles its source back into the encounter deck (Dagnir's Spawn, 12173:A:2).
function distributeBranch(option: Extract<Instruction, { verb: "Choose" }>["options"][number]): Extract<Instruction, { verb: "AssignDamage" }> | null {
  const [assign, shuffle] = option.instructions;
  return option.instructions.length === 2 && assign?.verb === "AssignDamage" && shuffle?.verb === "ShuffleSelfIntoEncounterDeck" ? assign : null;
}

/** The numbers a Choose states for its branches now: how many cards each count finds for the seat choosing, and the amounts read from the table. */
export function wilderlandBranchNow(game: ScenarioState, ctx: ReduceContext, choose: Extract<Instruction, { verb: "Choose" }>, seat: number, sourceId: string | null): Pick<BranchNow, "counted"> {
  const counted: Record<string, number> = {};
  for (const option of choose.options) {
    const step = countedBranch(option, choose);
    const spec = step?.verb === "RaiseThreat" && typeof step.amount === "object" ? step.amount.count : step?.verb === "DamageEach" ? step.pick : undefined;
    if (spec) counted[option.id] = countMatching(game, spec, seat, sourceId, ctx);
    const numbered = spec ? null : numberedBranch(option);
    if (numbered && typeof numbered.amount === "object") counted[option.id] = resolveAmount(game, numbered.amount, frameScope(game, seat, sourceId), ctx);
    // Dagnir's Spawn (12173:A:2): the damage a player distributes is the part number.
    const spread = distributeBranch(option);
    if (spread) counted[option.id] = resolveAmount(game, spread.amount, frameScope(game, seat, sourceId), ctx);
  }
  return Object.keys(counted).length > 0 ? { counted } : {};
}

/** A branch that counts cards, with the number now: "Raise your threat by 3 (1 for each ally you control)", "Deal 1 damage to each ally you control (3)". Null for any other branch. */
export function wilderlandBranchWords(choose: Extract<Instruction, { verb: "Choose" }>, optionId: string, names: ChoiceNames, now?: BranchNow, source?: string | null, game?: ScenarioState): string | null {
  const accolade = heathBranchWords(choose, optionId, names, game);
  if (accolade) return accolade;
  const offer = searchOffer(choose);
  if (offer) return optionId === "search" ? `Search for ${names.code(offer.code)}` : "Don't search: no treasure this scenario";
  const option = choose.options.find((entry) => entry.id === optionId);
  if (option?.instructions[0]?.verb === "ReplaceFromCaves") return "Discard it and replace it with the top card of the Caves deck";
  if (option?.instructions[0]?.verb === "CancelStrike") return "Cancel the attack: no damage, the attackers stay exhausted";
  const spread = option ? distributeBranch(option) : null;
  if (spread) return `Assign ${now?.counted?.[optionId] ?? "all the"} damage among your characters: ${source ?? "this card"} is shuffled back into the encounter deck`;
  // 12172:A:2: "all encounter cards are immune to player card effects until the end of the phase".
  if (option?.instructions[0]?.verb === "ModifyStat" && option.instructions[0].stat === "immuneToPlayerCards") return "All encounter cards are immune to player card effects until the end of the phase";
  // 18078:B:1: the location discarded is added to the staging area, or every player raises their threat by its printed Threat.
  const moved = option?.instructions[0];
  if (moved?.verb === "MoveEncounterCard" && moved.card === "picked" && moved.to === "staging") return now?.placing ? `Add ${now.placing} to the staging area` : "Add the discarded location to the staging area";
  // 18044:A:1, 18060:A:1: a card of the player's own discard pile or deck goes to their hand.
  const first = option?.instructions[0];
  if (first?.verb === "Pick" && option?.instructions[1]?.verb === "MovePicked" && option.instructions[1].to === "hand" && first.pick.control === "you") {
    if (first.pick.from === "discard" && first.pick.cardType == null && first.pick.type === "card") return "Return a card from your discard pile to your hand";
    if (first.pick.from === "deck" && first.pick.traits?.includes("Weapon") === true) return "Search your deck for a Weapon or Armor attachment and put it into your hand";
  }
  // 18061:A:1: the hero a player chooses is their own.
  const [one, two] = option?.instructions ?? [];
  if (one?.verb === "Pick" && one.pick.type === "hero" && one.pick.control === "you" && two?.verb === "AddResources" && two.to === "picked" && typeof two.amount === "number") return `Add ${two.amount} resource${two.amount === 1 ? "" : "s"} to the pool of a hero you control`;
  const step = option ? countedBranch(option, choose) : null;
  const number = now?.counted?.[optionId];
  const numbered = option ? numberedBranch(option) : null;
  if (numbered && number != null) {
    if (numbered.verb === "RemoveProgressFromQuest") return `Remove ${number} progress from the quest (1 for each attacker)`;
    const amount = numbered.amount;
    const why = typeof amount === "object" && amount.count?.from === "victory" ? "1 per victory location" : `the printed Threat of ${now?.placing ?? "the discarded location"}`;
    return `Each player raises their threat by ${number} (${why})`;
  }
  if (!step || number == null) return null;
  if (step.verb === "RaiseThreat") {
    const count = step.amount && typeof step.amount === "object" ? step.amount.count : undefined;
    return `Raise your threat by ${number} (1 for each ${count?.committed === true ? "questing " : ""}${count?.type ?? "card"} you control)`;
  }
  return `Deal ${step.amount} damage to each ${step.pick?.type ?? "card"} you control (${number})`;
}

/** What traveling to a location sets off when it makes each enemy in the staging area attack ("becomes the active location", The Old Ford 18016:A:3): the words of its row and the caution before the second tap. Null when it does not apply or no enemy waits. */
export function wilderlandTravel(game: ScenarioState, ctx: ReduceContext, locationId: string): { words: string; caution: string } | null {
  const location = game.cards[locationId];
  if (!location) return null;
  const attacks = recordsOfFace(location, effectsOf(ctx, location.code)).some((effect) => effect.timing === "forced" && effect.trigger === "becameActive" && effect.instructions.some((step) => step.verb === "Each" && step.instructions.some((inner) => inner.verb === "AttackFromStaging")));
  const waiting = game.staging.filter((id) => id !== locationId && printedOf(ctx.cards, game.cards[id]?.code ?? "").type === "enemy").length;
  if (!attacks || waiting === 0) return null;
  const words = `each enemy in the staging area attacks ${game.seatCount > 1 ? `Player ${game.firstPlayer + 1}` : "you"}`;
  return { words, caution: `Tap again: ${words}` };
}

// Discover X (emce.discover): the banner's beats, and the cards of the look strip. The engine's `discover` step names the cards looked at, the Loot objective that was attached and the Hazard card that was revealed;
// the rest went to the encounter discard pile. The strip lays out those (the Loot and the Hazard stand where they went, ringed by the same beat). Pure.

/** The prefix a banner beat puts on a card id to say "lay this card in the look strip" (store/beat-store.ts keeps the ids as a string). */
const LOOK_PREFIX = "look:";

/** A beat's card ids with the cards of the look strip told apart: the ids for the strip are returned without the prefix. */
export function lookIdsOf(beat: ReadonlySet<string>): readonly string[] {
  return [...beat].filter((id) => id.startsWith(LOOK_PREFIX)).map((id) => id.slice(LOOK_PREFIX.length));
}

/** The beat ids that lay these cards in the look strip. */
export function lookBeat(ids: readonly string[]): readonly string[] {
  return ids.map((id) => `${LOOK_PREFIX}${id}`);
}

/**
 * What a Discover resolved: the location and how many cards were looked at, the Loot objective and the Hazard card (name and id) if any, and the ids of the rest, which went to the encounter discard pile.
 * `staged` says the Hazard stands in the staging area (an enemy or a location); a treachery is resolved and lies in the discard pile.
 */
export type DiscoverFacts = {
  location: { id: string; name: string };
  looked: number;
  loot: { id: string; name: string } | null;
  hazard: { id: string; name: string; staged: boolean } | null;
  rest: readonly string[];
};

const cards = (count: number): string => `${count} ${count === 1 ? "card" : "cards"}`;

/** The banner's title for the keyword. */
export function discoverTitle(depth: number): string {
  return `Discover ${depth}`;
}

/**
 * The lines of the Discover beat in the order the rule resolves them: the look, the Loot objective, the Hazard, and the rest in the discard pile. Each says which cards the table rings. The last line lays the rest in the
 * look strip and rings the Loot objective and the staged Hazard, which stand above the strip's veil; it is the beat the banner holds until it is dismissed (and the only one drawn under reduced motion).
 */
export function discoverLines(facts: DiscoverFacts): readonly { text: string; cards: readonly string[] }[] {
  const { location, loot, hazard, rest } = facts;
  const lines: { text: string; cards: readonly string[] }[] = [{ text: `${location.name}: looked at the top ${cards(facts.looked)} of the encounter deck`, cards: [location.id] }];
  if (loot) lines.push({ text: `${loot.name} is attached to ${location.name} as a guarded objective`, cards: [loot.id] });
  if (hazard) lines.push(hazard.staged ? { text: `${hazard.name} is revealed and added to the staging area`, cards: [hazard.id] } : { text: `${hazard.name} is revealed`, cards: [] });
  if (rest.length > 0) {
    const stands = [...(loot ? [loot.id] : []), ...(hazard?.staged ? [hazard.id] : [])];
    lines.push({ text: `${cards(rest.length)} ${rest.length === 1 ? "is" : "are"} placed in the encounter discard pile`, cards: [...lookBeat(rest), ...stands] });
  } else if (!loot && !hazard) lines.push({ text: "No Loot objective or Hazard card was among them", cards: [] });
  return lines;
}

/** The log's one line for the step, and the reader's name for the strip ("Discover look, 2 cards"). */
export function discoverLogLine(facts: Pick<DiscoverFacts, "looked"> & { location: string; loot: string | null; hazard: string | null }): string {
  return `Discover at ${facts.location}: looked at ${cards(facts.looked)}${facts.loot ? `, attached ${facts.loot}` : ""}${facts.hazard ? `, revealed ${facts.hazard}` : ""}`;
}

/** What a screen reader hears of the strip, and the web list's line for it. */
export function lookStripWords(count: number): string {
  return `Discover look, ${cards(count)} placed in the encounter discard pile`;
}

/** What winning does with a card A Growing Threat set aside (emce.campaign-pool-encounter). */
export const POOL_COPY = "A copy joins the campaign pool if you win";

/** The log's line for the card set aside: "A Growing Threat sets Hill Troll aside. A copy joins the campaign pool if you win." */
export function setAsideLine(source: string, card: string): string {
  return `${source} sets ${card} aside. ${POOL_COPY}.`;
}

/** Carried Away (18074:A:1): the hero a player chooses, before the encounter deck is discarded to the enemy that will guard it. Two-handed it leads with the player (`owned`). Null for any other pick. */
function carriedAwayAsk(pick: Instruction, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  if (pick.verb !== "Pick" || next?.verb !== "DiscardUntil" || pick.pick.type !== "hero") return null;
  const game = facts?.game;
  const many = game != null && game.seatCount > 1;
  const body = "choose 1 hero you control to be carried away. It loses its tokens and attachments. The next enemy discarded from the encounter deck enters the staging area and guards it facedown until that enemy leaves play, then the hero returns exhausted.";
  return many ? { verb: "Carry away", prompt: `Player ${askedSeat(game) + 1}: ${body}`, owned: true } : { verb: "Carry away", prompt: `${body.charAt(0).toUpperCase()}${body.slice(1)}` };
}
