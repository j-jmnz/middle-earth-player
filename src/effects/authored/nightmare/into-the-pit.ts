import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";


// Into the Pit Nightmare (deck 9010, data/printed/nightmare.json). The setup card counts the Cave Torch's exhausts and removes the Torch from the game at the 5th; side B is the recipe the build applies (Goblin Patrol leaves the quest deck and
// Goblin Ambush takes stage 2). Patrol Sentry attacks when the Torch exhausts, Shadow Dweller and Goblin Lurker change what the Torch and the Dark locations do, and Twisting Shadows, Narrow Fissure and Shadow-fall count and make Dark locations.
// Rules: rr.forced, rr.search, rr.first-player, faq.enemy-attacks-outside-combat, rr.attachment-cards, rr.destroy, dwd.cave-torch-the-long-dark (data/rules/entries.json); the readings are in docs/scenarios/dwarrowdelf/into-the-pit.md (Into the Pit).
const TORCH = "03041";
const PATROL_SENTRY = "901003";
const PATROL_LEADER = "03014";
const DARK_LOCATION: PickSpec = { type: "location", control: "any", trait: "Dark" };
// A Cave Torch in play, on a hero or not, ready or exhausted: the card of Into the Pit.
const TORCH_ATTACHMENT: PickSpec = { type: "card", control: "any", names: ["Cave Torch"] };
const TORCH_IN_PLAY: Condition = { kind: "inPlay", code: TORCH, is: true };
// The damage on the setup card at which the Cave Torch is removed from the game (901001:A:2); the table's readout of it is src/play/readouts/dwarrowdelf/pit.ts.
export const TORCH_DAMAGE_LIMIT = 5;
export const SETUP_CARD = "901001";
export const CAVE_TORCH = TORCH;
const FIFTH_TOKEN: Condition = { kind: "less", left: TORCH_DAMAGE_LIMIT - 1, right: { stat: "damage", of: "self" } };
const ACTIVE_IS_DARK: Condition = { kind: "matches", card: "activeLocation", pick: DARK_LOCATION };
const DARK_LOCATIONS_IN_PLAY = { count: { type: "location", control: "any", trait: "Dark", staging: true } } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
    // 901001 Into the Pit Nightmare (setup card). A:1 and side B print nothing a record reads (the ledger marks them inert). A:2: each exhaust of a Cave Torch puts 1 damage token on this card, and at the 5th the Torch is removed from the game (the shown counter is the
    // card's damage). The Torch's own Forced effect, Patrol Sentry's and this one hear the same exhaust; the first player orders them and all fire.
    {
      id: "901001:forced:1",
      cardCode: "901001",
      lines: ["901001:A:2"],
      timing: "forced",
      trigger: "exhausted",
      subject: TORCH_ATTACHMENT,
      instructions: [{ verb: "PlaceDamage", amount: 1, card: "self" }, { verb: "MoveEncounterCard", card: "subject", to: "removed", when: FIFTH_TOKEN }],
    },

    // 901002 Goblin Ambush (stage 2 in place of Goblin Patrol). A:1: the first player searches the deck and discard pile for 1 plus the number of players Orc enemies: one is Patrol Sentry and one Patrol Leader, if able, the others are free.
    // B:1: its quest points are 1 plus the number of players. B:2: each enemy destroyed places 1 progress on the stage, which no other effect and no quest can do (B:3).
    {
      id: "901002:whenRevealed:1",
      cardCode: "901002",
      lines: ["901002:A:1"],
      timing: "whenRevealed",
      instructions: [
        // The first player searches whoever revealed the card: he chooses among the Orc enemies.
        { verb: "ActAs", who: "firstPlayer" },
        { verb: "SearchMove", type: "enemy", trait: "Orc", to: "staging", require: PATROL_SENTRY },
        { verb: "SearchMove", type: "enemy", trait: "Orc", to: "staging", require: PATROL_LEADER },
        { verb: "Repeat", times: { players: true, plus: -1 }, instructions: [{ verb: "SearchMove", type: "enemy", trait: "Orc", to: "staging" }] },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    { id: "901002:constant:1", cardCode: "901002", lines: ["901002:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, plus: 1 }, until: "whileSourceInPlay" }] },
    { id: "901002:forced:1", cardCode: "901002", lines: ["901002:B:2"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any" }, instructions: [{ verb: "AddStageProgress", amount: 1 }] },
    { id: "901002:constant:2", cardCode: "901002", lines: ["901002:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },

    // 901003 Patrol Sentry: after a Cave Torch exhausts, a Sentry engaged with a player makes an immediate attack against him (nothing happens in the staging area). The Shadow adds it to the staging area.
    { id: "901003:forced:1", cardCode: "901003", lines: ["901003:A:1"], timing: "forced", trigger: "exhausted", subject: TORCH_ATTACHMENT, condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ImmediateAttack" }] },
    { id: "901003:shadow:1", cardCode: "901003", lines: ["901003:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },

    // 901004 Goblin Lurker: cannot be optionally engaged; with a Dark active location it gets +3 Attack and -40 engagement cost (never below 0). Its Shadow (a generated record) is read from the card.
    { id: "901004:constant:1", cardCode: "901004", lines: ["901004:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "901004:constant:2",
      cardCode: "901004",
      lines: ["901004:A:2"],
      timing: "constant",
      condition: ACTIVE_IS_DARK,
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "engagementCost", amount: -40, until: "whileSourceInPlay", target: "self" }],
    },

    // 901005 Shadow Dweller: no engagement check is made for it while any Cave Torch is in play. The Shadow shuffles it back into the deck.
    { id: "901005:constant:1", cardCode: "901005", lines: ["901005:A:2"], timing: "constant", condition: TORCH_IN_PLAY, instructions: [{ verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "901005:shadow:1", cardCode: "901005", lines: ["901005:A:3"], timing: "shadow", instructions: [{ verb: "ShuffleSelfIntoEncounterDeck" }] },

    // 901006 Twisting Shadows: X, its quest points, is the Dark locations in play (the staging area and the active location). When Revealed it removes the progress from each; the Shadow adds 1 Attack for each.
    { id: "901006:constant:1", cardCode: "901006", lines: ["901006:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: DARK_LOCATIONS_IN_PLAY, until: "whileSourceInPlay", target: "self" }] },
    { id: "901006:whenRevealed:1", cardCode: "901006", lines: ["901006:A:2"], timing: "whenRevealed", instructions: [{ verb: "RemoveAllProgress", pick: DARK_LOCATION }] },
    { id: "901006:shadow:1", cardCode: "901006", lines: ["901006:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: DARK_LOCATIONS_IN_PLAY, until: "endOfAttack", target: "attacker" }] },

    // 901007 Narrow Fissure: each Dark location in play gets +2 quest points; no progress can be placed on it while a Cave Torch is ready (read as the progress would be placed).
    { id: "901007:constant:1", cardCode: "901007", lines: ["901007:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 2, until: "whileSourceInPlay", holders: DARK_LOCATION }] },
    { id: "901007:constant:2", cardCode: "901007", lines: ["901007:A:3"], timing: "constant", condition: { kind: "all", conditions: [TORCH_IN_PLAY, { kind: "exhausted", code: TORCH, is: false }] }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },

    // 901008 Shadow-fall: the first player attaches it to a non-Dark location in play (with none it is discarded); the location gains the Dark trait and +3 quest points. The Shadow gives +3 Defense until the end of the phase.
    {
      id: "901008:whenRevealed:1",
      cardCode: "901008",
      lines: ["901008:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: { type: "location", control: "any", staging: true, notTraits: ["Dark"], who: "firstPlayer" } }, { verb: "AttachSelfToPicked", unlimited: true }],
    },
    { id: "901008:constant:1", cardCode: "901008", lines: ["901008:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    {
      id: "901008:constant:2",
      cardCode: "901008",
      lines: ["901008:A:2"],
      timing: "constant",
      condition: { kind: "not", condition: { kind: "sourceIn", zone: "staging" } },
      instructions: [{ verb: "GrantTrait", trait: "Dark" }, { verb: "ModifyStat", stat: "questPoints", amount: 3, until: "whileSourceInPlay", target: "host" }],
    },
    { id: "901008:shadow:1", cardCode: "901008", lines: ["901008:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 3, until: "endOfPhase", target: "attacker" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
