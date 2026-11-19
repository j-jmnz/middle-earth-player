// Rules: rr.first-player (data/rules/entries.json; the first player has the final say on an encounter card's choice). The words of a choice an effect asks in the middle of resolving: the
// branches of a Choose instruction ("either remove X progress or shuffle 1 out-of-play Ringwraith", 141026:B:2) and what a
// Pick is for (the heroes Unwanted Attention removes from the quest, 141054:A:2). The words describe the effect record's
// instructions; the reducer still decides what each one does.
import type { Instruction } from "../../catalog/boundary.ts";
import { lastPicked } from "../../rules/interpret/player-verbs.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { attachmentPickWords, reattachWords } from "./attachment.ts";
import { deckBranchWords, deckPickThenWords, deckPickWords } from "./deck.ts";
import { encounterPickWords } from "./encounter.ts";
import { attackPickWords } from "./attack.ts";
import { assignDamageWords } from "./scenarios/south.ts";
import { moriaBranchWords, moriaPickWords } from "./scenarios/moria.ts";
import { burdenBranchWords, burdenPickWords } from "./scenarios/burden.ts";
import { amountWords, article, instructionWords, PICK_NOUNS } from "./instruction.ts";
import { capital } from "./list.ts";
import { miscPickWords } from "./misc.ts";
import { playPickWords } from "./play.ts";
import { oathPickWords } from "./scenarios/oath.ts";
import { stageNumber } from "../../rules/families/caves/progress.ts";
import { cavesAttachWords, cavesLeavesWords, cavesPickWords } from "./scenarios/caves.ts";
import { breakingBranchWords, breakingPickWords } from "./scenarios/breaking.ts";
import { seaPickWords } from "./scenarios/sea.ts";
import { unchartedBranchWords, unchartedPickWords } from "./scenarios/uncharted.ts";
import { islandPickWords } from "./scenarios/island.ts";
import { angmarPickWords } from "./scenarios/angmar/angmar.ts";
import { aflameBranchWords, aflamePickWords, type BranchNow } from "./scenarios/aflame.ts";
import { smaugBranchWords } from "./scenarios/standalone-scenarios/smaug.ts";
import { stormcallerBranchWords } from "./scenarios/stormcaller.ts";
import { commandBranchWords } from "./command.ts";
import { wilderlandBranchWords } from "./scenarios/wilderland.ts";
import { objectiveTokensWords } from "./scenarios/assault.ts";

export type ChoiceNames = {
  // A card instance by id.
  card: (cardId: string) => string;
  // A card code.
  code: (code: string) => string;
  // A card code's Traits, for the words that name the side a card flips to (Grotto, Underwater).
  traits?: (code: string) => readonly string[];
};

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;

const PLURALS: Readonly<Record<string, string>> = { hero: "heroes", ally: "allies", enemy: "enemies" };

// Caught in a Web's refresh choice (01080:A:1, "unless you pay 2 resources from that hero's pool"): the card's own verb "pay", and what skipping
// costs, with the host named. The pay option discards resources from the host and readies it; the other option is empty.
function readyPaymentWords(choose: ChooseInstruction, option: ChooseInstruction["options"][number], game: ScenarioState, names: ChoiceNames, sourceId: string | null): string | null {
  const host = sourceId ? game.cards[sourceId]?.host : null;
  if (!host) return null;
  const isPay = (entry: ChooseInstruction["options"][number]): Extract<Instruction, { verb: "DiscardResources" }> | null => {
    const [spend, ready, ...rest] = entry.instructions;
    return spend?.verb === "DiscardResources" && spend.target === "host" && ready?.verb === "Ready" && ready.target === "host" && rest.length === 0 ? spend : null;
  };
  const name = names.card(host);
  const pay = isPay(option);
  if (pay) return `Pay ${amountWords(pay.amount)} resource${amountWords(pay.amount) === "1" ? "" : "s"} from ${name}'s pool and ready ${name}`;
  return option.instructions.length === 0 && choose.options.some((entry) => isPay(entry)) ? `Leave ${name} exhausted this round` : null;
}

/** A branch of a Choose instruction in words: "Remove 2 progress from the quest", "Remove 2 heroes you control from the quest". */
export function branchWords(choose: ChooseInstruction, optionId: string, game: ScenarioState, names: ChoiceNames, sourceId: string | null, now?: BranchNow, ctx?: ReduceContext): string {
  const command = commandBranchWords(choose, optionId, now?.x);
  if (command) return command;
  const option = choose.options.find((entry) => entry.id === optionId);
  if (!option) return capital(optionId);
  const refresh = readyPaymentWords(choose, option, game, names, sourceId);
  if (refresh) return refresh;
  const family = unchartedBranchWords(choose, optionId, now) ?? aflameBranchWords(choose, optionId, names, sourceId, now) ?? stormcallerBranchWords(choose, optionId, game, names, sourceId) ?? (ctx ? smaugBranchWords(choose, optionId, game, ctx, names, sourceId) : null) ?? wilderlandBranchWords(choose, optionId, names, now, sourceId ? names.card(sourceId) : null, game, ctx);
  if (family) return family;
  if (option.instructions.length === 0) return "Do nothing";
  const whole = deckBranchWords(option.instructions) ?? burdenBranchWords(option.instructions) ?? moriaBranchWords(option.instructions) ?? breakingBranchWords(option.instructions, names, sourceId, game);
  if (whole) return whole;
  // A run of "pick a hero, remove it from the quest" is one decision: how many heroes leave the quest.
  const removals = option.instructions.filter((instruction) => instruction.verb === "RemoveFromQuest").length;
  const picks = option.instructions.filter((instruction): instruction is Extract<Instruction, { verb: "Pick" }> => instruction.verb === "Pick");
  if (removals > 0 && removals === picks.length && removals * 2 === option.instructions.length) {
    const noun = PICK_NOUNS[picks[0]?.pick.type ?? "hero"] ?? "character";
    const control = picks[0]?.pick.control === "you" ? " you control" : "";
    return `Remove ${removals === 1 ? article(noun) : `${removals} ${PLURALS[noun] ?? `${noun}s`}`}${control} from the quest`;
  }
  // "Remove X progress" where X is the stage number (41027:A:3): the sheet says the number the table holds now.
  const stage = stageNumber(game);
  const resolved = option.instructions.map((instruction): Instruction =>
    instruction.verb === "RemoveProgressFromQuest" && typeof instruction.amount === "object" && instruction.amount.stage === true && stage > 0 ? { ...instruction, amount: stage } : instruction,
  );
  const leaves = cavesLeavesWords(option.instructions, (instruction) => instructionWords(instruction, game, names, sourceId));
  if (leaves) return leaves;
  const words = resolved.map((instruction) => instructionWords(instruction, game, names, sourceId)).filter((text): text is string => text != null);
  return words.length > 0 ? capital(words.join(", then ")) : capital(optionId);
}

/** The threat a branch changes, from its record's amount: +1 for "raise your threat by 1", -2 for "lower ... by 2". Null when the
 * branch changes no threat, or the change depends on the table ("for each hero committed"). */
export function branchThreat(choose: ChooseInstruction, optionId: string): number | null {
  const option = choose.options.find((entry) => entry.id === optionId);
  for (const instruction of option?.instructions ?? []) {
    if (instruction.verb === "RaiseThreat" && !instruction.perCommitted) return typeof instruction.amount === "object" ? null : (instruction.amount ?? 1);
    if (instruction.verb === "LowerThreat") return typeof instruction.amount === "object" ? null : -instruction.amount;
  }
  return null;
}

export type PickWords = { verb: string; prompt: string; owned?: true };

/** What a Pick asks for, from the instruction that uses the picked card: the verb for the button and a prompt sentence. */
export function pickWords(pick: Instruction, next: Instruction | undefined, names: ChoiceNames, sourceId: string | null, restricted = 2, game?: ScenarioState, amountNow?: number, after?: readonly Instruction[]): PickWords {
  // A hero holding one Restricted attachment too many (rr.restricted): which one leaves. A claimed objective goes back to the staging area.
  if (pick.verb === "DiscardRestricted") {
    const host = sourceId ? names.card(sourceId) : "The hero";
    return { verb: "Remove", prompt: `${host} can hold ${restricted} Restricted attachments. Choose 1 to remove: an objective returns to the staging area, any other card is discarded.` };
  }
  // Out-of-play copies in different zones (rr.in-play-and-out-of-play, rr.first-player): which one joins the encounter deck.
  if (pick.verb === "ShuffleOutOfPlayIntoEncounterDeck") {
    const name = names.code(pick.code);
    return { verb: "Shuffle in", prompt: `Choose which out-of-play ${name} is shuffled into the encounter deck. Any other copy stays where it is.` };
  }
  // The costs family's verbs that ask for a card: which card to play, which pool pays the next resource, the new host.
  if (pick.verb === "PlayFromHand") return { verb: "Play", prompt: "Choose a card to play from your hand." };
  if (pick.verb === "PayToPlay" || pick.verb === "SpendResources") return { verb: "Pay", prompt: "Choose whose pool pays 1 resource." };
  if (pick.verb === "Reattach") return reattachWords(pick, pick.card === "picked" ? (game && game.cards[lastPicked(game)] ? names.card(lastPicked(game)) : null) : sourceId ? names.card(sourceId) : null);
  if (pick.verb === "ChooseAmount") return { verb: "Choose", prompt: "Choose X." };
  if (pick.verb === "AssignDamage") return assignDamageWords(pick, sourceId ? names.card(sourceId) : null);
  const sea = seaPickWords(pick, next, names, sourceId, game, after);
  if (sea) return sea;
  const picked = game ? lastPicked(game) : "";
  // A PutIntoPlay is about the source itself (no `card`, or "self": a Guarded attachment that enters play when its guard leaves) or the card the effect picked.
  const play = playPickWords(pick, pick.verb === "PutIntoPlay" && (pick.card === undefined || pick.card === "self") ? (sourceId ? names.card(sourceId) : null) : picked && game?.cards[picked] ? names.card(picked) : null);
  if (play) return play;
  const deck = pick.verb === "Pick" && next ? deckPickThenWords(pick, next, after) : null;
  if (deck) return deck;
  const burden = burdenPickWords(pick, next) ?? moriaPickWords(next, names) ?? breakingPickWords(pick, next, game, after) ?? attackPickWords(pick, next);
  if (burden) return burden;
  if (pick.verb !== "Pick") return unchartedPickWords(pick, next, names, sourceId) ?? islandPickWords(pick, next, names, sourceId, game) ?? angmarPickWords(pick) ?? aflamePickWords(pick, next, names, sourceId, undefined, game) ?? cavesAttachWords(pick, sourceId ? names.card(sourceId) : null) ?? oathPickWords(pick, names.code, sourceId ? names.card(sourceId) : null, game) ?? cavesPickWords(pick, next) ?? encounterPickWords(pick, next) ?? attachmentPickWords(pick) ?? deckPickWords(pick, names.card) ?? miscPickWords(pick) ?? { verb: "Choose", prompt: "Choose one." };
  const family = aflamePickWords(pick, next, names, sourceId, amountNow, game) ?? islandPickWords(pick, next, names, sourceId, game);
  if (family) return family;
  const noun = `${pick.pick.committed === true ? "questing " : ""}${PICK_NOUNS[pick.pick.type] ?? "card"}`;
  const one = article(noun);
  switch (next?.verb) {
    case "RemoveFromQuest":
      return { verb: "Remove", prompt: `Choose ${one} to remove from the quest.` };
    case "DiscardPicked":
      return { verb: "Discard", prompt: `Choose ${one} to discard.` };
    case "MovePicked":
      return next.to === "play" ? { verb: "Put into play", prompt: `Choose ${one} to put into play from your hand.` } : { verb: "Take", prompt: `Choose ${one} to put into your hand.` };
    case "PlaceUnderSelf":
      return { verb: "Place", prompt: `Choose ${one} to place facedown under ${sourceId ? names.card(sourceId) : "the location"}.` };
    case "PlaceFacedownUnder":
      return { verb: "Place", prompt: `Choose ${one} to place facedown under ${next.code != null ? names.code(next.code) : sourceId ? names.card(sourceId) : "this card"}.` };
    // Defenders (rr.multiple-defenders): one more declared, and the one that takes all the attack's damage.
    case "AddDefender":
      return { verb: "Defend", prompt: `Choose ${one} to declare as a defender.` };
    case "AssignAttackDamage":
      return { verb: "Assign", prompt: "Choose the defender that takes all the damage of this attack." };
    case "SpendFromPool":
      return { verb: "Spend", prompt: `Choose ${one} to spend a resource from.` };
    case "Exhaust":
      return { verb: "Exhaust", prompt: `Choose ${pick.pick.trait === "Ship" ? "a Ship objective" : one} to exhaust.` };
    case "Ready":
      return { verb: "Ready", prompt: `Choose ${one} to ready.` };
    case "DiscardResources": {
      // The number is the one the table holds now (Command's X), and a non-unique filter is said.
      const count = amountNow ?? next.amount;
      const which = article(`${pick.pick.nonUnique === true ? "non-unique " : ""}${noun}`);
      return { verb: "Remove", prompt: `Choose ${which} to remove ${typeof count === "number" ? count : amountWords(next.amount)} resource${count === 1 ? "" : "s"} from.` };
    }
    case "ReturnToHand":
      return { verb: "Return", prompt: `Choose ${one} to return to its owner's hand.` };
    // The objectives and dungeon families (Escape from Dol Guldur): the objective the Dungeon Jailor shuffles back (01101:A:1), the hero that
    // claims an objective (01108:A:2), the character the Nazgûl makes a player discard (01102:A:3).
    case "MoveEncounterCard":
      return next.to === "shuffle" ? { verb: "Shuffle in", prompt: `Choose ${pick.pick.type === "objective" ? "an unclaimed objective" : one} to shuffle into the encounter deck.` } : { verb: "Choose", prompt: `Choose ${one}.` };
    case "ClaimObjective":
      return { verb: "Claim", prompt: `Choose ${one} to carry ${sourceId ? names.card(sourceId) : "the objective"}.` };
    case "Discard":
      return { verb: "Discard", prompt: `Choose ${one} to discard.` };
    // The Glórinaith's target (110139:A:4, 110139:B:5), Armor Plating's enemy (11172:B:3).
    case "DiscardFromAnyDeck":
      return { verb: "Target", prompt: `Choose ${one} to deal damage to.` };
    case "DiscardShadow":
      return { verb: "Discard", prompt: `Choose ${one} that has a shadow card. Its shadow card is discarded.` };
    // Resources added to the picked hero (110138:A:3), or an attachment discarded for the resources it gives the enemy (11061:A:2).
    case "AddResources":
      return pick.pick.type === "attachment" ? { verb: "Discard", prompt: `Choose ${one} you control to discard. The enemy gets resources equal to its printed cost.` } : { verb: "Add", prompt: `Choose ${one} to add ${typeof next.amount === "number" || amountNow != null ? `${amountNow ?? next.amount} ${(amountNow ?? next.amount) === 1 ? "resource" : "resources"}` : "resources"} to.` };
    // The sea family (Voyage Across Belegaer): the Ship objective that takes the excess damage of a shadow attack (11055:A:2).
    case "DamageShip":
      return { verb: "Assign", prompt: typeof next.amount === "number" ? `Choose the Ship objective you control that takes ${next.amount} damage.` : "Choose the Ship objective you control that takes the excess damage." };
    // A set-aside boon or burden a campaign card attaches (01130:A:3, 01130:A:4): the hero that carries it.
    case "AttachSetAside":
      return { verb: "Attach", prompt: `Choose ${one} to carry ${names.code(next.code)}.` };
    case "ModifyStat": {
      const until = next.until === "endOfPhase" ? " until the end of the phase" : next.until === "endOfRound" ? " until the end of the round" : "";
      const down = typeof next.amount === "number" && next.amount < 0;
      return { verb: down ? "Weaken" : "Boost", prompt: `Choose ${one} to ${down ? "weaken" : "boost"}${until}.` };
    }
    case "DamageCard":
      return { verb: "Assign", prompt: `Choose ${one} to take ${amountNow != null ? amountNow : amountWords(next.amount)} damage.` };
    // The Oath's Adaptations (41044:A:3, 41046:A:3) and Abandoned Camp (41015:A:1): the hero healed, the location that takes progress, the ally put into play.
    case "Heal":
      return { verb: "Heal", prompt: `Choose ${one} to heal${next.all ? " all damage from" : ""}.` };
    case "PlaceProgressOn": {
      // The Cave Torch's "Dark location" (41029:A:2): the trait the pick asks for.
      const kind = pick.pick.trait ? `${pick.pick.trait} ${noun}` : noun;
      return { verb: "Place", prompt: `Choose ${article(kind)} to place ${amountNow != null ? amountNow : amountWords(next.amount)} progress on.` };
    }
    // A set-aside card a Forced effect gives to a hand (Come Together, 11194:A:3): the player whose hand it joins.
    case "AddSetAsideToHand":
      return { verb: "Choose", prompt: `Choose the player who adds ${names.code(next.code)} to their hand.` };
    case "PutIntoPlay":
      return { verb: "Put into play", prompt: `Choose ${pick.pick.cardType && pick.pick.cardType !== "player-side-quest" ? article(pick.pick.cardType) : one} to put into play.` };
    // A revealed card that enters play under a chosen player's control (Gavin, 11210:A:5).
    case "TakeRevealedCard":
      return { verb: "Give", prompt: `Choose the player who takes control of ${sourceId ? names.card(sourceId) : "the revealed card"}${next.committed ? ", committed to the quest" : ""}.` };
    default:
      return unchartedPickWords(pick, next, names, sourceId) ?? objectiveTokensWords(pick, next, one, amountNow) ?? { verb: "Choose", prompt: `Choose ${one}.` };
  }
}

/** Where an out-of-play card is, for an option that names one copy among several: "Ringwraith set aside". */
export function outOfPlayLabel(game: ScenarioState, cardId: string, names: ChoiceNames): string {
  const card = game.cards[cardId];
  const name = card ? names.code(card.code) : cardId;
  switch (card?.zone) {
    case "setAside":
      return `${name} set aside`;
    case "encounterDiscard":
      return `${name} from the encounter discard pile`;
    case "victory":
      return `${name} from the victory display`;
    case "under":
      return `${name} under ${card.host ? names.card(card.host) : "a location"}`;
    default:
      return name;
  }
}
