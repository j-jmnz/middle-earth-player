import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as JOURNEY_UP_THE_ANDUIN } from "./journey-up-the-anduin.ts";
import { AUTHORED_EFFECTS as THE_WITHERED_HEATH } from "./the-withered-heath.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for Fire in the Night (Ered Mithrin part 6, campaign card 12187): Hrogar's Hill, the eight encounter side quests, Dagnir, the encounter cards no template reads, Beldis and the campaign card.
// Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The piles place Dagnir in the staging area and the side quests in the side quest deck
// (`sideQuestDeck`, a pile of its own: families/wilderland/night.ts); the quest card's Setup shuffles it. A side quest is a quest card and an encounter card: it is revealed into the staging area, cannot have its When Revealed canceled, may be the current quest and is added to the victory display when it
// is defeated (emce.side-quests, emce.side-quests-in-play). The campaign card's Setup is dealt by src/campaign/start.ts and src/campaign/checklist.ts.
// Rules: emce.setup-fire-in-the-night, emce.side-quests, emce.side-quests-in-play, emce.boon-allies, emce.treasure, emce.campaign-log, emce.immune, rr.attacks-outside-the-combat-phase, rr.damage, rr.first-player (data/rules/entries.json).
const DAGNIR_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Dagnir"] };
// Dagnir wherever he is in play: the holder of a lasting effect a side quest or a location gives him.
const DAGNIR: PickSpec = { type: "card", control: "any", names: ["Dagnir"], engagedEnemies: true };
// "the side quests in the victory display" and X, "1 more than" their number (19074, 19079, 19082): encounter and player side quests alike (emce.side-quests).
const SIDE_QUESTS_IN_VICTORY: PickSpec = { type: "card", control: "any", from: "victory", sideQuest: true };
const X = { count: SIDE_QUESTS_IN_VICTORY, plus: 1 };
// "While at least 3 side quests are in the victory display": 2 is less than their number.
const THREE_SIDE_QUESTS: Condition = { kind: "less", left: 2, right: { count: SIDE_QUESTS_IN_VICTORY } };
// "a hero he controls": the first player's, chosen by them (19078:A:2), or, inside the first player's own Choose, any hero of the player asked (19076:A:1).
const FIRST_PLAYERS_HERO: PickSpec = { type: "hero", control: "you", who: "firstPlayer" };
const HERO_YOU: PickSpec = { type: "hero", control: "you" };
const ANY_CHARACTER = { type: "character", control: "any" } as const;
// Each player in turn order: the instructions with a question for them.
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// "Each other player reveals an encounter card." (19083:A:1)
const EACH_OTHER_REVEALS = EACH_PLAYER([{ verb: "RevealEncounter", when: { kind: "not", condition: { kind: "firstPlayer" } } }]);
// "Dagnir makes an immediate attack against the first player" (19066:A:2, 19077:A:2, 19081:A:1): Dagnir stays in the staging area, and is dealt a shadow card of his own.
const DAGNIR_ATTACKS_FIRST_PLAYER: Instruction[] = [{ verb: "Pick", pick: DAGNIR_ENEMY }, { verb: "AttackFromStaging", who: "firstPlayer" }];
const DAMAGE_THE_HILL = (amount: Extract<Instruction, { verb: "DamageCard" }>["amount"]): Extract<Instruction, { verb: "DamageCard" }> => ({ verb: "DamageCard", amount, target: "questStage" });
// "If this attack destroys a character": the attack's X is the characters it destroyed (19075:A:2).
const WHEN_DAMAGE_X: Condition = { kind: "x", min: 1 };
// The Forced effect "At the end of the quest phase".
const END_OF_QUEST_PHASE = { trigger: "endOfPhase", condition: { kind: "phase", is: "Quest" } } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 12187 Fire in the Night (campaign card). Setup: the first player gains control of Beldis; with Turayn's oath logged the first player removes 3 non-unique locations from the encounter deck, with Isolde's line 3 non-unique enemies. Side A also says to ignore the Deep keyword
    // (a Caves card of the pool may be shuffled into the encounter deck). Resolution: Beldis joins the pool or the log takes "Beldis's care has bolstered the heroes' spirits"; with at least 5 progress on Hrogar's Hill the players look at 3 random undiscovered treasures and choose 1;
    // the players discover each treasure they control; each player may remove a non-burden card from the campaign pool.
    {
      id: "12187:campaignSetup:1",
      cardCode: "12187",
      lines: ["12187:A:2"],
      timing: "campaignSetup",
      instructions: [
        { verb: "PutObjectiveAllyIntoPlay", code: "12188" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "turayn", count: 3, cardType: "location", nonUnique: true },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "isolde", count: 3, cardType: "enemy", nonUnique: true },
      ],
    },
    { id: "12187:constant:1", cardCode: "12187", lines: ["12187:A:3"], timing: "constant", instructions: [{ verb: "IgnoreKeyword", keywords: ["deep"] }] },
    { id: "12187:resolution:1", cardCode: "12187", lines: ["12187:B:1"], timing: "resolution", instructions: [{ verb: "BoonAllyOrLogLine", ally: "12188", line: "beldis" }] },
    { id: "12187:resolution:2", cardCode: "12187", lines: ["12187:B:2"], timing: "resolution", instructions: [{ verb: "ChooseRandomTreasure", count: 3, when: { kind: "stageProgress", min: 5 } }] },
    copyLine("120165:B:2", "12187:B:3"),
    { id: "12187:resolution:4", cardCode: "12187", lines: ["12187:B:4"], timing: "resolution", instructions: [{ verb: "RemoveFromPool", choice: "eachPlayerNonBurden" }] },

    // 12188 Beldis (boon ally). Action: any player spends 1 resource and marks a use beside Beldis in the campaign log (4 boxes for each player) to heal 3 damage from a character.
    {
      id: "12188:action:1",
      cardCode: "12188",
      lines: ["12188:A:1"],
      timing: "action",
      anyPlayer: true,
      cost: { kind: "resources", amount: 1 },
      condition: { kind: "beldisBox" },
      instructions: [{ verb: "MarkBeldisUse" }, { verb: "Pick", pick: ANY_CHARACTER }, { verb: "Heal", amount: 3, target: "picked" }],
    },

    // 19066 Draw Her Fire (side quest, 5 quest points). The shadow cards dealt to Dagnir are immune to player card effects and cannot be canceled. After it becomes the current quest Dagnir makes an immediate attack against the first player.
    { id: "19066:constant:1", cardCode: "19066", lines: ["19066:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "shadowsImmune", amount: 1, until: "whileSourceInPlay", holders: DAGNIR }] },
    { id: "19066:forced:1", cardCode: "19066", lines: ["19066:A:2"], timing: "forced", trigger: "becameCurrentQuest", instructions: DAGNIR_ATTACKS_FIRST_PLAYER },
    // 19067 Fortify the Defense (side quest, 10). Characters do not count their Defense when defending against Dagnir. Defeated: each player chooses to draw 3 cards or to give each hero he controls 1 resource.
    { id: "19067:constant:1", cardCode: "19067", lines: ["19067:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "defenseIgnored", amount: 1, until: "whileSourceInPlay", holders: DAGNIR }] },
    {
      id: "19067:response:1",
      cardCode: "19067",
      lines: ["19067:A:2"],
      timing: "response",
      trigger: "questDefeated",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "draw", instructions: [{ verb: "Draw", amount: 3 }] },
              { id: "resources", instructions: [{ verb: "HeroesGainResources", amount: 1 }] },
            ],
          },
        ]),
      ],
    },
    // 19068 Rally the Woodmen (side quest, 10). Allies cannot be declared as attackers against Dagnir. Defeated: each player searches the top 5 cards of his deck for an ally, puts it into play and shuffles his deck.
    { id: "19068:constant:1", cardCode: "19068", lines: ["19068:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "alliesCannotAttack", amount: 1, until: "whileSourceInPlay", holders: DAGNIR }] },
    {
      id: "19068:response:1",
      cardCode: "19068",
      lines: ["19068:A:2"],
      timing: "response",
      trigger: "questDefeated",
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 5, cardType: "ally" } }, { verb: "PutIntoPlay", card: "picked", who: "actor" }, { verb: "ShuffleDeck" }])],
    },
    // 19069 Douse the Flames (side quest, 10). At the end of the quest phase 5 damage are dealt to Hrogar's Hill. Defeated: 10 damage are removed from Hrogar's Hill.
    { id: "19069:forced:1", cardCode: "19069", lines: ["19069:A:1"], timing: "forced", ...END_OF_QUEST_PHASE, instructions: [DAMAGE_THE_HILL(5)] },
    { id: "19069:response:1", cardCode: "19069", lines: ["19069:A:2"], timing: "response", trigger: "questDefeated", instructions: [{ verb: "Heal", amount: 10, target: "questStage" }] },
    // 19070 Hold the Door (side quest, 10). Each player's threat cannot be reduced. Defeated: each player's threat is reduced by 5.
    { id: "19070:constant:1", cardCode: "19070", lines: ["19070:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
    { id: "19070:response:1", cardCode: "19070", lines: ["19070:A:2"], timing: "response", trigger: "questDefeated", instructions: [{ verb: "LowerThreat", amount: 5, who: "eachSeat" }] },
    // 19071 Defend the Town (side quest, 5). While it is the current quest one more encounter card is revealed during the quest phase. At the end of the encounter phase 1 damage is dealt to Hrogar's Hill for each enemy in the staging area.
    {
      id: "19071:constant:1",
      cardCode: "19071",
      lines: ["19071:A:1"],
      timing: "constant",
      condition: { kind: "flag", stat: "currentQuest", holder: "self" },
      instructions: [{ verb: "ModifyStat", stat: "revealMore", amount: 1, until: "whileSourceInPlay", target: "table" }],
    },
    {
      id: "19071:forced:1",
      cardCode: "19071",
      lines: ["19071:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Encounter" },
      instructions: [DAMAGE_THE_HILL({ count: { type: "enemy", control: "any", stagingOnly: true } })],
    },
    // 19072 Rout the Goblins (side quest, 5). It gets +5 quest points for each Goblin enemy in play. When Revealed: each player searches the encounter deck and discard pile for a different Goblin enemy and puts it into play engaged with him; the encounter deck is shuffled.
    {
      id: "19072:constant:1",
      cardCode: "19072",
      lines: ["19072:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: { type: "enemy", control: "any", staging: true, trait: "Goblin" }, times: 5 }, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "19072:whenRevealed:1",
      cardCode: "19072",
      lines: ["19072:A:2"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: "Goblin", type: "enemy", to: "engaged", different: true }]), { verb: "ShuffleEncounterDeck" }],
    },
    // 19073 Face the Dragon (side quest, 10). After Dagnir attacks and destroys a character 5 damage are healed from him. After it is defeated 5 damage are dealt to Dagnir.
    {
      id: "19073:forced:1",
      cardCode: "19073",
      lines: ["19073:A:1"],
      timing: "forced",
      trigger: "characterDestroyedByAttack",
      condition: { kind: "matches", card: "other", pick: DAGNIR },
      instructions: [{ verb: "Pick", pick: DAGNIR }, { verb: "Heal", amount: 5, target: "picked" }],
    },
    { id: "19073:forced:2", cardCode: "19073", lines: ["19073:A:2"], timing: "forced", trigger: "questDefeated", instructions: [{ verb: "Pick", pick: DAGNIR }, { verb: "DamageCard", amount: 5, target: "picked" }] },

    // 19074 Dagnir. X is 1 more than the number of side quests in the victory display: his Threat. He cannot leave the staging area (no player engages him) and takes at most X damage each round from effects other than a quest card's. With at least 3 side quests in the victory display
    // he is considered engaged with each player, as the Watcher in the Water is (he stays in the staging area, attacks every player in the combat phase, and any player's characters can attack him), and adds no Threat. (Immune to player card effects is a keyword.)
    { id: "19074:constant:1", cardCode: "19074", lines: ["19074:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: X, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "19074:constant:2",
      cardCode: "19074",
      lines: ["19074:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "damageCap", amount: X, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "damageCapSparesQuest", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "19074:constant:3",
      cardCode: "19074",
      lines: ["19074:A:3"],
      timing: "constant",
      condition: THREE_SIDE_QUESTS,
      instructions: [
        { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "noThreatContribution", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attackableByAny", amount: 1, until: "whileSourceInPlay", target: "self" },
      ],
    },

    // 19075 The Dragon's Thrall. After it engages you, you choose: 3 damage to Hrogar's Hill, or it makes an immediate attack against you. The Shadow: if the attack destroys a character, 3 damage to Hrogar's Hill.
    {
      id: "19075:forced:1",
      cardCode: "19075",
      lines: ["19075:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "hill", instructions: [DAMAGE_THE_HILL(3)] }, { id: "attack", instructions: [{ verb: "ImmediateAttackBy" }] }] }],
    },
    { id: "19075:shadow:1", cardCode: "19075", lines: ["19075:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ ...DAMAGE_THE_HILL(3), when: WHEN_DAMAGE_X }] }] },
    // 19076 Orc of the Flame. When Revealed: the first player chooses: 2 damage to a hero he controls, or 3 damage to Hrogar's Hill. The Shadow: +1 Attack (+2 with at least 25 damage on Hrogar's Hill).
    {
      id: "19076:whenRevealed:1",
      cardCode: "19076",
      lines: ["19076:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "hero", instructions: [{ verb: "Pick", pick: HERO_YOU }, { verb: "DamageCard", amount: 2, target: "picked" }] },
            { id: "hill", instructions: [DAMAGE_THE_HILL(3)] },
          ],
        },
      ],
    },
    {
      id: "19076:shadow:1",
      cardCode: "19076",
      lines: ["19076:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "less", left: 24, right: { stat: "damage", of: "questStage" } } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "less", left: 24, right: { stat: "damage", of: "questStage" } } },
      ],
    },
    // 19077 Town Gate. In the staging area it gains: at the end of the quest phase 1 resource is placed here, and with 3 here it is discarded and 4 damage are dealt to Hrogar's Hill. Travel: Dagnir makes an immediate attack against the first player.
    {
      id: "19077:forced:1",
      cardCode: "19077",
      lines: ["19077:A:1"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "sourceIn", zone: "staging" }] },
      instructions: [
        { verb: "PlaceResourceTokens", amount: 1, on: "self" },
        { verb: "Discard", target: { kind: "self" }, when: { kind: "less", left: 2, right: { stat: "resources", of: "self" } } },
        { ...DAMAGE_THE_HILL(4), when: { kind: "less", left: 2, right: { stat: "resources", of: "self" } } },
      ],
    },
    { id: "19077:travel:1", cardCode: "19077", lines: ["19077:A:2"], timing: "travel", instructions: DAGNIR_ATTACKS_FIRST_PLAYER },
    // 19078 Wooden Palisade. While it is the active location Dagnir gets -2 Attack. Travel: the first player readies a hero he controls.
    {
      id: "19078:constant:1",
      cardCode: "19078",
      lines: ["19078:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: -2, until: "whileSourceInPlay", holders: DAGNIR }],
    },
    { id: "19078:travel:1", cardCode: "19078", lines: ["19078:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: FIRST_PLAYERS_HERO }, { verb: "Ready", target: "picked" }] },
    // 19079 Burning Watchtower. X, its Threat, is 1 more than the number of side quests in the victory display. Travel: each player assigns X damage among characters he controls.
    { id: "19079:constant:1", cardCode: "19079", lines: ["19079:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: X, until: "whileSourceInPlay", target: "self" }] },
    { id: "19079:travel:1", cardCode: "19079", lines: ["19079:A:2"], timing: "travel", instructions: [{ verb: "AssignDamage", amount: X, pick: { type: "character", control: "you" }, who: "eachSeat" }] },
    // 19080 Powerful in Wrath (Doomed is a keyword). When Revealed: the active location is discarded and its Threat is dealt as damage to Hrogar's Hill; with no damage dealt it gains surge (read before the location leaves play: a Threat that is a constant of the location is gone once it is discarded). The Shadow: the excess damage of the attack goes on Hrogar's Hill.
    {
      id: "19080:whenRevealed:1",
      cardCode: "19080",
      lines: ["19080:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "location", control: "any", active: true } },
        { verb: "DamageCard", amount: { stat: "threat", of: "picked" }, target: "questStage" },
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "less", left: 0, right: { stat: "threat", of: "picked" } } } },
        { verb: "Discard", target: { kind: "picked" } },
      ],
    },
    { id: "19080:shadow:1", cardCode: "19080", lines: ["19080:A:3"], timing: "shadow", instructions: [{ verb: "ExcessToStage" }] },
    // 19081 The Dragon's Fury. When Revealed: Dagnir makes an immediate attack against the first player, and the damage of it left undefended goes on Hrogar's Hill. The Shadow: the attacker makes an additional attack against you after this one.
    { id: "19081:whenRevealed:1", cardCode: "19081", lines: ["19081:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: DAGNIR_ENEMY }, { verb: "AttackFromStaging", who: "firstPlayer", undefendedToStage: true }] },
    copyLine("19013:A:3", "19081:A:2"),
    // 19082 Bright Flames. When Revealed: each player assigns X damage among characters he controls, X 1 more than the number of side quests in the victory display. The Shadow: the attacker gets +1 Attack for each side quest in the victory display.
    { id: "19082:whenRevealed:1", cardCode: "19082", lines: ["19082:A:1"], timing: "whenRevealed", instructions: [{ verb: "AssignDamage", amount: X, pick: { type: "character", control: "you" }, who: "eachSeat" }] },
    { id: "19082:shadow:1", cardCode: "19082", lines: ["19082:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: SIDE_QUESTS_IN_VICTORY }, until: "endOfAttack", target: "attacker" }] },

    // 19083 Hrogar's Hill (the only stage, 50 quest points). Setup: the eight side quests (dealt as the side quest deck) are shuffled together, Dagnir is in the staging area (the piles), the encounter deck is shuffled and each other player reveals an encounter card.
    // Side B: at the end of the planning phase the top side quest is revealed (it joins the staging area) and Dagnir attacks Hrogar's Hill (the first player may declare a defender; no shadow card; the damage that is undefended or beyond a defender's hit points goes on the stage).
    // The stage cannot be defeated while Dagnir has hit points remaining; when he is destroyed the players win; with as much damage on the stage as it has quest points the players lose.
    { id: "19083:setup:1", cardCode: "19083", lines: ["19083:A:1"], timing: "setup", instructions: [{ verb: "ShufflePile", pile: "sideQuests" }, { verb: "ShuffleEncounterDeck" }, EACH_OTHER_REVEALS] },
    {
      id: "19083:forced:1",
      cardCode: "19083",
      lines: ["19083:B:1"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Planning" },
      instructions: [{ verb: "RevealSideQuest" }, { verb: "Pick", pick: DAGNIR_ENEMY }, { verb: "AttackStage" }],
    },
    {
      id: "19083:constant:1",
      cardCode: "19083",
      lines: ["19083:B:2"],
      timing: "constant",
      condition: { kind: "less", left: { stat: "damage", ofNamed: "Dagnir" }, right: { stat: "hitPoints", ofNamed: "Dagnir" } },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
    { id: "19083:triggered:1", cardCode: "19083", lines: ["19083:B:2"], timing: "triggered", trigger: "enemyDestroyed", subject: DAGNIR_ENEMY, instructions: [{ verb: "WinGame" }] },
    { id: "19083:constant:2", cardCode: "19083", lines: ["19083:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "loseAtDamage", amount: { stat: "questPoints", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  ],
  { pool: [...JOURNEY_UP_THE_ANDUIN, ...THE_WITHERED_HEATH] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
