import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as JOURNEY_UP_THE_ANDUIN } from "./journey-up-the-anduin.ts";
import { AUTHORED_EFFECTS as LOST_IN_MIRKWOOD } from "./lost-in-mirkwood.ts";
import { AUTHORED_EFFECTS as THE_KINGS_QUEST } from "./the-kings-quest.ts";
import { AUTHORED_EFFECTS as THE_OATH } from "./the-oath.ts";
import { AUTHORED_EFFECTS as THE_THING_IN_THE_DEPTHS } from "./the-thing-in-the-depths.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Withered Heath (Ered Mithrin part 4, campaign card 12175): the encounter cards no template reads, the four quest stages and the campaign card. The Accolade boons (12176 to 12179) and the Song boons (12180 to 12183) are in pool/EMCE.ts.
// Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The piles place the cards set aside (Cold-Drake, the four Dragon Signs) and the Caves deck
// (the Lost Caves set); stage 1A's Setup shuffles the deck and two Dragon Signs into it. The campaign card's Setup is dealt by src/campaign/start.ts and src/campaign/checklist.ts; its back stays in the campaign zone all game, so its Forced effect hears the stages defeated.
// Rules: emce.setup-the-withered-heath, emce.dragon-signs, emce.caves-deck, emce.deep, emce.guarded-x, emce.immune, emce.treasure, emce.boon-allies, rr.guarded, rr.victory, rr.explored, rr.cancel, rr.search (data/rules/entries.json).
const COLD_DRAKE: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Cold-Drake"] };
const STAGING_LOCATIONS = { type: "location", control: "any", stagingOnly: true } as const;
const ANY_CHARACTER = { type: "character", control: "any" } as const;
// "for each Dragon Sign in the victory display"
const SIGN_IN_VICTORY: PickSpec = { type: "card", control: "any", from: "victory", names: ["Dragon Sign"] };
const SIGNS_IN_VICTORY = { count: SIGN_IN_VICTORY };
const PICKED_IS = (type: "location" | "enemy"): Condition => ({ kind: "matches", card: "picked", pick: { type, control: "any" }, inPlay: false });
// Each player in turn order: the instructions with a question for them.
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// "discard cards from the top until X locations are discarded, where X is the number of players. Add each discarded location to the staging area": one location for each player.
const LOCATIONS_TO_STAGING = EACH_PLAYER([{ verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS("location") }]);
// "Look at the top 3 cards of the encounter deck. Reveal 1 of those cards and discard the rest." (19022:B:1, 19024:B:1)
const LOOK_AT_THREE: Instruction[] = [{ verb: "LookAtTop", count: 3 }, { verb: "PickEncounter", from: "looked" }, { verb: "DiscardOtherLooked" }, { verb: "RevealEncounter" }];
// The stage cannot be defeated unless at least `min` Dragon Signs are in the victory display.
const NEEDS_SIGNS = (min: number): Condition => ({ kind: "less", left: SIGNS_IN_VICTORY, right: min });
// The quest stage that was defeated (the questCardDefeated event's subject), by its printed title.
const STAGE_DEFEATED = (title: string): Condition => ({ kind: "matches", card: "subject", pick: { type: "card", control: "any", names: [title] }, inPlay: false });
// A player who controls no Accolade boon may attach the set-aside boon to one of their heroes (12175:B:1): the player has none, the boon waits set aside, and a hero of theirs may carry it (Limit 1 per hero).
const NO_ACCOLADE: Condition = { kind: "count", pick: { type: "attachment", control: "you", trait: "Accolade" }, max: 0 };
// The Forced effect of one stage (12175:B:1 and the stage's own line): the stage was defeated, or for the last one Cold-Drake was (the stage cannot be defeated while it is in play, and defeating it wins the game, 19025:B:3).
const accolade = (n: number, boon: string, when: Pick<Effect, "trigger" | "subject" | "condition">): Effect => ({
  id: `12175:forced:${n}`,
  cardCode: "12175",
  lines: ["12175:B:1", `12175:B:${n + 1}`],
  timing: "forced",
  ...when,
  instructions: [
    EACH_PLAYER([
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "attach", requires: { kind: "all", conditions: [NO_ACCOLADE, { kind: "outOfPlay", code: boon }, { kind: "canPick", pick: { type: "hero", control: "you", attachable: boon } }] }, instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", attachable: boon } }, { verb: "AttachSetAside", code: boon }] },
          { id: "decline", instructions: [] },
        ],
      },
    ]),
  ],
});
const stageDefeated = (title: string): Pick<Effect, "trigger" | "subject" | "condition"> => ({ trigger: "questCardDefeated", subject: { type: "card", control: "any" }, condition: STAGE_DEFEATED(title) });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 12175 The Withered Heath (campaign card). Setup: the four Accolade boons wait set aside; a player may search their deck for a unique boon ally and add it to their hand; with Melanwar's line the first player removes 2 non-unique locations from the encounter deck
    // and 1 location from the Caves deck, with Isolde's 3 non-unique enemies. Side B stays in play: after a main quest stage is defeated a player with no Accolade boon may attach that stage's boon to one of their heroes (the four records below, one for each stage).
    // Resolution: each Accolade boon in play joins the pool on its hero; each player may take a Song boon into the pool; with 4 Dragon Signs in the victory display the first player also chooses 1 of 3 random undiscovered treasures; the players discover each treasure they control.
    {
      id: "12175:campaignSetup:1",
      cardCode: "12175",
      lines: ["12175:A:2"],
      timing: "campaignSetup",
      instructions: [
        { verb: "SetAside", code: "12176" },
        { verb: "SetAside", code: "12177" },
        { verb: "SetAside", code: "12178" },
        { verb: "SetAside", code: "12179" },
        { verb: "SearchBoonAllyToHand" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "melanwar", count: 2, cardType: "location", nonUnique: true },
        { verb: "RemoveFromCavesIfLogged", line: "melanwar", count: 1, cardType: "location" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "isolde", count: 3, cardType: "enemy", nonUnique: true },
      ],
    },
    accolade(1, "12176", stageDefeated("Searching for Dragon Sign")),
    accolade(2, "12177", stageDefeated("The Cold-Drake Attacks!")),
    accolade(3, "12178", stageDefeated("Hunting the Beast")),
    accolade(4, "12179", { trigger: "enemyDestroyed", subject: COLD_DRAKE, condition: { kind: "onStage", stage: 4 } }),
    {
      id: "12175:resolution:1",
      cardCode: "12175",
      lines: ["12175:B:6"],
      timing: "resolution",
      instructions: [{ verb: "EarnAttached", codes: ["12176", "12177", "12178", "12179"] }, { verb: "ChooseCards", codes: ["12180", "12181", "12182", "12183"], who: "eachSeat", to: "pool", optional: true }],
    },
    { id: "12175:resolution:2", cardCode: "12175", lines: ["12175:B:7"], timing: "resolution", instructions: [{ verb: "ChooseRandomTreasure", count: 3, when: { kind: "less", left: 3, right: SIGNS_IN_VICTORY } }] },
    copyLine("120165:B:2", "12175:B:8"),

    // 19011 Cold-Drake: no attachments and no non-combat damage; +1 Threat and Defense for each Dragon Sign in the victory display; dealt a shadow card with no effect, the defender cannot ready until the end of the round.
    {
      id: "19011:constant:1",
      cardCode: "19011",
      lines: ["19011:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "19011:constant:2",
      cardCode: "19011",
      lines: ["19011:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: SIGNS_IN_VICTORY, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defense", amount: SIGNS_IN_VICTORY, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "19011:forced:1", cardCode: "19011", lines: ["19011:A:3"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "other" }] },
    // 19012 Dragon Sign: Guarded (enemy); whatever it is attached to is immune to player card effects; free of encounters it goes to the victory display.
    copyLine("18031:A:1", "19012:A:1"),
    { id: "19012:constant:1", cardCode: "19012", lines: ["19012:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "card", control: "any", attachedTo: "source" } }] },
    { id: "19012:constant:2", cardCode: "19012", lines: ["19012:A:3"], timing: "constant", instructions: [{ verb: "VictoryWhenFree" }] },
    // 19013 Snow-troll: after it attacks and destroys a character it returns to the staging area. The Shadow gives the attacker an additional attack.
    { id: "19013:forced:1", cardCode: "19013", lines: ["19013:A:2"], timing: "forced", trigger: "attacks", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: { kind: "x", min: 1 } }] }] },
    copyLine("18035:A:2", "19013:A:3"),
    // 19014 Dragon Hatchling: +1 Attack and Defense for each Dragon Sign in the victory display; the Shadow gives the attacker that until the end of the phase.
    { id: "19014:constant:1", cardCode: "19014", lines: ["19014:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: SIGNS_IN_VICTORY, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "defense", amount: SIGNS_IN_VICTORY, until: "whileSourceInPlay", target: "self" }] },
    { id: "19014:shadow:1", cardCode: "19014", lines: ["19014:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: SIGNS_IN_VICTORY, until: "endOfPhase", target: "attacker" }, { verb: "ModifyStat", stat: "defense", amount: SIGNS_IN_VICTORY, until: "endOfPhase", target: "attacker" }] },
    // 19015 Mountain Pass: while it is in the staging area the When Revealed effects of Weather treacheries cannot be canceled.
    { id: "19015:constant:1", cardCode: "19015", lines: ["19015:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "UncancelableWhenRevealed", trait: "Weather" }] },
    // 19016 Dwarven Door: Deep; no progress while it is in the staging area.
    copyLine("18046:A:1", "19016:A:1"),
    { id: "19016:constant:2", cardCode: "19016", lines: ["19016:A:2"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    // 19017 Cave Entrance: Deep; +1 Threat for each Dragon Sign in the victory display; Travel: every player raises their threat by 1.
    copyLine("18046:A:1", "19017:A:1"),
    { id: "19017:constant:2", cardCode: "19017", lines: ["19017:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: SIGNS_IN_VICTORY, until: "whileSourceInPlay", target: "self" }] },
    { id: "19017:travel:1", cardCode: "19017", lines: ["19017:A:3"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
    // 19018 Creature Den: after the players travel here a Dragon Sign is searched out of the Caves deck and guarded by it, and the deck is shuffled; Travel: the discard pile goes back into the deck and the first enemy discarded is added to the staging area.
    {
      id: "19018:response:1",
      cardCode: "19018",
      lines: ["19018:A:1"],
      timing: "response",
      trigger: "traveled",
      subject: "self",
      instructions: [{ verb: "AttachGuardedFromPile", pile: "caves", code: "19012" }, { verb: "ShufflePile", pile: "caves" }],
    },
    {
      id: "19018:travel:1",
      cardCode: "19018",
      lines: ["19018:A:2"],
      timing: "travel",
      instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: PICKED_IS("enemy") }],
    },
    // 19019 High Falls: Deep; X is the number of locations in the staging area; Travel: the first player assigns X damage among the characters in play.
    copyLine("18046:A:1", "19019:A:1"),
    copyLine("41011:A:1", "19019:A:2"),
    { id: "19019:travel:1", cardCode: "19019", lines: ["19019:A:3"], timing: "travel", instructions: [{ verb: "AssignDamage", amount: { count: STAGING_LOCATIONS }, pick: ANY_CHARACTER }] },
    // 19020 Heavy Snow (Doomed is a keyword): the first player exhausts a character, and until the end of the round no player card effect readies a character; the Shadow exhausts a character the defender controls.
    {
      id: "19020:whenRevealed:1",
      cardCode: "19020",
      lines: ["19020:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "character", control: "any", state: "ready", who: "firstPlayer" } },
        { verb: "Exhaust", target: { kind: "picked" } },
        { verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "endOfRound", target: "characters" },
      ],
    },
    copyLine("12044:A:2", "19020:A:3"),
    // 19021 Deadly Cold: each player chooses for each ready character they control to exhaust it or deal 1 damage to it. The Shadow gives the attacker +1 Attack, +2 against a damaged defender.
    { id: "19021:whenRevealed:1", cardCode: "19021", lines: ["19021:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "ExhaustOrDamageEachReady", amount: 1 }])] },
    {
      id: "19021:shadow:1",
      cardCode: "19021",
      lines: ["19021:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } },
      ],
    },

    // 19022 Searching for Dragon Sign (stage 1). Setup: Cold-Drake and the Dragon Signs are dealt set aside by the piles; the Caves deck is created and 2 set-aside Dragon Signs shuffled into it; the encounter deck is shuffled and a location for each player is added to the staging area.
    // Side B: after the active location is explored the first player looks at 3 cards of the encounter deck, reveals 1 and discards the rest; the stage cannot be defeated without a Dragon Sign in the victory display.
    {
      id: "19022:setup:1",
      cardCode: "19022",
      lines: ["19022:A:1"],
      timing: "setup",
      instructions: [{ verb: "ShufflePile", pile: "caves" }, { verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "19012", count: 2 }, { verb: "ShuffleEncounterDeck" }, LOCATIONS_TO_STAGING],
    },
    { id: "19022:forced:1", cardCode: "19022", lines: ["19022:B:1"], timing: "forced", trigger: "activeExplored", instructions: LOOK_AT_THREE },
    { id: "19022:constant:1", cardCode: "19022", lines: ["19022:B:2"], timing: "constant", condition: NEEDS_SIGNS(1), instructions: [{ verb: "Restrict", what: "advance" }] },
    // 19023 The Cold-Drake Attacks! (stage 2). Cold-Drake joins the staging area. Side B: the Deep keyword is ignored; Cold-Drake stays in the staging area, even at as much damage as it has hit points, and is considered engaged with each player (as the Watcher in the Water is);
    // it takes at most 6 damage each round and never has more than 18; the stage cannot be defeated while it has hit points remaining.
    { id: "19023:whenRevealed:1", cardCode: "19023", lines: ["19023:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "19011" }] },
    { id: "19023:constant:1", cardCode: "19023", lines: ["19023:B:1"], timing: "constant", instructions: [{ verb: "IgnoreKeyword", keywords: ["deep"] }] },
    {
      id: "19023:constant:2",
      cardCode: "19023",
      lines: ["19023:B:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "indestructible", amount: 1, until: "whileSourceInPlay", holders: COLD_DRAKE },
        { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", holders: COLD_DRAKE },
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: COLD_DRAKE },
        { verb: "ModifyStat", stat: "noThreatContribution", amount: 1, until: "whileSourceInPlay", holders: COLD_DRAKE },
        { verb: "ModifyStat", stat: "attackableByAny", amount: 1, until: "whileSourceInPlay", holders: COLD_DRAKE },
      ],
    },
    {
      id: "19023:constant:3",
      cardCode: "19023",
      lines: ["19023:B:3"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: 6, until: "whileSourceInPlay", holders: COLD_DRAKE }, { verb: "ModifyStat", stat: "damageCeiling", amount: 18, until: "whileSourceInPlay", holders: COLD_DRAKE }],
    },
    {
      id: "19023:constant:4",
      cardCode: "19023",
      lines: ["19023:B:4"],
      timing: "constant",
      condition: { kind: "less", left: { stat: "damage", ofNamed: "Cold-Drake" }, right: { stat: "hitPoints", ofNamed: "Cold-Drake" } },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
    // 19024 Hunting the Beast (stage 3). Two more Dragon Signs are shuffled into the Caves deck, Cold-Drake is set aside with its damage, and the discard pile goes back into the encounter deck before a location for each player is added to the staging area.
    // Side B: as stage 1B; at the end of each round 3 damage come off the set-aside Cold-Drake; the stage cannot be defeated without 3 Dragon Signs in the victory display.
    {
      id: "19024:whenRevealed:1",
      cardCode: "19024",
      lines: ["19024:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "19012", count: 2 }, { verb: "SetAsideInPlay", code: "19011", keepDamage: true }, { verb: "ShuffleEncounterDiscard" }, LOCATIONS_TO_STAGING],
    },
    { id: "19024:forced:1", cardCode: "19024", lines: ["19024:B:1"], timing: "forced", trigger: "activeExplored", instructions: LOOK_AT_THREE },
    { id: "19024:forced:2", cardCode: "19024", lines: ["19024:B:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "RemoveSetAsideDamage", code: "19011", amount: 3 }] },
    { id: "19024:constant:1", cardCode: "19024", lines: ["19024:B:3"], timing: "constant", condition: NEEDS_SIGNS(3), instructions: [{ verb: "Restrict", what: "advance" }] },
    // 19025 A Cornered Dragon (stage 4). Cold-Drake joins the staging area and attacks each player in turn order. Side B: it takes at most as much damage each round as there are Dragon Signs in the victory display; at the beginning of the quest phase it returns to the staging area and
    // attacks each player again; the stage cannot be defeated while it is in play, and defeating it wins the game.
    {
      id: "19025:whenRevealed:1",
      cardCode: "19025",
      lines: ["19025:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AddSetAsideToStaging", code: "19011" }, { verb: "Pick", pick: COLD_DRAKE }, EACH_PLAYER([{ verb: "AttackFromStaging" }])],
    },
    { id: "19025:constant:1", cardCode: "19025", lines: ["19025:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: SIGNS_IN_VICTORY, until: "whileSourceInPlay", holders: COLD_DRAKE }] },
    {
      id: "19025:forced:1",
      cardCode: "19025",
      lines: ["19025:B:2"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Quest" },
      instructions: [{ verb: "Pick", pick: COLD_DRAKE }, { verb: "ReturnToStaging", target: { kind: "picked" } }, EACH_PLAYER([{ verb: "AttackFromStaging" }])],
    },
    // "This stage cannot be defeated while Cold-Drake is in play": the stage prints 0 quest points, so the quest would find it met the moment it is reached, before its When Revealed has brought Cold-Drake in from the set-aside cards;
    // it holds until Cold-Drake lies in the victory display (a Cold-Drake out of play never returns but by this stage).
    { id: "19025:constant:2", cardCode: "19025", lines: ["19025:B:3"], timing: "constant", condition: { kind: "inVictory", code: "19011", is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },
    // "When Cold-Drake is defeated, the players win the game": the win comes at the end of the phase, once the Forced effects of the defeat (the Accolade boon of stage 4, 12175:B:5) have been answered: the engine closes a won game before it announces the events behind it.
    { id: "19025:forced:2", cardCode: "19025", lines: ["19025:B:3"], timing: "forced", trigger: "enemyDestroyed", subject: COLD_DRAKE, instructions: [{ verb: "Delay", until: "endOfPhase", instructions: [{ verb: "WinGame" }] }] },
  ],
  { pool: [...JOURNEY_UP_THE_ANDUIN, ...LOST_IN_MIRKWOOD, ...THE_KINGS_QUEST, ...THE_OATH, ...THE_THING_IN_THE_DEPTHS] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
