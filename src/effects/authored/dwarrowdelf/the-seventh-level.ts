import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as JOURNEY_IN_THE_DARK } from "../journey-in-the-dark.ts";
import { RECORDS as TDOM } from "../pool/TDoM.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { AUTHORED_EFFECTS as INTO_THE_PIT } from "./into-the-pit.ts";

// Records for The Seventh Level (Dwarrowdelf part 2, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). Goblin Spearman prints Goblin Swordsman's two lines (03031 = 03061, Into the Pit's records and
// The Oath's 41041 shadow) and the quest's 1B When Revealed is Entering the Mines' 03064:B:1. The Nightmare deck's records are in ../nightmare/the-seventh-level.ts. The readings are in docs/brief.md (The Seventh Level).
// Rules: rr.reveal, rr.staging, rr.damage, rr.ranged, rr.first-player, rr.attachment-cards, rr.explored, rr.running-out-of-cards, dwd.last-player, dwd.book-of-mazarbul, dwd.revealing-enemies, faq.additional-attacks (data/rules/entries.json).
const BOOK = "03024";
const BOOK_ATTACHED_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const UNDEFENDED: Condition = { kind: "undefended" };
const NOT_UNDEFENDED: Condition = { kind: "not", condition: UNDEFENDED };
const WEAPON_OR_ARMOUR: PickSpec = { type: "card", control: "you", from: "hand", cardType: "attachment", traits: ["Weapon", "Armour"] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 03020 Cave-troll: each point of the combat damage its attack deals beyond the remaining hit points of the character it damages is 1 damage the defending player puts on another character he controls (families/defense/excess.ts).
    { id: "03020:constant:1", cardCode: "03020", lines: ["03020:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessToDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },

    // 03021 Orc Horn Blower: reveals a card in full (rr.reveal) and it joins the staging area.
    { id: "03021:whenRevealed:1", cardCode: "03021", lines: ["03021:A:2"], timing: "whenRevealed", instructions: [{ verb: "RevealEncounter" }] },

    // 03022 Hidden Threat: every player raises his threat by the enemies in the staging area (counted once), then the last player discards an attachment he controls (the Book is an objective, not an attachment).
    {
      id: "03022:whenRevealed:1",
      cardCode: "03022",
      lines: ["03022:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "RaiseThreat", amount: { count: ENEMY_IN_STAGING }, who: "eachSeat" },
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            { verb: "Pick", pick: { type: "attachment", control: "you" }, when: { kind: "lastPlayer" } },
            { verb: "Discard", target: { kind: "picked" }, when: { kind: "lastPlayer" } },
          ],
        },
      ],
    },

    // 03024 Book of Mazarbul. A:2: any player may take the Action while the Book is in play, in the staging area or attached to another hero (dwd.book-of-mazarbul): a ready hero exhausts to claim it. A:3: the attached hero does not exhaust to commit and cannot attack.
    {
      id: "03024:action:1",
      cardCode: BOOK,
      lines: ["03024:A:2"],
      timing: "action",
      condition: { kind: "canPick", pick: BOOK_ATTACHED_HERO },
      instructions: [{ verb: "Pick", pick: BOOK_ATTACHED_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
    },
    {
      id: "03024:constant:1",
      cardCode: BOOK,
      lines: ["03024:A:3"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "whileSourceInPlay", target: "host" }],
    },

    // 03030 Chieftain of the Pit: +3 Attack until the end of the round it is revealed; its Shadow makes it attack again once this attack ends, dealt another shadow card (faq.additional-attacks).
    { id: "03030:whenRevealed:1", cardCode: "03030", lines: ["03030:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfRound", target: "self" }] },
    { id: "03030:shadow:1", cardCode: "03030", lines: ["03030:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

    // 03031 Goblin Spearman prints Goblin Swordsman's lines.
    copyLine("03061:A:1", "03031:A:1"),
    copyLine("41041:A:2", "03031:A:2"),

    // 03032 Goblin Archer. A:1: no optional engagement. A:2: characters with ranged attack it in the staging area. A:3: after an enemy is revealed from the encounter deck (itself included) the first player damages a character he controls.
    { id: "03032:constant:1", cardCode: "03032", lines: ["03032:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "03032:constant:2", cardCode: "03032", lines: ["03032:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackableByRanged", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "03032:forced:1",
      cardCode: "03032",
      lines: ["03032:A:3"],
      timing: "forced",
      trigger: "revealed",
      byEncounterDeck: true,
      subject: { type: "enemy", control: "any", staging: true },
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", who: "firstPlayer" } }, { verb: "DamageCard", amount: 1 }],
    },

    // 03033 Undisturbed Bones: each player in order puts as much damage as the allies he controls on 1 of them. Shadow: the defending ally is discarded from play.
    {
      id: "03033:whenRevealed:1",
      cardCode: "03033",
      lines: ["03033:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" } }, { verb: "DamageCard", amount: { count: { type: "ally", control: "you" } } }] }],
    },
    {
      id: "03033:shadow:1",
      cardCode: "03033",
      lines: ["03033:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", defending: true }, when: NOT_UNDEFENDED }, { verb: "Discard", target: { kind: "picked" }, when: NOT_UNDEFENDED }],
    },

    // 03034 Plundered Armoury: while it is in the staging area every enemy in play gets +1 Attack; after it is explored each player in order may attach a Weapon or Armour attachment from his hand to a character he controls (put into play, not played).
    {
      id: "03034:constant:1",
      cardCode: "03034",
      lines: ["03034:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true } }],
    },
    {
      id: "03034:response:1",
      cardCode: "03034",
      lines: ["03034:A:2"],
      timing: "response",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "attach", requires: { kind: "canPick", pick: WEAPON_OR_ARMOUR }, instructions: [{ verb: "Pick", pick: WEAPON_OR_ARMOUR }, { verb: "PutIntoPlay", card: "picked", who: "actor", host: { type: "character", control: "you" } }] },
                { id: "keep", instructions: [] },
              ],
            },
          ],
        },
      ],
    },

    // 03067 Search for the Chamber. Setup: the first player attaches the Book to a hero of any player (free, not exhausted); 1B is Entering the Mines' When Revealed.
    {
      id: "03067:setup:1",
      cardCode: "03067",
      lines: ["03067:A:1"],
      timing: "setup",
      instructions: [{ verb: "SetAside", code: BOOK }, { verb: "Pick", pick: { type: "hero", control: "any", who: "firstPlayer" } }, { verb: "AttachSetAside", code: BOOK, claimed: true }, { verb: "ShuffleEncounterDeck" }],
    },
    copyLine("03064:B:1", "03067:B:1"),

    // 03068 The Fate of Balin. B:1: the Book leaves the game from wherever it is. B:2: at the end of the staging step X cards are revealed (X the players): enemies join the staging area, the rest are discarded unresolved. B:3: defeating the stage wins.
    { id: "03068:whenRevealed:1", cardCode: "03068", lines: ["03068:B:1"], timing: "whenRevealed", instructions: [{ verb: "RemoveCodeFromGame", code: BOOK }] },
    { id: "03068:forced:1", cardCode: "03068", lines: ["03068:B:2"], timing: "forced", trigger: "stagingStepEnds", instructions: [{ verb: "RevealTopEnemies", count: { players: true } }] },
    copyLine("142042:B:3", "03068:B:3"),
  ],
  { pool: [...INTO_THE_PIT, ...TDOM, ...JOURNEY_IN_THE_DARK] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
