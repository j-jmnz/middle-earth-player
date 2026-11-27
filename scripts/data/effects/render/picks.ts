// Pick filters: the noun phrase a Pick, a count or a holder names ("enemy in play (any player) named \"Urdug\""). `src/catalog/effect-schema-pick.ts` owns the keys.
import { onWords } from "./families/escape.ts";
import { attachmentWords, familyPickNotes } from "./families/picks-family.ts";
import { done, isObj, joinAnd, jsonOf, quoted, str, type Ctx, type Obj } from "./kit.ts";

export type PickRenderer = (pick: unknown, ctx: Ctx) => string;

const CONTROL: Readonly<Record<string, string>> = { you: "you control", any: "any player controls", other: "another player controls" };
const FROM: Readonly<Record<string, string>> = { play: "in play", hand: "in hand", discard: "in the discard pile", deck: "in the deck", victory: "in the victory display", loot: "in the loot pile", encounterDeck: "in the encounter deck", ravenDeck: "in the Raven deck" };
const ENGAGED: Readonly<Record<string, string>> = { you: "engaged with you", other: "engaged with another player" };

// Each entry reads some keys and says one qualifier; the order is the order the phrase reads in. A key whose value says nothing (`committed: false` before it had words) is not claimed, so it prints after the text as `[also {...}]`.
type Part = { keys: readonly string[]; say: (pick: Obj) => string | null };
const PARTS: readonly Part[] = [
  { keys: ["state"], say: (p) => (typeof p.state === "string" ? p.state : null) },
  { keys: ["sphere"], say: (p) => (typeof p.sphere === "string" ? p.sphere : null) },
  { keys: ["spheres"], say: (p) => (Array.isArray(p.spheres) ? p.spheres.map(str).join("/") : null) },
  { keys: ["unique"], say: (p) => (p.unique === true ? "unique" : null) },
  { keys: ["nonUnique"], say: (p) => (p.nonUnique === true ? "non-unique" : null) },
  { keys: ["trait"], say: (p) => (typeof p.trait === "string" ? p.trait : null) },
  { keys: ["traits"], say: (p) => (Array.isArray(p.traits) ? p.traits.map(str).join(" or ") : null) },
  { keys: ["damaged"], say: (p) => (p.damaged === true ? "damaged" : p.damaged === false ? "undamaged" : null) },
];

export const renderPick: PickRenderer = (value, ctx) => {
  if (!isObj(value) || typeof value.type !== "string") return jsonOf(ctx, "pick", value);
  const pick = value;
  const read = ["type", "control"];
  const claim = (keys: readonly string[], text: string | null): void => {
    if (text !== null || keys.every((key) => pick[key] === undefined)) read.push(...keys);
  };
  const front = PARTS.flatMap((part) => {
    const said = part.say(pick);
    claim(part.keys, said);
    return said ? [said] : [];
  });
  const after: string[] = [];
  const note = (keys: readonly string[], text: string | null): void => {
    claim(keys, text);
    if (text) after.push(text);
  };
  note(["from"], typeof pick.from === "string" ? (FROM[pick.from] ?? pick.from) : null);
  note(["top"], typeof pick.top === "number" ? (pick.from === "discard" ? `among the top ${pick.top} cards of each player's own discard pile` : `among the top ${pick.top}`) : null);
  note(["bottom"], typeof pick.bottom === "number" ? `among the bottom ${pick.bottom}` : null);
  note(["staging"], pick.staging === true ? "or in the staging area" : null);
  note(["riddleArea"], pick.riddleArea === true ? "in the riddle area: stage 2, Gollum, Bilbo Baggins and the Ring on him (while stage 2 is there)" : null);
  note(["stagingArea"], pick.stagingArea === "shared" ? "in the shared staging area (the one stage 2B deals out)" : pick.stagingArea === "any" ? "in any player's staging area" : pick.stagingArea === "own" ? "in the chooser's own staging area (the only one while the stages are not separate)" : null);
  note(["otherArea"], pick.otherArea === true ? "whose staging area is a different one from the chooser's (every other player while the areas are not separate)" : null);
  note(["atOtherStage"], pick.atOtherStage === true ? "at another stage than the chooser's (none while the game has one stage)" : null);
  note(["canSpendResources"], typeof pick.canSpendResources === "number" ? `who controls heroes holding ${pick.canSpendResources} resource${pick.canSpendResources === 1 ? "" : "s"} or more in all` : null);
  note(["deckHasCards"], pick.deckHasCards === true ? "whose deck holds a card" : null);
  note(["atStage"], pick.atStage === true ? "at the acting player's staging area (every area before they are separate)" : null);
  note(["playerCard"], pick.playerCard === true ? "that is a player card" : pick.playerCard === false ? "that is an encounter card" : null);
  note(["stagingOnly"], pick.stagingOnly === true ? "in the staging area only" : null);
  note(["onCharacter"], pick.onCharacter === true ? "including the ones an encounter card attached to a character" : null);
  note(["highestThreatPlusRemaining"], pick.highestThreatPlusRemaining === true ? "with the highest sum of its current Threat and its remaining quest points (the quest points less the progress on it; a tie is the chooser's)" : null);
  note(["attachable"], typeof pick.attachable === "string" ? `that the card with code ${pick.attachable} can be attached to` : null);
  note(["engaged"], typeof pick.engaged === "string" ? (ENGAGED[pick.engaged] ?? pick.engaged) : null);
  note(["engagedWith"], pick.engagedWith === "picked" ? "engaged with the player picked last" : pick.engagedWith === "notYou" ? "not engaged with the chooser (in the staging area when that is in the filter, or engaged with another player)" : pick.engagedWith === "host" ? "engaged with the controller of the card this card is attached to" : null);
  note(["engageable"], pick.engageable === true ? "that the chooser may engage (not one that cannot be engaged, nor one barred to this seat)" : null);
  note(["names"], Array.isArray(pick.names) ? `named ${quoted(pick.names)}` : null);
  note(["exceptNames"], Array.isArray(pick.exceptNames) ? `not named ${quoted(pick.exceptNames)}` : null);
  note(["notTraits"], Array.isArray(pick.notTraits) ? `without ${joinAnd(pick.notTraits.map(str))}` : null);
  note(["nonObjective"], pick.nonObjective === true ? "that is not an objective" : null);
  note(["objective"], pick.objective === true ? "that is an objective" : null);
  note(["cardType"], typeof pick.cardType === "string" ? `of card type ${pick.cardType}` : null);
  note(["sideQuest"], pick.sideQuest === true ? "a side quest of either kind (player or encounter)" : null);
  note(["committed"], pick.committed === true ? "committed to the quest" : pick.committed === false ? "not committed to the quest" : null);
  note(["canQuest"], pick.canQuest === true ? "that no effect bars from questing" : pick.canQuest === false ? "barred from questing by an effect" : null);
  note(["attacking"], pick.attacking === true ? "attacking" : null);
  note(["defending"], pick.defending === true ? "defending" : null);
  note(["canExhaust"], pick.canExhaust === true ? "that can exhaust (not held by a rule that stops it exhausting)" : null);
  note(["hasResources"], pick.hasResources === true ? "with resources on it" : pick.hasResources === false ? "with no resources on it" : null);
  note(["affectable"], pick.affectable === true ? "that a card effect can affect (not one immune to card effects)" : null);
  note(["progress"], pick.progress === true ? "with progress on it" : pick.progress === false ? "with no progress on it" : null);
  note(["captive"], typeof pick.captive === "string" ? (pick.captive === "only" ? "that is a Captive (held by an enemy or lying free)" : pick.captive === "free" ? "that is a Captive that no enemy holds" : "(Captives included)") : null);
  note(["exceptSphere"], typeof pick.exceptSphere === "string" || Array.isArray(pick.exceptSphere) ? `that is not a ${[pick.exceptSphere].flat().join(" or ")} card` : null);
  note(["maxWillpower"], typeof pick.maxWillpower === "number" ? `with a current Willpower of ${pick.maxWillpower} or less` : null);
  note(["highestWillpower"], pick.highestWillpower === true ? "with the highest current Willpower of those (ties: the chooser decides)" : null);
  note(["enemyOrLocation"], pick.enemyOrLocation === true ? "that is an enemy or a location" : null);
  note(["challenge"], pick.challenge === true ? "(the opposing team chooses: only the first of those stays, the order of seats and then of play breaking a tie, and nobody is asked)" : null);
  note(["highestEngagementCost"], pick.highestEngagementCost === true ? "with the highest current engagement cost of those (ties: the chooser decides)" : null);
  note(["lowestEngagementCost"], pick.lowestEngagementCost === true ? "with the lowest current engagement cost of those (ties: the chooser decides)" : null);
  note(["attachedTo"], typeof pick.attachedTo === "string" ? `attached to ${pick.attachedTo === "host" ? "this card's host" : pick.attachedTo === "source" ? "this card" : pick.attachedTo === "defender" ? "the defending character" : "the active location"}` : null);
  note(["lowestAttack"], pick.lowestAttack === true ? "with the lowest Attack of those (ties: the chooser decides)" : null);
  note(["minCost"], typeof pick.minCost === "number" ? `with a printed cost of at least ${pick.minCost} (a card with no printed cost never matches)` : null);
  note(["highestCost"], pick.highestCost === true ? "with the highest printed cost of those (no printed cost counts as 0; ties: the chooser decides)" : null);
  note(["highestThreat"], pick.highestThreat === true ? (pick.type === "player" ? "with the highest threat among the players still in the game (ties: the chooser decides)" : "with the highest current Threat of those (no Threat counts 0; ties: the chooser decides)") : null);
  note(["highestAttack"], pick.highestAttack === true ? "with the highest Attack of those, as the table shows it (ties: the chooser decides)" : null);
  note(["notHost"], pick.notHost === true ? "other than the card this card is attached to" : null);
  note(["lowestThreat"], pick.lowestThreat === true ? "with the lowest Threat of those (ties: the chooser decides)" : null);
  note(["fortitudeDiscarded"], pick.fortitudeDiscarded === true ? "discarded for the Fortitude test in progress and still in the encounter discard pile" : null);
  note(["who"], pick.who === "firstPlayer" ? "chosen by the first player" : null);
  note(["engagedEnemies"], pick.engagedEnemies === true ? "(enemies engaged with a player included)" : null);
  note(["isHost"], pick.isHost === true ? "that this card is attached to" : null);
  note(["hasShadow"], pick.hasShadow === true ? "with a shadow card" : null);
  note(["facedownShadow"], pick.facedownShadow === true ? "holding a facedown shadow card" : null);
  note(["looked"], pick.looked === true ? "among the cards this effect looked at or discarded" : null);
  note(["soleMostDamaged"], pick.soleMostDamaged === true ? "with more damage than each other character in play (a tie for the most matches none)" : null);
  note(["attached"], pick.attached === true ? "that is attached to another card" : pick.attached === false ? "that is attached to no card" : null);
  const attached = isObj(pick.hasAttachment) && Array.isArray(pick.hasAttachment.names) && Object.keys(pick.hasAttachment).every((key) => key === "names" || key === "none") ? pick.hasAttachment : null;
  const attachedNone = isObj(pick.hasAttachment) && pick.hasAttachment.none === true && Object.keys(pick.hasAttachment).length === 1;
  const attachedTrait = isObj(pick.hasAttachment) && typeof pick.hasAttachment.trait === "string" && Object.keys(pick.hasAttachment).length === 1 ? pick.hasAttachment.trait : null;
  const attachedTraitNone = isObj(pick.hasAttachment) && typeof pick.hasAttachment.trait === "string" && pick.hasAttachment.none === true && Object.keys(pick.hasAttachment).length === 2 ? pick.hasAttachment.trait : null;
  note(["hasAttachment"], attachedTraitNone ? `with no ${attachedTraitNone} card attached` : attached ? `${attached.none === true ? "with no" : "with an"} attachment named ${quoted(attached.names as unknown[])}` : attachedTrait ? `with a ${attachedTrait} card attached` : attachedNone ? "with no attachment of any kind" : attachmentWords(pick.hasAttachment));
  familyPickNotes(pick, note);
  note(["active"], pick.active === true ? "that is the active location" : null);
  note(["participating"], pick.participating === true ? "that took part in the attack this effect answers" : null);
  note(["controlledBy"], pick.controlledBy === "firstPlayer" ? "controlled by the first player" : pick.controlledBy === "actor" ? "controlled by the player this effect runs for" : pick.controlledBy === "attackers" ? "controlled by a player whose character took part in the attack this effect answers" : pick.controlledBy === "source" ? "controlled by the player this card is engaged with" : pick.controlledBy === "host" ? "controlled by the player who controls this card's host" : pick.controlledBy === "picked" ? "controlled by the player picked last" : null);
  note(["hasGuard"], pick.hasGuard === true ? "that has an encounter card attached as its guard" : pick.hasGuard === false ? "that has no encounter card attached (free of encounters)" : null);
  note(["onEncounter"], pick.onEncounter === true ? "that is attached to an encounter card (an encounter card guards it, or it hangs on an enemy or a location), wherever it lies in play: in the staging area or held by a player's card" : pick.onEncounter === false ? "that is attached to no encounter card" : null);
  note(["linkedToSource"], pick.linkedToSource === true ? "that is attached to this objective as its guard, or is the card this objective hangs on" : null);
  note(["holdsObjective"], pick.holdsObjective === true ? "with an objective card attached" : null);
  note(["isGuard"], pick.isGuard === true ? "that is attached to an objective as its guard" : pick.isGuard === false ? "that is not guarding an objective" : null);
  note(["questedThisRound"], pick.questedThisRound === true ? "that was committed to this round's quest (the quest's resolution already cleared the commitment)" : null);
  note(["guardedByTrait"], typeof pick.guardedByTrait === "string" ? `guarded by (attached to) a ${pick.guardedByTrait} enemy` : null);
  note(["notGuardedByTrait"], typeof pick.notGuardedByTrait === "string" ? `not guarded by (attached to) a ${pick.notGuardedByTrait} enemy` : null);
  note(["guardsTrait"], typeof pick.guardsTrait === "string" ? `attached as the guard of a ${pick.guardsTrait} objective` : null);
  note(["controlled"], pick.controlled === true ? (pick.type === "ally" ? "that a player controls (not one a guard holds in the staging area)" : pick.type === "attachment" ? "that a player controls (not an encounter attachment)" : pick.type === "location" ? "that lies in a player's play area (a location the first player took control of, not one in the staging area or active)" : "that is claimed (attached to a character a player controls)") : null);
  note(["questCardType"], pick.questCardType === true ? "a quest card of any kind (a quest stage, an encounter side quest or a player side quest)" : null);
  note(["questCard"], pick.questCard === true ? "that is a quest card in play (the main quest card, an encounter side quest in the staging area or a player side quest)" : null);
  note(["maxHitPointsLeft"], typeof pick.maxHitPointsLeft === "number" ? `with ${pick.maxHitPointsLeft} or fewer hit points remaining` : null);
  note(["determined"], pick.determined === true ? "that the Campaign Log marks determined" : null);
  note(["keyword"], typeof pick.keyword === "string" ? (pick.keyword === "gainedAmbush" ? "that has the ambush keyword because a card gave it (the round's first enemy revealed, even one that prints Ambush)" : `with the ${pick.keyword} keyword, printed or gained`) : null);
  note(["safe"], pick.safe === true ? "with the safe keyword" : null);
  note(["isSource"], pick.isSource === true ? "that is this card itself" : null);
  note(["reanimated"], pick.reanimated === true ? "that is a Reanimated Dead" : null);
  note(["allInPlay"], pick.allInPlay === true ? "in play, attachments on any card (quest cards, enemies, characters) and the staging area and active location included, shadow cards not" + (pick.type === "enemy" && pick.trait === "Orc" ? "; an Orc enemy in the Orcs' area counts, at the same stage and at another" : "") : null);
  note(["sameTitleAsDiscarded"], pick.sameTitleAsDiscarded === true ? "that shares its printed title with a card the effect discarded from the chooser's own deck" : null);
  note(["inOrcsArea"], pick.inOrcsArea === true ? "in the Orcs' area (the area zone while the players are at another stage than the Orcs, the staging area at the same stage)" : null);
  note(["copyOfDefender"], pick.copyOfDefender === true ? "with the title of the defending character" : null);
  note(["timeCounter"], pick.timeCounter === true ? "with the Time keyword and a time counter on it" : null);
  note(["minDamage"], typeof pick.minDamage === "number" ? `with at least ${pick.minDamage} damage on it` : null);
  note(["aboveThreat"], pick.aboveThreat === true ? "with an engagement cost higher than the chooser's threat" : null);
  note(["on"], onWords(pick.on));
  note(["other"], pick.other === true ? "other than this card" : null);
  note(["takesSource"], pick.takesSource === true ? "that this card can be attached to (one that cannot have attachments is left out)" : null);
  note(["different"], pick.different === true ? (pick.from === "ravenDeck" ? "of a different title from the cards this effect already picked" : "other than the cards this effect already picked") : null);
  note(["guardsObjectiveLocation"], pick.guardsObjectiveLocation === true ? "attached to an objective-location as its guard" : null);
  note(["copyInDiscard"], pick.copyInDiscard === true ? "with a copy of it (the same title) in its controller's discard pile" : pick.copyInDiscard === "owner" ? "with a card of its title in its owner's discard pile" : null);
  // A Captive is in play but no player controls it (families/captives owns "Captives are in play but are not under any player's control", 143022:A:1).
  const control = pick.captive === "only" || pick.captive === "free" ? "in play, controlled by no player" : typeof pick.control === "string" ? (CONTROL[pick.control] ?? pick.control) : "";
  // A card of any player's reaches past the table: the staging area's cards and the active location answer it too (interpret/pick.ts).
  if (pick.type === "card" && pick.control === "any" && pick.stagingOnly !== true && (pick.from === undefined || pick.from === "play")) after.unshift("or in the staging area or the active location");
  const noun = [...front, str(pick.type)].join(" ");
  const text = `${noun} (${control})${after.length > 0 ? ` ${after.join(", ")}` : ""}`;
  return done(ctx, text, pick, read);
};
