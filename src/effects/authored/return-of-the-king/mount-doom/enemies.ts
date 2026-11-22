import { copyLine, type Copy } from "../../reprint.ts";
import type { Effect } from "../../../../catalog/boundary.ts";

import { EACH_PLAYER, WHEN_CAN_PICK } from "../black-gate/shared.ts";
import { EACH_PLAYER_TESTS, GOLLUM, GOLLUM_IN_PLAY, IN_STAGING, LAST_FORTITUDE_FAILED, THE_ONE_RING_IS_EXHAUSTED, YOU_FAILED_THIS_ROUND } from "./shared.ts";

// Records for the enemies and treacheries of Mount Doom (146049 to 146057; Surge, Peril and Immune to non-Fellowship are keywords or records of Gollum). Every line is read from the scan ledger (data/printed/the-return-of-the-king.json). See docs/scenarios/the-return-of-the-king.md, The Return of the King, for each reading.
// Rules: mec113.fortitude-tests, mec113.immune-to-player-card-effects, mec113.peril, rr.forced, rr.first-player, rr.the-word-choose, rr.attachment-cards, faq.lasting-effects, faq.peril-attacks, faq.additional-attacks (data/rules/entries.json).
const DISCARDED_FOR_THE_TEST = { type: "card", control: "any", fortitudeDiscarded: true, who: "firstPlayer" } as const;
const ATTACHMENTS_ON_HOST = { type: "card", control: "any", attachedTo: "host", nonObjective: true } as const;

export const ENEMY_RECORDS: readonly (Effect | Copy)[] = [
  // 146049 Gollum (Surge is a keyword). Immune to non-Fellowship player card effects. He engages the first player, as he comes into play, when the first player token passes (the Forced of 144075 on the token pass) and when he is returned to the staging area.
  // Forced: after he is discarded during a Fortitude test, once the test's cards are all discarded he comes into play engaged with the first player, who then chooses an encounter card discarded for the test (still in the discard pile): its icons are not counted.
  { id: "146049:constant:1", cardCode: GOLLUM, lines: ["146049:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToNonFellowship", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "146049:forced:1", cardCode: GOLLUM, lines: ["146049:A:2"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "EngageFirstPlayer" }] },
  { id: "146049:triggered:1", cardCode: GOLLUM, lines: ["146049:A:2"], timing: "triggered", trigger: "firstPlayerTokenPassed", instructions: [{ verb: "FollowFirstPlayer" }] },
  {
    id: "146049:forced:3",
    cardCode: GOLLUM,
    lines: ["146049:A:3"],
    timing: "forced",
    trigger: "discardedInFortitude",
    subject: "self",
    instructions: [
      EACH_PLAYER([{ verb: "MoveEncounterCard", card: "self", to: "engaged", when: { kind: "all", conditions: [{ kind: "matches", card: "self", inPlay: false }, { kind: "firstPlayer" }] } }]),
      { verb: "Pick", pick: DISCARDED_FOR_THE_TEST, ...WHEN_CAN_PICK(DISCARDED_FOR_THE_TEST) },
      { verb: "IgnoreFortitudeEyes", ...WHEN_CAN_PICK(DISCARDED_FOR_THE_TEST) },
    ],
  },
  // The unprefixed line is a passive: he follows the first player token and engages again at once when an effect returns him to the staging area (the trigger returnedToStaging, which a game reads only when a record names it).
  { id: "146049:forced:2", cardCode: GOLLUM, lines: ["146049:A:2"], timing: "forced", trigger: "returnedToStaging", subject: "self", instructions: [{ verb: "EngageFirstPlayer" }] },

  // 146050 Ringwraith of Sauron (A:1 is a template). While it is in the staging area it gains the Forced "after a player fails a Fortitude test, it engages that player and makes an immediate attack": the test's failure is heard before the card that made the test goes on.
  {
    id: "146050:forced:1",
    cardCode: "146050",
    lines: ["146050:A:2"],
    timing: "forced",
    trigger: "fortitudeFailed",
    condition: IN_STAGING,
    instructions: [{ verb: "Engage", target: "self" }, { verb: "ImmediateAttack", when: { kind: "sourceIn", zone: "engaged" } }],
  },

  // 146051 Orc Captain. Forced: after it engages you, you make a Fortitude test; if you fail it the top card of the encounter deck is revealed (you are the revealing player). Shadow: if the attack destroys a character it returns to the staging area (copied from Morgul Captain).
  { id: "146051:forced:1", cardCode: "146051", lines: ["146051:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "FortitudeTest" }, { verb: "RevealEncounter", who: "actor", when: LAST_FORTITUDE_FAILED }] },
  copyLine("145053:A:3", "146051:A:2"),

  // 146052 Big Uruk. Forced: after it engages you, either raise your threat by 4 or it makes an immediate attack against you. Shadow: the attacking enemy gets +1 Attack for each ally you (the defending player) control.
  { id: "146052:forced:1", cardCode: "146052", lines: ["146052:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 4, who: "actor" }] }, { id: "attack", instructions: [{ verb: "ImmediateAttack" }] }] }] },
  { id: "146052:shadow:1", cardCode: "146052", lines: ["146052:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: { type: "ally", control: "you" } }, until: "endOfAttack", target: "attacker" }] },

  // 146053 Little Snuffler (Peril and Surge are keywords). When Revealed: either raise your threat by 1 for each ally you control, or discard an ally you control (not offered with no ally). Shadow: exhaust a character you control (copied from Driven to the Brink).
  {
    id: "146053:whenRevealed:1",
    cardCode: "146053",
    lines: ["146053:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "ally", control: "you" } }, who: "actor" }] },
          { id: "discard", requires: { kind: "canPick", pick: { type: "ally", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "DiscardPicked" }] },
        ],
      },
    ],
  },
  copyLine("145042:A:3", "146053:A:3"),

  // 146054 'Wicked Master!'. When Revealed: Gollum makes an immediate attack against the first player; then, if Gollum is not in play, the encounter deck and discard pile are searched for him and he comes into play engaged with the first player (a Gollum fetched this way does not attack:
  // the lines' order). Shadow: if the attacking enemy is Gollum he makes an additional attack after this one (dealt a new shadow card, its old ones discarded first, faq.additional-attacks).
  {
    id: "146054:whenRevealed:1",
    cardCode: "146054",
    lines: ["146054:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: GOLLUM_IN_PLAY, ...WHEN_CAN_PICK(GOLLUM_IN_PLAY) },
      { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true, ...WHEN_CAN_PICK(GOLLUM_IN_PLAY) },
      { verb: "SearchMove", code: GOLLUM, to: "engagedFirstPlayer", when: { kind: "not", condition: { kind: "canPick", pick: GOLLUM_IN_PLAY } } },
    ],
  },
  {
    id: "146054:shadow:1",
    cardCode: "146054",
    lines: ["146054:A:2"],
    timing: "shadow",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }], when: { kind: "matches", card: "attacker", pick: GOLLUM_IN_PLAY } }],
  },

  // 146055 The Lidless Eye (Peril is a keyword). When Revealed: you make a Fortitude test with two more Sauron's Eye icons while The One Ring is exhausted (checked as the test is made); if you fail it you raise your threat by 10. Shadow: +1 Attack, or +2 Attack instead if you failed a Fortitude test this round.
  {
    id: "146055:whenRevealed:1",
    cardCode: "146055",
    lines: ["146055:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "FortitudeTest", extraEyes: { amount: 2, when: THE_ONE_RING_IS_EXHAUSTED } }, { verb: "RaiseThreat", amount: 10, who: "actor", when: LAST_FORTITUDE_FAILED }],
  },
  {
    id: "146055:shadow:1",
    cardCode: "146055",
    lines: ["146055:A:3"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: YOU_FAILED_THIS_ROUND },
    ],
  },

  // 146056 Foul Fumes. When Revealed: each player, in player order, makes a Fortitude test and, if he fails it, deals 1 damage to each character he controls; then until the end of the round the printed text box of each damaged character is blank except for Traits (read live: faq.lasting-effects).
  // Shadow: if you failed a Fortitude test this round the attack is considered undefended.
  {
    id: "146056:whenRevealed:1",
    cardCode: "146056",
    lines: ["146056:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER_TESTS([{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "you" }, when: LAST_FORTITUDE_FAILED }]), { verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", target: "damagedCharacters" }],
  },
  { id: "146056:shadow:1", cardCode: "146056", lines: ["146056:A:2"], timing: "shadow", instructions: [{ verb: "ConsiderUndefended", when: YOU_FAILED_THIS_ROUND }] },

  // 146057 Heavy and Tired. When Revealed: it attaches to the hero with the most attachments (the first player chooses among ties) and exhausts that hero. It counts as a Condition attachment whose text is: the attached hero cannot commit to Fortitude tests; Forced: after you fail a Fortitude test exhaust the attached hero
  // and discard each non-objective attachment on it (Heavy and Tired itself included).
  {
    id: "146057:whenRevealed:1",
    cardCode: "146057",
    lines: ["146057:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "mostAttachments" } }, { verb: "Exhaust", target: { kind: "ref", ref: "host" } }],
  },
  {
    id: "146057:constant:1",
    cardCode: "146057",
    lines: ["146057:A:1"],
    timing: "constant",
    instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "noFortitudeCommit", amount: 1, until: "whileSourceInPlay", target: "host" }],
  },
  {
    id: "146057:forced:1",
    cardCode: "146057",
    lines: ["146057:A:1"],
    timing: "forced",
    trigger: "fortitudeFailed",
    // "After you fail": the player who failed (the Forced effect's actor) controls the attached hero (the card is attached, controlled by nobody, so it cannot ask whose card it is).
    condition: { kind: "hostControlledByActor" },
    instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "host" } }, { verb: "DiscardEach", pick: ATTACHMENTS_ON_HOST }],
  },
];
