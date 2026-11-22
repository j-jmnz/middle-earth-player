import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Return to Mirkwood Nightmare (deck 9009, data/printed/nightmare.json). The setup card makes the guard pay at the start of each quest phase (exhaust a hero or play a Tantrum again) and finds an Attercop when the last stage appears; its cards turn more of the encounter deck on the guard: effects that spread to every
// player, Isolation (no new guard), Befouled Equipment (no attachments, no discard pile), Wickedness and Mischief (a Tantrum again), the Spiders that come back from the discard pile. The deck prints no quest card.
// Rules: sotm.guarding-gollum, rr.forced, rr.then, rr.cannot, rr.destroy, rr.shadow-effects, rr.first-player, rr.active-location, sotm.removed-from-game (data/rules/entries.json); the readings are in docs/scenarios/shadows-of-mirkwood.md (Return to Mirkwood).
const ATTERCOP = "02139";
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const HAS_READY_HERO: Condition = { kind: "canPick", pick: READY_HERO };
const TANTRUM_IN_DISCARD: Condition = { kind: "encounterHas", piles: "discard", cardType: "treachery", trait: "Tantrum" };
const GUARDIAN_CHANGED: PickSpec = { type: "character", control: "any", names: ["Gollum"] };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };

// The topmost Tantrum card in the encounter discard pile becomes the picked card.
const TOPMOST_TANTRUM: Instruction = { verb: "PickDiscardTop", types: ["treachery"], trait: "Tantrum" };
const GUARDIAN = (...instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", seats: "guardian", instructions } as Instruction);

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900901 Return to Mirkwood Nightmare (setup card). A:2: at the beginning of the quest phase the guard chooses an option he can fully resolve: exhaust a ready hero, or resolve the When Revealed of the topmost Tantrum in the encounter discard pile (the card stays there); with neither he does
  // nothing (official: "you must choose an effect that you can fully resolve"). A:3: when stage 4A appears one Attercop is found in the encounter deck or its discard pile and added to the staging area, unrevealed, and the deck is shuffled.
  {
    id: "900901:forced:1",
    cardCode: "900901",
    lines: ["900901:A:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [
      {
        verb: "Choose",
        who: "guardian",
        options: [
          { id: "exhaust", requires: HAS_READY_HERO, instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }] },
          { id: "tantrum", requires: TANTRUM_IN_DISCARD, instructions: [TOPMOST_TANTRUM, { verb: "ResolveWhenRevealed" }] },
        ],
      },
    ],
  },
  {
    id: "900901:forced:2",
    cardCode: "900901",
    lines: ["900901:A:3"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Ambush"] } },
    instructions: [{ verb: "SearchMove", code: ATTERCOP, to: "staging" }, { verb: "ShuffleEncounterDeck" }],
  },

  // 900902 Ambushing Orcs. A shadow card it is dealt that targets the guard targets each other player too (each resolves it, the guard first).
  { id: "900902:constant:1", cardCode: "900902", lines: ["900902:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "shadowHitsAll", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 900903 Pursuing Warg-rider. Cannot be optionally engaged (it still engages by an engagement check). Forced: after the guard changes it engages the guard, from the staging area or from another player, and makes an immediate attack against him.
  { id: "900903:constant:1", cardCode: "900903", lines: ["900903:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "900903:forced:1",
    cardCode: "900903",
    lines: ["900903:A:2"],
    timing: "forced",
    trigger: "changedControl",
    subject: GUARDIAN_CHANGED,
    instructions: [{ verb: "EngageSeatWith", pick: GUARDIAN_CHANGED, controls: true }, { verb: "ImmediateAttack", when: { kind: "sourceIn", zone: "engaged" } }],
  },

  // 900904 Web-spinner. When Revealed: the guard exhausts a ready hero or Web-spinner gains surge, as he can resolve. Shadow: the guard exhausts a ready character he controls (Gollum is one).
  {
    id: "900904:whenRevealed:1",
    cardCode: "900904",
    lines: ["900904:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "guardian",
        options: [
          { id: "exhaust", requires: HAS_READY_HERO, instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }] },
          { id: "surge", instructions: [{ verb: "GainSurge" }] },
        ],
      },
    ],
  },
  { id: "900904:shadow:1", cardCode: "900904", lines: ["900904:A:2"], timing: "shadow", instructions: [GUARDIAN({ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } })] },

  // 900905 Deceptive Path. No progress while it is in the staging area. Forced: after it becomes the active location the discard pile is shuffled into the deck, cards are discarded until a location is, that location is revealed and made the active location (Deceptive Path goes back to the
  // staging area), then Deceptive Path is discarded (rr.then: only when a location was found and made active).
  { id: "900905:constant:1", cardCode: "900905", lines: ["900905:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "900905:forced:1",
    cardCode: "900905",
    lines: ["900905:A:2"],
    timing: "forced",
    trigger: "becameActive",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "location" }, { verb: "RevealCard" }, { verb: "MoveEncounterCard", to: "activeLocation" }, { verb: "Discard", target: { kind: "self" }, when: { kind: "matches", card: "picked", pick: { type: "location", control: "any" } } }],
  },

  // 900906 Web-wall. When Revealed: the topmost Spider enemy in the encounter discard pile is revealed and added to the staging area. Shadow: the guard discards every resource from each hero he controls.
  { id: "900906:whenRevealed:1", cardCode: "900906", lines: ["900906:A:1"], timing: "whenRevealed", instructions: [{ verb: "PickDiscardTop", types: ["enemy"], trait: "Spider" }, { verb: "RevealCard" }] },
  { id: "900906:shadow:1", cardCode: "900906", lines: ["900906:A:2"], timing: "shadow", instructions: [GUARDIAN({ verb: "Each", pick: { type: "hero", control: "you" }, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] })] },

  // 900907 Isolation. Surge. When Revealed: attached to the current quest, a Condition: every character loses ranged and sentinel, and the guard cannot change (the same lock as The Spiders' Ring: a change by choice or by a card that says "must").
  { id: "900907:whenRevealed:1", cardCode: "900907", lines: ["900907:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToQuest" }] },
  {
    id: "900907:constant:1",
    cardCode: "900907",
    lines: ["900907:A:2"],
    timing: "constant",
    instructions: [
      { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
      { verb: "ModifyStat", stat: "loseRanged", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } },
      { verb: "ModifyStat", stat: "loseSentinel", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } },
      { verb: "ModifyStat", stat: "guardianLocked", amount: 1, until: "whileSourceInPlay", target: "table" },
    ],
  },

  // 900908 Befouled Equipment. When Revealed: the guard discards every attachment he controls, then every card in his discard pile is removed from the game, those just discarded included; with no attachment discarded the card gains surge. Shadow: the guard discards every attachment he controls.
  {
    id: "900908:whenRevealed:1",
    cardCode: "900908",
    lines: ["900908:A:1"],
    timing: "whenRevealed",
    instructions: [GUARDIAN({ verb: "DiscardEach", pick: { type: "attachment", control: "you" } }, { verb: "RemoveDiscardFromGame" }), { verb: "GainSurge", when: { kind: "noneDiscarded" } }],
  },
  { id: "900908:shadow:1", cardCode: "900908", lines: ["900908:A:2"], timing: "shadow", instructions: [GUARDIAN({ verb: "DiscardEach", pick: { type: "attachment", control: "you" } })] },

  // 900909 Wickedness and Mischief. When Revealed: the guard reveals the topmost Tantrum in the encounter discard pile (it is revealed again and goes back to the pile) or 2 more encounter cards, as he can resolve. Shadow: the topmost Tantrum in the discard pile is dealt as one more shadow card for this attack.
  {
    id: "900909:whenRevealed:1",
    cardCode: "900909",
    lines: ["900909:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "guardian",
        options: [
          { id: "tantrum", requires: TANTRUM_IN_DISCARD, instructions: [TOPMOST_TANTRUM, { verb: "RevealCard" }] },
          { id: "reveal", instructions: [{ verb: "RevealEncounter", times: 2 }] },
        ],
      },
    ],
  },
  { id: "900909:shadow:1", cardCode: "900909", lines: ["900909:A:2"], timing: "shadow", instructions: [{ verb: "DealShadowFromDiscard", trait: "Tantrum" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
