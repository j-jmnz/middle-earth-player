import type { Effect } from "../../../catalog/boundary.ts";

import { ADDITIONAL_ATTACK, ARAGORN, BLACK_DART, CITY, CITY_IN_PLAY, CITY_OR, DISCARD_UNTIL_ENEMY, EACH_PLAYER, ESQUIRE_OF_GONDOR, ESQUIRE_OF_ROHAN, FELL_BEAST, FLEET, GROND, HARAD_ATTACKER, MINAS_TIRITH, MORDOR_ATTACKER, MY_HERO, QUEST_PHASE, STAGED_ENEMIES, STAGING_LOCATIONS, WITCH_KING, WRAITH } from "./pelennor/shared.ts";
import { STAGE_RECORDS } from "./pelennor/stages.ts";

// Records for The Battle of the Pelennor Fields (the-return-of-the-king part 3, campaign card 145078, whose Resolution record is in the-return-of-the-king.ts): the Esquires, Minas Tirith and the siege locations, the Harad and Mordor enemies, the
// treacheries and the Corsair Fleet; the quest stages, the campaign card and the Witch-king's two sides are in return-of-the-king/pelennor/stages.ts. The cards the quest card's piles set aside (Minas Tirith, Grond, the Wraiths on Wings, the Witch-king, the Esquires) are
// dealt by the data; no record places them. Every line is read from the scan ledger (data/printed/the-return-of-the-king.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.minas-tirith, mec113.assault, mec113.setting-up-the-game, mec113.aragorn, mec113.multiplayer-aragorn, mec113.saga-staging-rules, mec113.immune-to-player-card-effects, mec113.peril, mec113.archery, rr.effects, rr.search,
// rr.active-location, rr.explored, rr.staging, rr.quest-advancement, rr.first-player, rr.cancel, rr.then, rr.lasting-effects, rr.in-play-and-out-of-play, rr.destroy, rr.engaged, rr.damage, faq.progress-without-advancing, faq.peril-attacks,
// faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.lasting-effects, faq.triggering-forced-effects, faq.next-player (data/rules/entries.json).
export const AUTHORED_EFFECTS: readonly Effect[] = [
    // 145014 Esquire of Rohan, 145015 Esquire of Gondor (the Trait and Setup lines are templates). +1 Attack while attacking with another Rohan character; +1 Willpower while committed to the quest with another Gondor character: the host is in the
    // attack (the attackers of a joint attack all count) and another character with the trait is too.
    {
      id: "145014:constant:2",
      cardCode: ESQUIRE_OF_ROHAN,
      lines: ["145014:A:5"],
      timing: "constant",
      condition: {
        kind: "all",
        conditions: [
          { kind: "matches", card: "host", pick: { type: "character", control: "any", attacking: true } },
          { kind: "count", pick: { type: "character", control: "any", trait: "Rohan", attacking: true, notHost: true }, min: 1 },
        ],
      },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" }],
    },
    {
      id: "145015:constant:2",
      cardCode: ESQUIRE_OF_GONDOR,
      lines: ["145015:A:4"],
      timing: "constant",
      condition: {
        kind: "all",
        conditions: [
          { kind: "matches", card: "host", pick: { type: "character", control: "any", committed: true } },
          { kind: "count", pick: { type: "character", control: "any", trait: "Gondor", committed: true, notHost: true }, min: 1 },
        ],
      },
      instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "host" }],
    },

    // 145043 Minas Tirith (an objective with no printed hit points; set aside until stage 3A). 30 hit points plus 10 for each player. Forced: at the end of the round it takes 1 damage for each enemy in the staging area (through City Wall); then, with no hit
    // points remaining (its damage at its hit points or more), the players lose (mec113.minas-tirith).
    { id: "145043:constant:1", cardCode: MINAS_TIRITH, lines: ["145043:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: { players: true, times: 10, plus: 30 }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "145043:forced:1",
      cardCode: MINAS_TIRITH,
      lines: ["145043:A:2"],
      timing: "forced",
      trigger: "endOfRound",
      instructions: [
        { verb: "DamageMinasTirith", amount: { count: STAGED_ENEMIES } },
        { verb: "LoseGame", reason: "Minas Tirith has no hit points remaining", when: { kind: "not", condition: { kind: "less", left: { stat: "damage", of: "self" }, right: { stat: "hitPoints", of: "self" } } } },
      ],
    },

    // 145044 Grond (Immune is a keyword). X, its Threat, is the resources on Grond. Forced: at the beginning of the quest phase it gets 1 resource, then X damage is dealt to Minas Tirith (through City Wall; nothing while it is out of play). Travel: the Witch-king,
    // if in play, makes an immediate attack against each player in turn order, from the staging area (or as he is, engaged); with him out of play nobody attacks and the players still travel.
    { id: "145044:constant:1", cardCode: GROND, lines: ["145044:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "145044:forced:1",
      cardCode: GROND,
      lines: ["145044:A:3"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: QUEST_PHASE,
      instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, { verb: "DamageMinasTirith", amount: { stat: "resources", of: "self" } }],
    },
    {
      id: "145044:travel:1",
      cardCode: GROND,
      lines: ["145044:A:4"],
      timing: "travel",
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: WITCH_KING }, { verb: "AttackFromStaging", orEngaged: true, when: { kind: "canPick", pick: WITCH_KING } }])],
    },

    // 145045 Gate of Gondor (Immune is a keyword). While it is the active location each enemy in play, staged or engaged, gets -30 engagement cost. Forced: when it is explored (as the active location or in the staging area) each engaged enemy, every
    // player's, returns to the staging area.
    {
      id: "145045:constant:1",
      cardCode: "145045",
      lines: ["145045:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -30, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }],
    },
    { id: "145045:forced:1", cardCode: "145045", lines: ["145045:A:3"], timing: "forced", trigger: "activeExplored", subject: "self", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }] },
    { id: "145045:forced:2", cardCode: "145045", lines: ["145045:A:3"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }] },

    // 145046 City Wall. While it is the active location, damage that would be placed on Minas Tirith is placed here first, up to its quest points, and the rest on Minas Tirith (the flag damageFirst; with Minas Tirith out of play nothing is redirected).
    // Forced: when it holds damage equal to its quest points (4) it is discarded, then each player raises their threat by 3.
    {
      id: "145046:constant:1",
      cardCode: "145046",
      lines: ["145046:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "damageFirst", amount: 1, until: "whileSourceInPlay", holders: CITY }],
    },
    {
      id: "145046:forced:1",
      cardCode: "145046",
      lines: ["145046:A:2"],
      timing: "forced",
      trigger: "damaged",
      subject: "self",
      condition: { kind: "damageReached", nth: 4 },
      instructions: [{ verb: "Discard", target: { kind: "self" } }, { verb: "RaiseThreat", amount: 3, who: "eachSeat" }],
    },

    // 145047 Pelennor Field. While at least 1 enemy is in the staging area, no progress can be placed on the locations in the staging area (the active location takes progress as usual). Shadow: the attacking enemy gets +1 Attack, +2 with the Harad trait.
    {
      id: "145047:constant:1",
      cardCode: "145047",
      lines: ["145047:A:1"],
      timing: "constant",
      condition: { kind: "count", pick: STAGED_ENEMIES, min: 1 },
      instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: STAGING_LOCATIONS }],
    },
    {
      id: "145047:shadow:1",
      cardCode: "145047",
      lines: ["145047:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: HARAD_ATTACKER } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: HARAD_ATTACKER },
      ],
    },

    // 145048 Fire-filled Trench. Forced: when a player plays an event that would cancel the effects of a treachery card just revealed from the encounter deck, that event's effects are canceled instead and the Trench is discarded. The marker CounterCancel is read by
    // CancelEffect while the Trench is in play (families/pelennor/combat.ts counterCancel); the event is played and paid for and does nothing.
    { id: "145048:forced:1", cardCode: "145048", lines: ["145048:A:1"], timing: "forced", trigger: "whenRevealedCanceled", instructions: [{ verb: "CounterCancel" }] },

    // 145049 Siege Tower. While it is in the staging area it has Archery 3 (the archery of cards in play adds up). Forced: after it becomes the active location the encounter discard pile is shuffled into the deck and cards are discarded until an enemy is
    // discarded; that enemy is added to the staging area (with none left nothing is added).
    {
      id: "145049:constant:1",
      cardCode: "145049",
      lines: ["145049:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "archery", amount: 3, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "145049:forced:1", cardCode: "145049", lines: ["145049:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "ShuffleEncounterDiscard" }, ...DISCARD_UNTIL_ENEMY] },

    // 145050 The Black Serpent. Cannot have attachments; a player attack against it is declared with one attacker (the flag singleAttacker). When Revealed: it makes an immediate attack against the first player, from the staging area.
    {
      id: "145050:constant:1",
      cardCode: "145050",
      lines: ["145050:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "singleAttacker", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "145050:whenRevealed:1", cardCode: "145050", lines: ["145050:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] },

    // 145051 War Mûmak (Archery 2 is a keyword). Cannot have attachments; cannot take more than 3 damage each round. Forced: when it is defeated each player lowers their threat by 4.
    {
      id: "145051:constant:1",
      cardCode: "145051",
      lines: ["145051:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "damageCap", amount: 3, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "145051:forced:1", cardCode: "145051", lines: ["145051:A:3"], timing: "forced", trigger: "enemyDestroyed", subject: "self", instructions: [{ verb: "LowerThreat", amount: 4, who: "eachSeat" }] },

    // 145052 Southron Champion. Forced: after it is dealt a shadow card with no shadow effect, the defending player (the first player for an attack from the staging area) chooses either to deal 3 damage to Minas Tirith, or the Champion makes an additional
    // attack after this one (dealt a new shadow card, faq.additional-attacks). Shadow: 1 damage to Minas Tirith.
    {
      id: "145052:forced:1",
      cardCode: "145052",
      lines: ["145052:A:1"],
      timing: "forced",
      trigger: "attackResolved",
      subject: "self",
      condition: { kind: "shadowBlank" },
      instructions: [CITY_OR(3, { id: "attack", instructions: [{ verb: "ImmediateAttack" }] })],
    },
    { id: "145052:shadow:1", cardCode: "145052", lines: ["145052:A:2"], timing: "shadow", instructions: [{ verb: "DamageMinasTirith", amount: 1 }] },

    // 145053 Morgul Captain (Peril is a keyword). When Revealed: the topmost (last discarded) Orc enemy in the encounter discard pile enters play engaged with the revealing player; it is put into play, not revealed. Shadow: if this attack destroys a character, the attacking
    // enemy returns to the staging area.
    { id: "145053:whenRevealed:1", cardCode: "145053", lines: ["145053:A:2"], timing: "whenRevealed", instructions: [{ verb: "PutTopmostFromEncounterDiscard", type: "enemy", trait: "Orc" }] },
    { id: "145053:shadow:1", cardCode: "145053", lines: ["145053:A:3"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: { kind: "x", min: 1 } }] }] },

    // 145054 Orc of the Eye (Peril and Archery 1 are keywords). When Revealed: the revealing player chooses either 2 damage to a hero they control or 2 damage to Minas Tirith (only what can be done is offered, mec113.minas-tirith). Shadow: the attacking enemy gets +1 Attack,
    // +2 with the Mordor trait.
    {
      id: "145054:whenRevealed:1",
      cardCode: "145054",
      lines: ["145054:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "hero", requires: { kind: "canPick", pick: MY_HERO }, instructions: [{ verb: "Pick", pick: MY_HERO }, { verb: "DamageCard", amount: 2, target: "picked" }] },
            { id: "city", requires: CITY_IN_PLAY, instructions: [{ verb: "DamageMinasTirith", amount: 2 }] },
          ],
        },
      ],
    },
    {
      id: "145054:shadow:1",
      cardCode: "145054",
      lines: ["145054:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: MORDOR_ATTACKER } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: MORDOR_ATTACKER },
      ],
    },

    // 145055 Mordor Orc (Surge is a keyword). While Minas Tirith is in play its undefended damage is dealt to Minas Tirith (through City Wall), not to a hero (the flag undefendedToMinasTirith). Shadow: with Minas Tirith in play, this card engages the defending player
    // and is dealt a shadow card of its own; it stays engaged. With none the shadow does nothing and it is discarded as any shadow card is.
    {
      id: "145055:constant:1",
      cardCode: "145055",
      lines: ["145055:A:2"],
      timing: "constant",
      condition: CITY_IN_PLAY,
      instructions: [{ verb: "ModifyStat", stat: "undefendedToMinasTirith", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "145055:shadow:1", cardCode: "145055", lines: ["145055:A:3"], timing: "shadow", instructions: [{ verb: "EngageShadowCard", when: CITY_IN_PLAY }, { verb: "DealShadow", when: { kind: "sourceIn", zone: "engaged" } }] },

    // 145056 The Rammas is Breached. When Revealed: each player, the first player first, searches the encounter deck and discard pile for an enemy and puts it into play engaged with them; the encounter deck is shuffled. Shadow: the defending player chooses either 3 damage
    // to Minas Tirith or the attacking enemy makes an additional attack after this one.
    { id: "145056:whenRevealed:1", cardCode: "145056", lines: ["145056:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", to: "engaged" }]), { verb: "ShuffleEncounterDeck" }] },
    { id: "145056:shadow:1", cardCode: "145056", lines: ["145056:A:2"], timing: "shadow", instructions: [CITY_OR(3, ADDITIONAL_ATTACK)] },

    // 145057 Fell Beast (Surge is a keyword). When Revealed: it attaches to a Nazgûl enemy in play (Limit 1 per enemy); with none it is discarded. It counts as a Mount attachment: the attached enemy gets +1 Threat, +1 Attack, +1 Defense and -10 engagement cost, and at
    // the end of the round it is returned to the staging area.
    {
      id: "145057:whenRevealed:1",
      cardCode: FELL_BEAST,
      lines: ["145057:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "enemy", control: "any", staging: true, trait: "Nazgûl", hasAttachment: { names: ["Fell Beast"], none: true } } },
        { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true, trait: "Nazgûl", hasAttachment: { names: ["Fell Beast"], none: true } } } },
      ],
    },
    {
      id: "145057:constant:1",
      cardCode: FELL_BEAST,
      lines: ["145057:A:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", target: "host" },
      ],
    },
    { id: "145057:forced:1", cardCode: FELL_BEAST, lines: ["145057:A:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "ReturnToStaging", target: { kind: "host" } }] },

    // 145058 Black Dart (Peril is a keyword). When Revealed: the revealing player removes a hero they control from the quest (one not committed stays as it is) and attaches Black Dart to that hero (Limit 1 per hero). It counts as a Condition: at the end of the round it
    // deals 1 damage to its hero. Shadow: if this attack damages a hero, Black Dart attaches to that hero (the defender, or the hero an undefended attack landed on).
    {
      id: "145058:whenRevealed:1",
      cardCode: BLACK_DART,
      lines: ["145058:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { ...MY_HERO, hasAttachment: { names: ["Black Dart"], none: true } } },
        { verb: "RemoveFromQuest", when: { kind: "canPick", pick: { ...MY_HERO, hasAttachment: { names: ["Black Dart"], none: true } } } },
        { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: { ...MY_HERO, hasAttachment: { names: ["Black Dart"], none: true } } } },
      ],
    },
    { id: "145058:forced:1", cardCode: BLACK_DART, lines: ["145058:A:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "DamageCard", amount: 1, target: "host" }] },
    { id: "145058:shadow:1", cardCode: BLACK_DART, lines: ["145058:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "AttachShadowToHero", code: BLACK_DART, when: { kind: "dealt" } }] }] },

    // 145059 Spells of Ruin. When Revealed: the revealing player chooses either 1 damage to each exhausted character (every player's) or 5 damage to Minas Tirith. Shadow: the attacking enemy gets +1 Attack; if this attack destroys a character, 2 damage to Minas Tirith.
    {
      id: "145059:whenRevealed:1",
      cardCode: "145059",
      lines: ["145059:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            {
              id: "exhausted",
              requires: { kind: "canPick", pick: { type: "character", control: "any", state: "exhausted" } },
              instructions: [{ verb: "Each", pick: { type: "character", control: "any", state: "exhausted" }, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] }],
            },
            { id: "city", requires: CITY_IN_PLAY, instructions: [{ verb: "DamageMinasTirith", amount: 5 }] },
          ],
        },
      ],
    },
    {
      id: "145059:shadow:1",
      cardCode: "145059",
      lines: ["145059:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "DamageMinasTirith", amount: 2, when: { kind: "x", min: 1 } }] }],
    },

    // 145060 Dread and Despair (Doomed 1 and Peril are keywords). When Revealed: the revealing player discards an ally they control (their pick); until the end of the phase the total Threat in the staging area is raised by 1 for each ally in their discard pile, the one
    // just discarded counting. Shadow: the defending player discards a non-objective attachment they control.
    {
      id: "145060:whenRevealed:1",
      cardCode: "145060",
      lines: ["145060:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "ally", control: "you" } },
        { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "ally", control: "you" } } },
        { verb: "RaiseStagingThreat", amount: { count: { type: "card", control: "you", from: "discard", cardType: "ally" } }, until: "endOfPhase" },
      ],
    },
    { id: "145060:shadow:1", cardCode: "145060", lines: ["145060:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", nonObjective: true } }, { verb: "DiscardPicked" }] },

    // 145061 Shadow of Mordor (Doomed 1 is a keyword). When Revealed: each player, the first player first, deals 1 damage to a hero they control; until the end of the round the printed text box of each damaged character, now or later, is treated as blank (its Traits stay).
    {
      id: "145061:whenRevealed:1",
      cardCode: "145061",
      lines: ["145061:A:2"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "Pick", pick: MY_HERO }, { verb: "DamageCard", amount: 1, target: "picked" }]), { verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", target: "damagedCharacters" }],
    },

    // 145062 Wraith on Wings (the keywords and the Nazgûl trait are templates). +1 Threat and -1 engagement cost for each resource on it. Forced: at the beginning of the quest phase it gets 1 resource, at most 5 (a limit on the tokens, not a way to lose).
    {
      id: "145062:constant:2",
      cardCode: WRAITH,
      lines: ["145062:A:3"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "engagementCost", amount: { stat: "resources", of: "self", negative: true }, until: "whileSourceInPlay", target: "self" },
      ],
    },
    {
      id: "145062:forced:1",
      cardCode: WRAITH,
      lines: ["145062:A:4"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: QUEST_PHASE,
      instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self", when: { kind: "less", left: { stat: "resources", of: "self" }, right: 5 } }],
    },

    // 145072 The Corsair Fleet (Gondor side; staged by the campaign card with X resources). Forced: at the beginning of the quest phase it loses 1 resource; with none left the first player takes control of Aragorn, set aside with his attachments, and the Fleet goes to
    // the victory display. A skipped quest phase (stage 1) runs no removal.
    {
      id: "145072:forced:1",
      cardCode: FLEET,
      lines: ["145072:A:1"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: QUEST_PHASE,
      instructions: [
        { verb: "RemoveResourceTokens", code: FLEET, amount: 1 },
        { verb: "ReturnSetAsideHero", code: ARAGORN, when: { kind: "less", left: { stat: "resources", of: "self" }, right: 1 } },
        { verb: "AddSourceToVictory", when: { kind: "less", left: { stat: "resources", of: "self" }, right: 1 } },
      ],
    },

    ...STAGE_RECORDS,
];

export const AUTHORED_REPLACES: readonly string[] = [];
