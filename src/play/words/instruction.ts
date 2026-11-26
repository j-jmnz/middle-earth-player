// Rules: rr.first-player (data/rules/entries.json). One effect instruction in words, as a branch of a Choose reads it ("Remove 2 progress from the quest", "Deal 1 damage to the attached card"): the core verbs here, every family's words
// after them. The words describe the effect record's instructions; the reducer still decides what each one does. choice.ts words a whole branch and a Pick with it.
import type { Amount, Instruction } from "../../catalog/boundary.ts";
import { questProgressMoved } from "../../rules/interpret/verbs.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { attachmentWords } from "./attachment.ts";
import { deckWords } from "./deck.ts";
import { encounterWords } from "./encounter.ts";
import { attackWords } from "./attack.ts";
import { southWords } from "./scenarios/south.ts";
import { moriaWords } from "./scenarios/moria.ts";
import { burdenWords } from "./scenarios/burden.ts";
import { capital } from "./list.ts";
import { miscWords } from "./misc.ts";
import { playWords } from "./play.ts";
import { dungeonWords } from "./scenarios/dungeon.ts";
import { blackGateWords } from "./scenarios/black-gate.ts";
import { pelennorWords } from "./scenarios/pelennor.ts";
import { oathWords } from "./scenarios/oath.ts";
import { cavesFlagWords, cavesWords } from "./scenarios/caves.ts";
import { nightmareWords } from "./scenarios/nightmare.ts";
import { breakingWords } from "./scenarios/breaking.ts";
import { seaWords } from "./scenarios/sea.ts";
import { flipWords, unchartedWords } from "./scenarios/uncharted.ts";
import { islandWords } from "./scenarios/island.ts";
import { aflameWords } from "./scenarios/aflame.ts";
import { stormcallerWords } from "./scenarios/stormcaller.ts";
import { assaultWords } from "./scenarios/assault.ts";
import { fortressWords } from "./scenarios/fortress.ts";
import { companyWords } from "./scenarios/company.ts";
import { angmarWords } from "./scenarios/angmar/angmar.ts";
import { investigationWords } from "./scenarios/standalone-scenarios/investigation.ts";
import { riddlesWords } from "./scenarios/the-hobbit/riddles.ts";
import { villagerWords } from "./scenarios/against-the-shadow/amon-din.ts";
import { osgiliathWords } from "./scenarios/against-the-shadow/osgiliath.ts";
import { hiddenWords } from "./scenarios/against-the-shadow/blood.ts";
import { ringMakerWords } from "./scenarios/ring-maker/fords-table.ts";
import { valeWords } from "./scenarios/against-the-shadow/vale.ts";
import { heatVerbWords } from "./scenarios/haradrim/heat.ts";
import { heathWords } from "./scenarios/heath.ts";
import type { ChoiceNames } from "./choice.ts";

export const PICK_NOUNS: Readonly<Record<string, string>> = { hero: "hero", ally: "ally", attachment: "attachment", enemy: "enemy", character: "character", location: "location", player: "player", objective: "objective" };

// The decks beside the encounter deck a record names (src/rules/core/piles.ts NAMED_PILES), as a sentence says them.
const PILE_NAMES = { caves: "Caves", evilCreatures: "Evil Creatures", spiders: "Spiders of Mirkwood", orcs: "Orcs", sideQuests: "side quest", harad: "Harad", greatSpider: "Great Spider", angmarOrcs: "Orc", smaug: "Smaug", investigation: "Investigation" } as const;

export function article(noun: string): string {
  return /^[aeiou]/.test(noun) ? `an ${noun}` : `a ${noun}`;
}

// A record's amount in words: its number, or X when the engine reads it.
export function amountWords(amount: Amount | undefined, fallback = 1): string {
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
export function instructionWords(instruction: Instruction, game: ScenarioState, names: ChoiceNames, sourceId: string | null): string | null {
  switch (instruction.verb) {
    case "FlipDoubleSided":
      return flipWords(instruction, game, names, sourceId);
    case "RemoveQuestProgress":
      return `remove ${questProgressMoved(game, instruction)} progress from the quest`;
    case "PlaceQuestProgress":
      return `place ${questProgressMoved(game, instruction)} progress on the quest`;
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return `shuffle an out-of-play ${names.code(instruction.code)} into the encounter deck`;
    case "GainSurge":
      return "reveal an additional encounter card";
    // The Passage of the Marshes (the asks file words them again for the sheet): Shifting Quagmire, We Hates Them!.
    case "ReturnRandomVictoryLocation":
      return "return a random location from the victory display to the staging area";
    // Shelob's Lair: Shelob's resources (144040:A:3, 144061:A:2; the asks file words the choice again for the sheet).
    case "PlaceResourceTokens": {
      const amount = amountWords(instruction.amount);
      // Encounter at Amon Dîn: the tokens a card places are villager tokens (ats.villagers), never resources.
      const unit = game.scenarioId === "encounter-at-amon-din" ? "villager token" : "resource";
      return `place ${amount} ${unit}${amount === "1" ? "" : "s"} on ${instruction.on === "self" ? "this card" : instruction.on === "activeLocation" ? "the active location" : "the card you chose"}`;
    }
    // The Steward's Fear (06014:A:2, 06025:A:2; the asks file words the choice again for the sheet): tokens taken off the current quest.
    case "RemoveQuestTokens": {
      const amount = instruction.amount ?? "all";
      const kind = instruction.kind === "any" ? "" : `${instruction.kind} `;
      return amount === "all" ? `remove all ${kind}tokens from the current quest` : `remove ${amount} ${kind}token${amount === 1 ? "" : "s"} from the current quest`;
    }
    // The Stone of Erech's Tarlang's Neck (the asks file words the choice again for the sheet).
    case "EndPhase":
      return "end the phase now";
    case "EngageAll":
      return instruction.who === "firstPlayer" && instruction.trait == null && instruction.inPlay == null ? "the first player engages every enemy in the staging area" : null;
    case "SkipTravelPhase":
      return "skip the travel phase";
    case "PassHand":
      return "pass your whole hand to the player on your left";
    case "FlipGollum":
      return instruction.to === "smeagol" ? "flip Gollum to Sméagol" : "flip Sméagol to Gollum";
    case "GollumAttacks":
      return "Gollum makes an immediate attack against the player he is engaged with";
    case "RaiseThreat": {
      if (instruction.perCommitted) {
        const except = instruction.perCommitted.exceptSphere ? ` other than ${capital(instruction.perCommitted.exceptSphere)}` : "";
        return `each player raises threat by 1 for each ${instruction.perCommitted.type}${except} committed to the quest`;
      }
      // "Raise your threat by 1 for each questing character you control" (41025:A:2).
      if (typeof instruction.amount === "object" && instruction.amount.count?.committed === true && instruction.amount.count.type === "character") return "raise your threat by 1 for each questing character you control";
      const amount = amountWords(instruction.amount);
      if (instruction.who === "firstPlayer") return `the first player raises threat by ${amount}`;
      if (instruction.who === "eachSeat") return `each player raises their threat by ${amount}`;
      return `raise your threat by ${amount}`;
    }
    case "LowerThreat": {
      const amount = amountWords(instruction.amount);
      if (instruction.who === "eachSeat") return `each player lowers threat by ${amount}`;
      return instruction.who === "picked" || instruction.who === "eventSeat" ? `lower that player's threat by ${amount}` : `lower your threat by ${amount}`;
    }
    case "Draw": {
      const amount = amountWords(instruction.amount);
      const deck = instruction.who === "picked" || instruction.who === "eventSeat" ? "their deck" : "your deck";
      const cards = instruction.from === "bottom" ? (amount === "1" ? `the bottom card of ${deck}` : `the bottom ${amount} cards of ${deck}`) : amount === "1" ? "1 card" : `${amount} cards`;
      return instruction.who === "picked" || instruction.who === "eventSeat" ? `that player draws ${cards}` : `draw ${cards}`;
    }
    case "DamageCard":
      return `deal ${amountWords(instruction.amount)} damage to ${refWords(instruction.target)}`;
    // The pelargir family (The Drúadan Forest): the damage of Men in the Dark, and Prowl's group discard.
    case "DamageCardThenSetX":
      return `deal ${amountWords(instruction.amount)} damage to it`;
    case "GroupDiscardResources": {
      const amount = amountWords(instruction.amount);
      return `the players as a group discard ${amount} resource${amount === "1" ? "" : "s"} from their heroes' pools`;
    }
    case "EachPlayerSpends": {
      const amount = amountWords(instruction.amount);
      return `each player spends ${amount} resource${amount === "1" ? "" : "s"} from their heroes' pools`;
    }
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
      if (instruction.stat === "skipPlanning") return "skip the planning phase";
      if (instruction.stat === "noCollect") return "collect no resources this round";
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
      const amount = amountWords(instruction.amount);
      return `${instruction.group ? "the players as a group spend" : "spend"} ${amount} ${sphere}resource${amount === "1" ? "" : "s"}`;
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
    case "AddFromPile": {
      const deck = `the ${PILE_NAMES[instruction.pile]} deck`;
      const where = instruction.to === "engaged" ? "put it into play engaged with you" : "add it to the staging area";
      return instruction.reveal ? `reveal the top card of ${deck} and ${where}` : `${instruction.to === "engaged" ? "put" : "add"} the top card of ${deck} ${instruction.to === "engaged" ? "into play engaged with you" : "to the staging area"}`;
    }
    case "PlaceFacedownUnder":
      return `place ${instruction.target === "self" ? "the attacking enemy" : "it"} facedown under ${instruction.code != null ? names.code(instruction.code) : "this card"}${instruction.afterAttack ? " after this attack" : ""}`;
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
    case "RemoveAllProgress":
      return instruction.pick ? "remove all progress from each matching card in play" : "remove all progress from it";
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
    case "DealShadow":
      return instruction.additional ? "deal it an additional shadow card" : "deal it a shadow card";
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
    // Celebrimbor's Secret (08134:A:1; the asks file words the choice again for the sheet).
    case "TriggerScour":
      return instruction.scope === "topmostDiscard" ? "trigger the topmost Scour effect in the discard pile" : "trigger each Scour effect in play";
    case "PlaceRandomHandUnder":
      return `each player puts a random card from hand facedown underneath ${names.code(instruction.code)}`;
    default:
      // The encounter family's verbs (src/catalog/families/encounter.ts), then the attachments, attack, play and deck families'.
      return breakingWords(instruction, names, game) ?? oathWords(instruction, names.code) ?? nightmareWords(instruction, names.code) ?? seaWords(instruction) ?? unchartedWords(instruction) ?? islandWords(instruction) ?? aflameWords(instruction) ?? stormcallerWords(instruction) ?? fortressWords(instruction, names.code) ?? cavesWords(instruction, names.code) ?? dungeonWords(instruction, names.code) ?? southWords(instruction) ?? moriaWords(instruction, names) ?? burdenWords(instruction, names.code) ?? encounterWords(instruction) ?? attachmentWords(instruction, names.code) ?? companyWords(instruction) ?? attackWords(instruction) ?? playWords(instruction) ?? deckWords(instruction) ?? miscWords(instruction) ?? assaultWords(instruction) ?? pursuitWords(instruction, game) ?? pelennorWords(instruction) ?? blackGateWords(instruction) ?? angmarWords(instruction) ?? investigationWords(instruction) ?? riddlesWords(instruction) ?? villagerWords(instruction) ?? osgiliathWords(instruction) ?? hiddenWords(instruction) ?? valeWords(instruction) ?? ringMakerWords(instruction) ?? heatVerbWords(instruction, game) ?? heathWords(instruction);
  }
}

// ", to 31": the value the branch leaves, when the amount is a plain number and the Setup has set the value (a lowered value stops at 0, 143070:B:2).
function pursuitTo(game: ScenarioState, amount: Amount, sign: 1 | -1): string {
  return typeof amount === "number" && game.pursuit != null ? `, to ${Math.max(0, game.pursuit + sign * amount)}` : "";
}

// The words of the pursuit family's verbs (src/catalog/families/pursuit.ts) inside a choice: what a branch of a Choose does ("Increase the pursuit value by 3"), or null for any other verb.
function pursuitWords(instruction: Instruction, game: ScenarioState): string | null {
  switch (instruction.verb) {
    case "RaisePursuit":
      return `increase the pursuit value by ${amountWords(instruction.amount)}${pursuitTo(game, instruction.amount, 1)}`;
    case "LowerPursuit":
      return `reduce the pursuit value by ${amountWords(instruction.amount)}${pursuitTo(game, instruction.amount, -1)}`;
    case "SetPursuit":
      return `set the pursuit value to ${instruction.value}`;
    default:
      return null;
  }
}
