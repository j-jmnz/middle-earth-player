// Rules: mec113.minas-tirith, mec113.assault, mec113.saga-staging-rules, mec113.immune-to-player-card-effects, mec113.peril, mec113.archery, rr.effects, rr.cannot, rr.then, rr.forced, rr.shadow-effects, rr.lasting-effects, rr.active-location, rr.search, rr.travel, faq.additional-attacks, faq.lasting-effects, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, defend, endPhase, flag, progressOn, quest, resolve, resourcesOn, reveal, revealedBy, stagingThreat, stat, threat, travel, zone, lost, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Battle of the Pelennor Fields (the-return-of-the-king part 15): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure, Finish). What a row cannot hold (a joint attack, a bar seen only in what is refused,
// the campaign card's Setup, damage that overflows City Wall) is in lines.test.ts and campaign.test.ts, each test titled with its line. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28.
// The stand-in ally has cost 1 and 2 hit points; `treachery` is a card with no shadow effect.
const CITY = "145043";
const GROND = "145044";
const WALL = "145046";
const WRAITH = "145062";
const CAPTAIN = "145079";
const SORCERER = "145080";
const FLEET = "145072";
const ARAGORN = "145001";
// Stage 1 skips the quest and combat phases, so the rows that attack are played at stage 2.
const STAGE2 = { stage: "145074" };
const ROWS: readonly Row[] = [
  { line: "145015:A:4", name: "+1 Willpower while committed to the quest with another Gondor character", layout: { attached: [{ code: "145015", to: "dh1" }, { code: "145015", to: "dh2" }], committed: ["dh1", "dh2"] }, act: [], expect: stat("dh1", "willpower", 3) },

  { line: "145043:A:1", name: "30 hit points plus 10 for each player", layout: { seats: 2, staging: [CITY] }, act: [], expect: stat(CITY, "hitPoints", 50) },
  { line: "145043:A:2", name: "Forced at the end of the round: 1 damage for each enemy in the staging area", layout: { staging: [CITY, "f3", "f3"] }, act: announce("endOfRound", CITY), expect: damageOn(CITY, 2) },
  { line: "145043:A:2", name: "then, with no hit points remaining, the players lose the game", layout: { staging: [{ code: CITY, damage: 38 }, "f3", "f3"] }, act: announce("endOfRound", CITY), expect: lost },
  { line: "145043:A:2", name: "with hit points remaining the game goes on", layout: { staging: [{ code: CITY, damage: 30 }, "f3", "f3"] }, act: announce("endOfRound", CITY), expect: damageOn(CITY, 32) },

  { line: "145044:A:2", name: "X, its Threat, is the resources on Grond", layout: { staging: [{ code: GROND, resources: 3 }] }, act: [], expect: stat(GROND, "threat", 3) },
  { line: "145044:A:3", name: "Forced at the beginning of the quest phase: 1 resource, then X damage to Minas Tirith", layout: { staging: [{ code: GROND, resources: 2 }, CITY] }, act: resolve(GROND, "forced"), expect: [resourcesOn(GROND, 3), damageOn(CITY, 3)] },
  { line: "145044:A:3", name: "with Minas Tirith out of play the damage is not dealt", layout: { staging: [GROND] }, act: resolve(GROND, "forced"), expect: resourcesOn(GROND, 1) },
  { line: "145044:A:4", name: "Travel: The Witch-king, in play, makes an immediate attack against each player", layout: { stage: "145074", phase: "Travel", staging: [GROND, CAPTAIN], deck: ["f0", "f0", "f0"] }, act: [resolve(GROND, "travel"), endPhase], expect: attackersOf("dh1", [CAPTAIN]) },

  { line: "145045:A:2", name: "while it is the active location each enemy in play gets -30 engagement cost", layout: { active: "145045", staging: ["f3"], engaged: [{ code: "f0", seat: 0 }] }, act: [], expect: [stat("f3", "engagementCost", 20), stat("f0", "engagementCost", 20)] },
  { line: "145045:A:3", name: "Forced when it is explored as the active location: each engaged enemy returns to the staging area", layout: { active: "145045", engaged: [{ code: "f3", seat: 0 }] }, act: announce("activeExplored", "145045"), expect: zone("f3", "staging") },
  { line: "145045:A:3", name: "explored in the staging area it does the same", layout: { staging: ["145045"], engaged: [{ code: "f3", seat: 0 }] }, act: announce("locationExplored", "145045"), expect: zone("f3", "staging") },

  { line: "145046:A:1", name: "while it is the active location damage meant for Minas Tirith is placed on it first", layout: { active: WALL, staging: [CITY, "f3", "f3"] }, act: announce("endOfRound", CITY), expect: [damageOn(WALL, 2), damageOn(CITY, 0)] },
  { line: "145046:A:2", name: "Forced: with damage equal to its quest points it is discarded and each player raises their threat by 3", layout: { seats: 2, staging: [{ code: WALL, damage: 4 }] }, act: announce("damaged", WALL, { amount: 1 }), expect: [zone(WALL, "encounterDiscard"), threat(31), threat(31, 1)] },

  { line: "145047:A:1", name: "while an enemy is in the staging area no progress can be placed on the locations there", layout: { staging: ["145047", "f3", "place"] }, act: [], expect: flag("place", "noProgressPlaced") },
  { line: "145047:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: STAGE2, act: attack("f3", { shadow: "145047", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "145047:A:2", name: "+2 Attack with the Harad trait", layout: STAGE2, act: attack("144028", { shadow: "145047", undefended: true }), expect: damageOn("dh1", 5) },

  { line: "145049:A:1", name: "in the staging area it has Archery 3", layout: { staging: ["145049"] }, act: [], expect: stat("145049", "archery", 3) },
  { line: "145049:A:2", name: "Forced after it becomes the active location: the discard pile is shuffled in and cards are discarded until an enemy is, which joins the staging area", layout: { phase: "Travel", staging: ["145049"], deck: ["treachery", "f3"], discard: ["treachery"] }, act: travel("145049"), expect: [zone("f3", "staging"), zone("145049", "activeLocation")] },

  { line: "145050:A:1", name: "cannot have attachments and is attacked by one character at a time", layout: { staging: ["145050"] }, act: [], expect: [flag("145050", "cannotHaveAttachments"), flag("145050", "singleAttacker")] },
  { line: "145050:A:2", name: "When Revealed: it makes an immediate attack against the first player", layout: { stage: "145074", deck: ["f0", "f0", "f0"] }, act: [reveal("145050"), endPhase], expect: attackersOf("dh1", ["145050"]) },

  { line: "145051:A:2", name: "cannot have attachments", layout: { staging: ["145051"] }, act: [], expect: flag("145051", "cannotHaveAttachments") },
  { line: "145051:A:3", name: "Forced when it is destroyed: each player lowers their threat by 4", layout: { seats: 2, staging: ["145051"] }, act: announce("enemyDestroyed", "145051"), expect: [threat(24), threat(24, 1)] },

  { line: "145052:A:1", name: "Forced after a blank shadow card: the defending player deals 3 damage to Minas Tirith", layout: { stage: "145074", staging: [CITY] }, act: [attack("145052", { shadow: "treachery", undefended: true }), answer("city")], expect: damageOn(CITY, 3) },
  { line: "145052:A:1", name: "or it makes an additional attack after this one", layout: { stage: "145074", staging: [CITY], deck: ["145047", "f0", "f0"] }, act: [attack("145052", { shadow: "treachery", undefended: true }), answer("attack")], expect: [damageOn(CITY, 0), attackersOf("dh1", ["145052", "145052"])] },
  { line: "145052:A:1", name: "with Minas Tirith out of play only the attack is offered", layout: { stage: "145074", deck: ["145047", "f0", "f0"] }, act: attack("145052", { shadow: "treachery", undefended: true }), expect: attackersOf("dh1", ["145052", "145052"]) },
  { line: "145052:A:2", name: "Shadow: 1 damage to Minas Tirith", layout: { stage: "145074", staging: [CITY] }, act: attack("f3", { shadow: "145052", undefended: true }), expect: damageOn(CITY, 1) },

  { line: "145053:A:2", name: "When Revealed: the topmost Orc enemy of the encounter discard pile enters play engaged with the revealing player", layout: { discard: ["145055", "145054", "f3"] }, act: reveal("145053"), expect: zone("145054", "engaged") },
  { line: "145053:A:3", name: "Shadow: if the attack destroys a character the attacking enemy returns to the staging area", layout: { stage: "145074", play: [{ code: "ally", damage: 1 }] }, act: [attack("145054", { shadow: "145053" }), defend("ally")], expect: [zone("ally", "discard"), zone("145054", "staging")] },

  { line: "145054:A:2", name: "When Revealed: either 2 damage to a hero you control", layout: { staging: [CITY] }, act: [reveal("145054"), answer("hero"), answer("dh1")], expect: [damageOn("dh1", 2), damageOn(CITY, 0)] },
  { line: "145054:A:2", name: "or 2 damage to Minas Tirith", layout: { staging: [CITY] }, act: [reveal("145054"), answer("city")], expect: [damageOn("dh1", 0), damageOn(CITY, 2)] },
  { line: "145054:A:3", name: "Shadow: the attacking enemy gets +1 Attack", layout: STAGE2, act: attack("f3", { shadow: "145054", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "145054:A:3", name: "+2 Attack with the Mordor trait", layout: STAGE2, act: attack("145053", { shadow: "145054", undefended: true }), expect: damageOn("dh1", 5) },

  { line: "145055:A:2", name: "while Minas Tirith is in play its undefended damage goes to Minas Tirith, not to a hero", layout: { stage: "145074", staging: [CITY] }, act: attack("145055", { undefended: true }), expect: [damageOn(CITY, 2), damageOn("dh1", 0)] },
  { line: "145055:A:3", name: "Shadow: with Minas Tirith in play this card engages the defending player and stays engaged", layout: { stage: "145074", staging: [CITY], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: "145055", undefended: true }), expect: zone("145055", "engaged") },

  { line: "145056:A:1", name: "When Revealed: each player searches the encounter deck and discard pile for an enemy and puts it into play engaged with them", layout: { seats: 2, deck: ["f0", "f3"], discard: ["145054"] }, act: [reveal("145056"), answer("f3"), answer("145054")], expect: [zone("f3", "engaged"), zone("145054", "engaged")] },
  { line: "145056:A:2", name: "Shadow: the defending player chooses 3 damage to Minas Tirith", layout: { stage: "145074", staging: [CITY] }, act: [attack("f3", { shadow: "145056", undefended: true }), answer("city")], expect: damageOn(CITY, 3) },
  { line: "145056:A:2", name: "or the attacking enemy makes an additional attack after this one", layout: { stage: "145074", staging: [CITY], deck: ["145047", "f0", "f0"] }, act: [attack("f3", { shadow: "145056", undefended: true }), answer("attack")], expect: [damageOn(CITY, 0), attackersOf("dh1", ["f3", "f3"])] },

  { line: "145057:A:2", name: "When Revealed: it attaches to a Nazgûl enemy, which gets +1 Attack", layout: { staging: [WRAITH] }, act: reveal("145057"), expect: stat(WRAITH, "attack", 7) },
  { line: "145057:A:2", name: "Forced at the end of the round the host returns to the staging area", layout: { engaged: [{ code: WRAITH, seat: 0 }], attached: [{ code: "145057", to: WRAITH }] }, act: announce("endOfRound", "145057"), expect: zone(WRAITH, "staging") },

  { line: "145058:A:1", name: "When Revealed: the revealing player attaches it to a hero they control", layout: { committed: ["dh1"] }, act: [reveal("145058"), answer("dh1")], expect: zone("145058", "attached") },
  { line: "145058:A:1", name: "Forced at the end of the round it deals 1 damage to its hero", layout: { attached: [{ code: "145058", to: "dh1" }] }, act: announce("endOfRound", "145058"), expect: damageOn("dh1", 1) },
  { line: "145058:A:2", name: "Shadow: if the attack damages a hero it attaches to that hero", layout: STAGE2, act: attack("f3", { shadow: "145058", undefended: true }), expect: [damageOn("dh1", 1), zone("145058", "attached")] },

  { line: "145059:A:1", name: "When Revealed: with no exhausted character, 5 damage to Minas Tirith", layout: { staging: [CITY] }, act: reveal("145059"), expect: damageOn(CITY, 5) },
  { line: "145059:A:2", name: "Shadow: +1 Attack, and if the attack destroys a character 2 damage to Minas Tirith", layout: { stage: "145074", staging: [CITY], play: [{ code: "ally", damage: 0 }] }, act: [attack("145054", { shadow: "145059" }), defend("ally")], expect: [zone("ally", "discard"), damageOn(CITY, 2)] },

  { line: "145060:A:2", name: "When Revealed: the revealing player discards an ally they control, and the staging area's Threat rises by 1 for each ally in their discard pile", layout: { play: ["ally"] }, act: reveal("145060"), expect: [zone("ally", "discard"), stagingThreat(1)] },
  { line: "145060:A:3", name: "Shadow: the defending player discards a non-objective attachment they control", layout: { stage: "145074", attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "145060", undefended: true }), expect: zone("attachment", "discard") },

  { line: "145061:A:2", name: "When Revealed: each player deals 1 damage to a hero they control", layout: { seats: 2 }, act: [reveal("145061"), answer("dh1")], expect: damageOn("dh1", 1) },

  { line: "145062:A:3", name: "+1 Threat and -1 engagement cost for each resource on it", layout: { staging: [{ code: WRAITH, resources: 3 }] }, act: [], expect: [stat(WRAITH, "threat", 3), stat(WRAITH, "engagementCost", 42)] },
  { line: "145062:A:4", name: "Forced at the beginning of the quest phase it gets 1 resource", layout: { staging: [WRAITH] }, act: resolve(WRAITH, "forced"), expect: resourcesOn(WRAITH, 1) },

  { line: "145072:A:1", name: "Forced at the beginning of the quest phase: it loses 1 resource", layout: { staging: [{ code: FLEET, resources: 2 }], setAside: [ARAGORN] }, act: resolve(FLEET, "forced"), expect: [resourcesOn(FLEET, 1), zone(ARAGORN, "setAside"), zone(FLEET, "staging")] },
  { line: "145072:A:1", name: "with none left the first player takes control of Aragorn and the Fleet goes to the victory display", layout: { staging: [{ code: FLEET, resources: 1 }], setAside: [ARAGORN] }, act: resolve(FLEET, "forced"), expect: [resourcesOn(FLEET, 0), zone(ARAGORN, "heroes"), zone(FLEET, "victory")] },
  { line: "145072:A:1", name: "with 0 recorded the check runs at once and frees Aragorn", layout: { staging: [FLEET], setAside: [ARAGORN] }, act: resolve(FLEET, "forced"), expect: [zone(ARAGORN, "heroes"), zone(FLEET, "victory")] },

  { line: "145073:A:1", name: "Setup: the first player may attach Esquire of Rohan to a hero, then Esquire of Gondor to a different hero", layout: { setAside: ["145014", "145015"] }, act: [resolve("145073", "setup"), answer("rohan"), answer("dh1"), answer("gondor")], expect: [zone("145014", "play"), zone("145015", "play")] },
  { line: "145073:B:2", name: "Forced: at the end of the planning phase 1 progress is placed here", layout: { phase: "Planning" }, act: endPhase, expect: progressOn("145073", 1) },

  { line: "145074:A:1", name: "When Revealed: each player adds a set aside Wraith on Wings, reveals an encounter card, and an ally discarded from their deck goes to the staging area", layout: { stage: "145074", setAside: [WRAITH], deck: ["f3"], deckOf: ["filler", "ally"] }, act: resolve("145074", "whenRevealed"), expect: [zone(WRAITH, "staging"), zone("f3", "staging"), zone("ally", "staging"), zone("filler", "discard")] },
  { line: "145074:B:1", name: "X, its quest points, is the total cost of the allies in the staging area", layout: { stage: "145074", staging: ["ally", "ally"] }, act: [], expect: stat("145074", "questPoints", 2) },
  { line: "145074:B:2", name: "allies in the staging area are immune to player card effects", layout: { stage: "145074", staging: ["ally"] }, act: [], expect: flag("ally", "immuneToPlayerCards") },
  { line: "145074:B:3", name: "Forced at the end of the round: damage equal to the enemies in the staging area is assigned among the allies there", layout: { stage: "145074", staging: ["f3", "ally"] }, act: announce("endOfRound", "145074"), expect: damageOn("ally", 1) },

  { line: "145075:A:1", name: "When Revealed: the first player adds Minas Tirith, Grond and The Witch-king to the staging area", layout: { stage: "145075", setAside: [CITY, GROND, CAPTAIN] }, act: resolve("145075", "whenRevealed"), expect: [zone(CITY, "staging"), zone(GROND, "staging"), zone(CAPTAIN, "staging")] },
  { line: "145075:A:1", name: "each other player searches the encounter deck for a different enemy and adds it", layout: { stage: "145075", seats: 2, setAside: [CITY, GROND, CAPTAIN], deck: ["f0", "f3"] }, act: [resolve("145075", "whenRevealed"), answer("f3")], expect: zone("f3", "staging") },
  { line: "145075:B:1", name: "Assault: a failed quest raises no threat and damages Minas Tirith by the shortfall", layout: { stage: "145075", staging: [CITY, { code: GROND, resources: 7 }] }, act: quest("fail"), expect: [damageOn(CITY, 3), threat(28)] },
  { line: "145075:B:2", name: "4 quest points for each player on top of its own", layout: { stage: "145075", seats: 2 }, act: [], expect: stat("145075", "questPoints", 12) },
  { line: "145075:B:4", name: "Forced when an enemy is destroyed: progress equal to its Threat is placed on the stage", layout: { stage: "145075" }, act: announce("enemyDestroyed", undefined, { amount: 3 }), expect: progressOn("145075", 3) },
  { line: "145075:B:4", name: "after the active location, which is explored first", layout: { stage: "145075", active: "place" }, act: announce("enemyDestroyed", undefined, { amount: 3 }), expect: [progressOn("145075", 1), zone("place", "encounterDiscard")] },

  { line: "145076:A:1", name: "When Revealed: The Witch-king is set aside, out of play", layout: { stage: "145076", staging: [CAPTAIN] }, act: resolve("145076", "whenRevealed"), expect: zone(CAPTAIN, "setAside") },
  { line: "145076:B:1", name: "progress from questing is dealt as damage among the enemies in play, not placed on the stage", layout: { stage: "145076", staging: ["f3"] }, act: quest("success"), expect: [progressOn("145076", 0), damageOn("f3", 1)] },
  { line: "145076:B:2", name: "Forced at the end of the quest phase the players advance to stage 5", layout: { stage: "145076" }, act: announce("endOfPhase", "145076"), expect: zone("145077", "questStage") },

  { line: "145077:A:1", name: "When Revealed: the first player adds The Witch-king and attaches a Fell Beast from the encounter deck to him; each other player reveals an encounter card", layout: { stage: "145077", seats: 2, deck: ["f3", "145057"] }, act: resolve("145077", "whenRevealed"), expect: [zone(SORCERER, "staging"), zone("145057", "attached"), revealedBy("f3", 1)] },
  { line: "145077:B:1", name: "The Witch-king is immune to player card effects", layout: { stage: "145077", staging: [SORCERER] }, act: [], expect: flag(SORCERER, "immuneToPlayerCards") },
  { line: "145077:B:2", name: "Forced when an enemy attacks and destroys a character: 1 damage to Minas Tirith", layout: { stage: "145077", staging: [CITY] }, act: announce("characterDestroyedByAttack"), expect: damageOn(CITY, 1) },

  { line: "145078:B:1", name: "Forced when the players advance to stage 5B: each set aside Harad enemy is added to the staging area", layout: { campaign: true, stage: "145076", setAside: ["144028", "144029"] }, act: announce("endOfPhase", "145076"), expect: [zone("144028", "staging"), zone("144029", "staging")] },

  { line: "145079:A:2", name: "cannot be optionally engaged or take damage", layout: { staging: [CAPTAIN] }, act: [], expect: [flag(CAPTAIN, "cannotBeOptionallyEngaged"), flag(CAPTAIN, "cannotTakeDamage")] },
  { line: "145079:A:3", name: "Forced at the beginning of the quest phase: cards are discarded until an enemy is, and it joins the staging area", layout: { staging: [CAPTAIN], deck: ["treachery", "f3"] }, act: resolve(CAPTAIN, "forced"), expect: [zone("f3", "staging"), zone("treachery", "encounterDiscard")] },

  { line: "145080:A:2", name: "Forced at the beginning of the encounter phase: he engages the first player and makes an immediate attack", layout: { stage: "145074", phase: "Encounter", staging: [SORCERER], deck: ["f0", "f0", "f0"] }, act: [resolve(SORCERER, "forced"), endPhase], expect: attackersOf("dh1", [SORCERER]) },
];

if (ROWS.length > 0) cardSpecs("the-battle-of-the-pelennor-fields", ROWS);
else describe("the-battle-of-the-pelennor-fields card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));

