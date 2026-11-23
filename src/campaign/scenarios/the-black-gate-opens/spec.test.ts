// Rules: mec113.dire, mec113.saga-staging-rules, mec113.immune-to-player-card-effects, mec113.peril, rr.effects, rr.forced, rr.shadow-effects, rr.lasting-effects, rr.engaged, rr.then, rr.defending-player, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
import { announce, answer, attack, attackersOf, cardSpecs, classFlag, damageOn, deckCount, defend, endPhase, flag, quest, reveal, resolve, resourcesOn, stagingThreat, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Black Gate Opens (the-return-of-the-king, part 5 of the box): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). What a row cannot hold (a bar on travel, a card
// that leaves the quest, a choice that needs a Fellowship hero) is in lines.test.ts, each test titled with its line; the scenario's end is in end.test.ts and the golden.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and every seat starts at threat 28; f3 is an enemy with Threat 3, Attack 1, Defense 1 and 3 hit points, f0 the same with Threat 0.
// Stage 1 (146072) has no quest points and skips nothing the rows need, but the rows that quest or attack are played at stage 2 (146073), whose Forced and reveal rules they do not touch.
const GATE = "146024";
const MOUTH = "146031";
const STAGE2 = { stage: "146073" };
const ROWS: readonly Row[] = [
  { line: "146024:A:2", name: "+1 Threat for each resource on it", layout: { staging: [{ code: GATE, resources: 3 }] }, act: [], expect: stat(GATE, "threat", 3) },
  { line: "146024:A:3", name: "Forced: at the beginning of the quest phase it gets 1 resource and each player raises their threat by 1", layout: { phase: "Quest", staging: [GATE], seats: 2 }, act: resolve(GATE, "forced"), expect: [resourcesOn(GATE, 1), threat(29), threat(29, 1)] },

  { line: "146025:A:2", name: "its Threat X is the most characters one player controls", layout: { staging: ["146025"], play: ["ally"] }, act: [], expect: stat("146025", "threat", 3) },
  { line: "146025:A:2", name: "a player with fewer characters does not count", layout: { staging: ["146025"], seats: 2, play: [{ code: "ally", seat: 1 }] }, act: [], expect: stat("146025", "threat", 2) },

  { line: "146026:A:1", name: "while it is the active location the total Threat in the staging area is lowered by the Threat of each engaged enemy", layout: { active: "146026", staging: ["f3", "f3"], engaged: [{ code: "f3", seat: 0 }] }, act: [], expect: stagingThreat(3) },
  { line: "146026:A:1", name: "never below 0", layout: { active: "146026", staging: ["f3"], engaged: [{ code: "f3", seat: 0 }, { code: "f3", seat: 0 }] }, act: [], expect: stagingThreat(0) },
  { line: "146026:A:2", name: "Forced: after it becomes the active location each player chooses a non-unique enemy in the staging area and engages it", layout: { active: "146026", seats: 2, staging: ["f3", "f0", "treachery"] }, act: [announce("becameActive", "146026"), answer("f3")], expect: [zone("f3", "engaged"), zone("f0", "engaged")] },

  { line: "146027:A:1", name: "while it is the active location every ally has a blank text box", layout: { active: "146027", play: ["ally"] }, act: [], expect: flag("ally", "blankText") },

  { line: "146028:A:1", name: "Forced: when it leaves play the discard pile is shuffled into the encounter deck, cards are discarded until an enemy, and it engages the first player", layout: { staging: ["146028"], discard: ["treachery"], deck: ["f3", "f0"] }, act: announce("leftPlay", "146028"), expect: [zone("f3", "engaged")] },

  { line: "146029:A:1", name: "Forced: after it becomes the active location the first player places a non-unique enemy from the staging area facedown under it", layout: { active: "146029", staging: ["f3", "f0"] }, act: [announce("becameActive", "146029"), answer("f3")], expect: [zone("f3", "under")] },
  { line: "146029:A:2", name: "Forced: when it leaves play each enemy under it comes into play engaged with the first player", layout: { staging: ["146029"], under: [{ code: "f3", to: "146029" }] }, act: announce("leftPlay", "146029"), expect: zone("f3", "engaged") },

  { line: "146030:A:1", name: "while it is the active location each enemy and each location in the staging area is immune to player card effects", layout: { active: "146030", staging: ["f3", "place"] }, act: [], expect: [flag("f3", "immuneToPlayerCards"), flag("place", "immuneToPlayerCards")] },
  { line: "146030:A:2", name: "Forced: after it becomes the active location each engaged enemy returns to the staging area", layout: { active: "146030", engaged: [{ code: "f3", seat: 0 }] }, act: announce("becameActive", "146030"), expect: zone("f3", "staging") },

  { line: "146031:A:1", name: "it cannot leave the staging area", layout: { staging: [MOUTH] }, act: [], expect: flag(MOUTH, "cannotLeaveStaging") },
  { line: "146031:A:2", name: "Forced: after a player cancels a When Revealed effect it makes an immediate attack against that player", layout: { seats: 2, staging: [MOUTH], deck: ["f0", "f0", "f0"] }, act: [announce("whenRevealedCanceled", undefined, { seat: 1 }), endPhase], expect: attackersOf("dh3", [MOUTH]) },

  { line: "146032:A:2", name: "Forced: after it attacks the defending player raises their threat by 4", layout: { ...STAGE2, engaged: [{ code: "146032", seat: 0 }] }, act: [attack("146032", { undefended: true }), answer("threat")], expect: threat(32) },
  { line: "146032:A:2", name: "or returns it to the staging area (the refresh that follows adds 1)", layout: { ...STAGE2, engaged: [{ code: "146032", seat: 0 }] }, act: [attack("146032", { undefended: true }), answer("staging")], expect: [zone("146032", "staging"), threat(29)] },

  { line: "146033:A:2", name: "Forced: after it destroys a character the defending player discards a random card from their hand and raises their threat by its printed cost", layout: { ...STAGE2, engaged: [{ code: "146033", seat: 0 }], hand: ["c3"], play: [{ code: "ally" }] }, act: [attack("146033"), defend("ally")], expect: [zone("c3", "discard"), threat(31)] },

  { line: "146034:A:2", name: "When Revealed: the revealing player deals 1 damage to a character they control that is questing", layout: { committed: ["dh1"] }, act: reveal("146034"), expect: damageOn("dh1", 1) },
  { line: "146034:A:3", name: "Shadow: after the attack the attacking enemy engages the next player and attacks again", layout: { seats: 2, engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: "146034", undefended: true }), expect: [attackersOf("dh3", ["f3"]), zone("f3", "engaged")] },
  { line: "146035:A:3", name: "Shadow: the defending character cannot ready until the end of the round", layout: STAGE2, act: attack("f3", { shadow: "146035" }), expect: flag("dh1", "cannotReady") },
  { line: "146036:A:2", name: "When Revealed: it attaches to a Nazgûl enemy in play, which gets +2 Threat, +2 Attack and +2 Defense and is immune to player card effects", layout: { staging: ["146032"] }, act: reveal("146036"), expect: [stat("146032", "threat", 6), stat("146032", "attack", 8), stat("146032", "defense", 6), flag("146032", "immuneToPlayerCards")] },
  { line: "146036:A:2", name: "or searches the encounter deck for a Nazgûl enemy and adds it to the staging area", layout: { deck: ["146032"] }, act: reveal("146036"), expect: zone("146032", "staging") },

  { line: "146037:A:2", name: "When Revealed: each player raises their threat by 1 for each character they control (Doomed 1 adds 1)", layout: { play: ["ally"] }, act: [reveal("146037"), answer("threat")], expect: threat(32) },
  { line: "146037:A:2", name: "or discards the highest cost ally they control", layout: { play: ["ally"] }, act: [reveal("146037"), answer("ally")], expect: [zone("ally", "discard"), threat(29)] },
  { line: "146037:A:3", name: "Shadow: discard a non-objective attachment you control", layout: { ...STAGE2, attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "146037", undefended: true }), expect: zone("attachment", "discard") },

  { line: "146038:A:1", name: "When Revealed: each player assigns damage to their characters, X the resources on The Black Gate", layout: { staging: [{ code: GATE, resources: 2 }] }, act: [reveal("146038"), answer("dh1"), answer("dh1")], expect: damageOn("dh1", 2) },
  { line: "146038:A:2", name: "Shadow: +1 Attack for each resource on The Black Gate", layout: { ...STAGE2, staging: [{ code: GATE, resources: 2 }] }, act: attack("f3", { shadow: "146038", undefended: true }), expect: damageOn("dh1", 3) },

  { line: "146039:A:2", name: "When Revealed: The Mouth of Sauron attacks the revealing player, who raises their threat by 4 if it destroys a character", layout: { staging: [MOUTH], deck: ["f0", "f0"] }, act: [reveal("146039"), endPhase], expect: [attackersOf("dh1", [MOUTH]), threat(32)] },
  { line: "146039:A:3", name: "Shadow: +1 Attack", layout: STAGE2, act: attack("f3", { shadow: "146039", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "146039:A:3", name: "or +3 Attack instead when the attacker is The Mouth of Sauron", layout: { ...STAGE2, engaged: [{ code: MOUTH, seat: 0 }] }, act: [attack(MOUTH, { shadow: "146039" }), defend("dh2")], expect: zone("dh2", "discard") },

  { line: "146040:A:1", name: "When Revealed: each player deals 1 damage to a questing character; until the end of the phase each damaged character gets -1 Willpower", layout: { committed: ["dh1", "dh2"] }, act: [reveal("146040"), answer("dh1")], expect: [damageOn("dh1", 1), stat("dh1", "willpower", 1)] },
  { line: "146040:A:1", name: "and the damaged character cannot be healed until the end of the phase", layout: { committed: ["dh1", "dh2"] }, act: [reveal("146040"), answer("dh1")], expect: [classFlag("dh1", "cannotBeHealed")] },
  { line: "146040:A:2", name: "Shadow: the first player chooses a non-unique enemy in the staging area; it engages the defending player", layout: { ...STAGE2, staging: ["f3"], deck: ["f0", "f0"] }, act: attack("f0", { shadow: "146040", undefended: true }), expect: zone("f3", "engaged") },

  { line: "146041:A:2", name: "When Revealed: the first player takes control of Gwaihir", layout: { deck: ["146041"] }, act: reveal("146041"), expect: zone("146041", "play") },
  { line: "146041:A:3", name: "Shadow: the attack deals no damage", layout: STAGE2, act: attack("f3", { shadow: "146041", undefended: true }), expect: damageOn("dh1", 0) },

  { line: "146072:B:1", name: "When Revealed: the first player reveals the paired encounter card and plays the player card at no cost", layout: { stage: "146072", deckOf: ["c3", "c2", "ally", "c0"], deck: ["146032", "f3", "place", "f0"] }, act: [resolve("146072", "whenRevealed"), answer("play")], expect: [zone("ally", "play"), zone("place", "staging")] },
  { line: "146072:B:1", name: "or discards both cards of the pair", layout: { stage: "146072", deckOf: ["c3", "c2", "ally", "c0"], deck: ["146032", "f3", "place", "f0"] }, act: [resolve("146072", "whenRevealed"), answer("discard")], expect: [zone("ally", "discard"), zone("place", "encounterDiscard"), zone("c3", "discard"), zone("f3", "encounterDiscard")] },

  { line: "146073:A:1", name: "When Revealed: each player searches for a different Orc, Troll or Nazgûl enemy to add to the staging area, and Gwaihir is shuffled into the encounter deck", layout: { stage: "146073", setAside: ["146041"], deck: ["146033", "146058", "treachery"] }, act: [resolve("146073", "whenRevealed"), answer("146033")], expect: [zone("146033", "staging"), zone("146041", "encounterDeck")] },
  { line: "146073:B:1", name: "the first player reveals one encounter card for each resource on The Black Gate, read when the staging step begins", layout: { stage: "146073", phase: "Quest", staging: [{ code: GATE, resources: 2 }], deck: ["f0", "f0", "f0", "f0", "f0", "f0"] }, act: endPhase, expect: deckCount(4) },

  { line: "146073:B:2", name: "Forced: after the players quest unsuccessfully the active location is discarded", layout: { ...STAGE2, active: "place", staging: ["f3", "f3", "f3"] }, act: quest("fail"), expect: zone("place", "encounterDiscard") },
];

cardSpecs("the-black-gate-opens", ROWS);
