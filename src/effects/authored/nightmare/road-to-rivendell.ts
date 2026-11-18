import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";


// Road to Rivendell Nightmare (deck 9014, data/printed/nightmare.json). The setup card's A:1 and its side B are the deck-building text (inert); A:2 gives an engaged ambush enemy's Threat to the staging area during the quest phase. Ambush in the Night takes
// stage 2's place: it finds Goblin Gate and reveals the enemies it discards, then gives Arwen to the Gate to guard and lets the engaged enemies add quest points to the Gate. The cards put engagement checks and damage on Arwen. The readings are in docs/brief.md (Road to Rivendell).
// Rules: dwd.ambush, rr.engagement-check, rr.engaged, rr.guarded, rr.explored, rr.reveal, rr.search, rr.running-out-of-cards, rr.damage, rr.defending-player, dwd.ally-objective-arwen-road-to-rivendell (data/rules/entries.json).
const ARWEN = "04041";
const GOBLIN_GATE = "04043";
const AMBUSH_ENEMY: PickSpec = { type: "enemy", control: "any", keyword: "ambush" };
const ARWEN_ANYWHERE: PickSpec = { type: "card", control: "any", names: ["Arwen Undómiel"] };
const GATE_IN_PLAY: PickSpec = { type: "location", control: "any", names: ["Goblin Gate"] };
const NO_PLAYER_CONTROLS_ARWEN: Condition = { kind: "count", pick: { type: "ally", control: "any", names: ["Arwen Undómiel"] }, max: 0 };
const ENGAGED_ENEMIES: PickSpec = { type: "enemy", control: "any" };
const IN_STAGING_OR_ACTIVE: Condition = { kind: "any", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "sourceIn", zone: "activeLocation" }] };
const ATTACKER_IS_SELF: Condition = { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 901401 setup card. A:2: when an enemy with the ambush keyword, printed or gained, engages a player during the quest phase, by an ambush check or by a player, it contributes its Threat to the staging area's total until the end of the phase (while it stays engaged).
  {
    id: "901401:forced:1",
    cardCode: "901401",
    lines: ["901401:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: AMBUSH_ENEMY,
    condition: { kind: "phase", is: "Quest" },
    instructions: [{ verb: "ModifyStat", stat: "engagedThreat", amount: 1, until: "endOfPhase", target: "subject" }],
  },

  // 901402 Ambush in the Night (stage 2, in place of Orc Outpost). A:1: Goblin Gate is searched for in the encounter deck, discard pile and victory display and added to the staging area (not revealed, not made active); the discard pile is shuffled into the deck;
  // cards are discarded from the top until 1 enemy for each player is discarded or the deck is out; each enemy discarded is revealed in full, in the order discarded (Ambush makes its checks).
  {
    id: "901402:whenRevealed:1",
    cardCode: "901402",
    lines: ["901402:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "SearchMove", code: GOBLIN_GATE, to: "staging", victory: true }, { verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "reveal" }],
  },
  // B:1: the first player loses control of Arwen and Goblin Gate, wherever it is in play, guards her: she stays in play with her damage, tokens and attachments, can be damaged, her leaving play loses the game, and she is the first player's again once the Gate leaves play
  // (with no Gate in play she stays with the first player: agent recommendation). B:2: Goblin Gate's quest points, read live, grow by 1 for each enemy engaged with a player. B:3: no progress is placed on this stage while no player controls Arwen.
  {
    id: "901402:whenRevealed:2",
    cardCode: "901402",
    lines: ["901402:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: GATE_IN_PLAY }, { verb: "GuardReturnedBy", code: ARWEN, returns: "firstPlayer", when: { kind: "canPick", pick: GATE_IN_PLAY } }],
  },
  {
    id: "901402:constant:1",
    cardCode: "901402",
    lines: ["901402:B:2"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: ENGAGED_ENEMIES }, until: "whileSourceInPlay", holders: { type: "location", control: "any", names: ["Goblin Gate"] } }],
  },
  {
    id: "901402:constant:2",
    cardCode: "901402",
    lines: ["901402:B:3"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table", when: NO_PLAYER_CONTROLS_ARWEN }],
  },

  // 901403 Uruk Elf-stalker (Ambush is a keyword). A:2: when it attacks and destroys a character, Arwen takes 1 damage, whoever controls or guards her. A:3 is a template.
  {
    id: "901403:forced:1",
    cardCode: "901403",
    lines: ["901403:A:2"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    condition: ATTACKER_IS_SELF,
    instructions: [{ verb: "Pick", pick: ARWEN_ANYWHERE }, { verb: "DamageCard", amount: 1, target: "picked" }],
  },

  // 901404 Goblin Trapper (Ambush is a keyword). A:2: the engaged player exhausts a ready character he controls, his choice (none ready: nothing). A:3: the Shadow adds it to the staging area (Goblin Spearman's 03031:A:2 in other words).
  {
    id: "901404:forced:1",
    cardCode: "901404",
    lines: ["901404:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }],
  },
  { id: "901404:shadow:1", cardCode: "901404", lines: ["901404:A:3"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },

  // 901405 Raiding Party (Ambush is a keyword). A:2: after it engages a player each player in turn, the first player first, discards the top card of the encounter deck, and the player whose card is an enemy with ambush makes an engagement check against it alone: it
  // leaves the discard pile and engages him when his threat reaches its cost (agent recommendation for where the enemy is).
  {
    id: "901405:forced:1",
    cardCode: "901405",
    lines: ["901405:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardTopEncounter", ambushCheck: true }] }],
  },

  // 901406 Vicious Trackers (Surge is a keyword). A:2: while engaged with a player, that player counts 20 more Threat in every engagement check (ambush, the encounter phase, an effect's), and none in an optional engagement; each copy adds.
  {
    id: "901406:constant:1",
    cardCode: "901406",
    lines: ["901406:A:2"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "engaged" },
    instructions: [{ verb: "ModifyStat", stat: "engagementThreat", amount: 20, until: "whileSourceInPlay", target: "engagedSeat" }],
  },

  // 901407 Treacherous Bluffs. A:1: whenever an enemy with the ambush keyword engages a player, in any phase, while the Bluffs is in the staging area or active, it gets +2 Threat until the end of the phase. A:2: the Shadow sends the excess damage of the attack to Arwen,
  // whoever controls or guards her; an undefended attack has none.
  {
    id: "901407:forced:1",
    cardCode: "901407",
    lines: ["901407:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: AMBUSH_ENEMY,
    condition: IN_STAGING_OR_ACTIVE,
    instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfPhase", target: "self" }],
  },
  { id: "901407:shadow:1", cardCode: "901407", lines: ["901407:A:2"], timing: "shadow", instructions: [{ verb: "ExcessToCard", name: "Arwen Undómiel" }] },

  // 901408 Concealed Woods. A:1: while active, the round's first enemy with the ambush keyword revealed from the encounter deck gains surge (the tally of Goblin Gate's, counted whether or not the Woods was active). A:2: the Shadow gives +2 Attack when the attacker is engaged with the first player.
  { id: "901408:constant:1", cardCode: "901408", lines: ["901408:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "FirstEnemyGains", keyword: "surge", withKeyword: "ambush" }] },
  { id: "901408:shadow:1", cardCode: "901408", lines: ["901408:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "firstPlayer" } }] },

  // 901409 Tumultuous Assault. A:1: each engaged enemy with the ambush keyword, any player's, returns to the staging area (no ambush check: it was in play); then the players make engagement checks against each enemy in the staging area, pass after pass, outside the encounter
  // phase; with no enemy with the ambush keyword in play it gains surge.
  {
    id: "901409:whenRevealed:1",
    cardCode: "901409",
    lines: ["901409:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ReturnToStaging", target: { kind: "engagedEnemies", keyword: "ambush", who: "each", pick: "all" } },
      { verb: "MakeEngagementChecks" },
      { verb: "GainSurge", when: { kind: "count", pick: { type: "enemy", control: "any", staging: true, keyword: "ambush" }, max: 0 } },
    ],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
