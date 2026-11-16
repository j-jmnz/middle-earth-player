import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as STORM } from "../a-storm-on-cobas-haven.ts";
import { AUTHORED_EFFECTS as OATH } from "../the-oath.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Hunt for Gollum (Shadows of Mirkwood part 1, standalone, no campaign card). Every line is read from the scan ledger (data/printed/shadows-of-mirkwood.json). The Signs of Gollum are the four Clue objectives: revealed
// Guarded, claimed by a Response to the players questing successfully (the claimed card counts as a Condition attachment on a hero committed to the quest, with the Forced return the card prints in brackets), counted by the Clue traits of
// the other cards. On the Trail holds the players to a hero with a Clue attached and resets the quest deck to stage 2B when none is left (rules/families/quest/reset.ts).
// Rules: rr.guarded, rr.objective-cards, rr.attachment-cards, rr.first-player, rr.forced, rr.response, rr.search, sotm.reset-the-quest-deck (data/rules/entries.json); the MEC02 rulesheet for the Signs (docs/brief.md, The Hunt for Gollum).
const CLUE: PickSpec = { type: "objective", control: "any", trait: "Clue" };
const HERO_WITH_CLUE: PickSpec = { type: "hero", control: "any", hasAttachment: { trait: "Clue" } };
const YOUR_HERO_WITH_CLUE: PickSpec = { type: "hero", control: "you", hasAttachment: { trait: "Clue" } };
const COMMITTED_HERO: PickSpec = { type: "hero", control: "any", questedThisRound: true };
const RIVERLAND: PickSpec = { type: "location", control: "any", trait: "Riverland" };
// "If you do not control at least 1 hero with a Clue card attached" (the East and West Bank shadows).
const NO_CLUE_HERO: Condition = { kind: "not", condition: { kind: "canPick", pick: YOUR_HERO_WITH_CLUE } };
const NOT_UNDEFENDED: Condition = { kind: "not", condition: { kind: "undefended" } };
const UNDEFENDED: Condition = { kind: "undefended" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 02011 The Hunt Begins. Setup: 1 card per player. Forced after the players quest successfully: the first player looks at the top 3, reveals 1 and discards the other 2 (the others are discarded before the reveal, so a Guarded card does not take
    // one of them as its guard).
    { id: "02011:setup:1", cardCode: "02011", lines: ["02011:A:1"], timing: "setup", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }] },
    {
      id: "02011:forced:1",
      cardCode: "02011",
      lines: ["02011:B:1"],
      timing: "forced",
      trigger: "questSucceeded",
      condition: { kind: "firstPlayer" },
      instructions: [{ verb: "LookAtTop", count: 3 }, { verb: "PickEncounter", from: "looked" }, { verb: "DiscardOtherLooked" }, { verb: "RevealEncounter" }],
    },
    // 02012 A New Terror Abroad. Forced at the beginning of the quest phase: the first player looks at the top 2, reveals 1 and discards the other.
    {
      id: "02012:forced:1",
      cardCode: "02012",
      lines: ["02012:B:1"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Quest" },
      instructions: [{ verb: "LookAtTop", count: 2 }, { verb: "PickEncounter", from: "looked" }, { verb: "DiscardOtherLooked" }, { verb: "RevealEncounter" }],
    },
    // 02013 On the Trail. A player who controls no hero with a Clue attached cannot commit characters; with no hero holding a Clue in play, the quest deck resets to stage 2B (the settle sweep, rules/families/quest/reset.ts). The last stage's defeat wins.
    { id: "02013:constant:1", cardCode: "02013", lines: ["02013:B:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "commit", unlessControls: YOUR_HERO_WITH_CLUE }] },
    {
      id: "02013:constant:2",
      cardCode: "02013",
      lines: ["02013:B:1"],
      timing: "constant",
      condition: { kind: "not", condition: { kind: "canPick", pick: HERO_WITH_CLUE } },
      instructions: [{ verb: "ReturnToStage", stage: 2 }],
    },
    { id: "02013:constant:3", cardCode: "02013", lines: ["02013:B:2"], timing: "constant", instructions: [] },
    // 02014 Signs of Gollum. Guarded. The players claim it in a Response to the quest just resolved (the first player names a hero committed to it); it counts as a Condition attachment, and returns to the top of the encounter deck when its hero
    // leaves play (the flag returnsToEncounterDeck, rules/families/objectives/claimed.ts) or is damaged (the Forced effect below).
    copyLine("12134:A:1", "02014:A:1"),
    {
      id: "02014:response:1",
      cardCode: "02014",
      lines: ["02014:A:2"],
      timing: "response",
      trigger: "questSucceeded",
      eventSeat: "you",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "freeOfEncounters" }, { kind: "questSucceeded" }, { kind: "canPick", pick: COMMITTED_HERO }] },
      instructions: [{ verb: "Pick", pick: COMMITTED_HERO }, { verb: "ClaimObjective" }],
    },
    {
      id: "02014:constant:1",
      cardCode: "02014",
      lines: ["02014:A:2"],
      timing: "constant",
      instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "returnsToEncounterDeck", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "02014:forced:1", cardCode: "02014", lines: ["02014:A:2"], timing: "forced", trigger: "damaged", subject: "host", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "deckTop" }] },
    // 02015 The Old Ford. X is the number of ally cards in play. Shadow: every ally with a printed cost lower than the number of Riverland locations in play is discarded from play (a card with no printed cost or an X cost has printed cost 0).
    {
      id: "02015:constant:1",
      cardCode: "02015",
      lines: ["02015:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "card", control: "any", cardType: "ally" } }, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "02015:shadow:1",
      cardCode: "02015",
      lines: ["02015:A:2"],
      timing: "shadow",
      instructions: [
        {
          verb: "Each",
          pick: { type: "ally", control: "any" },
          instructions: [{ verb: "Discard", target: { kind: "picked" }, when: { kind: "less", left: { stat: "cost", of: "picked" }, right: { count: RIVERLAND } } }],
        },
      ],
    },
    // 02016 The Eaves of Mirkwood.
    copyLine("41010:A:1", "02016:A:1"),
    // 02017 River Ninglor. At the end of each round, while it is the active location, 1 progress comes off it and off the current quest. Shadow: 1 progress off the current quest (2 if the attack is undefended).
    {
      id: "02017:forced:1",
      cardCode: "02017",
      lines: ["02017:A:1"],
      timing: "forced",
      trigger: "endOfRound",
      condition: ACTIVE,
      instructions: [{ verb: "RemoveProgressFrom", amount: 1, target: "self" }, { verb: "RemoveProgressFromQuest", amount: 1 }],
    },
    {
      id: "02017:shadow:1",
      cardCode: "02017",
      lines: ["02017:A:2"],
      timing: "shadow",
      instructions: [{ verb: "RemoveProgressFromQuest", amount: 1, when: NOT_UNDEFENDED }, { verb: "RemoveProgressFromQuest", amount: 2, when: UNDEFENDED }],
    },
    // 02018 The East Bank. While active, ally cards cost 1 more to play from hand. Shadow: with no Clue hero, the enemy returns to the staging area after its attack.
    {
      id: "02018:constant:1",
      cardCode: "02018",
      lines: ["02018:A:1"],
      timing: "constant",
      condition: ACTIVE,
      instructions: [{ verb: "IncreaseCost", amount: 1, fromHand: true, pick: { type: "card", control: "any", cardType: "ally" } }],
    },
    { id: "02018:shadow:1", cardCode: "02018", lines: ["02018:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: NO_CLUE_HERO, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
    // 02019 The West Bank. While active, attachment and event cards cost 1 more to play from hand. Shadow: with no Clue hero, the attacking enemy gets its printed Attack again for this attack (its base Attack doubled).
    {
      id: "02019:constant:1",
      cardCode: "02019",
      lines: ["02019:A:1"],
      timing: "constant",
      condition: ACTIVE,
      instructions: [
        { verb: "IncreaseCost", amount: 1, fromHand: true, pick: { type: "card", control: "any", cardType: "attachment" } },
        { verb: "IncreaseCost", amount: 1, fromHand: true, pick: { type: "card", control: "any", cardType: "event" } },
      ],
    },
    {
      id: "02019:shadow:1",
      cardCode: "02019",
      lines: ["02019:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "attack", of: "attacker", printed: true }, until: "endOfAttack", target: "attacker", when: NO_CLUE_HERO }],
    },
    // 02020 Goblintown Scavengers: printed as Goblintown Scavengers (41022:A:1) but for the apostrophe.
    {
      id: "02020:whenRevealed:1",
      cardCode: "02020",
      lines: ["02020:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SetX", value: 0 }, { verb: "DiscardTopOfDeck" }, { verb: "ModifyStat", stat: "threat", amount: { x: true }, until: "endOfPhase", target: "self" }] }],
    },
    // 02021 Hunters from Mordor. +2 Attack and +2 Threat for each Clue card in play, wherever it lies in play (a Clue dealt as a shadow card is not in play). Shadow: 1 damage to each hero with a Clue attached (3 if undefended).
    {
      id: "02021:constant:1",
      cardCode: "02021",
      lines: ["02021:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: { count: CLUE, times: 2 }, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "threat", amount: { count: CLUE, times: 2 }, until: "whileSourceInPlay", target: "self" },
      ],
    },
    {
      id: "02021:shadow:1",
      cardCode: "02021",
      lines: ["02021:A:2"],
      timing: "shadow",
      instructions: [{ verb: "DamageEach", amount: 1, pick: HERO_WITH_CLUE, when: NOT_UNDEFENDED }, { verb: "DamageEach", amount: 3, pick: HERO_WITH_CLUE, when: UNDEFENDED }],
    },
    // 02022 False Lead. Surge when no Clue card is in play (read before the shuffle); the first player shuffles a Clue card back into the encounter deck, its guards staying in the staging area.
    {
      id: "02022:whenRevealed:1",
      cardCode: "02022",
      lines: ["02022:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: CLUE } } },
        { verb: "Pick", pick: { ...CLUE, who: "firstPlayer" } },
        { verb: "ReleaseGuards" },
        { verb: "MoveEncounterCard", card: "picked", to: "shuffle" },
      ],
    },
    // 02023 Flooding (Doomed 1, Surge): all progress comes off every Riverland location. Shadow: resolve the When Revealed effect.
    { id: "02023:whenRevealed:1", cardCode: "02023", lines: ["02023:A:2"], timing: "whenRevealed", instructions: [{ verb: "RemoveAllProgress", pick: RIVERLAND }] },
    { id: "02023:shadow:1", cardCode: "02023", lines: ["02023:A:3"], timing: "shadow", instructions: [{ verb: "ResolveWhenRevealed", card: "self" }] },
    // 02024 Old Wives' Tales: each hero discards 1 resource from its pool; one with none to discard exhausts.
    {
      id: "02024:whenRevealed:1",
      cardCode: "02024",
      lines: ["02024:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Each",
          pick: { type: "hero", control: "any" },
          instructions: [
            { verb: "Exhaust", target: { kind: "picked" }, when: { kind: "not", condition: { kind: "matches", card: "picked", pick: { type: "hero", control: "any", hasResources: true } } } },
            { verb: "DiscardResources", amount: 1, target: "picked" },
          ],
        },
      ],
    },
  ],
  { pool: [...STORM, ...OATH] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
