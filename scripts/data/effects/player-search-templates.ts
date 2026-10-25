// Player card templates: cancel, look at and search, temporary play, play from a discard pile, and delayed triggers.
import { count, SPHERES } from "./template-kit.ts";
import type { Template } from "./template-kit.ts";

export const PLAYER_SEARCH_TEMPLATES: readonly Template[] = [
  // Cancel, look at, and search.
  {
    id: "response-cancel-when-revealed",
    pattern: /^Response: Cancel the "when revealed" effects of a card that was just revealed from the encounter deck\.$/,
    build: () => [{ timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] }],
  },
  {
    id: "response-cancel-shadow-effect",
    pattern: /^Response: Cancel a shadow effect just triggered during combat\.$/,
    build: () => [{ timing: "response", trigger: "shadowPending", instructions: [{ verb: "CancelEffect" }] }],
  },
  {
    id: "action-exhaust-look-at-encounter-top",
    pattern: /^Action: Exhaust \{self\} to look at the top card of the encounter deck\.$/,
    build: () => [{ timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "LookAtEncounterTop" }] }],
  },
  {
    id: "response-played-search-top-attachment-into-play",
    pattern: /^Response: After you play \{self\} from your hand, search the top (\d+) cards of your deck for an attachment of cost (\d+) or less and put it into play\. Put the remaining cards back in any order\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "played",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: count(match[1]), cardType: "attachment", maxCost: count(match[2]) } },
          { verb: "Pick", pick: { type: "character", control: "any", hostForPicked: true } },
          { verb: "AttachPicked" },
          { verb: "ArrangeTop" },
        ],
      },
    ],
  },
  {
    id: "response-enters-play-search-deck-for-trait-attachment",
    pattern: /^Response: After \{self\} enters play, search your deck for an? (\w+) attachment and add it to your hand\. Shuffle your deck\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "enteredPlay",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", trait: match[1] ?? "" } },
          { verb: "MovePicked", to: "hand" },
          { verb: "ShuffleDeck" },
        ],
      },
    ],
  },
  // Temporary play, play from a discard pile, and delayed triggers.
  {
    id: "action-put-ally-into-play-then-return",
    pattern: /^Action: Put 1 ally card into play from your hand\. At the end of the phase, if that ally is still in play, return it to your hand\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "ally", control: "you", from: "hand", intoPlay: true } },
          { verb: "MovePicked", to: "play" },
          { verb: "Delay", until: "endOfPhase", subject: "picked", instructions: [{ verb: "ReturnToHand" }] },
        ],
      },
    ],
  },
  {
    id: "action-self-attack-then-shuffle-into-deck",
    pattern: /^Action: \{self\} gains \+(\d+) Attack until the end of the phase\. At the end of the phase in which you trigger this effect, shuffle \{self\} back into your deck\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          { verb: "ModifyStat", stat: "attack", amount: count(match[1]), until: "endOfPhase", target: "self" },
          { verb: "Delay", until: "endOfPhase", instructions: [{ verb: "ShuffleSelfIntoDeck" }] },
        ],
      },
    ],
  },
  {
    id: "action-ally-of-cost-x-from-any-discard-into-play",
    pattern: /^Action: Choose an ally with a printed cost of X in any player's discard pile\. Put that ally into play under your control\.(?: \(The chosen ally can belong to any sphere of influence\.\))?$/,
    build: () => [
      {
        timing: "action",
        instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", from: "discard", costIsX: true, intoPlay: true } }, { verb: "MovePicked", to: "play" }],
      },
    ],
  },
  {
    id: "action-return-sphere-card-from-discard",
    pattern: /^Action: Return 1 (Spirit|Leadership|Tactics|Lore) card from your discard pile to your hand\.$/,
    build: (match) => {
      const sphere = SPHERES[match[1] ?? ""];
      return sphere
        ? [{ timing: "action", instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "discard", sphere } }, { verb: "MovePicked", to: "hand" }] }]
        : null;
    },
  },
  {
    id: "response-played-return-topmost-attachment",
    pattern: /^Response: After you play \{self\}, return the topmost attachment in any player's discard pile to his hand\.$/,
    build: () => [
      {
        timing: "response",
        trigger: "played",
        instructions: [{ verb: "Pick", pick: { type: "card", control: "any", from: "discard", cardType: "attachment", topmost: true } }, { verb: "MovePicked", to: "hand" }],
      },
    ],
  },
  {
    id: "attach-to-active-location-quest-points",
    pattern: /^Attach to the active location\. Attached location gets \+(\d+) quest points?\.$/,
    build: (match) => [
      {
        timing: "constant",
        instructions: [
          { verb: "AttachesTo", host: { kind: "activeLocation" } },
          { verb: "ModifyStat", stat: "questPoints", amount: count(match[1]), until: "whileSourceInPlay", target: "host" },
        ],
      },
    ],
  },
  {
    id: "response-attached-location-explored-first-player-ally",
    pattern: /^Response: After attached location leaves play as an explored location, the first player puts 1 ally into play from his hand\.$/,
    build: () => [
      {
        timing: "response",
        trigger: "hostLeftPlay",
        condition: { kind: "subjectExplored" },
        instructions: [
          { verb: "Pick", pick: { type: "ally", control: "you", from: "hand", intoPlay: true, who: "firstPlayer" } },
          { verb: "MovePicked", to: "play", who: "firstPlayer" },
        ],
      },
    ],
  },
];
