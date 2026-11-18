// Rules: dwd.durins-bane, rr.forced, rr.reveal, rr.shadow-effects, rr.attachment-cards, rr.cancel, rr.quest-phase, rr.active-location, rr.refresh-phase, rr.winning-the-game (data/rules/entries.json).
import { describe, it } from "vitest";

import {
  announce,
  endPhase,
  answer,
  attack,
  attackersOf,
  cardSpecs,
  count,
  damageOn,
  defend,
  exhausted,
  deckCount,
  flag,
  handCount,
  progressOn,
  quest,
  resolve,
  reveal,
  stat,
  threat,
  travel,
  won,
  zone,
  type Row,
} from "../../../../test/harness/card-spec.ts";

const ROWS: readonly Row[] = [
  // 04138 Nearing the Gate. B:1: each player's threat becomes 0, then one card fewer than the players are revealed. (A:1, the Setup, is a test in lines.test.ts.)
  { line: "04138:B:1", name: "two players: each threat becomes 0 and 1 card is revealed", layout: { seats: 2, threat: [30, 35], deck: ["f0", "f3", "f0"] }, act: resolve("04138", "whenRevealed"), expect: [threat(0), threat(0, 1), zone("f0", "staging"), zone("f3", "encounterDeck")] },
  { line: "04138:B:1", name: "one player: the threat becomes 0 and nothing is revealed", layout: { threat: [30, 30], deck: ["f0", "f3"] }, act: resolve("04138", "whenRevealed"), expect: [threat(0), zone("f0", "encounterDeck")] },

  // 04139 The Rear Guard. B:1: at the end of the quest phase, with a hero committed this round, 4 progress go on the stage. B:2 (lines.test.ts).
  { line: "04139:B:1", name: "a hero Inner Flame removed from the quest still counts as committed this round", layout: { stage: "04139", staging: ["f3", "04150"], deck: ["04146", "f0", "f0"] }, act: [quest("fail"), answer("remove"), answer("dh1")], expect: [progressOn("04139", 4), { expect: "committed", code: "dh1", value: false }] },
  { line: "04139:B:1", name: "a hero was committed this round: 4 progress go on the stage at the end of the quest phase", layout: { stage: "04139", staging: ["f3", "04150"] }, act: quest("fail"), expect: progressOn("04139", 4) },

  // 04140 Last Lord of Moria. B:1: Durin's Bane attacks the first player at once, whatever his threat, and Dark Pit joins the staging area. B:2: the players cannot win while Durin's Bane is in play; with it gone they have won.
  { line: "04140:B:1", name: "Durin's Bane attacks the first player whose threat is 0 and Dark Pit joins the staging area", layout: { stage: "04140", threat: [0, 0], staging: ["04150"], setAside: ["04141"], deck: ["f0", "f0", "f0"] }, act: [resolve("04140", "whenRevealed"), endPhase], expect: [attackersOf("dh1", ["04150"]), zone("04141", "staging"), deckCount(2)] },
  { line: "04140:B:2", name: "with Durin's Bane gone from play the players have won", layout: { stage: "04140", deck: ["f0", "f0"] }, act: [reveal("f0"), endPhase], expect: won },

  // 04141 Dark Pit. A:1: its Refresh Action exhausts X characters (0 to 3) to discard the top X cards of the deck; with their combined printed cost higher than the hit points Durin's Bane has left it is discarded from play.
  { line: "04141:A:1", name: "a combined cost above the remaining hit points discards Durin's Bane from play, and the players win", layout: { stage: "04140", active: "04141", phase: "Refresh", staging: [{ code: "04150", damage: 24 }], deckOf: ["c3", "c3", "c3"] }, act: [resolve("04141", "action"), answer("dh1"), answer("dh2")], expect: [zone("04150", "encounterDiscard"), count("c3", "discard", 2), won] },
  { line: "04141:A:1", name: "a combined cost that only equals the remaining hit points leaves it", layout: { stage: "04140", active: "04141", phase: "Refresh", staging: [{ code: "04150", damage: 21 }], deckOf: ["c3", "c3", "c3"] }, act: [resolve("04141", "action"), answer("dh1"), answer("dh2")], expect: [zone("04150", "staging"), count("c3", "discard", 2)] },
  { line: "04141:A:1", name: "three characters are the most it exhausts", layout: { stage: "04140", active: "04141", phase: "Refresh", staging: [{ code: "04150", damage: 0 }], play: ["ally"], deckOf: ["c3", "c3", "c3", "c3"] }, act: [resolve("04141", "action"), answer("dh1"), answer("dh2")], expect: count("c3", "discard", 3) },

  // 04142 Second Hall. While active: after any character leaves play, 1 card is revealed and added to the staging area. 04143 Second Deep: no progress on it while Durin's Bane has no damage.
  { line: "04142:A:1", name: "a character leaves play: 1 card is revealed and added to the staging area", layout: { active: "04142", phase: "Refresh", deck: ["f0", "f3"], play: ["ally"] }, act: [announce("leftPlay", "ally"), endPhase], expect: [zone("f0", "staging"), zone("f3", "encounterDeck")] },
  { line: "04142:A:1", name: "a hero of another player leaving play counts too", layout: { seats: 2, active: "04142", phase: "Refresh", deck: ["f0", "f3"] }, act: [announce("leftPlay", "dh3"), endPhase], expect: zone("f0", "staging") },
  { line: "04143:A:1", name: "while Durin's Bane has no damage no progress can be placed on it", layout: { active: "04143", staging: ["04150"] }, act: [], expect: flag("04143", "noProgressPlaced") },

  // 04144 Fires in the Deep. A:1: each player discards 1 ally he controls, if able; surge when none could be discarded. A:2 (Shadow): the defending player discards 1 ally, if able.
  { line: "04144:A:1", name: "a player with an ally discards it and the card has no surge", layout: { play: ["ally"], deck: ["f0", "f3"] }, act: reveal("04144"), expect: [zone("ally", "discard"), zone("f0", "encounterDeck")] },
  { line: "04144:A:1", name: "with no ally to discard the card gains surge", layout: { deck: ["f0", "f3"] }, act: reveal("04144"), expect: zone("f0", "staging") },
  { line: "04144:A:2", name: "Shadow: the defending player discards 1 ally he controls", layout: { play: ["ally"], engaged: [{ code: "f3", seat: 0 }] }, act: attack("f3", { shadow: "04144" }), expect: zone("ally", "discard") },

  // 04146 Inner Flame, 04147 Inner Shadow. The first player may remove a questing hero from the quest to cancel the effect.
  { line: "04146:A:1", name: "kept: Durin's Bane gets +3 Attack until the end of the round", layout: { staging: ["04150"], committed: ["dh1"] }, act: [reveal("04146"), answer("keep")], expect: stat("04150", "attack", 9) },
  { line: "04146:A:1", name: "the first player removes a questing hero from the quest and the +3 Attack is canceled", layout: { staging: ["04150"], committed: ["dh1"] }, act: [reveal("04146"), answer("remove")], expect: [stat("04150", "attack", 6), { expect: "committed", code: "dh1", value: false }] },
  { line: "04146:A:2", name: "Shadow: Durin's Bane gets +3 Attack", layout: { engaged: [{ code: "04150", seat: 0 }] }, act: attack("04150", { shadow: "04146", undefended: true }), expect: damageOn("dh1", 9) },
  { line: "04147:A:2", name: "kept: 5 damage are healed from Durin's Bane", layout: { staging: [{ code: "04150", damage: 7 }], committed: ["dh1"], deck: ["f0", "f0"] }, act: [reveal("04147"), answer("keep")], expect: damageOn("04150", 2) },

  // 04149 Leaping Flame. A:1: Durin's Bane attacks the first player at once, whatever his threat. A:2: the Shadow is Inner Flame's.
  { line: "04149:A:1", name: "Durin's Bane attacks the first player whose threat is 0", layout: { threat: [0, 0], staging: ["04150"], deck: ["f0", "f0", "f0"] }, act: [reveal("04149"), endPhase], expect: [attackersOf("dh1", ["04150"]), deckCount(2)] },
  { line: "04149:A:2", name: "Shadow: Durin's Bane gets +3 Attack", layout: { engaged: [{ code: "04150", seat: 0 }] }, act: attack("04150", { shadow: "04149", undefended: true }), expect: damageOn("dh1", 9) },

  // 04150 Durin's Bane. A:1: no player attachment is played on it. A:2: it cannot leave the staging area, cannot be engaged and is considered engaged with each player whose threat is 1 or greater.
  { line: "04150:A:1", name: "no player attachment is played on it", layout: { staging: ["04150"] }, act: [], expect: flag("04150", "noPlayerAttachments") },
  { line: "04150:A:2", name: "it cannot leave the staging area, cannot be engaged and is engaged with the players at threat 1 or more", layout: { staging: ["04150"] }, act: [], expect: [flag("04150", "cannotLeaveStaging"), flag("04150", "cannotBeEngaged"), flag("04150", "engagedWithThreatening")] },

  // 04151 Ranging Goblin. A:1: each player deals 1 damage to a hero he controls. A:2: after a character leaves play it and the top card of the encounter discard pile are shuffled into the encounter deck.
  { line: "04151:A:1", name: "each player deals 1 damage to a hero he controls", layout: { seats: 2 }, act: [reveal("04151"), answer("dh1")], expect: [damageOn("dh1", 1), damageOn("dh3", 1)] },
  { line: "04151:A:2", name: "after a character leaves play it and the top card of the encounter discard pile are shuffled into the encounter deck", layout: { staging: ["04151"], discard: ["f3"], deck: ["f0"], play: ["ally"] }, act: [announce("leftPlay", "ally"), endPhase], expect: [zone("04151", "encounterDeck"), zone("f3", "encounterDeck")] },

  // 04152 Fiery Sword, 04153 Many Thonged Whip: attached to Durin's Bane (Weapons: lines.test.ts). The Sword gives +3 Attack; the Whip discards a card at random from the defending player's hand when Durin's Bane attacks.
  { line: "04152:A:1", name: "the attached enemy gets +3 Attack", layout: { staging: ["04150"], attached: [{ code: "04152", to: "04150" }] }, act: [], expect: stat("04150", "attack", 9) },
  { line: "04153:A:1", name: "when Durin's Bane attacks the defending player discards 1 card at random from his hand", layout: { engaged: [{ code: "04150", seat: 0 }], attached: [{ code: "04153", to: "04150" }], hand: ["filler", "filler"] }, act: attack("04150", { undefended: true }), expect: handCount(1) },
  { line: "04148:A:1", name: "each player discards 1 attachment he controls", layout: { staging: ["04150"], attached: [{ code: "attachment", to: "dh1" }] }, act: [reveal("04145"), reveal("04148")], expect: zone("attachment", "discard") },
  { line: "04148:A:2", name: "Shadow: Durin's Bane makes the defending player discard every attachment he controls, never Counter-Spell", layout: { engaged: [{ code: "04150", seat: 0 }], attached: [{ code: "04145", to: "04150" }, { code: "attachment", to: "dh2" }] }, act: attack("04150", { shadow: "04148" }), expect: [zone("04145", "play"), zone("attachment", "discard")] },
  // 901801 to 901810, the Nightmare deck. 901801 A:2: the Attack cards form the Balrog deck at Setup. A:3: Durin's Bane is dealt its shadow cards from it. (A:4, the beginning-of-combat reshuffle, is a test in combat.test.ts; 901805 and 901810:A:1 are tests there and in lines.test.ts.)
  { line: "901801:A:2", name: "the encounter cards with the Attack trait form the Balrog deck at Setup", layout: { nightmare: "901801", deck: ["901802", "901803", "f0"] }, act: resolve("901801", "setup"), expect: [zone("901802", "balrogDeck"), zone("901803", "balrogDeck"), zone("f0", "encounterDeck")] },
  { line: "901801:A:3", name: "Durin's Bane is dealt its shadow cards from the Balrog deck", layout: { nightmare: "901801", staging: ["04150"] }, act: [], expect: flag("04150", "shadowsFromBalrog") },

  // 901802 Terrible Strength. Shadow: each point of excess combat damage damages another character the defending player controls and exhausts it.
  { line: "901802:A:1", name: "Shadow: each point of excess damage damages another character and exhausts it", layout: { play: ["ally"], engaged: [{ code: "04150", seat: 0 }] }, act: [attack("04150", { shadow: "901802" }), defend("ally"), answer("dh2"), answer("dh2"), answer("dh2")], expect: [zone("ally", "discard"), damageOn("dh2", 3), exhausted("dh2")] },

  // 901803 The Dark Fire. Shadow: for each point of damage dealt by this attack, 1 damage is healed from Durin's Bane.
  { line: "901803:A:1", name: "Shadow: the damage the attack dealt is healed from Durin's Bane", layout: { engaged: [{ code: "04150", seat: 0, damage: 10 }] }, act: attack("04150", { shadow: "901803", undefended: true }), expect: damageOn("04150", 4) },

  // 901804 Blazing Grip. Shadow, uncancelable: the defending character's attachments are discarded and it is dealt 1 damage; nothing happens when the attack is undefended.
  { line: "901804:A:1", name: "Shadow: the attachments of the defending character are discarded", layout: { engaged: [{ code: "f3", seat: 0 }], attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "901804" }), expect: [zone("attachment", "discard")] },

  // 901805 Morgoth's Bidding. Shadow: when this attack destroys a character, Durin's Bane makes an additional attack against the defending player.

  // 901806 Flame of Udûn. Shadow: Durin's Bane is dealt 3 additional shadow cards from the encounter deck.
  { line: "901806:A:1", name: "Shadow: 3 additional shadow cards come from the encounter deck", layout: { engaged: [{ code: "04150", seat: 0 }], deck: ["f0", "f0", "f0", "f0", "f0"] }, act: attack("04150", { shadow: "901806", undefended: true }), expect: deckCount(2) },

  // 901807 Servant of Flame. A:1: +2 Attack and +2 Defense while Durin's Bane has no damage. A:2 (Shadow): the defending player searches the encounter deck for a Shadow or Flame treachery and reveals it.
  { line: "901807:A:1", name: "+2 Attack and +2 Defense while Durin's Bane has no damage", layout: { staging: ["04150", "901807"] }, act: [], expect: [stat("901807", "attack", 5), stat("901807", "defense", 4)] },
  { line: "901807:A:2", name: "Shadow: a Shadow or Flame treachery is found in the encounter deck and revealed", layout: { staging: ["04150"], engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "04145", "f0"] }, act: [attack("f3", { shadow: "901807", undefended: true }), endPhase], expect: [zone("04145", "attached")] },

  // 901808 Captain of Mordor. A:1: each enemy gets -20 engagement cost. A:2 (Shadow): when this attack destroys a character the attacker cannot take damage until the end of the round.
  { line: "901808:A:1", name: "each enemy gets -20 engagement cost", layout: { staging: ["901808", "f3"] }, act: [], expect: stat("f3", "engagementCost", 30) },
  { line: "901808:A:2", name: "Shadow: a destroyed character makes the attacker unable to take damage this round", layout: { play: ["ally"], engaged: [{ code: "04150", seat: 0 }] }, act: [attack("04150", { shadow: "901808" }), defend("ally")], expect: [zone("ally", "discard"), flag("04150", "cannotTakeDamage")] },

  // 901809 Fiery Depths. A:1: no progress while it is in the staging area. A:2 (Travel): each player moves 1 damage from Durin's Bane to a hero.
  { line: "901809:A:1", name: "no progress can be placed on it in the staging area", layout: { staging: ["901809"] }, act: [], expect: flag("901809", "noProgressPlaced") },
  { line: "901809:A:2", name: "travelling moves 1 damage from Durin's Bane to a hero", layout: { phase: "Travel", staging: ["901809", { code: "04150", damage: 2 }] }, act: [travel("901809"), answer("dh1")], expect: [damageOn("04150", 1), damageOn("dh1", 1), zone("901809", "activeLocation")] },

  // 901810 Crumbling Stairs. A:1: each event costs 1 more to play while it is in the staging area. A:2 (Shadow): when this attack destroys a character the defending player discards the events in his hand.
  { line: "901810:A:2", name: "Shadow: a destroyed character makes the defending player discard the events in his hand", layout: { play: ["ally"], engaged: [{ code: "04150", seat: 0 }], hand: ["filler", "filler"] }, act: [attack("04150", { shadow: "901810" }), defend("ally")], expect: [zone("ally", "discard"), handCount(0)] },
];

if (ROWS.length > 0) cardSpecs("shadow-and-flame", ROWS);
else describe("shadow-and-flame card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
