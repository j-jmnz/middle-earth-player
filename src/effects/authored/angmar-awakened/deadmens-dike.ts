import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as DROWNED } from "../the-drowned-ruins.ts";
import { AUTHORED_EFFECTS as SIEGE } from "../return-of-the-king/the-siege-of-gondor.ts";
import { AUTHORED_EFFECTS as WEATHER } from "./the-weather-hills.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Deadmen's Dike (Angmar Awakened part 3, campaign card 10166): the encounter cards no template reads, the two quest stages, the campaign card's Setup and Forced effect, Arnor Ravaged, Amarthiúl's Courage and Thaurdir's three burdens.
// Every line is read from the scan ledger (data/printed/angmar-awakened.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The three encounter side quests lie in the encounter deck
// (families/wilderland/night-quest.ts markSideQuests); Thaurdir is set aside until stage 2A adds him to the staging area. The vocabulary the box added is in src/catalog/families/angmar.ts and src/catalog/families/deck.ts.
// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.time-x, mec108.indestructible, mec108.setup-deadmens-dike, mec108.campaign-setup-deadmens-dike, mec108.campaign-mode, rr.travel, rr.player-elimination, rr.constant-ability, rr.triggered-ability, rr.blank, rr.effects,
// rr.first-player, rr.forced, rr.campaign-pool, rr.burdens, rr.surge, rr.damage, faq.enemy-attacks-outside-combat (data/rules/entries.json).
const THAURDIR = "09033";
const BALEFUL_SHADE = "09035";
const FORNOST_SQUARE = "09038";
const PENDANT = "10157";
const PROTECT_THE_INNOCENT = "10158";
const ARNOR_RAVAGED = "100158";
const BURDENS = ["10168", "10169", "10170"];

// A burden's Forced effect and constants: after a Sorcery treachery is revealed it moves to the hero holding the most of `most`; it counts as a Sorcery attachment and, on a hero, applies its stat lines. The three burdens differ only by code, `most` and `mods`.
const BURDEN = (code: string, most: Extract<Instruction, { verb: "MoveToHero" }>["most"], mods: readonly Instruction[]): Effect[] => [
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:2`], timing: "forced", trigger: "revealed", subject: { type: "treachery", control: "any", trait: "Sorcery" }, instructions: [{ verb: "MoveToHero", most }] },
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Sorcery" }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any" } }, instructions: [...mods] },
];

const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const REFRESH_ENDS: Condition = { kind: "phase", is: "Refresh" };
// "Thaurdir": the enemy with that title, in play.
const THAURDIR_PICK: PickSpec = { type: "enemy", control: "any", names: ["Thaurdir"] };
// "Each Undead enemy in play": staged or engaged with anyone.
const UNDEAD_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Undead", staging: true };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const MY_QUESTER: PickSpec = { type: "character", control: "you", committed: true };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const ATTACKER_PLUS = (amount: Extract<Instruction, { verb: "ModifyStat" }>["amount"]): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker" });
// "each player discards the top N cards of his deck".
const EACH_DISCARDS = (amount: number): Instruction => EACH_PLAYER([{ verb: "DiscardFromDeck", amount }]);
// "each player shuffles the top 5 cards of his discard pile back into his deck": the cards of the pile's top, moved into the deck, which is shuffled.
const EACH_SHUFFLES_TOP_FIVE: Instruction = { verb: "Each", pick: { type: "card", control: "any", from: "discard", top: 5 }, instructions: [{ verb: "MoveCard", to: "deckShuffle" }] };
// "Forced: At the end of the refresh phase" while the side quest is in the staging area.
const STAGED_AT_REFRESH_END: Condition = { kind: "all", conditions: [REFRESH_ENDS, IN_STAGING] };
// The Undead enemy count, and the same in a player's engagement area.
const MY_UNDEAD: PickSpec = { type: "enemy", control: "any", trait: "Undead", engaged: "you" };
// "Each player reveals 1 encounter card per player" (the stages' When Revealed): the first player's reveals, one per player.
const REVEAL_PER_PLAYER: Instruction = { verb: "Repeat", times: { players: true }, instructions: [{ verb: "RevealEncounter" }] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 09033 Thaurdir (Indestructible, Cannot have attachments: the build). Forced: after a Sorcery treachery is revealed from the encounter deck he heals 3 damage and makes an immediate attack against the first player, from where he is (staging or engaged:
    // a shadow card is dealt, faq.enemy-attacks-outside-combat). Not while he is set aside.
    {
      id: "09033:forced:1",
      cardCode: THAURDIR,
      lines: ["09033:A:3"],
      timing: "forced",
      trigger: "revealed",
      notFromDiscard: true,
      subject: { type: "treachery", control: "any", trait: "Sorcery" },
      instructions: [{ verb: "Heal", amount: 3, target: "self" }, { verb: "AttackFromStaging", target: "self", who: "firstPlayer", orEngaged: true }],
    },

    // 09034 Thaurdir's Damned. Forced: after it engages you, discard the top 2 cards of your deck and assign X damage among the characters you control, X the combined printed cost of the discarded cards.
    {
      id: "09034:forced:1",
      cardCode: "09034",
      lines: ["09034:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "DiscardFromDeck", amount: 2 }, { verb: "AssignDamage", amount: { discarded: "cost" }, pick: MY_CHARACTER }],
    },

    // 09035 Baleful Shade. Forced: when it attacks the defending player discards the top card of his deck, and an ally gives it +2 Attack for this attack. Shadow: exhaust a character you control (copied).
    {
      id: "09035:forced:1",
      cardCode: BALEFUL_SHADE,
      lines: ["09035:A:1"],
      timing: "forced",
      trigger: "attacks",
      subject: "self",
      instructions: [
        { verb: "DiscardFromDeck", amount: 1, count: { type: "ally", control: "any", looked: true } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "self", when: { kind: "x", min: 1 } },
      ],
    },
    copyLine("145042:A:3", "09035:A:2"),

    // 09036 Broken Battlements (Time 3). Forced: after the last time counter is removed each player discards the top 5 cards of his deck and places 1 time counter here. Travel: each player discards the top card of his deck.
    { id: "09036:constant:1", cardCode: "09036", lines: ["09036:A:1"], timing: "constant", instructions: [{ verb: "Time", amount: 3 }] },
    {
      id: "09036:forced:1",
      cardCode: "09036",
      lines: ["09036:A:2"],
      timing: "forced",
      trigger: "lastTimeCounterRemoved",
      subject: "self",
      instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: 5 }, { verb: "PlaceResourceTokens", amount: 1, on: "self" }])],
    },
    { id: "09036:travel:1", cardCode: "09036", lines: ["09036:A:3"], timing: "travel", instructions: [EACH_DISCARDS(1)] },

    // 09037 Norbury Tombs. While it is the active location it gains a Response: when explored each player shuffles the top 5 cards of his discard pile into his deck (an encounter card's effect: the lock of The Power of Angmar does not stop it). Travel: return the topmost enemy
    // in the encounter discard pile to the staging area (a cost, rr.travel: the players cannot travel here with no enemy there).
    { id: "09037:response:1", cardCode: "09037", lines: ["09037:A:1"], timing: "response", trigger: "activeExplored", subject: "self", instructions: [EACH_SHUFFLES_TOP_FIVE] },
    { id: "09037:travel:1", cardCode: "09037", lines: ["09037:A:2"], timing: "travel", instructions: [{ verb: "PickDiscardTop", types: ["enemy"] }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },

    // 09038 Fornost Square. +1 Threat for each resource token on it (copied). Forced: after the first player discards cards from the top of his deck, 1 resource token goes on it (once for each discard effect or cost, not for each card).
    copyLine("09027:A:1", "09038:A:1"),
    {
      id: "09038:forced:1",
      cardCode: FORNOST_SQUARE,
      lines: ["09038:A:2"],
      timing: "forced",
      trigger: "deckTopDiscarded",
      condition: { kind: "firstPlayer" },
      instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }],
    },

    // 09039 Haunted Keep. While it is the active location the first Undead enemy revealed each round gains surge. Shadow: the defending player discards the top card of his deck and the attacking enemy gets +X Attack, X that card's printed cost.
    { id: "09039:constant:1", cardCode: "09039", lines: ["09039:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "FirstTraitSurge", trait: "Undead", type: "enemy" }] },
    { id: "09039:shadow:1", cardCode: "09039", lines: ["09039:A:2"], timing: "shadow", instructions: [{ verb: "DiscardFromDeck", amount: 1 }, ATTACKER_PLUS({ discarded: "cost" })] },

    // 09040 Deadmen's Gate. While it is the active location it gains a Forced effect: after a player triggers an Action or a Response effect he discards the top card of his deck (an event played for its Action counts; not a Forced effect or a Travel line). Shadow: discard an attachment
    // you control (copied).
    { id: "09040:forced:1", cardCode: "09040", lines: ["09040:A:1"], timing: "forced", trigger: "playerAbilityTriggered", subject: { type: "card", control: "any" }, condition: ACTIVE, instructions: [{ verb: "DiscardFromDeck", amount: 1 }] },
    copyLine("12107:A:2", "09040:A:2"),

    // 09041 Unnatural Fog. When Revealed: each player chooses for himself: discard 1 card from the top of his deck for each questing character he controls, or remove each character he controls from the quest (an option that changes nothing is not offered).
    {
      id: "09041:whenRevealed:1",
      cardCode: "09041",
      lines: ["09041:A:2"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "discard", requires: { kind: "canPick", pick: MY_QUESTER }, instructions: [{ verb: "DiscardFromDeck", amount: { count: MY_QUESTER } }] },
              { id: "remove", requires: { kind: "canPick", pick: MY_QUESTER }, instructions: [{ verb: "Each", pick: MY_QUESTER, instructions: [{ verb: "RemoveFromQuest" }] }] },
            ],
          },
        ]),
      ],
    },

    // 09042 The Shadow World (side quest, 5 quest points; Surge is a keyword). Forced: at the end of the refresh phase each player discards the top X cards of his deck, X the number of Undead enemies engaged with him.
    { id: "09042:forced:1", cardCode: "09042", lines: ["09042:A:2"], timing: "forced", trigger: "endOfPhase", condition: STAGED_AT_REFRESH_END, instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: { count: MY_UNDEAD } }])] },

    // 09060 Dead Lord. Forced: after it engages you, the topmost Undead enemy in the encounter discard pile is put into play engaged with you (not revealed; it has engaged you, so its own "engages you" effect is heard). Shadow: +1 Attack; if the attack destroys a character, reveal 1 encounter card.
    {
      id: "09060:forced:1",
      cardCode: "09060",
      lines: ["09060:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "PickDiscardTop", types: ["enemy"], trait: "Undead" }, { verb: "MoveEncounterCard", card: "picked", to: "engaged"}],
    },
    { id: "09060:shadow:1", cardCode: "09060", lines: ["09060:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS(1), { verb: "AfterAttack", instructions: [{ verb: "RevealEncounter", when: { kind: "x", min: 1 } }] }] },

    // 09061 Cursed Dead. When Revealed: every copy in the encounter discard pile is put into play in the staging area (not revealed). Shadow: +1 Attack, +2 instead with a copy of the defending character in its owner's discard pile.
    { id: "09061:whenRevealed:1", cardCode: "09061", lines: ["09061:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", code: "09061", to: "staging", each: true, discardOnly: true }] },
    {
      id: "09061:shadow:1",
      cardCode: "09061",
      lines: ["09061:A:2"],
      timing: "shadow",
      instructions: [
        ATTACKER_PLUS(1),
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", copyInDiscard: "owner" } } },
      ],
    },

    // 09062 Restless Evil. When Revealed: each Undead enemy in play gets +1 Threat, +1 Attack and +1 Defense until the end of the round; with none in play it gains surge. Shadow: each Undead enemy engaged with you gets +1 Attack and +1 Defense until the end of the round.
    {
      id: "09062:whenRevealed:1",
      cardCode: "09062",
      lines: ["09062:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: UNDEAD_ENEMY } } },
        {
          verb: "Each",
          pick: UNDEAD_ENEMY,
          instructions: [
            { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfRound", target: "picked" },
            { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "picked" },
            { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfRound", target: "picked" },
          ],
        },
      ],
    },
    {
      id: "09062:shadow:1",
      cardCode: "09062",
      lines: ["09062:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Each", pick: MY_UNDEAD, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "picked" }, { verb: "ModifyStat", stat: "defense", amount: 1, until: "endOfRound", target: "picked" }] }],
    },

    // 09063 Seal the Tomb (side quest, 6 quest points; Surge is a keyword). Forced: at the end of the refresh phase discard the top 3 cards of the encounter deck, then return the topmost Undead enemy in the encounter discard pile to the staging area (not a reveal).
    {
      id: "09063:forced:1",
      cardCode: "09063",
      lines: ["09063:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: STAGED_AT_REFRESH_END,
      instructions: [{ verb: "DiscardEncounterTop", count: 3 }, { verb: "PickDiscardTop", types: ["enemy"], trait: "Undead" }, { verb: "MoveEncounterCard", card: "picked", to: "staging"}],
    },

    // 09064 Terror of the North. When Revealed: each player discards the top 3 cards of his deck; until the end of the round the total Threat in the staging area is 2 higher for each different card type discarded (all the players' cards together). Shadow: the defending player
    // discards the top 3 cards of his deck and the attacking enemy gets +1 Attack for each different card type discarded.
    {
      id: "09064:whenRevealed:1",
      cardCode: "09064",
      lines: ["09064:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_DISCARDS(3), { verb: "RaiseStagingThreat", amount: { discarded: "types", times: 2 }, until: "endOfRound" }],
    },
    { id: "09064:shadow:1", cardCode: "09064", lines: ["09064:A:2"], timing: "shadow", instructions: [{ verb: "DiscardFromDeck", amount: 3 }, ATTACKER_PLUS({ discarded: "types" })] },

    // 09065 Dark Sorcery. When Revealed: each player discards each ally he controls that shares a title with a card in his discard pile. Shadow: discard the defending character if a copy of it is in its owner's discard pile.
    {
      id: "09065:whenRevealed:1",
      cardCode: "09065",
      lines: ["09065:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Each", pick: { type: "ally", control: "any", copyInDiscard: true }, instructions: [{ verb: "Discard", target: { kind: "picked" } }] }],
    },
    {
      id: "09065:shadow:1",
      cardCode: "09065",
      lines: ["09065:A:3"],
      timing: "shadow",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "any", defending: true, copyInDiscard: "owner" } }, { verb: "DiscardPicked" }],
    },

    // 09066 Heavy Curse. When Revealed: attached to the current quest as a Condition attachment; while it is in play a card a player plays (from any zone) costs 1 more when a card with the same title is in its owner's discard pile (several Curses stack).
    { id: "09066:whenRevealed:1", cardCode: "09066", lines: ["09066:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToQuest" }] },
    { id: "09066:constant:1", cardCode: "09066", lines: ["09066:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "IncreaseCost", amount: 1, pick: { type: "card", control: "any", copyInDiscard: "owner" } }] },

    // 09067 The Power of Angmar (side quest, 8 quest points). In the staging area no player card effect takes a card out of a discard pile. Forced: after it is defeated each player shuffles the top 5 cards of his discard pile into his deck.
    { id: "09067:constant:1", cardCode: "09067", lines: ["09067:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "discardLocked", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "09067:forced:1", cardCode: "09067", lines: ["09067:A:3"], timing: "forced", trigger: "questDefeated", subject: "self", instructions: [EACH_SHUFFLES_TOP_FIVE] },

    // 09073 The Shades of Angmar (stage 1). Iârion is put into play under the first player (Thaurdir is set aside and 1 Fornost Square added to the staging area by the piles) and the encounter deck is shuffled. Side B: each player searches the encounter deck for a Baleful Shade and puts it
    // into play engaged with him, the deck is shuffled and 1 encounter card is revealed per player; Forced: at the end of the refresh phase each player discards the top card of his deck; a player with no cards in his deck is eliminated.
    { id: "09073:setup:1", cardCode: "09073", lines: ["09073:A:1"], timing: "setup", instructions: [{ verb: "PutSetAsideInPlay", name: "Iârion", to: "firstPlayer" }, { verb: "ShuffleEncounterDeck" }] },
    {
      id: "09073:whenRevealed:1",
      cardCode: "09073",
      lines: ["09073:B:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", code: BALEFUL_SHADE, to: "engaged", deckOnly: true }]), { verb: "ShuffleEncounterDeck" }, REVEAL_PER_PLAYER],
    },
    { id: "09073:forced:1", cardCode: "09073", lines: ["09073:B:2"], timing: "forced", trigger: "endOfPhase", condition: REFRESH_ENDS, instructions: [EACH_DISCARDS(1)] },
    { id: "09073:constant:1", cardCode: "09073", lines: ["09073:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "eliminatedAtEmptyDeck", amount: 1, until: "whileSourceInPlay", target: "table" }] },

    // 09074 A Fell Wraith (stage 2). When Revealed: Thaurdir is added to the staging area and 1 encounter card is revealed per player. Side B: after Thaurdir attacks and destroys a character, that character's controller chooses to discard the top 3 cards of his deck or to return Thaurdir to
    // the staging area (not offered when he is there); a player with no cards in his deck is eliminated; the players cannot defeat the stage while Thaurdir has hit points remaining, and winning it wins the game (the final stage).
    {
      id: "09074:whenRevealed:1",
      cardCode: "09074",
      lines: ["09074:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "EnterSetAsideStaging", code: THAURDIR },
        // "Then": the reveals resolve only when Thaurdir was added to the staging area (rr.then). Repeat takes no `when`, so the check is on each reveal; the difference is only a reveal that moves Thaurdir out of the staging area mid-way, which nothing in these encounter sets does.
        { verb: "Repeat", times: { players: true }, instructions: [{ verb: "RevealEncounter", when: { kind: "canPick", pick: { ...THAURDIR_PICK, stagingOnly: true } } }] },
      ],
    },
    {
      id: "09074:forced:1",
      cardCode: "09074",
      lines: ["09074:B:1"],
      timing: "forced",
      // The event is about the destroyed character (its controller is the event's seat); `other` is the attacking enemy.
      trigger: "characterDestroyedByAttack",
      subject: { type: "character", control: "any" },
      condition: { kind: "matches", card: "other", pick: THAURDIR_PICK },
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "discard", requires: { kind: "canPick", pick: { type: "card", control: "you", from: "deck" } }, instructions: [{ verb: "DiscardFromDeck", amount: 3 }] },
            { id: "return", requires: { kind: "not", condition: { kind: "canPick", pick: { ...THAURDIR_PICK, stagingOnly: true } } }, instructions: [{ verb: "ReturnToStaging", target: { kind: "other" } }] },
          ],
        },
      ],
    },
    { id: "09074:constant:1", cardCode: "09074", lines: ["09074:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "eliminatedAtEmptyDeck", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "09074:constant:2", cardCode: "09074", lines: ["09074:B:2"], timing: "constant", condition: { kind: "hitPointsLeft", code: THAURDIR }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "09074:questResolution:1", cardCode: "09074", lines: ["09074:B:2"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },

    // 10166 Deadmen's Dike (campaign card). Setup (after the quest card's): Iârion's Pendant is attached to Iârion and Protect the Innocent is added to the staging area with the damage the Campaign Log noted. Forced: after Thaurdir enters play one of the three burdens (set aside in
    // campaign mode) is picked at random and attached to him; it joins the Campaign Pool when the scenario is won (the Resolution, in the box's campaign file, angmar-awakened.ts).
    {
      id: "10166:campaignSetup:1",
      cardCode: "10166",
      lines: ["10166:A:2"],
      timing: "campaignSetup",
      instructions: [{ verb: "AttachNewTo", code: PENDANT, to: "Iârion" }, { verb: "AddToStaging", code: PROTECT_THE_INNOCENT }, { verb: "PlaceLoggedDamageOn", code: PROTECT_THE_INNOCENT }],
    },
    { id: "10166:forced:1", cardCode: "10166", lines: ["10166:A:3"], timing: "forced", trigger: "addedToStaging", subject: THAURDIR_PICK, instructions: [{ verb: "AttachRandomBurden", codes: BURDENS }] },

    // 100158 Arnor Ravaged (the other side of Protect the Innocent; in the pool from the Resolution of this scenario on). Setup: added to the staging area with the damage the Campaign Log noted. Forced: after an attack damages a character but does not destroy it, 1 damage moves from
    // it to that character (placed, not dealt; once for the attack, the first character damaged).
    { id: "100158:setup:1", cardCode: ARNOR_RAVAGED, lines: ["100158:A:1"], timing: "setup", instructions: [{ verb: "AddToStaging", code: ARNOR_RAVAGED }, { verb: "PlaceLoggedDamageOn", code: ARNOR_RAVAGED }] },
    {
      id: "100158:forced:1",
      cardCode: ARNOR_RAVAGED,
      lines: ["100158:A:2"],
      timing: "forced",
      trigger: "attackDamagedCharacter",
      subject: { type: "enemy", control: "any", staging: true },
      instructions: [{ verb: "MoveDamageTo", from: "self", to: "other", amount: 1 }],
    },

    // 10167 Amarthiúl's Courage (boon; Setup when it is in the pool at a later scenario). Attached character: +1 Willpower and +1 hit point. Action: ready attached hero (limit once per game).
    { id: "10167:setup:1", cardCode: "10167", lines: ["10167:A:1"], timing: "setup", instructions: [{ verb: "AttachSelfToNamed", name: "Amarthiúl" }] },
    {
      id: "10167:constant:1",
      cardCode: "10167",
      lines: ["10167:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "hitPoints", amount: 1, until: "whileSourceInPlay", target: "host" }],
    },
    { id: "10167:action:1", cardCode: "10167", lines: ["10167:A:3"], timing: "action", limit: "oncePerGame", instructions: [{ verb: "Ready", target: "host" }] },

    // 10168 Thaurdir's Legacy, 10169 Thaurdir's Majesty, 10170 Thaurdir's Spite (burdens). Setup (at a later scenario): attach to Thaurdir, even out of play, else removed from the game. Forced: after a Sorcery treachery is revealed (any reveal) it moves to the hero with the most
    // resources (Legacy), non-objective attachments (Majesty) or damage (Spite); the first player chooses among heroes that tie. It counts as a Sorcery attachment: Legacy gives -2 Willpower and blanks the hero's text box, Traits included; Majesty -2 Attack and no questing; Spite -2 Defense and no healing.
    { id: "10168:setup:1", cardCode: "10168", lines: ["10168:A:1"], timing: "setup", instructions: [{ verb: "AttachSelfToNamed", name: "Thaurdir", outOfPlay: true }] },
    copyLine("10168:A:1", "10169:A:1"),
    copyLine("10168:A:1", "10170:A:1"),
    ...BURDEN("10168", "resources", [{ verb: "ModifyStat", stat: "willpower", amount: -2, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "blanksTraits", amount: 1, until: "whileSourceInPlay", target: "host" }]),
    ...BURDEN("10169", "nonObjectiveAttachments", [{ verb: "ModifyStat", stat: "attack", amount: -2, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", target: "host" }]),
    ...BURDEN("10170", "damage", [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "whileSourceInPlay", target: "host" }]),
  ],
  { pool: [...DROWNED, ...SIEGE, ...WEATHER] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
