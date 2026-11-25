import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { timeOption } from "./time-option.ts";

// Records for The Fords of Isen (The Ring-maker part 1, The Voice of Isengard, no campaign card): Gríma and The Islet, the Fords of Isen locations, the encounter cards no template reads, the Dunland Warriors and Raiders whose lines count cards in hand and the three quest stages.
// Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. Time X is the angmar family's (src/catalog/families/angmar.ts: a constant `Time`, the Forced
// effect `lastTimeCounterRemoved`); a draw is heard by the dreamchaser family's `cardsDrawn`; the verbs the box adds are in src/catalog/families/ring-maker.ts.
// Rules: rm.time-x, rm.grima-objective-ally, rm.immune-to-player-card-effects, rr.forced, rr.drawing-cards, rr.first-player, rr.cannot, rr.attachment-cards, rr.quest-advancement, rr.constant-ability, rr.travel, rr.the-word-choose, rr.cancel, rr.search, rr.setup (data/rules/entries.json).
const GRIMA = "07016";
const DUNLAND: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Dunland" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
// "any player has 3 or more cards in hand" (07019, 07042) and 5 or more.
const HAND_3: Condition = { kind: "anyHand", min: 3 };
const HAND_5: Condition = { kind: "anyHand", min: 5 };
// The cards in the actor's hand: a Shadow effect's actor is the defending player, a Forced effect on an encounter card's is the player it happened to, a constant's the player the enemy is engaged with.
const HAND = { hand: true } as const;
const THREE_IN_HAND: Condition = { kind: "count", pick: { type: "card", control: "you", from: "hand" }, min: 3 };
// "Each player searches the encounter deck and discard pile for 1 different Dunland enemy and adds it to the staging area. Shuffle the encounter deck." (07060:B:1, 07061:A:1).
const SEARCH_DISCARD_TOO: Instruction[] = [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Dunland", to: "staging", different: true }]), { verb: "ShuffleEncounterDeck" }];
// "Attach to the current quest. (Counts as a Condition attachment with the text: ...)" (07045:A:2, 07049:A:2).
const attachesToQuest = (code: string, line: string): Effect[] => [
  { id: `${code}:whenRevealed:1`, cardCode: code, lines: [line], timing: "whenRevealed", instructions: [{ verb: "AttachToQuest" }] },
  { id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 07016 Gríma (objective ally). While free of encounters the first player gains control of him, as the first player token passes (the record of 18070:A:1); lying on The Islet he is attached to it, and the host leaving play sends him back to the staging area (`returnsToStagingArea`, families/objectives/claimed.ts) instead
  // of discarding him. Action: exhaust him to draw a card; as for any ally only the player who controls him may (a condition naming an ally the actor controls, as 06132:A:2). If he leaves play the players lose.
  { id: "07016:constant:1", cardCode: GRIMA, lines: ["07016:A:1"], timing: "constant", instructions: [{ verb: "GainControlWhenFree", who: "firstPlayer" }, { verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "07016:action:1", cardCode: GRIMA, lines: ["07016:A:2"], timing: "action", condition: { kind: "canPick", pick: { type: "ally", control: "you", names: ["Gríma"] } }, cost: { kind: "exhaustSelf" }, instructions: [{ verb: "Draw", amount: 1 }] },
  { id: "07016:triggered:1", cardCode: GRIMA, lines: ["07016:A:3"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "LoseGame" }] },

  // 07017 The Islet. While it is the active location each Dunland enemy in play, staged or engaged, gets +1 Threat.
  { id: "07017:constant:1", cardCode: "07017", lines: ["07017:A:2"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: DUNLAND }] },

  // 07018 Fords of Isen. In the staging area no card effect gives the players resources (the resource phase's collection is no card effect). Forced: when it becomes the active location each player draws up to 5 cards, one draw each.
  { id: "07018:constant:1", cardCode: "07018", lines: ["07018:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noCardResources", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "07018:forced:1", cardCode: "07018", lines: ["07018:A:2"], timing: "forced", holdsEvents: true, trigger: "becameActive", subject: "self", instructions: [EACH_PLAYER([{ verb: "Draw", amount: { hand: true, times: -1, plus: 5 } }])] },

  // 07019 The King's Road. +3 quest points while any player holds 3 cards; at 5 the players must travel to it, if able.
  { id: "07019:constant:1", cardCode: "07019", lines: ["07019:A:1"], timing: "constant", condition: HAND_3, instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 3, until: "whileSourceInPlay", target: "self" }] },
  { id: "07019:constant:2", cardCode: "07019", lines: ["07019:A:2"], timing: "constant", condition: { kind: "all", conditions: [IN_STAGING, HAND_5] }, instructions: [{ verb: "Restrict", what: "travelOnly" }] },

  // 07020 Gap of Rohan. In the staging area every Dunland enemy gets +1 Attack. Shadow: +1 Attack; if the attack destroys a character, a time counter comes off the current quest.
  { id: "07020:constant:1", cardCode: "07020", lines: ["07020:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: DUNLAND }] },
  {
    id: "07020:shadow:1",
    cardCode: "07020",
    lines: ["07020:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "RemoveTimeFromQuest", amount: 1, when: { kind: "x", min: 1 } }] }],
  },

  // 07021 Pillaging and Burning. Every player draws, then each raises his threat by the cards in his hand (the Forced effects of the draws resolve after the When Revealed). Shadow: the defending player discards an attachment, each of them if undefended.
  { id: "07021:whenRevealed:1", cardCode: "07021", lines: ["07021:A:1"], timing: "whenRevealed", holdsEvents: true, instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }]), EACH_PLAYER([{ verb: "RaiseThreat", amount: HAND, who: "actor" }])] },
  {
    id: "07021:shadow:1",
    cardCode: "07021",
    lines: ["07021:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "Pick", pick: { type: "attachment", control: "you" }, when: { kind: "not", condition: { kind: "undefended" } } },
      { verb: "DiscardPicked", when: { kind: "not", condition: { kind: "undefended" } } },
      { verb: "Each", pick: { type: "attachment", control: "you" }, instructions: [{ verb: "DiscardPicked" }], when: { kind: "undefended" } },
    ],
  },

  // 07022 Down from the Hills. Each player chooses: a time counter comes off the current quest, or he searches the encounter deck and discard pile for a Dunland enemy and reveals it into the staging area. The deck is shuffled. It cannot be canceled while any player holds 5 cards.
  {
    id: "07022:whenRevealed:1",
    cardCode: "07022",
    lines: ["07022:A:1"],
    timing: "whenRevealed",
    holdsEvents: true,
    uncancelable: HAND_5,
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            timeOption(),
            { id: "search", instructions: [{ verb: "SearchReveal", trait: "Dunland", type: "enemy", who: "actor", to: "staging" }] },
          ],
        },
      ]),
      { verb: "ShuffleEncounterDeck" },
    ],
  },

  // 07023 Ill Tidings. The first player draws it into his hand, where it stays; it gains surge when that hand holds 5 cards. It is no draw from a deck, so no Forced effect of a draw hears it.
  {
    id: "07023:whenRevealed:1",
    cardCode: "07023",
    lines: ["07023:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ActAs", who: "firstPlayer" }, { verb: "DrawSelfIntoHand" }, { verb: "GainSurge", when: { kind: "less", left: 4, right: HAND } }],
  },

  // 07042 Dunland Prowler. Surge while any player holds 3 cards; +1 Threat at 5.
  { id: "07042:constant:1", cardCode: "07042", lines: ["07042:A:1"], timing: "constant", condition: HAND_3, instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "07042:constant:2", cardCode: "07042", lines: ["07042:A:2"], timing: "constant", condition: HAND_5, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 07043 Dunlending Bandit. Engaged, +1 Attack for each card in the engaged player's hand. Shadow: +1 Attack, +2 instead when the defending player holds 3 cards.
  { id: "07043:constant:1", cardCode: "07043", lines: ["07043:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: HAND, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "07043:shadow:1",
    cardCode: "07043",
    lines: ["07043:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: THREE_IN_HAND } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: THREE_IN_HAND },
    ],
  },

  // 07044 Dunland Raider. Forced: when it engages a player, he assigns X damage among his characters, X the cards in his hand. Shadow: the defending player discards an attachment he controls.
  { id: "07044:forced:1", cardCode: "07044", lines: ["07044:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "AssignDamage", amount: HAND, pick: { type: "character", control: "you" } }] },
  { id: "07044:shadow:1", cardCode: "07044", lines: ["07044:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },

  // 07045 Old Hatreds and 07049 Wild Men of Dunland. Condition attachments on the current quest; each leaves with the stage it lies on. Forced: after a player draws any number of cards, that player raises his threat by 1 (07045); deals 1 damage to a character he controls (07049).
  ...attachesToQuest("07045", "07045:A:2"),
  { id: "07045:forced:1", cardCode: "07045", lines: ["07045:A:2"], timing: "forced", trigger: "cardsDrawn", instructions: [{ verb: "RaiseThreat", amount: 1, who: "actor" }] },
  ...attachesToQuest("07049", "07049:A:2"),
  { id: "07049:forced:1", cardCode: "07049", lines: ["07049:A:2"], timing: "forced", trigger: "cardsDrawn", instructions: [{ verb: "AssignDamage", amount: 1, pick: { type: "character", control: "you" } }] },

  // 07046 Dunland Tribesman. When Revealed: each player draws. Forced: after a player draws any number of cards it gets +1 Threat until the end of the round.
  { id: "07046:whenRevealed:1", cardCode: "07046", lines: ["07046:A:1"], timing: "whenRevealed", holdsEvents: true, instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }])] },
  { id: "07046:forced:1", cardCode: "07046", lines: ["07046:A:2"], timing: "forced", trigger: "cardsDrawn", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfRound", target: "self" }] },

  // 07047 Dunland Chieftain. Forced: when it engages a player, X cards from the top of the encounter deck are discarded, X the cards in his hand; the topmost Dunland enemy among them is put into play engaged with him.
  {
    id: "07047:forced:1",
    cardCode: "07047",
    lines: ["07047:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "DiscardEncounterTop", count: HAND }, { verb: "EngageTopDiscarded", trait: "Dunland" }],
  },

  // 07048 Dunland Berserker. Forced: after the player it is engaged with draws any number of cards, it makes an attack.
  { id: "07048:forced:1", cardCode: "07048", lines: ["07048:A:1"], timing: "forced", trigger: "cardsDrawn", condition: { kind: "engagedWithActor" }, instructions: [{ verb: "ImmediateAttack" }] },

  // 07059 Fight at the Fords. Setup: Gríma lies on The Islet, which the piles put into the staging area, and each player searches the encounter deck for a different Dunland enemy. Side B: Time 5; after the last counter Gríma is discarded; the players cannot advance unless the first player controls him.
  {
    id: "07059:setup:1",
    cardCode: "07059",
    lines: ["07059:A:1"],
    timing: "setup",
    instructions: [
      { verb: "AttachSetAsideTo", code: GRIMA, to: "The Islet", uncontrolled: true, claimed: true },
      EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Dunland", to: "staging", different: true, deckOnly: true }]),
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "07059:constant:1", cardCode: "07059", lines: ["07059:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 5 }] },
  { id: "07059:forced:1", cardCode: "07059", lines: ["07059:B:2"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "DiscardNamedFromPlay", name: "Gríma" }] },
  { id: "07059:constant:2", cardCode: "07059", lines: ["07059:B:3"], timing: "constant", condition: { kind: "not", condition: { kind: "controls", code: GRIMA } }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 07060 Dunlending Attack. Side B: each player searches for a different Dunland enemy; Time 2; after the last counter each player assigns X damage among his characters, X the cards in his hand, and 2 time counters go on the stage.
  { id: "07060:whenRevealed:1", cardCode: "07060", lines: ["07060:B:1"], timing: "whenRevealed", instructions: SEARCH_DISCARD_TOO },
  { id: "07060:constant:1", cardCode: "07060", lines: ["07060:B:2"], timing: "constant", instructions: [{ verb: "Time", amount: 2 }] },
  {
    id: "07060:forced:1",
    cardCode: "07060",
    lines: ["07060:B:3"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    instructions: [EACH_PLAYER([{ verb: "AssignDamage", amount: HAND, pick: { type: "character", control: "you" } }]), { verb: "PlaceResourceTokens", amount: 2, on: "self" }],
  },

  // 07061 Hold the Fords. Like stage 2 (the search is on side A); Time 3; after the last counter X cards are discarded from the top of the encounter deck, X the cards in the first player's hand, each enemy among them joins the staging area and 3 time counters go on the stage.
  // While any enemy is in play the players cannot defeat the stage; defeating it wins.
  { id: "07061:whenRevealed:1", cardCode: "07061", lines: ["07061:A:1"], timing: "whenRevealed", instructions: SEARCH_DISCARD_TOO },
  { id: "07061:constant:1", cardCode: "07061", lines: ["07061:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 3 }] },
  {
    id: "07061:forced:1",
    cardCode: "07061",
    lines: ["07061:B:2"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    instructions: [{ verb: "ActAs", who: "firstPlayer" }, { verb: "DiscardEncounterTop", count: HAND }, { verb: "StageDiscarded", type: "enemy" }, { verb: "PlaceResourceTokens", amount: 3, on: "self" }],
  },
  { id: "07061:constant:2", cardCode: "07061", lines: ["07061:B:3"], timing: "constant", condition: { kind: "enemyInPlay", is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "07061:questResolution:1", cardCode: "07061", lines: ["07061:B:3"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
