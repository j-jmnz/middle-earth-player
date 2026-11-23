import type { Condition, Effect } from "../../../catalog/boundary.ts";

import { RECORDS as MISC } from "../families/misc.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { MISTY_MOUNTAIN_GOBLINS_EFFECTS } from "./set-misty-mountain-goblins.ts";
import { WESTERN_LANDS_EFFECTS } from "./set-western-lands.ts";

// The records the six scenarios of The Hobbit share: the nine treasure cards of its two boxes (the box ledger, data/printed/the-hobbit.json), which a deck adds at a scenario's Setup (the briefing admits them,
// src/campaign/loadout.ts) and which are drawn and played like attachments (playsOntoHost, src/rules/core/printed.ts). Bilbo Baggins' own lines and the two Baggins events are records of the misc family
// (families/misc.ts): the first player gets him at Setup from `ScenarioData.sagaStart` and his ControlledBy constant keeps him with the first player. The readings are in docs/scenarios/the-hobbit.md (The shared rules).
// Rules: hob.treasure-ohauh, hob.treasure-otd, hob.saga-player-cards-ohauh, hob.saga-player-cards-otd, hob.bilbo-baggins-ohauh, hob.bilbo-baggins-otd, hob.baggins-sphere-ohauh, hob.baggins-sphere-otd,
// rr.attachment-cards, rr.restricted, rr.ranged, rr.defending-player, rr.cancel, rr.victory, rr.cost (data/rules/entries.json).
const BILBO = "Bilbo Baggins";
/** "After Bilbo Baggins exhausts to defend": the defender is exhausted once declared, so the host being exhausted says it did. */
const HOST_EXHAUSTED: Condition = { kind: "matches", card: "host", pick: { type: "hero", control: "any", state: "exhausted" } };

const TREASURE_EFFECTS: readonly Effect[] = withCopies(
  [
    // 131020 Sting. A:2 and A:3 read as the Fellowship's Sting (142011), which also names the hero that exhausts to defend.
    { id: "131020:constant:1", cardCode: "131020", lines: ["131020:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", host: { kind: "hero", name: BILBO } }] },
    {
      id: "131020:constant:2",
      cardCode: "131020",
      lines: ["131020:A:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },
    {
      id: "131020:response:1",
      cardCode: "131020",
      lines: ["131020:A:3"],
      timing: "response",
      trigger: "declaredDefender",
      subject: "host",
      condition: HOST_EXHAUSTED,
      instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "DamageCard", amount: { stat: "threat", of: "picked", printed: true }, target: "attacker" }],
    },

    // 131021 Orcrist. "That hero's resource pool" is the attached hero's: Bilbo Baggins of the Over Hill and Under Hill box gains none from it (hob.baggins-sphere-ohauh).
    {
      id: "131021:response:1",
      cardCode: "131021",
      lines: ["131021:A:3"],
      timing: "response",
      trigger: "attackDestroyed",
      subject: "host",
      condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", trait: "Orc" } },
      instructions: [{ verb: "AddResources", amount: 1, to: "host" }],
    },

    // 131022 Glamdring: a hero, or Gandalf, who is no hero. A:3 prints as the Fellowship's Glamdring (142013).
    {
      id: "131022:constant:2",
      cardCode: "131022",
      lines: ["131022:A:1"],
      timing: "constant",
      instructions: [{ verb: "AttachesTo", hosts: [{ type: "hero", control: "any" }, { type: "character", control: "any", names: ["Gandalf"] }] }],
    },
    copyLine("142013:A:3", "131022:A:3"),

    // 132019 Bilbo's Magic Ring. A:3 cancels the attack's damage as the Fellowship's One Ring does for Frodo (142001:A:1): the enemy deals none in this attack.
    { id: "132019:constant:1", cardCode: "132019", lines: ["132019:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", host: { kind: "hero", name: BILBO } }] },
    {
      id: "132019:action:1",
      cardCode: "132019",
      lines: ["132019:A:2"],
      timing: "action",
      limit: "oncePerRound",
      cost: [{ kind: "exhaustSelf" }, { kind: "raiseThreat", amount: 1 }],
      instructions: [{ verb: "AddResources", amount: 1, to: "host" }],
    },
    {
      id: "132019:response:1",
      cardCode: "132019",
      lines: ["132019:A:3"],
      timing: "response",
      trigger: "declaredDefender",
      subject: "host",
      cost: [{ kind: "exhaustSelf" }, { kind: "raiseThreat", amount: 3 }],
      condition: HOST_EXHAUSTED,
      instructions: [{ verb: "ModifyStat", stat: "dealsNoDamage", amount: 1, until: "endOfAttack", target: "other" }],
    },

    // 132020 The Arkenstone. X is chosen when the action resolves, up to the threat that leaves the player in the game; the discount is for the next ally of the attached hero's sphere (hostSphere).
    {
      id: "132020:action:1",
      cardCode: "132020",
      lines: ["132020:A:2"],
      timing: "action",
      cost: { kind: "exhaustSelf" },
      condition: { kind: "canPick", pick: { type: "card", control: "you", from: "hand", cardType: "ally" } },
      instructions: [
        { verb: "ChooseX", min: 1, max: [{ threat: "actor", times: -1, plus: 49 }] },
        { verb: "RaiseThreat", amount: { x: true }, who: "actor" },
        { verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally" }, amount: { x: true }, until: "endOfPhase", hostSphere: true },
      ],
    },

    // 132021 Mithril Shirt. A:1 prints as Bilbo's Magic Ring's; A:2 as the Fellowship's Mithril Shirt (142012).
    copyLine("132019:A:1", "132021:A:1"),
    copyLine("142012:A:2", "132021:A:2"),

    // 132022 Thrór's Battle Axe. "Another enemy engaged with you": the enemy just destroyed is gone, so the pick is among the enemies that remain.
    {
      id: "132022:response:1",
      cardCode: "132022",
      lines: ["132022:A:3"],
      timing: "response",
      trigger: "attackDestroyed",
      subject: "host",
      condition: { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you" } },
      instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", engaged: "you" } }, { verb: "DamageCard", amount: 1 }],
    },

    // 132023 Thrór's Hunting Bow. A:2 reads as Dúnedain Cache's (02097:A:2; a pool card has no scan ledger to copy from); A:3: the +2 Attack holds while the hero's attack is a ranged one (rr.ranged).
    { id: "132023:constant:2", cardCode: "132023", lines: ["132023:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "ranged", amount: 1, until: "whileSourceInPlay", target: "host" }] },
    {
      id: "132023:constant:3",
      cardCode: "132023",
      lines: ["132023:A:3"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "host", when: { kind: "attacking", card: "host", ranged: true } }],
    },

    // 132024 Thrór's Golden Cup. Adding it to the victory display is the cost: it is no longer attached when the cards are drawn.
    { id: "132024:action:1", cardCode: "132024", lines: ["132024:A:2"], timing: "action", cost: { kind: "addSelfToVictory" }, instructions: [{ verb: "Draw", amount: 3 }] },
  ],
  { pool: MISC },
);

// The cycle's own records, then the records of the encounter sets its scenarios share (set-*.ts).
export const AUTHORED_EFFECTS: readonly Effect[] = [...TREASURE_EFFECTS, ...MISTY_MOUNTAIN_GOBLINS_EFFECTS, ...WESTERN_LANDS_EFFECTS];

export const AUTHORED_REPLACES: readonly string[] = [];
