import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { ALWAYS } from "./conditions.ts";
import { AUTHORED_EFFECTS as THE_FATE_OF_WILDERLAND } from "./the-fate-of-wilderland.ts";
import { AUTHORED_EFFECTS as THE_OATH } from "./the-oath.ts";
import { AUTHORED_EFFECTS as THE_WITHERED_HEATH } from "./the-withered-heath.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Uruk-hai (the-two-towers part 1, campaign card 143071, whose records are in the-two-towers.ts): the boons the Fellowship campaign places (Permanent, attached to a hero), the pursuit tracker
// (mec112.pursuit: set by the quest card's Setup, raised and lowered by the cards below, read as X by both quest stages), the Captives (heroes lying faceup under To Isengard! or held by Grishnákh,
// families/captives) and the encounter cards no template reads. Every line is read from the scan ledger (data/printed/the-two-towers.json); a line a template already writes (pnpm data:build) or another card prints
// word for word needs no record here. The piles place Uglúk, To Isengard! and Eastemnet (the first two sentences of 143069:A:1); its record chooses the Captives and sets the pursuit value.
// Rules: mec112.pursuit, mec112.permanent, mec112.toughness, rr.attachment-cards, rr.lasting-effects, rr.step-6-8b, rr.player-elimination, rr.quest-advancement, rr.reveal, rr.travel, faq.additional-attacks (data/rules/entries.json).
const NON_UNIQUE_ENEMY: PickSpec = { type: "enemy", control: "any", nonUnique: true };
const ANY_HERO_OR_CAPTIVE: PickSpec = { type: "hero", control: "any", damaged: true, captive: "include" };
const COMMITTED_CHARACTERS: PickSpec = { type: "character", control: "any", committed: true };
const STAGING_ENEMIES: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const ATTACKING_ENEMY_PLUS_ONE: Instruction = { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// "If this attack destroys a character, increase the pursuit value by 1": after the attack, when it destroyed one (the attack's X is the characters it destroyed).
const PURSUIT_IF_DESTROYS: Instruction = { verb: "AfterAttack", instructions: [{ verb: "RaisePursuit", amount: 1, when: { kind: "x", min: 1 } }] };
const NO_CAPTIVE_OF_ACTOR: Condition = { kind: "captives", max: 0, of: "actor" };
const ISENGARD = "143022";
// "Allies cannot be declared as attackers or defenders against Uglúk": the Defense half is the Restrict of Orc-chieftain (142045:A:1), the attack half Dagnir's flag.
const UGLUK_HOLDERS: PickSpec = { type: "card", control: "any", names: ["Uglúk"], engagedEnemies: true };
const ENEMY_NAMED_UGLUK: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Uglúk"] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 143015 Intimidation, 143016 Hands of a Healer, 143017 Forewarned, 143018 Leader of Men: Permanent boons attached to a hero with the trait (the restriction is read as the attachment enters play).
    { id: "143015:setup:1", cardCode: "143015", lines: ["143015:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Warrior" } }] },
    {
      id: "143015:response:1",
      cardCode: "143015",
      lines: ["143015:A:3"],
      timing: "response",
      trigger: "declaredAttacker",
      subject: "host",
      cost: { kind: "exhaustSelf" },
      condition: { kind: "all", conditions: [{ kind: "soleAttacker" }, { kind: "matches", card: "other", pick: NON_UNIQUE_ENEMY }] },
      instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfAttack", target: "other" }],
    },
    { id: "143016:setup:1", cardCode: "143016", lines: ["143016:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Healer" } }] },
    {
      id: "143016:action:1",
      cardCode: "143016",
      lines: ["143016:A:3"],
      timing: "action",
      cost: [{ kind: "exhaustSelf" }, { kind: "exhaustHost" }],
      condition: { kind: "canPick", pick: ANY_HERO_OR_CAPTIVE },
      instructions: [{ verb: "Pick", pick: ANY_HERO_OR_CAPTIVE }, { verb: "Heal", amount: 3, target: "picked" }],
    },
    { id: "143017:setup:1", cardCode: "143017", lines: ["143017:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Ranger" } }] },
    {
      id: "143017:response:1",
      cardCode: "143017",
      lines: ["143017:A:3"],
      timing: "response",
      trigger: "declaredDefender",
      subject: "host",
      cost: { kind: "exhaustSelf" },
      condition: { kind: "matches", card: "other", pick: { ...NON_UNIQUE_ENEMY, hasShadow: true } },
      instructions: [{ verb: "DiscardShadowOf", target: "other" }],
    },
    { id: "143018:setup:1", cardCode: "143018", lines: ["143018:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Noble" } }] },
    { id: "143018:response:1", cardCode: "143018", lines: ["143018:A:3"], timing: "response", trigger: "questedSuccessfully", subject: "host", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "AddResources", amount: 1, to: "host" }] },
    // 143019 Beyond All Hope: +1 Willpower, Attack and Defense; no treachery card can be attached to the hero.
    {
      id: "143019:constant:1",
      cardCode: "143019",
      lines: ["143019:A:3"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "cannotHaveTreachery", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },

    // 143022 To Isengard!: each Captive's text box is blank (Captives are in play, controlled by no one: families/captives); with no Captive in play the players lose. Each round's refresh phase raises the pursuit value, and at 30 the players lose.
    { id: "143022:constant:1", cardCode: ISENGARD, lines: ["143022:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any", captive: "only" } }] },
    { id: "143022:constant:2", cardCode: ISENGARD, lines: ["143022:A:1"], timing: "constant", condition: { kind: "captives", max: 0 }, instructions: [{ verb: "LoseGame", reason: "No Captive is left in play" }] },
    {
      id: "143022:forced:1",
      cardCode: ISENGARD,
      lines: ["143022:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Refresh" },
      instructions: [{ verb: "RaisePursuit", amount: 1 }, { verb: "LoseGame", reason: "The Uruk-hai delivered their prisoners to Saruman", when: { kind: "pursuit", min: 30 } }],
    },
    // 143023 Uglúk: allies can be declared neither as attackers nor as defenders against him. (A:1, Toughness and no attachments, is a template.)
    {
      id: "143023:constant:2",
      cardCode: "143023",
      lines: ["143023:A:2"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "alliesCannotAttack", amount: 1, until: "whileSourceInPlay", holders: UGLUK_HOLDERS }, { verb: "Restrict", what: "defend", allies: true }],
    },
    // 143024 Grishnákh: as he enters play the first player chooses a Captive under To Isengard! and he holds it; when he leaves play in any way it lies under To Isengard! again; each quest phase ends with 1 damage to it.
    {
      id: "143024:forced:1",
      cardCode: "143024",
      lines: ["143024:A:1"],
      timing: "forced",
      trigger: "encounterEnteredPlay",
      subject: "self",
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", captive: "free", who: "firstPlayer" } }, { verb: "HoldCaptive" }],
    },
    { id: "143024:forced:2", cardCode: "143024", lines: ["143024:A:1"], timing: "forced", trigger: "leftPlay", subject: "self", instructions: [{ verb: "ReturnCaptive", under: ISENGARD }] },
    { id: "143024:forced:3", cardCode: "143024", lines: ["143024:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "DamageHeldCaptive", amount: 1 }] },
    // 143025 Uglúk's Uruk-hai, 143030 Rest by Night?, 143063 Isengard Uruk: the either/or of the player who revealed it.
    {
      id: "143025:whenRevealed:1",
      cardCode: "143025",
      lines: ["143025:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "pursuit", instructions: [{ verb: "RaisePursuit", amount: 3 }] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
    },
    // 143026 The Wold, 143027 Eastemnet: as the active location, after it is explored a Response; Travel raises the pursuit value.
    {
      id: "143026:response:1",
      cardCode: "143026",
      lines: ["143026:A:1"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }])],
    },
    { id: "143026:travel:1", cardCode: "143026", lines: ["143026:A:2"], timing: "travel", instructions: [{ verb: "RaisePursuit", amount: 1 }] },
    copyLine("143026:A:2", "143027:A:2"),
    {
      id: "143027:response:1",
      cardCode: "143027",
      lines: ["143027:A:1"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      instructions: [{ verb: "Each", pick: { type: "hero", control: "any", captive: "include" }, instructions: [{ verb: "AddResources", amount: 1, to: "picked" }] }],
    },
    // 143028 Plains of Rohan: X is the staging area's locations (Tangled Grove's line). 143028 and 143032 Shadow: +1 Attack; a character destroyed raises the pursuit value.
    copyLine("41011:A:1", "143028:A:1"),
    { id: "143028:shadow:1", cardCode: "143028", lines: ["143028:A:2"], timing: "shadow", instructions: [ATTACKING_ENEMY_PLUS_ONE, PURSUIT_IF_DESTROYS] },
    copyLine("143028:A:2", "143032:A:2"),
    // 143029 Banks of Entwash: progress placed on it raises the pursuit value (a location that progress explores has left play and hears nothing, as Ettenmoors does, 141061:A:2); the Shadow gives the defending player the choice.
    { id: "143029:forced:1", cardCode: "143029", lines: ["143029:A:1"], timing: "forced", trigger: "progressPlaced", subject: "self", instructions: [{ verb: "RaisePursuit", amount: 1 }] },
    {
      id: "143029:shadow:1",
      cardCode: "143029",
      lines: ["143029:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "pursuit", instructions: [{ verb: "RaisePursuit", amount: 1 }] }, { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] }] }],
    },
    // 143030 Rest by Night?: the quest phase ends at once and the pursuit value rises by 3, or each committed character takes 1 damage; nothing cancels it.
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
            { id: "pursuit", instructions: [{ verb: "RaisePursuit", amount: 3 }, { verb: "EndQuestPhase" }] },
            { id: "damage", instructions: [{ verb: "DamageEach", amount: 1, pick: COMMITTED_CHARACTERS }] },
          ],
        },
      ],
    },
    // 143031 Strange Weariness: the characters committed when it is revealed get -1 Willpower until the end of the round (a snapshot, as 01076 reads it); the Shadow's additional attack is dealt a new shadow card (faq.additional-attacks).
    { id: "143031:whenRevealed:1", cardCode: "143031", lines: ["143031:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfRound", holders: COMMITTED_CHARACTERS }] },
    { id: "143031:shadow:1", cardCode: "143031", lines: ["143031:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }] }] },
    // 143032 Unseen Barrier: no more than 3 progress on the current quest this round (the active location takes its progress first, rr.active-location).
    { id: "143032:whenRevealed:1", cardCode: "143032", lines: ["143032:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 3, until: "endOfRound", target: "table" }] },
    // 143063 Isengard Uruk.
    {
      id: "143063:whenRevealed:1",
      cardCode: "143063",
      lines: ["143063:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [{ id: "damage", instructions: [{ verb: "AssignDamage", amount: 3, pick: { type: "character", control: "you" } }] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }],
        },
      ],
    },
    // 143064 Uruk-hai Fighter: returns to the staging area after destroying a character; the Shadow discards a non-objective attachment.
    copyLine("19013:A:2", "143064:A:2"),
    copyLine("19167:A:2", "143064:A:3"),
    // 143065 Fighting Uruk-hai: the player searches for an Uruk-hai enemy, reveals it and it is put into play engaged with them; until the end of the round each enemy engaged with them adds its Threat to the staging area's total.
    {
      id: "143065:whenRevealed:1",
      cardCode: "143065",
      lines: ["143065:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SearchReveal", trait: "Uruk-hai", type: "enemy", who: "actor", to: "engaged" },
        { verb: "ShuffleEncounterDeck" },
        { verb: "ModifyStat", stat: "engagedThreat", amount: 1, until: "endOfRound", holders: { type: "enemy", control: "any", engaged: "you" } },
      ],
    },
    // 143066 Snaga: a random card of the revealing player's hand is discarded; Snaga gets its printed cost as Threat until the end of the round.
    {
      id: "143066:whenRevealed:1",
      cardCode: "143066",
      lines: ["143066:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "DiscardRandomFromHand", remember: true },
        { verb: "ModifyStat", stat: "threat", amount: { stat: "cost", of: "picked", printed: true }, until: "endOfRound", target: "self" },
      ],
    },
    // 143067 Saruman's Orders: each player returns an enemy engaged with them to the staging area, or reveals an encounter card; the Shadow returns the attacker after it destroys a character.
    {
      id: "143067:whenRevealed:1",
      cardCode: "143067",
      lines: ["143067:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "return", requires: { kind: "hasEngaged" }, instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "actor", pick: "choose" } }] },
              { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
            ],
          },
        ]),
      ],
    },
    {
      id: "143067:shadow:1",
      cardCode: "143067",
      lines: ["143067:A:2"],
      timing: "shadow",
      instructions: [ATTACKING_ENEMY_PLUS_ONE, { verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: { kind: "x", min: 1 } }] }],
    },

    // 143069 Follow the Orcs. Setup: each seat the Campaign Log names a Captive for takes it, any other chooses a non-Fellowship hero it controls; each lies faceup under To Isengard!; the pursuit value is 10.
    // Side B: X is the pursuit value; Uglúk cannot leave the staging area or take damage; each combat phase ends with the pursuit value up by the enemies in the staging area.
    {
      id: "143069:setup:1",
      cardCode: "143069",
      lines: ["143069:A:1"],
      timing: "setup",
      instructions: [
        { verb: "TakeLoggedCaptives", under: ISENGARD },
        EACH_PLAYER([
          { verb: "Pick", pick: { type: "hero", control: "you", exceptSphere: "fellowship" }, when: NO_CAPTIVE_OF_ACTOR },
          { verb: "MakeCaptive", under: ISENGARD, when: NO_CAPTIVE_OF_ACTOR },
        ]),
        { verb: "SetPursuit", value: 10 },
      ],
    },
    { id: "143069:constant:1", cardCode: "143069", lines: ["143069:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { pursuit: true }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "143069:constant:2",
      cardCode: "143069",
      lines: ["143069:B:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: ENEMY_NAMED_UGLUK },
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: ENEMY_NAMED_UGLUK },
      ],
    },
    { id: "143069:forced:1", cardCode: "143069", lines: ["143069:B:3"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Combat" }, instructions: [{ verb: "RaisePursuit", amount: { count: STAGING_ENEMIES } }] },
    // 143070 Rescue the Captives. When Revealed: each player searches for an Uruk-hai enemy, reveals it and adds it to the staging area. Side B: X is the pursuit value; an enemy defeated lowers it;
    // the stage cannot be defeated while Uglúk is in play, and defeating it wins (the last stage): the Captives are rescued (they count as surviving heroes, campaign/score.ts).
    {
      id: "143070:whenRevealed:1",
      cardCode: "143070",
      lines: ["143070:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "SearchReveal", trait: "Uruk-hai", type: "enemy", who: "actor" }]), { verb: "ShuffleEncounterDeck" }],
    },
    copyLine("143069:B:1", "143070:B:1"),
    { id: "143070:response:1", cardCode: "143070", lines: ["143070:B:2"], timing: "response", trigger: "enemyDestroyed", instructions: [{ verb: "LowerPursuit", amount: 1 }] },
    { id: "143070:constant:2", cardCode: "143070", lines: ["143070:B:3"], timing: "constant", condition: { kind: "inPlay", code: "143023", is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  ],
  { pool: [...THE_OATH, ...THE_WITHERED_HEATH, ...THE_FATE_OF_WILDERLAND] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
