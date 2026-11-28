// Rules: rr.forced, rr.shadow-effects, rr.reveal, rr.engaged, rr.travel, rr.victory, rr.cannot, rr.damage, rr.immune, rr.attachment-cards, rr.active-location, rr.threat-elimination-level, rr.lasting-effects, vom.quest-stages-vs-side-quests (data/rules/entries.json).
import { announce, answer, attack, cardSpecs, damageOn, defend, flag, handCount, offers, reveal, stagingThreat, stat, threat, window, zone, type Row } from "../../../../test/harness/card-spec.ts";
// Card specs for The Temple of Doom (vengeance-of-mordor part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot express (a tally over a round, the Power of Mordor deck, the cards under the dials, the Setup, the stages in the victory display, two attacks) is a test titled with its line id in lines.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; a layout's current stage is on its B side.
const S1 = "21080";
const LEGACY = "21081";
const MEMORY = "21083";
const SHRINE = "21084";
const LORD = "21085";
const TRIBUTE = "21053";
const ULCHOR = "21054";
const SAURON = "21055";
const HORRORS = "21056";
const EVIL = "21057";
const GUARD = "21058";
const RAGE = "21059";
const FANATICISM = "21060";
const TUNNEL = "21061";
const NARROW = "21062";
const CRUMBLING = "21063";
const SHADOWS = "21064";
const TOWER = "21067";
const EYE = "21068";
const DARKNESS = "21070";
const RAIDER = "21020";
// The scenario's quest stages stand in for the stages in the victory display (a side quest in it does not count); the current stage of a row is never one of them.
const STAGES = (n: number, current = S1): readonly string[] => [S1, LEGACY, MEMORY, SHRINE, LORD].filter((code) => code !== current).slice(0, n);

const ROWS: readonly Row[] = [
  { line: "21054:A:2", name: "X is 1 more than the quest stages in the victory display; with 3 stages he cannot be engaged", layout: { staging: [ULCHOR], victory: STAGES(3) }, act: [], expect: flag(ULCHOR, "cannotBeEngaged") },
  { line: "21054:A:2", name: "A side quest in the victory display is not a quest stage: 3 stages and a side quest, he cannot be engaged", layout: { staging: [ULCHOR], victory: [...STAGES(3), TRIBUTE] }, act: [], expect: flag(ULCHOR, "cannotBeEngaged") },
  { line: "21054:A:3", name: "Forced: when he attacks and destroys a hero, 1 damage token on Tribute to Mordor", layout: { stage: LEGACY, staging: [TRIBUTE], engaged: [ULCHOR] }, act: attack(ULCHOR, { undefended: true }), expect: damageOn(TRIBUTE, 1) },
  { line: "21054:A:3", name: "Forced: for each character he destroys, here an ally", layout: { stage: LEGACY, staging: [TRIBUTE], engaged: [ULCHOR], play: ["ally"] }, act: [attack(ULCHOR), defend("ally")], expect: damageOn(TRIBUTE, 1) },

  { line: "21055:A:1", name: "Forced: when Temple of Sauron leaves play, 1 damage token on Tribute to Mordor", layout: { stage: LEGACY, staging: [TRIBUTE, SAURON] }, act: announce("leftPlay", SAURON), expect: damageOn(TRIBUTE, 1) },
  { line: "21055:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each quest stage in the victory display", layout: { stage: LEGACY, engaged: ["f3"], victory: STAGES(2, LEGACY) }, act: attack("f3", { shadow: SAURON, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "21056:A:1", name: "Forced: when it leaves play each player deals X damage to a character he controls (X is 1 more than the stages)", layout: { stage: LEGACY, staging: [HORRORS], victory: STAGES(2, LEGACY) }, act: [announce("leftPlay", HORRORS), answer("dh1")], expect: damageOn("dh1", 3) },
  { line: "21056:A:2", name: "Forced: with no stage in the victory display X is 1", layout: { stage: LEGACY, staging: [HORRORS] }, act: [announce("leftPlay", HORRORS), answer("dh1")], expect: damageOn("dh1", 1) },

  { line: "21057:A:1", name: "When Revealed: 1 damage token on Tribute to Mordor, then the first player places 1 more", layout: { stage: LEGACY, staging: [TRIBUTE], deck: ["f0", "f3"] }, act: [reveal(EVIL), answer("damage")], expect: [damageOn(TRIBUTE, 2), zone("f0", "encounterDeck")] },
  { line: "21057:A:1", name: "When Revealed: or the first player has Place of Evil gain surge, and the next card is revealed", layout: { stage: LEGACY, staging: [TRIBUTE], deck: ["f0", "f3"] }, act: [reveal(EVIL), answer("surge")], expect: [damageOn(TRIBUTE, 1), zone("f0", "staging")] },
  { line: "21057:A:1", name: "When Revealed: with Tribute to Mordor out of play the choice is still offered and surge still works", layout: { stage: LEGACY, deck: ["f0", "f3"] }, act: [reveal(EVIL), answer("surge")], expect: zone("f0", "staging") },
  { line: "21057:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { stage: LEGACY, staging: [TRIBUTE], engaged: ["f3"] }, act: attack("f3", { shadow: EVIL, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "21057:A:2", name: "Shadow: if the attack destroys a character, 1 damage token on Tribute to Mordor", layout: { stage: LEGACY, staging: [TRIBUTE], engaged: [ULCHOR] }, act: attack(ULCHOR, { shadow: EVIL, undefended: true }), expect: damageOn(TRIBUTE, 2) },

  { line: "21058:A:2", name: "Shadow: the attacking enemy gets +2 Defense until the end of the phase", layout: { stage: LEGACY, engaged: ["f3"] }, act: attack("f3", { shadow: GUARD, undefended: true }), expect: stat("f3", "defense", 3) },

  { line: "21059:A:1", name: "When Revealed: Thane Ulchor in the staging area makes an immediate attack against the first player", layout: { stage: LEGACY, staging: [ULCHOR] }, act: reveal(RAGE), expect: window("defense") },
  { line: "21059:A:1", name: "When Revealed: Thane Ulchor engaged with the first player attacks him", layout: { stage: LEGACY, engaged: [ULCHOR] }, act: reveal(RAGE), expect: window("defense") },
  { line: "21059:A:1", name: "When Revealed: with no attack made it gains surge", layout: { stage: LEGACY, staging: ["f3"], deck: ["f0", "f1"] }, act: reveal(RAGE), expect: [window("defense", false), zone("f0", "staging")] },
  { line: "21059:A:2", name: "Shadow: 1 damage to the defending character", layout: { stage: LEGACY, engaged: ["f3"], play: ["ally"] }, act: [attack("f3", { shadow: RAGE }), defend("ally")], expect: damageOn("ally", 1) },

  { line: "21060:A:1", name: "While attached to an enemy it counts as a Condition attachment: the enemy gets +1 Threat, +1 Attack and +1 Defense", layout: { stage: LEGACY, staging: [RAIDER], attached: [{ code: FANATICISM, to: RAIDER }] }, act: [], expect: [stat(RAIDER, "threat", 3), stat(RAIDER, "attack", 3), stat(RAIDER, "defense", 3), flag(RAIDER, "immuneToPlayerCards")] },
  { line: "21060:A:2", name: "When Revealed: attach to the Easterling enemy with the lowest Defense", layout: { stage: LEGACY, staging: [RAIDER, "21058"] }, act: reveal(FANATICISM), expect: [{ expect: "attachedTo", code: FANATICISM, host: "21058" }] },
  { line: "21060:A:2", name: "When Revealed: with no Easterling enemy it gains surge", layout: { stage: LEGACY, staging: ["f3"], deck: ["f0"] }, act: reveal(FANATICISM), expect: zone("f0", "staging") },

  { line: "21061:A:1", name: "When Revealed: discard from the top until an enemy, and add that enemy to the staging area", layout: { stage: LEGACY, deck: ["treachery", "f3", "f0"] }, act: reveal(TUNNEL), expect: [zone("f3", "staging"), zone("treachery", "encounterDiscard")] },
  { line: "21061:A:2", name: "Shadow: the top card is discarded and an enemy is added to the staging area", layout: { stage: LEGACY, engaged: ["f0"], deck: ["f3", "treachery"] }, act: attack("f0", { shadow: TUNNEL, undefended: true }), expect: zone("f3", "staging") },
  { line: "21061:A:2", name: "Shadow: a card that is not an enemy is only discarded", layout: { stage: LEGACY, engaged: ["f0"], deck: ["treachery", "f3"] }, act: attack("f0", { shadow: TUNNEL, undefended: true }), expect: [zone("treachery", "encounterDiscard"), zone("f3", "encounterDeck")] },

  { line: "21062:A:2", name: "Forced: when it leaves play each player discards 1 random card from his hand", layout: { stage: LEGACY, staging: [NARROW], hand: ["ally", "ally", "event"] }, act: announce("leftPlay", NARROW), expect: handCount(2) },

  { line: "21063:A:1", name: "When Revealed: it becomes the active location and the previous one returns to the staging area", layout: { stage: LEGACY, active: "place" }, act: reveal(CRUMBLING), expect: [zone(CRUMBLING, "activeLocation"), zone("place", "staging")] },
  { line: "21063:A:2", name: "Forced: when it leaves play, 1 damage to each exhausted character", layout: { stage: LEGACY, staging: [CRUMBLING], exhaustedCards: ["dh1"] }, act: announce("leftPlay", CRUMBLING), expect: [damageOn("dh1", 1), damageOn("dh2", 0)] },

  { line: "21064:A:2", name: "When Revealed: until the end of the round each character's text box is blank", layout: { stage: LEGACY, play: ["ally"] }, act: reveal(SHADOWS), expect: [{ expect: "classFlag", code: "ally", name: "blankText", value: true }, { expect: "classFlag", code: "dh1", name: "blankText", value: true }] },
  { line: "21064:A:3", name: "Shadow: the defending character cannot ready until the end of the round", layout: { stage: LEGACY, engaged: ["f3"], play: ["ally"] }, act: [attack("f3", { shadow: SHADOWS }), defend("ally")], expect: flag("ally", "cannotReady") },

  { line: "21067:A:2", name: "The players cannot travel here", layout: { stage: LEGACY, phase: "Travel", staging: [TOWER] }, act: [], expect: offers("Travel", undefined, false) },

  { line: "21068:A:1", name: "When Revealed: a player with more than 5 cards in hand discards down to 5", layout: { stage: LEGACY, hand: ["ally", "ally", "event", "event", "ally", "event", "ally"] }, act: [reveal(EYE), answer("ally")], expect: handCount(5) },
  { line: "21068:A:2", name: "Forced: after a player draws any number of cards he raises his threat by 1", layout: { stage: LEGACY, staging: [EYE], deckOf: ["ally", "ally"] }, act: announce("cardsDrawn", undefined, { seat: 0, amount: 2 }), expect: threat(29) },


  { line: "21080:B:1", name: "Skip the quest phase", layout: { stage: S1 }, act: [], expect: [flag("table", "skipQuestPhase")] },

  { line: "21081:A:1", name: "When Revealed: reveal 1 encounter card per player", layout: { stage: LEGACY, side: "A", seats: 2, deck: ["f3", "f0", "f1"] }, act: reveal(LEGACY), expect: [zone("f3", "staging"), zone("f0", "staging")] },
  { line: "21083:A:1", name: "When Revealed: reveal 1 encounter card per player", layout: { stage: MEMORY, side: "A", seats: 2, deck: ["f3", "f0", "f1"] }, act: reveal(MEMORY), expect: [zone("f3", "staging"), zone("f0", "staging")] },
  { line: "21084:A:1", name: "When Revealed: reveal 1 encounter card per player", layout: { stage: SHRINE, side: "A", seats: 2, deck: ["f3", "f0", "f1"] }, act: reveal(SHRINE), expect: [zone("f3", "staging"), zone("f0", "staging")] },
  { line: "21085:A:1", name: "When Revealed: reveal 1 encounter card per player", layout: { stage: LORD, side: "A", seats: 2, deck: ["f3", "f0", "f1"] }, act: reveal(LORD), expect: [zone("f3", "staging"), zone("f0", "staging")] },

  { line: "21081:B:2", name: "With 4 quest stages in the victory display no progress can be placed here", layout: { stage: LEGACY, victory: STAGES(4, LEGACY) }, act: [], expect: flag(LEGACY, "noProgressPlaced") },
  { line: "21083:B:2", name: "With 4 quest stages in the victory display no progress can be placed here", layout: { stage: MEMORY, victory: STAGES(4, MEMORY) }, act: [], expect: flag(MEMORY, "noProgressPlaced") },
  { line: "21084:B:2", name: "With 4 quest stages in the victory display no progress can be placed here", layout: { stage: SHRINE, victory: STAGES(4, SHRINE) }, act: [], expect: flag(SHRINE, "noProgressPlaced") },
  { line: "21085:B:3", name: "With 4 quest stages in the victory display no progress can be placed here", layout: { stage: LORD, victory: STAGES(4, LORD) }, act: [], expect: flag(LORD, "noProgressPlaced") },
  { line: "21085:B:1", name: "This stage gets +4 quest points per player", layout: { stage: LORD, seats: 2 }, act: [], expect: stat(LORD, "questPoints", 8) },
];

cardSpecs("the-temple-of-doom", ROWS);
