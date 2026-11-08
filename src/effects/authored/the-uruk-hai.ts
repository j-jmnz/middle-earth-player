import type { Condition, Effect } from "../../catalog/boundary.ts";
import { ALWAYS } from "./conditions.ts";
import { AUTHORED_EFFECTS as BREAKING } from "./breaking-of-the-fellowship.ts";
import { AUTHORED_EFFECTS as FIRE } from "./fire-in-the-night.ts";
import { AUTHORED_EFFECTS as OATH } from "./the-oath.ts";
import { copyLine, withCopies } from "./reprint.ts";
import { AUTHORED_EFFECTS as WITHERED } from "./the-withered-heath.ts";

// Records for The Uruk-hai (the-two-towers part 1, campaign card 143071; its Setup and Resolution are in the-two-towers.ts). Every line is read from the scan ledger (data/printed/the-two-towers.json).
// Rules: mec112.pursuit, mec112.setup-the-uruk-hai, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.player-elimination, rr.reveal, rr.staging, rr.cancel, rr.blank (data/rules/entries.json).
//
// The pursuit value is the pursuit tracker beside the quest deck (ScenarioState.pursuit): the quest card's Setup sets it, the stages' quest points are X, the pursuit value, and the verbs of the uruk family (src/catalog/families/uruk.ts)
// move it. The Captives are the heroes the players chose (or the Campaign Log named) at Setup: held faceup under To Isengard! or attached to Grishnákh, in play, controlled by no player, blank, keeping their tokens and attachments.
// The scenario places Eastemnet, Uglúk and To Isengard! itself (data/scenarios/the-uruk-hai.json), so the quest card's Setup record holds only the Captives and the tracker.
const TO_ISENGARD = "143022";
const UGLUK = "143023";

// "A hero" and "each hero's resource pool" are every hero in play, a Captive included (user ruling, 2026-11-08).
const ANY_HERO = { type: "hero", control: "any", captives: "also" } as const;
const ANY_HERO_HURT = { ...ANY_HERO, damaged: true } as const;
const CAPTIVES = { type: "hero", control: "any", captives: "only" } as const;
const STAGING_ENEMIES = { type: "enemy", control: "any", stagingOnly: true } as const;
const NON_UNIQUE_ENEMY = { type: "enemy", control: "any", nonUnique: true } as const;
const QUESTING = { type: "character", control: "any", committed: true } as const;
const THE_ATTACKING_ENEMY_HAS_A_SHADOW = { type: "enemy", control: "any", attackingEnemy: true, hasShadow: true } as const;
const LOGGED_CAPTIVE = { type: "hero", control: "you", loggedCaptive: true } as const;
const NO_LOGGED_CAPTIVE: Condition = { kind: "not", condition: { kind: "canPick", pick: LOGGED_CAPTIVE } };
const PURSUIT = (amount: number) => ({ verb: "RaisePursuit", amount }) as const;
// "If this attack destroys a character" (the attack's X is the characters it destroyed).
const X_AT_LEAST_ONE: Condition = { kind: "x", min: 1 };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 143015 Intimidation (a Skill boon, Permanent). Setup: attach to a Warrior hero. Response: after the attached hero is declared as the only attacker against a non-unique enemy, exhaust this to give that enemy -2 Defense for the attack.
    { id: "143015:setup:1", cardCode: "143015", lines: ["143015:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Warrior" } }] },
    {
      id: "143015:response:1",
      cardCode: "143015",
      lines: ["143015:A:3"],
      timing: "response",
      trigger: "declaredAttacker",
      subject: "host",
      cost: { kind: "exhaustSelf" },
      condition: { kind: "attacking", card: "host", alone: true, enemy: NON_UNIQUE_ENEMY },
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfAttack", target: "other" }],
    },

    // 143016 Hands of a Healer. Setup: attach to a Healer hero. Action: exhaust the attached hero and this card to heal up to 3 damage from a hero (any hero in play, a Captive included: user ruling, 2026-11-08).
    { id: "143016:setup:1", cardCode: "143016", lines: ["143016:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Healer" } }] },
    {
      id: "143016:action:1",
      cardCode: "143016",
      lines: ["143016:A:3"],
      timing: "action",
      cost: [{ kind: "exhaustHost" }, { kind: "exhaustSelf" }],
      condition: { kind: "canPick", pick: ANY_HERO_HURT },
      instructions: [{ verb: "Pick", pick: ANY_HERO_HURT }, { verb: "Heal", amount: 3, target: "picked" }],
    },

    // 143017 Forewarned. Setup: attach to a Ranger hero. Response: after the attached hero is declared as a defender against a non-unique enemy, exhaust this to discard 1 shadow card from that enemy (the attacking enemy).
    { id: "143017:setup:1", cardCode: "143017", lines: ["143017:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Ranger" } }] },
    {
      id: "143017:response:1",
      cardCode: "143017",
      lines: ["143017:A:3"],
      timing: "response",
      trigger: "declaredDefender",
      subject: "host",
      cost: { kind: "exhaustSelf" },
      condition: { kind: "all", conditions: [{ kind: "matches", card: "other", pick: NON_UNIQUE_ENEMY }, { kind: "canPick", pick: THE_ATTACKING_ENEMY_HAS_A_SHADOW }] },
      instructions: [{ verb: "Pick", pick: THE_ATTACKING_ENEMY_HAS_A_SHADOW }, { verb: "DiscardShadow" }],
    },

    // 143018 Leader of Men. Setup: attach to a Noble hero. Response: after the attached hero quests successfully, exhaust this to add 1 resource to the attached hero's pool.
    { id: "143018:setup:1", cardCode: "143018", lines: ["143018:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Noble" } }] },
    { id: "143018:response:1", cardCode: "143018", lines: ["143018:A:3"], timing: "response", trigger: "questedSuccessfully", subject: "host", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "AddResources", amount: 1, to: "host" }] },

    // 143019 Beyond All Hope (Permanent; Setup: attach to a hero, a template). The attached hero gets +1 Willpower, +1 Attack and +1 Defense and cannot have treachery cards attached.
    {
      id: "143019:constant:1",
      cardCode: "143019",
      lines: ["143019:A:3"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "noTreacheryAttachments", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },

    // 143022 To Isengard! (objective, in the staging area). Treat each Captive's text box as blank; the Captives are in play and controlled by no player (the captive zone). If there are no Captives in play, the players lose the game.
    // Forced: at the end of the refresh phase increase the pursuit value by 1; then at 30 or more the players lose (mec112.pursuit).
    { id: "143022:constant:1", cardCode: TO_ISENGARD, lines: ["143022:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: CAPTIVES }] },
    {
      id: "143022:constant:2",
      cardCode: TO_ISENGARD,
      lines: ["143022:A:1"],
      timing: "constant",
      condition: { kind: "count", pick: CAPTIVES, max: 0 },
      instructions: [{ verb: "LoseGame", reason: "No Captive remains in play" }],
    },
    {
      id: "143022:forced:1",
      cardCode: TO_ISENGARD,
      lines: ["143022:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Refresh" },
      instructions: [PURSUIT(1), { verb: "LoseGame", reason: "The pursuit value reached 30", when: { kind: "pursuit", min: 30 } }],
    },

    // 143023 Uglúk (Toughness 3 and Cannot have attachments are keywords). Allies cannot be declared as attackers or defenders against him.
    {
      id: "143023:constant:2",
      cardCode: UGLUK,
      lines: ["143023:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "alliesCannotAttack", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "Restrict", what: "defend", allies: true }],
    },

    // 143024 Grishnákh. Forced: after he enters play the first player attaches 1 of the Captives to him (held by him, faceup, until he leaves play). If he is defeated, the attached Captive is placed faceup underneath To Isengard!
    // (any way he leaves play: user ruling, 2026-11-08). Forced: at the end of the quest phase, deal 1 damage to the attached Captive.
    {
      id: "143024:forced:1",
      cardCode: "143024",
      lines: ["143024:A:1"],
      timing: "forced",
      trigger: "encounterEnteredPlay",
      subject: "self",
      instructions: [{ verb: "Pick", pick: { ...CAPTIVES, who: "firstPlayer" } }, { verb: "AttachCaptive" }],
    },
    { id: "143024:forced:2", cardCode: "143024", lines: ["143024:A:1"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "ReturnCaptive", under: TO_ISENGARD }] },
    {
      id: "143024:forced:3",
      cardCode: "143024",
      lines: ["143024:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Quest" },
      instructions: [{ verb: "Each", pick: { type: "hero", control: "any", captives: "held" }, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] }],
    },

    // 143025 Uglúk's Uruk-hai (Peril, Toughness 1 and Archery 1 are keywords). When Revealed: either increase the pursuit value by 3, or reveal an additional encounter card.
    {
      id: "143025:whenRevealed:1",
      cardCode: "143025",
      lines: ["143025:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "pursuit", instructions: [PURSUIT(3)] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
    },

    // 143026 The Wold. While it is the active location it gains "Response: After The Wold is explored, each player draws 1 card." Travel: increase the pursuit value by 1.
    {
      id: "143026:response:1",
      cardCode: "143026",
      lines: ["143026:A:1"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 1 }] }],
    },
    { id: "143026:travel:1", cardCode: "143026", lines: ["143026:A:2"], timing: "travel", instructions: [PURSUIT(1)] },

    // 143027 Eastemnet. While it is the active location it gains "Response: After Eastemnet is explored, add 1 resource to each hero's resource pool." Travel: increase the pursuit value by 1 (copied from The Wold).
    {
      id: "143027:response:1",
      cardCode: "143027",
      lines: ["143027:A:1"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      instructions: [{ verb: "Each", pick: ANY_HERO, instructions: [{ verb: "AddResources", amount: 1, to: "picked" }] }],
    },
    copyLine("143026:A:2", "143027:A:2"),

    // 143028 Plains of Rohan. X (its Threat) is the number of locations in the staging area (copied from Tangled Grove). Shadow: attacking enemy gets +1 Attack; if this attack destroys a character, increase the pursuit value by 1.
    copyLine("41011:A:1", "143028:A:1"),
    {
      id: "143028:shadow:1",
      cardCode: "143028",
      lines: ["143028:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ ...PURSUIT(1), when: X_AT_LEAST_ONE }] }],
    },

    // 143029 Banks of Entwash. Forced: after any amount of progress is placed on it, increase the pursuit value by 1. Shadow: either increase the pursuit value by 1, or this attack is considered undefended.
    { id: "143029:forced:1", cardCode: "143029", lines: ["143029:A:1"], timing: "forced", trigger: "progressPlaced", instructions: [PURSUIT(1)] },
    {
      id: "143029:shadow:1",
      cardCode: "143029",
      lines: ["143029:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "pursuit", instructions: [PURSUIT(1)] }, { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] }] }],
    },

    // 143030 Rest by Night? When Revealed: either immediately end the quest phase and increase the pursuit value by 3, or deal 1 damage to each character committed to the quest. This effect cannot be canceled.
    {
      id: "143030:whenRevealed:1",
      cardCode: "143030",
      lines: ["143030:A:1"],
      timing: "whenRevealed",
      uncancelable: ALWAYS,
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "end", instructions: [{ verb: "EndQuestPhase" }, PURSUIT(3)] },
            { id: "damage", instructions: [{ verb: "Each", pick: QUESTING, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] }] },
          ],
        },
      ],
    },

    // 143031 Strange Weariness. When Revealed: each character committed to the quest gets -1 Willpower until the end of the round (the characters committed when it resolves, even after the quest phase: user ruling, 2026-11-08).
    // Shadow: attacking enemy makes an additional attack against you after this one (copied from The Dragon's Fury).
    { id: "143031:whenRevealed:1", cardCode: "143031", lines: ["143031:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfRound", holders: QUESTING }] },
    copyLine("19081:A:2", "143031:A:2"),

    // 143032 Unseen Barrier. When Revealed: no more than 3 progress can be placed on the current quest this round (progress placed on the active location does not count). Shadow: as Plains of Rohan's.
    { id: "143032:whenRevealed:1", cardCode: "143032", lines: ["143032:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 3, until: "endOfRound", target: "table" }] },
    copyLine("143028:A:2", "143032:A:2"),

    // 143063 Isengard Uruk (Peril, Toughness 1 and Archery 2 are keywords). When Revealed: either assign 3 damage among characters you control, or reveal an additional encounter card.
    {
      id: "143063:whenRevealed:1",
      cardCode: "143063",
      lines: ["143063:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "damage", instructions: [{ verb: "AssignDamage", amount: 3, pick: { type: "character", control: "you" } }] },
            { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
          ],
        },
      ],
    },

    // 143064 Uruk-hai Fighter. Forced: after it attacks and destroys a character, return it to the staging area (copied from Snow-troll). Shadow: discard a non-objective attachment you control (copied from Uruk-hai Tracker).
    copyLine("19013:A:2", "143064:A:2"),
    copyLine("142071:A:3", "143064:A:3"),

    // 143065 Fighting Uruk-hai. When Revealed: search the encounter deck and discard pile for an Uruk-hai enemy, reveal it and put it into play engaged with you; shuffle the encounter deck. Until the end of the round each enemy engaged with
    // you adds its Threat to the total Threat in the staging area (a flag on the seat, so an enemy that engages you later this round adds it too).
    {
      id: "143065:whenRevealed:1",
      cardCode: "143065",
      lines: ["143065:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SearchReveal", trait: "Uruk-hai", type: "enemy", who: "actor", engaged: true },
        { verb: "ShuffleEncounterDeck" },
        { verb: "ModifyStat", stat: "engagedThreat", amount: 1, until: "endOfRound", target: "actorSeat" },
      ],
    },

    // 143066 Snaga. When Revealed: discard 1 random card from your hand; Snaga gets +X Threat until the end of the round, X being the discarded card's printed cost.
    {
      id: "143066:whenRevealed:1",
      cardCode: "143066",
      lines: ["143066:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "SetX", value: 0 }, { verb: "DiscardRandomFromHand", setX: true }, { verb: "ModifyStat", stat: "threat", amount: { x: true }, until: "endOfRound", target: "self" }],
    },

    // 143067 Saruman's Orders. When Revealed: each player must choose either to return an enemy engaged with them to the staging area or to reveal an encounter card. Shadow: attacking enemy gets +1 Attack; if this attack destroys a
    // character, return the attacking enemy to the staging area.
    {
      id: "143067:whenRevealed:1",
      cardCode: "143067",
      lines: ["143067:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "return", requires: { kind: "hasEngaged" }, instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "actor", pick: "choose" } }] },
                { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "143067:shadow:1",
      cardCode: "143067",
      lines: ["143067:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: X_AT_LEAST_ONE }] },
      ],
    },

    // 143069 Follow the Orcs (stage 1). Setup (Eastemnet, Uglúk and To Isengard! are placed by the scenario's piles): each player takes 1 Captive and places it faceup underneath To Isengard!: the hero the Campaign Log names as that
    // seat's captive without asking, else a non-Fellowship hero the player chooses (user ruling, 2026-11-08); the pursuit value is set to 10.
    {
      id: "143069:setup:1",
      cardCode: "143069",
      lines: ["143069:A:1"],
      timing: "setup",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            // No hero of the seat on the log: the player picks one and it is taken. A hero the log names is taken without asking (the last instruction); the picks are skipped while the log names one.
            { verb: "Pick", pick: { type: "hero", control: "you", exceptSphere: "fellowship" }, when: NO_LOGGED_CAPTIVE },
            { verb: "TakeCaptive", under: TO_ISENGARD, when: NO_LOGGED_CAPTIVE },
            { verb: "TakeCaptive", under: TO_ISENGARD, logged: true, when: { kind: "canPick", pick: LOGGED_CAPTIVE } },
          ],
        },
        { verb: "SetPursuit", value: 10 },
      ],
    },
    // Side B: X, the stage's quest points, is the pursuit value (the base is 0, data/overrides.json). Uglúk cannot leave the staging area or take damage. Forced: at the end of the combat phase increase the pursuit value by 1 for each
    // enemy in the staging area.
    { id: "143069:constant:1", cardCode: "143069", lines: ["143069:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { pursuit: true }, until: "whileSourceInPlay" }] },
    {
      id: "143069:constant:2",
      cardCode: "143069",
      lines: ["143069:B:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["Uglúk"] } },
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["Uglúk"] } },
      ],
    },
    {
      id: "143069:forced:1",
      cardCode: "143069",
      lines: ["143069:B:3"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Combat" },
      instructions: [{ verb: "RaisePursuit", amount: { count: STAGING_ENEMIES } }],
    },

    // 143070 Rescue the Captives (stage 2). When Revealed: each player searches the encounter deck and discard pile for an Uruk-hai enemy, reveals it and adds it to the staging area; shuffle the encounter deck. Side B: X is the
    // pursuit value (as stage 1). Response: after an enemy is defeated, reduce the pursuit value by 1. The players cannot defeat this stage while Uglúk is in play; defeating it rescues each Captive and wins the game (the last stage).
    {
      id: "143070:whenRevealed:1",
      cardCode: "143070",
      lines: ["143070:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchReveal", trait: "Uruk-hai", type: "enemy", who: "actor" }] }, { verb: "ShuffleEncounterDeck" }],
    },
    copyLine("143069:B:1", "143070:B:1"),
    { id: "143070:response:1", cardCode: "143070", lines: ["143070:B:2"], timing: "response", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any" }, instructions: [{ verb: "LowerPursuit", amount: 1 }] },
    { id: "143070:constant:2", cardCode: "143070", lines: ["143070:B:3"], timing: "constant", condition: { kind: "inPlay", code: UGLUK, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  ],
  { pool: [...OATH, ...WITHERED, ...FIRE, ...BREAKING] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
