// Rules: rr.forced, rr.shadow-effects, rr.travel, rr.reveal, rr.attachment-cards, rr.optional-engagement, rr.first-player, rr.then, rr.explored, rr.engaged, rr.threat-elimination-level, rr.cost (data/rules/entries.json).
import { announce, answer, attachedTo, attack, cardSpecs, damageOn, deckCount, defend, flag, handCount, lost, notWon, offers, resolve, resourcesOn, reveal, stagingThreat, stat, threat, travel, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Danger in Dorwinion (vengeance-of-mordor part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot express (the Setup, a tally over a round, two attacks, the order of two Forced effects, the Secret Cultist's life) is a test titled with its line id in lines.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; a layout's current stage is on its B side.
const S1 = "21077";
const S2 = "21078";
const S3 = "21079";
const PRIEST = "21030";
const GOVERNOR = "21031";
const BRIBES = "21033";
const SUBMIT = "21034";
const WORSHIP = "21035";
const EVIDENCE = "21036";
const MANOR = "21037";
const MESSENGER = "21040";
const SERVANT = "21041";
const BACKSTABBER = "21044";
const EASTERLING = "21045";
const FORUM = "21046";
const STREET = "21049";
const CATACOMBS = "21050";
const FEAR = "21043";
const TRAVELERS = "21052";

const ROWS: readonly Row[] = [
  { line: "21030:A:2", name: "Cannot be optionally engaged", layout: { stage: S1, phase: "Encounter", staging: [PRIEST], threat: [45, 30] }, act: [], expect: offers("Engage", undefined, false) },
  { line: "21030:A:3", name: "Forced: after it attacks and destroys an ally each player raises threat by 2", layout: { stage: S1, engaged: [PRIEST], play: ["ally"] }, act: [attack(PRIEST), defend("ally")], expect: threat(30) },

  { line: "21033:A:1", name: "+1 total Threat in the staging area for each resource here", layout: { stage: S1, staging: [{ code: BRIBES, resources: 2 }, SERVANT] }, act: [], expect: stagingThreat(3) },

  { line: "21034:A:1", name: "Each non-unique enemy gets +1 Attack", layout: { stage: S1, staging: [SUBMIT, SERVANT, PRIEST] }, act: [], expect: [stat(SERVANT, "attack", 3), stat(PRIEST, "attack", 6)] },
  { line: "21034:A:2", name: "Forced: after an enemy attacks and destroys a character, 1 damage token here", layout: { stage: S1, staging: [SUBMIT], engaged: [PRIEST], play: ["ally"] }, act: [attack(PRIEST), defend("ally")], expect: damageOn(SUBMIT, 1) },
  { line: "21034:A:2", name: "Forced: a hero an undefended attack destroys counts too", layout: { stage: S1, staging: [SUBMIT], engaged: [PRIEST] }, act: attack(PRIEST, { undefended: true }), expect: damageOn(SUBMIT, 1) },
  { line: "21034:A:2", name: "Forced: with 4 more tokens than players the players lose the game", layout: { stage: S1, staging: [{ code: SUBMIT, damage: 4 }], engaged: [PRIEST] }, act: attack(PRIEST, { undefended: true }), expect: lost },
  { line: "21034:A:2", name: "Forced: with fewer tokens the players have not lost", layout: { stage: S1, staging: [{ code: SUBMIT, damage: 3 }], engaged: [PRIEST] }, act: attack(PRIEST, { undefended: true }), expect: [damageOn(SUBMIT, 4), notWon] },

  { line: "21035:A:3", name: "Forced: at the end of the round 1 more damage token", layout: { stage: S1, staging: [{ code: WORSHIP, damage: 1 }] }, act: announce("endOfRound", WORSHIP), expect: damageOn(WORSHIP, 2) },

  { line: "21036:A:1", name: "Guarded (enemy): the first enemy discarded guards it", layout: { stage: S1, deck: ["treachery", SERVANT, "f3"] }, act: reveal(EVIDENCE), expect: [attachedTo(SERVANT, EVIDENCE)] },
  { line: "21036:A:2", name: "Attached enemy gets +1 Threat, +1 Attack and +1 Defense", layout: { stage: S1, staging: [EVIDENCE], attached: [{ code: SERVANT, to: EVIDENCE, guard: true }] }, act: [], expect: [stat(SERVANT, "threat", 2), stat(SERVANT, "attack", 3), stat(SERVANT, "defense", 2)] },
  { line: "21031:A:2", name: "Forced: after a location is revealed from the encounter deck it engages the first player and makes an immediate attack", layout: { stage: S1, staging: [GOVERNOR] }, act: reveal(MANOR), expect: [zone(GOVERNOR, "engaged"), window("defense")] },


  { line: "21037:A:2", name: "Travel: each player discards 1 random card from his hand", layout: { stage: S1, phase: "Travel", staging: [MANOR], hand: ["event", "event"] }, act: travel(MANOR), expect: [handCount(1), zone(MANOR, "activeLocation")] },

  { line: "21038:A:1", name: "When Revealed: each player discards all ally cards from his hand", layout: { stage: S1, hand: ["ally", "ally", "event"] }, act: reveal("21038"), expect: [handCount(1), threat(28)] },
  { line: "21038:A:1", name: "When Revealed: if no cards are discarded this way it gains doomed 2", layout: { stage: S1, hand: ["event"] }, act: reveal("21038"), expect: [handCount(1), threat(30)] },
  { line: "21038:A:2", name: "Shadow: the defending player discards an attachment they control", layout: { stage: S1, attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "21038", undefended: true }), expect: zone("attachment", "discard") },

  { line: "21040:A:1", name: "When Revealed: the first player may have each player raise threat by the active location's Threat", layout: { stage: S1, active: "place" }, act: [reveal(MESSENGER), answer("threat")], expect: threat(30) },
  { line: "21040:A:1", name: "When Revealed: or Messenger from Mordor makes an immediate attack against the first player", layout: { stage: S1, active: "place" }, act: [reveal(MESSENGER), answer("attack")], expect: [threat(28), window("defense")] },

  { line: "21041:A:2", name: "It engages the first player", layout: { stage: S1 }, act: reveal(SERVANT), expect: zone(SERVANT, "engaged") },
  { line: "21041:A:3", name: "Forced: after the engaged player raises his threat it makes an immediate attack", layout: { stage: S1, engaged: [SERVANT] }, act: announce("threatRaised", undefined, { amount: 1 }), expect: window("defense") },

  { line: "21042:A:3", name: "Shadow: either raise your threat by 2", layout: { stage: S1 }, act: [attack("f3", { shadow: "21042", undefended: true }), answer("threat")], expect: threat(30) },
  { line: "21042:A:3", name: "Shadow: or the attacking enemy cannot take damage this round", layout: { stage: S1 }, act: [attack("f3", { shadow: "21042", undefended: true }), answer("damage")], expect: flag("f3", "cannotTakeDamage") },

  { line: "21043:A:2", name: "Forced: after an enemy engages a player that player raises his threat by 1", layout: { stage: S1, staging: [FEAR], engaged: [SERVANT] }, act: announce("engaged", SERVANT), expect: threat(29) },

  { line: "21044:A:1", name: "Forced: after it engages you, raise your threat by 2", layout: { stage: S1, engaged: [BACKSTABBER] }, act: announce("engaged", BACKSTABBER), expect: threat(30) },
  { line: "21044:A:2", name: "Shadow: raise your threat by 1 for each enemy engaged with you", layout: { stage: S1, engaged: ["f3", "f0"] }, act: attack("f3", { shadow: BACKSTABBER, undefended: true }), expect: threat(30) },

  { line: "21045:A:1", name: "+1 Attack and +1 Defense for each resource token on it", layout: { stage: S1, staging: [{ code: EASTERLING, resources: 2 }] }, act: [], expect: [stat(EASTERLING, "attack", 5), stat(EASTERLING, "defense", 3)] },
  { line: "21045:A:1", name: "+1 Attack and +1 Defense for each resource token on it: with 5 resources the limit +3 holds, more again add nothing", layout: { stage: S1, staging: [{ code: EASTERLING, resources: 5 }] }, act: [], expect: [stat(EASTERLING, "attack", 6), stat(EASTERLING, "defense", 4)] },
  { line: "21045:A:2", name: "Forced: after the engaged player raises his threat it gets 1 resource", layout: { stage: S1, engaged: [EASTERLING] }, act: announce("threatRaised", undefined, { amount: 1 }), expect: resourcesOn(EASTERLING, 1) },

  { line: "21046:A:1", name: "+1 Threat for each resource here", layout: { stage: S1, staging: [{ code: FORUM, resources: 2 }] }, act: [], expect: stat(FORUM, "threat", 3) },
  { line: "21046:A:2", name: "In the staging area: after a location is explored it gets 1 resource", layout: { stage: S1, staging: [FORUM, "place"] }, act: announce("locationExplored", "place"), expect: resourcesOn(FORUM, 1) },
  { line: "21046:A:3", name: "Travel: each player raises his threat by 1 for each resource here", layout: { stage: S1, phase: "Travel", staging: [{ code: FORUM, resources: 2 }] }, act: travel(FORUM), expect: threat(31) },

  { line: "21048:A:1", name: "When Revealed: raise each player's threat by the active location's Threat", layout: { stage: S1, active: "place" }, act: reveal("21048"), expect: threat(30) },
  { line: "21048:A:1", name: "When Revealed: with no active location it gains surge", layout: { stage: S1, deck: ["treachery", "treachery", "treachery"] }, act: reveal("21048"), expect: deckCount(2) },

  { line: "21049:A:2", name: "Travel: the discard pile is shuffled into the deck and cards are discarded until a location is, which is added to the staging area", layout: { stage: S1, phase: "Travel", staging: [STREET], deck: ["f3"], discard: ["f0", "place"] }, act: travel(STREET), expect: zone("place", "staging") },

  { line: "21050:A:1", name: "While in the staging area the enemies there cannot take damage", layout: { stage: S1, staging: [CATACOMBS, "f3"] }, act: [], expect: flag("f3", "cannotTakeDamage") },
  { line: "21050:A:2", name: "Travel: each player discards the top card of the encounter deck; an enemy discarded is put into play engaged with him", layout: { stage: S1, phase: "Travel", staging: [CATACOMBS], deck: ["f3", "treachery"] }, act: travel(CATACOMBS), expect: zone("f3", "engaged") },

  { line: "21051:A:2", name: "Shadow: if this attack destroys a character, resolve the Travel effect on the active location", layout: { stage: S1, active: MANOR, engaged: [PRIEST], play: ["ally"], hand: ["event", "event"] }, act: [attack(PRIEST, { shadow: "21051" }), defend("ally")], expect: handCount(1) },

  { line: "21052:A:1", name: "Each location in the staging area gets +1 Threat", layout: { stage: S1, staging: [TRAVELERS, "place"] }, act: [], expect: stat("place", "threat", 3) },
  { line: "21052:A:2", name: "Forced: after it becomes the current quest the first player discards until an enemy is discarded and puts it into play engaged with him", layout: { stage: S1, staging: [TRAVELERS], deck: ["treachery", "f3"] }, act: announce("becameCurrentQuest", TRAVELERS), expect: zone("f3", "engaged") },

  { line: "21077:B:1", name: "Forced: after the active location leaves play as an explored location, 1 resource here", layout: { stage: S1 }, act: resolve(S1, "forced"), expect: resourcesOn(S1, 1) },
  { line: "21078:B:1", name: "Forced: reveal the top card of the encounter deck, then 1 resource here", layout: { stage: S2, deck: ["f3"] }, act: resolve(S2, "forced"), expect: [zone("f3", "staging"), resourcesOn(S2, 1)] },
  { line: "21078:A:1", name: "When Revealed: 1 random set-aside Plot objective is added to the staging area and each player reveals 1 encounter card", layout: { stage: S2, setAside: [BRIBES], deck: ["f3"] }, act: resolve(S2, "whenRevealed"), expect: [zone(BRIBES, "staging"), zone("f3", "staging")] },
  { line: "21079:A:1", name: "When Revealed: 1 random set-aside Cultist is added to the staging area and X enemies are discarded from the deck into the staging area", layout: { stage: S3, seats: 2, setAside: [PRIEST], deck: ["treachery", "f3"], discard: [] }, act: resolve(S3, "whenRevealed"), expect: [zone(PRIEST, "staging"), zone("f3", "staging")] },
  { line: "21079:B:2", name: "When the Cultist enemy is defeated, the players win the game", layout: { stage: S3, staging: [PRIEST] }, act: announce("enemyDestroyed", PRIEST), expect: won },
];

cardSpecs("danger-in-dorwinion", ROWS);
