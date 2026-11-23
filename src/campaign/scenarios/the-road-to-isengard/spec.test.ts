// Rules: mec112.wizardry, mec112.peril, rr.explored, rr.forced, rr.reveal, rr.shadow-effects, rr.player-elimination, rr.lasting-effects, rr.first-player (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, defend, deckCount, exhausted, flag, handCount, progressOn, resolve, respond, reveal, revealedBy, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Road to Isengard (the-two-towers part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). What a row cannot hold is a titled test of
// lines.test.ts in this folder (the Wizardry shadow cards, the Staff, the elimination, Orthanc's order, the setup shuffle and the Palantír's attachment) or of verbs.test.ts (the new vocabulary). The wizardry family's own
// tests are src/rules/families/wizardry/index.test.ts and the deck family's src/rules/families/deck/pressure.test.ts. scripts/checks/spec-coverage.test.ts fails a line with neither a row nor a titled test.
const EXPLORED = { explored: true } as const;
const wizardry = (code: string) => announce("leftPlay", code, EXPLORED);
const STAGE_2 = { stage: "143079" } as const;
const STAGE_3 = { stage: "143080" } as const;

export const ROWS: readonly Row[] = [
  // 143047 Saruman, 143049 to 143052 the enemies.
  { line: "143047:A:1", name: "he cannot leave the staging area", layout: { staging: ["143047"] }, act: [], expect: flag("143047", "cannotLeaveStaging") },
  { line: "143049:A:2", name: "after he attacks he is shuffled into the encounter deck and the player he attacked reveals a card", layout: { engaged: ["143049"], deck: ["f0", "f3"] }, act: announce("attackResolved", "143049", { seat: 0 }), expect: [zone("143049", "encounterDeck"), revealedBy("f0", 0)] },
  { line: "143049:A:3", name: "Shadow: the attack is treated as undefended: its damage goes on a hero", layout: STAGE_2, act: attack("f3", { shadow: "143049" }), expect: damageOn("dh1", 1) },
  { line: "143050:A:1", name: "after it destroys a character its controller discards a card at random", layout: { ...STAGE_2, play: ["ally"], hand: ["filler", "filler"] }, act: [attack("143050"), defend("ally")], expect: handCount(1) },
  { line: "143051:A:2", name: "When Revealed: the first option discards a card at random from the revealing player's hand", layout: { hand: ["filler", "filler"], deck: ["f0"] }, act: [reveal("143051"), answer("discard")], expect: [handCount(1), deckCount(1)] },
  { line: "143051:A:2", name: "the second option reveals another card", layout: { hand: ["filler", "filler"], deck: ["f0"] }, act: [reveal("143051"), answer("reveal")], expect: [handCount(2), zone("f0", "staging")] },
  { line: "143051:A:2", name: "with an empty hand the discard is not offered: the card is revealed", layout: { deck: ["f0"] }, act: reveal("143051"), expect: zone("f0", "staging") },
  { line: "143051:A:3", name: "Shadow: the attacking enemy gets +2 Defense until the end of the round", layout: STAGE_2, act: attack("f3", { shadow: "143051", undefended: true }), expect: stat("f3", "defense", 3) },
  { line: "143052:A:2", name: "Shadow: 1 damage to the defending character", layout: STAGE_2, act: [attack("f3", { shadow: "143052" }), defend("dh2")], expect: damageOn("dh2", 1) },

  // 143054 Gates of Isengard, 143055 to 143059 the locations.
  { line: "143054:A:2", name: "explored: each player searches the encounter deck for an enemy and is engaged with it", layout: { active: "143054", seats: 2, deck: ["place", "f0", "f3"] }, act: wizardry("143054"), expect: [zone("f0", "engaged"), zone("f3", "engaged")] },
  { line: "143054:A:2", name: "the search covers the encounter discard pile", layout: { active: "143054", discard: ["f3"], deck: ["place"] }, act: wizardry("143054"), expect: zone("f3", "engaged") },
  { line: "143055:A:1", name: "after a character is healed its controller discards a card of their choice", layout: { staging: ["143055"], seats: 2, play: [{ code: "ally", seat: 1 }], hand: ["filler", { code: "filler", seat: 0 }, { code: "filler", seat: 1 }] }, act: announce("healed", "ally", { seat: 1 }), expect: [handCount(2, 0), handCount(1, 1)] },
  { line: "143055:A:2", name: "Wizardry, explored: each player discards a card at random from their hand", layout: { staging: ["143055"], seats: 2, hand: ["filler", "filler"] }, act: wizardry("143055"), expect: [handCount(1, 0), handCount(1, 1)] },
  { line: "143056:A:1", name: "an enemy engaged with a player is dealt a shadow card while it is in the staging area", layout: { staging: ["143056"], engaged: ["f3"], deck: ["f0", "f0"] }, act: announce("engaged", "f3", { seat: 0 }), expect: deckCount(1) },
  { line: "143056:A:2", name: "Wizardry, explored: each player exhausts a ready character they control", layout: { staging: ["143056"], seats: 2 }, act: wizardry("143056"), expect: [exhausted("dh1"), exhausted("dh3")] },
  { line: "143057:A:1", name: "after the players commit, a questing character they control takes 1 damage", layout: { staging: ["143057"], committed: ["dh1"] }, act: announce("commitmentMade", undefined, { seat: 0 }), expect: damageOn("dh1", 1) },
  { line: "143057:A:2", name: "Wizardry, explored: damage equal to the players plus 1 is assigned among characters", layout: { staging: ["143057"] }, act: wizardry("143057"), expect: damageOn("dh1", 2) },
  { line: "143058:A:1", name: "its Threat is the number of players: 1", layout: { staging: ["143058"] }, act: [], expect: stat("143058", "threat", 1) },
  { line: "143058:A:1", name: "its Threat is 2 with two players", layout: { staging: ["143058"], seats: 2 }, act: [], expect: stat("143058", "threat", 2) },
  { line: "143058:A:3", name: "Wizardry, explored: each player discards an ally they control", layout: { staging: ["143058"], play: ["ally"] }, act: wizardry("143058"), expect: zone("ally", "discard") },
  { line: "143059:A:1", name: "after a player draws cards with a player card's effect their threat rises by 2", layout: { staging: ["143059"] }, act: announce("cardsDrawn", undefined, { seat: 0, byPlayerCard: true }), expect: threat(30) },
  { line: "143059:A:2", name: "Wizardry, explored: each player raises their threat by 2", layout: { staging: ["143059"], seats: 2 }, act: wizardry("143059"), expect: [threat(30, 0), threat(30, 1)] },

  // 143060 to 143062 the treacheries.
  { line: "143060:A:1", name: "When Revealed: 1 more damage than there are players is assigned among the committed characters", layout: { committed: ["dh1"] }, act: reveal("143060"), expect: damageOn("dh1", 2) },
  { line: "143060:A:2", name: "Shadow: +1 Attack, and +2 instead when the defending player has 1 or fewer cards in hand", layout: { ...STAGE_2, hand: ["filler"] }, act: attack("f3", { shadow: "143060", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "143060:A:2", name: "with 2 cards in hand it is +1 Attack only", layout: { ...STAGE_2, hand: ["filler", "filler"] }, act: attack("f3", { shadow: "143060", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "143061:A:3", name: "Shadow: a non-objective attachment the defending player controls is discarded", layout: { ...STAGE_2, attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "143061", undefended: true }), expect: zone("attachment", "discard") },
  { line: "143062:A:1", name: "When Revealed: the Wizardry of the active location is triggered, without exploring it and with no surge", layout: { active: "143059", deck: ["f3"] }, act: reveal("143062"), expect: [threat(30), zone("143059", "activeLocation"), zone("f3", "encounterDeck")] },
  { line: "143062:A:1", name: "with no Wizardry on the active location it gains surge", layout: { active: "143054", deck: ["f3"] }, act: reveal("143062"), expect: zone("f3", "staging") },
  { line: "143062:A:2", name: "Shadow: +1 Attack, and when the attack destroys a character a card at random is discarded from the hand", layout: { ...STAGE_2, play: [{ code: "ally", damage: 1 }], hand: ["filler", "filler"] }, act: [attack("f3", { shadow: "143062" }), defend("ally")], expect: handCount(1) },

  // 143068 Saruman's Voice.
  { line: "143068:A:2", name: "When Revealed: a committed hero is removed from the quest and it attaches to him", layout: { committed: ["dh1"], deck: ["f0"] }, act: reveal("143068"), expect: zone("143068", "attached") },
  { line: "143068:A:2", name: "its hero's controller discards a card each time the hero commits", layout: { attached: [{ code: "143068", to: "dh1" }], hand: ["filler", "filler"] }, act: announce("committed", "dh1", { seat: 0 }), expect: handCount(1) },
  { line: "143068:A:2", name: "each time the hero is declared as an attacker", layout: { attached: [{ code: "143068", to: "dh1" }], hand: ["filler", "filler"] }, act: announce("declaredAttacker", "dh1", { seat: 0 }), expect: handCount(1) },
  { line: "143068:A:2", name: "each time the hero is declared as a defender", layout: { attached: [{ code: "143068", to: "dh1" }], hand: ["filler", "filler"] }, act: announce("declaredDefender", "dh1", { seat: 0 }), expect: handCount(1) },
  { line: "143068:A:2", name: "each time the hero triggers its ability", layout: { attached: [{ code: "143068", to: "dh1" }], hand: ["filler", "filler"] }, act: announce("abilityTriggered", "dh1", { seat: 0 }), expect: handCount(1) },

  // 143078 to 143080 the quest.
  { line: "143079:A:1", name: "When Revealed: Gates of Isengard is the active location, Saruman and Orthanc join the staging area", layout: { ...STAGE_2, setAside: ["143054", "143047", "143053"] }, act: resolve("143079", "whenRevealed"), expect: [zone("143054", "activeLocation"), zone("143047", "staging"), zone("143053", "staging")] },
  { line: "143079:B:3", name: "an Ent exhausts to place 2 progress on a non-unique location", layout: { ...STAGE_2, staging: ["143059"], play: ["143046"] }, act: respond("143079"), expect: [progressOn("143059", 2), exhausted("143046")] },
  { line: "143080:A:1", name: "When Revealed: each player draws 6 cards and discards down to 6, and the Staff is attached to Saruman", layout: { ...STAGE_3, staging: ["143047"], setAside: ["143048"], deckOf: ["filler", "filler", "filler", "filler", "filler", "filler", "filler", "filler"], hand: ["filler", "filler"] }, act: resolve("143080", "whenRevealed"), expect: [handCount(6), zone("143048", "play")] },
  ];

if (ROWS.length > 0) cardSpecs("the-road-to-isengard", ROWS);
else describe("the-road-to-isengard card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
