import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Steward's Fear (Against the Shadow part 4, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json); Surge on the Unwelcome Discovery and A Knife in the Back is the card's keyword, and the enemies, locations and treacheries of Streets of
// Gondor and Brigands keep the records of Peril in Pelargir. Underworld X is written as records on each Underworld location (it is not a parsed keyword): a Forced effect on the entry (`encounterEnteredPlay` for a card revealed or put into play as the active location, `searchedIntoPlay` for a card a search
// found) takes the top cards of the underworld deck under the location, and the cards under it are staged by its Forced `leftPlay` effect when a location leaves play (ReturnUnderToStaging, as 141049:A:2). The readings are in docs/scenarios/against-the-shadow/the-stewards-fear.md (Readings).
// The underworld deck, the hidden Villain and Plot and the empty-deck loss are in families/pelargir/ (underworld.ts, empty-deck.ts).
// Rules: ats.underworld, ats.underworld-example, ats.setup-the-stewards-fear, ats.setup-the-stewards-fear-underworld-deck, rr.active-location, rr.explored, rr.forced, rr.in-play-and-out-of-play, rr.running-out-of-cards, rr.encounter-deck, rr.staging, rr.reveal, rr.surge, rr.victory, rr.destroy,
// rr.player-elimination, rr.quest-advancement, rr.objective-cards, rr.constant-ability, rr.step-6-4b, rr.attacks-outside-the-combat-phase, rr.optional-engagement, faq.cancel-encounter-card, faq.progress-without-advancing (data/rules/entries.json).
const VILLAINS = ["06015", "06016", "06017"];
const PLOTS = ["06029", "06030", "06031"];
// The enemies of Streets of Gondor and Brigands the Setup removes from the encounter deck, and the three Clue objectives (ats.setup-the-stewards-fear-underworld-deck).
const UNDERWORLD_DECK = ["05037", "05042", "05043", "05044", "06026", "06027", "06028"];

const UNDERWORLD_LOCATION: PickSpec = { type: "location", control: "any", trait: "Underworld" };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const FIRST_PLAYER_ALLY: PickSpec = { type: "ally", control: "any", controlledBy: "firstPlayer" };
const FIRST_PLAYER_HERO: PickSpec = { type: "hero", control: "any", controlledBy: "firstPlayer", who: "firstPlayer" };
const UNDEFENDED = { kind: "undefended" } as const satisfies Condition;
const CAN_PICK = (pick: PickSpec) => ({ kind: "canPick", pick }) as const satisfies Condition;
const HAS_NONE = (pick: PickSpec) => ({ kind: "not", condition: CAN_PICK(pick) }) as const satisfies Condition;
// An undefended attack, and the current quest holds a token of the kind: the option the defending player may take.
const REMOVABLE = (what: "progress" | "resources") => ({ kind: "all", conditions: [UNDEFENDED, { kind: "less", left: 0, right: { stat: what, of: "questStage" } }] }) as const satisfies Condition;
const TABLE_FLAG = (stat: "advanceNow" | "revealMore" | "losesAtEmptyDeck"): Instruction => ({ verb: "ModifyStat", stat, amount: 1, until: "whileSourceInPlay", target: stat === "advanceNow" ? "self" : "table" });

// Underworld X: the entry of the location (revealed, put into play as the active location) and the entry a search made (Lost in the City, the search of stage 1B). `amount` is the value, `line` the keyword line of the card.
const UNDERWORLD = (code: string, lines: readonly string[], amount: 1 | 2 | { players: true }): Effect[] => [
  { id: `${code}:forced:1`, cardCode: code, lines: [...lines], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "TakeUnderworld", amount, host: "self" }] },
  { id: `${code}:forced:2`, cardCode: code, lines: [...lines], timing: "forced", trigger: "searchedIntoPlay", subject: "self", instructions: [{ verb: "TakeUnderworld", amount, host: "self" }] },
];

// A Clue claimed from the staging area by exhausting a hero: the Clue goes to the victory display and places resource tokens on the current quest.
const CLUE = (code: string, tokens: number): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "action",
  condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, CAN_PICK(READY_HERO)] },
  instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "AddToVictory", target: "self" }, { verb: "PlaceResourceTokens", amount: tokens, on: "questStage" }],
});

// "Forced: After the active location leaves play as an explored location, place 1 resource token on this quest" (stages 1 and 2): the quest card hears the location it explored, and holds the token.
const EXPLORED_TOKEN = (stage: string, line: string): Effect => ({
  id: `${stage}:forced:1`,
  cardCode: stage,
  lines: [line],
  timing: "forced",
  trigger: "activeExplored",
  subject: { type: "location", control: "any" },
  instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "questStage" }],
});

// "If there are 4 or more resource tokens on <this quest>, advance to the next stage" (stages 1 and 2): a constant "if", checked at each settle (families/angmar/stage.ts advanceWhenFlagged), in any phase, once nothing is resolving.
const FOUR_TOKENS = (stage: string, line: string): Effect => ({ id: `${stage}:constant:1`, cardCode: stage, lines: [line], timing: "constant", condition: { kind: "tokens", code: stage, min: 4 }, instructions: [TABLE_FLAG("advanceNow")] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 06011 Conspiracy (stage 1). Setup: the underworld deck is built, and one Villain and one Plot are hidden; Roots of Mindolluin was set aside by the deal. B:1: The Fourth Star is found in the encounter deck (not its discard pile) and made the active location, which enters play as a search puts a card
  // into play (Underworld X applies), then the deck is shuffled. B:2 and B:3: a token for each location explored while it is the active location, and 4 of them advance the stage.
  {
    id: "06011:setup:1",
    cardCode: "06011",
    lines: ["06011:A:1"],
    timing: "setup",
    instructions: [{ verb: "BuildUnderworldDeck", codes: UNDERWORLD_DECK }, { verb: "HideOneAside", codes: VILLAINS }, { verb: "HideOneAside", codes: PLOTS }],
  },
  {
    id: "06011:whenRevealed:1",
    cardCode: "06011",
    lines: ["06011:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "SearchMove", code: "06022", to: "staging", deckOnly: true, remember: true }, { verb: "MakeActive", target: "picked" }, { verb: "ShuffleEncounterDeck" }],
  },
  EXPLORED_TOKEN("06011", "06011:B:2"),
  FOUR_TOKENS("06011", "06011:B:3"),

  // 06012 The Grand Design (stage 2). A:1: the hidden Plot is turned faceup and added to the staging area. B:1: Roots of Mindolluin becomes the active location and enters play (Underworld 1); the old active location returns to the staging area. B:2 and B:3 as stage 1.
  { id: "06012:whenRevealed:1", cardCode: "06012", lines: ["06012:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", trait: "Plot" }] },
  { id: "06012:whenRevealed:2", cardCode: "06012", lines: ["06012:B:1"], timing: "whenRevealed", instructions: [{ verb: "MakeSetAsideActive", code: "06019" }] },
  EXPLORED_TOKEN("06012", "06012:B:2"),
  FOUR_TOKENS("06012", "06012:B:3"),

  // 06013 The Confrontation (stage 3, the last). A:1: the hidden Villain is turned faceup and staged. B:1: the underworld deck is shuffled into the encounter deck. B:2: no advance while a Villain is in play; the last stage defeated wins the game.
  { id: "06013:whenRevealed:1", cardCode: "06013", lines: ["06013:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", trait: "Villain" }] },
  { id: "06013:whenRevealed:2", cardCode: "06013", lines: ["06013:B:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleUnderworldIntoEncounterDeck" }] },
  { id: "06013:constant:1", cardCode: "06013", lines: ["06013:B:2"], timing: "constant", condition: { kind: "enemyInPlay", trait: "Villain", is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 06014 Underworld Dissident (Brigand). A:1: +1 Attack for each location with the Trait Underworld in the staging area or active. A:2 (Shadow): undefended, the defending player removes 1 token from the current quest: a progress token or a resource token when the card holds both.
  { id: "06014:constant:1", cardCode: "06014", lines: ["06014:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: UNDERWORLD_LOCATION }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "06014:shadow:1",
    cardCode: "06014",
    lines: ["06014:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "progress", requires: REMOVABLE("progress"), instructions: [{ verb: "RemoveQuestTokens", kind: "progress", amount: 1 }] },
          { id: "resource", requires: REMOVABLE("resources"), instructions: [{ verb: "RemoveQuestTokens", kind: "resource", amount: 1 }] },
        ],
      },
    ],
  },

  // 06015 Daughter of Berúthiel (Villain). A:1: never optionally engaged. A:2: after her attack she returns to the staging area unless the engaged player raises his threat by 4.
  { id: "06015:constant:1", cardCode: "06015", lines: ["06015:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "06015:forced:1",
    cardCode: "06015",
    lines: ["06015:A:2"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "raise", instructions: [{ verb: "RaiseThreat", amount: 4, who: "actor" }] }, { id: "return", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }],
  },

  // 06016 The Hand of Castamir (Villain). A:1: after it attacks the top card of the encounter deck is revealed, resolved and discarded (it never enters play). A:2: after a treachery card is revealed from the encounter deck it makes an immediate attack against the first player.
  { id: "06016:forced:1", cardCode: "06016", lines: ["06016:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", instructions: [{ verb: "RevealTopThenDiscard" }] },
  { id: "06016:forced:2", cardCode: "06016", lines: ["06016:A:2"], timing: "forced", trigger: "revealed", byEncounterDeck: true, subject: { type: "treachery", control: "any" }, instructions: [{ verb: "ImmediateAttack" }] },

  // 06017 Telemnar's Bane (Villain). A:1: each time it attacks, the top 3 cards of every player's deck are discarded. A:2: after any player plays an event card it makes an immediate attack against the first player.
  { id: "06017:forced:1", cardCode: "06017", lines: ["06017:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: 3 }] }] },
  { id: "06017:forced:2", cardCode: "06017", lines: ["06017:A:2"], timing: "forced", trigger: "played", subject: { type: "card", control: "any", cardType: "event" }, instructions: [{ verb: "ImmediateAttack" }] },

  // 06018 Sewers. A:1: Underworld 1. A:2 (When Revealed, resolved before the card enters play): the top card of the underworld deck goes facedown under the active location, if able.
  ...UNDERWORLD("06018", ["06018:A:1"], 1),
  { id: "06018:whenRevealed:1", cardCode: "06018", lines: ["06018:A:2"], timing: "whenRevealed", instructions: [{ verb: "TakeUnderworld", amount: 1, host: "activeLocation" }] },
  // The cards under an Underworld location are staged when it leaves play, explored or not (ats.underworld): Sewers, Storehouse, Houses of the Dead, Roots of Mindolluin and The Fourth Star.
  ...["06018", "06019", "06020", "06021", "06022"].map(
    (code): Effect => ({ id: `${code}:forced:3`, cardCode: code, lines: [`${code}:A:1`], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "ReturnUnderToStaging" }] }),
  ),

  // 06019 Roots of Mindolluin (set aside, made active by stage 2B). A:1: Underworld 1 (it enters play through MakeSetAsideActive, no search). A:2: each location in the staging area gets +2 quest points, itself included while it lies there.
  { id: "06019:forced:1", cardCode: "06019", lines: ["06019:A:1"], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "TakeUnderworld", amount: 1, host: "self" }] },
  { id: "06019:constant:1", cardCode: "06019", lines: ["06019:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 2, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },

  // 06020 Storehouse. A:1: Underworld 1 (a shadow card that is never in play takes none). A:2 (Shadow): the attacker gets +1 Attack, +2 instead when the attack is undefended.
  ...UNDERWORLD("06020", ["06020:A:1"], 1),
  {
    id: "06020:shadow:1",
    cardCode: "06020",
    lines: ["06020:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: UNDEFENDED } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: UNDEFENDED },
    ],
  },

  // 06021 Houses of the Dead. A:1: Underworld 2. A:2: after it becomes the active location every character (heroes and allies of every player) exhausts.
  ...UNDERWORLD("06021", ["06021:A:1"], 2),
  { id: "06021:forced:4", cardCode: "06021", lines: ["06021:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "ExhaustEach", pick: { type: "character", control: "any" } }] },

  // 06022 The Fourth Star. A:1 and A:2: Underworld X, X the players in the game when it enters play. A:3: when it leaves play explored each player (the first first) may draw 1 card.
  ...UNDERWORLD("06022", ["06022:A:1", "06022:A:2"], { players: true }),
  {
    id: "06022:response:1",
    cardCode: "06022",
    lines: ["06022:A:3"],
    timing: "response",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "subjectExplored" },
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "draw", instructions: [{ verb: "Draw", amount: 1 }] }, { id: "skip", instructions: [] }] }] }],
  },

  // 06023 Unwelcome Discovery (Surge is the card's keyword). A:2: the top card of the underworld deck is revealed and staged; a Clue is placed in the encounter discard pile instead.
  { id: "06023:whenRevealed:1", cardCode: "06023", lines: ["06023:A:2"], timing: "whenRevealed", instructions: [{ verb: "RevealUnderworld", discardTrait: "Clue" }] },

  // 06024 A Knife in the Back (Surge is the card's keyword). A:1: an ally of the first player is chosen at random; the first player deals damage equal to its Attack to one of his heroes; then it is discarded. With no ally the card gains surge.
  {
    id: "06024:whenRevealed:1",
    cardCode: "06024",
    lines: ["06024:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: HAS_NONE(FIRST_PLAYER_ALLY) },
      { verb: "PickRandom", pick: FIRST_PLAYER_ALLY },
      { verb: "Pick", pick: FIRST_PLAYER_HERO, when: CAN_PICK(FIRST_PLAYER_ALLY) },
      { verb: "DamageCard", amount: { stat: "attack", of: "previous" }, target: "picked", when: CAN_PICK(FIRST_PLAYER_ALLY) },
      { verb: "Discard", target: { kind: "previous" }, when: CAN_PICK(FIRST_PLAYER_ALLY) },
    ],
  },

  // 06025 False Lead. A:1: the quest phase ends at once, the quest unresolved. A:2 (Shadow): if the attack destroys a character, every token leaves the current quest.
  { id: "06025:whenRevealed:1", cardCode: "06025", lines: ["06025:A:1"], timing: "whenRevealed", instructions: [{ verb: "EndQuestPhase" }] },
  { id: "06025:shadow:1", cardCode: "06025", lines: ["06025:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RemoveQuestTokens", kind: "any", when: { kind: "x", min: 1 } }] }] },

  // 06026 A Scrap of History, 06027 Secret Map, 06028 A Prisoner (Clue objectives, in the underworld deck). A Scrap of History and A Prisoner: exhaust a hero to claim them into the victory display and put 1 (2) resource tokens on the current quest. Secret Map: exhaust a hero to claim it and attach it to
  // that hero; attached, it may go to the victory display to put 3 progress tokens on the active location.
  CLUE("06026", 1),
  { id: "06027:action:1", cardCode: "06027", lines: ["06027:A:1"], timing: "action", condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, CAN_PICK(READY_HERO)] }, instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }] },
  {
    id: "06027:action:2",
    cardCode: "06027",
    lines: ["06027:A:2"],
    timing: "action",
    cost: { kind: "addSelfToVictory" },
    condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "attached" }, CAN_PICK({ type: "location", control: "any", active: true })] },
    instructions: [{ verb: "PlaceProgressOn", amount: 3, target: "activeLocation" }],
  },
  CLUE("06028", 2),

  // 06029 Unholy Alliance (the hidden Plot). A:1: one additional card is revealed in each staging step. A:2: a hero destroyed by an enemy attack loses the game for the players.
  { id: "06029:constant:1", cardCode: "06029", lines: ["06029:A:1"], timing: "constant", instructions: [TABLE_FLAG("revealMore")] },
  { id: "06029:forced:1", cardCode: "06029", lines: ["06029:A:2"], timing: "forced", trigger: "characterDestroyedByAttack", subject: { type: "hero", control: "any" }, instructions: [{ verb: "LoseGame", reason: "Unholy Alliance: a hero was destroyed by an enemy attack" }] },

  // 06030 Up in Flames (the hidden Plot). A:1: at the end of the round a token is placed on it, then X cards (X the tokens on it) are discarded from each player's deck. A:2: a player with no cards in his deck loses the game for the players.
  {
    id: "06030:forced:1",
    cardCode: "06030",
    lines: ["06030:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [{ verb: "PlaceToken", amount: 1 }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: { stat: "resources", of: "self" } }] }],
  },
  { id: "06030:constant:1", cardCode: "06030", lines: ["06030:A:2"], timing: "constant", instructions: [TABLE_FLAG("losesAtEmptyDeck")] },

  // 06031 Poisoned Counsels (the hidden Plot). A:1: at the end of each round every player raises his threat by 2.
  { id: "06031:forced:1", cardCode: "06031", lines: ["06031:A:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
