// Rules: rr.first-player (data/rules/entries.json; the first player has the final say on an encounter card's choice). The words of a choice an effect asks in the middle of resolving: the
// branches of a Choose instruction ("either remove X progress or shuffle 1 out-of-play Ringwraith", 141026:B:2) and what a
// Pick is for (the heroes Unwanted Attention removes from the quest, 141054:A:2). The words describe the effect record's
// instructions; the reducer still decides what each one does.
import type { Amount, Instruction } from "../catalog/boundary.ts";
import { questProgressMoved } from "../rules/verbs.ts";
import type { ScenarioState } from "../rules/reduce.ts";
import { attachmentPickWords, attachmentWords } from "./attachment-words.ts";
import { deckPickWords, deckWords } from "./deck-words.ts";
import { encounterPickWords, encounterWords } from "./encounter-words.ts";
import { attackWords } from "./attack-words.ts";
import { southWords } from "./south-words.ts";
import { moriaBranchWords, moriaPickWords, moriaWords } from "./moria-words.ts";
import { burdenBranchWords, burdenPickWords, burdenWords } from "./burden-words.ts";
import { miscPickWords, miscWords } from "./misc-words.ts";
import { playPickWords, playWords } from "./play-words.ts";
import { dungeonWords } from "./dungeon-words.ts";
import { oathPickWords, oathWords } from "./oath-words.ts";
import { stageNumber } from "../rules/families/caves-progress.ts";
import { cavesAttachWords, cavesFlagWords, cavesLeavesWords, cavesPickWords, cavesWords } from "./caves-words.ts";
import { nightmareWords } from "./nightmare-words.ts";
import { breakingBranchWords, breakingPickWords, breakingWords } from "./breaking-words.ts";
import { seaPickWords, seaWords } from "./sea-words.ts";
import { unchartedBranchWords, unchartedPickWords, unchartedWords } from "./uncharted-words.ts";
import { aflameBranchWords, aflamePickWords, aflameWords, type BranchNow } from "./aflame-words.ts";

export type ChoiceNames = {
  // A card instance by id.
  card: (cardId: string) => string;
  // A card code.
  code: (code: string) => string;
};

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;
type PickInstruction = Extract<Instruction, { verb: "Pick" }>;

const PICK_NOUNS: Readonly<Record<string, string>> = { hero: "hero", ally: "ally", attachment: "attachment", enemy: "enemy", character: "character", location: "location", player: "player", objective: "objective" };
const PLURALS: Readonly<Record<string, string>> = { hero: "heroes", ally: "allies", enemy: "enemies" };

function article(noun: string): string {
  return /^[aeiou]/.test(noun) ? `an ${noun}` : `a ${noun}`;
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// A record's amount in words: its number, or X when the engine reads it.
function amountWords(amount: Amount | undefined, fallback = 1): string {
  if (amount == null) return String(fallback);
  return typeof amount === "number" ? String(amount) : "X";
}

const STAT_WORDS: Readonly<Record<string, string>> = { willpower: "Willpower", attack: "Attack", defense: "Defense", threat: "Threat", hitPoints: "hit points", drawOnAttackDestroy: "card drawn each time they attack and destroy an enemy" };

// "the chosen card", "that card", "it": what a card reference names in a sentence.
function refWords(ref: string | undefined): string {
  switch (ref) {
    case "self":
      return "this card";
    case "host":
      return "the attached card";
    case "subject":
    case "other":
      return "that card";
    case "defender":
      return "the defending character";
    case "attacker":
      return "the attacking enemy";
    default:
      return "it";
  }
}

// The card a discount waits for, from its filter: "Lore ally" ("the next Lore card of that type", 05016:A:1), else "matching card".
function nextCardWords(pick: Extract<Instruction, { verb: "ReduceNextCost" }>["pick"]): string {
  const words = [pick.sphere ? capital(pick.sphere) : null, pick.trait ?? null, pick.cardType ? pick.cardType.replace("player-side-quest", "side quest") : null].filter((word) => word != null);
  return pick.cardType ? words.join(" ") : "matching card";
}

/** One instruction in words, or null when it adds nothing the player decides on (a shuffle after a search). */
function instructionWords(instruction: Instruction, game: ScenarioState, names: ChoiceNames, sourceId: string | null): string | null {
  switch (instruction.verb) {
    case "RemoveQuestProgress":
      return `remove ${questProgressMoved(game, instruction)} progress from the quest`;
    case "PlaceQuestProgress":
      return `place ${questProgressMoved(game, instruction)} progress on the quest`;
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return `shuffle an out-of-play ${names.code(instruction.code)} into the encounter deck`;
    case "GainSurge":
      return "reveal an additional encounter card";
    case "RaiseThreat": {
      if (instruction.perCommitted) {
        const except = instruction.perCommitted.exceptSphere ? ` other than ${capital(instruction.perCommitted.exceptSphere)}` : "";
        return `each player raises threat by 1 for each ${instruction.perCommitted.type}${except} committed to the quest`;
      }
      // "Raise your threat by 1 for each questing character you control" (41025:A:2).
      if (typeof instruction.amount === "object" && instruction.amount.count?.committed === true && instruction.amount.count.type === "character") return "raise your threat by 1 for each questing character you control";
      const amount = amountWords(instruction.amount);
      if (instruction.who === "firstPlayer") return `the first player raises threat by ${amount}`;
      if (instruction.who === "eachSeat") return `each player raises threat by ${amount}`;
      return `raise your threat by ${amount}`;
    }
    case "LowerThreat": {
      const amount = amountWords(instruction.amount);
      if (instruction.who === "eachSeat") return `each player lowers threat by ${amount}`;
      return instruction.who === "picked" || instruction.who === "eventSeat" ? `lower that player's threat by ${amount}` : `lower your threat by ${amount}`;
    }
    case "Draw": {
      const amount = amountWords(instruction.amount);
      const cards = amount === "1" ? "1 card" : `${amount} cards`;
      return instruction.who === "picked" || instruction.who === "eventSeat" ? `that player draws ${cards}` : `draw ${cards}`;
    }
    case "DamageCard":
      return `deal ${amountWords(instruction.amount)} damage to ${refWords(instruction.target)}`;
    case "AddResources": {
      const amount = amountWords(instruction.amount);
      return `add ${amount} resource${amount === "1" ? "" : "s"} to ${instruction.to === "host" || instruction.to == null ? "the attached hero's" : instruction.to === "self" ? "this card's" : "its"} pool`;
    }
    case "ModifyStat": {
      // A resource icon held as a flag (Narvi's Belt): "the attached card gains a Leadership icon until the end of the phase".
      const icon = /^(leadership|lore|tactics|spirit)Icon$/.exec(instruction.stat)?.[1];
      if (icon) {
        const until = instruction.until === "endOfPhase" ? " until the end of the phase" : instruction.until === "endOfRound" ? " until the end of the round" : "";
        return `${refWords(instruction.target === "picked" || instruction.target == null ? undefined : instruction.target)} gains a ${capital(icon)} icon${until}`;
      }
      const flag = cavesFlagWords(instruction);
      if (flag) return flag;
      const stat = STAT_WORDS[instruction.stat] ?? instruction.stat;
      const amount = typeof instruction.amount === "number" ? (instruction.amount >= 0 ? `+${instruction.amount}` : `${instruction.amount}`) : "+X";
      const until = instruction.until === "endOfPhase" ? " until the end of the phase" : instruction.until === "endOfRound" ? " until the end of the round" : "";
      const who = instruction.holders ? (instruction.holders.uncharted === true ? "each Lost Island in the staging area" : "each matching card") : refWords(instruction.target === "picked" || instruction.target == null ? undefined : instruction.target);
      return `${who === "it" ? "it gets" : `${who} gets`} ${amount} ${stat}${until}`;
    }
    case "Heal":
      return instruction.all ? `heal all damage on ${refWords(instruction.target)}` : `heal ${amountWords(instruction.amount)} damage on ${refWords(instruction.target)}`;
    case "Ready":
      return instruction.target === "allCharacters" ? "ready each character" : `ready ${refWords(instruction.target === "picked" ? undefined : instruction.target)}`;
    case "ReturnToHand":
      return `return ${refWords(instruction.target)} to its owner's hand`;
    case "PutOnDeck":
      return instruction.position === "shuffle" ? `shuffle ${refWords(instruction.target)} into its owner's deck` : `put ${refWords(instruction.target)} on the ${instruction.position} of its owner's deck`;
    case "MoveResources":
      return instruction.all ? "move all its resources" : `move ${amountWords(instruction.amount)} resource${amountWords(instruction.amount) === "1" ? "" : "s"}`;
    case "DiscardFromHand":
      return `discard ${amountWords(instruction.amount)} card${amountWords(instruction.amount) === "1" ? "" : "s"} from your hand`;
    case "AddToVictory":
      return `add ${refWords(instruction.target)} to the victory display`;
    case "SetThreat":
      return `set your threat to ${instruction.value}`;
    case "CancelDamage":
      return instruction.all ? "cancel that damage" : `cancel ${amountWords(instruction.amount)} of that damage`;
    case "CancelEffect":
      return "cancel those effects";
    case "Engage":
      return instruction.target === "self" && sourceId ? `engage ${names.card(sourceId)}` : "engage that enemy";
    case "Discard":
      return instruction.target.kind === "self" ? "discard this card" : "discard it";
    case "PlaceProgressOn":
      return `place ${amountWords(instruction.amount)} progress on ${instruction.target === "eachStagingLocation" ? "each location in the staging area" : instruction.target === "activeLocation" ? "the active location" : "it"}`;
    case "ReduceNextCost":
      return `reduce the cost of the next ${nextCardWords(instruction.pick)} you play by ${amountWords(instruction.amount)}`;
    // The costs family's verbs (src/catalog/families/costs.ts).
    case "SpendResources": {
      const sphere = instruction.sphere ? `${capital(instruction.sphere)} ` : "";
      return `${instruction.group ? "the players as a group spend" : "spend"} ${instruction.amount} ${sphere}resource${instruction.amount === 1 ? "" : "s"}`;
    }
    case "SetX":
      return `X is ${instruction.value}`;
    case "ChooseX":
      return "choose X";
    case "DiscardResources":
      return instruction.all ? "discard all its resources" : `discard ${amountWords(instruction.amount)} resource${amountWords(instruction.amount) === "1" ? "" : "s"}`;
    case "HeroesGainResources":
      return `each hero ${instruction.who === "picked" ? "that player controls" : "you control"} gains ${amountWords(instruction.amount)} resource${amountWords(instruction.amount) === "1" ? "" : "s"}`;
    case "PlayFromHand":
      return instruction.picked ? "play each of those cards from your hand" : "play a card from your hand";
    case "Reattach":
      return "attach this card to another hero";
    case "LookAtEncounterTop":
      return "look at the top card of the encounter deck";
    case "AttackEnemy":
      return "attack that enemy";
    case "BarAttack":
      return "that enemy cannot attack you";
    case "DiscardTopOfDeck":
      return "discard the top card of your deck";
    case "AttachPicked":
      return "attach it";
    case "Each":
    case "Repeat":
    case "Delay": {
      const inner = instruction.instructions.map((entry) => instructionWords(entry, game, names, sourceId)).filter((text): text is string => text != null);
      return inner.length > 0 ? inner.join(", then ") : null;
    }
    case "ShuffleDeck":
    case "ArrangeTop":
      return null;
    case "DiscardShadow":
      return "discard its shadow card";
    case "Exhaust":
      return instruction.target?.kind === "byCode" ? `exhaust ${names.code(instruction.target.code)}` : "exhaust the chosen card";
    case "HideTest":
      return `make a Hide ${instruction.x} test`;
    case "ConsiderUndefended":
      return "this attack is considered undefended";
    case "ReturnToStaging":
      return instruction.target.kind === "engagedEnemies" ? `return an engaged ${instruction.target.trait ?? ""} enemy to the staging area`.replace("  ", " ") : "return it to the staging area";
    case "ReadyHero":
      return "ready a hero";
    case "SearchMove": {
      const kind = article(`${instruction.trait ?? ""} ${instruction.type ?? "enemy"}`.trim());
      if (instruction.to === "staging") return `add ${kind} from the encounter deck or discard pile to the staging area`;
      return `put ${kind} into play engaged with ${instruction.to === "engaged" ? "you" : "the first player"}`;
    }
    case "Pick": {
      // A card out of play is named by its printed type when the pick asks for one ("choose an ally" from the deck).
      const kind = instruction.pick.type === "card" && instruction.pick.cardType && instruction.pick.cardType !== "player-side-quest" ? instruction.pick.cardType : (PICK_NOUNS[instruction.pick.type] ?? "card");
      // "A questing character" (41025:A:2): the pick is of the characters committed to the quest.
      const noun = instruction.pick.committed === true ? `questing ${kind}` : kind;
      return instruction.pick.mostDamaged ? `choose the ${noun} with the most damage on it` : `choose ${article(noun)}`;
    }
    case "RemoveFromQuest":
      return "remove it from the quest";
    case "DiscardPicked":
      return "discard it";
    case "MovePicked":
      return instruction.to === "play" ? "put it into play" : "put it into your hand";
    case "PlaceUnderSelf":
      return `place it facedown under ${sourceId ? names.card(sourceId) : "the location"}`;
    case "ShuffleEncounterDeck":
      return null;
    // The quest family's verbs (src/catalog/families/quest.ts).
    case "DamageEach":
      return instruction.engagedWith === "picked" ? `deal ${amountWords(instruction.amount)} damage to each enemy engaged with that player` : `deal ${amountWords(instruction.amount)} damage to each matching ${PICK_NOUNS[instruction.pick?.type ?? "enemy"] ?? "card"}`;
    case "ExhaustEach":
      return `exhaust each ${instruction.pick.damaged ? "damaged " : ""}${PICK_NOUNS[instruction.pick.type] ?? "card"} you control`;
    case "WaiveQuestThreat":
      return `${instruction.who === "eachSeat" ? "players do" : "that player does"} not raise threat from questing unsuccessfully ${instruction.until === "endOfRound" ? "this round" : "this phase"}`;
    case "SkipQuestPhase":
      return "skip the quest phase this round";
    case "RemoveProgressFromQuest":
      return `remove ${amountWords(instruction.amount)} progress from the quest`;
    case "MoveProgress":
      return instruction.all ? "move all its progress" : `move ${amountWords(instruction.amount)} progress`;
    case "CommitToQuest":
      return "commit it to the quest";
    case "MakeActive":
      return "make it the active location";
    case "BarEngagement":
      return instruction.what === "checks" ? "that enemy makes no engagement checks against you" : "that enemy cannot engage you";
    // The defense family's verbs (src/catalog/families/defense.ts).
    case "ChooseAmount":
      return "choose X";
    case "SpendFromPool":
      return `spend ${amountWords(instruction.amount)} resource${amountWords(instruction.amount) === "1" ? "" : "s"} from ${refWords(instruction.from)}`;
    case "RedirectDamage":
      return `place ${instruction.all ? "that damage" : `${amountWords(instruction.amount)} of that damage`} on ${refWords(instruction.to)} instead`;
    case "PreventAttacks":
      return instruction.who === "picked" ? "that player's engaged enemies cannot attack that player" : "that enemy cannot attack you";
    case "DiscardShadowOf":
      return `discard a shadow card from ${refWords(instruction.target)}`;
    case "DealShadowTo":
      return `deal ${refWords(instruction.target)} another shadow card`;
    case "LookAtShadow":
      return "look at its facedown shadow card";
    case "StrikeBack":
      return `${refWords(instruction.attacker)} attacks ${refWords(instruction.enemy)}`;
    case "AddDefender":
      return "declare it as a defender";
    case "EndDeclaring":
      return "declare no more defenders";
    case "CancelAttack":
      return "cancel the attack";
    case "AssignAttackDamage":
      return "it takes the damage of the attack";
    case "ReadyUnharmed":
      return "ready each defending character that took no damage";
    case "ReadyAfterAttack":
      return instruction.who === "subject" ? "ready that card after the attack" : "ready each defending character that takes no damage after the attack";
    case "ShadowAttacks":
      return "attack the defending player once this attack has ended";
    case "StartShadowAttack":
      return "attack the defending player";
    // The campaign family's verbs (src/catalog/families/campaign.ts) that a Journey Along the Anduin record holds.
    case "SetAsideEachPlayer":
      return `set aside a copy of ${names.code(instruction.code)} for each player`;
    case "AttachSetAside":
      return `attach a set-aside ${names.code(instruction.code)} to it`;
    case "EarnAttached":
      return `add each ${instruction.codes.map((code) => names.code(code)).join(" and ")} in play to the Campaign Pool, on its hero`;
    case "NamePrisoner":
      return "take the hero with the most damage prisoner";
    case "RedirectAttack":
      return "reveal the attacking enemy's shadow card";
    case "ModifyStatVersus":
      return `${refWords(instruction.target)} gets ${instruction.amount >= 0 ? `+${instruction.amount}` : instruction.amount} ${STAT_WORDS[instruction.stat] ?? instruction.stat} while attacking ${refWords(instruction.versus)}`;
    default:
      // The encounter family's verbs (src/catalog/families/encounter.ts), then the attachments, attack, play and deck families'.
      return breakingWords(instruction, names, game) ?? oathWords(instruction, names.code) ?? nightmareWords(instruction, names.code) ?? seaWords(instruction) ?? unchartedWords(instruction) ?? aflameWords(instruction) ?? cavesWords(instruction, names.code) ?? dungeonWords(instruction, names.code) ?? southWords(instruction) ?? moriaWords(instruction, names) ?? burdenWords(instruction) ?? encounterWords(instruction) ?? attachmentWords(instruction) ?? attackWords(instruction) ?? playWords(instruction) ?? deckWords(instruction) ?? miscWords(instruction);
  }
}

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
export function branchWords(choose: ChooseInstruction, optionId: string, game: ScenarioState, names: ChoiceNames, sourceId: string | null, now?: BranchNow): string {
  const option = choose.options.find((entry) => entry.id === optionId);
  if (!option) return capital(optionId);
  const refresh = readyPaymentWords(choose, option, game, names, sourceId);
  if (refresh) return refresh;
  const family = unchartedBranchWords(choose, optionId) ?? aflameBranchWords(choose, optionId, names, sourceId, now);
  if (family) return family;
  if (option.instructions.length === 0) return "Do nothing";
  const whole = burdenBranchWords(option.instructions) ?? moriaBranchWords(option.instructions) ?? breakingBranchWords(option.instructions, names, sourceId, game);
  if (whole) return whole;
  // A run of "pick a hero, remove it from the quest" is one decision: how many heroes leave the quest.
  const removals = option.instructions.filter((instruction) => instruction.verb === "RemoveFromQuest").length;
  const picks = option.instructions.filter((instruction): instruction is PickInstruction => instruction.verb === "Pick");
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

export type PickWords = { verb: string; prompt: string };

/** What a Pick asks for, from the instruction that uses the picked card: the verb for the button and a prompt sentence. */
export function pickWords(pick: Instruction, next: Instruction | undefined, names: ChoiceNames, sourceId: string | null, restricted = 2, game?: ScenarioState, amountNow?: number): PickWords {
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
  if (pick.verb === "Reattach") return { verb: "Attach", prompt: "Choose the card to attach it to." };
  if (pick.verb === "ChooseAmount") return { verb: "Choose", prompt: "Choose X." };
  const sea = seaPickWords(pick);
  if (sea) return sea;
  const play = playPickWords(pick);
  if (play) return play;
  const burden = burdenPickWords(pick, next) ?? moriaPickWords(next, names) ?? breakingPickWords(pick, next, game);
  if (burden) return burden;
  if (pick.verb !== "Pick") return unchartedPickWords(pick, next, names, sourceId) ?? aflamePickWords(pick, next, names, sourceId) ?? cavesAttachWords(pick, sourceId ? names.card(sourceId) : null) ?? oathPickWords(pick, names.code, sourceId ? names.card(sourceId) : null) ?? cavesPickWords(pick, next) ?? encounterPickWords(pick, next) ?? attachmentPickWords(pick) ?? deckPickWords(pick) ?? miscPickWords(pick) ?? { verb: "Choose", prompt: "Choose one." };
  const family = aflamePickWords(pick, next, names, sourceId, amountNow, game);
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
    // Defenders (rr.multiple-defenders): one more declared, and the one that takes all the attack's damage.
    case "AddDefender":
      return { verb: "Defend", prompt: `Choose ${one} to declare as a defender.` };
    case "AssignAttackDamage":
      return { verb: "Assign", prompt: "Choose the defender that takes all the damage of this attack." };
    case "SpendFromPool":
      return { verb: "Spend", prompt: `Choose ${one} to spend a resource from.` };
    case "Exhaust":
      return { verb: "Exhaust", prompt: `Choose ${one} to exhaust.` };
    case "Ready":
      return { verb: "Ready", prompt: `Choose ${one} to ready.` };
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
      return { verb: "Assign", prompt: "Choose the Ship objective you control that takes the excess damage." };
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
    case "PutIntoPlay":
      return { verb: "Put into play", prompt: `Choose ${pick.pick.cardType && pick.pick.cardType !== "player-side-quest" ? article(pick.pick.cardType) : one} to put into play.` };
    default:
      return unchartedPickWords(pick, next, names, sourceId) ?? { verb: "Choose", prompt: `Choose ${one}.` };
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
