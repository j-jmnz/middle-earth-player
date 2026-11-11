import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as FIRE_IN_THE_NIGHT } from "./fire-in-the-night.ts";
import { AUTHORED_EFFECTS as FLIGHT_TO_THE_FORD } from "./flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as HELMS_DEEP } from "./helms-deep.ts";
import { AUTHORED_EFFECTS as ROAM } from "./roam-across-rhovanion.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Passage of the Marshes (the-two-towers part 4, campaign card 144067, whose records are in the-two-towers.ts): the Mire keyword (the mire family), Gollum and Sméagol (the gollum family), the Undead enemies, the
// quest stages and the encounter cards no template reads. Every line is read from the scan ledger (data/printed/the-two-towers.json); a line a template already writes (pnpm data:build) or another card prints word for word needs no
// record here. See docs/brief.md, The Two Towers, for each reading.
// Rules: mec112.mire, mec112.gollum-smeagol, mec112.poisoned-counsels-searching-eye, mec112.saga-staging-rules, rr.forced, rr.travel, rr.cannot, rr.first-player, rr.defending-player, rr.effects, rr.search, rr.reveal, rr.victory, rr.attachment-cards (data/rules/entries.json).
const GOLLUM = "144075";
const SMEAGOL = "144076";
const ONE_RING = "144063";
const DEAD_THINGS = "144017";
const GROPING_DEAD = "144016";
// "Mire X": the keyword is the flag `mire` holding X (the printed keyword is not read), set by a constant record of the location.
const MIRE = (amount: number): Instruction => ({ verb: "ModifyStat", stat: "mire", amount, until: "whileSourceInPlay", target: "self" });
const WHEN_MIRED = { trigger: "discardedByMire", subject: "self" } as const;
const THIS_ENEMY: PickSpec = { type: "enemy", control: "any", isSource: true };
const A_CHARACTER: PickSpec = { type: "character", control: "any" };
// "After ~ destroys a character": the character's destruction by the attack names the attacking enemy as the other card, and `isSource` keeps it to the copy that attacked.
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: A_CHARACTER, condition: { kind: "matches", card: "other", pick: THIS_ENEMY } } as const satisfies Partial<Effect>;
const STAGING_LOCATIONS: PickSpec = { type: "location", control: "any", stagingOnly: true };
const VICTORY_LOCATIONS: PickSpec = { type: "location", control: "any", from: "victory" };
const UNDEAD_ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you", trait: "Undead" };
const COMMITTED_OF_YOURS: PickSpec = { type: "character", control: "you", committed: true };
const COMMITTED_OF_ANY: PickSpec = { type: "character", control: "any", committed: true };
type Cond = NonNullable<Effect["condition"]>;
const FEWER_LOCATIONS_THAN_PLAYERS: Cond = { kind: "less", left: { count: STAGING_LOCATIONS }, right: { players: true } };
const FIRST_PLAYER_LACKS_SMEAGOL: Cond = { kind: "not", condition: { kind: "controls", code: SMEAGOL } };
// Shelob's Lair stage 3B (144072:B:1) adds a defeated Gollum to the victory display "Do not flip him over": the flip of 144075:A:3 holds while that stage is not the current quest card.
const NOT_BETRAYAL: Cond = { kind: "inPlay", code: "144072", is: false };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const ENGAGED_UNDEAD_ANY: Cond = { kind: "any", conditions: [{ kind: "canPick", pick: UNDEAD_ENGAGED_WITH_YOU }, { kind: "canPick", pick: { ...UNDEAD_ENGAGED_WITH_YOU, engaged: "other" } }] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 144015 The Searching Eye (a burden: it functions like a player card, as Poisoned Counsels does). Forced: after the player draws it (the kept opening hand included) they choose to exhaust each hero they control, an option only
    // while one is ready (rr.effects: an option that changes nothing cannot be chosen), or to reveal the top card of the encounter deck.
    copyLine("143021:A:1", "144015:A:1"),
    {
      id: "144015:forced:1",
      cardCode: "144015",
      lines: ["144015:A:2"],
      timing: "forced",
      trigger: "enteredHand",
      subject: "self",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "exhaust", requires: { kind: "canPick", pick: { type: "hero", control: "you", state: "ready" } }, instructions: [{ verb: "ExhaustEach", pick: { type: "hero", control: "you" } }] },
            { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
          ],
        },
      ],
    },

    // 144016 Groping Dead, 144017 Dead Things, 144018 Candle-bearer (Undead). While engaged, the player's threat cannot be reduced by any effect. Groping Dead puts a mire token on the active location after it destroys a character (its Shadow,
    // when the attack does); Dead Things raises the defending player's threat by 3 (its Shadow by 1 for each Undead enemy engaged with the player); Candle-bearer cannot take damage until the end of the round (its Shadow, the attacking enemy).
    {
      id: "144016:constant:1",
      cardCode: "144016",
      lines: ["144016:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "engaged" },
      instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", target: "engagedSeat" }],
    },
    copyLine("144016:A:1", "144017:A:1"),
    copyLine("144016:A:1", "144018:A:1"),
    { id: "144016:forced:1", cardCode: GROPING_DEAD, lines: ["144016:A:2"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "PlaceMireToken", on: "activeLocation", amount: 1 }] },
    {
      id: "144016:shadow:1",
      cardCode: GROPING_DEAD,
      lines: ["144016:A:3"],
      timing: "shadow",
      instructions: [{ verb: "AfterAttack", instructions: [{ verb: "PlaceMireToken", on: "activeLocation", amount: 1, when: { kind: "x", min: 1 } }] }],
    },
    { id: "144017:forced:1", cardCode: DEAD_THINGS, lines: ["144017:A:2"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "RaiseThreat", amount: 3, who: "defendingPlayer" }] },
    { id: "144017:shadow:1", cardCode: DEAD_THINGS, lines: ["144017:A:3"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { count: UNDEAD_ENGAGED_WITH_YOU }, who: "actor" }] },
    { id: "144018:forced:1", cardCode: "144018", lines: ["144018:A:2"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "self" }] },
    { id: "144018:shadow:1", cardCode: "144018", lines: ["144018:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "attacker" }] },

    // 144019 Evil-smelling Fens (Mire 3): discarded by Mire it deals 1 damage to each character in play, Sméagol included. Travel: each player raises their threat by 1. Shadow: 1 damage to the defending character (a copy of 141082:A:3).
    { id: "144019:constant:1", cardCode: "144019", lines: ["144019:A:1"], timing: "constant", instructions: [MIRE(3)] },
    { id: "144019:forced:1", cardCode: "144019", lines: ["144019:A:1"], timing: "forced", ...WHEN_MIRED, instructions: [{ verb: "DamageEach", amount: 1, pick: A_CHARACTER }] },
    { id: "144019:travel:1", cardCode: "144019", lines: ["144019:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
    copyLine("141082:A:3", "144019:A:3"),

    // 144020 Shifting Quagmire (Surge, Mire 1): discarded by Mire the first player chooses to return a random location of the victory display to the staging area, or to raise each player's threat by 1 for each location in the display;
    // with no location there neither can be chosen. Travel: spend 1 Fellowship resource, from any hero of the players.
    { id: "144020:constant:1", cardCode: "144020", lines: ["144020:A:2"], timing: "constant", instructions: [MIRE(1)] },
    {
      id: "144020:forced:1",
      cardCode: "144020",
      lines: ["144020:A:2"],
      timing: "forced",
      ...WHEN_MIRED,
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "return", requires: { kind: "count", pick: VICTORY_LOCATIONS, min: 1 }, instructions: [{ verb: "ReturnRandomVictoryLocation" }] },
            { id: "threat", requires: { kind: "count", pick: VICTORY_LOCATIONS, min: 1 }, instructions: [{ verb: "RaiseThreat", amount: { count: VICTORY_LOCATIONS }, who: "eachSeat" }] },
          ],
        },
      ],
    },
    { id: "144020:travel:1", cardCode: "144020", lines: ["144020:A:3"], timing: "travel", instructions: [{ verb: "SpendResources", amount: 1, sphere: "fellowship", group: true }] },

    // 144021 Haunted Mere (Mire 2): discarded by Mire the first player searches the encounter deck and discard pile for an Undead enemy and adds it to the staging area (no When Revealed: showing it is not staging it), then the deck is shuffled.
    { id: "144021:constant:1", cardCode: "144021", lines: ["144021:A:1"], timing: "constant", instructions: [MIRE(2)] },
    {
      id: "144021:forced:1",
      cardCode: "144021",
      lines: ["144021:A:1"],
      timing: "forced",
      ...WHEN_MIRED,
      instructions: [{ verb: "SearchMove", trait: "Undead", type: "enemy", to: "staging" }, { verb: "ShuffleEncounterDeck" }],
    },

    // 144022 Stagnant Pools (Mire 5): discarded by Mire each player raises their threat by 5. It gets +1 Threat for each mire token on it, read live while it is in the staging area.
    { id: "144022:constant:1", cardCode: "144022", lines: ["144022:A:1"], timing: "constant", instructions: [MIRE(5)] },
    { id: "144022:forced:1", cardCode: "144022", lines: ["144022:A:1"], timing: "forced", ...WHEN_MIRED, instructions: [{ verb: "RaiseThreat", amount: 5, who: "eachSeat" }] },
    { id: "144022:constant:2", cardCode: "144022", lines: ["144022:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay" }] },

    // 144023 Soft Mires (Mire 1): discarded by Mire the first player reveals the top card of the encounter deck. Travel: each player raises their threat by 1.
    { id: "144023:constant:1", cardCode: "144023", lines: ["144023:A:1"], timing: "constant", instructions: [MIRE(1)] },
    { id: "144023:forced:1", cardCode: "144023", lines: ["144023:A:1"], timing: "forced", ...WHEN_MIRED, instructions: [{ verb: "RevealEncounter", who: "firstPlayer" }] },
    copyLine("144019:A:2", "144023:A:2"),

    // 144024 Creeping Marshes (Surge, Doomed 1). When Revealed it attaches to the current quest as a Condition. Its Forced effect: at the end of the refresh phase, after the keyword's own placement, 1 mire token on each location in the staging
    // area (a location without Mire keeps it, which does nothing but add to Stagnant Pools), then it is discarded.
    { id: "144024:whenRevealed:1", cardCode: "144024", lines: ["144024:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToQuest" }] },
    { id: "144024:constant:1", cardCode: "144024", lines: ["144024:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    {
      id: "144024:forced:1",
      cardCode: "144024",
      lines: ["144024:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Refresh" },
      instructions: [{ verb: "Each", pick: STAGING_LOCATIONS, instructions: [{ verb: "PlaceMireToken", on: "picked", amount: 1 }] }, { verb: "Discard", target: { kind: "self" } }],
    },

    // 144025 Bitter Reek (Peril). When Revealed: the revealing player chooses to raise their threat by 1 for each character they control committed to the quest, or to deal 1 damage to each character committed to the quest (any player's); each option
    // needs a committed character to change anything. Shadow: raise the defending player's threat by the attacking enemy's Threat.
    {
      id: "144025:whenRevealed:1",
      cardCode: "144025",
      lines: ["144025:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "threat", requires: { kind: "count", pick: COMMITTED_OF_YOURS, min: 1 }, instructions: [{ verb: "RaiseThreat", amount: { count: COMMITTED_OF_YOURS }, who: "actor" }] },
            { id: "damage", requires: { kind: "count", pick: COMMITTED_OF_ANY, min: 1 }, instructions: [{ verb: "DamageEach", amount: 1, pick: COMMITTED_OF_ANY }] },
          ],
        },
      ],
    },
    { id: "144025:shadow:1", cardCode: "144025", lines: ["144025:A:3"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "attacker" }, who: "actor" }] },

    // 144026 A Fell Light (Peril). When Revealed: the topmost Undead enemy of the encounter discard pile is put into play engaged with the revealing player, then each Undead enemy engaged with that player makes an immediate attack (also
    // when no card was put into play). Shadow: the topmost Undead enemy of the discard pile returns to the staging area.
    {
      id: "144026:whenRevealed:1",
      cardCode: "144026",
      lines: ["144026:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "PickDiscardTop", types: ["enemy"], trait: "Undead" }, { verb: "MoveEncounterCard", card: "picked", to: "engaged" }, { verb: "ImmediateAttackEach", trait: "Undead", own: true }],
    },
    { id: "144026:shadow:1", cardCode: "144026", lines: ["144026:A:3"], timing: "shadow", instructions: [{ verb: "PickDiscardTop", types: ["enemy"], trait: "Undead" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },

    // 144053 Morgul Wraith (A:1 is a template). While The One Ring is exhausted it gets -30 engagement cost and is immune to player card effects.
    {
      id: "144053:constant:2",
      cardCode: "144053",
      lines: ["144053:A:2"],
      timing: "constant",
      condition: { kind: "exhausted", code: ONE_RING, is: true },
      instructions: [
        { verb: "ModifyStat", stat: "engagementCost", amount: -30, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "self" },
      ],
    },

    // 144054 Call of the Ring. When Revealed: the first player chooses to search the encounter deck and discard pile for a Nazgûl enemy and add it to the staging area (no Nazgûl has Victory in this scenario, so the victory display holds none
    // to search), an option only while one is there; or to exhaust The One Ring and reveal the top card of the encounter deck. Shadow: the attacking enemy makes an additional attack (a copy of 19081:A:2).
    {
      id: "144054:whenRevealed:1",
      cardCode: "144054",
      lines: ["144054:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "search", requires: { kind: "searchable", trait: "Nazgûl" }, instructions: [{ verb: "SearchMove", trait: "Nazgûl", type: "enemy", to: "staging" }] },
            { id: "reveal", instructions: [{ verb: "Exhaust", target: { kind: "byCode", code: ONE_RING } }, { verb: "RevealEncounter" }] },
          ],
        },
      ],
    },
    copyLine("19081:A:2", "144054:A:2"),

    // 144055 We Hates Them! (Surge). When Revealed: the first player chooses to flip Sméagol to Gollum (while he is in play), to have Gollum make an immediate attack (while he is), or to cancel the whole effect by spending 1 Fellowship resource
    // and exhausting The One Ring (an option only while there is an effect to cancel and the cost can be paid). Shadow: +1 Attack, +3 instead against Gollum's own attack.
    {
      id: "144055:whenRevealed:1",
      cardCode: "144055",
      lines: ["144055:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "flip", requires: { kind: "inPlay", code: SMEAGOL, is: true }, instructions: [{ verb: "FlipGollum", to: "gollum" }] },
            { id: "attack", requires: { kind: "inPlay", code: GOLLUM, is: true }, instructions: [{ verb: "GollumAttacks" }] },
            {
              id: "cancel",
              requires: {
                kind: "all",
                conditions: [
                  { kind: "count", pick: { type: "card", control: "any", names: ["Gollum", "Sméagol"], engagedEnemies: true }, min: 1 },
                  { kind: "resources", min: 1, sphere: "fellowship" },
                  { kind: "exhausted", code: ONE_RING, is: false },
                ],
              },
              instructions: [{ verb: "SpendResources", amount: 1, sphere: "fellowship" }, { verb: "Exhaust", target: { kind: "byCode", code: ONE_RING } }, { verb: "CancelEffect" }],
            },
          ],
        },
      ],
    },
    {
      id: "144055:shadow:1",
      cardCode: "144055",
      lines: ["144055:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", names: ["Gollum"] } } } },
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", names: ["Gollum"] } } },
      ],
    },

    // 144064 The Taming of Sméagol (stage 1). Setup: Gollum (set aside) comes into play engaged with the first player; each player in order searches the encounter deck for 1 location and adds it to the staging area; the deck is shuffled.
    // The players cannot advance unless the first player controls Sméagol. Forced: after a player declares attackers against Gollum the top card of the encounter deck is discarded and Gollum gets +X Defense for this attack, X its Threat.
    {
      id: "144064:setup:1",
      cardCode: "144064",
      lines: ["144064:A:1"],
      timing: "setup",
      instructions: [{ verb: "EngageSetAside", code: GOLLUM }, EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging" }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "144064:constant:1", cardCode: "144064", lines: ["144064:B:1"], timing: "constant", condition: FIRST_PLAYER_LACKS_SMEAGOL, instructions: [{ verb: "Restrict", what: "advance" }] },
    {
      id: "144064:forced:1",
      cardCode: "144064",
      lines: ["144064:B:2"],
      timing: "forced",
      trigger: "enemyAttacked",
      subject: { type: "enemy", control: "any", names: ["Gollum"] },
      instructions: [
        { verb: "MoveEncounterCard", card: "deckTop", to: "discard" },
        { verb: "ModifyStat", stat: "defense", amount: { stat: "threat", of: "picked" }, until: "endOfAttack", target: "subject" },
      ],
    },

    // 144065 Across the Marshes (stage 2). When Revealed: with fewer locations in the staging area than players, cards are discarded from the encounter deck until a location is, and it is added to the staging area. Progress cannot be placed on
    // locations in the staging area (a copy of 19047:B:1). The players cannot advance unless the first player controls Sméagol and 4 locations are in the victory display. Forced: at the end of the staging step, with fewer locations in the
    // staging area than players, the first player reveals one encounter card.
    {
      id: "144065:whenRevealed:1",
      cardCode: "144065",
      lines: ["144065:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "DiscardUntil", type: "location", when: FEWER_LOCATIONS_THAN_PLAYERS }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: FEWER_LOCATIONS_THAN_PLAYERS }],
    },
    copyLine("19047:B:1", "144065:B:1"),
    { id: "144065:constant:2", cardCode: "144065", lines: ["144065:B:2"], timing: "constant", condition: FIRST_PLAYER_LACKS_SMEAGOL, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "144065:constant:3", cardCode: "144065", lines: ["144065:B:2"], timing: "constant", condition: { kind: "count", pick: VICTORY_LOCATIONS, max: 3 }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "144065:forced:1", cardCode: "144065", lines: ["144065:B:3"], timing: "forced", trigger: "stagingStepEnds", condition: FEWER_LOCATIONS_THAN_PLAYERS, instructions: [{ verb: "RevealEncounter", who: "firstPlayer" }] },

    // 144066 Don't Look at the Lights! (stage 3). When Revealed: each player in order searches the encounter deck and discard pile for an Undead enemy and puts it into play engaged with them; then every location of the victory display is shuffled
    // into the encounter deck. While any player is engaged with an Undead enemy no progress can be placed on this stage (the active location still takes its share). The players cannot defeat this stage unless the first player controls Sméagol.
    {
      id: "144066:whenRevealed:1",
      cardCode: "144066",
      lines: ["144066:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: "Undead", type: "enemy", to: "engaged" }]), { verb: "ShuffleVictoryIntoEncounterDeck" }],
    },
    {
      id: "144066:constant:1",
      cardCode: "144066",
      lines: ["144066:B:1"],
      timing: "constant",
      condition: ENGAGED_UNDEAD_ANY,
      instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }],
    },
    { id: "144066:constant:2", cardCode: "144066", lines: ["144066:B:2"], timing: "constant", condition: FIRST_PLAYER_LACKS_SMEAGOL, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 144075 Gollum (the enemy side of the one card Gollum / Sméagol). Immune to the effects of non-Fellowship player cards. He always engages the first player: when the token passes he moves to the new first player, and (Forced) during the refresh
    // phase that move makes him attack at once. Forced: when he is defeated he flips to Sméagol, damage discarded, exhausted, controlled by the first player (he leaves for neither the discard pile nor the victory display), except on Shelob's Lair stage 3 (144072:B:1).
    { id: "144075:constant:1", cardCode: GOLLUM, lines: ["144075:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToNonFellowship", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "144075:triggered:1", cardCode: GOLLUM, lines: ["144075:A:1"], timing: "triggered", trigger: "firstPlayerTokenPassed", instructions: [{ verb: "FollowFirstPlayer" }] },
    { id: "144075:forced:1", cardCode: GOLLUM, lines: ["144075:A:2"], timing: "forced", trigger: "engaged", subject: "self", condition: { kind: "phase", is: "Refresh" }, instructions: [{ verb: "ImmediateAttack" }] },
    { id: "144075:forced:2", cardCode: GOLLUM, lines: ["144075:A:3"], timing: "forced", trigger: "enemyDestroyed", subject: "self", condition: NOT_BETRAYAL, instructions: [{ verb: "FlipGollum", to: "smeagol" }] },

    // 144076 Sméagol (the objective-ally side). Immune to player card effects; the first player controls him. Forced: after the players quest unsuccessfully he flips to Gollum, damage discarded, ready, engaged with the first player. If he is
    // destroyed the players lose the game (a flip is not destruction).
    { id: "144076:constant:1", cardCode: SMEAGOL, lines: ["144076:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "144076:constant:2", cardCode: SMEAGOL, lines: ["144076:A:1"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self" }] },
    { id: "144076:forced:1", cardCode: SMEAGOL, lines: ["144076:A:2"], timing: "forced", trigger: "questFailed", instructions: [{ verb: "FlipGollum", to: "gollum" }] },
    { id: "144076:triggered:1", cardCode: SMEAGOL, lines: ["144076:A:3"], timing: "triggered", trigger: "characterDestroyed", subject: "self", instructions: [{ verb: "LoseGame", reason: "Sméagol was destroyed" }] },
  ],
  { pool: [...FIRE_IN_THE_NIGHT, ...FLIGHT_TO_THE_FORD, ...HELMS_DEEP, ...ROAM] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
