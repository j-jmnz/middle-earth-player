import type { Effect, PickSpec } from "../../catalog/boundary.ts";

// Records for The Thing in the Depths (Dream-chaser part 5, campaign card 11194): the three quest stages, The Thing in the Depths on both of its sides, the Stormcaller, Corsair Raiders and The Thing in the
// Depths encounter cards, Sea Serpent (in pool/DCCE.ts with the other cards the campaign card places) and the campaign card. Captain Sahír and Na'asiyah are Raid on the Grey Havens' records. Every
// line is read from the scan ledger (data/printed/dream-chaser.json); the keywords (Surge, Grapple, Immune to player card effects) are read by the engine.
// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, dcce.stormcaller-elite, dcce.setup-the-thing-in-the-depths, dcce.campaign-setup-the-thing-in-the-depths, dcce.campaign-mode, dcce.gaining-xp,
// dcce.scalable-upgradable, dcce.encounter-cards, rr.travel, rr.search (data/rules/entries.json).
const THING: PickSpec = { type: "enemy", control: "any", staging: true, names: ["The Thing in the Depths"] };
const RAIDER: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Raider" };
const SAHIR_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Captain Sahír"] };
const ELITE_ENEMIES: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Captain Sahír", "Na'asiyah"] };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const UNDEFENDED = { kind: "undefended" } as const;
const ENGAGED_WITH_YOU = { kind: "engagedWithActor" } as const;
const SERPENT_ENRAGED: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Sea Serpent"], side: "B" };

// "Exhaust a character you control" (a Shadow effect, a Forced effect): the defending or engaged player chooses a ready one; nothing happens with none.
const exhaustOne: Effect["instructions"] = [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }];


// The Thing in the Depths (12049, and 110063 with its Campaign Mode only side B): it cannot be engaged, it gets +3 hit points for each player, and when a Creature enemy is destroyed it takes damage (the
// destroyed enemy's Threat on side A, the X the event carries; 2 on side B). `side` names the ledger side of each line; side B's first line is "Campaign Mode only", which has no effect (dcce.campaign-mode).
const thing = (code: string, side: "A" | "B", cannot: number, hitPoints: number, forced: number, damage: Effect["instructions"][number]): Effect[] => [
  { id: `${code}:constant:${side === "A" ? 1 : 4}`, cardCode: code, lines: [`${code}:${side}:${cannot}`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay" }] },
  { id: `${code}:constant:${side === "A" ? 2 : 5}`, cardCode: code, lines: [`${code}:${side}:${hitPoints}`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: { players: true, times: 3 }, until: "whileSourceInPlay" }] },
  {
    id: `${code}:forced:${side === "A" ? 1 : 2}`,
    cardCode: code,
    lines: [`${code}:${side}:${forced}`],
    timing: "forced",
    trigger: "enemyDestroyed",
    subject: { type: "enemy", control: "any", trait: "Creature" },
    instructions: [damage],
  },
];

// "Grapple" is a keyword; the Forced effects of an arm that follow it.
export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 12039 Take the Ship!. Setup: the encounter deck is built of The Stormcaller and Corsair Raiders by the scenario's piles, The Thing in the Depths set and The Stormcaller Elite wait set aside, and Helm of the
  // Stormcaller and an Umbar Raider are added to the staging area (dcce.setup-the-thing-in-the-depths, dcce.stormcaller-and-the-thing); the encounter deck is shuffled. Side B: Captain Sahír and Na'asiyah
  // gain indestructible; at the end of the round, if neither is in play, each gets a resource while it is set aside; no progress can be placed on this stage unless Helm of the Stormcaller is in the victory display.
  { id: "12039:setup:1", cardCode: "12039", lines: ["12039:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
  { id: "12039:constant:1", cardCode: "12039", lines: ["12039:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "indestructible", amount: 1, until: "whileSourceInPlay", holders: ELITE_ENEMIES }] },
  {
    id: "12039:forced:1",
    cardCode: "12039",
    lines: ["12039:B:2"],
    timing: "forced",
    trigger: "endOfRound",
    condition: { kind: "all", conditions: [{ kind: "inPlay", code: "11076", is: false }, { kind: "inPlay", code: "11078", is: false }] },
    instructions: [{ verb: "AddResourcesSetAside", codes: ["11076", "11078"], amount: 1 }],
  },
  {
    id: "12039:constant:2",
    cardCode: "12039",
    lines: ["12039:B:3"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table", when: { kind: "inVictory", code: "12042", is: false } }],
  },

  // 12040 Change of Plans. When Revealed: Captain Sahír and Na'asiyah flip to their objective sides (the first player and the last player take them); the Corsair Raiders leave the game; The Thing in the Depths joins
  // the staging area; the encounter discard pile and the set aside The Thing in the Depths set are shuffled into the encounter deck; the players advance to stage 3.
  {
    id: "12040:whenRevealed:1",
    cardCode: "12040",
    lines: ["12040:B:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "FlipElite", name: "Captain Sahír", to: "firstPlayer" },
      { verb: "FlipElite", name: "Na'asiyah", to: "lastPlayer" },
      { verb: "RemoveEncounterSet", set: "Corsair Raiders" },
      { verb: "StageSetAside", name: "The Thing in the Depths" },
      { verb: "ShuffleEncounterDiscard" },
      { verb: "ShuffleSetAsideSet", set: "The Thing in the Depths" },
      { verb: "ShuffleEncounterDeck" },
      { verb: "AdvanceStage" },
    ],
  },

  // 12041 Defend the Ship!. When Revealed: cards are discarded until 1 more Tentacle enemy than there are players is, and each resolves its Grapple keyword. Side B: the players may travel while a location is active
  // (it returns to the staging area); at the end of the round the players lose if any one Ship location has 9 Threat or more; destroying The Thing in the Depths wins.
  { id: "12041:whenRevealed:1", cardCode: "12041", lines: ["12041:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardUntilGrapple", trait: "Tentacle", count: { players: true, plus: 1 } }] },
  { id: "12041:constant:1", cardCode: "12041", lines: ["12041:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "travelOverActive", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "12041:forced:1",
    cardCode: "12041",
    lines: ["12041:B:2"],
    timing: "forced",
    trigger: "endOfRound",
    condition: { kind: "locationThreat", trait: "Ship", min: 9 },
    instructions: [{ verb: "LoseGame", reason: "The Stormcaller was destroyed: a Ship location's Threat reached 9" }],
  },
  { id: "12041:triggered:1", cardCode: "12041", lines: ["12041:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: THING, instructions: [{ verb: "WinGame" }] },

  // 12042 Helm of the Stormcaller. +1 quest point for each resource on a Raider enemy in play. Forced: when it becomes the active location, Na'asiyah and Captain Sahír join the staging area, enemy sides up.
  { id: "12042:constant:1", cardCode: "12042", lines: ["12042:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { resourcesOn: RAIDER }, until: "whileSourceInPlay" }] },
  { id: "12042:forced:1", cardCode: "12042", lines: ["12042:A:3"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "StageSetAside", code: "11078" }, { verb: "StageSetAside", code: "11076" }] },

  // 12043 Forecastle Deck. Forced: after the players travel here, the first player searches the encounter deck and discard pile for an enemy and reveals it; the deck is shuffled. Shadow: +1 Attack, +2 against a
  // defending character with no resources.
  { id: "12043:forced:1", cardCode: "12043", lines: ["12043:A:1"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "SearchReveal", type: "enemy", who: "actor" }, { verb: "ShuffleEncounterDeck" }] },
  {
    id: "12043:shadow:1",
    cardCode: "12043",
    lines: ["12043:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
      // +2 instead of +1 when the defending character has no resources on it or in its pool: +1 more for a defender, less 1 when it has some, and +1 for the attack no character defends.
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any" } } },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", subtract: true, when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", hasResources: true } } },
    ],
  },

  // 12044 Weather Deck. While it is in the staging area each other Deck location in play gains a Travel cost: each player exhausts a character. Shadow: the defending player exhausts a character.
  {
    id: "12044:constant:1",
    cardCode: "12044",
    lines: ["12044:A:1"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [{ verb: "ModifyStat", stat: "travelExhaust", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", trait: "Deck", other: true } }],
  },
  { id: "12044:shadow:1", cardCode: "12044", lines: ["12044:A:2"], timing: "shadow", instructions: exhaustOne },

  // 12045 Cargo Hold. While it is the active location each enemy gets +1 Defense. Shadow: the attacking enemy gets +2 Defense until the end of the phase.
  {
    id: "12045:constant:1",
    cardCode: "12045",
    lines: ["12045:A:1"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "activeLocation" },
    instructions: [{ verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }],
  },
  { id: "12045:shadow:1", cardCode: "12045", lines: ["12045:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "attacker" }] },

  // 12046 Crew Quarters. Travel: 1 resource on each Raider card in play. Shadow: the attacking enemy gets +2 Attack.
  { id: "12046:travel:1", cardCode: "12046", lines: ["12046:A:1"], timing: "travel", instructions: [{ verb: "Each", pick: RAIDER, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] }] },
  { id: "12046:shadow:1", cardCode: "12046", lines: ["12046:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" }] },

  // 12047 Quarter Deck. While it is the active location each enemy is dealt an additional shadow card in the combat phase: once the shadow cards are dealt each of the seat's engaged enemies gets one more
  // (the enemies of the player the event is about), which is the card the line adds to the one each enemy is dealt. Shadow: the defending player discards an attachment they control.
  {
    id: "12047:forced:1",
    cardCode: "12047",
    lines: ["12047:A:1"],
    timing: "forced",
    trigger: "shadowsDealt",
    condition: { kind: "sourceIn", zone: "activeLocation" },
    instructions: [{ verb: "Each", pick: { type: "enemy", control: "any", engaged: "you" }, instructions: [{ verb: "DealShadowTo", target: "picked" }] }],
  },
  {
    id: "12047:shadow:1",
    cardCode: "12047",
    lines: ["12047:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }],
  },

  // 12048 Hold Steady!. When Revealed: each character with 1 Defense or less exhausts. Shadow: a defending character with 0 Defense is discarded, otherwise it gets -2 Defense for this attack.
  { id: "12048:whenRevealed:1", cardCode: "12048", lines: ["12048:A:1"], timing: "whenRevealed", instructions: [{ verb: "Each", pick: { type: "character", control: "any", maxDefense: 1 }, instructions: [{ verb: "Exhaust", target: { kind: "picked" } }] }] },
  {
    id: "12048:shadow:1",
    cardCode: "12048",
    lines: ["12048:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "any", defending: true, maxDefense: 0 } },
      { verb: "Discard", target: { kind: "picked" } },
      { verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfAttack", target: "defender", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", maxDefense: 0 } } } },
    ],
  },

  // 12049 The Thing in the Depths (Immune to player card effects is a keyword), and 110063 on both sides.
  ...thing("12049", "A", 2, 3, 4, { verb: "DamageCard", amount: { x: true }, target: "self" }),
  ...thing("110063", "A", 2, 3, 4, { verb: "DamageCard", amount: { x: true }, target: "self" }),
  ...thing("110063", "B", 3, 4, 5, { verb: "DamageCard", amount: 2, target: "self" }),

  // 12050 Eye of the Beast (Surge is a keyword). It cannot attack. While it is engaged with a player the Thing attacks that player in the combat phase, from the staging area, dealt a shadow card for each attack.
  { id: "12050:constant:1", cardCode: "12050", lines: ["12050:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "12050:constant:2",
    cardCode: "12050",
    lines: ["12050:A:3"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "engaged" },
    instructions: [{ verb: "ModifyStat", stat: "relaysAttack", amount: 1, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "attacksViaRelay", amount: 1, until: "whileSourceInPlay", holders: THING }],
  },

  // 12051 Thrashing Arm (Grapple is a keyword). Forced: at the end of the combat phase, the player it is engaged with deals 3 damage to a character they control.
  {
    id: "12051:forced:1",
    cardCode: "12051",
    lines: ["12051:A:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "engaged" }] },
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: MY_CHARACTER, when: ENGAGED_WITH_YOU }, { verb: "DamageCard", amount: 3, target: "picked", when: ENGAGED_WITH_YOU }] }],
  },

  // 12052 Crushing Arm (Surge and Grapple are keywords). Forced: after it is detached from a location it makes an immediate attack against the first player.
  { id: "12052:forced:1", cardCode: "12052", lines: ["12052:A:3"], timing: "forced", trigger: "grappleDetached", subject: "self", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] },

  // 12053 Grasping Arm (Grapple is a keyword). Forced: when it attacks, the engaged player exhausts a character. Shadow: if the attack is undefended, its Grapple keyword resolves.
  { id: "12053:forced:1", cardCode: "12053", lines: ["12053:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: exhaustOne },
  { id: "12053:shadow:1", cardCode: "12053", lines: ["12053:A:3"], timing: "shadow", instructions: [{ verb: "ResolveGrapple", target: "self", when: UNDEFENDED }] },

  // 12054 Giant Arm (Grapple is a keyword). +2 Attack when attacking allies. Shadow: after the attack either it comes into play engaged with the defending player, dealt a shadow card, or its Grapple keyword resolves.
  { id: "12054:constant:1", cardCode: "12054", lines: ["12054:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", when: { kind: "versusDefender", ally: true } }] },
  { id: "12054:shadow:1", cardCode: "12054", lines: ["12054:A:3"], timing: "shadow", instructions: [{ verb: "EngageOrGrapple" }] },

  // 12055 From the Depths. When Revealed: the top 3 cards of the encounter deck are discarded and each enemy among them resolves its Grapple keyword. Shadow: the defending player assigns damage among the characters
  // they control equal to the number of enemies grappled with locations in the staging area.
  { id: "12055:whenRevealed:1", cardCode: "12055", lines: ["12055:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardTopGrapple", count: 3 }] },
  { id: "12055:shadow:1", cardCode: "12055", lines: ["12055:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: { grappled: true }, pick: MY_CHARACTER }] },

  // 12056 Lashing Tentacles. When Revealed: The Thing in the Depths (picked, then attacking the player the step is for) attacks each player in turn order from the staging area, dealt a shadow card for each attack. Shadow: after this attack the Thing attacks the
  // defending player.
  { id: "12056:whenRevealed:1", cardCode: "12056", lines: ["12056:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: THING }, { verb: "AttackFromStaging" }] }] },
  { id: "12056:shadow:1", cardCode: "12056", lines: ["12056:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "Pick", pick: THING }, { verb: "AttackFromStaging" }] }] },

  // 11194 The Thing in the Depths (campaign card). Setup (Campaign Mode): Black Key (boon and burden), Come Together and Sea Serpent are set aside, and The Thing in the Depths shows its Campaign Mode only side once
  // the quest card's Setup has set it aside (ScenarioDefinition.afterSetup). Forced: after Captain Sahír enters play Black Key (burden) is attached to him; after he flips over the burden leaves the game, Black Key (boon)
  // is attached to him, Sea Serpent joins the staging area on its Menacing side and one player (the first player chooses) adds Come Together to their hand, its X plus 1 this game. Resolution: the players may add
  // Come Together to the Campaign Pool; the XP list.
  {
    id: "11194:campaignSetup:1",
    cardCode: "11194",
    lines: ["11194:A:1"],
    timing: "campaignSetup",
    instructions: [
      { verb: "SetAside", code: "11183" },
      { verb: "SetAside", code: "11192" },
      { verb: "SetAside", code: "11195" },
      { verb: "SetAside", code: "11196" },
      { verb: "FlipSetAside", name: "The Thing in the Depths" },
    ],
  },
  { id: "11194:forced:1", cardCode: "11194", lines: ["11194:A:2"], timing: "forced", trigger: "addedToStaging", subject: SAHIR_ENEMY, instructions: [{ verb: "AttachSetAsideTo", code: "11192", to: "Captain Sahír" }] },
  {
    id: "11194:forced:2",
    cardCode: "11194",
    lines: ["11194:A:3"],
    timing: "forced",
    trigger: "flipped",
    subject: { type: "card", control: "any", names: ["Captain Sahír"] },
    instructions: [
      { verb: "RemoveCodeFromGame", code: "11192" },
      { verb: "AttachSetAsideTo", code: "11183", to: "Captain Sahír" },
      { verb: "StageSetAside", code: "11196" },
      { verb: "Pick", pick: { type: "player", control: "any" } },
      { verb: "AddSetAsideToHand", code: "11195" },
    ],
  },
  { id: "11194:resolution:1", cardCode: "11194", lines: ["11194:B:1"], timing: "resolution", instructions: [{ verb: "ChooseCards", codes: ["11195"], who: "firstPlayer", to: "pool", optional: true }] },
  { id: "11194:resolution:2", cardCode: "11194", lines: ["11194:B:2", "11194:B:3"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" } }] },
  { id: "11194:resolution:3", cardCode: "11194", lines: ["11194:B:4"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "card", control: "any", names: ["Captain Sahír"], minResources: 5 }, min: 1 } }] },
  { id: "11194:resolution:4", cardCode: "11194", lines: ["11194:B:5"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "card", control: "any", names: ["Na'asiyah"], minResources: 5 }, min: 1 } }] },
  {
    id: "11194:resolution:5",
    cardCode: "11194",
    lines: ["11194:B:6"],
    timing: "resolution",
    instructions: [
      { verb: "GainXp", amount: 1, when: { kind: "count", pick: SERPENT_ENRAGED, min: 1 } },
      { verb: "GainXp", amount: 2, when: { kind: "inVictory", code: "11196", is: true } },
    ],
  },
  { id: "11194:resolution:6", cardCode: "11194", lines: ["11194:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "hero", control: "any", damaged: true }, max: 0 } }] },
  {
    id: "11194:resolution:7",
    cardCode: "11194",
    lines: ["11194:B:8"],
    timing: "resolution",
    instructions: [
      { verb: "GainXp", amount: 1, when: { kind: "survivorsThreat", max: 40 } },
      { verb: "GainXp", amount: 1, when: { kind: "survivorsThreat", max: 30 } },
    ],
  },
  {
    id: "11194:resolution:8",
    cardCode: "11194",
    lines: ["11194:B:9"],
    timing: "resolution",
    instructions: [{ verb: "GainXp", amount: -1, when: { kind: "count", pick: { type: "card", control: "any", from: "victory", names: ["Ominous Fate"] }, min: 1 } }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
