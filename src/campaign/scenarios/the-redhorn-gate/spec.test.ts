// Rules: rr.reveal, rr.staging, rr.travel, rr.victory, rr.first-player, rr.shadow-effects, rr.defending-player, dwd.caradhras, dwd.ally-objective-arwen, faq.lasting-effects, faq.progress-without-advancing (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, committed, count, damageOn, deckCount, defend, drew, exhausted, flag, lost, offers, progressOn, quest, resolve, resourcesOn, respond, reveal, stat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Redhorn Gate (dwarrowdelf part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The mechanics that need several steps (Arwen's control, Snowstorm's later commits,
// the zero-Willpower discard, Freezing Cold's second copy, the 3B bar, Blinding Blizzard's fifth progress, Rocky Crags for each player, Icy Cavern's travel) are in lines.test.ts. The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense.
const ROWS: readonly Row[] = [
  // 03054 Black Uruks: the first player discards an attachment on a questing character; an undefended attack makes its Shadow deal 2 more shadow cards.
  { line: "03054:A:1", name: "the first player discards an attachment on a questing character", layout: { committed: ["dh1"], attached: [{ code: "attachment", to: "dh1" }], deck: ["f0"] }, act: reveal("03054"), expect: zone("attachment", "discard") },
  { line: "03054:A:2", name: "its Shadow deals 2 more shadow cards when the attack is undefended", layout: {}, act: attack("f0", { shadow: "03054", undefended: true }), expect: deckCount(1) },

  // 03055 Mountain Warg: back to the staging area after it attacks when a shadow card dealt to it has no Shadow effect; +1 Attack in its Shadow, +1 more with a Mountain as the active location.
  { line: "03055:A:1", name: "it returns to the staging area after an attack whose shadow card has no Shadow effect", layout: {}, act: [attack("03055", { shadow: "f0" }), defend("dh1")], expect: zone("03055", "staging") },
  { line: "03055:A:2", name: "its Shadow gives the attacker +1 Attack", layout: {}, act: attack("f0", { shadow: "03055", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "03055:A:2", name: "its Shadow gives +1 more with a Mountain as the active location", layout: { active: "04019" }, act: attack("f0", { shadow: "03055", undefended: true }), expect: damageOn("dh1", 3) },

  // 03056 Bitter Wind: the first player discards 3 resources from each of his heroes; the Shadow makes the defending player discard 2 from each of his heroes.
  { line: "03056:A:1", name: "the first player discards 3 resources from each hero he controls", layout: { heroResources: 4, deck: ["f0"] }, act: reveal("03056"), expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 1)] },
  { line: "03056:A:2", name: "its Shadow makes the defending player discard 2 resources from each hero", layout: { heroResources: 3 }, act: [attack("f0", { shadow: "03056" }), defend("dh1")], expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 1)] },

  // 03057 Knees of the Mountain: an enemy that engages a player gets +1 Attack until the end of the round.
  { line: "03057:A:1", name: "an enemy that engages a player gets +1 Attack while Knees of the Mountain is in the staging area", layout: { staging: ["03057", "04025"] }, act: announce("engaged", "04025"), expect: stat("04025", "attack", 4) },

  // 03058 Turbulent Waters: no optional engagement while it is the active location.
  { line: "03058:A:1", name: "no player can optionally engage an enemy while it is the active location", layout: { phase: "Encounter", active: "03058", staging: ["04025"] }, act: [], expect: offers("Engage", undefined, false) },

  // 03059 Warg Lair: a Mountain Warg is searched into the staging area; leaving play explored, each player draws 1.
  { line: "03059:A:1", name: "a Mountain Warg is searched out of the encounter deck into the staging area, not revealed", layout: { deck: ["f0", "03055"] }, act: reveal("03059"), expect: [zone("03055", "staging"), deckCount(1)] },
  { line: "03059:A:1", name: "a Mountain Warg in the discard pile is found too", layout: { deck: ["f0"], discard: ["03055"] }, act: reveal("03059"), expect: zone("03055", "staging") },
  { line: "03059:A:2", name: "each player draws 1 when it is explored", layout: { active: { code: "03059", progress: 2 }, deckOf: ["filler", "filler"] }, act: [quest("success"), respond("03059")], expect: drew(1) },

  // 04011 To the Redhorn Gate.
  { line: "04011:A:1", name: "Setup puts Arwen into play under the first player's control", layout: { stage: "04011", side: "A", setAside: ["04014"], deck: ["f0"] }, act: resolve("04011", "setup"), expect: zone("04014", "play") },
  { line: "04011:B:1", name: "each player reveals 1 card into the staging area", layout: { stage: "04011", seats: 2, deck: ["f0", "f3", "f0"] }, act: resolve("04011", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(1)] },

  // 04012 Snowdrifts.
  { line: "04012:B:1", name: "1 more Snowstorm than there are players is shuffled into the encounter deck from the set-aside copies", layout: { stage: "04012", seats: 2, setAside: ["04022", "04022", "04022", "04022", "04022"], deck: ["f0"] }, act: resolve("04012", "whenRevealed"), expect: [count("04022", "encounterDeck", 3), count("04022", "setAside", 2)] },
  { line: "04012:B:2", name: "the active location is discarded and Caradhras becomes the active location from the staging area", layout: { stage: "04012", active: "place", staging: ["04015"] }, act: announce("questCardDefeated", "04012"), expect: [zone("04015", "activeLocation"), zone("place", "encounterDiscard")] },
  { line: "04012:B:2", name: "Caradhras comes back from the victory display", layout: { stage: "04012", active: "place", victory: ["04015"] }, act: announce("questCardDefeated", "04012"), expect: [zone("04015", "activeLocation"), zone("place", "encounterDiscard")] },
  { line: "04012:B:2", name: "Caradhras is searched out of the encounter deck when it lies there", layout: { stage: "04012", active: "place", deck: ["f0", "04015"] }, act: announce("questCardDefeated", "04012"), expect: [zone("04015", "activeLocation"), zone("place", "encounterDiscard")] },
  { line: "04012:B:2", name: "Caradhras is searched out of the encounter discard pile when it lies there", layout: { stage: "04012", active: "place", discard: ["04015"], deck: ["f0"] }, act: announce("questCardDefeated", "04012"), expect: zone("04015", "activeLocation") },

  // 04013 The Mountains' Peaks.
  { line: "04013:B:1", name: "every Snowstorm in the encounter discard pile is shuffled back into the deck", layout: { stage: "04013", discard: ["04022", "04022", "f0"], deck: ["f3"] }, act: resolve("04013", "whenRevealed"), expect: [count("04022", "encounterDeck", 2), count("f0", "encounterDiscard", 1)] },
  { line: "04013:B:2", name: "a hero whose Willpower is 0 is discarded from play when stage 3B is current", layout: { stage: "04013", attached: [{ code: "04023", to: "dh1" }], deck: ["f0"] }, act: reveal("f0"), expect: zone("dh1", "discard") },

  // 04014 Arwen Undómiel: the first player controls her; her Response gives a hero 1 resource when she exhausts; if she leaves play the players lose.
  { line: "04014:A:2", name: "after she exhausts a hero gets 1 resource", layout: { play: ["04014"], deck: ["f0"] }, act: [resolve("04014", "response"), answer("dh1")], expect: resourcesOn("dh1", 1) },
  { line: "04014:A:3", name: "the players lose when she leaves play", layout: { play: ["04014"] }, act: announce("leftPlay", "04014"), expect: lost },

  // 04015 Caradhras: -1 Willpower to every questing character while it is the active location; the players cannot travel to it.
  { line: "04015:A:1", name: "a questing character gets -1 Willpower while it is the active location", layout: { active: "04015", committed: ["dh1"] }, act: [], expect: [stat("dh1", "willpower", 1), stat("dh2", "willpower", 2)] },

  { line: "04015:A:2", name: "the players cannot travel to it", layout: { phase: "Travel", staging: ["04015"] }, act: [], expect: offers("Travel", undefined, false) },

  // 04016 Fanuidhol: a hero's Willpower counts only if its controller spends 1 resource from its pool when the quest total is counted.
  { line: "04016:A:1", name: "a hero that pays spends 1 resource from its own pool and counts its Willpower", layout: { stage: "04011", active: "04016", heroResources: 2, committed: ["dh1", "dh2"] }, act: [announce("questTotalCounted"), answer("pay"), answer("keep")], expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 2), committed("dh1")] },

  // 04017 Celebdil: 2 progress come off it at the end of each round while it is the active location.
  { line: "04017:A:1", name: "2 progress come off it at the end of the round when it is the active location", layout: { active: { code: "04017", progress: 3 } }, act: announce("endOfRound"), expect: progressOn("04017", 1) },

  // 04018 The Dimrill Stair: the locations of the discard pile and the victory display go back into the deck; with 2 or more, each player reduces his threat by 11 and every Freezing Cold in play is discarded.

  // 04019 Rocky Crags and 04021 Fallen Stones share the Shadow: +1 Attack for each progress on the active location.
  { line: "04019:A:1", name: "a player deals 2 damage to a character he controls to travel", layout: { phase: "Travel", staging: ["04019"] }, act: [travel("04019"), answer("dh1")], expect: [damageOn("dh1", 2), zone("04019", "activeLocation")] },
  { line: "04019:A:2", name: "its Shadow gives +1 Attack for each progress token on the active location", layout: { active: { code: "place", progress: 2 } }, act: attack("f0", { shadow: "04019", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "04021:A:2", name: "its Shadow gives +1 Attack for each progress token on the active location", layout: { active: { code: "place", progress: 2 } }, act: attack("f0", { shadow: "04021", undefended: true }), expect: damageOn("dh1", 3) },

  // 04020 Fell Voices.
  { line: "04020:A:1", name: "the top 2 Snow cards go on top in the order the first player chooses; with 1 Snow treachery among them it gains surge, so the top card is revealed", layout: { discard: ["04022", "04027", "f0"], deck: ["f3"] }, act: [reveal("04020"), answer("04027")], expect: [zone("04027", "staging"), zone("04022", "encounterDeck")] },

  // 04021 Fallen Stones: the first player removes every progress token in play or reveals 2 cards.
  { line: "04021:A:1", name: "he may remove every progress token in play: the current quest, the active location, a location in the staging area, a side quest and Blinding Blizzard", layout: { stage: "04012", progress: 4, active: { code: "place", progress: 1 }, staging: [{ code: "04017", progress: 2 }, { code: "901307", progress: 3 }] }, act: [reveal("04021"), answer("remove")], expect: [progressOn("04012", 0), progressOn("place", 0), progressOn("04017", 0), progressOn("901307", 0)] },
  { line: "04021:A:1", name: "or reveal 2 cards, which join the staging area", layout: { deck: ["f0", "f3", "f0"] }, act: [reveal("04021"), answer("reveal")], expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(1)] },

  // 04022 Snowstorm: -1 Willpower to each questing character until the end of the phase; its Shadow gives the defender -1 Willpower.
  { line: "04022:A:1", name: "each questing character gets -1 Willpower", layout: { committed: ["dh1"], deck: ["f0"] }, act: reveal("04022"), expect: [stat("dh1", "willpower", 1), stat("dh2", "willpower", 2)] },
  { line: "04022:A:2", name: "its Shadow gives the defending character -1 Willpower", layout: {}, act: [attack("f0", { shadow: "04022" }), defend("dh1")], expect: stat("dh1", "willpower", 1) },

  // 04023 Freezing Cold: attached to a hero of the first player, -2 Willpower and no quest.
  { line: "04023:A:1", name: "it attaches to a hero the first player controls, who gets -2 Willpower and cannot commit to the quest", layout: { deck: ["f0"] }, act: [reveal("04023"), answer("dh1")], expect: [zone("04023", "attached"), stat("dh1", "willpower", 0), flag("dh1", "cannotQuest")] },

  // 04024 Avalanche!: every ready character exhausts and, in the quest phase, is committed to the quest.
  { line: "04024:A:1", name: "every ready character exhausts and is committed to the quest in the quest phase", layout: { play: ["ally"], deck: ["f0"] }, act: reveal("04024"), expect: [exhausted("dh1"), exhausted("ally"), committed("dh1"), committed("ally")] },
  { line: "04024:A:1", name: "outside the quest phase nothing is committed", layout: { phase: "Encounter", deck: ["f0"] }, act: reveal("04024"), expect: [exhausted("dh1"), committed("dh1", false)] },

  // 04025 Mountain Goblin and 04026 Mountain Troll: +1 Attack for each Mountain location in the staging area.
  { line: "04025:A:1", name: "+1 Attack for each Mountain location in the staging area, the active location not counted", layout: { staging: ["04025", "04017", "03057"], active: "04019" }, act: [], expect: stat("04025", "attack", 4) },
  { line: "04026:A:1", name: "+1 Attack for each Mountain location in the staging area", layout: { staging: ["04026", "04017"] }, act: [], expect: stat("04026", "attack", 6) },

  // 04027 Snow Warg: allies cannot be declared as defenders against it; the character declared as its defender takes 1 damage.
  { line: "04027:A:2", name: "the character declared as its defender takes 1 damage", layout: {}, act: [attack("04027"), defend("dh1")], expect: damageOn("dh1", 2) },

  // 901301 Nightmare setup card.
  { line: "901301:A:2", name: "Setup sets Blinding Blizzard aside", layout: { nightmare: "901301", deck: ["f0", "901307", "901307"] }, act: resolve("901301", "setup"), expect: [count("901307", "setAside", 2), deckCount(1)] },
  { line: "901301:A:3", name: "when stage 2B is revealed both Blinding Blizzards are shuffled into the encounter deck", layout: { stage: "04012", nightmare: "901301", setAside: ["901307", "901307"], deck: ["f0"] }, act: announce("stageRevealed", undefined, { subject: "i2" }), expect: count("901307", "encounterDeck", 2) },

  // 901302 Wolfpelt Goblin.
  { line: "901302:A:2", name: "after it engages the player deals X damage to a character, X the active location's remaining quest points, then 2 progress come off it", layout: { active: { code: "04019", progress: 1 }, engaged: ["901302"] }, act: [announce("engaged", "901302"), answer("dh1")], expect: [damageOn("dh1", 1), progressOn("04019", 0)] },
  { line: "901302:A:2", name: "with X = 0 no damage is dealt and the progress still comes off", layout: { active: { code: "04019", progress: 2 }, engaged: ["901302"] }, act: [announce("engaged", "901302"), answer("dh1")], expect: [damageOn("dh1", 0), progressOn("04019", 0)] },

  // 901303 Silvertine Marauder.
  { line: "901303:A:1", name: "it gets +2 Attack against a defender with 1 Willpower", layout: { play: ["ally"] }, act: [attack("901303"), defend("ally")], expect: damageOn("ally", 4) },
  { line: "901303:A:2", name: "its Shadow gives the attacker +2 Attack against a defender with less than 2 Willpower", layout: { play: ["ally"] }, act: [attack("f0", { shadow: "901303" }), defend("ally")], expect: damageOn("ally", 2) },

  // 901304 Snow-Giant.
  { line: "901304:A:2", name: "after it engages you, you discard the ally you control with the highest Willpower", layout: { play: ["ally"], engaged: ["901304"] }, act: [announce("engaged", "901304")], expect: zone("ally", "discard") },

  { line: "901304:A:2", name: "Arwen is the ally with the highest Willpower: discarding her loses the game", layout: { play: ["04014"], engaged: ["901304"] }, act: announce("engaged", "901304"), expect: lost },

  // 901305 Icy Cavern.
  { line: "901305:A:1", name: "its Threat is the number of Snow cards in the staging area, itself included", layout: { staging: ["901305", "04015", "04027", "f0"] }, act: [], expect: stat("901305", "threat", 3) },
  { line: "901305:A:3", name: "its Shadow gives the defender -1 Willpower (the next shadow card, Silvertine Marauder's, then adds +2) and deals the attacker another shadow card", layout: { deck: ["901303", "f0"] }, act: [attack("f0", { shadow: "901305" }), defend("dh1")], expect: [damageOn("dh1", 1), deckCount(1)] },

  // 901306 Frozen Silverlode.
  { line: "901306:A:2", name: "its Shadow gives the defender -1 Willpower (the next shadow card, Silvertine Marauder's, then adds +2) and deals the attacker another shadow card", layout: { deck: ["901303", "f0"] }, act: [attack("f0", { shadow: "901306" }), defend("dh1")], expect: [damageOn("dh1", 1), deckCount(1)] },

  // 901307 Blinding Blizzard.
  { line: "901307:A:1", name: "heroes do not collect resources while it is in play", layout: { staging: ["901307"] }, act: [], expect: flag("dh1", "noCollection") },
  { line: "901307:A:2", name: "Blinding Blizzard stays in the staging area after its When Revealed", layout: { deck: ["901307"] }, act: reveal("901307"), expect: zone("901307", "staging") },

  // 901308 Caradhras the Cruel.
  { line: "901308:A:1", name: "every Snow card in the discard pile goes on top of the deck and the top card is revealed", layout: { discard: ["04027", "f0"], deck: ["f3"] }, act: reveal("901308"), expect: [zone("04027", "staging"), zone("f0", "encounterDiscard")] },
];

if (ROWS.length > 0) cardSpecs("the-redhorn-gate", ROWS);
else describe("the-redhorn-gate card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
