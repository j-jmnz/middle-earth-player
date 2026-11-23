// Rules: rr.reveal, rr.staging, rr.damage, rr.ranged, rr.running-out-of-cards, dwd.book-of-mazarbul, dwd.revealing-enemies (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, deckCount, defend, endRound, exhausted, flag, notWon, resolve, resourcesOn, reveal, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Seventh Level (dwarrowdelf part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
const ROWS: readonly Row[] = [
  // 03020 Cave-troll in a real attack: its excess is read before the damage lands (the ally defending 2 hit points takes 5: 3 excess), each point is the defending player's choice among his other characters and goes on after a kill.
  { line: "03020:A:1", name: "each excess point of its attack is 1 damage the defending player puts on another character, the defender excluded", layout: { play: ["ally"] }, act: [attack("03020"), defend("ally"), answer("dh2"), answer("dh1"), answer("dh1")], expect: [zone("ally", "discard"), damageOn("dh2", 1), damageOn("dh1", 2)] },
  { line: "03020:A:1", name: "a point that kills an ally does not stop the next, which goes on another character", layout: { play: ["ally", "ally"] }, act: [attack("03020"), defend("ally"), answer("ally"), answer("ally"), answer("dh1")], expect: [damageOn("dh1", 1)] },
  { line: "03020:A:1", name: "damage a shadow effect deals is not excess: the shadow's 3 and the attack's 4 beyond the 3 hit points left count 1", layout: { engaged: [{ code: "03020", seat: 0, resources: 3 }] }, act: [attack("03020", { shadow: "901105" }), defend("dh1")], expect: [damageOn("dh2", 1)] },

  // 03021 Orc Horn Blower: the revealed card is revealed in full and joins the staging area (Surge reveals one more).
  { line: "03021:A:2", name: "Orc Horn Blower reveals 1 card from the encounter deck and adds it to the staging area", layout: { deck: ["f3", "f0", "f0"] }, act: reveal("03021"), expect: [zone("f3", "staging"), deckCount(1)] },

  // 03022 Hidden Threat: every player raises threat by the enemies in the staging area, then the last player discards an attachment he controls (the Book is not an attachment).
  { line: "03022:A:1", name: "each player raises threat by the enemies in the staging area and the last player discards an attachment", layout: { seats: 2, staging: ["f0", "f3"], attached: [{ code: "attachment", to: "dh1" }] }, act: reveal("03022"), expect: [threat(30, 0), threat(30, 1)] },
  { line: "03022:A:1", name: "with no enemy in the staging area the last player still discards an attachment", layout: { staging: ["place"], attached: [{ code: "attachment", to: "dh1" }] }, act: reveal("03022"), expect: [threat(28), zone("attachment", "discard")] },
  { line: "03022:A:1", name: "the last player of a solo game discards the attachment and keeps Book of Mazarbul", layout: { staging: ["f0"], attached: [{ code: "attachment", to: "dh2" }, { code: "03024", to: "dh1" }] }, act: reveal("03022"), expect: [zone("attachment", "discard"), zone("03024", "play"), threat(29)] },

  // 03024 Book of Mazarbul: another hero claims it from the hero holding it; the attached hero cannot attack and does not exhaust to commit.
  { line: "03024:A:2", name: "a ready hero exhausts to claim the Book from another hero's attachment, which moves it", layout: { staging: ["03024"] }, act: [resolve("03024", "action"), answer("dh1"), resolve("03024", "action")], expect: [zone("03024", "attached"), exhausted("dh1"), exhausted("dh2")] },
  { line: "03024:A:3", name: "the attached hero cannot attack and does not exhaust to commit", layout: { attached: [{ code: "03024", to: "dh1" }] }, act: [], expect: [flag("dh1", "cannotAttack"), flag("dh1", "noExhaustQuest")] },

  // 03030 Chieftain of the Pit.
  { line: "03030:A:1", name: "Chieftain of the Pit gets +3 Attack when revealed", layout: { deck: ["f0"] }, act: reveal("03030"), expect: [stat("03030", "attack", 8)] },
  { line: "03030:A:2", name: "its Shadow makes the attacking enemy attack again once this attack ends", layout: { deck: ["f0", "f0"] }, act: attack("f0", { shadow: "03030", undefended: true }), expect: attackersOf("dh1", ["f0", "f0"]) },

  // 03031 Goblin Spearman prints Goblin Swordsman's lines: +2 Attack only on its own undefended attack; its Shadow adds it to the staging area.
  { line: "03031:A:1", name: "its own undefended attack is made with +2 Attack", layout: {}, act: attack("03031", { undefended: true }), expect: [damageOn("dh1", 4)] },
  { line: "03031:A:2", name: "its Shadow adds it to the staging area", layout: {}, act: [attack("f0", { shadow: "03031" }), defend("dh1")], expect: [zone("03031", "staging")] },

  // 03032 Goblin Archer.
  { line: "03032:A:1", name: "players cannot optionally engage it", layout: { staging: ["03032"] }, act: [], expect: flag("03032", "cannotBeOptionallyEngaged") },
  { line: "03032:A:2", name: "characters with ranged may attack it in the staging area", layout: { staging: ["03032"] }, act: [], expect: flag("03032", "attackableByRanged") },
  { line: "03032:A:3", name: "the first player's character takes the damage when another seat's card is the one revealed", layout: { seats: 2, firstPlayer: 1, deck: ["f0"] }, act: reveal("03032"), expect: [damageOn("dh3", 1), damageOn("dh1", 0)] },

  // 03033 Undisturbed Bones.
  { line: "03033:A:1", name: "each player puts as much damage as the allies he controls on 1 of them", layout: { play: ["ally"] }, act: reveal("03033"), expect: [damageOn("ally", 1)] },
  { line: "03033:A:1", name: "with 2 allies one takes 2 damage and is destroyed", layout: { play: ["ally", "ally"] }, act: reveal("03033"), expect: [zone("ally", "discard")] },
  { line: "03033:A:2", name: "Shadow: the defending ally is discarded from play", layout: { play: ["ally"] }, act: [attack("f0", { shadow: "03033" }), defend("ally")], expect: [zone("ally", "discard")] },

  // 03034 Plundered Armoury: +1 Attack for each enemy in play while it is in the staging area, not as the active location.
  { line: "03034:A:1", name: "enemies get +1 Attack while it is in the staging area", layout: { staging: ["03034", "f0"] }, act: [], expect: stat("f0", "attack", 2) },

  // 03067 Search for the Chamber and 03068 The Fate of Balin.
  { line: "03067:B:1", name: "1 encounter card per player is revealed and added to the staging area", layout: { stage: "03067", seats: 2, deck: ["f0", "f3", "f0"] }, act: resolve("03067", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(1)] },
  { line: "03068:B:2", name: "at the end of the staging step each enemy of the top X cards is added to the staging area and the other cards are discarded unresolved", layout: { stage: "03068", seats: 2, deck: ["treachery", "f3", "f0"] }, act: announce("stagingStepEnds"), expect: [zone("treachery", "encounterDiscard"), zone("f3", "staging"), deckCount(1)] },

  // The Nightmare deck. A layout spawns the quest stages first, so stage 2B (03068) is instance i2 and the event names it as the stage reveal does.
  { line: "901101:A:2", name: "Overseer Maurûl and Chamber of Records are set aside from the encounter deck", layout: { nightmare: "901101", deck: ["901102", "901103", "f0"] }, act: resolve("901101", "setup"), expect: [zone("901102", "setAside"), zone("901103", "setAside")] },
  { line: "901101:A:3", name: "when stage 2B is revealed the Chamber becomes the active location, Maurûl joins the staging area and every Balin's Doom is shuffled back", layout: { nightmare: "901101", stage: "03067", setAside: ["901102", "901103"], discard: ["901109", "901109"], deck: ["f0"] }, act: announce("stageRevealed", undefined, { subject: "i2" }), expect: [zone("901103", "activeLocation"), zone("901102", "staging"), deckCount(3)] },
  { line: "901101:A:3", name: "with no Balin's Doom in the discard pile the deck is shuffled just the same", layout: { nightmare: "901101", stage: "03067", setAside: ["901102", "901103"], discard: ["f0"], deck: ["f3", "f0"] }, act: announce("stageRevealed", undefined, { subject: "i2" }), expect: [zone("901103", "activeLocation"), deckCount(2), zone("f0", "encounterDiscard")] },
  { line: "901102:A:1", name: "Overseer Maurûl gets +X Threat, Attack and Defense, X the most resources on a Goblin enemy", layout: { staging: ["901102", { code: "03031", resources: 2 }, { code: "03030", resources: 1 }] }, act: [], expect: [stat("901102", "threat", 5), stat("901102", "attack", 5), stat("901102", "defense", 5)] },
  { line: "901102:A:2", name: "the players cannot win while Maurûl is not in the victory display", layout: { stage: "03068", progress: 17, staging: ["901102"] }, act: endRound, expect: [notWon, zone("03068", "questStage")] },
  { line: "901103:A:2", name: "each Goblin enemy with a resource is immune to player events", layout: { active: "901103", staging: [{ code: "03031", resources: 1 }, "03030"] }, act: [], expect: [flag("03031", "immuneToPlayerEvents"), flag("03030", "immuneToPlayerEvents", false)] },
  { line: "901103:A:3", name: "a Goblin that engages a player gets 2 resources", layout: { active: "901103", staging: ["03031"] }, act: announce("engaged", "03031"), expect: resourcesOn("03031", 2) },
  { line: "901104:A:1", name: "Orc Taskmaster adds 1 resource to each Goblin enemy in play", layout: { staging: ["03031"], engaged: [{ code: "03030", seat: 0 }], deck: ["f0"] }, act: reveal("901104"), expect: [resourcesOn("03031", 1), resourcesOn("03030", 1)] },
  { line: "901105:A:2", name: "its Shadow deals X damage to the defending character, X the resources on the attacker", layout: { engaged: [{ code: "03031", seat: 0, resources: 2 }] }, act: [attack("03031", { shadow: "901105" }), defend("dh1")], expect: [damageOn("dh1", 2)] },
  { line: "901106:A:1", name: "Pit Goblin gets 2 resources when revealed", layout: { deck: ["f0"] }, act: reveal("901106"), expect: resourcesOn("901106", 2) },
  { line: "901106:A:2", name: "its Shadow gives a Goblin attacker 1 resource", layout: {}, act: [attack("03031", { shadow: "901106" }), defend("dh1")], expect: resourcesOn("03031", 1) },
  { line: "901107:A:2", name: "Deep-Mines' Shadow gives the attacker +1 Attack and a Goblin another shadow card", layout: { deck: ["f0", "f0", "f0"] }, act: [attack("03031", { shadow: "901107" }), defend("dh1")], expect: [damageOn("dh1", 1)] },
  { line: "901108:A:1", name: "each Goblin gets +1 Threat for each resource on it, once however many Western Halls are in play", layout: { staging: ["901108", "901108", { code: "03031", resources: 2 }] }, act: [], expect: stat("03031", "threat", 4) },
  { line: "901108:A:2", name: "Western Hall adds 1 resource to each Goblin enemy when traveled to", layout: { phase: "Travel", staging: ["901108", "03031"] }, act: travel("901108"), expect: resourcesOn("03031", 1) },
  { line: "901109:A:2", name: "Balin's Doom adds 1 resource to each Goblin enemy when revealed", layout: { staging: ["03031"], deck: ["f0"] }, act: reveal("901109"), expect: resourcesOn("03031", 1) },
  { line: "901109:A:3", name: "its Shadow gives a Goblin attacker 1 resource", layout: {}, act: [attack("03031", { shadow: "901109" }), defend("dh1")], expect: resourcesOn("03031", 1) },
  { line: "901110:A:1", name: "Beats and Echoes reveals 2 cards plus 1 for each player with no Goblin engaged, enemies to the staging area", layout: { deck: ["f0", "treachery", "f3", "f3"] }, act: reveal("901110"), expect: [zone("f0", "staging"), zone("treachery", "encounterDiscard")] },
  { line: "03032:A:3", name: "an enemy revealed from the encounter deck, Goblin Archer itself included, has the first player damage a character he controls", layout: { deck: ["f0"] }, act: reveal("03032"), expect: [damageOn("dh1", 1)] },
  { line: "03067:A:1", name: "the Book is attached to a hero of the first player's choice at Setup", layout: { stage: "03067", deck: ["03024", "f0"] }, act: resolve("03067", "setup"), expect: [zone("03024", "attached")] },
  { line: "03024:A:2", name: "a hero exhausts to claim the Book from the staging area", layout: { staging: ["03024"] }, act: resolve("03024", "action"), expect: [zone("03024", "attached")] },
  { line: "03068:B:1", name: "the Book leaves the game from the staging area", layout: { stage: "03068", staging: ["03024"] }, act: resolve("03068", "whenRevealed"), expect: [zone("03024", "removed")] },
  { line: "901107:A:1", name: "a Goblin revealed while Deep-Mines is in the staging area gets 1 resource", layout: { staging: ["901107"], deck: ["f0"] }, act: reveal("03031"), expect: [resourcesOn("03031", 1)] },
  { line: "901105:A:1", name: "Goblin Skirmisher gives +1 Attack for each resource once however many copies are in play", layout: { staging: ["901105", "901105", { code: "03031", resources: 2 }] }, act: [], expect: [stat("03031", "attack", 4)] },
];

if (ROWS.length > 0) cardSpecs("the-seventh-level", ROWS);
else describe("the-seventh-level card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
