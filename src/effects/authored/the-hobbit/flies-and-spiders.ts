import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for Flies and Spiders (The Hobbit: On the Doorstep, deck Q0A.4): the 28 cards of its own set (132025 to 132034) and its four quest stages (132067 to 132070). The Wilderland set (132035 to 132038) belongs to the scenarios
// that share it. Poison, Venom and the unconscious state are the poison family's (src/rules/families/poison, src/catalog/families/poison.ts); the readings are in docs/scenarios/the-hobbit.md, Flies and Spiders.
// Every "player", "character" and "hero" of an encounter card is one of the players who share its staging area (`atStage`) once the stage splits the players (hob.staging-area-creating).
// Rules: hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, hob.staging-area-combining, hob.setup-flies-and-spiders, hob.immune-to-player-card-effects, rr.forced, rr.response, rr.active-location, rr.explored, rr.first-player,
// rr.defending-player, rr.attachment-cards, rr.reveal, rr.staging, rr.damage, rr.action, rr.cannot, rr.resources, rr.effects, mec109.multiple-staging-areas (data/rules/entries.json).
const BILBO = "Bilbo Baggins";
const QUEST_PHASE = { kind: "phase", is: "Quest" } as const;
const IN_ACTIVE_LOCATION = { kind: "sourceIn", zone: "activeLocation" } as const;
const EXPLORED = { kind: "subjectExplored" } as const;

// The characters of the players who share the source's staging area.
const CHARACTER_HERE: PickSpec = { type: "character", control: "any", atStage: true };
const POISONED_HERE: PickSpec = { ...CHARACTER_HERE, poisoned: true };
const UNCONSCIOUS_HERE: PickSpec = { ...CHARACTER_HERE, unconscious: true };
// "A hero he controls" and "a character you control" that can still be poisoned (an unconscious character cannot be, hob.unconscious-characters).
const MY_POISONABLE_HERO: PickSpec = { type: "hero", control: "you", unconscious: false };
const MY_POISONABLE_CHARACTER: PickSpec = { type: "character", control: "you", unconscious: false };
const MY_UNCONSCIOUS: PickSpec = { type: "character", control: "you", unconscious: true };
const COMMITTED_HERO_HERE: PickSpec = { type: "hero", control: "any", atStage: true, committed: true };
const PLAYERS_HERE: PickSpec = { type: "player", control: "any", atStage: true };
const THREE_OR_MORE = { kind: "count", pick: PLAYERS_HERE, min: 3 } as const;
const UNDEFENDED = { kind: "undefended" } as const;

const spiderSearch = (when?: typeof THREE_OR_MORE): Instruction => ({ verb: "SearchMove", type: "enemy", trait: "Spider", to: "staging", deckOnly: true, ...(when ? { when } : {}) });
const canPick = (pick: PickSpec) => ({ kind: "canPick" as const, pick });

// "Venom." The flag says the enemy has the keyword; the attack's damage reads it (rules/families/poison/venom.ts).
const VENOM: Effect = { id: "132028:constant:1", cardCode: "132028", lines: ["132028:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "venom", amount: 1, until: "whileSourceInPlay", target: "self" }] };

// "Unconscious characters cannot quest, attack, defend, collect resources, trigger abilities, be poisoned, or ready (except by effects that target unconscious characters)": the unconscious characters hold each bar while the stage is in play.
// An effect that targets an unconscious character readies it by ReadyUnconscious, which these bars do not reach.
const UNCONSCIOUS: PickSpec = { type: "character", control: "any", unconscious: true };
const bar = (stat: "cannotQuest" | "cannotAttack" | "cannotDefend" | "noCollection" | "cannotTriggerEffects" | "cannotTriggerForced" | "cannotBePoisoned" | "cannotReady"): Instruction => ({ verb: "ModifyStat", stat, amount: 1, until: "whileSourceInPlay", holders: UNCONSCIOUS });
const UNCONSCIOUS_BARS: Effect = {
  id: "132067:constant:1",
  cardCode: "132067",
  lines: ["132067:B:1"],
  timing: "constant",
  instructions: [bar("cannotQuest"), bar("cannotAttack"), bar("cannotDefend"), bar("noCollection"), bar("cannotTriggerEffects"), bar("cannotTriggerForced"), bar("cannotBePoisoned"), bar("cannotReady")],
};

// "Action: Spend 2 Baggins resources to ready an unconscious character you control."
const READY_ACTION: Effect = {
  id: "132069:action:1",
  cardCode: "132069",
  lines: ["132069:B:3"],
  timing: "action",
  cost: { kind: "resources", amount: 2, sphere: "baggins" },
  condition: canPick(MY_UNCONSCIOUS),
  instructions: [{ verb: "Pick", pick: MY_UNCONSCIOUS }, { verb: "ReadyUnconscious", target: "picked" }],
};

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 132025 The Spider's Glade (its Immune and Travel lines are templates). The first player of its area searches the encounter deck, not the discard pile; 2 Spiders with 3 or more players at the stage.
  {
    id: "132025:forced:1",
    cardCode: "132025",
    lines: ["132025:A:3"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: QUEST_PHASE,
    instructions: [spiderSearch(), spiderSearch(THREE_OR_MORE), { verb: "ShuffleEncounterDeck" }],
  },

  // 132026 Giant Web. Each character of the area's players gets -1 for each poison it has; the Response readies an unconscious character, chosen by the first player of the area.
  {
    id: "132026:constant:1",
    cardCode: "132026",
    lines: ["132026:A:1"],
    timing: "constant",
    condition: IN_ACTIVE_LOCATION,
    instructions: (["willpower", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: -1, until: "whileSourceInPlay", holders: POISONED_HERE, eachAttached: { type: "card", control: "any", poison: true } })),
  },
  {
    id: "132026:response:1",
    cardCode: "132026",
    lines: ["132026:A:2"],
    timing: "response",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "all", conditions: [EXPLORED, canPick(UNCONSCIOUS_HERE)] },
    instructions: [{ verb: "Pick", pick: { ...UNCONSCIOUS_HERE, who: "firstPlayer" } }, { verb: "ReadyUnconscious", target: "picked" }],
  },

  // 132027 Forest Stream. A poisoned character cannot be committed while it is the active location; the Response discards 4 poison, chosen one at a time by the first player among the poisoned characters of the area, fewer when fewer are there.
  {
    id: "132027:constant:1",
    cardCode: "132027",
    lines: ["132027:A:1"],
    timing: "constant",
    condition: IN_ACTIVE_LOCATION,
    instructions: [{ verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", holders: POISONED_HERE }],
  },
  {
    id: "132027:response:1",
    cardCode: "132027",
    lines: ["132027:A:2"],
    timing: "response",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "all", conditions: [EXPLORED, canPick(POISONED_HERE)] },
    instructions: [
      {
        verb: "Repeat",
        times: 4,
        instructions: [
          { verb: "Pick", pick: { ...POISONED_HERE, who: "firstPlayer" }, when: canPick(POISONED_HERE) },
          { verb: "DiscardPoison", amount: 1, target: "picked", when: canPick(POISONED_HERE) },
        ],
      },
    ],
  },

  // 132028 Old Tomnoddy. At the end of each round each player of its area, in player order, gives a hero he controls 1 poison; an unconscious hero cannot take it.
  VENOM,
  {
    id: "132028:forced:1",
    cardCode: "132028",
    lines: ["132028:A:2"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: MY_POISONABLE_HERO, when: canPick(MY_POISONABLE_HERO) }, { verb: "GivePoison", target: "picked", when: canPick(MY_POISONABLE_HERO) }] }],
  },

  // 132029 Crazy Cob. It attacks the player who controls the character with the most poison (the first player chooses among those tied), who then chooses his defender.
  copyLine("132028:A:1", "132029:A:1"),
  {
    id: "132029:whenRevealed:1",
    cardCode: "132029",
    lines: ["132029:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: { ...CHARACTER_HERE, mostPoison: true, who: "firstPlayer" } }, { verb: "AttackPickedPlayer" }],
  },
  { id: "132029:shadow:1", cardCode: "132029", lines: ["132029:A:3"], timing: "shadow", instructions: [{ verb: "GivePoison", target: "defender" }] },

  // 132030 Lazy Lob. Each committed character gets 1 poison, the controllers in player order; the shadow makes a poisoned defending character unconscious.
  copyLine("132028:A:1", "132030:A:1"),
  {
    id: "132030:whenRevealed:1",
    cardCode: "132030",
    lines: ["132030:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Each", pick: { type: "character", control: "you", committed: true }, instructions: [{ verb: "GivePoison", target: "picked" }] }] }],
  },
  {
    id: "132030:shadow:1",
    cardCode: "132030",
    lines: ["132030:A:3"],
    timing: "shadow",
    instructions: [{ verb: "MakeUnconscious", target: "defender", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", poisoned: true } } }],
  },

  // 132031 Fat Spider. +3 Attack while engaged with a player who controls a poisoned character; the shadow poisons the defender, or 2 poison to a character the defending player picks when undefended.
  copyLine("132028:A:1", "132031:A:1"),
  {
    id: "132031:constant:2",
    cardCode: "132031",
    lines: ["132031:A:2"],
    timing: "constant",
    condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "engaged" }, { kind: "count", pick: { type: "character", control: "you", poisoned: true }, min: 1 }] },
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "whileSourceInPlay", target: "self" }],
  },
  {
    id: "132031:shadow:1",
    cardCode: "132031",
    lines: ["132031:A:3"],
    timing: "shadow",
    instructions: [
      { verb: "GivePoison", target: "defender" },
      { verb: "Pick", pick: MY_POISONABLE_CHARACTER, when: { kind: "all", conditions: [UNDEFENDED, canPick(MY_POISONABLE_CHARACTER)] } },
      { verb: "GivePoison", amount: 2, target: "picked", when: { kind: "all", conditions: [UNDEFENDED, canPick(MY_POISONABLE_CHARACTER)] } },
    ],
  },

  // 132032 Wicked Spider. When it attacks, the defending player attaches 1 poison to a character he controls, before he declares a defender.
  copyLine("132028:A:1", "132032:A:1"),
  {
    id: "132032:forced:1",
    cardCode: "132032",
    lines: ["132032:A:2"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [{ verb: "Pick", pick: MY_POISONABLE_CHARACTER, when: canPick(MY_POISONABLE_CHARACTER) }, { verb: "GivePoison", target: "picked", when: canPick(MY_POISONABLE_CHARACTER) }],
  },
  { id: "132032:shadow:1", cardCode: "132032", lines: ["132032:A:3"], timing: "shadow", instructions: [{ verb: "GivePoison", amount: 2, target: "defender" }] },

  // 132033 Caught in Webs. The first player chooses a hero committed to the quest in the area; with none the card gains surge.
  {
    id: "132033:whenRevealed:1",
    cardCode: "132033",
    lines: ["132033:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: canPick(COMMITTED_HERO_HERE) } },
      { verb: "Pick", pick: { ...COMMITTED_HERO_HERE, who: "firstPlayer" }, when: canPick(COMMITTED_HERO_HERE) },
      { verb: "RemoveFromQuest", when: canPick(COMMITTED_HERO_HERE) },
      { verb: "MakeUnconscious", target: "picked" },
    ],
  },

  // 132034 Poisoned by Spiders. Each character of the area takes damage equal to its poison; surge when none is poisoned. The shadow discards an unconscious character the defending player controls.
  {
    id: "132034:whenRevealed:1",
    cardCode: "132034",
    lines: ["132034:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: canPick(POISONED_HERE) } },
      { verb: "Each", pick: POISONED_HERE, instructions: [{ verb: "DamageCard", amount: { poison: "picked" }, target: "picked" }] },
    ],
  },
  {
    id: "132034:shadow:1",
    cardCode: "132034",
    lines: ["132034:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: MY_UNCONSCIOUS, when: canPick(MY_UNCONSCIOUS) }, { verb: "Discard", target: { kind: "picked" }, when: canPick(MY_UNCONSCIOUS) }],
  },

  // 132067 Into Mirkwood. Setup: each player in turn may shuffle a copy of Bilbo's Magic Ring into his deck (the deal sets the copies and The Spider's Glade aside); then the encounter deck is shuffled and each player reveals 1 card.
  {
    id: "132067:setup:1",
    cardCode: "132067",
    lines: ["132067:A:1"],
    timing: "setup",
    instructions: [
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "shuffle", instructions: [{ verb: "ShuffleSetAsideIntoDeck", code: "132019" }] }, { id: "keep", instructions: [] }] }] },
      { verb: "ShuffleEncounterDeck" },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] },
    ],
  },
  UNCONSCIOUS_BARS,

  // 132068 Lost in the Dark. The first player takes stage 3 and a staging area of his own; the others advance to stage 4 in the shared area. Alone, the stage and its staging cards are discarded.
  {
    id: "132068:whenRevealed:1",
    cardCode: "132068",
    lines: ["132068:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "SplitToOwnStage", code: "132069" }, { verb: "AdvanceOtherPlayers", code: "132070" }],
  },

  // 132069 Captured by Spiders. 3A empties the resource pools of the first player's area and makes his characters but Bilbo unconscious; 3B freezes the first player token, holds its own defeat to the end of the quest phase, then joins him to stage 4.
  {
    id: "132069:whenRevealed:1",
    cardCode: "132069",
    lines: ["132069:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Each", pick: { type: "hero", control: "any", atStage: true, hasResources: true }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] },
      { verb: "Each", pick: { type: "character", control: "you", exceptNames: [BILBO] }, instructions: [{ verb: "MakeUnconscious", target: "picked" }] },
    ],
  },
  copyLine("132067:B:1", "132069:B:1"),
  {
    id: "132069:constant:2",
    cardCode: "132069",
    lines: ["132069:B:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "firstPlayerLocked", amount: 1, until: "whileSourceInPlay", target: "table" },
      { verb: "ModifyStat", stat: "holdsWin", amount: 1, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "132069:forced:1", cardCode: "132069", lines: ["132069:B:2"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "Delay", until: "beginningOfTravel", instructions: [{ verb: "JoinAtStage", code: "132070" }] }] },
  READY_ACTION,

  // 132070 Battle with the Spiders. Progress cannot be placed while The Spider's Glade is in play; defeating it wins the game (the Ring discovered is stored nowhere).
  copyLine("132067:B:1", "132070:B:1"),
  {
    id: "132070:constant:2",
    cardCode: "132070",
    lines: ["132070:B:2"],
    timing: "constant",
    condition: { kind: "inPlay", code: "132025", is: true },
    instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  copyLine("132069:B:3", "132070:B:3"),
  { id: "132070:constant:4", cardCode: "132070", lines: ["132070:B:4"], timing: "constant", instructions: [] },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
