// The single verbs of the shared schema, and the breaking, wizardry, defense, deck, caves, objectives, misc, dreamchaser and costs families (src/catalog/effect-schema-verbs.ts and families/): templates and samples.
import { cardRef } from "../amounts.ts";
import { amt, pck, who, type Samples, type Templates } from "../family-kit.ts";
import { isObj, joinAnd, str } from "../kit.ts";

const codes = (value: unknown): string => joinAnd((Array.isArray(value) ? value : []).map(str));
const UNTIL = { endOfPhase: "the end of the phase", endOfRound: "the end of the round" } as const;
const SPHERE = (value: unknown): string => str(value);

const XP_EACH: Readonly<Record<string, (each: Record<string, unknown>) => string>> = {
  survivingPlayer: () => "each surviving player",
  inVictory: (each) => `each card with code ${codes(each.codes)} in the victory display`,
  tokens: (each) => `each resource token on the card with code ${str(each.code)}`,
  islandFaceup: (each) => `each location of the Island Map with code ${str(each.code)} that has been flipped over, showing the location it is`,
};

// Where AttachSelf puts the card: each kind of host the schema names.
function attachHost(to: unknown): string {
  if (!isObj(to)) return str(to);
  if (to.kind === "ship") return to.defender === true ? "the Ship objective defending the attack in progress (nothing happens if the defender is not a Ship)" : "a Ship objective the players control, chosen by the first player";
  if (to.kind === "attackingEnemy") return "the enemy making the attack in progress";
  if (to.kind === "subject") return "the character the event is about (nobody is asked)";
  if (to.kind === "defender") return "the defending character of the attack in progress (nothing happens when the attack is undefended)";
  if (to.kind === "enemy") return `${to.challenge === true ? "the enemy with the most hit points left, by the opposing team, nobody being asked," : "an enemy"} with the trait ${str(to.trait)}`;
  if (to.kind === "character") return `a character (hero or ally, an objective ally included) of any player, chosen by the first player${typeof to.trait === "string" ? `, one that has the trait ${to.trait} now` : ""}${typeof to.name === "string" ? `, the character titled "${to.name}"` : ""}${to.control === "mostAttachments" ? ", among those holding the most attachments (the first player chooses among those tied)" : ""}${to.unlimited === true ? "; a character that carries a copy is offered too" : "; a character that carries a copy is not offered"} (the card is discarded when none can host it)`;
  const hero: Readonly<Record<string, string>> = { you: "a hero the revealing player controls", any: "any player's hero, chosen by the first player", highestThreat: "a hero of the player with the highest threat, who chooses it (the first player chooses among the players tied)", highestThreatCost: "the hero with the highest printed threat cost among every hero in play (the first player chooses among those tied)", picked: "a hero of the player the effect picked, who chooses it", mostAttachments: "the hero with the most attachments among those the card is not on yet (the first player chooses among those tied)", firstPlayer: "a hero the first player controls, chosen by the first player" };
  const filters = `${typeof to.exceptSphere === "string" ? ` that is not ${to.exceptSphere}` : ""}${typeof to.trait === "string" ? ` with the trait ${to.trait}` : ""}${typeof to.minWillpower === "number" ? ` with Willpower ${to.minWillpower} or more now` : ""}${to.unlimited === true ? " (a hero that carries a copy is offered too)" : ""}`;
  return `${hero[str(to.control ?? "you")] ?? str(to.control)}${filters}`;
}

export const CORE_TEMPLATES: Templates = {
  // breaking
  StartSeparateStage: (i) => ({ text: `the acting player creates a staging area and a quest stage of their own: the quest deck's card with printed code ${str(i.code)} becomes that seat's stage, stages are separate from now on, and the seat's area is empty${i.reveal === true ? "; the stage is revealed for the seat as it becomes its stage: its When Revealed effects resolve" : ""} (nothing when the code is not in the quest deck)`, read: ["code", "reveal"] }),
  SkipTravelPhase: () => ({ text: "skip the travel phase this round: the table holds skipTravel until the end of the round, and the round goes from the quest phase to the encounter phase with no travel window", read: [] }),
  RaiseThreatAtStage: (i) => ({ text: `each player at this card's stage raises their threat by ${str(i.amount)} (once the stages are separate, the seat whose staging area holds this card; every player before that)`, read: ["amount"] }),
  MoveToFirstStaging: (i) => ({ text: `${i.target === "picked" ? "the last picked enemy" : "this card"}, in a staging area or engaged, moves to the first player's staging area (with one staging area it goes to it)`, read: ["target"] }),
  RemoveRingBearer: () => ({ text: "the Ring-bearer, the hero The One Ring is attached to, and every card attached to it are removed from the game, wherever their controllers keep them, without being destroyed or discarded (The One Ring's text is blank, so its leaves-play line does not fire); a seat left with no heroes is eliminated", read: [] }),
  ZeroEngagementCosts: () => ({ text: "each enemy's engagement cost is read as 0 until the end of the encounter phase (the table holds engagementCostZero until the end of the round, and the cost is read as 0 only during the encounter phase)", read: [] }),
  ShuffleSetAsideIntoDiscard: (i) => ({ text: `each set-aside card with a printed code in ${codes(i.codes)} joins the encounter discard pile, and the whole pile is shuffled (a code with no card set aside is skipped)`, read: ["codes"] }),
  PlaceDiscardUnderDeck: () => ({ text: "the encounter discard pile, in the order it is in, goes under the encounter deck", read: [] }),
  DealOutStaging: () => ({ text: "in player order, each living seat in turn picks one card of the shared staging area (the first player chooses when a seat has several; the last one is taken without asking) until it holds none, and the card goes to that seat's own staging area (entering an area is not a reveal)", read: [] }),
  RevealIfDiscarded: () => ({ text: "(marker) when a card effect discards cards from the top of the encounter deck, this card, if it is among them, is revealed by the seat whose stage it is and is not discarded", read: [] }),
  TakeRingBearer: () => ({ text: "the Ring-bearer, if one is in play, and what is attached to it go to the acting player", read: [] }),
  LockFirstPlayer: () => ({ text: "for the rest of the game the first player token cannot be lost: it does not pass at the end of the refresh phase", read: [] }),
  MoveToLeftArea: () => ({ text: "this card, in a staging area, moves to the staging area to the left, the next living seat's, if able (nothing with one staging area or one seat)", read: [] }),
  FallIntoEvil: () => ({ text: "the attached non-Fellowship hero moves to the first player's staging area as an enemy (its Threat is its Willpower, its engagement cost its threat cost) and leaves its player's control; its game text is blank while it is one", read: [] }),
  ReturnFallenHero: () => ({ text: "each fallen hero in play goes back among its owner's heroes with its own code; one defeated while it was an enemy goes to its owner's discard pile", read: [] }),
  // wizardry, defense, deck, caves, objectives, misc
  TriggerWizardry: (i) => ({ text: `triggers the Wizardry effect on ${i.target === "shadowCard" ? "the shadow card the answered event names" : "the active location, without exploring it"}${i.asOnlyPlayer === true ? "; the acting player resolves it as if they are the only player in the game, so each \"each player\" reads them alone and the number of players is 1" : ""} (nothing for a card with no Wizardry line)`, read: ["target", "asOnlyPlayer"] }),
  CancelPhaseProgress: () => ({ text: "the progress placed on the current quest card since the phase began, the overflow of an explored active location included, is taken off it and forgotten", read: [] }),
  CancelAttack: () => ({ text: "the attack in progress is canceled: no shadow effect or damage resolves after this, and the enemy's attack is used up", read: [] }),
  ShadowAttacks: () => ({ text: "(a shadow effect of an enemy card) once the attack it was dealt to has ended, this enemy attacks the player that attack was made against, and goes to the top of the encounter deck at the end of the combat phase", read: [] }),
  ShuffleHandIntoDeck: (i) => ({ text: `the acting player's hand${i.keepPicked === true ? ", but the picked card (all of it when no picked card is in the hand)," : " (but this card)"} is shuffled into their deck; the effect's X becomes how many cards that was`, read: ["keepPicked"] }),
  SwapPicked: () => ({ text: "the card picked before the last (in a deck) and the last picked card (in a hand) change places: the hand's card takes the deck card's position and counts as one of the cards the effect looked at", read: [] }),
  SetAsideInPlay: (i) => ({ text: `the card in play with code ${str(i.code)} (an enemy in the staging area or engaged with a player) is set aside, out of play: it loses its attachments and ${i.keepDamage === true ? "its other tokens (the damage tokens stay on it)" : "its tokens"}; a later step can bring it back (nothing when no card with the code is in play)`, read: ["code", "keepDamage"] }),
  BottomOtherLooked: () => ({ text: "the cards the look showed that are still on top of the encounter deck, except the picked one, go to the bottom of the deck in the order they were in; the picked card is then the top card, and the reveal after it reveals it", read: [] }),
  ControlWhenFree: () => ({ text: "(constant, does nothing when run) this objective in the staging area is controlled by the players as soon as it is free of encounters and no effect is resolving: it is marked claimed, with no controller, so it stays in the staging area", read: [] }),
  DrawEach: (i, ctx) => ({ text: `every living player draws ${i.amount === undefined ? "1" : amt(i.amount, ctx)} card(s), the first player first (unlike ForEachPlayer it can be one branch of a Choose)`, read: ["amount"] }),
  GainXp: (i) => ({
    text: `Resolution: ${typeof i.amount === "number" && i.amount < 0 ? `lose ${-i.amount}` : `gain ${str(i.amount)}`} XP${isObj(i.each) ? ` for ${(XP_EACH[str(i.each.kind)] ?? (() => str(i.each)))(i.each)}` : ""}${typeof i.max === "number" ? `, at most ${i.max} XP from the line` : ""} (the scenario's lines add up in the Resolution's log; the Campaign Log keeps the total, never below 0; nothing is spent here)`,
    read: ["amount", "each", "max"],
  }),
  SpendResources: (i) => ({
    text: i.target === undefined
      ? `${i.group === true ? "the players as a group" : "the acting player"} spend ${str(i.amount)} resource(s) from heroes with ${typeof i.sphere === "string" ? `the ${SPHERE(i.sphere)} icon` : "this card's sphere icon"}, choosing a hero for each resource${i.group === true ? " (any player's)" : " (their own)"} (with fewer resources than that, nothing is spent)`
      : `${str(i.amount)} resource(s) are spent from the pool of ${cardRef(i.target)} (nobody chooses; a pool with fewer spends nothing)`,
    read: ["amount", "target", "sphere", "group", "paid"],
  }),
  Earn: (i) => ({ text: `Resolution: the cards with codes ${codes(i.codes)} are earned, with no choice${i.eachPlayer === true ? " (one copy for each living player)" : ""}${i.afterHand === true ? "; the copy goes into its player's deck, shuffled in once the starting hand is drawn" : ""}${i.forFirstPlayer === true ? "; the card is the first player's, a pool entry for that seat" : ""}`, read: ["codes", "eachPlayer", "afterHand", "forFirstPlayer"] }),
  GrantTrait: (i) => ({ text: `(constant on an attachment) the attached card gains the trait ${str(i.trait)}`, read: ["trait"] }),
  GrantIcon: (i) => ({ text: `(constant on an attachment) the attached hero also pays for ${SPHERE(i.sphere)} cards and counts as ${SPHERE(i.sphere)} hero for a filter that reads the sphere`, read: ["sphere"] }),
  HideTest: (i) => ({ text: `the revealing player makes a Hide test with Hide ${str(i.x)}: they may exhaust any number of ready characters they control to commit them, then discard the top ${str(i.x)} card(s) of the encounter deck (a treachery adds 0 Threat); the test passes when the committed characters' total Willpower is at least the total Threat of the discarded cards; a failure is recorded and the Forced effects that hear it resolve`, read: ["x"] }),
  AttachSelf: (i) => ({ text: `this card attaches itself to ${attachHost(i.to)}${i.announces === true ? " (announced as it attaches)" : ""}`, read: ["to", "announces"] }),
  ReduceNextCost: (i, ctx) => ({
    text: `the next ${pck(i.pick, ctx)} ${i.who === "any" ? "any player plays" : i.who === "picked" ? "the picked player plays" : "the acting player plays"}${i.hostSphere === true ? ", of the sphere of this card's host (read now)," : ""} costs ${amt(i.amount, ctx)} less until ${i.until === "used" ? "a card spends it" : (UNTIL[str(i.until) as keyof typeof UNTIL] ?? str(i.until))}${typeof i.min === "number" ? `, not below ${i.min}` : ""}${typeof i.doomed === "number" ? `; that card gains Doomed ${i.doomed}` : ""}${i.noMatch === true ? "; it needs no resource match" : ""}${i.cannotQuest === true ? "; it cannot quest this round" : ""}`,
    read: ["pick", "amount", "until", "min", "who", "hostSphere", "doomed", "noMatch", "cannotQuest"],
  }),
  ReduceCostOf: (i, ctx) => ({ text: `(constant) a ${pck(i.pick, ctx)} costs ${amt(i.amount, ctx)} less${typeof i.min === "number" ? `, not below ${i.min}` : ""}${i.firstEachRound === true ? `, only the first such card each round${i.anyPlayer === true ? ", counting the cards all the players play together" : ""}` : ""}${i.onHost === "self" ? ", only an attachment played on this card" : i.onHost === "host" ? ", only an attachment played on this card's host" : ""}${i.anyPlayer === true ? "; the discount is every player's, whoever controls this card" : ""}`, read: ["pick", "amount", "min", "firstEachRound", "onHost", "anyPlayer"] }),
  ReturnUnderToStaging: (i) => ({ text: `each card under ${typeof i.from === "string" ? `the card in play with code ${i.from}` : "this location"} ${i.to === "engaged" ? "is put into play engaged with the first player instead of the staging area, and counts as engaging them" : "returns to the staging area faceup"}`, read: ["to", "from"] }),
  RemoveQuestProgress: (i) => ({ text: `remove ${str(i.perPlayer)} progress from the current quest card for each player ${i.startedPlayers === true ? "who started the game" : "in the game"} (it stops at 0)`, read: ["perPlayer", "startedPlayers"] }),
  TransferHost: (i) => ({ text: `the host of this card, its resource pool, and every card attached to it pass to ${who(i.who)}`, read: ["who"] }),
  PutOnDeck: (i) => ({ text: `${i.target === undefined ? "the picked card" : cardRef(i.target)} goes ${i.position === "top" ? "on top of" : i.position === "bottom" ? "to the bottom of" : "into"} its owner's deck${i.position === "shuffle" ? ", which is shuffled" : ""} (a card leaving play this way leaves play)`, read: ["target", "position"] }),
  IgnoreResourceMatch: (i, ctx) => ({ text: `(constant) a ${pck(i.pick, ctx)} needs no resource match, and any of its controller's heroes may pay for it${i.firstEachRound === true ? ", only the first such card each round" : ""}${i.firstEachPhase === true ? ", only the first such card played in the phase" : ""}`, read: ["pick", "firstEachRound", "firstEachPhase"] }),
  PlaceQuestProgress: (i) => ({ text: `place ${str(i.perPlayer)} progress on the current quest for each player in the game; the active location takes it first and a full quest card advances unless something forbids it`, read: ["perPlayer"] }),
  DamageAll: (i) => ({ text: `deal ${str(i.amount)} damage to each ${str(i.type)} in play${typeof i.maxWillpower === "number" ? ` with Willpower ${i.maxWillpower} or less (a value below 0 counts as 0)` : ""}`, read: ["amount", "type", "maxWillpower"] }),
  BarAttack: (i) => ({ text: i.scope === "any" ? `the acting player picks an enemy engaged with any player; it cannot attack that player until ${UNTIL[str(i.until ?? "endOfPhase") as keyof typeof UNTIL] ?? str(i.until)}` : "the acting player picks an enemy engaged with them; it cannot attack them until the end of the round", read: ["scope", "until"] }),
  PlaceProgressOnLocation: (i) => ({ text: `place ${str(i.perPlayer)} progress for each player in the game on a non-unique location in play`, read: ["perPlayer"] }),
  UncommitAll: (i) => ({ text: `every character ${who(i.who)} controls is no longer committed to the quest (they stay exhausted)`, read: ["who"] }),
  ReduceOpeningHand: (i) => ({ text: `Setup: each player draws ${str(i.amount)} fewer card(s) in the starting hand (and in a mulligan redraw)`, read: ["amount"] }),
  ReturnToHand: (i) => ({ text: `${i.target === undefined ? "the picked card" : cardRef(i.target)} goes back to its owner's hand if it is still in play`, read: ["target"] }),
  ShuffleDeck: () => ({ text: "shuffle the acting player's deck", read: [] }),
  ShuffleOutOfPlayIntoEncounterDeck: (i) => ({ text: `one out-of-play copy of the card with code ${str(i.code)} (set aside, in the encounter discard pile, in the victory display or under a card) joins the encounter deck, which is shuffled (when copies are out of play in more than one zone the first player chooses which; nothing with no copy left)`, read: ["code"] }),
  AttachToRingBearer: (i) => ({ text: `Setup: the card with code ${str(i.code)} is attached to the Ring-bearer, the hero with that trait (the first player's hero is searched first, then the other seats in order); with no Ring-bearer the setup fails`, read: ["code"] }),
  ShuffleSelfIntoEncounterDeck: () => ({ text: "this card (a shadow card) is shuffled into the encounter deck instead of being discarded", read: [] }),
  PlaceUnderSelf: () => ({ text: "the last picked card is placed facedown under this location; while it is there it is out of play", read: [] }),
  EarnAllBurdens: () => ({ text: "Resolution: every burden in play, in the encounter deck and in the encounter discard pile is earned", read: [] }),
  WaiveThreatPenalty: () => ({ text: "Campaign Setup: the voluntary hero change costs no threat penalty in this scenario", read: [] }),
  MakeActiveLocation: (i) => ({ text: `Setup: the card with code ${str(i.code)} becomes the active location (placed there, not traveled to)`, read: ["code"] }),
  ReadyHero: () => ({ text: "the acting player readies one hero they control", read: [] }),
  AttachPicked: () => ({ text: "the card picked before the last pick (an attachment) is attached to the last picked card", read: [] }),
};

export const CORE_SAMPLES: Samples = {
  StartSeparateStage: [{ verb: "StartSeparateStage", code: "142063", reveal: true }],
  SkipTravelPhase: [{ verb: "SkipTravelPhase" }],
  RaiseThreatAtStage: [{ verb: "RaiseThreatAtStage", amount: 1 }],
  MoveToFirstStaging: [{ verb: "MoveToFirstStaging", target: "picked" }],
  RemoveRingBearer: [{ verb: "RemoveRingBearer" }],
  ZeroEngagementCosts: [{ verb: "ZeroEngagementCosts" }],
  ShuffleSetAsideIntoDiscard: [{ verb: "ShuffleSetAsideIntoDiscard", codes: ["142074", "142068"] }],
  PlaceDiscardUnderDeck: [{ verb: "PlaceDiscardUnderDeck" }],
  DealOutStaging: [{ verb: "DealOutStaging" }],
  RevealIfDiscarded: [{ verb: "RevealIfDiscarded" }],
  TakeRingBearer: [{ verb: "TakeRingBearer" }],
  LockFirstPlayer: [{ verb: "LockFirstPlayer" }],
  MoveToLeftArea: [{ verb: "MoveToLeftArea" }],
  FallIntoEvil: [{ verb: "FallIntoEvil" }],
  ReturnFallenHero: [{ verb: "ReturnFallenHero" }],
  TriggerWizardry: [{ verb: "TriggerWizardry", target: "shadowCard", asOnlyPlayer: true }],
  CancelPhaseProgress: [{ verb: "CancelPhaseProgress" }],
  CancelAttack: [{ verb: "CancelAttack" }],
  ShadowAttacks: [{ verb: "ShadowAttacks" }],
  ShuffleHandIntoDeck: [{ verb: "ShuffleHandIntoDeck", keepPicked: true }, { verb: "ShuffleHandIntoDeck" }],
  SwapPicked: [{ verb: "SwapPicked" }],
  SetAsideInPlay: [{ verb: "SetAsideInPlay", code: "50911", keepDamage: true }],
  BottomOtherLooked: [{ verb: "BottomOtherLooked" }],
  ControlWhenFree: [{ verb: "ControlWhenFree" }],
  DrawEach: [{ verb: "DrawEach", amount: 2 }],
  GainXp: [{ verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" }, max: 3 }, { verb: "GainXp", amount: -1 }, { verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: ["11178"] } }, { verb: "GainXp", amount: 1, each: { kind: "tokens", code: "11181" } }, { verb: "GainXp", amount: 1, each: { kind: "islandFaceup", code: "11197" } }],
  SpendResources: [{ verb: "SpendResources", amount: 2, sphere: "leadership", group: true }, { verb: "SpendResources", amount: 1, target: "picked" }],
  Earn: [{ verb: "Earn", codes: ["100158"], eachPlayer: true, afterHand: true, forFirstPlayer: true }],
  GrantTrait: [{ verb: "GrantTrait", trait: "Ranger" }],
  GrantIcon: [{ verb: "GrantIcon", sphere: "fellowship" }],
  HideTest: [{ verb: "HideTest", x: 3 }],
  AttachSelf: [
    { verb: "AttachSelf", to: { kind: "ship", defender: true }, announces: true },
    { verb: "AttachSelf", to: { kind: "hero", control: "highestThreat", exceptSphere: "fellowship", trait: "Warrior", minWillpower: 1, unlimited: true } },
    { verb: "AttachSelf", to: { kind: "enemy", trait: "Orc", challenge: true } },
    { verb: "AttachSelf", to: { kind: "attackingEnemy" } },
    { verb: "AttachSelf", to: { kind: "subject" } },
    { verb: "AttachSelf", to: { kind: "defender" } },
    { verb: "AttachSelf", to: { kind: "character", trait: "Eagle", name: "Wilyador", unlimited: true, control: "mostAttachments" } },
  ],
  ReduceNextCost: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally" }, amount: { x: true }, until: "endOfPhase", hostSphere: true }, { verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally" }, amount: 1, until: "used", min: 1, who: "any", doomed: 1, noMatch: true, cannotQuest: true }],
  ReduceCostOf: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", cardType: "ally" }, amount: 1, firstEachRound: true, anyPlayer: true, min: 1, onHost: "host" }, { verb: "ReduceCostOf", pick: { type: "card", control: "you" }, amount: 1, onHost: "self" }],
  ReturnUnderToStaging: [{ verb: "ReturnUnderToStaging", to: "engaged", from: "50621" }],
  RemoveQuestProgress: [{ verb: "RemoveQuestProgress", perPlayer: 5, startedPlayers: true }],
  TransferHost: [{ verb: "TransferHost", who: "firstPlayer" }],
  PutOnDeck: [{ verb: "PutOnDeck", position: "bottom", target: "host" }, { verb: "PutOnDeck", position: "shuffle" }, { verb: "PutOnDeck", position: "top" }],
  IgnoreResourceMatch: [{ verb: "IgnoreResourceMatch", pick: { type: "card", control: "you" }, firstEachRound: true, firstEachPhase: true }],
  PlaceQuestProgress: [{ verb: "PlaceQuestProgress", perPlayer: 1 }],
  DamageAll: [{ verb: "DamageAll", amount: 2, type: "ally", maxWillpower: 0 }],
  BarAttack: [{ verb: "BarAttack", scope: "any", until: "endOfRound" }, { verb: "BarAttack" }],
  PlaceProgressOnLocation: [{ verb: "PlaceProgressOnLocation", perPlayer: 2 }],
  UncommitAll: [{ verb: "UncommitAll", who: "actor" }],
  ReduceOpeningHand: [{ verb: "ReduceOpeningHand", amount: 1 }],
  ReturnToHand: [{ verb: "ReturnToHand", target: "host" }],
  ShuffleDeck: [{ verb: "ShuffleDeck" }],
  ShuffleOutOfPlayIntoEncounterDeck: [{ verb: "ShuffleOutOfPlayIntoEncounterDeck", code: "141069" }],
  AttachToRingBearer: [{ verb: "AttachToRingBearer", code: "141085" }],
  ShuffleSelfIntoEncounterDeck: [{ verb: "ShuffleSelfIntoEncounterDeck" }],
  PlaceUnderSelf: [{ verb: "PlaceUnderSelf" }],
  EarnAllBurdens: [{ verb: "EarnAllBurdens" }],
  WaiveThreatPenalty: [{ verb: "WaiveThreatPenalty" }],
  MakeActiveLocation: [{ verb: "MakeActiveLocation", code: "141031" }],
  ReadyHero: [{ verb: "ReadyHero" }],
  AttachPicked: [{ verb: "AttachPicked" }],
};
