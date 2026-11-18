import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// The Long Dark Nightmare (deck 9016, data/printed/nightmare.json). The setup card's A:1 and its side B are the deck-building text (inert). A:2: Durin's Greaves gains surge each time it is revealed. A:3: its Lost effect (the setup card is in play, so it is heard) has the first player choose and discard an
// ally in play, any player's. The new cards use the locate test and the Lost timing of the box's records (../dwarrowdelf/the-long-dark.ts, src/rules/families/long-dark/). The readings are in docs/brief.md (The Long Dark).
// Rules: dwd.lost-effects, dwd.locate-test, dwd.last-player, dwd.cave-torch-the-long-dark, rr.in-play-and-out-of-play, rr.shadow-effects, rr.defending-player, rr.first-player, rr.effects, rr.attachment-cards, rr.travel, rr.step-4-2, rr.damage, rr.destroy (data/rules/entries.json).
const FAILED: Condition = { kind: "lastLocateFailed" };
const ATTACHED: Condition = { kind: "sourceIn", zone: "attached" };
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };
const GREAVES: PickSpec = { type: "objective", control: "any", names: ["Durin's Greaves"] };
const LOCATE: Instruction = { verb: "LocateTest", who: "firstPlayer" };
const LOST_IF_FAILED: Instruction = { verb: "TriggerLost", mode: "all", when: FAILED };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 901601 setup card. A:2: Durin's Greaves gains surge as it is revealed. A:3 (Lost): the first player chooses an ally in play, any player's, and it is discarded from play; with none, nothing.
  { id: "901601:forced:1", cardCode: "901601", lines: ["901601:A:2"], timing: "forced", trigger: "revealed", subject: GREAVES, instructions: [{ verb: "GrantSurgeToSubject" }] },
  { id: "901601:forced:2", cardCode: "901601", lines: ["901601:A:3"], timing: "forced", trigger: "lost", instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", who: "firstPlayer" } }, { verb: "DiscardPicked" }] },

  // 901602 Goblin Stalker. A:1: each attack it makes is dealt one more shadow card. A:2: each shadow card dealt to it that prints PASS gives it +2 Attack until the end of the phase (one +2 for each). PASS is a keyword.
  { id: "901602:forced:1", cardCode: "901602", lines: ["901602:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "DealShadow", additional: true }] },
  {
    id: "901602:forced:2",
    cardCode: "901602",
    lines: ["901602:A:2"],
    timing: "forced",
    trigger: "shadowDealtTo",
    subject: "self",
    condition: { kind: "hasPass", card: "other" },
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", target: "self" }],
  },

  // 901603 Trapdoor Spider. A:1: a character its attack damages is discarded from play. A:2 (Lost): it engages the last player and makes an immediate attack, from the staging area or from another player's side.
  { id: "901603:forced:1", cardCode: "901603", lines: ["901603:A:1"], timing: "forced", trigger: "attackDamagedCharacter", subject: "self", instructions: [{ verb: "Discard", target: { kind: "other" } }] },
  { id: "901603:forced:2", cardCode: "901603", lines: ["901603:A:2"], timing: "forced", trigger: "lost", instructions: [{ verb: "EngageLastPlayer" }, { verb: "ImmediateAttack" }] },

  // 901604 Sentinel of the Deep. A:1: the player it is engaged with cannot draw cards from card effects. A:2: the defending player chooses a Lost effect in play and triggers it.
  { id: "901604:constant:1", cardCode: "901604", lines: ["901604:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "draw", engagedPlayer: true }] },
  { id: "901604:shadow:1", cardCode: "901604", lines: ["901604:A:2"], timing: "shadow", instructions: [{ verb: "TriggerLost", mode: "chooseOne" }] },

  // 901605 Eastern Mines. A:1 (Travel): the first player makes a locate test; when it is failed the players travel nowhere (their travel is used) and the Lost effects trigger. A:2: as Sentinel's shadow.
  { id: "901605:travel:1", cardCode: "901605", lines: ["901605:A:1"], timing: "travel", instructions: [LOCATE, { verb: "EndTravel", when: FAILED }, LOST_IF_FAILED] },
  { id: "901605:shadow:1", cardCode: "901605", lines: ["901605:A:2"], timing: "shadow", instructions: [{ verb: "TriggerLost", mode: "chooseOne" }] },

  // 901606 Bottomless Chasm. A:1: for each progress placed on it the first player chooses a card in any player's hand and it is discarded. A:2: when the attack destroys a character the defending player discards his hand.
  {
    id: "901606:forced:1",
    cardCode: "901606",
    lines: ["901606:A:1"],
    timing: "forced",
    trigger: "progressPlaced",
    instructions: [{ verb: "Repeat", times: { x: true }, instructions: [{ verb: "Pick", pick: { type: "card", control: "any", from: "hand", who: "firstPlayer" } }, { verb: "DiscardPicked" }] }],
  },
  { id: "901606:shadow:1", cardCode: "901606", lines: ["901606:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "DiscardHand", when: DESTROYED_A_CHARACTER }] }] },

  // 901607 Dreadful Deep. When Revealed: starting with the first player each player chooses a different Lost effect and triggers it. Shadow: the defending player makes a locate test; when it is failed the Lost effects trigger and the attacker returns to the staging area after the attack.
  { id: "901607:whenRevealed:1", cardCode: "901607", lines: ["901607:A:1"], timing: "whenRevealed", instructions: [{ verb: "TriggerLost", mode: "eachDifferent" }] },
  {
    id: "901607:shadow:1",
    cardCode: "901607",
    lines: ["901607:A:2"],
    timing: "shadow",
    instructions: [{ verb: "LocateTest" }, LOST_IF_FAILED, { verb: "AfterAttack", when: FAILED, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }],
  },

  // 901608 Lost and Helpless. Surge is a keyword. A:2: the first player attaches it to a hero of any player (discarded with no hero); it counts as a Condition attachment whose Lost effect discards the attached hero from play. A:3: with no card in his hand the defending character is discarded from play.
  { id: "901608:whenRevealed:1", cardCode: "901608", lines: ["901608:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "any" } }] },
  { id: "901608:constant:1", cardCode: "901608", lines: ["901608:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "901608:triggered:1", cardCode: "901608", lines: ["901608:A:2"], timing: "triggered", trigger: "lost", condition: ATTACHED, instructions: [{ verb: "Discard", target: { kind: "host" } }] },
  {
    id: "901608:shadow:1",
    cardCode: "901608",
    lines: ["901608:A:3"],
    timing: "shadow",
    instructions: [{ verb: "Pick", pick: { type: "character", control: "any", defending: true }, when: { kind: "handSize", max: 0 } }, { verb: "Discard", target: { kind: "picked" }, when: { kind: "handSize", max: 0 } }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
