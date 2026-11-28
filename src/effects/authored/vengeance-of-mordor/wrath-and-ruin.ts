import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_BLACK_GATE_OPENS } from "../return-of-the-king/the-black-gate-opens.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Wrath and Ruin (Vengeance of Mordor part 4, no campaign card): the stages Inside the Walls and Drive them Out, Thane Ulchor, Gate of Dorwinion, the locations and the Wrath and Ruin and Easterling cards the set adds. Every line is read from the scan ledger
// (data/printed/vengeance-of-mordor.json). The readings are in docs/scenarios/vengeance-of-mordor/wrath-and-ruin.md (Readings). The first player takes control of an explored location (TakeControlOfLocation, the pelargir family's families/pelargir/location-control.ts, as in
// assault-on-osgiliath.ts); the vocabulary the scenario adds is `controlTaken` (pelargir), `who: actor` on TakeControlOfLocation, the condition `controlsOutnumberStaging` and the flags `healsInsteadOfDestroyed` and `roundEnding` (mordor).
// Rules: vom.controlling-locations, vom.losing-control-of-a-location, rr.explored, rr.active-location, rr.attachment-cards, rr.destroy, rr.cancel, rr.first-player, rr.forced, rr.reveal, rr.travel, rr.the-word-choose, rr.winning-the-game, faq.enemy-attacks-outside-combat,
// faq.cancel-encounter-effect, faq.cancel-encounter-card (data/rules/entries.json)
const ULCHOR = "22011";
const GATE = "22014";
type Each = Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"];
type Steps = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"];
// The same steps run in a Choose option and in a ForEachPlayer: the first is the narrower type, which the second takes as it is.
const EACH_PLAYER = (instructions: Steps | Each): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions: instructions as Each });
// The locations the acting player controls, every location a player controls, and the one with the highest Threat among his.
const MINE: PickSpec = { type: "location", control: "you", controlled: true };
const ANY_CONTROLLED: PickSpec = { type: "location", control: "any", controlled: true };
const HIGHEST_OF_MINE: PickSpec = { ...MINE, highestThreat: true };
// "The player who controls this card": the acting player holds it in his play area.
const I_CONTROL_THIS: Condition = { kind: "count", pick: { ...MINE, isSource: true }, min: 1 };
const A_LOCATION_EXPLORED = { trigger: "leftPlay", subject: { type: "location", control: "any" }, condition: { kind: "subjectExplored" } } as const satisfies Partial<Effect>;
const DESTROYS_A_CHARACTER = { trigger: "characterDestroyedByAttack", subject: { type: "character", control: "any" }, condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } } } as const satisfies Partial<Effect>;
const ULCHOR_IN_STAGING: PickSpec = { type: "enemy", control: "any", names: ["Thane Ulchor"], staging: true };
const ULCHOR_PICKED: Instruction = { verb: "Pick", pick: ULCHOR_IN_STAGING };
const ULCHOR_ABLE: Condition = { kind: "canPick", pick: ULCHOR_IN_STAGING };
const HOST_IS_ENEMY: Condition = { kind: "matches", card: "host", pick: { type: "enemy", control: "any" } };
// "While this is the active location": a constant that holds only while the card lies in the active location slot (the archery total and the cancel bar read every card in play).
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const FOUND_ENEMY: Condition = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false };
const FOUND_LOCATION: Condition = { kind: "matches", card: "picked", pick: { type: "location", control: "any" }, inPlay: false };
// "Discard cards from the top of the encounter deck until an enemy is discarded and put it into play engaged with you": the other discards stay discarded and with no enemy nothing is put into play.
const ENEMY_ENGAGES_ME: Steps = [{ verb: "DiscardUntil", type: "enemy" }, { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: FOUND_ENEMY }];
// "Return a location you control (of your choice) to the staging area", an option that needs a location to return.
const RETURN_ONE: Steps = [{ verb: "Pick", pick: MINE }, { verb: "LoseControlOfLocation", card: "picked" }];
const RETURN_HIGHEST: Steps = [{ verb: "Pick", pick: HIGHEST_OF_MINE }, { verb: "LoseControlOfLocation", card: "picked" }];
// X is 1 more than the number of locations the acting player controls, or the players control.
const X_MINE = { count: MINE, plus: 1 } as const;
const X_ALL = { count: ANY_CONTROLLED, plus: 1 } as const;
// "If this attack destroys a character, return the highest Threat location you control": a shadow effect read once the attack has dealt its damage.
const SHADOW_RETURN: Effect["instructions"] = [{ verb: "AfterAttack", instructions: [{ verb: "Pick", pick: HIGHEST_OF_MINE, when: { kind: "x", min: 1 } }, { verb: "LoseControlOfLocation", card: "picked", when: { kind: "x", min: 1 } }] }];
const EASTERLING_CANDIDATE: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Easterling", hasAttachment: { names: ["Fury"], none: true }, who: "firstPlayer", lowestEngagementCost: true };
// The stage 2B players cannot travel to Gate of Dorwinion unless they control more locations than the staging area holds.
const GATE_CLOSED: Condition = { kind: "not", condition: { kind: "controlsOutnumberStaging" } };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 22011 Thane Ulchor (Immune to player card effects is a keyword). A:1: he cannot leave the staging area (copied). A:2: after the active location is explored the first player chooses: discard from the top of the encounter deck until a location is discarded and add it to
    // the staging area (the other discards stay discarded), or Ulchor attacks him from the staging area, dealt a shadow card (faq.enemy-attacks-outside-combat).
    copyLine("146031:A:1", "22011:A:1"),
    {
      id: "22011:forced:1",
      cardCode: ULCHOR,
      lines: ["22011:A:2"],
      timing: "forced",
      trigger: "activeExplored",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "location", instructions: [{ verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: FOUND_LOCATION }] },
            { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] },
          ],
        },
      ],
    },

    // 22012 Champion of Rhûn. A:1: after it engages you, you either return a location you control or it makes an attack; with no location to return the attack is the only option. A:2 (Shadow): 1 damage to the defending character.
    {
      id: "22012:forced:1",
      cardCode: "22012",
      lines: ["22012:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "return", requires: { kind: "canPick", pick: MINE }, instructions: RETURN_ONE },
            { id: "attack", instructions: [{ verb: "ImmediateAttack" }] },
          ],
        },
      ],
    },
    { id: "22012:shadow:1", cardCode: "22012", lines: ["22012:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

    // 22013 Easterling Skirmisher. A:2: after it attacks and destroys a character, that character's controller returns the location he controls with the highest Threat (he picks among those tied).
    { id: "22013:forced:1", cardCode: "22013", lines: ["22013:A:2"], timing: "forced", ...DESTROYS_A_CHARACTER, instructions: RETURN_HIGHEST },

    // 22014 Gate of Dorwinion (Victory 5 and immune to player card effects are printed keywords). A:2: X Threat is the locations the players control plus 1. A:3: no travel here unless stage 2B holds 12 progress (at stage 1 never). A:4: Travel: Ulchor attacks each player in turn order.
    { id: "22014:constant:1", cardCode: GATE, lines: ["22014:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: X_ALL, until: "whileSourceInPlay", target: "self" }] },
    { id: "22014:constant:2", cardCode: GATE, lines: ["22014:A:3"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 12 } }, instructions: [{ verb: "Restrict", what: "travel" }] },
    { id: "22014:constant:3", cardCode: GATE, lines: ["22014:A:3"], timing: "constant", condition: { kind: "not", condition: { kind: "onStage", stage: 2 } }, instructions: [{ verb: "Restrict", what: "travel" }] },
    { id: "22014:travel:1", cardCode: GATE, lines: ["22014:A:4"], timing: "travel", instructions: [EACH_PLAYER([ULCHOR_PICKED, { verb: "AttackFromStaging", when: ULCHOR_ABLE }])] },

    // 22015 Contested Square. A:2: after any enemy is defeated, 1 progress goes on it while it is in the staging area. A:3: while a player controls it, it returns to the staging area after a character he controls is destroyed.
    { id: "22015:forced:1", cardCode: "22015", lines: ["22015:A:2"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", staging: true }, condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "self" }] },
    {
      id: "22015:forced:2",
      cardCode: "22015",
      lines: ["22015:A:3"],
      timing: "forced",
      trigger: "characterDestroyed",
      subject: { type: "character", control: "you" },
      condition: I_CONTROL_THIS,
      instructions: [{ verb: "LoseControlOfLocation", card: "self" }],
    },

    // 22016 Ransacked House. A:1: Encounter Action (any player), with an enemy in the encounter discard pile: the topmost one goes into play engaged with the acting player, who takes control of the House (it is no explored location). A:2: while controlled, it returns to the staging
    // area after its controller loses control of another location.
    {
      id: "22016:action:1",
      cardCode: "22016",
      lines: ["22016:A:1"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "canPick", pick: { type: "enemy", control: "any", from: "encounterDiscard", topmost: true } }] },
      instructions: [{ verb: "PickDiscardTop", types: ["enemy"] }, { verb: "MoveEncounterCard", card: "picked", to: "engaged" }, { verb: "TakeControlOfLocation", card: "self", who: "actor" }],
    },
    { id: "22016:forced:1", cardCode: "22016", lines: ["22016:A:2"], timing: "forced", trigger: "controlLost", subject: { type: "location", control: "any", other: true }, condition: I_CONTROL_THIS, instructions: [{ verb: "LoseControlOfLocation", card: "self" }] },

    // 22017 Makeshift Fortification. A:1: while it is the active location it has archery 3. A:2: after a player takes control of it, the topmost enemy of the encounter discard pile returns to the staging area.
    { id: "22017:constant:1", cardCode: "22017", lines: ["22017:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "archery", amount: 3, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "22017:forced:1",
      cardCode: "22017",
      lines: ["22017:A:2"],
      timing: "forced",
      trigger: "controlTaken",
      subject: "self",
      instructions: [{ verb: "PickDiscardTop", types: ["enemy"] }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } }],
    },

    // 22018 Captured Tower. A:1: while it is the active location no encounter card effect can be canceled. A:2: after a player takes control of it, he shuffles the encounter discard pile into the deck and discards until an enemy is discarded, which engages him.
    { id: "22018:constant:1", cardCode: "22018", lines: ["22018:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "encounterUncancelable", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "22018:forced:1", cardCode: "22018", lines: ["22018:A:2"], timing: "forced", trigger: "controlTaken", subject: "self", instructions: [{ verb: "ShuffleEncounterDiscard" }, ...ENEMY_ENGAGES_ME] },

    // 22019 Fury (Surge is a keyword). A:2: attached to an enemy it counts as a Condition attachment, and the enemy that would be destroyed heals all damage and Fury is discarded instead (src/rules/families/mordor/fury.ts). A:3: it attaches to the Easterling enemy without Fury that has
    // the lowest engagement cost, in the staging area or engaged, the first player choosing among those tied.
    { id: "22019:constant:1", cardCode: "22019", lines: ["22019:A:2"], timing: "constant", condition: HOST_IS_ENEMY, instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    { id: "22019:constant:2", cardCode: "22019", lines: ["22019:A:2"], timing: "constant", condition: HOST_IS_ENEMY, instructions: [{ verb: "ModifyStat", stat: "healsInsteadOfDestroyed", amount: 1, until: "whileSourceInPlay", target: "host" }] },
    {
      id: "22019:whenRevealed:1",
      cardCode: "22019",
      lines: ["22019:A:3"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: EASTERLING_CANDIDATE }, { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: EASTERLING_CANDIDATE } }],
    },

    // 22020 Caught Off Guard. A:1: each player, the first player first, either returns a location he controls or discards until an enemy is discarded and puts it into play engaged with him (with no location he cannot take the first option). A:2 (Shadow): an additional attack after this one.
    {
      id: "22020:whenRevealed:1",
      cardCode: "22020",
      lines: ["22020:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "Choose", who: "actor", options: [{ id: "return", requires: { kind: "canPick", pick: MINE }, instructions: RETURN_ONE }, { id: "enemy", instructions: ENEMY_ENGAGES_ME }] }])],
    },
    { id: "22020:shadow:1", cardCode: "22020", lines: ["22020:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

    // 22021 Street Fighting. A:1: each player assigns X damage among the characters he controls, X being 1 more than the locations he controls. A:2 (Shadow): the defending player does the same.
    { id: "22021:whenRevealed:1", cardCode: "22021", lines: ["22021:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "AssignDamage", amount: X_MINE, pick: { type: "character", control: "you" } }])] },
    { id: "22021:shadow:1", cardCode: "22021", lines: ["22021:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: X_MINE, pick: { type: "character", control: "you" } }] },

    // 22022 Under Siege. A:1: until the end of the phase the staging area's Threat is raised by X, 1 more than the locations the players control when it is revealed. A:2 (Shadow): the attacking enemy gets +1 Attack; if the attack destroys a character, the defending player returns the
    // location he controls with the highest Threat.
    { id: "22022:whenRevealed:1", cardCode: "22022", lines: ["22022:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "moreStagingThreat", amount: X_ALL, until: "endOfPhase", target: "table" }] },
    { id: "22022:shadow:1", cardCode: "22022", lines: ["22022:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, ...SHADOW_RETURN] },

    // 22023 Ulchor's Revenge. A:2: Thane Ulchor makes an attack against each player who controls a location, in turn order. A:3 (Shadow): the attacking enemy gets +1 Attack for each location the defending player controls.
    { id: "22023:whenRevealed:1", cardCode: "22023", lines: ["22023:A:2"], timing: "whenRevealed", instructions: [EACH_PLAYER([ULCHOR_PICKED, { verb: "AttackFromStaging", when: { kind: "all", conditions: [ULCHOR_ABLE, { kind: "count", pick: MINE, min: 1 }] } }])] },
    { id: "22023:shadow:1", cardCode: "22023", lines: ["22023:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: MINE }, until: "endOfAttack", target: "attacker" }] },

    // 22025 Inside the Walls (stage 1). A:1 Setup: Ulchor, the Gate and the active Makeshift Fortification come from the scenario's piles; each player, the first player first, searches the encounter deck for a different non-unique location, adds it to the staging area unrevealed,
    // and the deck is shuffled. B:1: 4 more quest points for each player; no player card effect places progress on a location in the staging area. B:2: an explored location is taken by the first player. B:3: the stage is defeated only at the end of the round, with the players in control of
    // more locations than the staging area holds.
    {
      id: "22025:setup:1",
      cardCode: "22025",
      lines: ["22025:A:1"],
      timing: "setup",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", nonUnique: true, to: "staging", different: true, deckOnly: true }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "22025:constant:1", cardCode: "22025", lines: ["22025:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, times: 4 }, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "noProgressInStagingByPlayer", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "22025:forced:1", cardCode: "22025", lines: ["22025:B:2"], timing: "forced", ...A_LOCATION_EXPLORED, instructions: [{ verb: "TakeControlOfLocation" }] },
    { id: "22025:constant:2", cardCode: "22025", lines: ["22025:B:3"], timing: "constant", condition: { kind: "flag", stat: "roundEnding", holder: "table", is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "22025:forced:2", cardCode: "22025", lines: ["22025:B:3"], timing: "forced", trigger: "endOfRound", condition: { kind: "controlsOutnumberStaging" }, instructions: [{ verb: "ModifyStat", stat: "roundEnding", amount: 1, until: "endOfPhase", target: "table" }] },

    // 22026 Drive them Out (stage 2). A:1: each player returns the location he controls with the highest Threat; the discard pile is shuffled into the deck; each player, the first player first, discards until an enemy is discarded and puts it into play engaged with him. B:1: no player card
    // effect places progress on a location in the staging area. B:2: no travel to the Gate unless the players control more locations than the staging area holds. B:3: as 22025:B:2. B:4: at the end of the round the players win if they control the Gate.
    {
      id: "22026:whenRevealed:1",
      cardCode: "22026",
      lines: ["22026:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER(RETURN_HIGHEST), { verb: "ShuffleEncounterDiscard" }, EACH_PLAYER(ENEMY_ENGAGES_ME)],
    },
    { id: "22026:constant:1", cardCode: "22026", lines: ["22026:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noProgressInStagingByPlayer", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "22026:constant:2", cardCode: "22026", lines: ["22026:B:2"], timing: "constant", condition: GATE_CLOSED, instructions: [{ verb: "Restrict", what: "travel", location: GATE }] },
    copyLine("22025:B:2", "22026:B:3"),
    { id: "22026:forced:2", cardCode: "22026", lines: ["22026:B:4"], timing: "forced", trigger: "endOfRound", condition: { kind: "count", pick: { ...ANY_CONTROLLED, names: ["Gate of Dorwinion"] }, min: 1 }, instructions: [{ verb: "WinGame" }] },
  ],
  { pool: THE_BLACK_GATE_OPENS },
);

export const AUTHORED_REPLACES: readonly string[] = [];
