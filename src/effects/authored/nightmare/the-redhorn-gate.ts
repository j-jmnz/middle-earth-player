import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// The Redhorn Gate Nightmare (deck 9013, data/printed/nightmare.json). The setup card sets the two Blinding Blizzards aside, makes the player cards in the victory display worth nothing, and shuffles the Blizzards into the encounter deck when stage 2B is revealed (beside 2B's own
// When Revealed, faq.simultaneous-effects); side B is the recipe the build applies (its lines are inert). The cards put Snow cards into the staging area and take willpower and progress away. The readings are in docs/scenarios/dwarrowdelf.md (The Redhorn Gate).
// Rules: dwd.caradhras, rr.reveal, rr.staging, rr.travel, rr.victory, rr.defending-player, rr.then, rr.lasting-effects, faq.simultaneous-effects, faq.lasting-effects (data/rules/entries.json).
const BLIZZARD = "901307";
const FREEZING_COLD = "04023";
const SNOWSTORM_STAGE = "Snowdrifts";
const SNOW_IN_STAGING: PickSpec = { type: "card", control: "any", stagingOnly: true, trait: "Snow" };
const DEFENDER_FEW_WILLPOWER: Condition = { kind: "matches", card: "defender", pick: { type: "character", control: "any", maxWillpower: 1 } };
const THREE_OR_MORE_PLAYERS: Condition = { kind: "count", pick: { type: "player", control: "any" }, min: 3 };

// The Shadow Icy Cavern and Frozen Silverlode print: the defender gets -1 Willpower for the attack (a duration the card does not print: agent recommendation) and the attacker is dealt another shadow card.
const DEFENDER_COLD: Effect["instructions"] = [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfAttack", target: "defender" }, { verb: "DealShadowTo", target: "attacker" }];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 901301 setup card. A:2 Setup: the Blinding Blizzards are set aside; during this game player cards in the victory display count no victory points (a flag on the table, read by the victory amount, the stage's bar and the score: agent recommendation for the score).
  // A:3: when stage 2B is revealed every set-aside Blizzard is shuffled into the encounter deck (two copies), which is shuffled.
  {
    id: "901301:setup:1",
    cardCode: "901301",
    lines: ["901301:A:2"],
    timing: "setup",
    instructions: [{ verb: "SetAsideFromDeck", code: BLIZZARD }, { verb: "ModifyStat", stat: "playerVictoryIgnored", amount: 1, until: "endOfGame", target: "table" }],
  },
  {
    id: "901301:forced:1",
    cardCode: "901301",
    lines: ["901301:A:3"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: [SNOWSTORM_STAGE] } },
    instructions: [{ verb: "Repeat", times: 2, instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: BLIZZARD }] }, { verb: "ShuffleEncounterDeck" }],
  },

  // 901302 Wolfpelt Goblin (Surge is a keyword). Forced: after it engages a player, that player deals X damage to a character he controls, X the active location's remaining quest points (0 with none); then 2 progress come off the active location, if able.
  {
    id: "901302:forced:1",
    cardCode: "901302",
    lines: ["901302:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "you" } },
      { verb: "DamageCard", amount: { remainingQuestPoints: "activeLocation" }, target: "picked" },
      { verb: "RemoveProgressFrom", amount: 2, target: "activeLocation" },
    ],
  },

  // 901303 Silvertine Marauder: +2 Attack while it attacks a defending character with less than 2 Willpower (modifiers counted; none when undefended). Shadow: the same for the attacking enemy.
  {
    id: "901303:constant:1",
    cardCode: "901303",
    lines: ["901303:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "self", when: { kind: "versusDefender", maxWillpower: 1 } }],
  },
  {
    id: "901303:shadow:1",
    cardCode: "901303",
    lines: ["901303:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: DEFENDER_FEW_WILLPOWER }],
  },

  // 901304 Snow-Giant. A:1: in the staging area it attacks the first player at the beginning of the combat phase, as an engaged enemy would, and stays there (recommended timing, as The Nameless Fear's Blocked by Flame). A:2: after it engages you,
  // you discard the ally you control with the highest Willpower (your choice among those tied; Arwen included).
  {
    id: "901304:forced:1",
    cardCode: "901304",
    lines: ["901304:A:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "staging" }] },
    instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }],
  },
  {
    id: "901304:forced:2",
    cardCode: "901304",
    lines: ["901304:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", highestWillpower: true } }, { verb: "DiscardPicked" }],
  },

  // 901305 Icy Cavern: X is the number of Snow cards in the staging area, of any type, itself included. Travel: a Freezing Cold is searched out of the encounter deck and discard pile and revealed in full (the players cannot travel with none to find), then the deck is shuffled.
  { id: "901305:constant:1", cardCode: "901305", lines: ["901305:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: SNOW_IN_STAGING }, until: "whileSourceInPlay" }] },
  { id: "901305:travel:1", cardCode: "901305", lines: ["901305:A:2"], timing: "travel", instructions: [{ verb: "SearchReveal", code: FREEZING_COLD, who: "actor", cost: true }, { verb: "ShuffleEncounterDeck" }] },
  { id: "901305:shadow:1", cardCode: "901305", lines: ["901305:A:3"], timing: "shadow", instructions: DEFENDER_COLD },

  // 901306 Frozen Silverlode: while it is in the staging area no character gains Willpower from a player card effect (reductions still apply). Shadow: Icy Cavern's.
  { id: "901306:constant:1", cardCode: "901306", lines: ["901306:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "noWillpowerGain", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "901306:shadow:1", cardCode: "901306", lines: ["901306:A:2"], timing: "shadow", instructions: DEFENDER_COLD },

  // 901307 Blinding Blizzard. A:1 is Escape from Khazad-dûm's: heroes do not collect resources while it is in play. A:2 When Revealed: it stays in the staging area and holds `progressRedirect` (families/quest/blizzard.ts): the progress that would go on the current quest or on a Snow location
  // goes on it, and its 5th progress token discards it.
  { id: "901307:constant:1", cardCode: BLIZZARD, lines: ["901307:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noCollection", amount: 1, until: "whileSourceInPlay", target: "heroes" }] },
  { id: "901307:whenRevealed:1", cardCode: BLIZZARD, lines: ["901307:A:2"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "progressRedirect", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 901308 Caradhras the Cruel. When Revealed: every Snow card in the encounter discard pile, of any type, goes on top of the encounter deck in a random order; then the top card is revealed (the top 2 cards with 3 or 4 players).
  {
    id: "901308:whenRevealed:1",
    cardCode: "901308",
    lines: ["901308:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ReturnFromDiscard", trait: "Snow", anyType: true, to: "deckTop", order: "random" },
      { verb: "RevealEncounter" },
      { verb: "RevealEncounter", when: THREE_OR_MORE_PLAYERS },
    ],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
