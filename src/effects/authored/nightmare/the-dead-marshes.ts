import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// The Dead Marshes Nightmare (deck 9008, data/printed/nightmare.json). The setup card bars every threat reduction, adds The Mere of Dead Faces to the staging area (it holds the tokens meant for Gollum while he is out of play and hands them over when he enters) and shuffles Gollum
// back into the encounter deck whenever he is placed in the discard pile. The deck prints no quest card. Its encounter cards make the escape tests cost more (Stagnant Quagmire adds to every test, Things in the Pools hurts each character that commits, Ill-fated Guard allows one committed
// character, Marsh-wight, Candles of Corpses and Swarming Mosquitos are tests of their own) and bring the Undead back (Devilry of the Dark Land, Lost Soul of Lórien).
// Rules: sotm.escape-test, rr.forced, rr.then, rr.destroy, rr.shadow-effects, rr.first-player, rr.setup (data/rules/entries.json); the readings are in docs/scenarios/shadows-of-mirkwood/the-dead-marshes.md (The Dead Marshes).
const GOLLUM_CODE = "02107";
const GOLLUM: PickSpec = { type: "objective", control: "any", names: ["Gollum"] };
const FAILED: Condition = { kind: "lastEscapeFailed" };
const ANY_CHARACTER: PickSpec = { type: "character", control: "any" };
const ATTACKER_UNDEAD: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Undead" } };

const tokens = (amount: number, when?: Condition) => ({ verb: "PlaceResourceTokens" as const, amount, code: GOLLUM_CODE, ...(when ? { when } : {}) });
const escapeValue = (code: string, amount: number, n = 1): Effect => ({ id: `${code}:constant:${n}`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "EscapeValue", amount }] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900801 The Dead Marshes Nightmare (setup card). A:1 prints nothing the engine reads. A:2: no threat reduction. A:3: The Mere of Dead Faces is found and added to the staging area, then the deck is shuffled. A:4: whenever Gollum is placed in the encounter discard pile
  // (dealt for an escape test, discarded by an effect) he is shuffled into the encounter deck; the Setup turns on the table's note of the discard (noteEncounterDiscards, as 900602 does).
  { id: "900801:constant:1", cardCode: "900801", lines: ["900801:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noThreatReduction", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "900801:setup:1", cardCode: "900801", lines: ["900801:A:3"], timing: "setup", instructions: [{ verb: "SearchToStaging", code: "900802" }, { verb: "ShuffleEncounterDeck" }, { verb: "ModifyStat", stat: "noteEncounterDiscards", amount: 1, until: "endOfGame", target: "table" }] },
  { id: "900801:forced:1", cardCode: "900801", lines: ["900801:A:4"], timing: "forced", trigger: "encounterDiscarded", subject: GOLLUM, instructions: [{ verb: "MoveEncounterCard", card: "subject", to: "shuffle" }] },

  // 900802 The Mere of Dead Faces. X, its Threat, is the resource tokens on it; it cannot leave the staging area. While Gollum is out of play the tokens meant for him go here. Forced: after Gollum enters play he gets 2 tokens, then every token here moves to him.
  {
    id: "900802:constant:1",
    cardCode: "900802",
    lines: ["900802:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  { id: "900802:constant:2", cardCode: "900802", lines: ["900802:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "redirectResources", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "900802:forced:1",
    cardCode: "900802",
    lines: ["900802:A:3"],
    timing: "forced",
    trigger: "encounterEnteredPlay",
    subject: GOLLUM,
    instructions: [tokens(2), { verb: "Pick", pick: { type: "location", control: "any", isSource: true } }, { verb: "Pick", pick: GOLLUM }, { verb: "MoveResources", all: true }],
  },

  // 900803 Stagnant Quagmire. While in play it adds its Escape value to every escape test (once for each copy). Escape 2. Shadow: the defending player makes an escape test dealing 1 card; failing discards the defending character.
  { id: "900803:constant:1", cardCode: "900803", lines: ["900803:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "escapeSelfValue", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  escapeValue("900803", 2, 2),
  {
    id: "900803:shadow:1",
    cardCode: "900803",
    lines: ["900803:A:3"],
    timing: "shadow",
    instructions: [{ verb: "EscapeTest", who: "actor", cards: 1 }, { verb: "Pick", pick: { type: "character", control: "any", defending: true }, when: FAILED }, { verb: "Discard", target: { kind: "picked" }, when: FAILED }],
  },

  // 900804 Things in the Pools. Forced: after a character commits to an escape test, 1 damage to it (each copy in play deals its own). Shadow: the attacking enemy gets +1 Attack, +2 if it is Undead.
  { id: "900804:forced:1", cardCode: "900804", lines: ["900804:A:1"], timing: "forced", trigger: "committedToEscape", subject: ANY_CHARACTER, instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] },
  {
    id: "900804:shadow:1",
    cardCode: "900804",
    lines: ["900804:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: ATTACKER_UNDEAD } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: ATTACKER_UNDEAD },
    ],
  },

  // 900805 Marsh-wight. Forced: after it engages a player, that player makes an escape test dealing 3 cards; failing puts 2 resource tokens on Gollum and the Marsh-wight makes an immediate attack.
  {
    id: "900805:forced:1",
    cardCode: "900805",
    lines: ["900805:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "EscapeTest", who: "actor", cards: 3 }, tokens(2, FAILED), { verb: "ImmediateAttack", when: FAILED }],
  },

  // 900806 Lost Soul of Lórien. Forced: after it is destroyed it attaches to a hero with 1 or more Willpower (the first player chooses among any player's, one copy to a hero), and stays in the discard pile if none can. Attached, it is a Condition that reduces the hero's Willpower to 0.
  { id: "900806:forced:1", cardCode: "900806", lines: ["900806:A:1"], timing: "forced", trigger: "enemyDestroyed", subject: "self", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "any", minWillpower: 1 } }] },
  { id: "900806:constant:1", cardCode: "900806", lines: ["900806:A:1"], timing: "constant", instructions: [{ verb: "SetStat", stat: "willpower", value: 0, target: "host" }, { verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },

  // 900807 Ill-fated Guard. While it is engaged with a player, that player cannot commit more than 1 character to each escape test. Shadow: every attachment on each character the defending player controls with 3 or more Willpower is discarded.
  { id: "900807:constant:1", cardCode: "900807", lines: ["900807:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "escapeCommitLimit", amount: 1, until: "whileSourceInPlay", target: "engagedSeat" }] },
  {
    id: "900807:shadow:1",
    cardCode: "900807",
    lines: ["900807:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Each", pick: { type: "attachment", control: "any", on: { type: "character", control: "you", minWillpower: 3 } }, instructions: [{ verb: "Discard", target: { kind: "picked" } }] }],
  },

  // 900808 Candles of Corpses. Each player in turn makes an escape test dealing 1 card; each who fails discards a hero they control or raises their own threat by 5. Escape 5.
  {
    id: "900808:whenRevealed:1",
    cardCode: "900808",
    lines: ["900808:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          { verb: "EscapeTest", who: "actor", cards: 1 },
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "discard", requires: { kind: "all", conditions: [FAILED, { kind: "canPick", pick: { type: "hero", control: "you" } }] }, instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },
              { id: "threat", requires: FAILED, instructions: [{ verb: "RaiseThreat", amount: 5, who: "actor" }] },
            ],
          },
        ],
      },
    ],
  },
  escapeValue("900808", 5),

  // 900809 Swarming Mosquitos. The first player makes an escape test counting Defense, dealing 2 cards; failing puts 1 resource token on Gollum and deals 1 damage to each character in play. Escape 3.
  { id: "900809:whenRevealed:1", cardCode: "900809", lines: ["900809:A:1"], timing: "whenRevealed", instructions: [{ verb: "EscapeTest", who: "firstPlayer", cards: 2, stat: "defense" }, tokens(1, FAILED), { verb: "DamageEach", amount: 1, pick: ANY_CHARACTER, when: FAILED }] },
  escapeValue("900809", 3),

  // 900810 Devilry of the Dark Land. The topmost X Undead enemies of the encounter discard pile return to the staging area, X the players; if none returned, it gains surge. Escape 10.
  { id: "900810:whenRevealed:1", cardCode: "900810", lines: ["900810:A:1"], timing: "whenRevealed", instructions: [{ verb: "ReturnFromDiscard", trait: "Undead", count: { players: true } }, { verb: "GainSurge", when: { kind: "noneReturned" } }] },
  escapeValue("900810", 10),
];

export const AUTHORED_REPLACES: readonly string[] = [];
