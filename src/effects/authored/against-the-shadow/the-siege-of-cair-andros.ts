import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for The Siege of Cair Andros (Against the Shadow part 3, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json). Keywords (Surge, Doomed, Battle, Siege, Archery printed as a keyword) are the cards' own; the Battle and Siege stages keep an empty
// record for the reminder text. The piles place The Approach, The Citadel and The Banks in the staging area, so the Setup record is empty. The readings are in docs/scenarios/against-the-shadow/the-siege-of-cair-andros.md (Readings). The Battleground locations are removed from the game at a damage
// total (`removedAtDamage`), the Responses remove their stages from the quest deck, and stage 1 sends the damage of undefended attacks to the lowest Threat Battleground location (families/pelargir/siege.ts, stage-remove.ts). The Mordor Elite and Ravaging Orcs sets are dealt again by later scenarios of the cycle.
// Rules: ats.cair-andros-location-damage, ats.cair-andros-defense-carry-over, ats.cair-andros-remove-stage, ats.cair-andros-remove-stage-example, hon.battle, hon.siege, hon.archery, rr.removed-from-game, rr.in-play-and-out-of-play, rr.shadow-effects, rr.surge, rr.doomed-x, rr.lasting-effects,
// rr.quest-advancement, rr.cannot, rr.spheres-of-influence, rr.character-cards, rr.staging, rr.step-3-3, rr.step-3-4, rr.cost, rr.first-player, rr.player-elimination, rr.victory, faq.cancel-encounter-effect, faq.errata.05061, faq.errata.06123, faq.additional-attacks (data/rules/entries.json).
const BATTLEGROUND: PickSpec = { type: "location", control: "any", trait: "Battleground" };
const ALWAYS: Condition = { kind: "count", pick: { type: "hero", control: "any" }, min: 0 };
const SPHERES = ["leadership", "tactics", "spirit", "lore"] as const;
const SELF_FLAG = (stat: "removedAtDamage" | "undefendedToBattleground" | "advancesWithoutBattleground" | "losesSiege", amount = 1): Instruction => ({ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "self" });
const PLUS_TWO_ATTACK: Instruction = { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" };
const ARCHERY_ICON = (sphere: (typeof SPHERES)[number]): Instruction => ({
  verb: "ModifyStat",
  stat: "archeryBonus",
  amount: 1,
  until: "whileSourceInPlay",
  target: "self",
  when: { kind: "count", pick: { type: "hero", control: "any", sphere }, min: 1 },
});

// A Shadow effect that damages the named location if it is in play (in the staging area or active) and otherwise gives the attacker +2 Attack ("Deal 2 damage to The Citadel if it is in play. Otherwise, attacking enemy gets +2 Attack").
const SHADOW_TO = (name: string): Instruction[] => {
  const named: PickSpec = { type: "location", control: "any", names: [name] };
  const inPlay: Condition = { kind: "canPick", pick: named };
  return [
    { verb: "Pick", pick: named, when: inPlay },
    { verb: "DamageCard", amount: 2, target: "picked", when: inPlay },
    { ...PLUS_TWO_ATTACK, when: { kind: "not", condition: inPlay } },
  ];
};
// "Response: After <location> leaves play as an explored location, remove stage N from the quest deck, if able": the location hears its own exploring (a location removed from the game by damage is not explored, so it hears nothing).
const REMOVES_STAGE = (id: string, code: string, line: string, stage: string): Effect => ({ id, cardCode: code, lines: [line], timing: "response", trigger: "locationExplored", subject: "self", instructions: [{ verb: "RemoveStage", code: stage }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 05030 Orc Scramblers (Surge is a keyword). A:2: 1 damage to each Battleground location in play, staging or active, then Surge. A:3 (Shadow): 2 damage to The Citadel if it is in play, otherwise +2 Attack.
    { id: "05030:whenRevealed:1", cardCode: "05030", lines: ["05030:A:2"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 1, pick: BATTLEGROUND }] },
    { id: "05030:shadow:1", cardCode: "05030", lines: ["05030:A:3"], timing: "shadow", instructions: SHADOW_TO("The Citadel") },

    // 05031 Battering Ram (Doomed 2 is a keyword). A:2: 3 damage to the active location when it is a Battleground (a Battleground in the staging area takes none). A:3 (Shadow): as 05030's for The Approach.
    {
      id: "05031:whenRevealed:1",
      cardCode: "05031",
      lines: ["05031:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "DamageCard", amount: 3, target: "activeLocation", when: { kind: "canPick", pick: { ...BATTLEGROUND, active: true } } }],
    },
    { id: "05031:shadow:1", cardCode: "05031", lines: ["05031:A:3"], timing: "shadow", instructions: SHADOW_TO("The Approach") },

    // 05032 Sappers. A:1: 2 damage to the Battleground location in play with the lowest Threat (a tie is the first player's to name; none is possible with The Banks 1, The Approach 2, The Citadel 3). A:2 (Shadow): as 05030's for The Banks.
    {
      id: "05032:whenRevealed:1",
      cardCode: "05032",
      lines: ["05032:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: { ...BATTLEGROUND, lowestThreat: true } }, { verb: "DamageCard", amount: 2, target: "picked" }],
    },
    { id: "05032:shadow:1", cardCode: "05032", lines: ["05032:A:2"], timing: "shadow", instructions: SHADOW_TO("The Banks") },

    // 05033 The Citadel, 05034 The Approach, 05035 The Banks (Battleground locations). A:1: removed from the game as soon as the damage on the location reaches 11, 7 or 3 (`removedAtDamage`): it is not explored, goes to no pile and hears no Response. A:2: once it is explored, its stage (4, 3, 2)
    // leaves the quest deck.
    { id: "05033:constant:1", cardCode: "05033", lines: ["05033:A:1"], timing: "constant", instructions: [SELF_FLAG("removedAtDamage", 11)] },
    REMOVES_STAGE("05033:response:1", "05033", "05033:A:2", "05075"),
    { id: "05034:constant:1", cardCode: "05034", lines: ["05034:A:1"], timing: "constant", instructions: [SELF_FLAG("removedAtDamage", 7)] },
    REMOVES_STAGE("05034:response:1", "05034", "05034:A:2", "05074"),
    { id: "05035:constant:1", cardCode: "05035", lines: ["05035:A:1"], timing: "constant", instructions: [SELF_FLAG("removedAtDamage", 3)] },
    REMOVES_STAGE("05035:response:1", "05035", "05035:A:2", "05073"),

    // 05036 Orc Assault. A:1: every hero and ally, those that enter play later in the round too (a lasting effect of an encounter card), gets -2 Attack and -2 Defense until the end of the round. A:2 (Shadow): 2 damage to each Battleground location in play.
    {
      id: "05036:whenRevealed:1",
      cardCode: "05036",
      lines: ["05036:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: -2, until: "endOfRound", target: "characters" },
        { verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfRound", target: "characters" },
      ],
    },
    { id: "05036:shadow:1", cardCode: "05036", lines: ["05036:A:2"], timing: "shadow", instructions: [{ verb: "DamageEach", amount: 2, pick: BATTLEGROUND }] },

    // 05056 Lieutenant of Mordor. A:1: no ally may be declared as a defender against it (a hero may). A:2: its When Revealed effects are those of the topmost treachery in the encounter discard pile, which stays there, and neither this effect nor the copied one can be canceled.
    { id: "05056:constant:1", cardCode: "05056", lines: ["05056:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "alliesCannotDefend", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "05056:whenRevealed:1", cardCode: "05056", lines: ["05056:A:2"], timing: "whenRevealed", uncancelable: ALWAYS, instructions: [{ verb: "ResolveTopmostTreachery", uncancelable: true }] },

    // 05057 Orc Arbalesters (Archery X is a keyword). A:2: X is the number of different Leadership, Tactics, Spirit and Lore icons on the heroes in play, each counted once, an icon a hero gains included: one archery point for each (the sphere filter reads printed and gained icons, and the
    // constants are read again at every change). A:3 (Shadow): +2 Attack.
    { id: "05057:constant:1", cardCode: "05057", lines: ["05057:A:1", "05057:A:2"], timing: "constant", instructions: SPHERES.map(ARCHERY_ICON) },
    { id: "05057:shadow:1", cardCode: "05057", lines: ["05057:A:3"], timing: "shadow", instructions: [PLUS_TWO_ATTACK] },

    // 05058 Orc Vanguard. A:1: while it is in the staging area no resource can be spent from the pool of a hero with a Leadership, Spirit or Lore icon (a hero with a Tactics icon and one of those is held too). A:2 (Shadow): two additional shadow cards, face down, resolved in the order dealt after this one.
    {
      id: "05058:constant:1",
      cardCode: "05058",
      lines: ["05058:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "cannotSpendResources", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any", spheres: ["leadership", "spirit", "lore"] } }],
    },
    { id: "05058:shadow:1", cardCode: "05058", lines: ["05058:A:2"], timing: "shadow", instructions: [{ verb: "DealShadow", additional: true }, { verb: "DealShadow", additional: true }] },

    // 05059 Orc War Camp (a location). A:1: while an Orc enemy is in play and it is in the staging area no progress token can be placed on it from any source (as the active location it takes progress). A:2 (Shadow): +1 Attack for each shadow card dealt to the attacking enemy, this one included.
    {
      id: "05059:constant:1",
      cardCode: "05059",
      lines: ["05059:A:1"],
      timing: "constant",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "count", pick: { type: "enemy", control: "any", trait: "Orc" }, min: 1 }] },
      instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "05059:shadow:1", cardCode: "05059", lines: ["05059:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "shadowCards", of: "attacker" }, until: "endOfAttack", target: "attacker" }] },

    // 05060 The Master's Malice. A:1: each player in player order chooses a sphere; each hero and ally he controls with no icon of it takes 3 damage (a neutral character takes it, one with several icons is safe if any matches).
    {
      id: "05060:whenRevealed:1",
      cardCode: "05060",
      lines: ["05060:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: SPHERES.map((sphere) => ({ id: sphere, instructions: [{ verb: "DamageEach" as const, amount: 3, pick: { type: "character" as const, control: "you" as const, exceptSphere: sphere } }] })),
            },
          ],
        },
      ],
    },

    // 05061 The Power of Mordor (Doomed 3 is a keyword). A:2 (the erratum's wording, no "Then"): the cards in the staging area are counted and shuffled into the encounter deck, then that many cards are revealed one at a time and added to the staging area. Neither can be canceled.
    {
      id: "05061:whenRevealed:1",
      cardCode: "05061",
      lines: ["05061:A:2"],
      timing: "whenRevealed",
      uncancelable: ALWAYS,
      instructions: [{ verb: "ShuffleStagingIntoEncounterDeck" }, { verb: "RevealEncounter", who: "firstPlayer", times: { x: true } }],
    },

    // 05062 Orc Rabble. A:1: each time it is dealt a shadow card (an additional card too) it gets +2 Attack until the end of the phase. A:2 (Shadow): one additional shadow card for each player in the game.
    { id: "05062:forced:1", cardCode: "05062", lines: ["05062:A:1"], timing: "forced", trigger: "shadowDealtTo", subject: "self", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", target: "self" }] },
    { id: "05062:shadow:1", cardCode: "05062", lines: ["05062:A:2"], timing: "shadow", instructions: [{ verb: "Repeat", times: { players: true }, instructions: [{ verb: "DealShadow", additional: true }] }] },

    // 05063 Orc Arsonist. A:1: when it engages a player (forced or optional), 1 shadow card is dealt to each enemy engaged with that player at that moment, itself included. A:2 (Shadow): +1 Attack and another shadow card for the attacking enemy.
    {
      id: "05063:forced:1",
      cardCode: "05063",
      lines: ["05063:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "Each", pick: { type: "enemy", control: "any", engaged: "you" }, instructions: [{ verb: "DealShadowTo", target: "picked" }] }],
    },
    { id: "05063:shadow:1", cardCode: "05063", lines: ["05063:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "DealShadow", additional: true }] },

    // 05064 Scourge of Mordor. A:1: each player discards the top card of his deck; the Threat of the staging area is raised by the total printed cost of the cards discarded until the end of the phase. A:2 (Shadow): as 05063's.
    { id: "05064:whenRevealed:1", cardCode: "05064", lines: ["05064:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: 1 }] }, { verb: "RaiseStagingThreat", amount: { discarded: "cost" }, until: "endOfPhase" }] },
    copyLine("05063:A:2", "05064:A:2"),

    // 05072 Defend the Siege (stage 1). A:1: the piles place The Approach, The Citadel and The Banks in the staging area. B:1: Siege (the reminder text carries no rule). B:2: while it is current the damage of an undefended attack goes to the lowest Threat Battleground location in play and to no hero, and
    // the quest advances at once when no Battleground location is in play (families/pelargir/siege.ts).
    { id: "05072:setup:1", cardCode: "05072", lines: ["05072:A:1"], timing: "setup", instructions: [] },
    { id: "05072:constant:1", cardCode: "05072", lines: ["05072:B:1"], timing: "constant", instructions: [] },
    { id: "05072:constant:2", cardCode: "05072", lines: ["05072:B:2"], timing: "constant", instructions: [SELF_FLAG("undefendedToBattleground"), SELF_FLAG("advancesWithoutBattleground")] },

    // 05073 stage 2. B:1: one more card is revealed in the staging step of each round while it is current (`revealMore`, read live).
    { id: "05073:constant:1", cardCode: "05073", lines: ["05073:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "revealMore", amount: 1, until: "whileSourceInPlay", target: "table" }] },

    // 05074 stage 3. B:1: Battle (reminder text). B:2: when the players quest unsuccessfully (a tie is neither), they do not raise threat: each player discards 1 hero or ally he controls instead (a hero so discarded is not defeated). The event is queued for each seat; the first player's hears it.
    { id: "05074:constant:1", cardCode: "05074", lines: ["05074:B:1"], timing: "constant", instructions: [] },
    {
      id: "05074:forced:1",
      cardCode: "05074",
      lines: ["05074:B:2"],
      timing: "forced",
      trigger: "questFailed",
      condition: { kind: "firstPlayer" },
      instructions: [
        { verb: "WaiveQuestThreat", who: "eachSeat", until: "endOfPhase" },
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DiscardPicked" }] },
      ],
    },

    // 05075 stage 4. B:1: Siege (reminder text). B:2: 5 more Threat in the staging area while it is current.
    { id: "05075:constant:1", cardCode: "05075", lines: ["05075:B:1"], timing: "constant", instructions: [] },
    { id: "05075:constant:2", cardCode: "05075", lines: ["05075:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "moreStagingThreat", amount: 5, until: "whileSourceInPlay", target: "table" }] },

    // 05076 The Last Battle (stage 5). B:1: Siege (reminder text). B:2: the first player reveals 1 card for each player, each added to the staging area as any revealed card. B:3: with 4 or more victory points in the victory display it gains Battle and loses Siege (its text overrides the printed keyword,
    // as faq.errata.06123 reads The Cross-roads). B:4: defeating it wins the game (the last stage).
    { id: "05076:constant:1", cardCode: "05076", lines: ["05076:B:1"], timing: "constant", instructions: [] },
    { id: "05076:whenRevealed:1", cardCode: "05076", lines: ["05076:B:2"], timing: "whenRevealed", instructions: [{ verb: "RevealEncounter", who: "firstPlayer", times: { players: true } }] },
    {
      id: "05076:constant:2",
      cardCode: "05076",
      lines: ["05076:B:3"],
      timing: "constant",
      condition: { kind: "victoryPoints", min: 4 },
      instructions: [{ verb: "ModifyStat", stat: "battle", amount: 1, until: "whileSourceInPlay", target: "self" }, SELF_FLAG("losesSiege")],
    },
    { id: "05076:constant:3", cardCode: "05076", lines: ["05076:B:4"], timing: "constant", instructions: [] },
  ],
  { pool: [] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
