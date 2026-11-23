import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for Return to Mirkwood (shadows-of-mirkwood cycle part 6, no campaign card). The player guarding Gollum is the controller of the Gollum objective ally (02130); the records name him with `who: "guardian"` and a ForEachPlayer with `seats: "guardian"` (src/rules/families/guardian/).
// Rules: sotm.guarding-gollum, sotm.setup-return-to-mirkwood, rr.first-player, rr.forced, rr.then, rr.cannot, rr.destroy, rr.active-location, rr.staging, rr.in-play-and-out-of-play (data/rules/entries.json); the readings are in docs/scenarios/shadows-of-mirkwood/return-to-mirkwood.md (Return to Mirkwood).
const GOLLUM = "02130";
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const OTHER_PLAYER: PickSpec = { type: "player", control: "other" };

// "The player guarding Gollum may choose a new player" (02130:A:2, 02134:A:1): the guard picks another player still in the game; nothing happens when a card says the guard cannot change or he is alone ("if able", 02135:A:1).
type Choice = Extract<Instruction, { verb: "Choose" }>;
const CHANGE: Choice["options"][number]["instructions"] = [{ verb: "Pick", pick: OTHER_PLAYER }, { verb: "ChangeGuardian" }];
const CAN_CHANGE: Condition = { kind: "guardianCanChange" };
// "That player must choose a new player to guard Gollum, if able" (the Tantrum cards, 02135:A:1, 02136:A:1, 02137:A:1): only the player who guarded him before the effect chooses, after the sentence before it, whether or not that did anything (docs/scenarios/shadows-of-mirkwood/return-to-mirkwood.md, Return to Mirkwood).
const MUST_CHANGE: Instruction = { verb: "Choose", who: "guardian", options: [{ id: "change", requires: CAN_CHANGE, instructions: CHANGE }] };
const GUARDIAN = (...instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", seats: "guardian", instructions } as Instruction);

const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 02126 Through the Forest (stage 1). Setup: Gollum is found (set aside, or in the encounter deck), the first player chooses who guards him and he is placed in front of that player, the deck is shuffled and one card for each player is revealed.
  {
    id: "02126:setup:1",
    cardCode: "02126",
    lines: ["02126:A:1"],
    timing: "setup",
    instructions: [{ verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } }, { verb: "GuardGollum", code: GOLLUM }, { verb: "ShuffleEncounterDeck" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
  },

  // 02127 Escape Attempt (stage 2). The guard cannot commit unless he is the only player left. Quest unsuccessfully (a tie is not unsuccessful, ltp.quest-resolution): Gollum escapes and the players have lost.
  { id: "02127:constant:1", cardCode: "02127", lines: ["02127:B:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "commit", guardian: true, exceptAlone: true }] },
  { id: "02127:triggered:1", cardCode: "02127", lines: ["02127:B:2"], timing: "triggered", trigger: "questFailed", instructions: [{ verb: "LoseGame", reason: "Gollum escaped" }] },

  // 02128 To the Elvin King's Halls (stage 3). The guard cannot play cards from his hand (a card put into play is not played, rr.play-and-put-into-play).
  { id: "02128:constant:1", cardCode: "02128", lines: ["02128:B:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "playFromHand", guardian: true }] },

  // 02129 Ambush (stage 4, the last). Forced: at the beginning of the combat phase every enemy in play, in the staging area or engaged with another player, engages the guard. The stage cannot be defeated while any enemy is in play.
  {
    id: "02129:forced:1",
    cardCode: "02129",
    lines: ["02129:B:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Combat" },
    instructions: [{ verb: "EngageAll", who: "guardian", inPlay: true }],
  },
  { id: "02129:constant:1", cardCode: "02129", lines: ["02129:B:2"], timing: "constant", condition: { kind: "enemyInPlay", is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 02130 Gollum (an objective ally under the guard). A:1: the damage of an undefended attack against the guard goes to Gollum; his leaving play, by destruction or any other way, loses the game (sotm.guarding-gollum: he is an ally that cannot attack, defend or commit), and so does the elimination of the guard,
  // which sends Gollum out of play with the rest of his cards. A:2: at the end of each round the guard raises his threat by 3 (the +1 of the refresh phase has been raised already), then he may choose a new player to guard Gollum.
  {
    id: "02130:constant:1",
    cardCode: "02130",
    lines: ["02130:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "undefendedToHolder", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "lossOnLeavingPlay", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotDefend", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", target: "self" },
    ],
  },
  {
    id: "02130:forced:1",
    cardCode: "02130",
    lines: ["02130:A:2"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [GUARDIAN({ verb: "RaiseThreat", amount: 3, who: "actor" }), { verb: "Choose", who: "guardian", options: [{ id: "change", requires: CAN_CHANGE, instructions: CHANGE }, { id: "keep", instructions: [] }] }],
  },

  // 02131 The Spiders' Ring. While it is the active location the guard cannot change. Shadow: if undefended, the active location returns to the staging area and this card, the shadow card, becomes the active location.
  { id: "02131:constant:1", cardCode: "02131", lines: ["02131:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "guardianLocked", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "02131:shadow:1", cardCode: "02131", lines: ["02131:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "activeLocation", when: { kind: "undefended" } }] },

  // 02132 Dry Watercourse. While it is the active location the effects of a treachery card (When Revealed or Shadow) that target the guard target each other player too.
  { id: "02132:constant:1", cardCode: "02132", lines: ["02132:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "treacheryHitsAll", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 02133 Woodman's Glade. Travel: the guard exhausts a hero he controls (no ready hero, no travel). Response: after it is explored each player not guarding Gollum reduces his threat by 2.
  { id: "02133:travel:1", cardCode: "02133", lines: ["02133:A:1"], timing: "travel", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", seats: "guardian", instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }] }] },
  {
    id: "02133:response:1",
    cardCode: "02133",
    lines: ["02133:A:2"],
    timing: "response",
    trigger: "activeExplored",
    subject: "self",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", seats: "otherThanGuardian", instructions: [{ verb: "LowerThreat", amount: 2, who: "actor" }] }],
  },

  // 02134 Wood Elf Path. Response: after the players travel there the guard may choose a new player to guard Gollum.
  { id: "02134:response:1", cardCode: "02134", lines: ["02134:A:1"], timing: "response", trigger: "traveled", answeredBy: "guardian", condition: CAN_CHANGE, instructions: [...CHANGE] },

  // 02135 Gollum's Anguish. When Revealed: the guard raises his threat by 8, then chooses a new player. Shadow: the guard raises his threat by 4 (whoever the attack is against).
  { id: "02135:whenRevealed:1", cardCode: "02135", lines: ["02135:A:1"], timing: "whenRevealed", instructions: [GUARDIAN({ verb: "RaiseThreat", amount: 8, who: "actor" }), MUST_CHANGE] },
  { id: "02135:shadow:1", cardCode: "02135", lines: ["02135:A:2"], timing: "shadow", instructions: [GUARDIAN({ verb: "RaiseThreat", amount: 4, who: "actor" })] },

  // 02136 Gollum's Bite. When Revealed: 4 damage to a hero the guard controls (he chooses), then he chooses a new player. Shadow: 2 damage to a hero he controls.
  { id: "02136:whenRevealed:1", cardCode: "02136", lines: ["02136:A:1"], timing: "whenRevealed", instructions: [GUARDIAN({ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "DamageCard", amount: 4, target: "picked" }), MUST_CHANGE] },
  { id: "02136:shadow:1", cardCode: "02136", lines: ["02136:A:2"], timing: "shadow", instructions: [GUARDIAN({ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "DamageCard", amount: 2, target: "picked" })] },

  // 02137 Wasted Provisions. When Revealed: the top 10 cards of the guard's deck are discarded, then he chooses a new player. Shadow: the top 5.
  { id: "02137:whenRevealed:1", cardCode: "02137", lines: ["02137:A:1"], timing: "whenRevealed", instructions: [GUARDIAN({ verb: "DiscardFromDeck", amount: 10 }), MUST_CHANGE] },
  { id: "02137:shadow:1", cardCode: "02137", lines: ["02137:A:2"], timing: "shadow", instructions: [GUARDIAN({ verb: "DiscardFromDeck", amount: 5 })] },

  // 02138 Mirkwood Bats. Forced: after it engages a player (any player), 1 damage to each character the guard controls, Gollum included.
  {
    id: "02138:forced:1",
    cardCode: "02138",
    lines: ["02138:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [GUARDIAN({ verb: "Each", pick: { type: "character", control: "you" }, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] })],
  },

  // 02139 Attercop, Attercop. Forced: at the beginning of the encounter phase it engages the guard, from the staging area or from another player, whatever his threat.
  {
    id: "02139:forced:1",
    cardCode: "02139",
    lines: ["02139:A:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Encounter" },
    instructions: [{ verb: "EngageSeatWith", pick: { type: "character", control: "you", names: ["Gollum"] }, controls: true }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
