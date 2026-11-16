import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// The Hills of Emyn Muil Nightmare (deck 9007, data/printed/nightmare.json). The setup card caps the progress a location in the staging area can take at 1 a round (the printed line of 18067:B:1, copied); the deck has no quest card of its own. Its encounter cards
// dig at the players (Tunneling Nameless Thing engages the first player after every travel, Orc Interceptor grows with each location explored, Brambles and Thorns hurts each character that quests, A Hurrying Darkness makes each player pay in threat or cards),
// keep the Hazards coming (Hazardous Terrain shuffles them back, Sarn Gebir Rapids makes their When Revealed effects uncancelable) and take progress back (Blast of Savage Wind, Retraced Steps).
// Rules: rr.forced, rr.lasting-effects, faq.lasting-effects, rr.cancel, rr.first-player, rr.victory, rr.damage, rr.active-location (data/rules/entries.json).
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const NO_ACTIVE_LOCATION: Condition = { kind: "not", condition: { kind: "canPick", pick: { type: "location", control: "any", active: true } } };
const EMYN_MUIL_LOCATION: PickSpec = { type: "location", control: "any", trait: "Emyn Muil" };
const ANY_LOCATION: PickSpec = { type: "location", control: "any" };
// "Shuffle all Hazard cards in the encounter discard pile back into the encounter deck" (900708:A:2, A:3).
const SHUFFLE_HAZARDS: Instruction = { verb: "ShuffleEncounterDiscard", trait: "Hazard" };
const REMOVE_EMYN_MUIL_PROGRESS: Instruction = { verb: "RemoveAllProgress", pick: EMYN_MUIL_LOCATION };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900701 The Hills of Emyn Muil Nightmare (setup card). A:1 prints nothing the engine reads; A:2 is the progress cap of 18067:B:1, written again here because the shipped ledger holds no Nightmare card for a copy to compare (each location in the staging area takes at most 1 progress a round; the active location is not capped).
  { id: "900701:constant:1", cardCode: "900701", lines: ["900701:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressCap", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },

  // 900702 Tunneling Nameless Thing. Forced: after the players travel to a location it engages the first player, from the staging area or from another player. While no location is active it returns to the staging area (a state, not a Forced effect; the printed line adds no bar on engaging it).
  { id: "900702:forced:1", cardCode: "900702", lines: ["900702:A:1"], timing: "forced", trigger: "traveled", subject: ANY_LOCATION, instructions: [{ verb: "EngageFirstPlayer", moves: true }] },
  { id: "900702:constant:1", cardCode: "900702", lines: ["900702:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "returnsWithoutActive", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 900703 Orc Interceptor. +1 Threat and +1 Attack for each resource token on it. Forced: after a location leaves play as an explored location it takes a resource token.
  {
    id: "900703:constant:1",
    cardCode: "900703",
    lines: ["900703:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "900703:forced:1", cardCode: "900703", lines: ["900703:A:2"], timing: "forced", trigger: "locationExplored", subject: ANY_LOCATION, instructions: [{ verb: "PlaceToken", amount: 1 }] },

  // 900704 Brambles and Thorns. Forced: after a character commits to the quest it takes 1 damage unless another copy already dealt it damage this round (any copy in the staging area or active hears it; each character is hurt once a round).
  { id: "900704:forced:1", cardCode: "900704", lines: ["900704:A:1"], timing: "forced", trigger: "committed", subject: { type: "character", control: "any" }, instructions: [{ verb: "DamageOncePerRound", amount: 1 }] },

  // 900705 Sarn Gebir Rapids. While active, the When Revealed effects of Hazard cards cannot be canceled.
  { id: "900705:constant:1", cardCode: "900705", lines: ["900705:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "UncancelableWhenRevealed", trait: "Hazard" }] },

  // 900706 A Hurrying Darkness. Each player, the first player first, either raises his threat by 5 or reveals an additional encounter card and adds it to the staging area. Shadow: +X Attack, X the Threat of the active location.
  {
    id: "900706:whenRevealed:1",
    cardCode: "900706",
    lines: ["900706:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 5, who: "actor" }] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
      },
    ],
  },
  { id: "900706:shadow:1", cardCode: "900706", lines: ["900706:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "threat", of: "activeLocation" }, until: "endOfAttack", target: "attacker" }] },

  // 900707 Blast of Savage Wind (Surge and Doomed 2 are keywords). When Revealed: all progress comes off each Emyn Muil location in play, and each Emyn Muil location gets +2 Threat until the end of the round, one that arrives later this round too (faq.lasting-effects). Shadow: the same removal.
  {
    id: "900707:whenRevealed:1",
    cardCode: "900707",
    lines: ["900707:A:2"],
    timing: "whenRevealed",
    instructions: [REMOVE_EMYN_MUIL_PROGRESS, { verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfRound", target: "locationsInPlay", trait: "Emyn Muil" }],
  },
  { id: "900707:shadow:1", cardCode: "900707", lines: ["900707:A:3"], timing: "shadow", instructions: [REMOVE_EMYN_MUIL_PROGRESS] },

  // 900708 Hazardous Terrain (Surge and Doomed are keywords). When Revealed: the Hazard cards of the encounter discard pile are shuffled back into the encounter deck. Shadow: the same, then another shadow card is dealt to the attack.
  { id: "900708:whenRevealed:1", cardCode: "900708", lines: ["900708:A:2"], timing: "whenRevealed", instructions: [SHUFFLE_HAZARDS] },
  { id: "900708:shadow:1", cardCode: "900708", lines: ["900708:A:3"], timing: "shadow", instructions: [SHUFFLE_HAZARDS, { verb: "DealShadow", additional: true }] },

  // 900709 Retraced Steps. When Revealed: a random Emyn Muil location of the victory display goes to the encounter discard pile.
  { id: "900709:whenRevealed:1", cardCode: "900709", lines: ["900709:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardRandomVictoryLocation", trait: "Emyn Muil" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
