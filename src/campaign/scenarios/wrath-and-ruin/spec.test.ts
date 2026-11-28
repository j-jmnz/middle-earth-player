// Rules: vom.controlling-locations, vom.losing-control-of-a-location, rr.forced, rr.shadow-effects, rr.reveal, rr.engaged, rr.travel, rr.explored, rr.active-location, rr.attachment-cards, rr.damage, rr.destroy (data/rules/entries.json).
import { announce, answer, attack, quest, attachedTo, cardSpecs, damageOn, defend, flag, progressOn, reveal, resolve, stagingThreat, stat, travel, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Wrath and Ruin (vengeance-of-mordor part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot express (a second seat in control, a sentinel defender, a stage advance, a cancel, X fixed at reveal, two attacks in turn order) is a test titled with its line id in lines.test.ts. `controlled` gives the first player the locations; the stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points.
const S1 = "22025";
const S2 = "22026";
const ULCHOR = "22011";
const CHAMPION = "22012";
const SKIRMISHER = "22013";
const GATE = "22014";
const SQUARE = "22015";
const HOUSE = "22016";
const FORT = "22017";
const TOWER = "22018";
const FURY = "22019";
const CAUGHT = "22020";
const STREET = "22021";
const SIEGE = "22022";
const REVENGE = "22023";
const RAIDER = "21020";
const WARRIOR = "21021";
const EXPLORED = { explored: true, seat: null } as const;

const ROWS: readonly Row[] = [
  { line: "22011:A:1", name: "Thane Ulchor cannot leave the staging area", layout: { stage: S1, staging: [ULCHOR] }, act: [], expect: flag(ULCHOR, "cannotLeaveStaging") },
  { line: "22011:A:2", name: "Forced: after the active location is explored the first player discards until a location and adds it to the staging area, the other discards staying", layout: { stage: S1, staging: [ULCHOR], deck: ["treachery", "place", "f0"] }, act: [announce("activeExplored"), answer("location")], expect: [zone("place", "staging"), zone("treachery", "encounterDiscard"), zone("f0", "encounterDeck")] },
  { line: "22011:A:2", name: "Forced: or Thane Ulchor attacks the first player from the staging area", layout: { stage: S1, staging: [ULCHOR], deck: ["treachery", "place"] }, act: [announce("activeExplored"), answer("attack")], expect: [window("defense"), zone("place", "encounterDeck")] },

  { line: "22011:A:2", name: "Forced: a quest that explores the active location opens the choice (the first player took control of it first)", layout: { stage: S1, staging: [ULCHOR], active: { code: "place", progress: 1 }, deck: ["f0", STREET, "22016"] }, act: quest("success"), expect: [zone("22016", "staging"), zone("place", "play"), zone(STREET, "encounterDiscard")] },
  { line: "22017:A:2", name: "Forced: a quest that explores the Fortification gives its controller the topmost enemy of the discard pile in the staging area", layout: { stage: S1, active: { code: FORT, progress: 2 }, discard: [WARRIOR, RAIDER], deck: ["f0", "f3"] }, act: quest("success"), expect: [zone(FORT, "play"), zone(RAIDER, "staging")] },
  { line: "22018:A:2", name: "Forced: a quest that explores the Tower engages the first enemy of the shuffled discard pile with the player who took it", layout: { stage: S1, active: { code: TOWER, progress: 3 }, discard: [WARRIOR], deck: ["f0", STREET] }, act: quest("success"), expect: [zone(TOWER, "play"), zone(WARRIOR, "engaged")] },
  { line: "22012:A:1", name: "Forced: after it engages you, you return a location you control to the staging area", layout: { stage: S1, engaged: [CHAMPION], controlled: ["place"] }, act: [announce("engaged", CHAMPION), answer("return")], expect: [zone("place", "staging"), window("defense", false)] },
  { line: "22012:A:1", name: "Forced: or it makes an attack", layout: { stage: S1, engaged: [CHAMPION], controlled: ["place"] }, act: [announce("engaged", CHAMPION), answer("attack")], expect: [zone("place", "play"), window("defense")] },
  { line: "22012:A:1", name: "Forced: with no location to return it makes the attack", layout: { stage: S1, engaged: [CHAMPION] }, act: announce("engaged", CHAMPION), expect: window("defense") },
  { line: "22012:A:2", name: "Shadow: 1 damage to the defending character", layout: { stage: S1, engaged: ["f3"], play: ["ally"] }, act: [attack("f3", { shadow: CHAMPION }), defend("ally")], expect: damageOn("ally", 1) },

  { line: "22013:A:2", name: "Forced: after it attacks and destroys a character, its controller returns the location with the highest Threat", layout: { stage: S1, engaged: [SKIRMISHER], play: ["ally"], controlled: ["place"] }, act: [attack(SKIRMISHER), defend("ally")], expect: zone("place", "staging") },

  { line: "22014:A:2", name: "X is 1 more than the locations the players control", layout: { stage: S1, staging: [GATE], controlled: ["place", "place"] }, act: [], expect: stat(GATE, "threat", 3) },
  { line: "22014:A:2", name: "X is 1 with no location controlled", layout: { stage: S1, staging: [GATE] }, act: [], expect: stat(GATE, "threat", 1) },
  { line: "22014:A:4", name: "Travel: Thane Ulchor attacks the player", layout: { stage: S2, progress: 12, phase: "Travel", staging: [GATE, ULCHOR], controlled: ["place", "place"] }, act: travel(GATE), expect: window("defense") },

  { line: "22015:A:2", name: "Forced: after an enemy in the staging area is defeated, 1 progress on Contested Square in the staging area", layout: { stage: S1, staging: [SQUARE, "f3"] }, act: announce("enemyDestroyed", "f3"), expect: progressOn(SQUARE, 1) },
  { line: "22015:A:2", name: "Forced: an engaged enemy that is defeated places it too", layout: { stage: S1, staging: [SQUARE], engaged: ["f3"] }, act: announce("enemyDestroyed", "f3"), expect: progressOn(SQUARE, 1) },
  { line: "22015:A:3", name: "While you control it, it returns to the staging area after a character you control is destroyed", layout: { stage: S1, controlled: [SQUARE] }, act: announce("characterDestroyed", "dh1"), expect: zone(SQUARE, "staging") },

  { line: "22016:A:1", name: "Encounter Action: the topmost enemy of the encounter discard pile engages the acting player, who takes control of Ransacked House", layout: { stage: S1, staging: [HOUSE], discard: [WARRIOR, RAIDER] }, act: resolve(HOUSE, "action"), expect: [zone(RAIDER, "engaged"), zone(WARRIOR, "encounterDiscard"), zone(HOUSE, "play")] },
  { line: "22016:A:2", name: "While you control it, it returns to the staging area after you lose control of another location", layout: { stage: S1, controlled: [HOUSE, "place"] }, act: announce("controlLost", "place"), expect: zone(HOUSE, "staging") },

  { line: "22017:A:1", name: "While it is the active location it has archery 3", layout: { stage: S1, active: FORT }, act: [], expect: stat(FORT, "archery", 3) },
  { line: "22017:A:2", name: "Forced: after a player takes control of it, the topmost enemy of the encounter discard pile returns to the staging area", layout: { stage: S1, staging: [FORT], discard: [WARRIOR, RAIDER] }, act: announce("controlTaken", FORT), expect: [zone(RAIDER, "staging"), zone(WARRIOR, "encounterDiscard")] },

  { line: "22018:A:2", name: "Forced: after a player takes control of it the discard pile is shuffled in and the first enemy discarded engages him", layout: { stage: S1, staging: [TOWER], discard: [WARRIOR], deck: ["treachery"] }, act: announce("controlTaken", TOWER), expect: [zone(WARRIOR, "engaged")] },

  { line: "22019:A:2", name: "Attached to an enemy it makes that enemy heal instead of being destroyed", layout: { stage: S1, staging: [RAIDER], attached: [{ code: FURY, to: RAIDER, encounter: true }] }, act: [], expect: flag(RAIDER, "healsInsteadOfDestroyed") },
  { line: "22019:A:3", name: "When Revealed: attach to the lowest engagement cost Easterling enemy without Fury", layout: { stage: S1, staging: [CHAMPION, SKIRMISHER] }, act: reveal(FURY), expect: attachedTo(FURY, SKIRMISHER) },
  { line: "22019:A:3", name: "When Revealed: it reaches an engaged enemy too", layout: { stage: S1, staging: [WARRIOR], engaged: [RAIDER] }, act: reveal(FURY), expect: attachedTo(FURY, RAIDER) },

  { line: "22020:A:1", name: "When Revealed: each player returns a location he controls to the staging area", layout: { stage: S1, controlled: ["place"], deck: ["treachery", WARRIOR] }, act: [reveal(CAUGHT), answer("return")], expect: [zone("place", "staging"), zone(WARRIOR, "encounterDeck")] },
  { line: "22020:A:1", name: "When Revealed: or discards until an enemy and puts it into play engaged with him", layout: { stage: S1, controlled: ["place"], deck: [STREET, WARRIOR] }, act: [resolve(CAUGHT, "whenRevealed"), answer("enemy")], expect: [zone(WARRIOR, "engaged"), zone(STREET, "encounterDiscard"), zone("place", "play")] },
  { line: "22020:A:1", name: "When Revealed: with no location to return he takes the enemy", layout: { stage: S1, deck: ["treachery", WARRIOR] }, act: reveal(CAUGHT), expect: [zone(WARRIOR, "engaged")] },
  { line: "22020:A:2", name: "Shadow: the attacking enemy makes an additional attack after this one", layout: { stage: S1, engaged: ["f3"] }, act: attack("f3", { shadow: CAUGHT, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "22021:A:1", name: "When Revealed: each player assigns X damage, X being 1 more than the locations he controls", layout: { stage: S1, controlled: ["place"] }, act: [reveal(STREET), answer("dh1"), answer("dh1")], expect: damageOn("dh1", 2) },
  { line: "22021:A:1", name: "When Revealed: with no location controlled X is 1", layout: { stage: S1 }, act: [reveal(STREET), answer("dh1")], expect: damageOn("dh1", 1) },
  { line: "22021:A:2", name: "Shadow: the defending player assigns X damage among his characters", layout: { stage: S1, engaged: ["f3"], controlled: ["place"] }, act: [attack("f3", { shadow: STREET, undefended: true }), answer("dh1"), answer("dh1")], expect: damageOn("dh1", 3) },

  { line: "22022:A:1", name: "When Revealed: the staging area gets X Threat, 1 more than the locations the players control", layout: { stage: S1, controlled: ["place"] }, act: reveal(SIEGE), expect: stagingThreat(2) },
  { line: "22022:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { stage: S1, engaged: ["f3"] }, act: attack("f3", { shadow: SIEGE, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "22022:A:2", name: "Shadow: if the attack destroys a character, the defending player returns the location with the highest Threat", layout: { stage: S1, engaged: [CHAMPION], play: ["ally"], controlled: ["place"] }, act: [attack(CHAMPION, { shadow: SIEGE }), defend("ally")], expect: zone("place", "staging") },

  { line: "22023:A:2", name: "When Revealed: Thane Ulchor attacks a player who controls a location", layout: { stage: S1, staging: [ULCHOR], controlled: ["place"] }, act: reveal(REVENGE), expect: window("defense") },
  { line: "22023:A:3", name: "Shadow: the attacking enemy gets +1 Attack for each location the defending player controls", layout: { stage: S1, engaged: ["f3"], controlled: ["place", "place"] }, act: attack("f3", { shadow: REVENGE, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "22025:A:1", name: "Setup: each player adds a different non-unique location from the encounter deck to the staging area, and the deck is shuffled", layout: { stage: S1, deck: ["f0", "22015", "f3"] }, act: resolve(S1, "setup"), expect: zone("22015", "staging") },
  { line: "22025:B:1", name: "This stage gets 4 more quest points per player, and no player card effect places progress on a location in the staging area", layout: { stage: S1 }, act: [], expect: [stat(S1, "questPoints", 8), flag("table", "noProgressInStagingByPlayer")] },
  { line: "22025:B:2", name: "Forced: when a location is explored, the first player takes control of it", layout: { stage: S1, staging: ["place"] }, act: announce("leftPlay", "place", EXPLORED), expect: zone("place", "play") },
  { line: "22026:A:1", name: "When Revealed: each player returns the highest Threat location he controls to the staging area", layout: { stage: S2, controlled: [SQUARE, HOUSE], deck: [WARRIOR] }, act: resolve(S2, "whenRevealed"), expect: [zone(HOUSE, "staging"), zone(SQUARE, "play")] },
  { line: "22026:B:1", name: "No player card effect places progress on a location in the staging area", layout: { stage: S2 }, act: [], expect: flag("table", "noProgressInStagingByPlayer") },
  { line: "22026:B:3", name: "Forced: when a location is explored, the first player takes control of it", layout: { stage: S2, staging: ["place"] }, act: announce("leftPlay", "place", EXPLORED), expect: zone("place", "play") },
  { line: "22026:B:4", name: "At the end of the round the players win when they control Gate of Dorwinion", layout: { stage: S2, controlled: [GATE] }, act: announce("endOfRound"), expect: won },
];

cardSpecs("wrath-and-ruin", ROWS);
