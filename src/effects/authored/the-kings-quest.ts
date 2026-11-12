import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as JOURNEY_ALONG_THE_ANDUIN } from "./journey-along-the-anduin.ts";
import { AUTHORED_EFFECTS as JOURNEY_UP_THE_ANDUIN } from "./journey-up-the-anduin.ts";
import { AUTHORED_EFFECTS as LOST_IN_MIRKWOOD } from "./lost-in-mirkwood.ts";
import { AUTHORED_EFFECTS as THE_DROWNED_RUINS } from "./the-drowned-ruins.ts";
import { AUTHORED_EFFECTS as THE_OATH } from "./the-oath.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The King's Quest (Ered Mithrin part 3, campaign card 12170): the encounter cards no template reads, the three quest stages, the Caves deck's locations and the campaign card. Isolde (12171) and the three burdens the campaign card places (12172 to 12174) are in pool/EMCE.ts.
// Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The piles place the cards set aside (Fire-drake, Dragon Hoard and the Dragon Might set) and the
// Caves deck (the Lost Caves set); stage 1A's Setup shuffles the deck. The campaign card's Setup is dealt by src/campaign/start.ts (the "dealt" and "afterSetup" verbs).
// Rules: emce.setup-the-kings-quest, emce.caves-deck, emce.deep, emce.guarded-x, emce.treasure, emce.haldan, emce.boon-allies, emce.campaign-pool-encounter, rr.then, rr.victory, rr.explored, rr.travel, rr.search (data/rules/entries.json).
const MY_CHARACTER = { type: "character", control: "you" } as const;
const QUESTING = { type: "character", control: "you", committed: true } as const;
const FIRE_DRAKE: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Fire-drake"] };
const STAGING_ENEMY = { type: "enemy", control: "any", stagingOnly: true } as const;
const NO_ACTIVE_LOCATION: Condition = { kind: "not", condition: { kind: "canPick", pick: { type: "location", control: "any", active: true } } };
const ACTIVE_IS_DARK: Condition = { kind: "canPick", pick: { type: "location", control: "any", active: true, trait: "Dark" } };
const PICKED_IS = (type: "location" | "treachery" | "enemy"): Condition => ({ kind: "matches", card: "picked", pick: { type, control: "any" }, inPlay: false });
// "the number of locations in the victory display"
const VICTORY_LOCATIONS = { count: { type: "location", control: "any", from: "victory" } } as const;
// "for each ... character": the characters that took part in the player attack the Forced effect answers.
const ATTACKERS = { count: { type: "character", control: "any", participating: true } } as const;
// Each player in turn order: the instructions with a question for them.
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// "Each player may ...": the player takes the first option when it can be done, or leaves.
type Simple = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"];
const MAY = (requires: Condition | undefined, instructions: Simple) => ({
  verb: "Choose" as const,
  who: "actor" as const,
  options: [{ id: "do", ...(requires ? { requires } : {}), instructions }, { id: "decline", instructions: [] }],
});
const CAVES_DECK_NOT_EMPTY: Condition = { kind: "cavesDeck" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 12170 The King's Quest (campaign card). Setup: hero changes cost no threat (WaiveThreatPenalty); Haldan may be a hero (the campaign briefing's ban does not hold in part 3: src/campaign/loadout.ts HERO_BANS); Isolde comes under the first player's control; The Threat to Wilderland enters the staging
    // area with X resources (X the part number); Dagnir's Spawn is shuffled into the encounter deck and Abandoned Ruin into the Caves deck; with Turayn's oath logged the first player searches the deck for 3 treacheries and removes them from the game.
    {
      id: "12170:campaignSetup:1",
      cardCode: "12170",
      lines: ["12170:A:2"],
      timing: "campaignSetup",
      instructions: [
        { verb: "WaiveThreatPenalty" },
        { verb: "PutObjectiveAllyIntoPlay", code: "12171" },
        { verb: "AddToStagingWithResources", code: "12172", amount: { part: true } },
        { verb: "ShuffleIntoEncounterDeck", code: "12173" },
        { verb: "ShuffleIntoPile", pile: "caves", code: "12174", placed: true },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "turayn", count: 3, cardType: "treachery" },
      ],
    },
    // Resolution: Isolde joins the pool or the log takes "Isolde is on the hunt"; each treasure the players control is discovered; Abandoned Ruin joins the pool, and the first player chooses Threat to Wilderland or Dagnir's Spawn for it.
    { id: "12170:resolution:1", cardCode: "12170", lines: ["12170:B:1"], timing: "resolution", instructions: [{ verb: "BoonAllyOrLogLine", ally: "12171", line: "isolde" }] },
    copyLine("12168:B:2", "12170:B:2"),
    { id: "12170:resolution:3", cardCode: "12170", lines: ["12170:B:3"], timing: "resolution", instructions: [{ verb: "Earn", codes: ["12174"] }, { verb: "ChooseCards", codes: ["12172", "12173"], who: "firstPlayer", to: "pool" }] },

    // 18042 Fire-drake: Threat and Defense X is one more than the number of players; after the active location is explored it returns to the staging area and attacks each player in turn order.
    { id: "18042:constant:2", cardCode: "18042", lines: ["18042:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true, plus: 1 }, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defense", amount: { players: true, plus: 1 }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "18042:forced:1",
      cardCode: "18042",
      lines: ["18042:A:3"],
      timing: "forced",
      trigger: "activeExplored",
      instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }, EACH_PLAYER([{ verb: "AttackFromStaging", target: "self" }])],
    },
    // 18043 Dragon Hoard (Immune is a keyword): Fire-drake cannot take damage; after it becomes the active location the first player chooses a player, who sets an Artifact attachment from their hand guarded by a location (Guarded (location)).
    { id: "18043:constant:1", cardCode: "18043", lines: ["18043:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: FIRE_DRAKE }] },
    {
      id: "18043:response:1",
      cardCode: "18043",
      lines: ["18043:A:3"],
      timing: "response",
      trigger: "becameActive",
      subject: "self",
      instructions: [
        { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } },
        { verb: "SwitchActor", to: "picked" },
        { verb: "Pick", pick: { type: "card", control: "you", from: "hand", cardType: "attachment", trait: "Artifact" } },
        { verb: "GuardPickedAttachment", types: ["location"] },
      ],
    },

    // 18044 Iron Hills Mine: Travel: each player discards the top 4 cards of their deck. As the active location, after it is explored each player may return a card from their discard pile to their hand.
    { id: "18044:travel:1", cardCode: "18044", lines: ["18044:A:2"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: 4 }])] },
    {
      id: "18044:response:1",
      cardCode: "18044",
      lines: ["18044:A:1"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      instructions: [EACH_PLAYER([MAY({ kind: "canPick", pick: { type: "card", control: "you", from: "discard" } }, [{ verb: "Pick", pick: { type: "card", control: "you", from: "discard" } }, { verb: "MovePicked", to: "hand" }])])],
    },
    // 18045 Contested Depths: +1 Threat for each location in the victory display; after the players travel here either every player raises their threat by that number or it is discarded and the top card of the Caves deck replaces it.
    { id: "18045:constant:1", cardCode: "18045", lines: ["18045:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: VICTORY_LOCATIONS, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "18045:forced:1",
      cardCode: "18045",
      lines: ["18045:A:2"],
      timing: "forced",
      trigger: "traveled",
      subject: "self",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: VICTORY_LOCATIONS, who: "eachSeat" }] },
            { id: "replace", requires: CAVES_DECK_NOT_EMPTY, instructions: [{ verb: "ReplaceFromCaves" }] },
          ],
        },
      ],
    },
    // 18046 Deep Chasm (Deep Chasm, Dark Tunnel, Forked Passage): the Deep keyword; the players travel to Deep Chasm when there is no active location.
    { id: "18046:constant:1", cardCode: "18046", lines: ["18046:A:1"], timing: "constant", instructions: [{ verb: "Deep" }] },
    copyLine("01088:A:1", "18046:A:2"),
    copyLine("18046:A:1", "18054:A:1"),
    copyLine("18046:A:1", "18055:A:1"),
    // 18047 Denizen of the Deep: the highest Attack enemy in the staging area makes an immediate attack against the first player; with none, it gains surge. The Shadow gives the attacker an additional attack.
    {
      id: "18047:whenRevealed:1",
      cardCode: "18047",
      lines: ["18047:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { ...STAGING_ENEMY, highestAttack: true, who: "firstPlayer" } },
        { verb: "AttackFromStaging", who: "firstPlayer", when: { kind: "canPick", pick: STAGING_ENEMY } },
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: STAGING_ENEMY } } },
      ],
    },
    copyLine("18035:A:2", "18047:A:2"),
    // 18048 Afraid of the Dark: attached to a questing hero, which leaves the quest; while the active location has the Dark trait the hero's Willpower is 0 and its text box is blank.
    {
      id: "18048:whenRevealed:1",
      cardCode: "18048",
      lines: ["18048:A:1"],
      timing: "whenRevealed",
      // Limit 1 per hero: a hero that carries one is not offered.
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", committed: true, who: "firstPlayer", hasAttachment: { names: ["Afraid of the Dark"], none: true } } }, { verb: "AttachSelfToPicked" }, { verb: "RemoveFromQuest" }],
    },
    { id: "18048:constant:1", cardCode: "18048", lines: ["18048:A:1"], timing: "constant", condition: ACTIVE_IS_DARK, instructions: [{ verb: "SetStat", stat: "willpower", value: 0, target: "host" }, { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host" }] },
    { id: "18048:constant:2", cardCode: "18048", lines: ["18048:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    // 18049 Stone-troll (Cannot have player card attachments is a template): after it attacks and destroys a character, its controller discards a card from hand for each point of excess damage. The Shadow discards an attachment.
    {
      id: "18049:forced:1",
      cardCode: "18049",
      lines: ["18049:A:2"],
      timing: "forced",
      trigger: "characterDestroyedByAttack",
      subject: { type: "character", control: "any" },
      eventSeat: "you",
      condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", names: ["Stone-troll"] } },
      instructions: [{ verb: "DiscardFromHand", amount: { excessOf: "subject" } }],
    },
    copyLine("12107:A:2", "18049:A:3"),
    // 18050 Hobgoblin: it gets +X Threat, Attack and Defense, X the cost of the card it guards; after it enters play the first player's top deck card lies under it, faceup; when it leaves play that card returns to its owner's hand (the Forced record is a marker: an enemy leaving play queues no event, so the settle sweep returns the card, families/wilderland/kings.ts returnHeld).
    {
      id: "18050:constant:1",
      cardCode: "18050",
      lines: ["18050:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: { guardedCost: true }, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attack", amount: { guardedCost: true }, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "defense", amount: { guardedCost: true }, until: "whileSourceInPlay", target: "self" },
      ],
    },
    { id: "18050:forced:1", cardCode: "18050", lines: ["18050:A:2"], timing: "forced", trigger: "encounterEnteredPlay", subject: "self", instructions: [{ verb: "GuardWithDeckTop" }] },
    { id: "18050:forced:2", cardCode: "18050", lines: ["18050:A:2"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "ReturnGuardedToHand" }] },
    // 18051 Werewolf: +1 Attack for each damage on it; dealt a shadow card with no effect it deals 1 damage to itself and to the defender. The Shadow deals 1 damage to the defender.
    { id: "18051:constant:1", cardCode: "18051", lines: ["18051:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "damage", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
    { id: "18051:forced:1", cardCode: "18051", lines: ["18051:A:2"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "DamageCard", amount: 1, target: "self" }, { verb: "DamageCard", amount: 1, target: "other" }] },
    { id: "18051:shadow:1", cardCode: "18051", lines: ["18051:A:3"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },
    // 18052 Giant Spider: a character it damages with an attack cannot ready until the end of the round; the Shadow gives the defender that.
    {
      id: "18052:forced:1",
      cardCode: "18052",
      lines: ["18052:A:1"],
      timing: "forced",
      trigger: "damagedByAttack",
      subject: { type: "character", control: "any" },
      condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", names: ["Giant Spider"] } },
      instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "subject" }],
    },
    { id: "18052:shadow:1", cardCode: "18052", lines: ["18052:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "doesNotReady", amount: 1, until: "endOfRound", target: "defender" }] },
    // 18053 Black Bats: while the active location has the Dark trait, it cannot take damage; the Shadow gives the attacker that for the phase.
    { id: "18053:constant:1", cardCode: "18053", lines: ["18053:A:2"], timing: "constant", condition: ACTIVE_IS_DARK, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "18053:shadow:1", cardCode: "18053", lines: ["18053:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfPhase", target: "attacker", when: ACTIVE_IS_DARK }] },
    // 18054 Dark Tunnel: in the staging area, progress cannot be placed on Dark locations there.
    {
      id: "18054:constant:2",
      cardCode: "18054",
      lines: ["18054:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, trait: "Dark" } }],
    },
    // 18055 Forked Passage: when the players travel here (before Deep), each player raises their threat by 2 to look at the top 2 cards of the Caves deck; one stays on top and the other goes to the bottom. Then it is added to the victory display; the Deep keyword still resolves afterwards (it is before resolving the keyword) and the top Caves card replaces it as the active location (emce.deep).
    {
      id: "18055:response:1",
      cardCode: "18055",
      lines: ["18055:A:2"],
      timing: "response",
      trigger: "traveled",
      subject: "self",
      condition: CAVES_DECK_NOT_EMPTY,
      instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }, { verb: "ArrangeCaves", count: 2 }, { verb: "MoveEncounterCard", card: "self", to: "victory" }],
    },
    // 18056 Dark Places: add the Threat of the active location to the staging area's total for the phase; with no active location, cards are discarded until a location is, and it is added to the staging area.
    {
      id: "18056:whenRevealed:1",
      cardCode: "18056",
      lines: ["18056:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Each", pick: { type: "location", control: "any", active: true }, instructions: [{ verb: "RaiseStagingThreat", amount: { stat: "threat", of: "picked" }, until: "endOfPhase" }] },
        { verb: "DiscardUntil", type: "location", when: NO_ACTIVE_LOCATION },
        { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS("location") },
      ],
    },
    // 18057 Eyes in the Dark: each player raises their threat by 1 for each questing character they control, or discards a questing character. The Shadow discards an ally if the attack is undefended.
    {
      id: "18057:whenRevealed:1",
      cardCode: "18057",
      lines: ["18057:A:2"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: QUESTING }, who: "actor" }] },
              { id: "discard", requires: { kind: "canPick", pick: QUESTING }, instructions: [{ verb: "Pick", pick: QUESTING }, { verb: "Discard", target: { kind: "picked" } }] },
            ],
          },
        ]),
      ],
    },
    copyLine("41025:A:3", "18057:A:3"),
    // 18058 Dragon Breath and 18059 Dragon Scales (Surge is a keyword): attached to a Dragon enemy as a Condition; Breath deals 1 damage to each character of the player the enemy attacks and is discarded, Scales cancels the damage the enemy would take and is discarded.
    { id: "18058:whenRevealed:1", cardCode: "18058", lines: ["18058:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "enemy", trait: "Dragon" } }] },
    { id: "18058:constant:1", cardCode: "18058", lines: ["18058:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    {
      id: "18058:forced:1",
      cardCode: "18058",
      lines: ["18058:A:2"],
      timing: "forced",
      trigger: "enemyAttacks",
      subject: "host",
      instructions: [{ verb: "Each", pick: MY_CHARACTER, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] }, { verb: "Discard", target: { kind: "self" } }],
    },
    { id: "18059:whenRevealed:1", cardCode: "18059", lines: ["18059:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "enemy", trait: "Dragon" } }] },
    { id: "18059:constant:1", cardCode: "18059", lines: ["18059:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    { id: "18059:constant:2", cardCode: "18059", lines: ["18059:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cancelsDamage", amount: 1, until: "whileSourceInPlay", target: "host" }] },

    // 18060 to 18065, the Caves deck. Each Response or Forced effect is heard after the location becomes the active location; "Limit once per game for the group" is oncePerGame.
    {
      id: "18060:response:1",
      cardCode: "18060",
      lines: ["18060:A:1"],
      timing: "response",
      trigger: "becameActive",
      subject: "self",
      limit: "oncePerGame",
      instructions: [
        EACH_PLAYER([
          MAY({ kind: "canPick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", traits: ["Weapon", "Armor"] } }, [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", traits: ["Weapon", "Armor"] } }, { verb: "MovePicked", to: "hand" }]),
          { verb: "ShuffleDeck" },
        ]),
      ],
    },
    {
      id: "18061:response:1",
      cardCode: "18061",
      lines: ["18061:A:1"],
      timing: "response",
      trigger: "becameActive",
      subject: "self",
      limit: "oncePerGame",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "threat", instructions: [{ verb: "LowerThreat", amount: 3, who: "actor" }] },
              { id: "draw", instructions: [{ verb: "Draw", amount: 2 }] },
              { id: "resource", requires: { kind: "canPick", pick: { type: "hero", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "AddResources", amount: 1, to: "picked" }] },
              { id: "decline", instructions: [] },
            ],
          },
        ]),
      ],
    },
    { id: "18062:forced:1", cardCode: "18062", lines: ["18062:A:1"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }] },
    {
      id: "18063:forced:1",
      cardCode: "18063",
      lines: ["18063:A:1"],
      timing: "forced",
      trigger: "stagingStepBegins",
      instructions: [{ verb: "DiscardUntil", type: "treachery" }, { verb: "ResolveWhenRevealed", when: PICKED_IS("treachery") }],
    },
    { id: "18064:forced:1", cardCode: "18064", lines: ["18064:A:1"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [EACH_PLAYER([{ verb: "AssignDamage", amount: { count: MY_CHARACTER }, pick: MY_CHARACTER }])] },
    copyLine("18023:A:1", "18065:A:1"),
    { id: "18065:forced:1", cardCode: "18065", lines: ["18065:A:2"], timing: "forced", trigger: "enteredPlay", subject: { type: "ally", control: "any" }, instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "subject" } }] },

    // 18078 The Iron Hills (stage 1). Setup: the Caves deck is built (shuffled), Fire-drake, Dragon Hoard and the Dragon Might set are dealt set aside by the piles, the encounter deck is shuffled, and each player discards until an enemy or location is discarded and adds it to the staging area.
    // Side B: at the beginning of the quest phase the first player adds the location discarded to the staging area or every player raises their threat by its printed Threat; the stage cannot be defeated without 3 locations with victory points in the victory display.
    {
      id: "18078:setup:1",
      cardCode: "18078",
      lines: ["18078:A:1"],
      timing: "setup",
      instructions: [{ verb: "ShufflePile", pile: "caves" }, { verb: "ShuffleEncounterDeck" }, EACH_PLAYER([{ verb: "DiscardUntil", types: ["enemy", "location"] }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }])],
    },
    {
      id: "18078:forced:1",
      cardCode: "18078",
      lines: ["18078:B:1"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Quest" },
      instructions: [
        { verb: "DiscardUntil", type: "location" },
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "add", requires: PICKED_IS("location"), instructions: [{ verb: "MoveEncounterCard", card: "picked", to: "staging" }] },
            { id: "threat", requires: PICKED_IS("location"), instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "picked", printed: true }, who: "eachSeat" }] },
          ],
        },
      ],
    },
    {
      id: "18078:constant:1",
      cardCode: "18078",
      lines: ["18078:B:2"],
      timing: "constant",
      condition: { kind: "less", left: { count: { type: "location", control: "any", from: "victory", noVictory: false } }, right: 3 },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
    // 18079 The Lower Depths (stage 2). Dragon Hoard goes to the bottom of the Caves deck, Fire-drake to the staging area and the Dragon Might set into the encounter deck. Side B: Fire-drake cannot leave the staging area or take damage;
    // after progress is placed here from questing successfully, 5 progress may be removed to look at the Caves deck's top 2 cards; after Dragon Hoard becomes the active location the quest advances to stage 3.
    {
      id: "18079:whenRevealed:1",
      cardCode: "18079",
      lines: ["18079:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "PutOnPileBottom", pile: "caves", code: "18043" }, { verb: "AddSetAsideToStaging", code: "18042" }, { verb: "ShuffleSetAsideSet", set: "Dragon Might" }, { verb: "ShuffleEncounterDeck" }],
    },
    {
      id: "18079:constant:1",
      cardCode: "18079",
      lines: ["18079:B:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: FIRE_DRAKE },
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: FIRE_DRAKE },
      ],
    },
    {
      id: "18079:response:1",
      cardCode: "18079",
      lines: ["18079:B:2"],
      timing: "response",
      trigger: "progressPlaced",
      subject: "self",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "questSucceeded" }, { kind: "stageProgress", min: 5 }, CAVES_DECK_NOT_EMPTY] },
      instructions: [{ verb: "RemoveProgressFromQuest", amount: 5 }, { verb: "ArrangeCaves", count: 2 }],
    },
    { id: "18079:triggered:1", cardCode: "18079", lines: ["18079:B:3"], timing: "triggered", trigger: "becameActive", subject: { type: "location", control: "any", names: ["Dragon Hoard"] }, instructions: [{ verb: "AdvanceStage" }] },
    // 18080 The Fire Worm (stage 3). A Dragon treachery is searched for and attached to Fire-drake. Side B: the Deep keyword is ignored; when a player declares X attackers against Fire-drake they remove X progress from the quest or the attack is canceled;
    // the stage cannot be defeated while Fire-drake is in play, and defeating Fire-drake wins the game.
    { id: "18080:whenRevealed:1", cardCode: "18080", lines: ["18080:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSearched", type: "treachery", trait: "Dragon", to: "Fire-drake" }, { verb: "ShuffleEncounterDeck" }] },
    { id: "18080:constant:1", cardCode: "18080", lines: ["18080:B:1"], timing: "constant", instructions: [{ verb: "IgnoreKeyword", keywords: ["deep"] }] },
    {
      id: "18080:forced:1",
      cardCode: "18080",
      lines: ["18080:B:2"],
      timing: "forced",
      trigger: "enemyAttacked",
      subject: { type: "enemy", control: "any", names: ["Fire-drake"] },
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "remove", requires: { kind: "not", condition: { kind: "less", left: { stat: "progress", of: "self" }, right: ATTACKERS } }, instructions: [{ verb: "RemoveProgressFromQuest", amount: ATTACKERS }] },
            { id: "cancel", instructions: [{ verb: "CancelStrike" }] },
          ],
        },
      ],
    },
    { id: "18080:constant:2", cardCode: "18080", lines: ["18080:B:3"], timing: "constant", condition: { kind: "canPick", pick: FIRE_DRAKE }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "18080:triggered:1", cardCode: "18080", lines: ["18080:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", staging: true, names: ["Fire-drake"] }, instructions: [{ verb: "WinGame" }] },
  ],
  { pool: [...JOURNEY_ALONG_THE_ANDUIN, ...JOURNEY_UP_THE_ANDUIN, ...LOST_IN_MIRKWOOD, ...THE_DROWNED_RUINS, ...THE_OATH] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
