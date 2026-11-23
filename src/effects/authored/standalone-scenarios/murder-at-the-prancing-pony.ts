import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { EACH_PLAYER } from "../the-ghost-of-framsburg.ts";

// Records for Murder at the Prancing Pony (standalone-scenarios cycle part 7, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// The Investigation deck, Investigate X and the accusation are the investigation family's verbs (src/catalog/families/investigation.ts); the readings are in docs/scenarios/standalone-scenarios.md, Murder at the Prancing Pony, Readings (numbers 1 to 23 below). The Hideouts' victory-display lines are
// constants that hold while the Hideout is in the victory display (`sourceIn victory`, reading 21). The hidden Suspect and Hideout, and the cards of the Investigation deck, are named by no step: the verbs here ask only about names, never about a card.
// Rules: rr.forced, rr.travel, rr.search, rr.immune, rr.cannot, rr.engaged, rr.attachment-cards, rr.keywords, rr.in-play-and-out-of-play, rr.victory, rr.quest-advancement, faq.additional-attacks (data/rules/entries.json).
const STAGE_1 = "50701";
const STAGE_2 = "50702";
const STAGE_3 = "50703";
const BILL_FERNY_HOUSE = "50704";
const STADDLE = "50705";
const COMBE = "50706";
const ARCHET = "50707";
const CHETWOOD_CAMP = "50708";
const TODD = "50709";
const SUSIE = "50710";
const JAKE = "50711";
const JOHNNY = "50712";
const ORC_EYES = "50713";
const TAKEN = "50714";
const PONY = "50715";
const WAREHOUSE = "50719";
const STABLE = "50720";
const BILL_FERNY = "50721";
const INFORMANT = "50722";
const MUSCLE = "50726";
const BODY_COUNT = "50728";
// The five Suspects and the five Hideouts (the Investigation List): the hidden pair is one of each (50701:A:1) and the accusation names one of each (50702:B:2).
const SUSPECTS: string[] = [TODD, SUSIE, JAKE, JOHNNY, ORC_EYES];
const HIDEOUTS: string[] = [BILL_FERNY_HOUSE, STADDLE, COMBE, ARCHET, CHETWOOD_CAMP];

// An enemy pick that is not `staging` sees only the enemies engaged with a player (rules/interpret/pick.ts), so each of these reads the staging area too.
// The running attack destroyed a character (AfterAttack reads the number destroyed as X).
const DESTROYED_A_CHARACTER = { kind: "x", min: 1 } as const;
const SUSPECT_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Suspect", staging: true };
const BRIGAND_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Brigand", staging: true };
const HIDEOUT_IN_PLAY: PickSpec = { type: "location", control: "any", trait: "Hideout", staging: true };
const IN_VICTORY: Condition = { kind: "sourceIn", zone: "victory" };
const KEYWORD_RESOLVES: Condition = { kind: "not", condition: { kind: "investigateIgnored" } };
// "Investigate X" is a Forced effect of the location once it is explored as the active location (reading 3).
const investigateKeyword = (code: string, line: string, amount: number): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "activeExplored", subject: "self", instructions: [{ verb: "Investigate", amount }] });
// A Hideout's victory-display line: the Suspects (in play, wherever they are) get the modifier while it lies in the victory display.
const suspectsGet = (code: string, line: string, instructions: Instruction[]): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", condition: IN_VICTORY, instructions });
const holdsSuspects = { type: "enemy", control: "any", trait: "Suspect", staging: true } as const;
// A Hideout's Travel line: the encounter deck and discard pile are searched for the card, which is added to the staging area, and the deck is shuffled.
const travelSearch = (code: string, line: string, found: string, victory?: true): Effect => ({
  id: `${code}:travel:1`,
  cardCode: code,
  lines: [line],
  timing: "travel",
  instructions: [{ verb: "SearchMove", code: found, to: "staging", ...(victory ? { victory } : {}) }, { verb: "ShuffleEncounterDeck" }],
});
// The Suspects share the printed "cannot have attachments" template records; the Shadow cards of Hired Muscle and the others are generated.

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 50701 Investigating the Crime (1A/1B). Setup: one Suspect and one Hideout are picked by the seed and set aside facedown; the other eight and Taken by Surprise form the Investigation deck (the piles place the active location and the staging area).
  // Side B: at most 4 progress a round; at the beginning of the quest phase each player either raises their threat by 2 or an additional encounter card is revealed this phase (readings 1 and 8).
  { id: "50701:setup:1", cardCode: STAGE_1, lines: ["50701:A:1"], timing: "setup", instructions: [{ verb: "HideSuspectAndHideout", suspects: SUSPECTS, hideouts: HIDEOUTS }, { verb: "BuildInvestigationDeck", codes: [TAKEN] }] },
  { id: "50701:constant:1", cardCode: STAGE_1, lines: ["50701:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 4, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "50701:forced:1",
    cardCode: STAGE_1,
    lines: ["50701:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2 }] },
            { id: "reveal", instructions: [{ verb: "RevealMore", amount: 1 }] },
          ],
        },
      ]),
    ],
  },

  // 50702 Running out of Time (2A/2B). When Revealed: the discard pile is shuffled into the deck and cards are discarded until X locations are (X the players); each goes to the staging area.
  // Side B: after the players quest unsuccessfully a random card of the Investigation deck is removed unseen (once, whoever hears it); after progress is placed by a successful quest the first player either reveals an encounter card or makes the accusation and advances to 3A (readings 7 to 9).
  { id: "50702:whenRevealed:1", cardCode: STAGE_2, lines: ["50702:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, cardType: "location", to: "staging" }] },
  { id: "50702:forced:1", cardCode: STAGE_2, lines: ["50702:B:1"], timing: "forced", trigger: "questFailed", eventSeat: "you", instructions: [{ verb: "RemoveRandomInvestigation" }] },
  {
    id: "50702:forced:2",
    cardCode: STAGE_2,
    lines: ["50702:B:2"],
    timing: "forced",
    trigger: "questProgressPlacedOnStage",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "reveal", instructions: [{ verb: "RevealEncounter", who: "firstPlayer" }] },
          {
            id: "accuse",
            instructions: [
              { verb: "NameInvestigation", kind: "suspect", codes: SUSPECTS },
              { verb: "NameInvestigation", kind: "hideout", codes: HIDEOUTS },
              { verb: "MakeAccusation", suspects: SUSPECTS, hideouts: HIDEOUTS },
              { verb: "RaiseThreat", amount: 3, who: "eachSeat", when: { kind: "x", min: 1 } },
              { verb: "AdvanceToStage", code: STAGE_3 },
            ],
          },
        ],
      },
    ],
  },

  // 50703 Apprehending the Killer (3A/3B). When Revealed: each player besides the first searches the encounter deck and discard pile for a Brigand enemy and adds it to the staging area. Side B: the Investigate keyword is ignored when the active location is explored;
  // at the beginning of the encounter phase each Suspect in play engages the first player; with a Hideout in play the Suspects cannot take damage, and with no Suspect in play the players win (reading 20).
  {
    id: "50703:whenRevealed:1",
    cardCode: STAGE_3,
    lines: ["50703:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: "Brigand", type: "enemy", to: "staging", when: { kind: "not", condition: { kind: "firstPlayer" } } }]), { verb: "ShuffleEncounterDeck" }],
  },
  { id: "50703:constant:1", cardCode: STAGE_3, lines: ["50703:B:1"], timing: "constant", instructions: [{ verb: "IgnoreKeyword", keywords: ["investigate"] }] },
  {
    id: "50703:forced:1",
    cardCode: STAGE_3,
    lines: ["50703:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Encounter" },
    instructions: [{ verb: "Each", pick: SUSPECT_ENEMY, instructions: [{ verb: "Engage", target: "picked" }] }],
  },
  {
    id: "50703:constant:2",
    cardCode: STAGE_3,
    lines: ["50703:B:3"],
    timing: "constant",
    condition: { kind: "count", pick: HIDEOUT_IN_PLAY, min: 1 },
    instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: holdsSuspects }],
  },
  { id: "50703:constant:3", cardCode: STAGE_3, lines: ["50703:B:3"], timing: "constant", condition: { kind: "enemyInPlay", trait: "Suspect", is: false }, instructions: [{ verb: "WinGame" }] },

  // 50704 to 50708 the Hideouts. While one is in the victory display it changes the Suspects (reading 21); its Travel line searches for the card it names (reading 22).
  suspectsGet(BILL_FERNY_HOUSE, "50704:A:2", [
    { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: holdsSuspects },
    { verb: "ModifyStat", stat: "shadowsImmune", amount: 1, until: "whileSourceInPlay", holders: holdsSuspects },
  ]),
  travelSearch(BILL_FERNY_HOUSE, "50704:A:3", BILL_FERNY, true),
  suspectsGet(STADDLE, "50705:A:2", [{ verb: "ModifyStat", stat: "attackOnlyByEngaged", amount: 1, until: "whileSourceInPlay", holders: holdsSuspects }]),
  { id: "50705:travel:1", cardCode: STADDLE, lines: ["50705:A:3"], timing: "travel", instructions: [{ verb: "SearchReveal", code: "50724", who: "actor", to: "staging" }, { verb: "ShuffleEncounterDeck" }] },
  {
    id: "50706:forced:1",
    cardCode: COMBE,
    lines: ["50706:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: SUSPECT_ENEMY,
    condition: IN_VICTORY,
    fromVictory: true,
    instructions: [{ verb: "ImmediateAttack", target: "subject" }],
  },
  travelSearch(COMBE, "50706:A:3", "50723"),
  suspectsGet(ARCHET, "50707:A:2", [{ verb: "ModifyStat", stat: "damageCap", amount: 5, until: "whileSourceInPlay", holders: holdsSuspects }]),
  travelSearch(ARCHET, "50707:A:3", INFORMANT),
  suspectsGet(CHETWOOD_CAMP, "50708:A:2", (["threat", "attack", "defense"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: 1, until: "whileSourceInPlay" as const, holders: holdsSuspects }))),
  travelSearch(CHETWOOD_CAMP, "50708:A:3", "50725"),

  // 50709 Todd the Troll: excess combat damage becomes a threat raise (the flag Hill Troll has; reading 16). 50710 Susie the Spider: Threat X (the Brigand enemies in play); no damage while another Brigand is in play.
  { id: "50709:constant:2", cardCode: TODD, lines: ["50709:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessToThreat", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "50710:constant:2", cardCode: SUSIE, lines: ["50710:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: BRIGAND_ENEMY }, until: "whileSourceInPlay", target: "self" }] },
  { id: "50710:constant:3", cardCode: SUSIE, lines: ["50710:A:3"], timing: "constant", condition: { kind: "enemyInPlay", trait: "Brigand", other: true, is: true }, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  // 50711 Wolf-pelt Jake: after his attack destroys an ally he returns to the staging area (reading 18).
  {
    id: "50711:forced:1",
    cardCode: JAKE,
    lines: ["50711:A:2"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    subject: { type: "ally", control: "any" },
    condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true, staging: true } },
    instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }],
  },
  // 50712 Johnny Goblin-fingers: when he attacks, the defending player discards a random card from hand and raises threat by its printed cost (reading 17).
  { id: "50712:forced:1", cardCode: JOHNNY, lines: ["50712:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "DiscardRandomFromHand", raiseByCost: true }] },
  // 50713 Old Orc-eyes: after an attack resolves in which he was dealt a shadow card with no shadow effect he attacks again, with no shadow card (reading 15).
  { id: "50713:forced:1", cardCode: ORC_EYES, lines: ["50713:A:2"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "ImmediateAttack", shadow: false, target: "subject" }] },

  // 50714 Taken by Surprise: it hears every look at the Investigation deck that shows it; the discard pile is shuffled into the deck, cards are discarded until an enemy is, and it is put into play engaged with the first player, not revealed; then Taken by Surprise leaves the game (reading 6).
  {
    id: "50714:forced:1",
    cardCode: TAKEN,
    lines: ["50714:A:1"],
    timing: "forced",
    trigger: "lookedAtInvestigationDeck",
    subject: "self",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "engaged" }, { verb: "RemoveSourceFromGame" }],
  },

  // 50715 The Prancing Pony: when explored the first player either looks at the top 2 cards of the Investigation deck or each player draws 2 cards (reading 10).
  {
    id: "50715:forced:1",
    cardCode: PONY,
    lines: ["50715:A:1"],
    timing: "forced",
    trigger: "locationExplored",
    subject: "self",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "look", instructions: [{ verb: "LookAtInvestigation", from: "top", count: 2 }] },
          { id: "draw", instructions: [{ verb: "DrawEach", amount: 2 }] },
        ],
      },
    ],
  },

  // 50716 Ramshackle Manor: Investigate 2; threat reductions by player cards are reduced to 1; Travel: each player raises their threat by 1.
  investigateKeyword("50716", "50716:A:1", 2),
  { id: "50716:constant:2", cardCode: "50716", lines: ["50716:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threatReductionToOne", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  { id: "50716:travel:1", cardCode: "50716", lines: ["50716:A:3"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
  // 50717 Dark Alley: Investigate 3; enemies in the staging area cannot take damage; Travel: the discard pile is shuffled in and cards are discarded until an enemy is, which is added to the staging area.
  investigateKeyword("50717", "50717:A:1", 3),
  {
    id: "50717:constant:2",
    cardCode: "50717",
    lines: ["50717:A:2"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } }],
  },
  { id: "50717:travel:1", cardCode: "50717", lines: ["50717:A:3"], timing: "travel", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },
  // 50718 Market Square: Investigate 2; after a player places progress on a location in the staging area they raise their threat by 1; Travel: each player spends 1 resource.
  investigateKeyword("50718", "50718:A:1", 2),
  { id: "50718:forced:2", cardCode: "50718", lines: ["50718:A:2"], timing: "forced", trigger: "progressPlaced", subject: { type: "location", control: "any", stagingOnly: true }, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }] },
  { id: "50718:travel:1", cardCode: "50718", lines: ["50718:A:3"], timing: "travel", instructions: [EACH_PLAYER([{ verb: "SpendResources", amount: 1 }])] },
  // 50719 Old Warehouse: Investigate 1; when the keyword is triggered the first player either looks at 2 additional cards or reduces each player's threat by 3 (reading 5, before the keyword's own record); Travel: reveal the top encounter card (the template).
  {
    id: "50719:forced:2",
    cardCode: WAREHOUSE,
    lines: ["50719:A:2"],
    timing: "forced",
    trigger: "activeExplored",
    subject: "self",
    condition: KEYWORD_RESOLVES,
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "look", instructions: [{ verb: "ModifyStat", stat: "investigateLooked", amount: 2, until: "endOfPhase", target: "self" }] },
          { id: "reduce", instructions: [{ verb: "LowerThreat", amount: 3, who: "eachSeat" }] },
        ],
      },
    ],
  },
  investigateKeyword(WAREHOUSE, "50719:A:1", 1),
  // 50720 Village Stable: Investigate 1; after the keyword resolves, with a Suspect or Hideout looked at, it goes to the victory display and the card to the staging area (reading 11); Travel: each player discards a random card from hand.
  investigateKeyword(STABLE, "50720:A:1", 1),
  {
    id: "50720:response:1",
    cardCode: STABLE,
    lines: ["50720:A:2"],
    timing: "response",
    trigger: "investigated",
    subject: "self",
    condition: { kind: "investigationTop", traits: ["Suspect", "Hideout"] },
    instructions: [{ verb: "AddSourceToVictory" }, { verb: "AddLookedToStaging", traits: ["Suspect", "Hideout"] }],
  },
  { id: "50720:travel:1", cardCode: STABLE, lines: ["50720:A:3"], timing: "travel", instructions: [{ verb: "DiscardRandomFromHand", who: "eachSeat" }] },

  // 50721 Bill Ferny: cannot be optionally engaged; the first treachery revealed each round gains doomed 1 and its effects cannot be canceled (reading 19); Shadow: raise your threat by 4 or the attack is undefended.
  { id: "50721:constant:1", cardCode: BILL_FERNY, lines: ["50721:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "50721:constant:2", cardCode: BILL_FERNY, lines: ["50721:A:2"], timing: "constant", instructions: [{ verb: "UncancelableWhenRevealed", firstRevealedEachRound: true, doomed: 1 }] },
  {
    id: "50721:shadow:1",
    cardCode: BILL_FERNY,
    lines: ["50721:A:3"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 4 }] },
          { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] },
        ],
      },
    ],
  },
  // 50722 Bree-land Informant: after it attacks, with a shadow card of no shadow effect, the defending player raises threat by 1 and spends 1 resource to look at the bottom card of the Investigation deck; then it is discarded only when the look and the spend resolved, so a player with no resource keeps it in play (reading 14, rr.then).
  {
    id: "50722:response:1",
    cardCode: INFORMANT,
    lines: ["50722:A:1"],
    timing: "response",
    trigger: "attackResolved",
    subject: "self",
    condition: { kind: "shadowBlank" },
    instructions: [
      { verb: "RaiseThreat", amount: 1 },
      { verb: "LookAtInvestigation", from: "bottom", when: { kind: "resources", min: 1 } },
      { verb: "Discard", target: { kind: "self" }, when: { kind: "resources", min: 1 } },
      { verb: "SpendResources", amount: 1 },
    ],
  },
  // 50723 Lawless Ruffian: +2 Attack while engaged with a player with threat 35 or higher; Shadow: an additional attack against you.
  {
    id: "50723:constant:1",
    cardCode: "50723",
    lines: ["50723:A:1"],
    timing: "constant",
    condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "engaged" }, { kind: "threat", min: 35 }] },
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "self" }],
  },
  { id: "50723:shadow:1", cardCode: "50723", lines: ["50723:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },
  // 50724 Greenway Footpad: When Revealed either each player raises threat by 2 or it attacks the first player; Shadow: the attacker gets +1 Attack, +2 with your threat 35 or higher.
  {
    id: "50724:whenRevealed:1",
    cardCode: "50724",
    lines: ["50724:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
          { id: "attack", instructions: [{ verb: "AttackFromStaging", who: "firstPlayer", target: "self" }] },
        ],
      },
    ],
  },
  {
    id: "50724:shadow:1",
    cardCode: "50724",
    lines: ["50724:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "threat", min: 35 } },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "threat", min: 35 } } },
    ],
  },
  // 50725 Chetwood Outlaw: after you optionally engage it you raise your threat by 4; Shadow: either raise your threat by 2 or the attacker returns to the staging area after the attack.
  { id: "50725:forced:1", cardCode: "50725", lines: ["50725:A:1"], timing: "forced", trigger: "optionallyEngaged", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 4, who: "eventSeat" }] },
  {
    id: "50725:shadow:1",
    cardCode: "50725",
    lines: ["50725:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2 }] },
          { id: "return", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
        ],
      },
    ],
  },
  // 50726 Hired Muscle (Surge): attach to a Brigand enemy that has no Hired Muscle and return it to the staging area; it counts as a Condition and gives +1 Threat, Attack and Defense and a Forced effect that looks at the bottom of the Investigation deck (reading 13).
  {
    id: "50726:whenRevealed:1",
    cardCode: MUSCLE,
    lines: ["50726:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "enemy", control: "any", trait: "Brigand", staging: true, takesSource: true, hasAttachment: { names: ["Hired Muscle"], none: true } } },
      { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: { type: "enemy", control: "any", trait: "Brigand", staging: true, takesSource: true, hasAttachment: { names: ["Hired Muscle"], none: true } } } },
      { verb: "ReturnToStaging", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "enemy", control: "any", trait: "Brigand", staging: true, hasAttachment: { names: ["Hired Muscle"] } } } },
    ],
  },
  { id: "50726:constant:1", cardCode: MUSCLE, lines: ["50726:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  {
    id: "50726:constant:2",
    cardCode: MUSCLE,
    lines: ["50726:A:2"],
    timing: "constant",
    instructions: (["threat", "attack", "defense"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: 1, until: "whileSourceInPlay" as const, target: "host" as const })),
  },
  { id: "50726:forced:1", cardCode: MUSCLE, lines: ["50726:A:2"], timing: "forced", trigger: "hostDefeated", instructions: [{ verb: "LookAtInvestigation", from: "bottom" }] },
  // 50727 Smoke and Mirrors: When Revealed discard the top X cards of the encounter deck, X 1 more than the Investigate value of the active location, and add their Threat to the staging total until the end of the phase; Shadow: discard an attachment you control.
  {
    id: "50727:whenRevealed:1",
    cardCode: "50727",
    lines: ["50727:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "DiscardEncounterTop", count: { investigateValue: true, plus: 1 }, reset: true }, { verb: "RaiseStagingThreat", amount: { discardedThreat: true }, until: "endOfPhase" }],
  },
  { id: "50727:shadow:1", cardCode: "50727", lines: ["50727:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },
  // 50728 Rising Body Count: either each player raises threat by 2 or it is shuffled into the Investigation deck; Shadow: if the attack destroys a character, either raise your threat by 2 or shuffle it in (reading 12).
  {
    id: "50728:whenRevealed:1",
    cardCode: BODY_COUNT,
    lines: ["50728:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
          { id: "shuffle", instructions: [{ verb: "ShuffleSelfIntoInvestigation" }] },
        ],
      },
    ],
  },
  {
    id: "50728:shadow:1",
    cardCode: BODY_COUNT,
    lines: ["50728:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 2, when: DESTROYED_A_CHARACTER }] }] },
          { id: "shuffle", instructions: [{ verb: "ShuffleSelfIntoInvestigation", ifDestroyed: true }] },
        ],
      },
    ],
  },
  // 50729 Deadly Accusations: When Revealed each player raises threat by X, 1 more than the Investigate value of the active location; Shadow: the attacker gets +X Attack, X the Investigate value.
  { id: "50729:whenRevealed:1", cardCode: "50729", lines: ["50729:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: { investigateValue: true, plus: 1 }, who: "eachSeat" }] },
  { id: "50729:shadow:1", cardCode: "50729", lines: ["50729:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { investigateValue: true }, until: "endOfAttack", target: "attacker" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
