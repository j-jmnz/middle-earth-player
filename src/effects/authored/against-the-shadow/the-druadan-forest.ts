import type { Amount, Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for The Drúadan Forest (Against the Shadow part 5, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json); a line a template already writes (06044:A:1, 06048:A:3) or another card prints word for word needs no record here. Keywords (Surge, Siege,
// Archery printed as a number) are the cards' own: Prowl X is not a keyword the data knows, so each card that prints it holds the record that does it, and Stars in Sky holds Prowl at the head of its When Revealed record. The Brooding Forest cards (05046 to 05048) keep their Into Ithilien records
// (src/effects/authored/against-the-shadow/into-ithilien.ts). The piles place Drû-buri-Drû in the set-aside pile (the Setup shuffles the deck without him) and the quest stages in the quest deck. The readings are in docs/scenarios/against-the-shadow/the-druadan-forest.md (Readings): Prowl discards resources
// from the heroes of every player as a group (the first player chooses), the stage 3 attack and progress rules are flags of the pelargir family (families/pelargir/stage-attack.ts, stage-progress.ts), and The Passage Out and Drû-buri-Drû each hold the bar on winning.
// Rules: ats.setup-the-druadan-forest, ats.prowl, ats.prowl-example, hon.siege, hon.archery, rr.staging, rr.surge, rr.travel, rr.cost, rr.victory, rr.destroy, rr.step-3-3, rr.step-3-4, faq.victory-display, faq.progress-without-advancing, faq.reveal-and-add (data/rules/entries.json).
const WOSE: PickSpec = { type: "enemy", control: "any", trait: "Wose" };
const ANY_HERO: PickSpec = { type: "hero", control: "any" };
const OWN_HEROES: PickSpec = { type: "hero", control: "you" };
const WITH_RESOURCES: PickSpec = { ...ANY_HERO, hasResources: true };
const FIRST_PLAYER_CHOOSES: PickSpec = { ...WITH_RESOURCES, who: "firstPlayer" };
const NO_RESOURCES: PickSpec = { ...ANY_HERO, hasResources: false };
const OWN_ATTACHMENTS: PickSpec = { type: "attachment", control: "you" };
// The instruction type the records are written in (a Choose and its options nest inside it).
type Step = Effect["instructions"][number];
type Choice = Extract<Step, { verb: "Choose" }>;
type OptionSteps = Choice["options"][number]["instructions"];
const HAS_ATTACHMENT: Condition = { kind: "canPick", pick: OWN_ATTACHMENTS };
const DRU_BURI_DRU = "06045";
const NOT_IN_VICTORY: Condition = { kind: "inVictory", code: DRU_BURI_DRU, is: false };

// "Prowl X" (ats.prowl, ats.prowl-example): the players as a group discard X resources from the resource pools of their heroes, split as they choose and all they can when fewer remain; the first player decides a disagreement, so he picks each hero. A discard is not a spend.
const PROWL = (times: Amount): Step => ({
  verb: "Repeat",
  times,
  instructions: [{ verb: "Pick", pick: FIRST_PLAYER_CHOOSES }, { verb: "DiscardResources", amount: 1, target: "picked" }],
});
// Prowl resolves when the card is revealed, after any When Revealed effect it prints and before it is placed (a card added to the staging area without a reveal has no Prowl).
const PROWL_ON_REVEAL = (id: string, code: string, lines: string[], times: Amount): Effect => ({ id, cardCode: code, lines, timing: "forced", trigger: "revealed", subject: "self", byEncounterDeck: true, instructions: [PROWL(times)] });

// "Pay 1 resource or <consequence>" for one hero of the player (Men in the Dark, Stars in Sky): the player pays from that hero's own pool when it holds a resource, and otherwise the consequence is the only option.
const HERO_HAS_RESOURCES: Condition = { kind: "matches", card: "picked", pick: WITH_RESOURCES };
const PAY_OR = (consequence: OptionSteps): Choice => ({
  verb: "Choose",
  who: "actor",
  options: [{ id: "pay", requires: HERO_HAS_RESOURCES, instructions: [{ verb: "SpendResources", amount: 1, target: "picked" }] }, { id: "consequence", instructions: consequence }],
});

// "Shadow: Return attacking enemy to the staging area after it attacks unless any player pays 1 resource" (Drúadan Elite, Drúadan Thief): any player's hero may pay (`group`); with no resource to pay the enemy returns without a question.
const RETURN_UNLESS_PAID: Choice = {
  verb: "Choose",
  who: "actor",
  options: [
    { id: "pay", requires: { kind: "resources", min: 1, group: true }, instructions: [{ verb: "SpendResources", amount: 1, group: true }] },
    { id: "return", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
  ],
};

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 06042 The Pursuit (stage 1). A:1: Drû-buri-Drû is already set aside by the piles; the Setup shuffles the encounter deck without him. B:1: the first player reveals 1 card for each player, each added to the staging area as any revealed card (Prowl, When Revealed and Surge apply).
    { id: "06042:setup:1", cardCode: "06042", lines: ["06042:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
    { id: "06042:whenRevealed:1", cardCode: "06042", lines: ["06042:B:1"], timing: "whenRevealed", instructions: [{ verb: "RevealEncounter", who: "firstPlayer", times: { players: true } }] },

    // 06043 An Untimely End (stage 2). B:1: archery damage goes to allies point by point while any ally is in play (the family of Hold the Line's flag, read live by archeryRecipients).
    { id: "06043:constant:1", cardCode: "06043", lines: ["06043:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "archeryToAllies", amount: 1, until: "whileSourceInPlay", target: "table" }] },

    // 06044 The Passage Out (stage 3). B:1: Siege (the parenthesis is reminder text). B:2: the three flags of the pelargir family (families/pelargir/stage-attack.ts, stage-progress.ts). B:3: the stage is the last, so defeating it wins; it cannot be defeated while Drû-buri-Drû is not in the victory display,
    // whatever became of him (also when he is destroyed and in the discard pile, where his own bar no longer holds).
    { id: "06044:constant:1", cardCode: "06044", lines: ["06044:B:1"], timing: "constant", instructions: [] },
    {
      id: "06044:constant:2",
      cardCode: "06044",
      lines: ["06044:B:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "attackWithWillpower", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "attackDamageAsProgress", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "progressToVictory", amount: 1, until: "whileSourceInPlay", target: "table" },
      ],
    },
    { id: "06044:constant:3", cardCode: "06044", lines: ["06044:B:3"], timing: "constant", condition: NOT_IN_VICTORY, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 06045 Drû-buri-Drû. A:1: allies cannot defend against him. A:2: while he is in the victory display every character gets +1 Willpower and +1 Defense. A:3: unless he is in the victory display the players cannot win (the stage holds the same bar when he is destroyed).
    { id: "06045:constant:1", cardCode: "06045", lines: ["06045:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "defend", allies: true }] },
    {
      id: "06045:constant:2",
      cardCode: "06045",
      lines: ["06045:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "victory" },
      instructions: [
        { verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } },
      ],
    },
    { id: "06045:constant:3", cardCode: "06045", lines: ["06045:A:3"], timing: "constant", condition: NOT_IN_VICTORY, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 06046 Drúadan Drummer. A:1: each Wose in the staging area, itself included, gets +2 Threat (cumulative with each Drummer). A:2 (Shadow): each Wose engaged with the defending player gets +1 Attack until the attack ends.
    { id: "06046:constant:1", cardCode: "06046", lines: ["06046:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", holders: { ...WOSE, stagingOnly: true } }] },
    { id: "06046:shadow:1", cardCode: "06046", lines: ["06046:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", holders: { ...WOSE, engaged: "you" } }] },

    // 06047 Drúadan Elite. A:1 and A:2: Archery 2 is the card's keyword; Prowl X, X the number of players. A:3 (Shadow): the attacker returns to the staging area after it attacks unless a player pays 1 resource.
    PROWL_ON_REVEAL("06047:forced:1", "06047", ["06047:A:1", "06047:A:2"], { players: true }),
    { id: "06047:shadow:1", cardCode: "06047", lines: ["06047:A:3"], timing: "shadow", instructions: [RETURN_UNLESS_PAID] },

    // 06048 Drúadan Hunter. A:1 and A:2: Prowl 1; Archery X, X the number of heroes of every player with no resources, counted when the archery is dealt. A:3 (Shadow): +2 Attack (a template writes it).
    PROWL_ON_REVEAL("06048:forced:1", "06048", ["06048:A:1"], 1),
    { id: "06048:constant:1", cardCode: "06048", lines: ["06048:A:1", "06048:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "archeryBonus", amount: { count: NO_RESOURCES }, until: "whileSourceInPlay", target: "self" }] },

    // 06049 Drúadan Thief. A:1: Surge is the card's keyword; Prowl 1 resolves before the surge card is revealed. A:2 (Shadow): as the Elite's.
    PROWL_ON_REVEAL("06049:forced:1", "06049", ["06049:A:1"], 1),
    copyLine("06047:A:3", "06049:A:2"),

    // 06050 Ancestral Clearing. A:1: every player card costs 1 more to play (from any zone), while the location is in play. A:2: to travel here one ready hero of any player is exhausted, the first player choosing; with none ready the players cannot travel here.
    { id: "06050:constant:1", cardCode: "06050", lines: ["06050:A:1"], timing: "constant", instructions: [{ verb: "IncreaseCost", amount: 1, pick: { type: "card", control: "any" } }] },
    { id: "06050:travel:1", cardCode: "06050", lines: ["06050:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { ...ANY_HERO, state: "ready", who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }] },

    // 06051 Garden of Poisons. A:1: no hero gains resources from a card effect (the resource phase still gives them). A:2: each player pays 1 resource from his own heroes to travel here.
    { id: "06051:constant:1", cardCode: "06051", lines: ["06051:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotGainResources", amount: 1, until: "whileSourceInPlay", target: "table" }] },
    { id: "06051:travel:1", cardCode: "06051", lines: ["06051:A:2"], timing: "travel", instructions: [{ verb: "EachPlayerSpends", amount: 1 }] },

    // 06052 Glade of Cleansing. A:1: each Wose in play gains archery 1 (the gains of two Glades add). A:2: its Threat X is the total archery value of the Wose with the most, the Glades' gains included.
    { id: "06052:constant:1", cardCode: "06052", lines: ["06052:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "archery", amount: 1, until: "whileSourceInPlay", holders: WOSE }] },
    { id: "06052:constant:2", cardCode: "06052", lines: ["06052:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { archeryOf: WOSE, max: true }, until: "whileSourceInPlay", target: "self" }] },

    // 06053 Men in the Dark. A:1: each player, first player first, for each hero he controls pays 1 resource from that hero's pool or the hero takes 1 damage; with no damage dealt it gains surge (the X marker). A:2 (Shadow): +1 Attack for each hero the defending player controls with no resources.
    {
      id: "06053:whenRevealed:1",
      cardCode: "06053",
      lines: ["06053:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [{ verb: "Each", pick: OWN_HEROES, instructions: [PAY_OR([{ verb: "DamageCard", amount: 1, target: "picked" }, { verb: "SetX", value: 1 }])] }],
        },
        { verb: "GainSurge", when: { kind: "not", condition: { kind: "x", min: 1 } } },
      ],
    },
    { id: "06053:shadow:1", cardCode: "06053", lines: ["06053:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: { ...OWN_HEROES, hasResources: false } }, until: "endOfAttack", target: "attacker" }] },

    // 06054 Stars in Sky. A:1 and A:2: Prowl 2 resolves first, then each player in turn has each questing hero pay 1 resource from its own pool or be removed from the quest. A:3 (Shadow): all resources of the defending character's pool are discarded (none on an ally, nothing with no defender).
    {
      id: "06054:whenRevealed:1",
      cardCode: "06054",
      lines: ["06054:A:1", "06054:A:2"],
      timing: "whenRevealed",
      instructions: [PROWL(2), { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Each", pick: { ...OWN_HEROES, committed: true }, instructions: [PAY_OR([{ verb: "RemoveFromQuest" }])] }] }],
    },
    {
      id: "06054:shadow:1",
      cardCode: "06054",
      lines: ["06054:A:3"],
      timing: "shadow",
      instructions: [{ verb: "Pick", pick: { type: "character", control: "any", defending: true } }, { verb: "DiscardResources", all: true, target: "picked" }],
    },

    // 06055 Leaves on Tree. A:1: Surge is the card's keyword. A:2: each player pays 1 resource for each attachment he controls, all or none of it from his heroes' pools, or discards all of them; with no attachment nothing is asked. A:3 (Shadow): the defending player discards an attachment of the defending character.
    {
      id: "06055:whenRevealed:1",
      cardCode: "06055",
      lines: ["06055:A:2"],
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
                {
                  id: "pay",
                  requires: { kind: "not", condition: { kind: "less", left: { resourcesOn: OWN_HEROES }, right: { count: OWN_ATTACHMENTS } } },
                  instructions: [{ verb: "SpendResources", amount: { count: OWN_ATTACHMENTS } }],
                },
                { id: "discard", requires: HAS_ATTACHMENT, instructions: [{ verb: "DiscardEach", pick: OWN_ATTACHMENTS }] },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "06055:shadow:1",
      cardCode: "06055",
      lines: ["06055:A:3"],
      timing: "shadow",
      instructions: [{ verb: "Pick", pick: { type: "attachment", control: "any", attachedTo: "defender" } }, { verb: "Discard", target: { kind: "picked" } }],
    },
  ],
  { pool: [] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
