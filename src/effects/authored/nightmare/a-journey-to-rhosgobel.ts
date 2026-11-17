import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// A Journey to Rhosgobel Nightmare (deck 9006, data/printed/nightmare.json). The setup card adds the Goblin Eagle-hunter to the staging area, makes the first Creature revealed each quest phase gain surge and shuffles an Athelas back into the encounter deck
// when one is placed in the discard pile. The deck's encounter cards hurt Wilyador (Goblin Eagle-hunter, Shot from the Sky, Noxious Supplies), keep the characters from healing (Treetop Bird-eater), and make the staging area and the shadow cards harder (Dark-wood Grove,
// Labyrinthine Woods, Pitch-dark Thicket). The deck has no quest card of its own.
// Rules: rr.forced, rr.response, rr.next-player, rr.ranged, rr.attachment-cards, rr.first-player (data/rules/entries.json).
const WILYADOR: PickSpec = { type: "character", control: "any", names: ["Wilyador"] };
const WILYADOR_YOURS: PickSpec = { type: "character", control: "you", names: ["Wilyador"] };
const ATHELAS_CARD: PickSpec = { type: "card", control: "any", names: ["Athelas"] };
const CREATURE: PickSpec = { type: "enemy", control: "any", trait: "Creature", staging: true };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const OTHER_PLAYER: Condition = { kind: "otherPlayer" };
// Wilyador has 10 damage or less on him (Goblin Eagle-hunter's shadow): the picked card's damage is not more than 10.
const TEN_OR_LESS: Condition = { kind: "not", condition: { kind: "less", left: 10, right: { stat: "damage", of: "picked" } } };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900601 A Journey to Rhosgobel Nightmare (setup card). Setup: the Goblin Eagle-hunter is added to the staging area and the encounter deck shuffled; the table also notes the cards placed in the encounter discard pile for A:4 (the card has no constant line to
  // carry the flag, as the Carrock's 900501:A:2). Forced: the first Creature enemy revealed from the encounter deck each quest phase gains surge. Response: after an Athelas card is placed in the encounter discard pile the first player may shuffle it into the encounter deck.
  {
    id: "900601:setup:1",
    cardCode: "900601",
    lines: ["900601:A:2"],
    timing: "setup",
    instructions: [{ verb: "SearchToStaging", code: "900602" }, { verb: "ShuffleEncounterDeck" }, { verb: "ModifyStat", stat: "noteEncounterDiscards", amount: 1, until: "endOfGame", target: "table" }],
  },
  {
    id: "900601:forced:1",
    cardCode: "900601",
    lines: ["900601:A:3"],
    timing: "forced",
    trigger: "revealed",
    byEncounterDeck: true,
    subject: { type: "enemy", control: "any", trait: "Creature" },
    condition: { kind: "phase", is: "Quest" },
    limit: "oncePerPhase",
    instructions: [{ verb: "GrantSurgeToSubject" }],
  },
  {
    id: "900601:response:1",
    cardCode: "900601",
    lines: ["900601:A:4"],
    timing: "response",
    trigger: "encounterDiscarded",
    subject: { type: "objective", control: "any", names: ["Athelas"] },
    instructions: [{ verb: "ShuffleIntoDeck", code: "02063" }],
  },
  // 900602 Goblin Eagle-hunter. +1 hit point per player. Forced: 1 damage to Wilyador at the end of the combat phase. Shadow: with 10 damage or less on him, 2 damage to Wilyador.
  { id: "900602:constant:1", cardCode: "900602", lines: ["900602:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: { players: true }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "900602:forced:1",
    cardCode: "900602",
    lines: ["900602:A:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "canPick", pick: WILYADOR }] },
    instructions: [{ verb: "Pick", pick: WILYADOR }, { verb: "DamageCard", amount: 1, target: "picked" }],
  },
  {
    id: "900602:shadow:1",
    cardCode: "900602",
    lines: ["900602:A:3"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: WILYADOR }, { verb: "DamageCard", amount: 2, target: "picked", when: TEN_OR_LESS }],
  },
  // 900603 Treetop Bird-eater. While engaged with a player the characters that player controls cannot be healed (Wilyador too, when that player controls him). Forced: at the beginning of the encounter phase it engages the player who controls Wilyador.
  { id: "900603:constant:1", cardCode: "900603", lines: ["900603:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "whileSourceInPlay", target: "engagedSeatCharacters" }] },
  {
    id: "900603:forced:1",
    cardCode: "900603",
    lines: ["900603:A:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Encounter" },
    instructions: [{ verb: "EngageSeatWith", pick: WILYADOR_YOURS, controls: true }],
  },
  // 900604 Dark-wood Grove. +1 Threat and +1 quest point for each Athelas card in play. Shadow: if the defending player controls an Athelas card (a claimed objective or the player attachment, attached to a character he controls) the attacking enemy makes an additional attack after this one.
  {
    id: "900604:constant:1",
    cardCode: "900604",
    lines: ["900604:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: { count: ATHELAS_CARD }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "questPoints", amount: { count: ATHELAS_CARD }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "900604:shadow:1", cardCode: "900604", lines: ["900604:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true, when: { kind: "canPick", pick: { type: "character", control: "you", hasAttachment: { names: ["Athelas"] } } } }] },
  // 900605 Labyrinthine Woods. In the staging area Creature enemies get +1 Threat and +1 Attack (each copy adds). Shadow: after the attack the enemy engages the next player and attacks again (no next player in a one-player game).
  {
    id: "900605:constant:1",
    cardCode: "900605",
    lines: ["900605:A:1"],
    timing: "constant",
    condition: IN_STAGING,
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: CREATURE },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: CREATURE },
    ],
  },
  { id: "900605:shadow:1", cardCode: "900605", lines: ["900605:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "EngageNextPlayer", when: OTHER_PLAYER }, { verb: "ImmediateAttack", when: OTHER_PLAYER }] }] },
  // 900606 Pitch-dark Thicket. While it is the active location every character loses ranged. Shadow: the attacking enemy cannot be attacked by characters with ranged until the end of the phase.
  { id: "900606:constant:1", cardCode: "900606", lines: ["900606:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "loseRanged", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
  { id: "900606:shadow:1", cardCode: "900606", lines: ["900606:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotBeAttackedByRanged", amount: 1, until: "endOfPhase", target: "attacker" }] },
  // 900607 Shot from the Sky (Surge is a keyword). When Revealed: it attaches to an Eagle character (the first player chooses; none, no attachment). As a Condition attachment its host loses the Eagle trait and takes 1 damage each time it readies.
  // Shadow: the card's When Revealed resolves.
  { id: "900607:whenRevealed:1", cardCode: "900607", lines: ["900607:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "character", trait: "Eagle" } }] },
  { id: "900607:constant:1", cardCode: "900607", lines: ["900607:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "losesEagle", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  { id: "900607:triggered:1", cardCode: "900607", lines: ["900607:A:2"], timing: "triggered", trigger: "readied", subject: "host", instructions: [{ verb: "DamageCard", amount: 1, target: "host" }] },
  { id: "900607:shadow:1", cardCode: "900607", lines: ["900607:A:3"], timing: "shadow", instructions: [{ verb: "ResolveWhenRevealed", card: "self" }] },
  // 900608 Noxious Supplies (Surge is a keyword). When Revealed: it attaches to Wilyador (up to 3 copies; no Wilyador, no attachment). As a Condition attachment a heal of him by a card effect other than Athelas heals 1, and then it is discarded.
  { id: "900608:whenRevealed:1", cardCode: "900608", lines: ["900608:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "character", name: "Wilyador", unlimited: true } }] },
  { id: "900608:constant:1", cardCode: "900608", lines: ["900608:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "healReducedToOne", amount: 1, until: "whileSourceInPlay", target: "host" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
