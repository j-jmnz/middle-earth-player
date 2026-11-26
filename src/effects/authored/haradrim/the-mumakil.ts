import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

import { withCopies } from "../reprint.ts";

// Records for The Mûmakil (haradrim cycle part 4, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. See docs/scenarios/haradrim/the-mumakil.md, Readings, for each reading. The Wild Mûmak and the Capture objectives are set aside by the scenario's piles; stage 2A attaches a random Capture to a
// Mûmak (`AttachRandomSetAside`), where it lies faceup and controlled by nobody. Each Capture's Response is the player's the Mûmak is engaged with (`ActAsEngagedWithHost`): it adds the Capture and then the Mûmak to the victory display.
// Rules: rr.attachment-cards, rr.victory, rr.response, rr.forced, rr.engaged, rr.staging, rr.search, rr.first-player, rr.cannot, rr.explored, rr.active-location, rr.in-play-and-out-of-play, rr.shadow-effects, rr.blank, rr.current-quest, rr.travel (data/rules/entries.json).
type Cond = NonNullable<Effect["condition"]>;
type Instruction = Effect["instructions"][number];

// The card the step discarded from the actor's hand is the picked card; with an empty hand nothing was discarded and the picked card is an earlier one (another player's), which the actor does not control: no damage.
const DISCARDED_BY_ME: Cond = { kind: "matches", card: "picked", pick: { type: "card", control: "you", controlledBy: "actor" } };
const WILD_MUMAK: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Wild Mûmak"] };
const A_CHARACTER: PickSpec = { type: "character", control: "any" };
const THIS_ENEMY: PickSpec = { type: "enemy", control: "any", isSource: true };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// "After ~ attacks and destroys a character": the character's destruction by the attack names the attacking enemy as the other card, and `isSource` keeps it to the copy that attacked.
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: A_CHARACTER, condition: { kind: "matches", card: "other", pick: THIS_ENEMY } } as const satisfies Partial<Effect>;

// The Capture objectives lie attached to a Wild Mûmak. Their Response is offered only while the Mûmak is engaged with a player ("the engaged player"): in the staging area no player is engaged with it.
const HOST_ENGAGED: Extract<Cond, { kind: "matches" }> = { kind: "matches", card: "host", pick: { type: "enemy", control: "any" }, inPlay: true, inStaging: false };
const HOST_REMAINING = { stat: "hitPoints", of: "host", remaining: true } as const;
// "If X is equal to or greater than the attached enemy's remaining hit points": one less than the remaining hit points is less than X, read when the step runs.
const REACHES = (amount: Extract<Cond, { kind: "less" }>["left"]): Extract<Cond, { kind: "less" }> => ({ kind: "less", left: { ...HOST_REMAINING, plus: -1 }, right: amount });
// "Add [the Capture] and attached enemy to the victory display": one step, so the test of `when` reads the host's remaining hit points before the Capture leaves play and clears its host.
const CAPTURE_AND_MUMAK = (when?: Cond): Instruction[] => [{ verb: "AddWithHostToVictory", ...(when ? { when } : {}) }];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 17011 Horse-hair Lasso. After the attached enemy is dealt damage (the `damaged` event only exists for damage dealt: damage the cap or a cancel takes away is none, so the offer needs no `dealt` condition, which the offer's scope does not hold), the engaged player shuffles his deck and discards the top card; its printed cost (X or none is 0) at or above the enemy's remaining hit points captures it. An empty deck discards nothing.
    {
      id: "17011:response:1",
      cardCode: "17011",
      lines: ["17011:A:1"],
      timing: "response",
      trigger: "damaged",
      subject: "host",
      condition: HOST_ENGAGED,
      instructions: [
        { verb: "ActAsEngagedWithHost" },
        { verb: "ShuffleDeck" },
        { verb: "SetX", value: 0 },
        { verb: "DiscardTopOfDeck" },
        ...CAPTURE_AND_MUMAK({ kind: "all", conditions: [{ kind: "thenResolves" }, REACHES({ x: true })] }),
      ],
    },
    // 17012 Poisoned Spear. After the players quest successfully (heard once for each player), the player the attached enemy is engaged with discards the top card of the encounter deck (an empty deck is refilled from the discard pile first); its printed Threat at or above the enemy's remaining hit points captures it.
    {
      id: "17012:response:1",
      cardCode: "17012",
      lines: ["17012:A:1"],
      timing: "response",
      trigger: "questSucceeded",
      answeredBy: "eventSeat",
      condition: { kind: "matches", card: "host", pick: { type: "enemy", control: "any", engaged: "you" } },
      instructions: [{ verb: "DiscardEncounterTop", count: 1, reset: true }, ...CAPTURE_AND_MUMAK(REACHES({ discardedThreat: true }))],
    },
    // 17013 Pit Trap. After the players travel to a location, the engaged player adds the Capture and the enemy to the victory display if that location's printed Threat is at or above the enemy's remaining hit points.
    {
      id: "17013:response:1",
      cardCode: "17013",
      lines: ["17013:A:1"],
      timing: "response",
      trigger: "traveled",
      subject: { type: "location", control: "any" },
      condition: HOST_ENGAGED,
      instructions: [{ verb: "ActAsEngagedWithHost" }, ...CAPTURE_AND_MUMAK(REACHES({ stat: "threat", of: "subject", printed: true }))],
    },
    // 17014 Noose of Vines. After a character defends an attack against the attached enemy, if the defender (still in play) has more remaining hit points than the enemy.
    {
      id: "17014:response:1",
      cardCode: "17014",
      lines: ["17014:A:1"],
      timing: "response",
      trigger: "attackResolved",
      subject: "host",
      condition: HOST_ENGAGED,
      instructions: [
        { verb: "ActAsEngagedWithHost" },
        ...CAPTURE_AND_MUMAK({ kind: "all", conditions: [{ kind: "matches", card: "other", pick: A_CHARACTER, inPlay: true }, { kind: "less", left: HOST_REMAINING, right: { stat: "hitPoints", of: "other", remaining: true } }] }),
      ],
    },

    // 17015 Wild Mûmak. A:2: no more than 3 damage a round. A:3: at the end of the round the engaged player chooses to return it to the staging area or have it make an immediate attack (it is dealt a shadow card and stays engaged).
    { id: "17015:constant:1", cardCode: "17015", lines: ["17015:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: 3, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "17015:forced:1",
      cardCode: "17015",
      lines: ["17015:A:3"],
      timing: "forced",
      trigger: "endOfRound",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          seats: "engaged",
          instructions: [{ verb: "Choose", who: "actor", options: [{ id: "staging", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }, { id: "attack", instructions: [{ verb: "ImmediateAttackBy", target: "self" }] }] }],
        },
      ],
    },

    // 17016 Harad Tiger. A:1: it cannot be optionally engaged. A:2: after it attacks and destroys a character it returns to the staging area. Shadow: the attacker makes an additional attack against you after this one.
    { id: "17016:constant:1", cardCode: "17016", lines: ["17016:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "17016:forced:1", cardCode: "17016", lines: ["17016:A:2"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },
    { id: "17016:shadow:1", cardCode: "17016", lines: ["17016:A:3"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

    // 17017 Territorial Ape. A:1: +X Threat and +X Attack, X the active location's current Threat. Shadow: +1 Attack, +2 instead if a location was explored this round (the table notes explored locations: Setup of 17026).
    {
      id: "17017:constant:1",
      cardCode: "17017",
      lines: ["17017:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: { stat: "threat", of: "activeLocation" }, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attack", amount: { stat: "threat", of: "activeLocation" }, until: "whileSourceInPlay", target: "self" },
      ],
    },
    {
      id: "17017:shadow:1",
      cardCode: "17017",
      lines: ["17017:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "locationExploredThisRound" } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "locationExploredThisRound" } },
      ],
    },

    // 17018 Strangling Python. After it damages a character it attaches to that character as a Condition attachment ("Attached character cannot ready"); it is no enemy while it lies there. A character the damage destroyed cannot take it.
    {
      id: "17018:forced:1",
      cardCode: "17018",
      lines: ["17018:A:2"],
      timing: "forced",
      trigger: "damagedByAttack",
      subject: A_CHARACTER,
      condition: { kind: "matches", card: "attacker", pick: THIS_ENEMY },
      instructions: [{ verb: "AttachSelf", to: { kind: "subject" } }],
    },
    {
      id: "17018:constant:1",
      cardCode: "17018",
      lines: ["17018:A:2"],
      timing: "constant",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "attached" }, { kind: "matches", card: "host", pick: A_CHARACTER }] },
      instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" }],
    },

    // 17019 Giant Centipede. After it damages a character that character's text box is blank until the end of the round (Traits stay). Shadow: the defending character's text box is blank until the end of the round.
    {
      id: "17019:forced:1",
      cardCode: "17019",
      lines: ["17019:A:1"],
      timing: "forced",
      trigger: "damagedByAttack",
      subject: A_CHARACTER,
      condition: { kind: "matches", card: "attacker", pick: THIS_ENEMY },
      instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", target: "subject" }],
    },
    { id: "17019:shadow:1", cardCode: "17019", lines: ["17019:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", target: "defender" }] },

    // 17020 Mûmak Trail. A:1: while it is the active location it gains the Response "When Mûmak Trail leaves play as an explored location, search the encounter deck and discard pile for a Wild Mûmak and add it to the staging area. Shuffle the encounter deck." A "When" Response resolves before
    // stage 1B's "After" Forced effect for the same exploration (`whenFirst`; rr.response). A:2: each player raises his threat by 1 to travel here.
    {
      id: "17020:response:1",
      cardCode: "17020",
      lines: ["17020:A:1"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      whenFirst: true,
      instructions: [{ verb: "SearchMove", code: "17015", to: "staging" }, { verb: "ShuffleEncounterDeck" }],
    },
    { id: "17020:travel:1", cardCode: "17020", lines: ["17020:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },

    // 17021 Stampeding Oliphaunt. The first player chooses a Wild Mûmak in the staging area; it attacks the first player from the staging area (a shadow card is dealt, it stays in the staging area). With no attack made, the encounter deck and discard pile are searched for Mûmak Trail, added to the staging area; the deck is shuffled.
    {
      id: "17021:whenRevealed:1",
      cardCode: "17021",
      lines: ["17021:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { ...WILD_MUMAK, stagingOnly: true, who: "firstPlayer" } },
        { verb: "AttackWithPicked", who: "firstPlayer", counted: true },
        { verb: "SearchMove", code: "17020", to: "staging", when: { kind: "noneReturned" } },
        { verb: "ShuffleEncounterDeck" },
      ],
    },

    // 17022 The Savage South. When Revealed: each player discards the top 5 cards of his deck, then each card he controls that shares a title with one of those 5. Shadow: +1 Attack; if the attack destroys a character, the attacker returns to the staging area.
    {
      id: "17022:whenRevealed:1",
      cardCode: "17022",
      lines: ["17022:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: 5 }, { verb: "Each", pick: { type: "card", control: "you", sameTitleAsDiscarded: true }, instructions: [{ verb: "Discard", target: { kind: "picked" } }] }])],
    },
    {
      id: "17022:shadow:1",
      cardCode: "17022",
      lines: ["17022:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: { kind: "x", min: 1 } }] },
      ],
    },

    // 17023 Terrible Fever. When Revealed: the first player chooses a hero committed to the quest; it is removed from the quest and the Fever attaches to it ("Forced: At the end of the round, deal 1 damage to attached character"). Shadow: the defending character cannot ready until the end of the round.
    {
      id: "17023:whenRevealed:1",
      cardCode: "17023",
      lines: ["17023:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "hero", control: "any", committed: true, who: "firstPlayer" } },
        { verb: "RemoveFromQuest" },
        { verb: "AttachSelfToPicked" },
      ],
    },
    { id: "17023:constant:1", cardCode: "17023", lines: ["17023:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "attached" }, instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    { id: "17023:forced:1", cardCode: "17023", lines: ["17023:A:1"], timing: "forced", trigger: "endOfRound", condition: { kind: "sourceIn", zone: "attached" }, instructions: [{ verb: "DamageCard", amount: 1, target: "host" }] },
    { id: "17023:shadow:1", cardCode: "17023", lines: ["17023:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender" }] },

    // 17024 Biting Insects. Each player discards a random card from his hand and assigns X damage among characters he controls, X the discarded card's printed cost (X or none is 0). Shadow: the defending player does the same.
    {
      id: "17024:whenRevealed:1",
      cardCode: "17024",
      lines: ["17024:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          { verb: "DiscardRandomFromHand", remember: true },
          { verb: "AssignDamage", amount: { stat: "cost", of: "picked", printed: true }, pick: { type: "character", control: "you" }, when: DISCARDED_BY_ME },
        ]),
      ],
    },
    {
      id: "17024:shadow:1",
      cardCode: "17024",
      lines: ["17024:A:2"],
      timing: "shadow",
      instructions: [{ verb: "DiscardRandomFromHand", remember: true }, { verb: "AssignDamage", amount: { stat: "cost", of: "picked", printed: true }, pick: { type: "character", control: "you" }, when: DISCARDED_BY_ME }],
    },

    // 17025 Guardians of the Jungle (encounter side quest). A:1: each location gets +1 Threat. A:2: each time it becomes the current quest, the encounter deck and discard pile are searched for a Territorial Ape, put into play engaged with the first player.
    {
      id: "17025:constant:1",
      cardCode: "17025",
      lines: ["17025:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any" } }],
    },
    { id: "17025:forced:1", cardCode: "17025", lines: ["17025:A:2"], timing: "forced", trigger: "becameCurrentQuest", subject: "self", instructions: [{ verb: "SearchMove", code: "17017", to: "engagedFirstPlayer" }] },

    // 17026 Welcome to the Jungle. Setup: the Wild Mûmak and the Capture objectives are set aside by the scenario's piles; each player in turn takes a location whose title no earlier player took into the staging area; the deck is shuffled; the table notes each explored location for the round (`noteExplored`: Territorial Ape's shadow).
    {
      id: "17026:setup:1",
      cardCode: "17026",
      lines: ["17026:A:1"],
      timing: "setup",
      instructions: [
        EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", different: true, deckOnly: true }]),
        { verb: "ShuffleEncounterDeck" },
        { verb: "ModifyStat", stat: "noteExplored", amount: 1, until: "endOfGame", target: "table" },
      ],
    },
    // 17026:B:1: after the active location leaves play as an explored location, a set-aside Wild Mûmak is shuffled into the encounter deck.
    { id: "17026:forced:1", cardCode: "17026", lines: ["17026:B:1"], timing: "forced", trigger: "activeExplored", instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: "17015" }] },
    // 17026:B:2: the players cannot advance unless the number of Wild Mûmak in play (staging or engaged) is equal to the number of players.
    {
      id: "17026:constant:1",
      cardCode: "17026",
      lines: ["17026:B:2"],
      timing: "constant",
      condition: { kind: "any", conditions: [{ kind: "less", left: { count: WILD_MUMAK }, right: { players: true } }, { kind: "less", left: { players: true }, right: { count: WILD_MUMAK } }] },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },

    // 17027 Capture the Oliphaunts. When Revealed: starting with the first player, each player attaches 1 random set-aside Capture objective to a Wild Mûmak in play of his choice. B:1: no active location, one more card is revealed. B:2: the stage cannot be defeated while a Capture objective is in play; defeating it wins the game.
    {
      id: "17027:whenRevealed:1",
      cardCode: "17027",
      lines: ["17027:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: WILD_MUMAK }, { verb: "AttachRandomSetAside", trait: "Capture" }])],
    },
    {
      id: "17027:forced:1",
      cardCode: "17027",
      lines: ["17027:B:1"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "count", pick: { type: "location", control: "any", active: true }, max: 0 }] },
      instructions: [{ verb: "RevealMore", amount: 1 }],
    },
    {
      id: "17027:constant:1",
      cardCode: "17027",
      lines: ["17027:B:2"],
      timing: "constant",
      condition: { kind: "canPick", pick: { type: "card", control: "any", allInPlay: true, trait: "Capture" } },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
    { id: "17027:questResolution:1", cardCode: "17027", lines: ["17027:B:2"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },
  ],
);

export const AUTHORED_REPLACES: readonly string[] = [];
