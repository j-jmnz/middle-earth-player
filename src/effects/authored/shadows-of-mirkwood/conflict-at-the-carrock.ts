import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { ALWAYS } from "../conditions.ts";

// Records for Conflict at the Carrock (Shadows of Mirkwood part 2, standalone, no campaign card). Every line is read from the scan ledger (data/printed/shadows-of-mirkwood.json). The scenario is a fight with the four unique Trolls
// that Setup sets aside and stage 2B puts into the staging area: Grimbeorn's Quest makes The Carrock the active location at its 7th progress, Against the Trolls cannot be defeated while a Troll is in play (and its defeat wins
// the game on Normal and Easy). Grimbeorn the Old is an objective ally the players feed Leadership resources; "Sacked!" is a Condition attachment that takes a hero out of the game until a Troll is defeated.
// Rules: rr.active-location, rr.attachment-cards, rr.first-player, rr.forced, rr.response, rr.objective-cards, rr.search (data/rules/entries.json); the MEC03 rulesheet for Grimbeorn and The Carrock (docs/scenarios/shadows-of-mirkwood.md, Conflict at the Carrock).
const TROLL: PickSpec = { type: "enemy", control: "any", trait: "Troll", staging: true };
const SACKED: PickSpec = { type: "attachment", control: "any", names: ["Sacked!"] };
const HERO_WITH_SACKED: PickSpec = { type: "hero", control: "any", hasAttachment: { names: ["Sacked!"] } };
const CARROCK_STAGED: PickSpec = { type: "location", control: "any", stagingOnly: true, names: ["The Carrock"] };
const CREATURE_ALLY: PickSpec = { type: "ally", control: "you", trait: "Creature" };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const ENGAGED: Condition = { kind: "sourceIn", zone: "engaged" };
const TROLLS_SET_ASIDE = ["02038", "02039", "02040", "02041"] as const;
// "Response: After defeating X, you may choose and discard 1 'Sacked!' card from play" (02038..02041, 900501:A:5): the card is an encounter card, so "you" is the player the defeated enemy was engaged with (`answeredBy`); nothing to discard, no offer.
const DISCARD_SACKED: Pick<Effect, "answeredBy" | "condition" | "instructions"> = { answeredBy: "eventSeat", condition: { kind: "canPick", pick: SACKED }, instructions: [{ verb: "Pick", pick: SACKED }, { verb: "Discard", target: { kind: "picked" } }] };
const THREAT_STAT = (stat: "attack" | "defense"): Effect["instructions"] => [{ verb: "ModifyStat", stat, amount: 1, until: "whileSourceInPlay", holders: TROLL }];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 02035 Grimbeorn's Quest. Setup: The Carrock and the four unique Trolls and four Sacked! are already placed by the piles; one Sacked! for each player is shuffled back into the encounter deck. Forced: after the 7th progress, The Carrock
  // (in the staging area) becomes the active location and the previous active location is discarded.
  {
    id: "02035:setup:1",
    cardCode: "02035",
    lines: ["02035:A:1"],
    timing: "setup",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: "02048" }] }, { verb: "ShuffleEncounterDeck" }],
  },
  {
    id: "02035:forced:1",
    cardCode: "02035",
    lines: ["02035:B:1"],
    timing: "forced",
    trigger: "questCardDefeated",
    subject: "self",
    instructions: [{ verb: "Discard", target: { kind: "activeLocation" } }, { verb: "Pick", pick: CARROCK_STAGED, when: { kind: "canPick", pick: CARROCK_STAGED } }, { verb: "MakeActive", when: { kind: "canPick", pick: CARROCK_STAGED } }],
  },
  // 02036 Against the Trolls. When Revealed: the unique Trolls set aside enter the staging area. The stage cannot be defeated while a Troll enemy is in play, in the staging area or engaged.
  {
    id: "02036:whenRevealed:1",
    cardCode: "02036",
    lines: ["02036:B:1"],
    timing: "whenRevealed",
    instructions: TROLLS_SET_ASIDE.map((code) => ({ verb: "AddSetAsideToStaging" as const, code })),
  },
  { id: "02036:constant:1", cardCode: "02036", lines: ["02036:B:2"], timing: "constant", condition: { kind: "enemyInPlay", trait: "Troll", is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  // 02037 Grimbeorn the Old (objective ally). He does not exhaust to defend against Trolls. With 8 resource tokens he joins the first player's play area. Action: any player spends 1 Leadership resource and places it on him.
  {
    id: "02037:constant:1",
    cardCode: "02037",
    lines: ["02037:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "noExhaustDefendVersus", amount: 1, until: "whileSourceInPlay", target: "self", when: { kind: "defendingAgainst", trait: "Troll" } }],
  },
  { id: "02037:constant:2", cardCode: "02037", lines: ["02037:A:2"], timing: "constant", condition: { kind: "tokens", code: "02037", min: 8 }, instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self", intoPlay: true }] },
  {
    id: "02037:action:1",
    cardCode: "02037",
    lines: ["02037:A:3"],
    timing: "action",
    anyPlayer: true,
    cost: { kind: "resources", amount: 1, sphere: "leadership" },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }],
  },
  // 02038 Louis. While engaged, every Troll enemy raises the defending player's threat by 3 after it attacks. Response: after he is defeated, a Sacked! in play may be discarded.
  { id: "02038:forced:1", cardCode: "02038", lines: ["02038:A:1"], timing: "forced", trigger: "attackResolved", subject: TROLL, condition: ENGAGED, instructions: [{ verb: "RaiseThreat", amount: 3, who: "eventSeat" }] },
  { id: "02038:response:1", cardCode: "02038", lines: ["02038:A:2"], timing: "response", trigger: "enemyDestroyed", subject: "self", ...DISCARD_SACKED },
  // 02039 Morris. While engaged, Troll enemies get +1 Attack. 02040 Stuart: +1 Defense. 02041 Rupert. Forced: after he attacks, every Sacked! in the encounter discard pile is shuffled back into the encounter deck.
  { id: "02039:constant:1", cardCode: "02039", lines: ["02039:A:1"], timing: "constant", condition: ENGAGED, instructions: THREAT_STAT("attack") },
  { id: "02039:response:1", cardCode: "02039", lines: ["02039:A:2"], timing: "response", trigger: "enemyDestroyed", subject: "self", ...DISCARD_SACKED },
  { id: "02040:constant:1", cardCode: "02040", lines: ["02040:A:1"], timing: "constant", condition: ENGAGED, instructions: THREAT_STAT("defense") },
  { id: "02040:response:1", cardCode: "02040", lines: ["02040:A:2"], timing: "response", trigger: "enemyDestroyed", subject: "self", ...DISCARD_SACKED },
  { id: "02041:forced:1", cardCode: "02041", lines: ["02041:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", instructions: [{ verb: "ShuffleIntoDeck", code: "02048", each: true }] },
  { id: "02041:response:1", cardCode: "02041", lines: ["02041:A:2"], timing: "response", trigger: "enemyDestroyed", subject: "self", ...DISCARD_SACKED },
  // 02042 Muck Adder. Forced: a character its attack damaged is discarded from play (damage that was canceled is not damage). Shadow: the defending character gets -1 Defense for the attack.
  { id: "02042:forced:1", cardCode: "02042", lines: ["02042:A:1"], timing: "forced", trigger: "attackDamagedCharacter", subject: "self", instructions: [{ verb: "Discard", target: { kind: "other" } }] },
  { id: "02042:shadow:1", cardCode: "02042", lines: ["02042:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfAttack", target: "defender" }] },
  // 02043 The Carrock (Immune to player card effects is a keyword). The players cannot travel to it; while it is the active location Troll enemies get +1 Attack and +1 Defense.
  { id: "02043:constant:1", cardCode: "02043", lines: ["02043:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", location: "02043" }] },
  { id: "02043:constant:2", cardCode: "02043", lines: ["02043:A:3"], timing: "constant", condition: ACTIVE, instructions: [...THREAT_STAT("attack"), ...THREAT_STAT("defense")] },
  // 02044 River Langflood. In the staging area it gets +1 Threat for each Troll enemy in play.
  { id: "02044:constant:1", cardCode: "02044", lines: ["02044:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: TROLL }, until: "whileSourceInPlay", target: "self" }] },
  // 02045 Bee Pastures. Response: after the players travel there, Grimbeorn the Old is fetched from the encounter deck or discard pile into the staging area, and the deck is shuffled.
  { id: "02045:response:1", cardCode: "02045", lines: ["02045:A:1"], timing: "response", trigger: "traveled", instructions: [{ verb: "SearchMove", code: "02037", to: "staging" }, { verb: "ShuffleEncounterDeck" }] },
  // 02046 Oak-wood Grove. While it is the active location every hero's resources may be spent as Leadership resources (a payment allowance, no icon): they pay Leadership costs (Grimbeorn's Action and Leadership cards).
  { id: "02046:constant:1", cardCode: "02046", lines: ["02046:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "paysAsLeadership", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any" } }] },
  // 02047 A Frightened Beast. Each player in turn from the first player may discard a Creature ally he controls to cancel the effect; otherwise every player raises his threat by the total Threat in the staging area.
  {
    id: "02047:whenRevealed:1",
    cardCode: "02047",
    lines: ["02047:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "discard", requires: { kind: "canPick", pick: CREATURE_ALLY }, instructions: [{ verb: "Pick", pick: CREATURE_ALLY }, { verb: "DiscardPicked" }, { verb: "CancelEffect" }] },
              { id: "keep", instructions: [] },
            ],
          },
        ],
      },
      { verb: "RaiseThreat", amount: { stagingThreat: true }, who: "eachSeat" },
    ],
  },
  // 02048 Sacked!. When Revealed (it cannot be canceled): it attaches to a hero without a Sacked! controlled by the first player, who chooses it; with none it is discarded. As a Condition attachment the hero cannot attack, defend, quest,
  // trigger its Actions and Responses, or collect resources. Shadow: against a Troll the card's When Revealed effect resolves.
  { id: "02048:whenRevealed:1", cardCode: "02048", lines: ["02048:A:1"], timing: "whenRevealed", uncancelable: ALWAYS, instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "firstPlayer" } }] },
  {
    id: "02048:constant:1",
    cardCode: "02048",
    lines: ["02048:A:1"],
    timing: "constant",
    instructions: [
      { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
      { verb: "AttachesTo", host: { kind: "hero" }, limitPerHost: true },
      { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotDefend", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotTriggerEffects", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "noCollection", amount: 1, until: "whileSourceInPlay", target: "host" },
    ],
  },
  {
    id: "02048:shadow:1",
    cardCode: "02048",
    lines: ["02048:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ResolveWhenRevealed", card: "self", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Troll" } } }],
  },
  // 02049 Roasted Slowly. When Revealed: every hero with a Sacked! attached (any player's) is destroyed, then it is shuffled back into the encounter deck. Shadow: against a Troll, 2 damage comes off the attacker.
  {
    id: "02049:whenRevealed:1",
    cardCode: "02049",
    lines: ["02049:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Each", pick: HERO_WITH_SACKED, instructions: [{ verb: "Destroy", target: { kind: "picked" } }] }, { verb: "MoveEncounterCard", card: "self", to: "shuffle" }],
  },
  {
    id: "02049:shadow:1",
    cardCode: "02049",
    lines: ["02049:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Heal", amount: 2, target: "attacker", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Troll" } } }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
