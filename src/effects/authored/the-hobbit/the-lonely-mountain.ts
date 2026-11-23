import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THING } from "../the-thing-in-the-depths.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Lonely Mountain (the-hobbit cycle part 5, no campaign card): the four quest stages, the Smaugs, A Bare Patch, The Lonely Mountain and its locations, Croaking Crows and the four treacheries. Every line is read from the scan ledger (data/printed/); a line a template already writes
// (pnpm data build) or another card prints word for word needs no record here. The set Wilderland (10 cards) is The Battle of Five Armies' (src/effects/authored/the-hobbit/set-wilderland.ts).
// The burgle attempt (families/burgle) is a verb of the record that makes it; a Burgle line is a constant marker, read only for the card step 1 of an attempt stops at. The readings are in docs/scenarios/the-hobbit.md (The Lonely Mountain).
// Rules: hob.burgle, hob.burgle-example, hob.indestructible, hob.treasure-otd, rr.modifiers, rr.travel, rr.first-player, rr.then, rr.cancel, rr.immune, rr.action, rr.forced, rr.response, rr.attachment-cards, rr.objective-cards, rr.winning-the-game, rr.surge,
// rr.in-play-and-out-of-play, rr.staging, rr.effects, rr.exhausted, rr.damage, rr.resources, rr.cost, faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.lasting-effects, faq.progress-without-advancing, faq.triggering-forced-effects (data/rules/entries.json).
const GOLDEN = "132040";
const MAGNIFICENT = "132041";
const MOUNTAIN = "132043";
const PATCH = "132039";
const STAGE_1 = "132071";
const STAGE_2 = "132072";
const STAGE_3 = "132073";
const STAGE_4 = "132074";
const TREASURES = ["132020", "132021", "132022", "132023", "132024"];

// Smaug the Golden, in play (he is in the staging area).
const GOLDEN_PICK: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Smaug the Golden"] };
const DRAGON_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, traits: ["Dragon"] };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready", who: "firstPlayer" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const FIRST_PLAYER: Condition = { kind: "firstPlayer" };
// The 6th progress on Smaug the Golden sends the quest to stage 4A at once (132040:A:3), so the rest of stage 2B's line is not read: the stage text is no longer in play (faq.triggering-forced-effects).
const STAGE_TWO_STILL: Condition = { kind: "onStage", stage: 2 };

// A Burgle line (hob.burgle): the number of cards the first player may discard and what they share with the revealed card.
const burgleLine = (code: string, line: string, id: number, discard: number, match: ("sphere" | "type" | "cost")[]): Effect => ({
  id: `${code}:constant:${id}`,
  cardCode: code,
  lines: [`${code}:${line}`],
  timing: "constant",
  instructions: [{ verb: "BurgleEffect", discard, match }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 132039 A Bare Patch (set aside until stage 3A). Attached to Smaug the Magnificent it lowers his Defense by 3. After the players quest successfully, while it is in the staging area, the first player makes a burgle attempt and, if it succeeds, attaches it to him.
    { id: "132039:constant:1", cardCode: PATCH, lines: ["132039:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -3, until: "whileSourceInPlay", target: "host" }] },
    {
      id: "132039:response:1",
      cardCode: PATCH,
      lines: ["132039:A:2"],
      timing: "response",
      trigger: "questSucceeded",
      condition: { kind: "all", conditions: [FIRST_PLAYER, { kind: "sourceIn", zone: "staging" }, { kind: "inPlay", code: MAGNIFICENT, is: true }] },
      instructions: [{ verb: "BurgleAttempt" }, { verb: "AttachSelfToNamed", name: "Smaug the Magnificent", when: { kind: "burgleSucceeded" } }],
    },

    // 132040 Smaug the Golden. Indestructible, immune to player card effects and cannot be engaged as The Thing in the Depths prints it; his Threat is the number of committed characters without the Burglar trait, counted as it changes. With the 6th progress token on him the players
    // advance to stage 4A.
    copyLine("110063:A:2", "132040:A:1"),
    { id: "132040:constant:2", cardCode: GOLDEN, lines: ["132040:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "character", control: "any", committed: true, notTraits: ["Burglar"] } }, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "132040:forced:1",
      cardCode: GOLDEN,
      lines: ["132040:A:3"],
      timing: "forced",
      trigger: "progressPlaced",
      subject: "self",
      condition: { kind: "matches", card: "self", pick: { type: "enemy", control: "any", staging: true, minProgress: 6 } },
      instructions: [{ verb: "AdvanceToStage", code: STAGE_4 }],
    },

    // 132041 Smaug the Magnificent. He stays in the staging area, and is considered engaged with the first player as the Balrog is (142044:A:2); his Threat counts. As he attacks (the shadow card is dealt for the attack), a shadow card with a burgle effect that he holds gives him an additional attack right after this one: the attack must be in progress for it.
    {
      id: "132041:constant:1",
      cardCode: MAGNIFICENT,
      lines: ["132041:A:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "engagedWithFirst", amount: 1, until: "whileSourceInPlay", target: "self" },
      ],
    },
    { id: "132041:forced:1", cardCode: MAGNIFICENT, lines: ["132041:A:3"], timing: "forced", trigger: "attacks", subject: "self", condition: { kind: "shadowBurgle" }, instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

    // 132042 Croaking Crows (surge is a keyword). When a location is revealed from the encounter deck, 1 progress goes on Smaug the Golden. A burgle attempt does not reveal the cards it discards, so they do not trigger it.
    {
      id: "132042:forced:1",
      cardCode: "132042",
      lines: ["132042:A:2"],
      timing: "forced",
      trigger: "revealed",
      byEncounterDeck: true,
      subject: { type: "location", control: "any" },
      instructions: [{ verb: "Pick", pick: GOLDEN_PICK }, { verb: "PlaceProgressOn", amount: 1, target: "picked" }],
    },
    burgleLine("132042", "A:3", 1, 1, ["sphere", "type"]),

    // 132043 The Lonely Mountain. With a treasure stacked under it, it is immune to player card effects, stays in the staging area and has 2 less Threat for each card under it. The Action while the first player makes a burgle attempt: 2 Baggins resources for the revealed card in hand and the next one revealed.
    {
      id: "132043:constant:1",
      cardCode: MOUNTAIN,
      lines: ["132043:A:1"],
      timing: "constant",
      condition: { kind: "facedownUnder", code: MOUNTAIN, min: 1 },
      instructions: [
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "threat", amount: { facedown: true, times: 2, negative: true }, until: "whileSourceInPlay", target: "self" },
      ],
    },
    { id: "132043:action:1", cardCode: MOUNTAIN, lines: ["132043:A:2"], timing: "action", cost: { kind: "resources", amount: 2, sphere: "baggins" }, condition: { kind: "burgling" }, instructions: [{ verb: "BurgleTake" }] },

    // 132044 Great Hall. While it is the active location it puts 1 progress on Smaug the Golden at the end of each round.
    { id: "132044:forced:1", cardCode: "132044", lines: ["132044:A:1"], timing: "forced", trigger: "endOfRound", condition: ACTIVE, instructions: [{ verb: "Pick", pick: GOLDEN_PICK }, { verb: "PlaceProgressOn", amount: 1, target: "picked" }] },
    burgleLine("132044", "A:2", 1, 3, ["type"]),

    // 132045 Secret Entrance. While it is active the Mountain's Threat is halved. To travel here the first player exhausts a hero and names a card type, the players travel, and the top card of the encounter deck is looked at: if it is not the named type the location goes back to the staging area.
    { id: "132045:constant:1", cardCode: "132045", lines: ["132045:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "threatHalved", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", names: ["The Lonely Mountain"] } }] },
    {
      id: "132045:travel:1",
      cardCode: "132045",
      lines: ["132045:A:2"],
      timing: "travel",
      instructions: [
        { verb: "Pick", pick: READY_HERO },
        { verb: "Exhaust", target: { kind: "picked" } },
        {
          verb: "Choose",
          who: "firstPlayer",
          options: (["enemy", "location", "treachery", "objective"] as const).map((cardType) => ({
            id: cardType,
            instructions: [
              { verb: "Travel" as const, to: "self" as const },
              { verb: "LookAtEncounterTop" as const },
              { verb: "ReturnToStaging" as const, target: { kind: "self" as const }, when: { kind: "not" as const, condition: { kind: "encounterTop" as const, cardType } } },
            ],
          })),
        },
      ],
    },

    // 132046 Desolation of Smaug. While it is the active location the first treachery revealed each round gains surge.
    { id: "132046:constant:1", cardCode: "132046", lines: ["132046:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "FirstTreacherySurge" }] },
    burgleLine("132046", "A:2", 2, 2, ["cost"]),

    // 132047 Western Slopes. When it leaves play explored the first player draws 2 cards or removes 1 progress from Smaug the Golden.
    {
      id: "132047:response:1",
      cardCode: "132047",
      lines: ["132047:A:1"],
      timing: "response",
      trigger: "leftPlay",
      condition: { kind: "subjectExplored" },
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "draw", instructions: [{ verb: "Draw", amount: 2, who: "firstPlayer" }] },
            { id: "remove", requires: { kind: "canPick", pick: { ...GOLDEN_PICK, minProgress: 1 } }, instructions: [{ verb: "Pick", pick: GOLDEN_PICK }, { verb: "RemoveProgressFrom", amount: 1, target: "picked" }] },
          ],
        },
      ],
    },
    burgleLine("132047", "A:2", 1, 2, ["sphere"]),

    // 132048 Pretending to Sleep (surge is a keyword). 1 progress goes on Smaug the Golden; then the first player spends as many Baggins resources as he has progress or advances to stage 4A. With no Smaug the Golden in play, only the surge happens.
    {
      id: "132048:whenRevealed:1",
      cardCode: "132048",
      lines: ["132048:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: GOLDEN_PICK },
        { verb: "PlaceProgressOn", amount: 1, target: "picked" },
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "spend", requires: { kind: "all", conditions: [{ kind: "canPick", pick: GOLDEN_PICK }, { kind: "bagginsAtLeast", amount: { stat: "progress", of: "picked" } }] }, instructions: [{ verb: "SpendBaggins", amount: { stat: "progress", of: "picked" } }] },
            { id: "advance", requires: { kind: "canPick", pick: GOLDEN_PICK }, instructions: [{ verb: "AdvanceToStage", code: STAGE_4 }] },
          ],
        },
      ],
    },
    burgleLine("132048", "A:3", 1, 2, ["type"]),

    // 132049 Known to an Ounce. Each player discards 2 cards at random from his hand; each Dragon in play gets +1 Threat until the end of the phase for each event discarded.
    { id: "132049:whenRevealed:1", cardCode: "132049", lines: ["132049:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardRandomRaiseThreat", amount: 2, cardType: "event", trait: "Dragon" }] },
    burgleLine("132049", "A:2", 1, 1, ["sphere", "cost"]),

    // 132050 Belching Fire. Each Dragon in the staging area attacks, one after the other with no shadow card, the player with the highest total Willpower committed.
    { id: "132050:whenRevealed:1", cardCode: "132050", lines: ["132050:A:1"], timing: "whenRevealed", instructions: [{ verb: "Each", pick: DRAGON_IN_STAGING, instructions: [{ verb: "AttackHighestWillpower" }] }] },
    burgleLine("132050", "A:2", 1, 1, ["type", "cost"]),

    // 132051 Dragon-Spell. It attaches to the hero with the most resources that has no Dragon-Spell (a tie is the first player's choice) as a Condition attachment: -1 Willpower for each resource in the hero's pool, and the hero takes damage equal to the resources it spends.
    { id: "132051:whenRevealed:1", cardCode: "132051", lines: ["132051:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", who: "firstPlayer", hasAttachment: { names: ["Dragon-Spell"], none: true }, mostResources: true } }, { verb: "AttachSelfToPicked", unlimited: true }] },
    { id: "132051:constant:1", cardCode: "132051", lines: ["132051:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    { id: "132051:constant:2", cardCode: "132051", lines: ["132051:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: { stat: "resources", of: "host", negative: true }, until: "whileSourceInPlay", target: "host" }] },
    { id: "132051:forced:1", cardCode: "132051", lines: ["132051:A:1"], timing: "forced", trigger: "heroResourcesSpent", subject: "host", instructions: [{ verb: "DamageCard", amount: { x: true }, target: "host" }] },

    // 132071 A Warm Welcome (stage 1). Setup: the five Erebor treasures are shuffled and stacked facedown under The Lonely Mountain (the piles place the cards the Setup searches for). The players skip the quest phase; at the end of the round the quest advances to stage 2.
    { id: "132071:setup:1", cardCode: STAGE_1, lines: ["132071:A:1"], timing: "setup", instructions: [{ verb: "StackUnder", codes: TREASURES, under: MOUNTAIN }] },
    { id: "132071:constant:1", cardCode: STAGE_1, lines: ["132071:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "skipQuestPhase", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "132071:forced:1", cardCode: STAGE_1, lines: ["132071:B:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "AdvanceStage" }] },

    // 132072 The Burglar's Turn (stage 2). After questing successfully 1 progress goes on Smaug the Golden, the first player makes a burgle attempt (a success gives him the top treasure from under the Mountain) and the players may advance to stage 3. The 6th progress on Smaug sends
    // the quest to stage 4A at once, so the rest of the line is not read. When the first player's attempt fails Smaug the Golden attacks him.
    {
      id: "132072:forced:1",
      cardCode: STAGE_2,
      lines: ["132072:B:1"],
      timing: "forced",
      trigger: "questSucceeded",
      condition: FIRST_PLAYER,
      instructions: [
        { verb: "Pick", pick: GOLDEN_PICK },
        { verb: "PlaceProgressOn", amount: 1, target: "picked" },
        { verb: "BurgleAttempt", when: STAGE_TWO_STILL },
        { verb: "TakeStacked", under: MOUNTAIN, when: { kind: "burgleSucceeded" } },
        { verb: "Choose", who: "firstPlayer", options: [{ id: "advance", requires: STAGE_TWO_STILL, instructions: [{ verb: "AdvanceStage" }] }, { id: "stay", instructions: [] }] },
      ],
    },
    { id: "132072:forced:2", cardCode: STAGE_2, lines: ["132072:B:2"], timing: "forced", trigger: "burgleFailed", instructions: [{ verb: "Pick", pick: GOLDEN_PICK }, { verb: "AttackFromStaging", who: "firstPlayer" }] },

    // 132073 Inside Information (stage 3). Smaug the Golden is set aside; Smaug the Magnificent and A Bare Patch join the staging area. The stage cannot be defeated while he is in play; when its progress is greater than his remaining hit points he is removed from play; defeating it wins the game.
    {
      id: "132073:whenRevealed:1",
      cardCode: STAGE_3,
      lines: ["132073:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "SetAsideInPlay", code: GOLDEN }, { verb: "AddSetAsideToStaging", code: MAGNIFICENT }, { verb: "AddSetAsideToStaging", code: PATCH }],
    },
    { id: "132073:constant:1", cardCode: STAGE_3, lines: ["132073:B:1"], timing: "constant", condition: { kind: "inPlay", code: MAGNIFICENT, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
    ...[1, 2].map((id): Effect => ({
      id: `132073:forced:${id}`,
      cardCode: STAGE_3,
      lines: ["132073:B:2"],
      timing: "forced",
      trigger: id === 1 ? "progressPlaced" : "damaged",
      ...(id === 1 ? { subject: "self" as const } : { subject: { type: "enemy" as const, control: "any" as const, staging: true, names: ["Smaug the Magnificent"] } }),
      condition: { kind: "less", left: { stat: "hitPoints", ofNamed: "Smaug the Magnificent", remaining: true }, right: { stat: "progress", of: "self" } },
      instructions: [{ verb: "SetAsideInPlay", code: MAGNIFICENT, byQuest: true }],
    })),
    // The stage holds the win (`holdsWin`: no stage follows it): defeated, it stays the current quest card and its own Forced effect wins the game.
    { id: "132073:constant:2", cardCode: STAGE_3, lines: ["132073:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "holdsWin", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "132073:forced:3", cardCode: STAGE_3, lines: ["132073:B:3"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [{ verb: "WinGame" }] },

    // 132074 Thieves! Fire! Murder! (stage 4). Smaug the Golden loses his progress and is set aside; Smaug the Magnificent joins the staging area. The 7th progress on this stage defeats it, but it holds the win (`holdsWin`) and its Forced effect resets the quest instead: Smaug the Magnificent
    // loses his damage and is set aside with A Bare Patch (in play, attached or in the staging area), Smaug the Golden returns, and stage 2B is the current quest again with no progress on it.
    // The flag `holdsWin` is set as the stage is revealed: the last stage has no line of its own for it.
    { id: "132074:whenRevealed:1", cardCode: STAGE_4, lines: ["132074:A:1"], timing: "whenRevealed", instructions: [{ verb: "SetAsideInPlay", code: GOLDEN }, { verb: "AddSetAsideToStaging", code: MAGNIFICENT }, { verb: "ModifyStat", stat: "holdsWin", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "132074:forced:1",
      cardCode: STAGE_4,
      lines: ["132074:B:1"],
      timing: "forced",
      trigger: "questCardDefeated",
      subject: "self",
      instructions: [
        { verb: "SetAsideInPlay", code: PATCH },
        { verb: "SetAsideInPlay", code: MAGNIFICENT, byQuest: true },
        { verb: "AddSetAsideToStaging", code: GOLDEN },
        { verb: "ReturnToStage", stage: 2 },
      ],
    },
  ],
  { pool: THING },
);

export const AUTHORED_REPLACES: readonly string[] = [];
