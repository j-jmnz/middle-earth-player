import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { mayBypass, whenDefeated } from "../mount-gundabad.ts";
import { withCopies } from "../reprint.ts";
import { flipAtStagingStep } from "../dwarrowdelf/flight-from-moria.ts";

// Flight from Moria Nightmare (deck 9012, data/printed/nightmare.json). The setup card shuffles a bypassed stage into the quest deck and limits the Refresh Action of Abandoned Tools; side B is the recipe the build applies (its lines are inert). The three new stage 2s are Flight from Moria's shape
// (../dwarrowdelf/flight-from-moria.ts: flipped at the staging step, bypassed at the end of the combat phase) and the five new encounter cards read The Nameless Fear's stats and the victory display.
// Rules: dwd.the-nameless-fear, dwd.bypassing-a-quest-card, dwd.creating-the-quest-deck, rr.forced, rr.first-player, rr.search, rr.victory, faq.additional-attacks (data/rules/entries.json); the readings are in docs/brief.md (Flight from Moria).
const NAMELESS = "The Nameless Fear";
const NAMELESS_FEAR: PickSpec = { type: "enemy", control: "any", staging: true, names: [NAMELESS] };
const FEAR_THREAT = { stat: "threat", ofNamed: NAMELESS } as const;
const VICTORY_POINTS = { victoryPoints: true } as const;
const GOBLIN_SPEARMAN = "03031";
const SHADOWED_CORRIDOR_COST = 2;
const QUESTING_CHARACTER: PickSpec = { type: "character", control: "any", committed: true };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// Dismay and Fear: the Willpower removed so far is still below The Nameless Fear's Threat, and another questing character is left to remove. The removal and the count read only the first part: they follow the Pick, and the character picked last may be the last one.
const BELOW_THREAT: Condition = { kind: "less", left: { x: true }, right: FEAR_THREAT };
const REMOVING: Condition = { kind: "all", conditions: [BELOW_THREAT, { kind: "canPick", pick: { ...QUESTING_CHARACTER, who: "firstPlayer" } }] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 901201 setup card. A:2: a bypassed stage is shuffled into the quest deck, which is shuffled, and the top stage is revealed (the stage can come straight back). A:3: while Escape from Darkness is the current quest the Refresh Action of Abandoned Tools can be used once a round.
  { id: "901201:constant:1", cardCode: "901201", lines: ["901201:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "bypassShuffles", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "901201:constant:2",
    cardCode: "901201",
    lines: ["901201:A:3"],
    timing: "constant",
    condition: { kind: "inPlay", code: "03076", is: true },
    instructions: [{ verb: "ModifyStat", stat: "refreshOnce", amount: 1, until: "whileSourceInPlay", target: "table" }],
  },

  // 901202 Search for an Exit (Pursued by Shadow, 5 quest points). B:1: at the end of the round the encounter discard pile is shuffled into the encounter deck, the top 5 cards are discarded and the When Revealed of each A Foe Beyond among them resolves in the order discarded.
  // B:2: no more than 1 progress a round. B:3: defeating it wins. B:4: bypass.
  flipAtStagingStep("901202"),
  {
    id: "901202:forced:2",
    cardCode: "901202",
    lines: ["901202:B:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardEncounterTop", count: 5, reset: true }, { verb: "ResolveWhenRevealedOf", of: "looked", name: "A Foe Beyond" }],
  },
  { id: "901202:constant:1", cardCode: "901202", lines: ["901202:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  whenDefeated("901202:forced:3", "901202", "901202:B:3", [{ verb: "WinGame" }]),
  mayBypass("901202:forced:4", "901202", "901202:B:4"),

  // 901203 Search for an Exit (Blocked by Flame, no quest points, Victory 1). B:1: The Nameless Fear attacks each player in turn order at the start of the combat phase, dealt a new shadow card for each attack, and every character may be declared as an attacker against it in the staging area.
  // B:2: with 10 or more damage on it all its damage is removed and the stage is defeated. B:3: bypass.
  flipAtStagingStep("901203"),
  {
    id: "901203:forced:2",
    cardCode: "901203",
    lines: ["901203:B:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Combat" },
    instructions: [{ verb: "Pick", pick: NAMELESS_FEAR }, EACH_PLAYER([{ verb: "AttackFromStaging" }])],
  },
  { id: "901203:constant:1", cardCode: "901203", lines: ["901203:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackableByAny", amount: 1, until: "whileSourceInPlay", holders: NAMELESS_FEAR }] },
  {
    id: "901203:forced:3",
    cardCode: "901203",
    lines: ["901203:B:2"],
    timing: "forced",
    trigger: "damaged",
    subject: NAMELESS_FEAR,
    condition: { kind: "less", left: 9, right: { stat: "damage", ofNamed: NAMELESS } },
    instructions: [{ verb: "Heal", all: true, target: "subject" }, { verb: "AdvanceStage" }],
  },
  mayBypass("901203:forced:4", "901203", "901203:B:3"),

  // 901204 Search for an Exit (Ghâsh, 1 quest point, Victory 1). B:1: each questing character takes 1 damage as it is flipped. B:2: bypass.
  flipAtStagingStep("901204"),
  { id: "901204:whenRevealed:1", cardCode: "901204", lines: ["901204:B:1"], timing: "whenRevealed", instructions: [{ verb: "Each", pick: QUESTING_CHARACTER, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] }] },
  mayBypass("901204:forced:2", "901204", "901204:B:2"),

  // 901205 Swarming Goblins (Surge is a keyword). A:2: while engaged with a player it gains a Forced effect: when a stage is bypassed that player's copy searches the encounter discard pile for a Goblin Spearman and puts it into play engaged with him.
  {
    id: "901205:forced:1",
    cardCode: "901205",
    lines: ["901205:A:2"],
    timing: "forced",
    trigger: "stageBypassed",
    eventSeat: "you",
    condition: { kind: "engagedWithActor" },
    instructions: [{ verb: "SearchMove", code: GOBLIN_SPEARMAN, to: "engaged", discardOnly: true }],
  },

  // 901206 Coal-Black Orc: Threat and Attack are X, X the Victory points of the victory display. Shadow: the attacker gets +X Attack.
  {
    id: "901206:constant:1",
    cardCode: "901206",
    lines: ["901206:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "threat", amount: VICTORY_POINTS, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "attack", amount: VICTORY_POINTS, until: "whileSourceInPlay" }],
  },
  { id: "901206:shadow:1", cardCode: "901206", lines: ["901206:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: VICTORY_POINTS, until: "endOfAttack", target: "attacker" }] },

  // 901207 Shadowed Corridor. A:1: each copy in play makes every bypass cost each player 2 threat. Shadow: a hero defender's resources are discarded and the attacker is dealt another shadow card for each.
  {
    id: "901207:constant:1",
    cardCode: "901207",
    lines: ["901207:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "bypassThreat", amount: SHADOWED_CORRIDOR_COST, until: "whileSourceInPlay", target: "table" }],
  },
  {
    id: "901207:shadow:1",
    cardCode: "901207",
    lines: ["901207:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "you", defending: true }, when: { kind: "canPick", pick: { type: "hero", control: "you", defending: true } } },
      { verb: "AddToX", amount: { stat: "resources", of: "picked" }, when: { kind: "canPick", pick: { type: "hero", control: "you", defending: true } } },
      { verb: "DiscardResources", all: true, target: "picked", when: { kind: "canPick", pick: { type: "hero", control: "you", defending: true } } },
      { verb: "Repeat", times: { x: true }, instructions: [{ verb: "DealShadowTo", target: "attacker" }] },
    ],
  },

  // 901208 Dismay and Fear. When Revealed: the first player chooses questing characters of any player one at a time and each is removed from the quest, until the Willpower removed is at least The Nameless Fear's Threat or none is left. Shadow: each attachment the defending player controls with a printed cost
  // below The Nameless Fear's Threat is discarded.
  {
    id: "901208:whenRevealed:1",
    cardCode: "901208",
    lines: ["901208:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Repeat",
        times: { count: QUESTING_CHARACTER },
        instructions: [
          { verb: "Pick", pick: { ...QUESTING_CHARACTER, who: "firstPlayer" }, when: REMOVING },
          { verb: "RemoveFromQuest", when: BELOW_THREAT },
          { verb: "AddToX", amount: { stat: "willpower", of: "picked" }, when: BELOW_THREAT },
        ],
      },
    ],
  },
  {
    id: "901208:shadow:1",
    cardCode: "901208",
    lines: ["901208:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Each", pick: { type: "attachment", control: "you", minCost: 0 }, instructions: [{ verb: "Discard", target: { kind: "picked" }, when: { kind: "less", left: { stat: "cost", of: "picked" }, right: FEAR_THREAT } }] }],
  },

  // 901209 An Evil Fortune (Surge and Doomed 1 are keywords). When Revealed: it goes to the victory display. Shadow: when the attack destroys a character it goes to the victory display.
  { id: "901209:whenRevealed:1", cardCode: "901209", lines: ["901209:A:2"], timing: "whenRevealed", instructions: [{ verb: "AddSourceToVictory" }] },
  { id: "901209:shadow:1", cardCode: "901209", lines: ["901209:A:3"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "AddShadowToVictory", code: "901209", when: { kind: "x", min: 1 } }] }] },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
