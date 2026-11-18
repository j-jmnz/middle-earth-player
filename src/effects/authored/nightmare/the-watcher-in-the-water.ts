import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";


// The Watcher in the Water Nightmare (deck 9015, data/printed/nightmare.json). The setup card's A:1 and its side B are the deck-building text (inert). A:2: while Doors of Durin is in play The Watcher cannot be engaged at all; A:3: a Tentacle enemy destroyed damages The
// Watcher if it is in play; A:4: the stage cannot be defeated until Doors of Durin and The Watcher are both in the victory display. The Nightmare Watcher takes the standard one's place (the setup card's recipe), takes no damage from player card effects in the staging area, and
// deals the standard one's end-of-combat damage. The Tentacles and the locations use the discard check, `lookedAtEncounterDeck` and the Tentacle attachments of the box's records. The readings are in docs/brief.md (The Watcher in the Water).
// Rules: dwd.doors-of-durin, rr.cannot, rr.victory, rr.destroy, rr.damage, rr.shadow-effects, rr.search, rr.travel, rr.reveal, rr.first-player, rr.attachment-cards (data/rules/entries.json).
const DOORS = "04065";
const WATCHER = "04072";
const WATCHER_NIGHTMARE = "901502";
const LAST_STAGE = "04064";
const THE_WATCHER: PickSpec = { type: "enemy", control: "any", staging: true, names: ["The Watcher"] };
const ATTACHED = { kind: "sourceIn", zone: "attached" } as const;
const HOST_IS = (type: "character" | "hero") => ({ kind: "matches", card: "host", pick: { type, control: "any" } }) as const;
const CHECK: Condition = { kind: "discardedHasShadowOrTentacle" };
const DISCARD_TOP = { verb: "MoveEncounterCard", card: "deckTop", to: "discard" } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
    // 901501 setup card. A:2: while Doors of Durin is in play (the staging area or active) The Watcher cannot be engaged: no engagement check, no optional engagement, not by Ill Purpose or a card effect.
    {
      id: "901501:constant:1",
      cardCode: "901501",
      lines: ["901501:A:2"],
      timing: "constant",
      condition: { kind: "inPlay", code: DOORS, is: true },
      instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "endOfGame", holders: { type: "enemy", control: "any", staging: true, names: ["The Watcher"] } }],
    },
    // A:3: when a Tentacle enemy is destroyed, 1 damage is dealt to The Watcher when it is in play (the Watcher's own destruction deals none: it has left play).
    {
      id: "901501:forced:1",
      cardCode: "901501",
      lines: ["901501:A:3"],
      timing: "forced",
      trigger: "enemyDestroyed",
      subject: { type: "enemy", control: "any", trait: "Tentacle" },
      instructions: [{ verb: "Pick", pick: THE_WATCHER, when: { kind: "canPick", pick: THE_WATCHER } }, { verb: "DamageCard", amount: 1, target: "picked", when: { kind: "canPick", pick: THE_WATCHER } }],
    },
    // A:4: the players cannot win the game unless both Doors of Durin and The Watcher (04072, or 901502 when the Nightmare card took its place: twinCode, families/nightmare/guards.ts) are in the victory display. Defeating the last stage wins (rr.winning-the-game), so
    // the bar holds only that stage (04064, as Flight to the Ford's 906301:A:2 holds 141029): To the West-door is defeated as usual.
    {
      id: "901501:constant:2",
      cardCode: "901501",
      lines: ["901501:A:4"],
      timing: "constant",
      condition: { kind: "all", conditions: [{ kind: "inPlay", code: LAST_STAGE, is: true }, { kind: "any", conditions: [{ kind: "inVictory", code: DOORS, is: false }, { kind: "inVictory", code: WATCHER, is: false }] }] },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },

    // 901502 The Watcher. A:1: in the staging area it takes no damage from player card effects. A:2 is 04072:A:3.
    {
      id: "901502:constant:1",
      cardCode: WATCHER_NIGHTMARE,
      lines: ["901502:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "noPlayerEffectDamage", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    // A:2 is 04072:A:3's line, written out here: the copies test reads the box ledger only (docs/agents/agent-brief.md, Scenario procedure).
    {
      id: "901502:forced:1",
      cardCode: WATCHER_NIGHTMARE,
      lines: ["901502:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "staging" }] },
      instructions: [{ verb: "AssignDamage", amount: 3, pick: { type: "character", control: "you" }, who: "eachSeat", single: true }],
    },

    // 901503 Writhing Tentacle. Forced: when it engages a player the top card is discarded; on a match it makes an immediate attack (a marker tells its attack-resolved Forced effect to attach it) and, once that attack resolves, attaches to the defending character if there
    // was one still in play ("Attached character cannot commit to the quest"). An undefended attack or a destroyed defender leaves it engaged as an enemy.
    {
      id: "901503:forced:1",
      cardCode: "901503",
      lines: ["901503:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [DISCARD_TOP, { verb: "ModifyStat", stat: "attachesAfterAttack", amount: 1, until: "endOfPhase", target: "self", when: CHECK }, { verb: "ImmediateAttack", when: CHECK }],
    },
    {
      id: "901503:forced:2",
      cardCode: "901503",
      lines: ["901503:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      condition: { kind: "flag", stat: "attachesAfterAttack", holder: "self" },
      instructions: [{ verb: "AttachEnemyToPicked", to: "other", returns: "discard" }, { verb: "ModifyStat", stat: "attachesAfterAttack", amount: -1, until: "endOfPhase", target: "self" }],
    },
    { id: "901503:constant:1", cardCode: "901503", lines: ["901503:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Tentacle" }] },
    {
      id: "901503:constant:2",
      cardCode: "901503",
      lines: ["901503:A:1"],
      timing: "constant",
      condition: { kind: "all", conditions: [ATTACHED, HOST_IS("character")] },
      instructions: [{ verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", target: "host" }],
    },

    // 901504 Choking Tentacle. Forced: after its attack resolves the top card is discarded; on a match it attaches to a character the defending player controls (the first player chooses among them). Attached, each time the character readies it takes 1 damage.
    {
      id: "901504:forced:1",
      cardCode: "901504",
      lines: ["901504:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      instructions: [DISCARD_TOP, { verb: "Pick", pick: { type: "character", control: "any", who: "firstPlayer", controlledBy: "actor" }, when: CHECK }, { verb: "AttachEnemyToPicked", returns: "discard", when: CHECK }],
    },
    { id: "901504:constant:1", cardCode: "901504", lines: ["901504:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Tentacle" }] },
    { id: "901504:forced:2", cardCode: "901504", lines: ["901504:A:1"], timing: "forced", trigger: "readied", subject: "host", condition: { kind: "all", conditions: [ATTACHED, HOST_IS("character")] }, instructions: [{ verb: "DamageCard", amount: 1, target: "host" }] },

    // 901505 Banks of Sirannon. A:1: each Tentacle enemy in play, The Watcher included, gets +2 Defense for each copy in the staging area. A:2 (Shadow): for each point of damage the attack dealt, the defending player discards a random card from his hand.
    {
      id: "901505:constant:1",
      cardCode: "901505",
      lines: ["901505:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, trait: "Tentacle" } }],
    },
    { id: "901505:shadow:1", cardCode: "901505", lines: ["901505:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "DiscardRandomFromHand", amount: { dealt: true } }] }] },

    // 901506 Hideous Depths. A:1 Forced: after a player looks at cards of the encounter deck (a look at the top, a search) the deck is shuffled. A:2 Travel: reveal the topmost Tentacle enemy of the encounter discard pile (the players cannot travel here with none).
    { id: "901506:forced:1", cardCode: "901506", lines: ["901506:A:1"], timing: "forced", trigger: "lookedAtEncounterDeck", instructions: [{ verb: "ShuffleEncounterDeck" }] },
    { id: "901506:travel:1", cardCode: "901506", lines: ["901506:A:2"], timing: "travel", instructions: [{ verb: "RevealFromDiscard", type: "enemy", trait: "Tentacle" }] },

    // 901507 Pulled Under. When Revealed: 3 damage to each character, any player's, with a Tentacle attachment; with none damaged it gains surge. Shadow: the defending character with a Tentacle attachment is discarded.
    {
      id: "901507:whenRevealed:1",
      cardCode: "901507",
      lines: ["901507:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "DamageEachWithAttachment", amount: 3, trait: "Tentacle" }, { verb: "GainSurge", when: { kind: "not", condition: { kind: "x", min: 1 } } }],
    },
    {
      id: "901507:shadow:1",
      cardCode: "901507",
      lines: ["901507:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "Pick", pick: { type: "character", control: "any", defending: true, hasAttachment: { trait: "Tentacle" } }, when: { kind: "canPick", pick: { type: "character", control: "any", defending: true, hasAttachment: { trait: "Tentacle" } } } },
        { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "character", control: "any", defending: true, hasAttachment: { trait: "Tentacle" } } } },
      ],
    },

    // 901508 Rippling From Beneath. Surge is a keyword. When Revealed: the first player chooses X Tentacle enemies of the encounter discard pile (all of them when fewer) and they are shuffled into the deck; The Watcher, when in play, is healed X damage. X is the number of players.
    {
      id: "901508:whenRevealed:1",
      cardCode: "901508",
      lines: ["901508:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Repeat", times: { players: true }, instructions: [{ verb: "ShuffleIntoDeck", trait: "Tentacle", type: "enemy", who: "firstPlayer" }] },
        { verb: "Pick", pick: THE_WATCHER, when: { kind: "canPick", pick: THE_WATCHER } },
        { verb: "Heal", amount: { players: true }, target: "picked", when: { kind: "canPick", pick: THE_WATCHER } },
      ],
    },
];

export const AUTHORED_REPLACES: readonly string[] = [];
