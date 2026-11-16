import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// Conflict at the Carrock Nightmare (deck 9005, data/printed/nightmare.json). The setup card sets a fifth unique Troll (Rob and Bob) aside, puts Louis, Morris, Rupert and Stuart (the Nightmare versions) into the staging area at stage 2B, adds
// a progress at the end of a quest phase that placed none, and lets a defeated unique Troll discard a Sacked!. A Nightmare Troll in the victory display lends its strength to every Troll enemy. Grimbeorn's Folly (900511) is the deck's stage 3:
// Rob and Bob come out with a Troll for each player and defeating Rob and Bob wins the game (the quest card is dealt after stage 2 on Nightmare, src/campaign/start.ts).
// Rules: rr.forced, rr.response, rr.first-player, rr.next-player, rr.discard-pile-and-victory-display, rr.search (data/rules/entries.json).
const TROLL: PickSpec = { type: "enemy", control: "any", trait: "Troll", staging: true };
const SACKED: PickSpec = { type: "attachment", control: "any", names: ["Sacked!"] };
const ROB_AND_BOB: PickSpec = { type: "enemy", control: "any", names: ["Rob and Bob"] };
const DAMAGED_TROLL: PickSpec = { ...TROLL, damaged: true };
// A hero was picked from a discard pile for Time for Supper (the matches test reads the card, not its zone, so it holds once the hero has left the pile).
const HERO_REMOVED: Condition = { kind: "matches", card: "picked", pick: { type: "hero", control: "any", from: "discard" } };
const IN_VICTORY: Condition = { kind: "sourceIn", zone: "victory" };
const SACKED_IN_PLAY: Condition = { kind: "canPick", pick: SACKED };
const NIGHTMARE_TROLLS = ["900504", "900505", "900506", "900507"] as const;
const THREAT_STAT = (stat: "attack" | "defense", amount: number): Effect["instructions"][number] => ({ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", holders: TROLL });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900501 Conflict at the Carrock Nightmare (setup card). Setup: Rob and Bob joins the four Trolls set aside. When stage 2B is revealed the four Nightmare Trolls enter the staging area. At the end of a quest phase in which no progress was
  // placed on the current quest, 1 progress is (the table notes the quest phase's progress, `noteQuestProgress`). Response: after a unique Troll enemy is defeated, a Sacked! in play may be discarded.
  // The setup card's Setup (line A:2) also switches on the table's note of the quest phase's progress for A:4, which the card has no constant line to carry.
  {
    id: "900501:setup:1",
    cardCode: "900501",
    lines: ["900501:A:2"],
    timing: "setup",
    instructions: [{ verb: "SetAsideFromDeck", code: "900503" }, { verb: "ModifyStat", stat: "noteQuestProgress", amount: 1, until: "endOfGame", target: "table" }],
  },
  {
    id: "900501:forced:1",
    cardCode: "900501",
    lines: ["900501:A:3"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Against the Trolls"] } },
    instructions: NIGHTMARE_TROLLS.map((code) => ({ verb: "AddSetAsideToStaging" as const, code })),
  },
  {
    id: "900501:forced:2",
    cardCode: "900501",
    lines: ["900501:A:4"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "questProgressNoted", is: false }] },
    instructions: [{ verb: "AddStageProgress", amount: 1 }],
  },
  {
    id: "900501:response:1",
    cardCode: "900501",
    lines: ["900501:A:5"],
    timing: "response",
    trigger: "enemyDestroyed",
    subject: { type: "enemy", control: "any", trait: "Troll", unique: true },
    answeredBy: "eventSeat",
    condition: SACKED_IN_PLAY,
    instructions: [{ verb: "Pick", pick: SACKED }, { verb: "Discard", target: { kind: "picked" } }],
  },
  // 900502 Savage Hill-troll. While it is in the victory display each Troll enemy gets +1 hit point. Shadow: against a Troll, the defending character does not ready in the refresh phase of this round.
  { id: "900502:constant:1", cardCode: "900502", lines: ["900502:A:1"], timing: "constant", condition: IN_VICTORY, instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: 1, until: "whileSourceInPlay", holders: TROLL }] },
  { id: "900502:shadow:1", cardCode: "900502", lines: ["900502:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Troll" } } }] },
  // 900503 Rob and Bob. Forced: after its first attack each round, with two or more players it engages the next player and attacks again, dealt a new shadow card.
  {
    id: "900503:forced:1",
    cardCode: "900503",
    lines: ["900503:A:1"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    limit: "oncePerRound",
    condition: { kind: "otherPlayer" },
    instructions: [{ verb: "EngageNextPlayer" }, { verb: "ImmediateAttack" }],
  },
  // 900504 Louis. Forced: after he attacks, the defending player raises his threat by 3. In the victory display each Troll enemy raises the defending player's threat by 1 after it attacks.
  { id: "900504:forced:1", cardCode: "900504", lines: ["900504:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eventSeat" }] },
  { id: "900504:forced:2", cardCode: "900504", lines: ["900504:A:2"], timing: "forced", trigger: "attackResolved", subject: TROLL, fromVictory: true, condition: IN_VICTORY, instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }] },
  // 900505 Morris (Immune to player events). In the victory display each Troll enemy gets +1 Attack and is immune to player events.
  { id: "900505:constant:1", cardCode: "900505", lines: ["900505:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerEvents", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "900505:constant:2", cardCode: "900505", lines: ["900505:A:2"], timing: "constant", condition: IN_VICTORY, instructions: [THREAT_STAT("attack", 1), { verb: "ModifyStat", stat: "immuneToPlayerEvents", amount: 1, until: "whileSourceInPlay", holders: TROLL }] },
  // 900506 Rupert. His Defense cannot be reduced; in the victory display the Defense of each Troll enemy cannot be reduced.
  { id: "900506:constant:1", cardCode: "900506", lines: ["900506:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotReduceDefense", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "900506:constant:2", cardCode: "900506", lines: ["900506:A:2"], timing: "constant", condition: IN_VICTORY, instructions: [{ verb: "ModifyStat", stat: "cannotReduceDefense", amount: 1, until: "whileSourceInPlay", holders: TROLL }] },
  // 900507 Stuart. In the victory display each Troll enemy gets +1 Defense and cannot have player attachments.
  { id: "900507:constant:2", cardCode: "900507", lines: ["900507:A:2"], timing: "constant", condition: IN_VICTORY, instructions: [THREAT_STAT("defense", 1), { verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay", holders: TROLL }] },
  // 900508 Troll Lair. In the staging area, players cannot reduce their threat. Shadow: against a Troll, 4 damage comes off the attacker.
  { id: "900508:constant:1", cardCode: "900508", lines: ["900508:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "noThreatReduction", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "900508:shadow:1",
    cardCode: "900508",
    lines: ["900508:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Heal", amount: 4, target: "attacker", when: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Troll" } } }],
  },
  // 900509 Hives and Hives. Forced: after progress is placed on it, 1 damage to each character in play.
  { id: "900509:forced:1", cardCode: "900509", lines: ["900509:A:1"], timing: "forced", trigger: "progressPlaced", subject: "self", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any" } }] },
  // 900510 Time for Supper. When Revealed: the first player removes a hero in any player's discard pile from the game; then all damage is healed from each Troll enemy in play. It gains surge when no Troll was damaged.
  {
    id: "900510:whenRevealed:1",
    cardCode: "900510",
    lines: ["900510:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "any", from: "discard", who: "firstPlayer" } },
      { verb: "RemoveFromGame", when: HERO_REMOVED },
      // "Then, heal all damage ...": with no hero to remove the part before "then" does not resolve, so nothing is healed (rr.then) and no damage was removed, which is the surge. The surge test is made before the healing.
      { verb: "GainSurge", when: { kind: "not", condition: HERO_REMOVED } },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: DAMAGED_TROLL } } },
      { verb: "Each", pick: DAMAGED_TROLL, when: HERO_REMOVED, instructions: [{ verb: "Heal", all: true, target: "picked" }] },
    ],
  },
  // 900511 Grimbeorn's Folly (stage 3, no quest points). When Revealed: Rob and Bob joins the staging area and each player in turn finds a non-unique Troll enemy there, if able. When Rob and Bob is defeated the players win.
  {
    id: "900511:whenRevealed:1",
    cardCode: "900511",
    lines: ["900511:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AddSetAsideToStaging", code: "900503" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", trait: "Troll", nonUnique: true, to: "staging" }] }, { verb: "ShuffleEncounterDeck" }],
  },
  { id: "900511:triggered:1", cardCode: "900511", lines: ["900511:B:1"], timing: "triggered", trigger: "enemyDestroyed", subject: ROB_AND_BOB, instructions: [{ verb: "WinGame" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
