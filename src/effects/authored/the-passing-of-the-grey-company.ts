import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as RAID } from "./raid-on-the-grey-havens.ts";
import { AUTHORED_EFFECTS as THE_PASSAGE_OF_THE_MARSHES } from "./the-passage-of-the-marshes.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Passing of the Grey Company (the-return-of-the-king part 1, campaign card 145066, whose records are in the-return-of-the-king.ts): Overcome by Fear (a card on a player's threat dial), the three stages, the
// locations, the Oathbreaker enemies (Phantom is a printed keyword, mec113.phantom) and the treacheries no template reads. Every line is read from the scan ledger (data/printed/the-return-of-the-king.json); a line a template
// already writes (pnpm data build) or another card prints word for word needs no record here. See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.phantom, mec113.army-of-the-dead, mec113.saga-staging-rules, mec113.peril, mec113.fellowship-sphere-heroes, mec113.multiplayer-aragorn, rr.initial-threat-level, rr.setup, rr.lasting-effects, rr.then, rr.effects,
// rr.forced, rr.travel, rr.search, rr.staging, rr.attachment-cards, rr.quest-advancement, rr.winning-the-game, rr.defending-player, rr.play-and-put-into-play, faq.peril-attacks, faq.additional-attacks (data/rules/entries.json).
const FEAR = "145016";
const STONE = "145017";
const ARMY = "145067";

type Option = Extract<Instruction, { verb: "Choose" }>["options"][number];
type Cond = NonNullable<Effect["condition"]>;

// "Either attach a set aside Overcome by Fear to your threat dial, or ...": an option that cannot be done (no copy set aside, or the dial already holds one) is not offered (rr.effects).
const ATTACH: Option = { id: "attach", requires: { kind: "canAttachToDial", code: FEAR }, instructions: [{ verb: "AttachToDial", code: FEAR }] };
const choose = (...options: Option[]): Extract<Instruction, { verb: "Choose" }> => ({ verb: "Choose", who: "actor", options: [ATTACH, ...options] });
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const YOUR_ALLY: PickSpec = { type: "ally", control: "you" };
const OATHBREAKER_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Oathbreaker", staging: true };
const STONE_ACTIVE: Cond = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", names: ["The Stone of Erech"] } };
// "Discard an ally you control": an option only while the player controls one.
const DISCARD_ALLY: Option = { id: "discard", requires: { kind: "canPick", pick: YOUR_ALLY }, instructions: [{ verb: "Pick", pick: YOUR_ALLY }, { verb: "Discard", target: { kind: "picked" } }] };
const attackedBy = (attack: Option["instructions"][number]): Extract<Instruction, { verb: "Choose" }> => choose({ id: "attack", instructions: [attack] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 145016 Overcome by Fear (an objective on a player's threat dial: in the seat's play area under its control, attached to no card). Setup: a copy waiting in the pool attaches itself to the dial of the player the campaign checklist names.
    // Your threat cannot be reduced. Forced: at the end of the round the controller raises their threat by 1 (rr.forced); then, if they spend a Fellowship resource (only Aragorn's pool holds one, so only the first player can, and at the end of the round that
    // is the new first player: mec113.multiplayer-aragorn), the copy is detached and set aside (rr.then).
    { id: "145016:setup:1", cardCode: FEAR, lines: ["145016:A:1"], timing: "setup", instructions: [{ verb: "AttachToDial" }] },
    { id: "145016:constant:1", cardCode: FEAR, lines: ["145016:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", target: "actorSeat" }] },
    {
      id: "145016:forced:1",
      cardCode: FEAR,
      lines: ["145016:A:3"],
      timing: "forced",
      trigger: "endOfRound",
      instructions: [
        { verb: "RaiseThreat", amount: 1, who: "actor" },
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "detach", requires: { kind: "resources", min: 1, sphere: "fellowship" }, instructions: [{ verb: "SpendResources", amount: 1, sphere: "fellowship" }, { verb: "DetachFromDial" }] },
            { id: "keep", instructions: [] },
          ],
        },
      ],
    },

    // 145017 The Stone of Erech (Immune to player card effects is a keyword). Forced: after it becomes the active location each player in order searches the encounter deck and discard pile for an Oathbreaker enemy and adds it to the staging area
    // (added, not revealed: rr.search); the deck is shuffled. Travel: remove 5 progress from stage 3B, which needs 5 progress on it.
    {
      id: "145017:forced:1",
      cardCode: STONE,
      lines: ["145017:A:2"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", trait: "Oathbreaker", type: "enemy", to: "staging" }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "145017:travel:1", cardCode: STONE, lines: ["145017:A:3"], timing: "travel", instructions: [{ verb: "RemoveProgressFromQuest", amount: 5 }] },

    // 145018 Dark Door. While it is in the staging area progress cannot be placed on locations in the staging area (a copy of Mithlond Harbor's line, itself included). Travel: the first player reveals an encounter card.
    copyLine("11042:A:2", "145018:A:1"),
    { id: "145018:travel:1", cardCode: "145018", lines: ["145018:A:2"], timing: "travel", instructions: [{ verb: "RevealEncounter", who: "firstPlayer" }] },

    // 145019 Trysting Place. While it is in the staging area each enemy in the staging area cannot take damage. Travel: the first player searches the encounter deck and discard pile for an Oathbreaker enemy and puts it into play engaged with them;
    // the deck is shuffled.
    {
      id: "145019:constant:1",
      cardCode: "145019",
      lines: ["145019:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } }],
    },
    { id: "145019:travel:1", cardCode: "145019", lines: ["145019:A:2"], timing: "travel", instructions: [{ verb: "SearchMove", trait: "Oathbreaker", type: "enemy", to: "engaged" }, { verb: "ShuffleEncounterDeck" }] },

    // 145020 Deadly Road. While it is in the staging area it gains: "Forced: After a 'when revealed' effect is canceled, raise each player's threat by 1" (it hears only the cancel of a card that has a When Revealed effect). Travel: spend 1 Fellowship resource (a copy of
    // Shifting Quagmire's line).
    {
      id: "145020:forced:1",
      cardCode: "145020",
      lines: ["145020:A:1"],
      timing: "forced",
      trigger: "whenRevealedCanceled",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }],
    },
    copyLine("144020:A:3", "145020:A:2"),

    // 145021 Haunted Path. +1 Threat for each living player with a threat of 35 or higher, read live. Travel: raise each player's threat by 1. Shadow: either the defending player raises their threat by 2, or the attacking enemy returns to the staging area once
    // the attack has ended.
    { id: "145021:constant:1", cardCode: "145021", lines: ["145021:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { playersAtThreat: 35 }, until: "whileSourceInPlay", target: "self" }] },
    { id: "145021:travel:1", cardCode: "145021", lines: ["145021:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
    {
      id: "145021:shadow:1",
      cardCode: "145021",
      lines: ["145021:A:3"],
      timing: "shadow",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] },
            { id: "staging", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
          ],
        },
      ],
    },

    // 145022 Dead Man of Dunharrow (Phantom is a keyword). Forced: after it engages you, either attach a set aside Overcome by Fear to your threat dial, or raise your threat by 2 (also when Trysting Place puts it into play engaged).
    { id: "145022:forced:1", cardCode: "145022", lines: ["145022:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [choose({ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] })] },

    // 145023 Faithless Dead (Peril and Phantom are keywords). When Revealed: the revealing player (Peril: resolved alone) either raises each player's threat by 2 or reveals an additional encounter card. Shadow: the attacking enemy gets +1 Attack and loses Phantom
    // for this attack (mec113.phantom: its damage is dealt as damage).
    {
      id: "145023:whenRevealed:1",
      cardCode: "145023",
      lines: ["145023:A:2"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
            { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
          ],
        },
      ],
    },
    {
      id: "145023:shadow:1",
      cardCode: "145023",
      lines: ["145023:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
        { verb: "ModifyStat", stat: "losesPhantom", amount: 1, until: "endOfAttack", target: "attacker" },
      ],
    },

    // 145024 Ghosts of Men (Peril and Phantom are keywords). When Revealed: either attach a set aside Overcome by Fear to your threat dial, or it makes an immediate attack against you from the staging area (faq.peril-attacks); it is dealt a shadow card.
    { id: "145024:whenRevealed:1", cardCode: "145024", lines: ["145024:A:2"], timing: "whenRevealed", instructions: [attackedBy({ verb: "AttackFromStaging", target: "self" })] },

    // 145025 Shadow Host (Phantom is a keyword). Forced: when it engages you, either attach a set aside Overcome by Fear to your threat dial, or it makes an immediate attack.
    { id: "145025:forced:1", cardCode: "145025", lines: ["145025:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [attackedBy({ verb: "ImmediateAttack" })] },

    // 145026 Blood Runs Chill (Doomed 1 is a keyword, resolved first). When Revealed: each player with a threat of 35 or higher deals 1 damage to each exhausted character they control, one exhausted by questing too. Shadow: if the defending player's threat is
    // 35 or higher, the defending character cannot ready until the end of the round.
    {
      id: "145026:whenRevealed:1",
      cardCode: "145026",
      lines: ["145026:A:2"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "you", state: "exhausted" }, when: { kind: "threat", min: 35 } }])],
    },
    {
      id: "145026:shadow:1",
      cardCode: "145026",
      lines: ["145026:A:3"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "defender", when: { kind: "threat", min: 35 } }],
    },

    // 145027 The Way is Shut (Peril and Surge are keywords). When Revealed: either attach a set aside Overcome by Fear to your threat dial, or progress cannot be placed on the current quest until the end of the round (the stage that is current while it lasts;
    // progress on the active location is still placed: rr.lasting-effects).
    {
      id: "145027:whenRevealed:1",
      cardCode: "145027",
      lines: ["145027:A:2"],
      timing: "whenRevealed",
      instructions: [choose({ id: "noProgress", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "endOfRound", target: "table" }] })],
    },

    // 145028 Whispers in the Dark (Peril is a keyword). When Revealed: either attach a set aside Overcome by Fear to your threat dial, or each character you control gets -1 Willpower, -1 Attack and -1 Defense until the end of the round, one that enters play
    // later too (rr.lasting-effects). Shadow: +1 Attack (+2 if undefended).
    {
      id: "145028:whenRevealed:1",
      cardCode: "145028",
      lines: ["145028:A:2"],
      timing: "whenRevealed",
      instructions: [
        choose({
          id: "weaken",
          instructions: [
            { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfRound", target: "ownCharacters" },
            { verb: "ModifyStat", stat: "attack", amount: -1, until: "endOfRound", target: "ownCharacters" },
            { verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfRound", target: "ownCharacters" },
          ],
        }),
      ],
    },
    {
      id: "145028:shadow:1",
      cardCode: "145028",
      lines: ["145028:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "undefended" } } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "undefended" } },
      ],
    },

    // 145029 No Turning Back. When Revealed: each player chooses, either attach a set aside Overcome by Fear to their threat dial, or discard an ally they control. Shadow: either the defending player attaches one, or the attacking enemy makes an additional attack
    // after this one (faq.additional-attacks).
    { id: "145029:whenRevealed:1", cardCode: "145029", lines: ["145029:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([choose(DISCARD_ALLY)])] },
    { id: "145029:shadow:1", cardCode: "145029", lines: ["145029:A:2"], timing: "shadow", instructions: [attackedBy({ verb: "ImmediateAttack", afterThis: true })] },

    // 145063 The Forbidden Door (stage 1). Setup: The Stone of Erech and Army of the Dead are set aside by the data; each player attaches one of the copies of Overcome by Fear set aside to their threat dial, and every copy left is removed from the game.
    // When Revealed: each player may add 1 resource to each hero they control, and then raises their threat by 3. Forced: at the end of the planning phase every hand is discarded and the quest advances to stage 2A.
    {
      id: "145063:setup:1",
      cardCode: "145063",
      lines: ["145063:A:1"],
      timing: "setup",
      instructions: [EACH_PLAYER([{ verb: "AttachToDial", code: FEAR }]), { verb: "RemoveSetAside", code: FEAR }],
    },
    {
      id: "145063:whenRevealed:1",
      cardCode: "145063",
      lines: ["145063:B:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "add", instructions: [{ verb: "HeroesGainResources", amount: 1, who: "actor" }, { verb: "RaiseThreat", amount: 3, who: "actor" }] },
              { id: "decline", instructions: [] },
            ],
          },
        ]),
      ],
    },
    {
      id: "145063:forced:1",
      cardCode: "145063",
      lines: ["145063:B:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Planning" },
      instructions: [EACH_PLAYER([{ verb: "DiscardHand" }]), { verb: "AdvanceStage" }],
    },

    // 145064 The Paths of the Dead (stage 2). When Revealed: each player searches the encounter deck (not its discard pile) for a different location and adds it to the staging area; the deck is shuffled. X is the highest threat among the living players, read
    // while the stage is current, and the stage advances only when progress is placed on it. Each player cannot reduce their threat below their starting threat level. Forced: at the beginning of the planning phase each player chooses, either raise their threat by 1,
    // or they cannot play cards this phase.
    {
      id: "145064:whenRevealed:1",
      cardCode: "145064",
      lines: ["145064:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", deckOnly: true, different: true }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "145064:constant:1", cardCode: "145064", lines: ["145064:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { highestThreat: true }, until: "whileSourceInPlay", target: "self" }] },
    { id: "145064:constant:2", cardCode: "145064", lines: ["145064:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threatFloor", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
    {
      id: "145064:forced:1",
      cardCode: "145064",
      lines: ["145064:B:3"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Planning" },
      instructions: [
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 1, who: "actor" }] },
              { id: "noPlay", instructions: [{ verb: "ModifyStat", stat: "cannotPlayCards", amount: 1, until: "endOfPhase", target: "actorSeat" }] },
            ],
          },
        ]),
      ],
    },

    // 145065 The Dead are Following (stage 3). When Revealed: The Stone of Erech and Army of the Dead (enemy side faceup) are added to the staging area from the set-aside cards (not revealed); each player may raise their threat by 3 to detach Overcome by Fear from their
    // threat dial and set it aside. While The Stone of Erech is the active location each Oathbreaker enemy loses Phantom and gets -20 engagement cost. The players win when the Stone leaves play as an explored location; progress on the stage never defeats it
    // (rr.quest-advancement read with the Stone's Travel line: the 5 progress must stay on the stage for the players to travel to the Stone).
    {
      id: "145065:whenRevealed:1",
      cardCode: "145065",
      lines: ["145065:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "AddSetAsideToStaging", code: STONE },
        { verb: "AddSetAsideToStaging", code: ARMY },
        EACH_PLAYER([
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "detach", requires: { kind: "onDial", code: FEAR }, instructions: [{ verb: "RaiseThreat", amount: 3, who: "actor" }, { verb: "DetachFromDial", code: FEAR }] },
              { id: "keep", instructions: [] },
            ],
          },
        ]),
      ],
    },
    {
      id: "145065:constant:1",
      cardCode: "145065",
      lines: ["145065:B:1"],
      timing: "constant",
      condition: STONE_ACTIVE,
      instructions: [
        { verb: "ModifyStat", stat: "losesPhantom", amount: 1, until: "whileSourceInPlay", holders: OATHBREAKER_ENEMY },
        { verb: "ModifyStat", stat: "engagementCost", amount: -20, until: "whileSourceInPlay", holders: OATHBREAKER_ENEMY },
      ],
    },
    { id: "145065:constant:2", cardCode: "145065", lines: ["145065:B:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "advance" }] },
    {
      id: "145065:forced:1",
      cardCode: "145065",
      lines: ["145065:B:2"],
      timing: "forced",
      trigger: "locationExplored",
      subject: { type: "location", control: "any", names: ["The Stone of Erech"] },
      instructions: [{ verb: "WinGame" }],
    },

    // 145067 Army of the Dead (Phantom and Immune to player card effects are keywords). X, its Threat, is twice the number of players in the game. Forced: when it attacks, you must either attach a set aside Overcome by Fear to your threat dial, or discard an ally you control.
    { id: "145067:constant:1", cardCode: ARMY, lines: ["145067:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true, times: 2 }, until: "whileSourceInPlay", target: "self" }] },
    { id: "145067:forced:1", cardCode: ARMY, lines: ["145067:A:3"], timing: "forced", trigger: "attacks", subject: "self", instructions: [choose(DISCARD_ALLY)] },
  ],
  { pool: [...RAID, ...THE_PASSAGE_OF_THE_MARSHES] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
