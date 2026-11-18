import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for The Redhorn Gate (Dwarrowdelf part 4, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). The quest's 1B says Entering the Mines' When Revealed (03064:B:1) in other words, Rocky Crags and Fallen Stones print the
// same Shadow (04019:A:2 and 04021:A:2), Mountain Goblin and Mountain Troll the same +1 Attack (04025:A:1 and 04026:A:1). Mountain Goblin's and Mountain Troll's Shadow (04025:A:2, 04026:A:2) is a template; the Nightmare deck's records are in ../nightmare/the-redhorn-gate.ts. The readings are in docs/brief.md (The Redhorn Gate).
// Rules: dwd.setup-the-redhorn-gate, dwd.setup-the-redhorn-gate-set-aside, dwd.ally-objective-arwen, dwd.caradhras, rr.reveal, rr.staging, rr.travel, rr.victory, rr.first-player, rr.defending-player, rr.attachment-cards, rr.lasting-effects, faq.lasting-effects,
// faq.progress-without-advancing, faq.first-player-elimination, faq.simultaneous-effects (data/rules/entries.json).
const ARWEN = "04014";
const CARADHRAS = "04015";
const SNOWSTORM = "04022";
const FREEZING_COLD = "Freezing Cold";
const MOUNTAIN_WARG = "03055";
const UNDEFENDED: Condition = { kind: "undefended" };
const IN_ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const CARADHRAS_IN_STAGING: PickSpec = { type: "location", control: "any", stagingOnly: true, names: ["Caradhras"] };
const CARADHRAS_IS_ACTIVE: Condition = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", names: ["Caradhras"] } };
const CARADHRAS_IN_DECK_OR_DISCARD: Condition = { kind: "searchable", code: CARADHRAS };
const ATTACHMENT_ON_QUESTING_CHARACTER: PickSpec = { type: "attachment", control: "any", on: { type: "character", control: "any", committed: true }, who: "firstPlayer" };
const FREEZING_COLD_ON_HOST: PickSpec = { type: "attachment", control: "any", names: [FREEZING_COLD], attachedTo: "host" };
const MOUNTAIN_IN_STAGING: PickSpec = { type: "location", control: "any", stagingOnly: true, trait: "Mountain" };
const COMMITTED_HERO_WITH_RESOURCE: PickSpec = { type: "hero", control: "you", committed: true, hasResources: true };
const EVERY_CHARACTER: PickSpec = { type: "character", control: "any" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 03054 Black Uruks. When Revealed: the first player chooses an attachment on any questing character, any player's, and discards it (recommended: the card names "a questing character", not one he controls). Shadow: an undefended attack deals 2 more shadow cards.
    { id: "03054:whenRevealed:1", cardCode: "03054", lines: ["03054:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: ATTACHMENT_ON_QUESTING_CHARACTER }, { verb: "DiscardPicked" }] },
    {
      id: "03054:shadow:1",
      cardCode: "03054",
      lines: ["03054:A:2"],
      timing: "shadow",
      instructions: [{ verb: "DealShadowTo", target: "attacker", when: UNDEFENDED }, { verb: "DealShadowTo", target: "attacker", when: UNDEFENDED }],
    },

    // 03055 Mountain Warg. A:1 is Wargs' line (01085:A:1) without its "Forced:" prefix: after it attacks it returns to the staging area when a shadow card dealt to it had no Shadow effect. A:2: +1 Attack, +1 more with a Mountain as the active location.
    {
      id: "03055:forced:1",
      cardCode: MOUNTAIN_WARG,
      lines: ["03055:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      condition: { kind: "shadowBlank" },
      instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }],
    },
    {
      id: "03055:shadow:1",
      cardCode: MOUNTAIN_WARG,
      lines: ["03055:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", trait: "Mountain" } } },
      ],
    },

    // 03056 Bitter Wind. When Revealed: the first player discards 3 resources from each hero he controls (as many as the pool holds). Shadow: the defending player discards 2 from each of his heroes, the attack undefended or not.
    {
      id: "03056:whenRevealed:1",
      cardCode: "03056",
      lines: ["03056:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Each", pick: { type: "hero", control: "you" }, instructions: [{ verb: "DiscardResources", amount: 3, target: "picked" }], when: { kind: "firstPlayer" } }] }],
    },
    {
      id: "03056:shadow:1",
      cardCode: "03056",
      lines: ["03056:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Each", pick: { type: "hero", control: "you" }, instructions: [{ verb: "DiscardResources", amount: 2, target: "picked" }] }],
    },

    // 03057 Knees of the Mountain: while it is in the staging area every enemy that engages a player gets +1 Attack until the end of the round (one Forced effect for each copy there).
    {
      id: "03057:forced:1",
      cardCode: "03057",
      lines: ["03057:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: { type: "enemy", control: "any" },
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "subject" }],
    },

    // 03058 Turbulent Waters: while it is the active location the players cannot optionally engage enemies (the engagement check still engages).
    { id: "03058:constant:1", cardCode: "03058", lines: ["03058:A:1"], timing: "constant", condition: IN_ACTIVE, instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "table" }] },

    // 03059 Warg Lair. When Revealed: a Mountain Warg is searched out of the encounter deck and discard pile into the staging area (not revealed) and the deck is shuffled. A:2: after it leaves play as an explored location each player draws 1.
    { id: "03059:whenRevealed:1", cardCode: "03059", lines: ["03059:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", code: MOUNTAIN_WARG, to: "staging" }, { verb: "ShuffleEncounterDeck" }] },
    {
      id: "03059:response:1",
      cardCode: "03059",
      lines: ["03059:A:2"],
      timing: "response",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 1 }] }],
    },

    // 04011 To the Redhorn Gate (stage 1). Setup: Caradhras joins the staging area and the Snowstorm copies are set aside by the scenario's piles; Arwen enters play under the first player's control. 1B is Entering the Mines' When Revealed.
    { id: "04011:setup:1", cardCode: "04011", lines: ["04011:A:1"], timing: "setup", instructions: [{ verb: "TakeControlOfSetAside", code: ARWEN }, { verb: "ShuffleEncounterDeck" }] },
    { id: "04011:whenRevealed:1", cardCode: "04011", lines: ["04011:B:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }] },

    // 04012 Snowdrifts (stage 2). B:1: 1 more Snowstorm than there are players is shuffled into the encounter deck from the set-aside copies. B:2: after the 11th progress token, the active location is discarded (with its progress) and Caradhras becomes the active location without a Travel
    // (dwd.caradhras): from the staging area, or searched out of the victory display, the encounter deck or its discard pile into the staging area first (the deck is shuffled); a Caradhras already active stays (agent recommendation, docs/brief.md, The Redhorn Gate).
    {
      id: "04012:whenRevealed:1",
      cardCode: "04012",
      lines: ["04012:B:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: SNOWSTORM }] }, { verb: "ShuffleSetAsideIntoEncounterDeck", code: SNOWSTORM }, { verb: "ShuffleEncounterDeck" }],
    },
    {
      id: "04012:forced:1",
      cardCode: "04012",
      lines: ["04012:B:2"],
      timing: "forced",
      trigger: "questCardDefeated",
      subject: "self",
      instructions: [
        { verb: "Discard", target: { kind: "activeLocation" }, when: { kind: "not", condition: CARADHRAS_IS_ACTIVE } },
        // The deck is shuffled only when Caradhras is searched out of the deck or its discard pile (the shuffle before the search leaves the same deck as one after); from the staging area or the victory display the deck keeps the order Fell Voices gave it.
        { verb: "ShuffleEncounterDeck", when: CARADHRAS_IN_DECK_OR_DISCARD },
        { verb: "SearchMove", code: CARADHRAS, to: "staging", victory: true },
        { verb: "Pick", pick: CARADHRAS_IN_STAGING, when: { kind: "canPick", pick: CARADHRAS_IN_STAGING } },
        { verb: "MakeActive", when: { kind: "canPick", pick: CARADHRAS_IN_STAGING } },
      ],
    },

    // 04013 The Mountains' Peaks (stage 3). B:1: every Snowstorm in the discard pile is shuffled back into the deck. B:2: while this stage is current a character whose Willpower is 0 is discarded from play, the state kept true by the settle sweep (families/play/sweep.ts).
    // B:3: the stage is not defeated while the victory display holds fewer than 5 victory points (progress goes on, faq.progress-without-advancing). B:4: defeating it wins.
    { id: "04013:whenRevealed:1", cardCode: "04013", lines: ["04013:B:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard", name: "Snowstorm" }] },
    { id: "04013:constant:1", cardCode: "04013", lines: ["04013:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "discardAtZeroWillpower", amount: 1, until: "whileSourceInPlay", holders: EVERY_CHARACTER }] },
    {
      id: "04013:constant:2",
      cardCode: "04013",
      lines: ["04013:B:3"],
      timing: "constant",
      condition: { kind: "less", left: { victoryPoints: true }, right: 5 },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
    { id: "04013:constant:3", cardCode: "04013", lines: ["04013:B:4"], timing: "constant", instructions: [] },

    // 04014 Arwen Undómiel. A:1: the first player controls her, as an ally, and the control follows the first player token (dwd.ally-objective-arwen, faq.first-player-elimination). A:2: after she exhausts, a hero of any player gets 1 resource, the chosen hero's.
    // A:3: if she leaves play the players lose.
    { id: "04014:constant:1", cardCode: ARWEN, lines: ["04014:A:1"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self" }] },
    {
      id: "04014:response:1",
      cardCode: ARWEN,
      lines: ["04014:A:2"],
      timing: "response",
      trigger: "exhausted",
      subject: "self",
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "AddResources", amount: 1, to: "picked" }],
    },
    { id: "04014:triggered:1", cardCode: ARWEN, lines: ["04014:A:3"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "LoseGame" }] },

    // 04015 Caradhras. A:1: while it is the active location every questing character gets -1 Willpower, read as characters commit (a constant). A:2: the players cannot travel to it except through quest card effects (Snowdrifts' MakeActive is not a Travel).
    {
      id: "04015:constant:1",
      cardCode: CARADHRAS,
      lines: ["04015:A:1"],
      timing: "constant",
      condition: IN_ACTIVE,
      instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "whileSourceInPlay", holders: { type: "character", control: "any", committed: true } }],
    },
    { id: "04015:constant:2", cardCode: CARADHRAS, lines: ["04015:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", location: CARADHRAS }] },

    // 04016 Fanuidhol. While it is the active location every hero's Willpower counts only if its controller spends 1 resource from that hero's pool: a hero with no resource counts 0, and a player may keep a resource back. The question is asked when the quest total is counted
    // (after the staging step and the action window that follows it), in player order, for each committed hero with a resource (docs/brief.md, The Redhorn Gate).
    { id: "04016:constant:1", cardCode: "04016", lines: ["04016:A:1"], timing: "constant", condition: IN_ACTIVE, instructions: [{ verb: "ModifyStat", stat: "willpowerCostsResource", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any" } }] },
    {
      id: "04016:forced:1",
      cardCode: "04016",
      lines: ["04016:A:1"],
      timing: "forced",
      trigger: "questTotalCounted",
      condition: IN_ACTIVE,
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Each",
              pick: COMMITTED_HERO_WITH_RESOURCE,
              instructions: [
                {
                  verb: "Choose",
                  who: "actor",
                  options: [
                    { id: "pay", instructions: [{ verb: "SpendResources", amount: 1, target: "picked" }, { verb: "ModifyStat", stat: "countsWillpower", amount: 1, until: "endOfPhase", target: "picked" }] },
                    { id: "keep", instructions: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // 04017 Celebdil: while it is the active location 2 progress tokens come off it at the end of each round (all it has when fewer).
    { id: "04017:forced:1", cardCode: "04017", lines: ["04017:A:1"], timing: "forced", trigger: "endOfRound", condition: IN_ACTIVE, instructions: [{ verb: "RemoveProgressFrom", amount: 2, target: "self" }] },

    // 04018 The Dimrill Stair. Travel: the locations in the encounter discard pile and in the victory display are shuffled into the encounter deck; with at least two reshuffled, each player reduces his threat by 11 and every Freezing Cold in play goes to the encounter discard pile.
    {
      id: "04018:travel:1",
      cardCode: "04018",
      lines: ["04018:A:1"],
      timing: "travel",
      instructions: [
        { verb: "ShuffleEncounterDiscard", type: "location", alsoVictory: true },
        { verb: "LowerThreat", amount: 11, who: "eachSeat", when: { kind: "not", condition: { kind: "returnedBelow", than: 2 } } },
        { verb: "DiscardEach", pick: { type: "attachment", control: "any", names: [FREEZING_COLD] }, when: { kind: "not", condition: { kind: "returnedBelow", than: 2 } } },
      ],
    },

    // 04019 Rocky Crags. Travel: each player deals 2 damage to a character he controls (a cost every player must pay to travel). Shadow: +1 Attack for each progress token on the active location, counted as the Shadow resolves.
    {
      id: "04019:travel:1",
      cardCode: "04019",
      lines: ["04019:A:1"],
      timing: "travel",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: 2, target: "picked" }] }],
    },
    {
      id: "04019:shadow:1",
      cardCode: "04019",
      lines: ["04019:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "progress", of: "activeLocation" }, until: "endOfAttack", target: "attacker" }],
    },

    // 04020 Fell Voices. When Revealed: the top 2 Snow cards of the encounter discard pile, of any type, go on top of the encounter deck, and the first player chooses their order; with fewer than 2 Snow treachery cards among them Fell Voices gains surge.
    {
      id: "04020:whenRevealed:1",
      cardCode: "04020",
      lines: ["04020:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ActAs", who: "firstPlayer" },
        { verb: "ReturnFromDiscard", trait: "Snow", anyType: true, count: 2, to: "deckTop", treacheries: true },
        { verb: "ArrangeEncounter" },
        { verb: "GainSurge", when: { kind: "returnedBelow", than: 2 } },
      ],
    },

    // 04021 Fallen Stones. When Revealed: the first player chooses to remove every progress token from play (on the current quest, the active location, the locations in the staging area, a side quest and Blinding Blizzard), or to reveal 2 cards and add them to the staging area.
    {
      id: "04021:whenRevealed:1",
      cardCode: "04021",
      lines: ["04021:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            {
              id: "remove",
              instructions: [
                { verb: "RemoveAllProgress", pick: { type: "location", control: "any" } },
                { verb: "RemoveAllProgress", target: "questStage" },
                { verb: "RemoveAllProgress", pick: { type: "card", control: "any", cardType: "player-side-quest" } },
                { verb: "RemoveAllProgress", pick: { type: "card", control: "any", cardType: "encounter-side-quest" } },
                { verb: "RemoveAllProgress", pick: { type: "card", control: "any", names: ["Blinding Blizzard"] } },
              ],
            },
            { id: "reveal", instructions: [{ verb: "RevealEncounter", who: "firstPlayer", times: 2 }] },
          ],
        },
      ],
    },
    copyLine("04019:A:2", "04021:A:2"),

    // 04022 Snowstorm. When Revealed: each questing character gets -1 Willpower until the end of the phase, a character that commits later too (faq.lasting-effects). Shadow: until the end of the phase the defender gets -1 Willpower and is discarded if its Willpower is 0
    // (the flag lasts the phase: agent recommendation).
    { id: "04022:whenRevealed:1", cardCode: SNOWSTORM, lines: ["04022:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "questingCharacters" }] },
    {
      id: "04022:shadow:1",
      cardCode: SNOWSTORM,
      lines: ["04022:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfPhase", target: "defender" }, { verb: "ModifyStat", stat: "discardAtZeroWillpower", amount: 1, until: "endOfPhase", target: "defender" }],
    },

    // 04023 Freezing Cold. When Revealed: the first player attaches it to a hero he controls. It counts as a Condition attachment: the hero gets -2 Willpower and cannot commit to the quest, and with more than 1 copy attached it is discarded from play.
    { id: "04023:whenRevealed:1", cardCode: "04023", lines: ["04023:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "firstPlayer", unlimited: true } }] },
    {
      id: "04023:constant:1",
      cardCode: "04023",
      lines: ["04023:A:1"],
      timing: "constant",
      instructions: [
        { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
        { verb: "AttachesTo", host: { kind: "hero" } },
        { verb: "ModifyStat", stat: "willpower", amount: -2, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },
    {
      id: "04023:triggered:1",
      cardCode: "04023",
      lines: ["04023:A:1"],
      timing: "triggered",
      trigger: "attached",
      subject: "self",
      condition: { kind: "count", pick: FREEZING_COLD_ON_HOST, min: 2 },
      instructions: [{ verb: "Discard", target: { kind: "host" } }],
    },

    // 04024 Avalanche!. When Revealed: every ready character of every player exhausts and, in the quest phase, is committed to the quest (one that cannot quest stays out).
    {
      id: "04024:whenRevealed:1",
      cardCode: "04024",
      lines: ["04024:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Each", pick: { type: "character", control: "any", state: "ready" }, instructions: [{ verb: "Exhaust", target: { kind: "picked" } }, { verb: "CommitToQuest", target: "picked", when: { kind: "phase", is: "Quest" } }] }],
    },

    // 04025 Mountain Goblin and 04026 Mountain Troll: +1 Attack for each Mountain location in the staging area (the active location is not counted).
    { id: "04025:constant:1", cardCode: "04025", lines: ["04025:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: MOUNTAIN_IN_STAGING }, until: "whileSourceInPlay", target: "self" }] },
    copyLine("04025:A:1", "04026:A:1"),

    // 04027 Snow Warg. A:1: allies cannot defend while it attacks. A:2: after a character is declared as its defender it takes 1 damage (none when the attack is undefended).
    { id: "04027:constant:1", cardCode: "04027", lines: ["04027:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "defend", allies: true }] },
    {
      id: "04027:forced:1",
      cardCode: "04027",
      lines: ["04027:A:2"],
      timing: "forced",
      trigger: "declaredDefender",
      subject: EVERY_CHARACTER,
      condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
      instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }],
    },
  ],
);

export const AUTHORED_REPLACES: readonly string[] = [];
