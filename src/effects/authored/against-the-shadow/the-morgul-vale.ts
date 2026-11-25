import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for The Morgul Vale (Against the Shadow part 9, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json). Doomed and Surge are the cards' own keywords. The piles place To the Tower, Murzag and one Morgul Vale in the staging area and set Lord Alcaron, the Nazgûl and The White Bridge aside; the
// Setup record announces To the Tower as added, so its own Forced effect removes Faramir. Each stage's Captain holds `cannotLeavePlay` while the stage is current (families/pelargir/vale/cannot-leave.ts) and its destruction advances the quest; the Morgul Bodyguard's constant sends the damage meant for a Captain to a Bodyguard
// (families/pelargir/vale/bodyguard.ts); the progress tokens on To the Tower are placed by title (PlaceProgressOnNamed, families/pelargir/vale/tower.ts) and read by title (`ofNamed`). The readings are in docs/scenarios/against-the-shadow/the-morgul-vale.md (Readings). Mordor Elite (05056 to 05061) and Creatures of the Forest (05049 to 05051) keep their records of The Siege of
// Cair Andros and Into Ithilien.
// Rules: ats.captain-enemies, ats.setup-the-morgul-vale, ats.setup-the-morgul-vale-to-the-tower, rr.cannot, rr.destroy, rr.reveal, rr.engaged, rr.surge, rr.step-6-4-1, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.in-player-order, rr.in-play-and-out-of-play, rr.explored, rr.response, rr.forced, faq.additional-attacks, faq.next-player,
// faq.errata.06157 (data/rules/entries.json).
const TOWER = "To the Tower";
const PLACE = (amount: number, when?: Condition): Extract<Instruction, { verb: "PlaceProgressOnNamed" }> => ({ verb: "PlaceProgressOnNamed", name: TOWER, amount, ...(when ? { when } : {}) });
// The progress tokens on To the Tower, read live (The White Bridge, Terror Drives Them, The Dead City Looms).
const TOKENS = { stat: "progress", ofNamed: TOWER } as const;
const TOWER_CARD: PickSpec = { type: "objective", control: "any", names: [TOWER], staging: true };
const CAPTAIN = (name: string): PickSpec => ({ type: "enemy", control: "any", staging: true, names: [name] });
const KEEP_IN_PLAY = (name: string): Instruction => ({ verb: "ModifyStat", stat: "cannotLeavePlay", amount: 1, until: "whileSourceInPlay", holders: CAPTAIN(name) });
const ADVANCE_WHEN_DESTROYED = (code: string, line: string, name: string): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "enemyDestroyed", subject: CAPTAIN(name), instructions: [{ verb: "AdvanceStage" }] });
const NO_TOKENS: Condition = { kind: "less", left: TOKENS, right: 1 };
const A_TOKEN: Condition = { kind: "less", left: 0, right: TOKENS };
// A card can be revealed: the deck holds one, or it is the quest phase and the discard pile can reset an empty deck (rr.running-out-of-cards). A player may not choose an effect that cannot happen at all (agent recommendation: docs/scenarios/against-the-shadow/the-morgul-vale.md, 06157:A:1).
const CAN_REVEAL: Condition = { kind: "encounterCanReveal" };
const NOT_UNDEFENDED: Condition = { kind: "undefended", is: false };
// Another player is in the game and the attacker is engaged (an enemy that attacks from the staging area has no next player to engage): the Bodyguard's shadow can end the attack.
const CAN_SWITCH: Condition = {
  kind: "all",
  conditions: [{ kind: "count", pick: { type: "player", control: "any" }, min: 2 }, { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", engaged: "you" } }],
};
// "Attacking enemy gets +1 Attack for each progress token on To the Tower", read when the shadow resolves.
const TOKEN_ATTACK: Instruction = { verb: "ModifyStat", stat: "attack", amount: TOKENS, until: "endOfAttack", target: "attacker" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 06144 The Rearguard (stage 1). A:1: the piles set Lord Alcaron, the Nazgûl and The White Bridge aside and add To the Tower, Murzag and a Morgul Vale to the staging area without revealing them; To the Tower is announced as added, so its own Forced effect hears it. B:1: Murzag cannot leave play unless destroyed; destroying him advances the quest (a Forced
    // effect, so the quest advances before any Response to his destruction). The stage prints no quest points: only his destruction advances it.
    { id: "06144:setup:1", cardCode: "06144", lines: ["06144:A:1"], timing: "setup", instructions: [{ verb: "Pick", pick: TOWER_CARD }, { verb: "AnnounceAddedToStaging", card: "picked" }] },
    { id: "06144:constant:1", cardCode: "06144", lines: ["06144:B:1"], timing: "constant", instructions: [KEEP_IN_PLAY("Murzag")] },
    ADVANCE_WHEN_DESTROYED("06144", "06144:B:1", "Murzag"),

    // 06145 The Betrayal (stage 2). A:1: Lord Alcaron, set aside, is added to the staging area (not revealed). B:1: as 06144:B:1 for Lord Alcaron.
    { id: "06145:whenRevealed:1", cardCode: "06145", lines: ["06145:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "06152" }] },
    { id: "06145:constant:1", cardCode: "06145", lines: ["06145:B:1"], timing: "constant", instructions: [KEEP_IN_PLAY("Lord Alcaron")] },
    ADVANCE_WHEN_DESTROYED("06145", "06145:B:1", "Lord Alcaron"),

    // 06146 The Morgul Rider (stage 3). A:1: the Nazgûl and The White Bridge, set aside, are added to the staging area. B:1: the first player reveals 1 card per player, one at a time, each added to the staging area. B:2: the Nazgûl cannot leave play unless destroyed. B:3: when he is destroyed the players win.
    { id: "06146:whenRevealed:1", cardCode: "06146", lines: ["06146:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "06153" }, { verb: "AddSetAsideToStaging", code: "06156" }] },
    { id: "06146:whenRevealed:2", cardCode: "06146", lines: ["06146:B:1"], timing: "whenRevealed", instructions: [{ verb: "RevealEncounter", who: "firstPlayer", times: { players: true } }] },
    { id: "06146:constant:1", cardCode: "06146", lines: ["06146:B:2"], timing: "constant", instructions: [KEEP_IN_PLAY("Nazgûl of Minas Morgul")] },
    { id: "06146:triggered:1", cardCode: "06146", lines: ["06146:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: CAPTAIN("Nazgûl of Minas Morgul"), instructions: [{ verb: "WinGame" }] },

    // 06147 To the Tower. A:1: it cannot leave the staging area. A:2: when it is added to the staging area at Setup, every Faramir the players own is removed from the game. A:3: once 10 or more progress tokens lie on it in the staging area (checked after each placement; the filter's zone scope is `inStaging`, as the engine's self test reads no zone) the players lose.
    { id: "06147:constant:1", cardCode: "06147", lines: ["06147:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "06147:forced:1", cardCode: "06147", lines: ["06147:A:2"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "RemoveAllNamedFromGame", name: "Faramir" }] },
    {
      id: "06147:forced:2",
      cardCode: "06147",
      lines: ["06147:A:3"],
      timing: "forced",
      trigger: "progressPlaced",
      subject: "self",
      condition: { kind: "matches", card: "self", inStaging: true, pick: { type: "objective", control: "any", minProgress: 10 } },
      instructions: [{ verb: "LoseGame", reason: "10 progress tokens lie on To the Tower" }],
    },

    // 06148 Morgul Bodyguard. A:1: while it is in play each Captain enemy, staged or engaged, holds `shieldedByBodyguard`: the damage meant for it goes to one Bodyguard. A:2 (Shadow): with another player in the game the attacker engages the next player and makes an immediate attack against him; this attack ends at once with no damage.
    { id: "06148:constant:1", cardCode: "06148", lines: ["06148:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "shieldedByBodyguard", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, trait: "Captain" } }] },
    {
      id: "06148:shadow:1",
      cardCode: "06148",
      lines: ["06148:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attackSwitched", amount: 1, until: "endOfAttack", target: "attacker", when: CAN_SWITCH },
        { verb: "AfterAttack", when: CAN_SWITCH, instructions: [{ verb: "EngageNextPlayer", announces: true }, { verb: "ImmediateAttack" }] },
      ],
    },

    // 06149 Morgul Sorcerer. A:1: after progress tokens are placed on To the Tower, in one placement or several, it is dealt a shadow card for each placement. A:2 (Shadow): the defending player places 1 token on To the Tower or treats the attack as undefended; an attack that is already undefended asks for neither.
    { id: "06149:forced:1", cardCode: "06149", lines: ["06149:A:1"], timing: "forced", trigger: "progressPlaced", subject: TOWER_CARD, instructions: [{ verb: "DealShadowInPlay", target: "self" }] },
    {
      id: "06149:shadow:1",
      cardCode: "06149",
      lines: ["06149:A:2"],
      timing: "shadow",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "place", requires: NOT_UNDEFENDED, instructions: [PLACE(1)] }, { id: "undefended", requires: NOT_UNDEFENDED, instructions: [{ verb: "ConsiderUndefended" }] }] }],
    },

    // 06150 Morgul Tracker (Surge is a keyword). A:1: when a player optionally engages it, 1 token goes on To the Tower. A:2 (Shadow): +1 Attack for this attack; if the attack is undefended, 1 token goes on To the Tower too.
    { id: "06150:forced:1", cardCode: "06150", lines: ["06150:A:1"], timing: "forced", trigger: "optionallyEngaged", subject: "self", instructions: [PLACE(1)] },
    {
      id: "06150:shadow:1",
      cardCode: "06150",
      lines: ["06150:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, PLACE(1, { kind: "undefended" })],
    },

    // 06151 Murzag. A:1: after he attacks, the top card of the encounter deck is revealed in full for the defending player; an enemy is put into play engaged with that player and is dealt no shadow card.
    { id: "06151:forced:1", cardCode: "06151", lines: ["06151:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", instructions: [{ verb: "RevealTopEngaging" }] },

    // 06152 Lord Alcaron. A:1: when he attacks, 1 token goes on To the Tower (each attack he begins). A:2: when he is dealt a shadow card with no shadow effect, he makes an additional attack after this one, dealt a shadow card of its own, for each such card he was dealt for the attack (AttackPerBlankShadow, families/pelargir/vale/additional.ts).
    { id: "06152:forced:1", cardCode: "06152", lines: ["06152:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [PLACE(1)] },
    { id: "06152:forced:2", cardCode: "06152", lines: ["06152:A:2"], timing: "forced", trigger: "attackResolved", subject: "self", condition: { kind: "shadowBlank" }, instructions: [{ verb: "AttackPerBlankShadow" }] },

    // 06153 Nazgûl of Minas Morgul. A:1: no attachment can attach to him. A:2: each amount of damage dealt to him is reduced to 1 (the damage a Bodyguard takes for him is not reduced: it is never dealt to him).
    { id: "06153:constant:1", cardCode: "06153", lines: ["06153:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "06153:constant:2", cardCode: "06153", lines: ["06153:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageLimit", amount: 1, until: "whileSourceInPlay", target: "self" }] },

    // 06154 Morgul Road. A:1: after it leaves play as an explored location the first player may choose one: remove 1 token from To the Tower, or deal 1 damage to an enemy in play (the staging area counts). An option nothing can do is not offered. A:2 (Shadow): the attacking enemy returns to the staging area after the attack (a copy of the other return shadows).
    {
      id: "06154:response:1",
      cardCode: "06154",
      lines: ["06154:A:1"],
      timing: "response",
      trigger: "leftPlay",
      subject: "self",
      condition: { kind: "subjectExplored" },
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "remove", requires: A_TOKEN, instructions: [{ verb: "RemoveProgressFrom", amount: 1, named: TOWER }] },
            { id: "damage", requires: { kind: "count", pick: { type: "enemy", control: "any", staging: true }, min: 1 }, instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DamageCard", amount: 1, target: "picked" }] },
          ],
        },
      ],
    },

    // 06155 Morgul Vale. A:1: at the end of the round each player, the first player first, returns 1 enemy engaged with him, of his own choice, to the staging area (a Captain too: the staging area is in play). A:2 (Shadow): if the attack destroys a character, 1 token goes on To the Tower, once for the attack.
    { id: "06155:forced:1", cardCode: "06155", lines: ["06155:A:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", engaged: "you" } }, { verb: "ReturnToStaging", target: { kind: "picked" } }] }] },
    { id: "06155:shadow:1", cardCode: "06155", lines: ["06155:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [PLACE(1, { kind: "x", min: 1 })] }] },

    // 06156 The White Bridge. A:1: its Threat X and its quest points X are the progress tokens on To the Tower, read live, in the staging area and as the active location.
    {
      id: "06156:constant:1",
      cardCode: "06156",
      lines: ["06156:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: TOKENS, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "questPoints", amount: TOKENS, until: "whileSourceInPlay", target: "self" },
      ],
    },

    // 06157 Impenetrable Fog. A:1 (as the erratum reads): the first player chooses either to place 3 tokens on To the Tower (one placement) or to reveal as many more cards as there are players, one at a time, each added to the staging area.
    {
      id: "06157:whenRevealed:1",
      cardCode: "06157",
      lines: ["06157:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "tokens", instructions: [PLACE(3)] }, { id: "reveal", requires: CAN_REVEAL, instructions: [{ verb: "RevealEncounter", who: "firstPlayer", times: { players: true } }] }] }],
    },

    // 06158 Sleepless Malice (Doomed 2 is a keyword). A:2: each player in turn, the first player first, discards 3 cards at random from his hand (all of them when he holds fewer) or places 1 token on To the Tower. A:3 (Shadow): the attacker returns to the staging area after the attack.
    {
      id: "06158:whenRevealed:1",
      cardCode: "06158",
      lines: ["06158:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "discard", instructions: [{ verb: "DiscardRandomFromHand", amount: 3 }] }, { id: "token", instructions: [PLACE(1)] }] }] }],
    },

    // 06159 Terror Drives Them (Surge is a keyword). A:2: 1 token goes on To the Tower. A:3 (Shadow): +1 Attack for each token on To the Tower, counted as the shadow resolves.
    { id: "06159:whenRevealed:1", cardCode: "06159", lines: ["06159:A:2"], timing: "whenRevealed", instructions: [PLACE(1)] },
    { id: "06159:shadow:1", cardCode: "06159", lines: ["06159:A:3"], timing: "shadow", instructions: [TOKEN_ATTACK] },

    // 06160 The Dead City Looms. A:1: each player raises his threat by the tokens on To the Tower; with none there it gains surge. A:2 (Shadow): as 06159:A:3.
    {
      id: "06160:whenRevealed:1",
      cardCode: "06160",
      lines: ["06160:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "RaiseThreat", amount: TOKENS, who: "eachSeat" }, { verb: "GainSurge", when: NO_TOKENS }],
    },
    copyLine("06159:A:3", "06160:A:2"),
  ],
  {},
);

export const AUTHORED_REPLACES: readonly string[] = [];
