// Rules: mec113.phantom, mec113.saga-staging-rules, mec113.peril, rr.forced, rr.travel, rr.search, rr.shadow-effects, rr.lasting-effects, rr.effects, rr.step-6-4-3 (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, defend, deckCount, endPhase, flag, handCount, progressOn, quest, resolve, resourcesOn, reveal, revealedBy, stagingThreat, stat, threat, travel, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Passing of the Grey Company (the-return-of-the-king part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure, Finish). Phantom is a keyword, so its lines are tested in verbs.test.ts.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28.
const FEAR = "145016";
const STONE = "145017";
const ARMY = "145067";
const ROWS: readonly Row[] = [
  { line: "145016:A:1", name: "Setup: a copy waiting in the pool attaches itself to its controller's threat dial", layout: { setAside: [FEAR] }, act: resolve(FEAR, "setup"), expect: zone(FEAR, "play") },
  { line: "145016:A:3", name: "Forced at the end of the round: the controller raises their threat by 1", layout: { play: [FEAR] }, act: announce("endOfRound", FEAR), expect: threat(29) },

  { line: "145017:A:2", name: "Forced after it becomes the active location: each player in order adds an Oathbreaker enemy from the encounter deck to the staging area", layout: { seats: 2, active: "145017", deck: ["f0", "145022", "145025"] }, act: announce("becameActive", "145017"), expect: [zone("145022", "staging"), zone("145025", "staging")] },
  { line: "145017:A:2", name: "the enemies are added, not revealed (a Phantom enemy's engagement is not asked)", layout: { active: "145017", deck: ["145022"] }, act: announce("becameActive", "145017"), expect: [zone("145022", "staging"), threat(28)] },
  { line: "145017:A:2", name: "an Oathbreaker enemy in the discard pile is found too", layout: { active: "145017", discard: ["145023"] }, act: announce("becameActive", "145017"), expect: zone("145023", "staging") },
  { line: "145017:A:3", name: "Travel: remove 5 progress from stage 3B", layout: { phase: "Travel", stage: "145065", progress: 7, staging: ["145017"] }, act: travel("145017"), expect: [progressOn("145065", 2), zone("145017", "activeLocation")] },

  { line: "145018:A:1", name: "while in the staging area, no progress can be placed on a location in the staging area, itself included", layout: { staging: ["145018", "145019"], active: "145021" }, act: [], expect: [flag("145019", "noProgressPlaced"), flag("145018", "noProgressPlaced"), flag("145021", "noProgressPlaced", false)] },
  { line: "145018:A:2", name: "Travel: the first player reveals an encounter card", layout: { phase: "Travel", staging: ["145018"], deck: ["f0"] }, act: travel("145018"), expect: [zone("f0", "staging"), revealedBy("f0", 0)] },

  { line: "145019:A:1", name: "while in the staging area each enemy in the staging area cannot take damage, and an engaged enemy can", layout: { staging: ["145019", "145022"], engaged: [{ code: "145025", seat: 0 }] }, act: [], expect: [flag("145022", "cannotTakeDamage"), flag("145025", "cannotTakeDamage", false)] },
  { line: "145019:A:2", name: "Travel: the first player puts an Oathbreaker enemy from the deck into play engaged with them (Dead Man of Dunharrow's Forced effect then raises their threat by 2)", layout: { phase: "Travel", staging: ["145019"], deck: ["f0", "145022"] }, act: travel("145019"), expect: [zone("145022", "engaged"), threat(30)] },

  { line: "145019:A:2", name: "the enemy is engaged with the first player, who is the second seat here", layout: { phase: "Travel", seats: 2, firstPlayer: 1, staging: ["145019"], deck: ["145022"] }, act: travel("145019"), expect: [zone("145022", "engaged"), threat(30, 1), threat(28, 0)] },

  { line: "145020:A:1", name: "while in the staging area: after a When Revealed effect is canceled, raise each player's threat by 1", layout: { seats: 2, staging: ["145020"] }, act: announce("whenRevealedCanceled"), expect: [threat(29, 0), threat(29, 1)] },

  { line: "145021:A:1", name: "+1 Threat for each player at 35 or higher (one of two)", layout: { seats: 2, threat: [36, 30], staging: ["145021"] }, act: [], expect: stagingThreat(2) },
  { line: "145021:A:1", name: "+2 Threat when both are at 35 or higher", layout: { seats: 2, threat: [36, 40], staging: ["145021"] }, act: [], expect: stagingThreat(3) },
  { line: "145021:A:2", name: "Travel: raise each player's threat by 1 (the refresh adds 1 more)", layout: { phase: "Travel", seats: 2, staging: ["145021"] }, act: travel("145021"), expect: [threat(30, 0), threat(30, 1)] },
  { line: "145021:A:3", name: "Shadow: the defending player raises their threat by 2", layout: {}, act: [attack("f3", { shadow: "145021", undefended: true }), answer("threat")], expect: threat(30) },
  { line: "145021:A:3", name: "or the attacking enemy returns to the staging area when the attack has ended", layout: {}, act: [attack("f3", { shadow: "145021", undefended: true }), answer("staging")], expect: zone("f3", "staging") },

  { line: "145022:A:2", name: "Forced after it engages you: attach a set aside Overcome by Fear to your threat dial", layout: { engaged: [{ code: "145022", seat: 0 }], setAside: [FEAR] }, act: [announce("engaged", "145022"), answer("attach")], expect: [zone(FEAR, "play"), threat(28)] },
  { line: "145022:A:2", name: "or raise your threat by 2", layout: { engaged: [{ code: "145022", seat: 0 }], setAside: [FEAR] }, act: [announce("engaged", "145022"), answer("threat")], expect: [zone(FEAR, "setAside"), threat(30)] },

  { line: "145023:A:2", name: "When Revealed: the revealing player raises each player's threat by 2", layout: { seats: 2, deck: [] }, act: [reveal("145023"), answer("threat")], expect: [threat(30, 0), threat(30, 1)] },
  { line: "145023:A:2", name: "or reveals an additional encounter card", layout: { deck: ["f0"] }, act: [reveal("145023"), answer("reveal")], expect: [zone("f0", "staging"), threat(28)] },
  { line: "145023:A:3", name: "Shadow: the attacking enemy gets +1 Attack and loses Phantom for this attack, so its damage is dealt", layout: {}, act: attack("145024", { shadow: "145023", undefended: true }), expect: [damageOn("dh1", 4), threat(28)] },

  { line: "145024:A:2", name: "When Revealed: it makes an immediate attack against you from the staging area (Phantom raises threat by the damage)", layout: { setAside: [FEAR], deck: ["f0", "f0"] }, act: [reveal("145024"), answer("attack"), endPhase], expect: [attackersOf("dh1", ["145024"]), threat(31), zone(FEAR, "setAside")] },
  { line: "145024:A:2", name: "or you attach a set aside Overcome by Fear to your threat dial", layout: { setAside: [FEAR], deck: ["f0", "f0"] }, act: [reveal("145024"), answer("attach")], expect: [zone(FEAR, "play"), threat(28)] },

  { line: "145025:A:2", name: "Forced when it engages you: it makes an immediate attack (Phantom raises threat by the damage)", layout: { engaged: [{ code: "145025", seat: 0 }], setAside: [FEAR], deck: ["f0", "f0"] }, act: [announce("engaged", "145025"), answer("attack"), endPhase], expect: [attackersOf("dh1", ["145025"]), threat(32), zone(FEAR, "setAside")] },
  { line: "145025:A:2", name: "or you attach a set aside Overcome by Fear to your threat dial", layout: { engaged: [{ code: "145025", seat: 0 }], setAside: [FEAR] }, act: [announce("engaged", "145025"), answer("attach")], expect: [zone(FEAR, "play"), threat(28)] },

  { line: "145026:A:3", name: "Shadow: at 35 threat or higher the defending character cannot ready until the end of the round", layout: { threat: [36, 28] }, act: attack("f3", { shadow: "145026" }), expect: flag("dh1", "cannotReady") },

  { line: "145027:A:2", name: "or you attach a set aside Overcome by Fear to your threat dial", layout: { setAside: [FEAR], deck: ["f0"] }, act: [reveal("145027"), answer("attach")], expect: zone(FEAR, "play") },

  { line: "145028:A:2", name: "When Revealed: each character you control gets -1 Willpower, -1 Attack and -1 Defense until the end of the round", layout: {}, act: reveal("145028"), expect: [stat("dh1", "willpower", 1), stat("dh1", "attack", 1), stat("dh1", "defense", 1)] },
  { line: "145028:A:3", name: "Shadow: the attacking enemy gets +1 Attack against a defender", layout: { play: ["ally"] }, act: [attack("f3", { shadow: "145028" }), defend("ally")], expect: damageOn("ally", 1) },
  { line: "145028:A:3", name: "and +2 Attack when the attack is undefended", layout: {}, act: attack("f3", { shadow: "145028", undefended: true }), expect: damageOn("dh1", 3) },

  { line: "145029:A:1", name: "When Revealed: each player attaches a set aside Overcome by Fear or discards an ally they control", layout: { setAside: [FEAR], play: ["ally"] }, act: [reveal("145029"), answer("attach")], expect: [zone(FEAR, "play"), zone("ally", "play")] },
  { line: "145029:A:1", name: "discarding an ally is the other option", layout: { setAside: [FEAR], play: ["ally"] }, act: [reveal("145029"), answer("discard")], expect: [zone("ally", "discard"), zone(FEAR, "setAside")] },
  { line: "145029:A:2", name: "Shadow: the defending player attaches a set aside Overcome by Fear to their threat dial", layout: { setAside: [FEAR] }, act: [attack("f3", { shadow: "145029", undefended: true }), answer("attach")], expect: [zone(FEAR, "play"), damageOn("dh1", 1)] },
  { line: "145029:A:2", name: "or the attacking enemy makes an additional attack after this one", layout: { setAside: [FEAR], deck: ["f0", "f0"] }, act: [attack("f3", { shadow: "145029", undefended: true }), answer("attack")], expect: damageOn("dh1", 2) },

  { line: "145063:A:1", name: "Setup: each player attaches one of the set aside copies to their threat dial", layout: { seats: 2, setAside: [FEAR, FEAR, FEAR, FEAR] }, act: resolve("145063", "setup"), expect: zone(FEAR, "play") },
  { line: "145063:B:1", name: "When Revealed: a player who adds 1 resource to each hero they control raises their threat by 3, and one who declines changes nothing", layout: { seats: 2 }, act: [resolve("145063", "whenRevealed"), answer("add"), answer("decline")], expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 1), resourcesOn("dh3", 0), threat(31, 0), threat(28, 1)] },
  { line: "145063:B:2", name: "Forced at the end of the planning phase: every hand is discarded and the quest advances to stage 2A", layout: { seats: 2, phase: "Planning", hand: ["filler", "filler"] }, act: announce("endOfPhase"), expect: [handCount(0, 0), handCount(0, 1), zone("145064", "questStage")] },

  { line: "145064:A:1", name: "When Revealed: each player searches the encounter deck for a different location and adds it to the staging area", layout: { stage: "145064", seats: 2, deck: ["f0", "145018", "145019", "145020"] }, act: resolve("145064", "whenRevealed"), expect: [zone("145018", "staging"), zone("145019", "staging"), zone("145020", "encounterDeck")] },
  { line: "145064:B:1", name: "X is the threat of the player with the highest threat", layout: { stage: "145064", seats: 2, threat: [36, 41] }, act: [], expect: stat("145064", "questPoints", 41) },
  { line: "145064:B:3", name: "Forced at the beginning of the planning phase: each player raises their threat by 1 or cannot play cards this phase", layout: { stage: "145064", seats: 2, phase: "Planning" }, act: [announce("beginningOfPhase"), answer("threat"), answer("noPlay")], expect: [threat(29, 0), threat(28, 1)] },

  { line: "145065:A:1", name: "When Revealed: The Stone of Erech and Army of the Dead join the staging area, and a player may raise their threat by 3 to set aside Overcome by Fear", layout: { stage: "145065", setAside: [STONE, ARMY], play: [FEAR] }, act: [resolve("145065", "whenRevealed"), answer("detach")], expect: [zone(STONE, "staging"), zone(ARMY, "staging"), zone(FEAR, "setAside"), threat(31)] },
  { line: "145065:B:1", name: "while the Stone is the active location each Oathbreaker enemy loses Phantom and gets -20 engagement cost", layout: { stage: "145065", active: STONE, staging: ["145022"] }, act: [], expect: [flag("145022", "losesPhantom"), stat("145022", "engagementCost", 10)] },
  { line: "145065:B:2", name: "the players win when the Stone leaves play as an explored location", layout: { stage: "145065", active: STONE }, act: announce("locationExplored", STONE), expect: won },
  { line: "145065:B:2", name: "5 or more progress on the stage does not defeat it", layout: { stage: "145065", progress: 4 }, act: quest("success"), expect: [progressOn("145065", 8), zone("145065", "questStage")] },

  { line: "145067:A:2", name: "X, its Threat, is 2 times the number of players", layout: { seats: 2, staging: [ARMY] }, act: [], expect: stat(ARMY, "threat", 4) },
  { line: "145067:A:3", name: "Forced when it attacks: you attach a set aside Overcome by Fear to your threat dial", layout: { engaged: [{ code: ARMY, seat: 0 }], setAside: [FEAR], play: ["ally"] }, act: [announce("attacks", ARMY), answer("attach")], expect: [zone(FEAR, "play"), zone("ally", "play")] },
  { line: "145067:A:3", name: "or discard an ally you control", layout: { engaged: [{ code: ARMY, seat: 0 }], setAside: [FEAR], play: ["ally"] }, act: [announce("attacks", ARMY), answer("discard")], expect: [zone("ally", "discard"), zone(FEAR, "setAside")] },
];

if (ROWS.length > 0) cardSpecs("the-passing-of-the-grey-company", ROWS);
else describe("the-passing-of-the-grey-company card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
